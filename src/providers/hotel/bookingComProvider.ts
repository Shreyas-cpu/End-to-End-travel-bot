import { HotelAccommodation, TravelSearchQuery } from "../types";

export interface BookingComLocationTarget {
  airport?: string;
  cityId?: number;
  country?: string;
}

export const BOOKING_COM_CITY_METADATA: Record<string, BookingComLocationTarget> = {
  paris: { airport: "CDG", cityId: -1456928, country: "FR" },
  london: { airport: "LHR", cityId: -2601889, country: "GB" },
  "new york": { airport: "JFK", cityId: 20088325, country: "US" },
  tokyo: { airport: "HND", cityId: -246227, country: "JP" },
  amsterdam: { airport: "AMS", cityId: -2140479, country: "NL" },
  dubai: { airport: "DXB", cityId: -782831, country: "AE" },
  rome: { airport: "FCO", cityId: -126693, country: "IT" },
  berlin: { airport: "BER", cityId: -1746443, country: "DE" },
  barcelona: { airport: "BCN", cityId: -372490, country: "ES" },
  madrid: { airport: "MAD", cityId: -390625, country: "ES" },
  singapore: { airport: "SIN", cityId: -73635, country: "SG" },
  sydney: { airport: "SYD", cityId: -1603135, country: "AU" },
  "los angeles": { airport: "LAX", cityId: 20014181, country: "US" },
  "san francisco": { airport: "SFO", cityId: 20015732, country: "US" },
  chicago: { airport: "ORD", cityId: 20033173, country: "US" },
  miami: { airport: "MIA", cityId: 20023181, country: "US" },
  toronto: { airport: "YYZ", cityId: -574890, country: "CA" },
  mumbai: { airport: "BOM", cityId: -2092174, country: "IN" },
  delhi: { airport: "DEL", cityId: -2106102, country: "IN" },
  bangkok: { airport: "BKK", cityId: -3414440, country: "TH" },
  frankfurt: { airport: "FRA", cityId: -1771148, country: "DE" },
  munich: { airport: "MUC", cityId: -1829149, country: "DE" },
  zurich: { airport: "ZRH", cityId: -2554757, country: "CH" },
  vienna: { airport: "VIE", cityId: -1995499, country: "AT" }
};

export class BookingComHotelProvider {
  private apiKey: string | undefined;
  private affiliateId: string | undefined;
  private baseUrl: string;

  constructor() {
    this.refreshConfig();
    this.baseUrl = process.env.BOOKING_COM_BASE_URL || "https://demandapi.booking.com/3.2";
  }

  private refreshConfig() {
    this.apiKey = process.env.BOOKING_COM_API_KEY;
    this.affiliateId = process.env.BOOKING_COM_AFFILIATE_ID;
    this.baseUrl = process.env.BOOKING_COM_BASE_URL || "https://demandapi.booking.com/3.2";
  }

  public getHeaders(): Record<string, string> {
    this.refreshConfig();
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    if (this.affiliateId && this.affiliateId.trim() !== "") {
      headers["X-Affiliate-Id"] = this.affiliateId.trim();
    }
    return headers;
  }

  public resolveLocation(destination?: string): BookingComLocationTarget {
    if (!destination) {
      return { airport: "CDG", country: "FR" };
    }
    const clean = destination.trim().toLowerCase();

    // Check direct 3-letter IATA code (e.g., "JFK", "CDG", "AMS")
    if (/^[a-z]{3}$/i.test(clean)) {
      return { airport: clean.toUpperCase(), country: "US" };
    }

    // Check airport code in parentheses e.g. "Paris (CDG)" or "London (LHR)"
    const match = clean.match(/\(([a-z]{3})\)/i);
    if (match && match[1]) {
      return { airport: match[1].toUpperCase(), country: "US" };
    }

    // Match against known city database
    for (const [cityName, meta] of Object.entries(BOOKING_COM_CITY_METADATA)) {
      if (clean.includes(cityName) || cityName.includes(clean)) {
        return { airport: meta.airport, cityId: meta.cityId, country: meta.country };
      }
    }

    // Default fallback to IATA standard CDG / FR
    return { airport: "CDG", country: "FR" };
  }

  public hasApiKey(): boolean {
    this.refreshConfig();
    return !!(
      this.apiKey && 
      this.apiKey.trim() !== "" && 
      !this.apiKey.includes("xxxx")
    );
  }

  public isMock(): boolean {
    return (process.env.HOTEL_PROVIDER || "booking_com") === "mock";
  }

  /**
   * Generates high-fidelity mock accommodations for testing purposes (carousels & airport default)
   */
  public getMockAccommodations(query: TravelSearchQuery): HotelAccommodation[] {
    const dest = (query.destination || "Paris").trim();
    const destLower = dest.toLowerCase();
    const nights = 4;

    const imgGallery = [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80"
    ];

    const mockDatabases: Record<string, HotelAccommodation[]> = {
      paris: [
        {
          id: "hotel-paris-01",
          name: "Ibis Paris CDG Airport Hub",
          city: "Paris",
          address: "Terminal 3 Roissypole, 93290 Roissy-en-France",
          starRating: 3,
          reviewScore: 8.3,
          reviewCount: 4120,
          reviewRatingText: "Very Good",
          imageUrl: imgGallery[3],
          images: [imgGallery[3], imgGallery[1], imgGallery[4]],
          area: "Near Airport",
          distanceToAirport: "0.5 km to CDG Airport Terminal",
          roomType: "Standard Soundproof Double Room",
          bedConfig: "1 Sweet Bed Double",
          pricePerNight: 95,
          totalNights: nights,
          totalPrice: 95 * nights,
          currency: "USD",
          amenities: ["Free Airport Shuttle", "24/7 Front Desk", "Soundproof Windows", "Express Breakfast"],
          cancellationPolicy: "Free cancellation until 24h before arrival",
          breakfastIncluded: true
        },
        {
          id: "hotel-paris-02",
          name: "CitizenM Paris Charles de Gaulle Airport",
          city: "Paris",
          address: "7 Rue de Rome, 93290 Tremblay-en-France",
          starRating: 4,
          reviewScore: 8.9,
          reviewCount: 3890,
          reviewRatingText: "Fabulous",
          imageUrl: imgGallery[1],
          images: [imgGallery[1], imgGallery[2], imgGallery[0]],
          area: "Near Airport",
          distanceToAirport: "0.8 km to CDG Airport",
          roomType: "King Room with Mood Lighting & XL Bed",
          bedConfig: "1 Extra-Large King Bed",
          pricePerNight: 140,
          totalNights: nights,
          totalPrice: 140 * nights,
          currency: "USD",
          amenities: ["Free High-Speed WiFi", "CanteenM 24/7 Bar", "iMac Business Workstations", "Rain Shower"],
          cancellationPolicy: "Free cancellation until 48h before arrival",
          breakfastIncluded: true
        },
        {
          id: "hotel-paris-03",
          name: "Novotel Paris Roissy CDG Convention",
          city: "Paris",
          address: "Allée des Vergers, 95700 Roissy-en-France",
          starRating: 4,
          reviewScore: 8.6,
          reviewCount: 2950,
          reviewRatingText: "Fabulous",
          imageUrl: imgGallery[4],
          images: [imgGallery[4], imgGallery[5], imgGallery[1]],
          area: "Near Airport",
          distanceToAirport: "2.1 km to CDG Airport",
          roomType: "Superior Family Room",
          bedConfig: "1 Queen Bed + 1 Sofa Bed",
          pricePerNight: 160,
          totalNights: nights,
          totalPrice: 160 * nights,
          currency: "USD",
          amenities: ["Heated Indoor Pool", "Airport Shuttle Service", "Fitness Center", "French Bistro Restaurant"],
          cancellationPolicy: "Free cancellation until 24h before arrival",
          breakfastIncluded: false
        },
        {
          id: "hotel-paris-04",
          name: "Hôtel Malte - Astotel Opéra",
          city: "Paris",
          address: "63 Rue de Richelieu, 75002 Paris",
          starRating: 4,
          reviewScore: 9.3,
          reviewCount: 1840,
          reviewRatingText: "Superb",
          imageUrl: imgGallery[0],
          images: [imgGallery[0], imgGallery[2], imgGallery[3]],
          area: "City Center",
          distanceToAirport: "23 km to CDG Airport",
          roomType: "Classic Double Room with Courtyard View",
          bedConfig: "1 Double Bed",
          pricePerNight: 215,
          totalNights: nights,
          totalPrice: 215 * nights,
          currency: "USD",
          amenities: ["Complimentary Afternoon Open Bar", "Inner Patio", "Nespresso Machine", "Free High-Speed WiFi"],
          cancellationPolicy: "Free cancellation until 48h before arrival",
          breakfastIncluded: true
        },
        {
          id: "hotel-paris-05",
          name: "Pullman Paris Tour Eiffel",
          city: "Paris",
          address: "18 Avenue De Suffren, 75015 Paris",
          starRating: 4,
          reviewScore: 8.8,
          reviewCount: 5210,
          reviewRatingText: "Fabulous",
          imageUrl: imgGallery[2],
          images: [imgGallery[2], imgGallery[0], imgGallery[5]],
          area: "Downtown",
          distanceToAirport: "28 km to CDG Airport",
          roomType: "Deluxe Room with Eiffel Tower Balcony View",
          bedConfig: "1 King Bed",
          pricePerNight: 295,
          totalNights: nights,
          totalPrice: 295 * nights,
          currency: "USD",
          amenities: ["Direct Eiffel Tower Views", "Frame Brasserie", "Fitness Lounge", "Terrace Bar"],
          cancellationPolicy: "Free cancellation until 72h before arrival",
          breakfastIncluded: true
        },
        {
          id: "hotel-paris-06",
          name: "Le Pavillon de la Reine & Spa",
          city: "Paris",
          address: "28 Place des Vosges, 75003 Paris",
          starRating: 5,
          reviewScore: 9.6,
          reviewCount: 1420,
          reviewRatingText: "Exceptional",
          imageUrl: imgGallery[5],
          images: [imgGallery[5], imgGallery[1], imgGallery[4]],
          area: "Historic",
          distanceToAirport: "24 km to CDG Airport",
          roomType: "Prestige Junior Suite",
          bedConfig: "1 King Bed",
          pricePerNight: 390,
          totalNights: nights,
          totalPrice: 390 * nights,
          currency: "USD",
          amenities: ["Spa de la Reine by Codage", "Private Shaded Courtyard", "Free Valet Parking", "Michelin Dining"],
          cancellationPolicy: "Free cancellation until 72h before arrival",
          breakfastIncluded: true
        },
        {
          id: "hotel-paris-07",
          name: "The Ritz Paris Luxury Residence",
          city: "Paris",
          address: "15 Place Vendôme, 75001 Paris",
          starRating: 5,
          reviewScore: 9.8,
          reviewCount: 980,
          reviewRatingText: "Exceptional",
          imageUrl: imgGallery[0],
          images: [imgGallery[0], imgGallery[2], imgGallery[1]],
          area: "City Center",
          distanceToAirport: "26 km to CDG Airport",
          roomType: "Grand Deluxe Suite Vendôme",
          bedConfig: "1 California King Bed",
          pricePerNight: 580,
          totalNights: nights,
          totalPrice: 580 * nights,
          currency: "USD",
          amenities: ["Chanel Spa", "Private Butler Service", "Espadon Michelin Restaurant", "Historic Bar Hemingway"],
          cancellationPolicy: "Free cancellation until 7 days prior",
          breakfastIncluded: true
        }
      ]
    };

    let resultHotels = mockDatabases[destLower];

    // Universal dynamic mock generator for any city worldwide
    if (!resultHotels) {
      resultHotels = [
        {
          id: `hotel-${destLower}-01`,
          name: `${dest} Airport Transit Plaza Hotel`,
          city: dest,
          address: `Airport Boulevard, Gate 2, ${dest}`,
          starRating: 3,
          reviewScore: 8.4,
          reviewCount: 2150,
          reviewRatingText: "Very Good",
          imageUrl: imgGallery[3],
          images: [imgGallery[3], imgGallery[1], imgGallery[4]],
          area: "Near Airport",
          distanceToAirport: "0.6 km from Airport Terminal",
          roomType: "Soundproof Comfort Double",
          bedConfig: "1 Double Bed",
          pricePerNight: 90,
          totalNights: nights,
          totalPrice: 90 * nights,
          currency: "USD",
          amenities: ["Free 24/7 Airport Shuttle", "Soundproof Rooms", "High-Speed WiFi", "Express Breakfast"],
          cancellationPolicy: "Free cancellation until 24h prior",
          breakfastIncluded: true
        },
        {
          id: `hotel-${destLower}-02`,
          name: `${dest} Airport Marriott & Suites`,
          city: dest,
          address: `Aviation Parkway, ${dest}`,
          starRating: 4,
          reviewScore: 8.7,
          reviewCount: 1950,
          reviewRatingText: "Fabulous",
          imageUrl: imgGallery[1],
          images: [imgGallery[1], imgGallery[2], imgGallery[0]],
          area: "Near Airport",
          distanceToAirport: "1.2 km from Airport",
          roomType: "Executive King Room with Runway View",
          bedConfig: "1 King Bed",
          pricePerNight: 135,
          totalNights: nights,
          totalPrice: 135 * nights,
          currency: "USD",
          amenities: ["Indoor Pool", "Free Airport Transfer", "Runway Views", "Fitness Center"],
          cancellationPolicy: "Free cancellation until 24h prior",
          breakfastIncluded: true
        },
        {
          id: `hotel-${destLower}-03`,
          name: `Urban Smart Stay ${dest}`,
          city: dest,
          address: `88 Tech Quarter, Metro Station 3, ${dest}`,
          starRating: 3,
          reviewScore: 8.5,
          reviewCount: 2200,
          reviewRatingText: "Very Good",
          imageUrl: imgGallery[4],
          images: [imgGallery[4], imgGallery[5], imgGallery[1]],
          area: "Downtown",
          distanceToAirport: "14 km from Airport",
          roomType: "Comfort Double Room",
          bedConfig: "1 Double Bed",
          pricePerNight: 110,
          totalNights: nights,
          totalPrice: 110 * nights,
          currency: "USD",
          amenities: ["Steps from Metro", "Keyless Mobile Entry", "Complimentary Coffee & Tea", "Co-working Lounge"],
          cancellationPolicy: "Free cancellation until 24h prior",
          breakfastIncluded: false
        },
        {
          id: `hotel-${destLower}-04`,
          name: `${dest} City Center Boutique Hotel`,
          city: dest,
          address: `45 Royal Boulevard, Historic District, ${dest}`,
          starRating: 4,
          reviewScore: 8.8,
          reviewCount: 1430,
          reviewRatingText: "Excellent",
          imageUrl: imgGallery[0],
          images: [imgGallery[0], imgGallery[2], imgGallery[3]],
          area: "Historic",
          distanceToAirport: "18 km from Airport",
          roomType: "Deluxe Double Room",
          bedConfig: "1 Queen Bed",
          pricePerNight: 165,
          totalNights: nights,
          totalPrice: 165 * nights,
          currency: "USD",
          amenities: ["Central Location", "Terrace Cocktail Bar", "Free High-Speed WiFi", "Rain Shower"],
          cancellationPolicy: "Free cancellation until 48h prior",
          breakfastIncluded: true
        },
        {
          id: `hotel-${destLower}-05`,
          name: `The Grand Palace Hotel & Spa ${dest}`,
          city: dest,
          address: `101 Promenade Avenue, Downtown, ${dest}`,
          starRating: 5,
          reviewScore: 9.2,
          reviewCount: 1920,
          reviewRatingText: "Superb",
          imageUrl: imgGallery[2],
          images: [imgGallery[2], imgGallery[0], imgGallery[5]],
          area: "City Center",
          distanceToAirport: "16 km from Airport",
          roomType: "Executive Suite with City Skyline View",
          bedConfig: "1 King Bed + Living Area",
          pricePerNight: 240,
          totalNights: nights,
          totalPrice: 240 * nights,
          currency: "USD",
          amenities: ["Infinity Pool", "Luxury Spa & Sauna", "Buffet Breakfast", "Free Ultra-Fast WiFi"],
          cancellationPolicy: "Free cancellation until 24h prior",
          breakfastIncluded: true
        },
        {
          id: `hotel-${destLower}-06`,
          name: `Crown Royal Plaza ${dest}`,
          city: dest,
          address: `72 Grand Avenue, Waterfront, ${dest}`,
          starRating: 4,
          reviewScore: 8.9,
          reviewCount: 1800,
          reviewRatingText: "Fabulous",
          imageUrl: imgGallery[5],
          images: [imgGallery[5], imgGallery[1], imgGallery[4]],
          area: "Downtown",
          distanceToAirport: "15 km from Airport",
          roomType: "Premium King Harbor View",
          bedConfig: "1 King Bed",
          pricePerNight: 195,
          totalNights: nights,
          totalPrice: 195 * nights,
          currency: "USD",
          amenities: ["Harbor Views", "Rooftop Grill", "24/7 Concierge", "Heated Pool"],
          cancellationPolicy: "Free cancellation until 48h prior",
          breakfastIncluded: true
        },
        {
          id: `hotel-${destLower}-07`,
          name: `The Ritz Regency ${dest}`,
          city: dest,
          address: `1 Embassy Way, Diplomatic Enclave, ${dest}`,
          starRating: 5,
          reviewScore: 9.5,
          reviewCount: 1100,
          reviewRatingText: "Exceptional",
          imageUrl: imgGallery[0],
          images: [imgGallery[0], imgGallery[2], imgGallery[1]],
          area: "City Center",
          distanceToAirport: "20 km from Airport",
          roomType: "Presidential Luxury Suite",
          bedConfig: "1 California King Bed",
          pricePerNight: 320,
          totalNights: nights,
          totalPrice: 320 * nights,
          currency: "USD",
          amenities: ["Michelin Dining", "Private Spa Pavilion", "Chauffeur Service", "24/7 Butler"],
          cancellationPolicy: "Free cancellation until 72h prior",
          breakfastIncluded: true
        }
      ];
    }

    // Default sorting: lowest to highest price per night
    return [...resultHotels].sort((a, b) => a.pricePerNight - b.pricePerNight);
  }

  /**
   * Search accommodations matching destination, dates, and guest count (Live Demand API v3.2 or Mock)
   */
  async searchAccommodations(query: TravelSearchQuery): Promise<HotelAccommodation[]> {
    this.refreshConfig();

    if (this.isMock()) {
      return this.getMockAccommodations(query);
    }

    if (!this.hasApiKey()) {
      throw new Error("NO_API_KEY: No Booking.com API Key inserted. Please configure BOOKING_COM_API_KEY in the Admin Dashboard (/admin.html).");
    }

    const checkin = query.startDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const checkout = query.endDate || new Date(Date.now() + 18 * 86400000).toISOString().split("T")[0];
    const adults = query.guests || 2;
    const destination = query.destination || "Paris";
    const loc = this.resolveLocation(destination);

    const searchPayload: any = {
      booker: {
        country: loc.country || "US",
        platform: "desktop"
      },
      checkin,
      checkout,
      guests: {
        number_of_adults: adults,
        number_of_rooms: 1
      },
      extras: ["extra_charges", "products"]
    };

    if (loc.airport) {
      searchPayload.airport = loc.airport;
    } else if (loc.cityId) {
      searchPayload.city = loc.cityId;
    }

    const response = await fetch(`${this.baseUrl}/accommodations/search`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Booking.com Demand API Error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error(`No hotel accommodations found on Booking.com for ${destination} between ${checkin} and ${checkout}.`);
    }

    // If search already returns enriched objects (e.g. In unit test suites or mock proxies)
    if (data.data[0].name && (data.data[0].photos || data.data[0].images)) {
      return this.mapLiveResponse(data.data, query, checkin, checkout);
    }

    // Official Booking.com Demand API v3.2 lifecycle:
    // /accommodations/search returns accommodation IDs & product rates;
    // We enrich with static hotel metadata (names, photos, amenities, ratings) via /accommodations/details
    return this.enrichAndMapAccommodations(data.data, query, checkin, checkout);
  }

  /**
   * Enriches Demand API search items with /accommodations/details
   */
  private async enrichAndMapAccommodations(
    items: any[],
    query: TravelSearchQuery,
    checkin: string,
    checkout: string
  ): Promise<HotelAccommodation[]> {
    const candidateIds = items.slice(0, 15).map((item: any) => {
      const id = item.id;
      return typeof id === "number" ? id : parseInt(String(id).replace(/\D/g, ""), 10) || 10004;
    }).filter((id: number) => !isNaN(id));

    const detailsMap: Map<number | string, any> = new Map();

    if (candidateIds.length > 0) {
      try {
        const detailsRes = await fetch(`${this.baseUrl}/accommodations/details`, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            accommodations: candidateIds,
            extras: ["photos", "facilities", "policies", "rooms", "description"],
            languages: ["en-gb", "en-us"]
          })
        });

        if (detailsRes.ok) {
          const detailsData: any = await detailsRes.json();
          if (detailsData?.data && Array.isArray(detailsData.data)) {
            for (const d of detailsData.data) {
              detailsMap.set(d.id, d);
              detailsMap.set(String(d.id), d);
            }
          }
        }
      } catch (detailErr) {
        console.warn("[BookingComProvider] /accommodations/details enrichment failed, using default mapping:", detailErr);
      }
    }

    const d1 = new Date(checkin).getTime();
    const d2 = new Date(checkout).getTime();
    const nights = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24))) || 4;

    const defaultPhotos = [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop&q=80"
    ];

    return items.slice(0, 15).map((item: any, idx: number) => {
      const detail = detailsMap.get(item.id) || detailsMap.get(String(item.id));

      // Extract translated hotel name
      let hotelName = `Booking.com Hotel ${idx + 1}`;
      if (detail?.name) {
        hotelName = detail.name["en-gb"] || detail.name["en-us"] || (typeof detail.name === "string" ? detail.name : hotelName);
      } else if (item.name) {
        hotelName = item.name;
      } else if (detail?.fiscal_information?.legal_name) {
        hotelName = detail.fiscal_information.legal_name;
      }

      // Extract translated address
      let address = "City Center";
      if (detail?.location?.address) {
        const addrObj = detail.location.address;
        address = addrObj["en-gb"] || addrObj["en-us"] || (typeof addrObj === "string" ? addrObj : address);
      } else if (item.address?.address_line_1 || item.address) {
        address = item.address?.address_line_1 || item.address;
      }

      // Extract photo gallery
      let photos: string[] = [];
      if (detail?.photos && Array.isArray(detail.photos)) {
        photos = detail.photos.map((p: any) => p.url?.large || p.url?.standard || p.url?.thumbnail || (typeof p === "string" ? p : "")).filter(Boolean);
      }
      if (photos.length === 0 && item.photos && Array.isArray(item.photos)) {
        photos = item.photos.map((p: any) => typeof p === "string" ? p : (p.url || "")).filter(Boolean);
      }
      if (photos.length === 0) {
        photos = defaultPhotos;
      }
      const mainImg = photos[0] || defaultPhotos[0];
      const images = photos.length >= 3 ? photos.slice(0, 5) : [mainImg, defaultPhotos[1], defaultPhotos[2]];

      // Price calculation
      const firstProduct = (item.products && item.products[0]) ? item.products[0] : undefined;
      const pricePerNight = firstProduct?.price?.display?.value || 
        firstProduct?.price?.base?.accommodation_currency || 
        item.price_breakdown?.gross_amount?.value || 
        item.price?.base?.accommodation_currency || 
        item.price || 
        180;

      const starRating = detail?.rating?.stars || item.star_rating || item.stars || 4;
      const reviewScore = detail?.rating?.review_score || item.review_score || 8.5;
      const reviewCount = detail?.rating?.number_of_reviews || item.review_count || 450;
      const area = (item.area || (idx === 0 ? "Near Airport" : "City Center")) as 'Near Airport' | 'City Center' | 'Downtown' | 'Historic' | 'Suburbs';

      // Meal plan & cancellation policies
      const cancellationType = firstProduct?.policies?.cancellation?.type || item.cancellation_policy;
      const cancellationPolicy = cancellationType === "free_cancellation" 
        ? "Free cancellation until 48 hours prior to check-in"
        : (typeof cancellationType === "string" ? cancellationType : "Free cancellation available");
      const mealPlan = firstProduct?.policies?.meal_plan?.plan;
      const breakfastIncluded = Boolean(mealPlan === "breakfast_included" || mealPlan === "all_inclusive" || item.breakfast_included);

      return {
        id: String(item.id || `bkg-prop-${idx + 1}`),
        name: hotelName,
        city: query.destination || "Destination City",
        address,
        starRating,
        reviewScore,
        reviewCount,
        reviewRatingText: reviewScore >= 9 ? "Superb" : reviewScore >= 8 ? "Very Good" : "Good",
        imageUrl: mainImg,
        images,
        area,
        distanceToAirport: item.distance_to_airport || (idx === 0 ? "0.8 km from Airport" : "12 km from Airport"),
        roomType: firstProduct?.id ? `Standard Room (${firstProduct.id})` : (item.rooms?.[0]?.name || item.room_type || "Deluxe Double Room"),
        bedConfig: item.bed_config || "1 Extra-Large Double Bed",
        pricePerNight,
        totalNights: nights,
        totalPrice: pricePerNight * nights,
        currency: item.price_breakdown?.gross_amount?.currency || item.currency?.accommodation || item.currency || "USD",
        amenities: ["Free High-Speed WiFi", "Soundproof Rooms", "Complimentary Toiletries", "24/7 Front Desk"],
        cancellationPolicy,
        breakfastIncluded,
        productId: firstProduct?.id,
        deepLinkUrl: item.deep_link_url,
        checkinCheckoutTimes: detail?.checkin_checkout_times ? {
          checkinFrom: detail.checkin_checkout_times.checkin_from,
          checkinTo: detail.checkin_checkout_times.checkin_to,
          checkoutFrom: detail.checkin_checkout_times.checkout_from,
          checkoutTo: detail.checkin_checkout_times.checkout_to
        } : undefined
      };
    }).sort((a, b) => a.pricePerNight - b.pricePerNight);
  }

  private mapLiveResponse(items: any[], query: TravelSearchQuery, checkin: string, checkout: string): HotelAccommodation[] {
    const d1 = new Date(checkin).getTime();
    const d2 = new Date(checkout).getTime();
    const nights = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24))) || 4;

    return items.map((item: any, idx: number) => {
      const pricePerNight = item.price_breakdown?.gross_amount?.value || item.price || 180;
      const photos = (item.photos && Array.isArray(item.photos)) ? item.photos.map((p: any) => typeof p === 'string' ? p : p.url) : [];
      const mainImg = photos[0] || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80";
      const images = photos.length >= 3 ? photos.slice(0, 5) : [
        mainImg,
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop&q=80"
      ];

      const starRating = item.star_rating || item.stars || 4;
      const reviewScore = item.review_score || 8.5;
      const area = (item.area || "City Center") as 'Near Airport' | 'City Center' | 'Downtown' | 'Historic' | 'Suburbs';

      return {
        id: item.id || `bkg-live-${idx + 1}`,
        name: item.name || `Booking.com Partner Hotel ${idx + 1}`,
        city: query.destination || "Destination City",
        address: item.address?.address_line_1 || item.address || "Central District",
        starRating,
        reviewScore,
        reviewCount: item.review_count || 500,
        reviewRatingText: reviewScore >= 9 ? "Superb" : reviewScore >= 8 ? "Very Good" : "Good",
        imageUrl: mainImg,
        images,
        area,
        distanceToAirport: item.distance_to_airport || "10 km from Airport",
        roomType: item.rooms?.[0]?.name || item.room_type || "Deluxe King Room",
        bedConfig: item.bed_config || "1 Extra-Large Double Bed",
        pricePerNight,
        totalNights: nights,
        totalPrice: pricePerNight * nights,
        currency: item.price_breakdown?.gross_amount?.currency || item.currency || "USD",
        amenities: item.amenities || ["Free High-Speed WiFi", "Spa & Wellness Centre", "Complimentary Breakfast", "Fitness Center"],
        cancellationPolicy: item.cancellation_policy || "Free cancellation until 48 hours prior to check-in",
        breakfastIncluded: Boolean(item.breakfast_included ?? true),
        productId: item.productId,
        deepLinkUrl: item.deep_link_url
      };
    });
  }

  /**
   * Implements Booking.com Demand API v3.2 POST /orders/preview
   */
  async previewOrder(
    hotel: HotelAccommodation,
    options?: { checkin?: string; checkout?: string; guests?: number; country?: string }
  ): Promise<{ orderToken: string; price: number; taxes: number; total: number; rawPreview?: any }> {
    this.refreshConfig();

    if (this.isMock()) {
      const orderToken = `ord_tok_bkg_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
      const price = hotel.totalPrice;
      const taxes = Math.round(price * 0.12 * 100) / 100;
      const total = price + taxes;

      return {
        orderToken,
        price,
        taxes,
        total
      };
    }

    if (!this.hasApiKey()) {
      throw new Error("NO_API_KEY: No Booking.com API Key inserted. Please configure BOOKING_COM_API_KEY in the Admin Dashboard (/admin.html).");
    }

    const checkin = options?.checkin || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const checkout = options?.checkout || new Date(Date.now() + 18 * 86400000).toISOString().split("T")[0];
    const adults = options?.guests || 2;
    const hotelNumericId = parseInt(hotel.id.replace(/\D/g, ""), 10) || 10004;
    const productId = hotel.productId || `${hotel.id}_product_default`;

    try {
      const response = await fetch(`${this.baseUrl}/orders/preview`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          currency: hotel.currency || "USD",
          accommodation: {
            id: hotelNumericId,
            booker: {
              country: options?.country || "US",
              platform: "desktop",
              travel_purpose: "leisure"
            },
            checkin,
            checkout,
            products: [
              {
                id: productId,
                allocation: {
                  number_of_adults: adults,
                  children: []
                }
              }
            ]
          }
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const orderToken = data?.data?.order_token || `ord_tok_bkg_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
        const basePrice = data?.data?.accommodation?.price?.base?.accommodation_currency || hotel.totalPrice;
        const total = data?.data?.accommodation?.price?.total?.accommodation_currency || hotel.totalPrice;
        const taxes = Math.max(0, Math.round((total - basePrice) * 100) / 100);

        return {
          orderToken,
          price: basePrice,
          taxes,
          total: total || (basePrice + taxes),
          rawPreview: data?.data
        };
      }
    } catch (err) {
      console.warn("[BookingComProvider] Live /orders/preview error, using calculated price fallback:", err);
    }

    // Graceful fallback with calculated rates
    const orderToken = `ord_tok_bkg_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    const price = hotel.totalPrice;
    const taxes = Math.round(price * 0.12 * 100) / 100;
    return {
      orderToken,
      price,
      taxes,
      total: price + taxes
    };
  }

  /**
   * Implements Booking.com Demand API v3.2 POST /orders/create
   */
  async createOrder(params: {
    orderToken: string;
    booker: {
      firstName: string;
      lastName: string;
      email: string;
      telephone?: string;
      country?: string;
      addressLine?: string;
      city?: string;
      postCode?: string;
    };
    productId?: string;
    guestNames?: string[];
    specialRequests?: string;
    payment?: {
      method?: "card" | "wallet" | "airplus";
      timing?: "pay_at_the_property" | "pay_online_now" | "pay_online_later";
      card?: {
        cardholder: string;
        number: string;
        expiry_date: string;
        cvc: string;
      };
    };
  }): Promise<{
    orderId: string;
    reservationId: string;
    pincode: string;
    receiptUrl?: string;
    rawOrder?: any;
  }> {
    this.refreshConfig();

    if (this.isMock()) {
      return {
        orderId: `ord_mock_${Math.random().toString(36).substring(2, 10)}`,
        reservationId: `RES-MOCK-${Math.floor(10000000 + Math.random() * 90000000)}`,
        pincode: String(Math.floor(1000 + Math.random() * 9000)),
        receiptUrl: `https://secure.booking.com/receipt/mock?order=${Date.now()}`
      };
    }

    if (!this.hasApiKey()) {
      throw new Error("NO_API_KEY: No Booking.com API Key inserted. Please configure BOOKING_COM_API_KEY in the Admin Dashboard (/admin.html).");
    }

    const payload: any = {
      order_token: params.orderToken,
      booker: {
        name: {
          first_name: params.booker.firstName,
          last_name: params.booker.lastName
        },
        email: params.booker.email,
        telephone: params.booker.telephone || "1234567890",
        address: {
          address_line: params.booker.addressLine || "1 Main Street",
          city: params.booker.city || "New York",
          country: (params.booker.country || "us").toLowerCase(),
          post_code: params.booker.postCode || "10001"
        },
        language: "en-gb"
      },
      accommodation: {
        products: [
          {
            id: params.productId || "product_default",
            guests: (params.guestNames && params.guestNames.length > 0)
              ? params.guestNames.map(name => ({ name, email: params.booker.email }))
              : [{ name: `${params.booker.firstName} ${params.booker.lastName}`, email: params.booker.email }]
          }
        ],
        remarks: params.specialRequests ? { special_requests: params.specialRequests } : undefined
      },
      payment: params.payment || {
        method: "card",
        timing: "pay_at_the_property",
        include_receipt: true
      }
    };

    const response = await fetch(`${this.baseUrl}/orders/create`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Booking.com Orders Create Failed (${response.status}): ${errText}`);
    }

    const resData: any = await response.json();
    return {
      orderId: resData.order || `ord_${Date.now()}`,
      reservationId: resData.data?.accommodation?.reservation || `res_${Date.now()}`,
      pincode: resData.data?.accommodation?.pincode || "0000",
      receiptUrl: resData.data?.payment?.receipt_url,
      rawOrder: resData
    };
  }

  /**
   * Implements Booking.com Demand API v3.2 POST /accommodations/availability
   */
  async checkAvailability(
    accommodationIds: (number | string)[],
    checkin: string,
    checkout: string,
    adults: number = 2
  ): Promise<any> {
    this.refreshConfig();
    if (this.isMock() || !this.hasApiKey()) return { available: true };

    const ids = accommodationIds.map(id => typeof id === "number" ? id : parseInt(String(id).replace(/\D/g, ""), 10) || 10004);
    const res = await fetch(`${this.baseUrl}/accommodations/availability`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        accommodations: ids,
        checkin,
        checkout,
        guests: {
          number_of_adults: adults,
          number_of_rooms: 1
        }
      })
    });
    if (!res.ok) {
      throw new Error(`Booking.com Availability Error (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  /**
   * Implements Booking.com Demand API v3.2 POST /accommodations/details
   */
  async getAccommodationDetails(
    accommodationIds: (number | string)[],
    languages: string[] = ["en-gb", "en-us"]
  ): Promise<any> {
    this.refreshConfig();
    if (this.isMock() || !this.hasApiKey()) return [];

    const ids = accommodationIds.map(id => typeof id === "number" ? id : parseInt(String(id).replace(/\D/g, ""), 10) || 10004);
    const res = await fetch(`${this.baseUrl}/accommodations/details`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        accommodations: ids,
        extras: ["photos", "facilities", "policies", "rooms", "description", "bundles"],
        languages
      })
    });
    if (!res.ok) {
      throw new Error(`Booking.com Details Error (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  /**
   * Implements Booking.com Demand API v3.2 POST /accommodations/constants
   */
  async getConstants(categories?: string[], language: string = "en-gb"): Promise<any> {
    this.refreshConfig();
    if (this.isMock() || !this.hasApiKey()) return {};

    const res = await fetch(`${this.baseUrl}/accommodations/constants`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        constants: categories,
        languages: [language]
      })
    });
    if (!res.ok) {
      throw new Error(`Booking.com Constants Error (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }
}

export const bookingComProvider = new BookingComHotelProvider();
