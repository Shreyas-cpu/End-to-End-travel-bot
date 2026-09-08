import { CabinClass, FlightOffer, TravelSearchQuery } from '../types';

export class AmadeusFlightProvider {
  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private baseUrl: string;
  private tokenUrl: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.refreshConfig();
    this.baseUrl = process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com/v2';
    this.tokenUrl = process.env.AMADEUS_TOKEN_URL || 'https://test.api.amadeus.com/v1/security/oauth2/token';
  }

  private refreshConfig() {
    this.apiKey = process.env.AMADEUS_API_KEY;
    this.apiSecret = process.env.AMADEUS_API_SECRET;
  }

  public hasApiKey(): boolean {
    this.refreshConfig();
    return !!(
      this.apiKey && 
      this.apiKey.trim() !== '' && 
      !this.apiKey.includes('xxxx') && 
      this.apiSecret && 
      this.apiSecret.trim() !== '' && 
      !this.apiSecret.includes('xxxx')
    );
  }

  /**
   * Obtain or refresh OAuth2 Bearer token from Amadeus Identity API
   */
  async getAccessToken(): Promise<string> {
    this.refreshConfig();

    if (!this.hasApiKey()) {
      throw new Error('NO_API_KEY: No Amadeus API Key or Secret inserted. Please configure AMADEUS_API_KEY and AMADEUS_API_SECRET in the Admin Dashboard (/admin.html).');
    }

    // Return cached token if still valid (with 60s safety buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.apiKey!);
    params.append('client_secret', this.apiSecret!);

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Amadeus Authentication Failed (${response.status}): ${errBody}`);
    }

    const data: any = await response.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    return this.cachedToken!;
  }

  /**
   * Helper to convert city names or airport strings into 3-letter IATA codes
   */
  private extractIata(input: string, fallback: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/\(([A-Z]{3})\)/);
    if (match) return match[1];

    const lower = trimmed.toLowerCase();
    const cityMap: Record<string, string> = {
      'new york': 'JFK',
      'nyc': 'JFK',
      'jfk': 'JFK',
      'paris': 'CDG',
      'cdg': 'CDG',
      'london': 'LHR',
      'lhr': 'LHR',
      'tokyo': 'HND',
      'hnd': 'HND',
      'rome': 'FCO',
      'fco': 'FCO',
      'dubai': 'DXB',
      'dxb': 'DXB',
      'los angeles': 'LAX',
      'lax': 'LAX',
      'san francisco': 'SFO',
      'sfo': 'SFO',
      'chicago': 'ORD',
      'ord': 'ORD',
      'singapore': 'SIN',
      'sin': 'SIN'
    };

    return cityMap[lower] || fallback;
  }

  /**
   * Search real flight offers via Amadeus v2 /shopping/flight-offers
   */
  async searchFlights(query: TravelSearchQuery): Promise<FlightOffer[]> {
    if (!this.hasApiKey()) {
      throw new Error('NO_API_KEY: No Amadeus API Key or Secret inserted. Please configure AMADEUS_API_KEY and AMADEUS_API_SECRET in the Admin Dashboard (/admin.html).');
    }

    const token = await this.getAccessToken();

    const originIata = this.extractIata(query.origin || 'New York (JFK)', 'JFK');
    const destIata = this.extractIata(query.destination || 'Paris (CDG)', 'CDG');
    const departureDate = query.startDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const adults = query.guests || 1;

    const url = new URL(`${this.baseUrl}/shopping/flight-offers`);
    url.searchParams.append('originLocationCode', originIata);
    url.searchParams.append('destinationLocationCode', destIata);
    url.searchParams.append('departureDate', departureDate);
    url.searchParams.append('adults', adults.toString());
    url.searchParams.append('max', '8');
    url.searchParams.append('currencyCode', 'USD');

    if (query.preferredCabin) {
      const cabinMap: Record<CabinClass, string> = {
        'Economy': 'ECONOMY',
        'Premium Economy': 'PREMIUM_ECONOMY',
        'Business': 'BUSINESS',
        'First Class': 'FIRST'
      };
      const amadeusTravelClass = cabinMap[query.preferredCabin];
      if (amadeusTravelClass) {
        url.searchParams.append('travelClass', amadeusTravelClass);
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Amadeus Flight Search API Error (${response.status}): ${errBody}`);
    }

    const data: any = await response.json();
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error(`No flights found on Amadeus for route ${originIata} -> ${destIata} on ${departureDate}.`);
    }

    return this.mapAmadeusOffers(data.data, query, originIata, destIata);
  }

  private mapAmadeusOffers(rawOffers: any[], query: TravelSearchQuery, originIata: string, destIata: string): FlightOffer[] {
    const preferredCabin = query.preferredCabin || 'Economy';

    const airlineNames: Record<string, string> = {
      'AF': 'Air France',
      'DL': 'Delta Air Lines',
      'BA': 'British Airways',
      'LH': 'Lufthansa',
      'AA': 'American Airlines',
      'UA': 'United Airlines',
      'EK': 'Emirates',
      'QR': 'Qatar Airways',
      'SQ': 'Singapore Airlines',
      'KL': 'KLM Royal Dutch Airlines'
    };

    const offers: FlightOffer[] = rawOffers.map((offer: any, idx: number) => {
      const itinerary = offer.itineraries?.[0];
      const segments = itinerary?.segments || [];
      const firstSeg = segments[0] || {};
      const lastSeg = segments[segments.length - 1] || firstSeg;

      const carrierCode = firstSeg.carrierCode || 'AF';
      const flightNumber = `${carrierCode} ${firstSeg.number || '101'}`;
      const airline = airlineNames[carrierCode] || `Airline (${carrierCode})`;

      const departureTime = firstSeg.departure?.at ? firstSeg.departure.at.substring(11, 16) : '10:00';
      const departureDate = firstSeg.departure?.at ? firstSeg.departure.at.substring(0, 10) : query.startDate || '2026-10-12';
      const arrivalTime = lastSeg.arrival?.at ? lastSeg.arrival.at.substring(11, 16) : '18:30';
      const arrivalDate = lastSeg.arrival?.at ? lastSeg.arrival.at.substring(0, 10) : departureDate;

      // Extract duration (e.g., PT7H15M -> 7h 15m)
      const rawDuration = itinerary?.duration || 'PT7H30M';
      const durationFormatted = rawDuration
        .replace('PT', '')
        .replace('H', 'h ')
        .replace('M', 'm')
        .toLowerCase();

      // Determine departure period
      const depHour = parseInt(departureTime.split(':')[0], 10);
      let departurePeriod: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
      if (depHour >= 5 && depHour < 12) departurePeriod = 'morning';
      else if (depHour >= 12 && depHour < 17) departurePeriod = 'afternoon';
      else if (depHour >= 17 && depHour < 21) departurePeriod = 'evening';
      else departurePeriod = 'night';

      const basePrice = Math.round(parseFloat(offer.price?.total || '450'));

      const cabinTiers: Record<CabinClass, number> = {
        'Economy': basePrice,
        'Premium Economy': Math.round(basePrice * 1.35),
        'Business': Math.round(basePrice * 2.8),
        'First Class': Math.round(basePrice * 5.2)
      };

      const selectedPrice = cabinTiers[preferredCabin] || basePrice;

      return {
        id: offer.id ? `flt-live-${offer.id}` : `flt-${idx + 1}`,
        airline,
        airlineCode: carrierCode,
        flightNumber,
        origin: query.origin || `${originIata} Airport`,
        originAirport: firstSeg.departure?.iataCode || originIata,
        destination: query.destination || `${destIata} Airport`,
        destinationAirport: lastSeg.arrival?.iataCode || destIata,
        departureDate,
        departureTime,
        arrivalDate,
        arrivalTime,
        duration: durationFormatted,
        stops: Math.max(0, segments.length - 1),
        departurePeriod,
        cabinClass: preferredCabin,
        cabinTiers,
        price: selectedPrice,
        currency: offer.price?.currency || 'USD'
      };
    });

    // If time preference given, sort matching flights to top
    if (query.timePreference) {
      const pref = query.timePreference.toLowerCase();
      offers.sort((a, b) => {
        const aMatches = a.departurePeriod.includes(pref) || pref.includes(a.departurePeriod);
        const bMatches = b.departurePeriod.includes(pref) || pref.includes(b.departurePeriod);
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
      });
    }

    return offers;
  }
}

export const amadeusFlightProvider = new AmadeusFlightProvider();
