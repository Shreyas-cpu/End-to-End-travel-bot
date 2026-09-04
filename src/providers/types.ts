export type CabinClass = 'Economy' | 'Premium Economy' | 'Business' | 'First Class';

export interface FlightOffer {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  origin: string;
  originAirport: string;
  destination: string;
  destinationAirport: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  cabinClass: CabinClass;
  cabinTiers: Record<CabinClass, number>;
  departurePeriod: 'morning' | 'afternoon' | 'evening' | 'night';
  flightTimePreference?: string;
  price: number;
  currency: string;
}

export interface HotelAccommodation {
  id: string;
  name: string;
  city: string;
  address: string;
  starRating: number;
  reviewScore: number;
  reviewCount: number;
  reviewRatingText: string;
  imageUrl: string;
  roomType: string;
  bedConfig: string;
  pricePerNight: number;
  totalNights: number;
  totalPrice: number;
  currency: string;
  amenities: string[];
  cancellationPolicy: string;
  breakfastIncluded: boolean;
}

export interface CabTransfer {
  id: string;
  vehicleType: string; // e.g. "Standard Sedan", "Executive SUV", "Eco Electric", "Van"
  vehicleModel: string; // e.g. "Toyota Camry", "Mercedes E-Class", "Tesla Model Y"
  capacity: number;
  luggageCount: number;
  estimatedDuration: string;
  price: number;
  currency: string;
  pickupLocation: string;
  dropoffLocation: string;
  driverRating: number;
  badge?: string;
}

export interface TravelSearchQuery {
  origin?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  guests?: number;
  budget?: number;
  timePreference?: string;
  preferredCabin?: CabinClass;
}

export interface BookingDetails {
  bookingReference: string;
  passengerName: string;
  passengerEmail: string;
  flight?: FlightOffer;
  hotel?: HotelAccommodation;
  cab?: CabTransfer;
  subtotal: number;
  taxesAndFees: number;
  totalCost: number;
  currency: string;
  orderToken: string;
  createdAt: string;
}
