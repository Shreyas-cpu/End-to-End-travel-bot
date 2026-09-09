import { CabTransfer, HotelAccommodation } from '../types';
import { bookingComProvider } from '../hotel/bookingComProvider';

export class CabTransferProvider {
  private getHeaders(): Record<string, string> {
    const key = process.env.BOOKING_COM_API_KEY;
    const affiliateId = process.env.BOOKING_COM_AFFILIATE_ID;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }
    if (affiliateId && affiliateId.trim() !== '') {
      headers['X-Affiliate-Id'] = affiliateId.trim();
    }
    return headers;
  }

  public isMock(): boolean {
    return (process.env.CAB_PROVIDER || 'mock') === 'mock';
  }

  public hasApiKey(): boolean {
    const key = process.env.BOOKING_COM_API_KEY;
    return Boolean(key && key.trim() !== '' && !key.includes('xxxx'));
  }

  /**
   * Propose airport and city transfer options with bidirectional and custom routing (Booking.com Cars API or Mock)
   */
  async getTransferOptions(
    destination: string, 
    hotel?: HotelAccommodation, 
    routeType: 'airport_to_hotel' | 'hotel_to_airport' | 'custom' = 'airport_to_hotel',
    customPickup?: string,
    customDropoff?: string
  ): Promise<CabTransfer[]> {
    let pickup = '';
    let dropoff = '';

    if (routeType === 'hotel_to_airport') {
      pickup = hotel ? `${hotel.name} (Hotel Lobby)` : `Central ${destination} Accommodation`;
      dropoff = `${destination} International Airport (Terminal Departures)`;
    } else if (routeType === 'custom') {
      pickup = customPickup || `City Center (${destination})`;
      dropoff = customDropoff || (hotel ? hotel.name : `Historic Center / Landmark`);
    } else {
      // Default: airport_to_hotel
      pickup = `${destination} International Airport (Terminal Arrivals)`;
      dropoff = hotel ? `${hotel.name} (${hotel.address})` : `Downtown ${destination}`;
    }

    // Attempt live Booking.com Cars search if provider is booking_com and API key is present
    if (process.env.CAB_PROVIDER === 'booking_com' && this.hasApiKey()) {
      try {
        const baseUrl = process.env.BOOKING_COM_BASE_URL || "https://demandapi.booking.com/3.2";
        const loc = bookingComProvider.resolveLocation(destination);
        const pickupDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] + 'T10:00:00';

        const res = await fetch(`${baseUrl}/cars/search`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            booker: { country: loc.country || 'US' },
            currency: 'USD',
            driver: { age: 30 },
            route: {
              pickup: {
                datetime: pickupDate,
                location: { airport: loc.airport || 'CDG' }
              }
            },
            maximum_results: 4
          })
        });

        if (res.ok) {
          const carData: any = await res.json();
          if (carData?.data && Array.isArray(carData.data) && carData.data.length > 0) {
            const tiers = [
              { type: 'Standard Sedan', model: 'Toyota Camry Hybrid / Skoda Superb', badge: 'Best Value', rating: 4.89 },
              { type: 'Executive Business Class', model: 'Mercedes-Benz E-Class / BMW 5 Series', badge: 'Executive Comfort', rating: 4.98 },
              { type: 'Eco Electric', model: 'Tesla Model Y / Polestar 2', badge: 'Zero Emissions', rating: 4.94 },
              { type: 'Spacious Group Van', model: 'Mercedes-Benz V-Class / VW Multivan', badge: 'Great for Families', rating: 4.91 }
            ];

            return carData.data.slice(0, 4).map((carItem: any, idx: number) => {
              const tier = tiers[idx % tiers.length];
              const price = carItem.price?.total?.amount || (45 + idx * 25);
              return {
                id: `cab-bkg-${carItem.offer || carItem.car || idx + 1}`,
                vehicleType: tier.type,
                vehicleModel: tier.model,
                capacity: idx === 3 ? 6 : 4,
                luggageCount: idx === 3 ? 6 : 3,
                estimatedDuration: '30-40 mins',
                price,
                currency: carItem.price?.total?.currency || 'USD',
                pickupLocation: pickup,
                dropoffLocation: dropoff,
                routeType,
                driverRating: tier.rating,
                badge: tier.badge,
                supplier: String(carItem.supplier || 'Booking.com Partner'),
                offerId: carItem.offer
              };
            });
          }
        }
      } catch (err) {
        console.warn('[CabTransferProvider] Live Booking.com cars/search failed, using default transfers:', err);
      }
    }

    return [
      {
        id: 'cab-01',
        vehicleType: 'Standard Sedan',
        vehicleModel: 'Toyota Camry Hybrid / Skoda Superb',
        capacity: 3,
        luggageCount: 2,
        estimatedDuration: '30-40 mins',
        price: 45,
        currency: 'USD',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        routeType,
        driverRating: 4.89,
        badge: 'Best Value'
      },
      {
        id: 'cab-02',
        vehicleType: 'Executive Business Class',
        vehicleModel: 'Mercedes-Benz E-Class / BMW 5 Series',
        capacity: 3,
        luggageCount: 3,
        estimatedDuration: '30-35 mins',
        price: 85,
        currency: 'USD',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        routeType,
        driverRating: 4.98,
        badge: 'Executive Comfort'
      },
      {
        id: 'cab-03',
        vehicleType: 'Eco Electric',
        vehicleModel: 'Tesla Model Y / Polestar 2',
        capacity: 4,
        luggageCount: 3,
        estimatedDuration: '30-40 mins',
        price: 58,
        currency: 'USD',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        routeType,
        driverRating: 4.94,
        badge: 'Zero Emissions'
      },
      {
        id: 'cab-04',
        vehicleType: 'Spacious Group Van',
        vehicleModel: 'Mercedes-Benz V-Class / VW Multivan',
        capacity: 6,
        luggageCount: 6,
        estimatedDuration: '35-45 mins',
        price: 110,
        currency: 'USD',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        routeType,
        driverRating: 4.91,
        badge: 'Great for Families'
      }
    ];
  }
}

export const cabTransferProvider = new CabTransferProvider();
