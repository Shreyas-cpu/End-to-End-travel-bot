import { CabTransfer, HotelAccommodation } from '../types';

export class CabTransferProvider {
  /**
   * Propose airport and city transfer options
   */
  async getTransferOptions(destination: string, hotel?: HotelAccommodation): Promise<CabTransfer[]> {
    const pickup = `${destination} International Airport (Arrivals)`;
    const dropoff = hotel ? hotel.name : `Downtown ${destination}`;

    return [
      {
        id: 'cab-01',
        vehicleType: 'Comfort Sedan',
        vehicleModel: 'Toyota Camry Hybrid / Skoda Superb',
        capacity: 3,
        luggageCount: 2,
        estimatedDuration: '35-45 mins',
        price: 48,
        currency: 'USD',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        driverRating: 4.9,
        badge: 'Most Popular'
      },
      {
        id: 'cab-02',
        vehicleType: 'Executive Business Class',
        vehicleModel: 'Mercedes-Benz E-Class / BMW 5 Series',
        capacity: 3,
        luggageCount: 3,
        estimatedDuration: '35-40 mins',
        price: 85,
        currency: 'USD',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        driverRating: 4.98,
        badge: 'Premium Comfort'
      },
      {
        id: 'cab-03',
        vehicleType: 'Spacious Minivan / SUV',
        vehicleModel: 'Mercedes V-Class / Ford Transit Custom',
        capacity: 6,
        luggageCount: 6,
        estimatedDuration: '40-50 mins',
        price: 98,
        currency: 'USD',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        driverRating: 4.92,
        badge: 'Great for Groups'
      }
    ];
  }
}

export const cabTransferProvider = new CabTransferProvider();
