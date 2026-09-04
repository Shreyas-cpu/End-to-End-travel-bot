import { CabTransfer, HotelAccommodation } from '../types';

export class CabTransferProvider {
  /**
   * Propose airport and city transfer options with bidirectional and custom routing
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
