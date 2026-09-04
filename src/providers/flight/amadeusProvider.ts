import { FlightOffer, TravelSearchQuery } from '../types';

export class AmadeusFlightProvider {
  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private baseUrl: string;
  private isLive: boolean;

  constructor() {
    this.apiKey = process.env.AMADEUS_API_KEY;
    this.apiSecret = process.env.AMADEUS_API_SECRET;
    this.baseUrl = process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com/v2';
    this.isLive = process.env.FLIGHT_PROVIDER === 'amadeus' && !!this.apiKey;
  }

  /**
   * Search flight offers
   * Formatted to match Amadeus v2 /shopping/flight-offers
   */
  async searchFlights(query: TravelSearchQuery): Promise<FlightOffer[]> {
    const origin = (query.origin || 'New York (JFK)').trim();
    const dest = (query.destination || 'Paris (CDG)').trim();
    const startDate = query.startDate || '2026-09-15';
    const endDate = query.endDate || '2026-09-19';
    const preferredCabin = query.preferredCabin || 'Economy';

    // Base mock flights with full cabin pricing tiers & departure periods
    const allFlights: FlightOffer[] = [
      {
        id: 'flt-01',
        airline: 'Air France',
        airlineCode: 'AF',
        flightNumber: 'AF 007',
        origin: origin,
        originAirport: origin.includes('(') ? origin.split('(')[1].replace(')', '') : 'JFK',
        destination: dest,
        destinationAirport: dest.includes('(') ? dest.split('(')[1].replace(')', '') : 'CDG',
        departureDate: startDate,
        departureTime: '19:30',
        arrivalDate: startDate,
        arrivalTime: '08:45 (+1d)',
        duration: '7h 15m',
        stops: 0,
        departurePeriod: 'evening',
        cabinClass: preferredCabin,
        cabinTiers: {
          'Economy': 490,
          'Premium Economy': 680,
          'Business': 1450,
          'First Class': 2900
        },
        price: preferredCabin === 'Premium Economy' ? 680 : preferredCabin === 'Business' ? 1450 : preferredCabin === 'First Class' ? 2900 : 490,
        currency: 'USD'
      },
      {
        id: 'flt-02',
        airline: 'Delta Air Lines',
        airlineCode: 'DL',
        flightNumber: 'DL 264',
        origin: origin,
        originAirport: origin.includes('(') ? origin.split('(')[1].replace(')', '') : 'JFK',
        destination: dest,
        destinationAirport: dest.includes('(') ? dest.split('(')[1].replace(')', '') : 'CDG',
        departureDate: startDate,
        departureTime: '22:15',
        arrivalDate: startDate,
        arrivalTime: '11:30 (+1d)',
        duration: '7h 15m',
        stops: 0,
        departurePeriod: 'night',
        cabinClass: preferredCabin,
        cabinTiers: {
          'Economy': 450,
          'Premium Economy': 590,
          'Business': 1350,
          'First Class': 2750
        },
        price: preferredCabin === 'Premium Economy' ? 590 : preferredCabin === 'Business' ? 1350 : preferredCabin === 'First Class' ? 2750 : 450,
        currency: 'USD'
      },
      {
        id: 'flt-03',
        airline: 'British Airways',
        airlineCode: 'BA',
        flightNumber: 'BA 178',
        origin: origin,
        originAirport: origin.includes('(') ? origin.split('(')[1].replace(')', '') : 'JFK',
        destination: dest,
        destinationAirport: dest.includes('(') ? dest.split('(')[1].replace(')', '') : 'LHR / CDG',
        departureDate: startDate,
        departureTime: '08:00',
        arrivalDate: startDate,
        arrivalTime: '20:10',
        duration: '8h 10m',
        stops: 1,
        departurePeriod: 'morning',
        cabinClass: preferredCabin,
        cabinTiers: {
          'Economy': 395,
          'Premium Economy': 475,
          'Business': 1180,
          'First Class': 2400
        },
        price: preferredCabin === 'Premium Economy' ? 475 : preferredCabin === 'Business' ? 1180 : preferredCabin === 'First Class' ? 2400 : 395,
        currency: 'USD'
      },
      {
        id: 'flt-04',
        airline: 'Lufthansa',
        airlineCode: 'LH',
        flightNumber: 'LH 401',
        origin: origin,
        originAirport: origin.includes('(') ? origin.split('(')[1].replace(')', '') : 'JFK',
        destination: dest,
        destinationAirport: dest.includes('(') ? dest.split('(')[1].replace(')', '') : 'FRA / CDG',
        departureDate: startDate,
        departureTime: '14:15',
        arrivalDate: startDate,
        arrivalTime: '06:20 (+1d)',
        duration: '8h 05m',
        stops: 1,
        departurePeriod: 'afternoon',
        cabinClass: preferredCabin,
        cabinTiers: {
          'Economy': 420,
          'Premium Economy': 540,
          'Business': 1260,
          'First Class': 2600
        },
        price: preferredCabin === 'Premium Economy' ? 540 : preferredCabin === 'Business' ? 1260 : preferredCabin === 'First Class' ? 2600 : 420,
        currency: 'USD'
      }
    ];

    // If a time preference is specified, sort matching flights to the top
    if (query.timePreference) {
      const pref = query.timePreference.toLowerCase();
      allFlights.sort((a, b) => {
        const aMatches = a.departurePeriod.includes(pref) || pref.includes(a.departurePeriod);
        const bMatches = b.departurePeriod.includes(pref) || pref.includes(b.departurePeriod);
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
      });
    }

    return allFlights;
  }
}

export const amadeusFlightProvider = new AmadeusFlightProvider();
