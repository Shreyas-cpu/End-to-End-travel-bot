import { PrismaClient } from '@prisma/client';
import { amadeusFlightProvider } from '../providers/flight/amadeusProvider';
import { bookingComProvider } from '../providers/hotel/bookingComProvider';
import { cabTransferProvider } from '../providers/cab/transferProvider';
import { pdfTicketGenerator } from './pdfGenerator';
import { geminiService } from './geminiService';
import { userProfileService } from './userProfileService';
import { travelRAGService } from './ragService';
import { FlightOffer, HotelAccommodation, CabTransfer, BookingDetails } from '../providers/types';

const prisma = new PrismaClient();

export interface ChatResponse {
  sessionId: string;
  reply: string;
  step: string;
  cards?: {
    type: 'flights' | 'hotels' | 'cabs' | 'summary' | 'ticket' | 'help';
    data: any;
    routeType?: string;
  };
}

export class TravelOrchestrator {
  /**
   * Process an incoming user message or interactive selection action
   */
  async processMessage(sessionId: string | undefined, userMessage: string, actionPayload?: any): Promise<ChatResponse> {
    // Retrieve or create session
    let session = sessionId ? await prisma.session.findUnique({ where: { id: sessionId } }) : null;
    if (!session) {
      session = await prisma.session.create({
        data: {
          currentStep: 'INITIATION',
          guests: 2
        }
      });
    }

    const cleanInput = (userMessage || '').trim();

    // Store user message in DB
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: cleanInput,
        metadata: actionPayload ? JSON.stringify(actionPayload) : null
      }
    });

    // Check for global reset command
    if (cleanInput.toLowerCase() === 'reset' || cleanInput.toLowerCase() === 'start over' || cleanInput.toLowerCase() === 'new trip') {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          currentStep: 'INITIATION',
          destination: null,
          origin: null,
          startDate: null,
          endDate: null,
          selectedFlightId: null,
          selectedHotelId: null,
          selectedCabId: null,
          orderToken: null
        }
      });

      const reply = "🔄 We've cleared your previous session! Where would you like to travel next? (e.g. *'Plan a trip to Paris from New York for Oct 12-16'* or *'Find a hotel in Tokyo'*)";
      await this.saveBotMessage(session.id, reply);
      return {
        sessionId: session.id,
        reply,
        step: 'INITIATION'
      };
    }

    // Handle interactive card actions (e.g. user clicked "Select Flight", "Select Hotel", etc.)
    if (actionPayload?.action) {
      return this.handleActionPayload(session, cleanInput, actionPayload);
    }

    // Domain Guardrail: ensure query is travel-related
    const guardrail = travelRAGService.isTravelRelated(cleanInput);
    if (!guardrail.allowed) {
      const declineReply = guardrail.suggestedPrompt || 
        "✈️ I am specialized exclusively as your Travel Booking AI Assistant. I can assist you with flights, hotels, airport cabs, and travel guidelines (baggage, visas, airports). How may I help you with your journey today?";
      await this.saveBotMessage(session.id, declineReply);
      return {
        sessionId: session.id,
        reply: declineReply,
        step: session.currentStep
      };
    }

    // Knowledge Inquiry: check if user is asking general travel advisory questions
    if (cleanInput.includes('baggage') || cleanInput.includes('luggage') || cleanInput.includes('visa') || 
        cleanInput.includes('passport') || cleanInput.includes('check-in time') || cleanInput.includes('etias') ||
        cleanInput.includes('schengen') || cleanInput.includes('tourist tax')) {
      const advisory = travelRAGService.answerTravelInquiry(cleanInput);
      if (advisory) {
        await this.saveBotMessage(session.id, advisory);
        return {
          sessionId: session.id,
          reply: advisory,
          step: session.currentStep
        };
      }
    }

    // Main conversational state machine
    switch (session.currentStep) {
      case 'INITIATION':
        return this.handleInitiationStep(session, cleanInput);

      case 'FLIGHT_SELECTION':
        return this.handleFlightSelectionStep(session, cleanInput);

      case 'HOTEL_SELECTION':
        return this.handleHotelSelectionStep(session, cleanInput);

      case 'CAB_SELECTION':
        return this.handleCabSelectionStep(session, cleanInput);

      case 'CHECKOUT_SUMMARY':
        return this.handleCheckoutStep(session, cleanInput);

      case 'CONFIRMED':
        return this.handleConfirmedStep(session, cleanInput);

      default:
        return this.handleInitiationStep(session, cleanInput);
    }
  }

  /**
   * Handle Stage 1: Initial user intent extraction & Flight search
   */
  private async handleInitiationStep(session: any, input: string): Promise<ChatResponse> {
    // 1. Try AI dynamic entity extraction via Google Gemini
    let aiExtracted = geminiService.isEnabled() ? await geminiService.extractTravelEntities(input) : {};
    const ruleExtracted = this.extractTripEntities(input);

    // 2. Load persistent user profile
    const profile = await userProfileService.getProfile('traveler_default');
    const effectiveCabin = ruleExtracted.preferredCabin || profile.preferredCabin || 'Economy';
    const effectiveTimePref = ruleExtracted.timePreference || profile.preferredDeparturePeriod;

    const destination = aiExtracted.destination || ruleExtracted.destination || session.destination || 'Paris';
    const origin = aiExtracted.origin || ruleExtracted.origin || session.origin || 'New York (JFK)';
    const startDate = aiExtracted.startDate || ruleExtracted.startDate || session.startDate || '2026-10-12';
    const endDate = aiExtracted.endDate || ruleExtracted.endDate || session.endDate || '2026-10-16';
    const guests = aiExtracted.guests || ruleExtracted.guests || session.guests || 2;

    await prisma.session.update({
      where: { id: session.id },
      data: {
        destination,
        origin,
        startDate,
        endDate,
        guests,
        currentStep: 'FLIGHT_SELECTION'
      }
    });

    const flightOffers = await amadeusFlightProvider.searchFlights({
      origin,
      destination,
      startDate,
      endDate,
      guests,
      timePreference: effectiveTimePref,
      preferredCabin: effectiveCabin
    });

    const timePrefNotice = effectiveTimePref ? ` (${effectiveTimePref} departures prioritized)` : '';
    const isReturning = profile.bookingHistory && profile.bookingHistory.length > 0;
    const greetingHeader = isReturning
      ? `✈️ Welcome back, **${profile.displayName}**! Using your profile preferences (${effectiveCabin} cabin, ${effectiveTimePref || 'morning'} timing)`
      : `✈️ Great! I found top flight options from **${origin}** to **${destination}**`;

    const defaultReply = `${greetingHeader} for **${startDate}** to **${endDate}** (${guests} traveler${guests > 1 ? 's' : ''})${timePrefNotice}.\n\nPlease select your preferred cabin class and flight to continue:`;
    
    const reply = await this.generateAIResponse('FLIGHT_SELECTION', {
      origin,
      destination,
      startDate,
      endDate,
      guests,
      flightCount: flightOffers.length
    }, defaultReply);

    await this.saveBotMessage(session.id, reply, { type: 'flights', data: flightOffers });

    return {
      sessionId: session.id,
      reply,
      step: 'FLIGHT_SELECTION',
      cards: {
        type: 'flights',
        data: flightOffers
      }
    };
  }

  private async generateAIResponse(step: string, context: any, defaultReply: string): Promise<string> {
    if (process.env.LLM_PROVIDER === 'gemini' || geminiService.isEnabled()) {
      const gRes = await geminiService.generateAssistantResponse(step, context, defaultReply);
      if (gRes && gRes !== defaultReply) return gRes;
    }
    return defaultReply;
  }

  /**
   * Handle Stage 2: Flight selection -> Hotel search (Booking.com)
   */
  private async handleFlightSelectionStep(session: any, input: string): Promise<ChatResponse> {
    const flightOffers = await amadeusFlightProvider.searchFlights({
      origin: session.origin || 'New York (JFK)',
      destination: session.destination || 'Paris',
      startDate: session.startDate || '2026-10-12',
      endDate: session.endDate || '2026-10-16',
      guests: session.guests || 2
    });

    // Default to first flight if text match or index
    let chosenFlight = flightOffers[0];
    if (input.includes('2') || input.toLowerCase().includes('delta')) {
      chosenFlight = flightOffers[1] || flightOffers[0];
    } else if (input.includes('3') || input.toLowerCase().includes('british')) {
      chosenFlight = flightOffers[2] || flightOffers[0];
    }

    return this.proceedToHotelSelection(session, chosenFlight);
  }

  private async proceedToHotelSelection(session: any, flight: FlightOffer): Promise<ChatResponse> {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        selectedFlightId: JSON.stringify(flight),
        currentStep: 'HOTEL_SELECTION'
      }
    });

    // Query Booking.com Demand API compatible provider
    const hotels = await bookingComProvider.searchAccommodations({
      destination: session.destination || 'Paris',
      startDate: session.startDate || '2026-10-12',
      endDate: session.endDate || '2026-10-16',
      guests: session.guests || 2
    });

    const defaultReply = `✅ **Flight Selected**: ${flight.airline} (${flight.flightNumber}) — **${flight.cabinClass || 'Economy'}** for $${flight.price} USD.\n\n🏨 Would you like to book a hotel for your stay in **${session.destination || 'Paris'}**? By default, I've prioritized options **near the airport** (sorted lowest to highest price). Use the filter toolbar to adjust sorting, select neighborhood areas, or filter by your max price:`;
    
    const reply = await this.generateAIResponse('HOTEL_SELECTION', {
      selectedFlight: flight.airline,
      destination: session.destination,
      hotelCount: hotels.length
    }, defaultReply);

    await this.saveBotMessage(session.id, reply, { type: 'hotels', data: hotels });

    return {
      sessionId: session.id,
      reply,
      step: 'HOTEL_SELECTION',
      cards: {
        type: 'hotels',
        data: hotels
      }
    };
  }

  /**
   * Handle Stage 3: Hotel selection -> Cab transfer search
   */
  private async handleHotelSelectionStep(session: any, input: string): Promise<ChatResponse> {
    if (input.toLowerCase().includes('skip') || input.toLowerCase().includes('no hotel')) {
      return this.proceedToCabSelection(session, undefined);
    }

    const hotels = await bookingComProvider.searchAccommodations({
      destination: session.destination || 'Paris',
      startDate: session.startDate || '2026-10-12',
      endDate: session.endDate || '2026-10-16',
      guests: session.guests || 2
    });

    let chosenHotel = hotels[0];
    if (input.includes('2') || input.toLowerCase().includes('citizenm')) {
      chosenHotel = hotels[1] || hotels[0];
    } else if (input.includes('3') || input.toLowerCase().includes('hilton')) {
      chosenHotel = hotels[2] || hotels[0];
    }

    return this.proceedToCabSelection(session, chosenHotel);
  }

  private async proceedToCabSelection(
    session: any, 
    hotel?: HotelAccommodation, 
    routeType: 'airport_to_hotel' | 'hotel_to_airport' | 'custom' = 'airport_to_hotel'
  ): Promise<ChatResponse> {
    const preview = hotel ? await bookingComProvider.previewOrder(hotel) : null;

    if (hotel) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          selectedHotelId: JSON.stringify(hotel),
          orderToken: preview ? preview.orderToken : null,
          currentStep: 'CAB_SELECTION'
        }
      });
    } else if (!session.selectedHotelId) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          currentStep: 'CAB_SELECTION'
        }
      });
    }

    const currentHotel: HotelAccommodation | undefined = hotel || (session.selectedHotelId ? JSON.parse(session.selectedHotelId) : undefined);

    // Propose transfers for the specified route
    const transfers = await cabTransferProvider.getTransferOptions(
      session.destination || 'Paris', 
      currentHotel, 
      routeType
    );

    const routeLabel = routeType === 'hotel_to_airport' 
      ? 'Hotel ➔ Airport' 
      : routeType === 'custom' 
        ? 'City / Custom Route' 
        : 'Airport ➔ Hotel';

    const defaultReply = currentHotel
      ? `✅ **Hotel Confirmed**: ${currentHotel.name} (${currentHotel.starRating}★).\n\n🚕 **Cab Transfer Service**: Would you like to add an airport or city transfer? Currently showing **${routeLabel}** options below. You can easily switch between **Airport ➔ Hotel**, **Hotel ➔ Airport**, or **Custom Location**:`
      : `⏭️ Hotel reservation skipped.\n\n🚕 **Cab Transfer Service**: Would you like to book a cab transfer in **${session.destination || 'Paris'}**? Currently showing **${routeLabel}** options:`;
    
    const reply = await this.generateAIResponse('CAB_SELECTION', {
      hotelName: currentHotel ? currentHotel.name : 'Skipped',
      destination: session.destination,
      routeType,
      transferOptions: transfers.length
    }, defaultReply);

    await this.saveBotMessage(session.id, reply, { type: 'cabs', data: transfers, routeType });

    return {
      sessionId: session.id,
      reply,
      step: 'CAB_SELECTION',
      cards: {
        type: 'cabs',
        data: transfers,
        routeType
      }
    };
  }

  /**
   * Handle Stage 4: Cab selection -> Checkout Summary
   */
  private async handleCabSelectionStep(session: any, input: string): Promise<ChatResponse> {
    const hotel: HotelAccommodation | undefined = session.selectedHotelId ? JSON.parse(session.selectedHotelId) : undefined;
    const lower = input.toLowerCase();

    if (lower.includes('skip') || lower.includes('no cab') || lower.includes('no transfer') || lower.includes('no thanks')) {
      return this.proceedToCheckoutSummary(session, undefined);
    }

    // Support route switching commands in chat
    if (lower.includes('hotel to airport') || lower.includes('to airport') || lower.includes('return trip')) {
      return this.proceedToCabSelection(session, hotel, 'hotel_to_airport');
    }
    if (lower.includes('airport to hotel') || lower.includes('from airport') || lower.includes('arrival')) {
      return this.proceedToCabSelection(session, hotel, 'airport_to_hotel');
    }
    if (lower.includes('custom') || lower.includes('city') || lower.includes('landmark')) {
      return this.proceedToCabSelection(session, hotel, 'custom');
    }

    const transfers = await cabTransferProvider.getTransferOptions(session.destination || 'Paris', hotel);

    let chosenCab: CabTransfer | undefined = transfers[0];
    if (lower.includes('2') || lower.includes('executive') || lower.includes('business') || lower.includes('mercedes')) {
      chosenCab = transfers[1];
    } else if (lower.includes('electric') || lower.includes('tesla') || lower.includes('eco')) {
      chosenCab = transfers[2];
    } else if (lower.includes('3') || lower.includes('4') || lower.includes('van') || lower.includes('group')) {
      chosenCab = transfers[3];
    }

    return this.proceedToCheckoutSummary(session, chosenCab);
  }

  private async proceedToCheckoutSummary(session: any, cab?: CabTransfer): Promise<ChatResponse> {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        selectedCabId: cab ? JSON.stringify(cab) : null,
        currentStep: 'CHECKOUT_SUMMARY'
      }
    });

    const flight: FlightOffer = session.selectedFlightId ? JSON.parse(session.selectedFlightId) : null;
    const hotel: HotelAccommodation = session.selectedHotelId ? JSON.parse(session.selectedHotelId) : null;

    const subtotal = (flight?.price || 0) + (hotel?.totalPrice || 0) + (cab?.price || 0);
    const taxesAndFees = Math.round(subtotal * 0.12 * 100) / 100;
    const totalCost = subtotal + taxesAndFees;

    const summaryData = {
      flight,
      hotel,
      cab,
      destination: session.destination,
      dates: `${session.startDate} to ${session.endDate}`,
      guests: session.guests,
      subtotal,
      taxesAndFees,
      totalCost,
      currency: 'USD'
    };

    const reply = `📋 Here is your complete **Trip Itinerary Summary** to **${session.destination}**! Please review the details below. Tap **Confirm & Generate E-Tickets** to finalize your booking.`;

    await this.saveBotMessage(session.id, reply, { type: 'summary', data: summaryData });

    return {
      sessionId: session.id,
      reply,
      step: 'CHECKOUT_SUMMARY',
      cards: {
        type: 'summary',
        data: summaryData
      }
    };
  }

  /**
   * Handle Stage 5: Final confirmation & PDF document delivery
   */
  private async handleCheckoutStep(session: any, input: string): Promise<ChatResponse> {
    const flight: FlightOffer = session.selectedFlightId ? JSON.parse(session.selectedFlightId) : null;
    const hotel: HotelAccommodation = session.selectedHotelId ? JSON.parse(session.selectedHotelId) : null;
    const cab: CabTransfer | undefined = session.selectedCabId ? JSON.parse(session.selectedCabId) : undefined;

    const subtotal = (flight?.price || 0) + (hotel?.totalPrice || 0) + (cab?.price || 0);
    const taxesAndFees = Math.round(subtotal * 0.12 * 100) / 100;
    const totalCost = subtotal + taxesAndFees;
    const bookingReference = `TRV-${Math.floor(100000 + Math.random() * 900000)}`;

    const bookingDetails: BookingDetails = {
      bookingReference,
      passengerName: 'Alex Mercer',
      passengerEmail: 'alex.mercer@traveler.com',
      flight,
      hotel,
      cab,
      subtotal,
      taxesAndFees,
      totalCost,
      currency: 'USD',
      orderToken: session.orderToken || `ord_bkg_${Math.random().toString(36).substring(2, 10)}`,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    // Generate Official PDF Itinerary Ticket Voucher
    const pdfUrl = await pdfTicketGenerator.generateTicket(bookingDetails);

    // Save Booking Record in Database
    await prisma.booking.create({
      data: {
        sessionId: session.id,
        bookingReference,
        passengerName: bookingDetails.passengerName,
        passengerEmail: bookingDetails.passengerEmail,
        flightDetails: flight ? JSON.stringify(flight) : null,
        hotelDetails: hotel ? JSON.stringify(hotel) : null,
        cabDetails: cab ? JSON.stringify(cab) : null,
        totalCost,
        currency: 'USD',
        status: 'CONFIRMED',
        pdfPath: pdfUrl
      }
    });

    // Record into persistent User Markdown Profile
    try {
      await userProfileService.recordBooking('traveler_default', {
        bookingReference,
        destination: session.destination || 'Paris',
        flight: flight ? { airline: flight.airline, flightNumber: flight.flightNumber, cabinClass: flight.cabinClass } : undefined,
        hotel: hotel ? { name: hotel.name, area: hotel.area } : undefined,
        totalCost
      });
    } catch (profileErr) {
      console.warn('[UserProfileService] Failed to record booking into profile:', profileErr);
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { currentStep: 'CONFIRMED' }
    });

    const reply = `🎉 **Congratulations! Your Trip is Confirmed!**\n\nYour official booking reference is **${bookingReference}**. Your e-tickets and hotel vouchers have been compiled and generated below.`;

    const ticketCardData = {
      ...bookingDetails,
      pdfUrl
    };

    await this.saveBotMessage(session.id, reply, { type: 'ticket', data: ticketCardData });

    return {
      sessionId: session.id,
      reply,
      step: 'CONFIRMED',
      cards: {
        type: 'ticket',
        data: ticketCardData
      }
    };
  }

  /**
   * Handle Stage 6: Confirmed state interactions
   */
  private async handleConfirmedStep(session: any, input: string): Promise<ChatResponse> {
    const booking = await prisma.booking.findFirst({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' }
    });

    const reply = `Your booking (**${booking?.bookingReference || 'CONFIRMED'}**) is already issued and ready! You can download your official PDF ticket voucher above, or type **'start over'** to plan a new trip.`;
    await this.saveBotMessage(session.id, reply);

    return {
      sessionId: session.id,
      reply,
      step: 'CONFIRMED'
    };
  }

  /**
   * Handle direct button clicks / interactive payloads from UI
   */
  private async handleActionPayload(session: any, input: string, payload: any): Promise<ChatResponse> {
    const { action, item } = payload;

    if (action === 'SELECT_FLIGHT') {
      const flight: FlightOffer = { ...item };
      if (payload.cabinClass) flight.cabinClass = payload.cabinClass;
      if (payload.price) flight.price = payload.price;
      return this.proceedToHotelSelection(session, flight);
    } else if (action === 'SELECT_HOTEL') {
      return this.proceedToCabSelection(session, item);
    } else if (action === 'SKIP_HOTEL') {
      return this.proceedToCabSelection(session, undefined);
    } else if (action === 'SELECT_CAB') {
      return this.proceedToCheckoutSummary(session, item);
    } else if (action === 'SKIP_CAB') {
      return this.proceedToCheckoutSummary(session, undefined);
    } else if (action === 'SWITCH_CAB_ROUTE') {
      const hotel: HotelAccommodation | undefined = session.selectedHotelId ? JSON.parse(session.selectedHotelId) : undefined;
      return this.proceedToCabSelection(session, hotel, payload.routeType || 'airport_to_hotel');
    } else if (action === 'CONFIRM_BOOKING') {
      return this.handleCheckoutStep(session, 'confirm');
    }

    return this.handleInitiationStep(session, input);
  }

  /**
   * Entity extraction helper (origin, destination, dates, guests, timing, cabin)
   */
  private extractTripEntities(text: string) {
    const lower = text.toLowerCase();
    let destination = 'Paris';
    let origin = 'New York (JFK)';
    let startDate = '2026-10-12';
    let endDate = '2026-10-16';
    let guests = 2;
    let timePreference: string | undefined = undefined;
    let preferredCabin: any = undefined;

    // Detect destinations
    if (lower.includes('london')) destination = 'London';
    else if (lower.includes('tokyo')) destination = 'Tokyo';
    else if (lower.includes('rome')) destination = 'Rome';
    else if (lower.includes('dubai')) destination = 'Dubai';
    else if (lower.includes('bali')) destination = 'Bali';
    else if (lower.includes('singapore')) destination = 'Singapore';
    else if (lower.includes('new york') || lower.includes('nyc')) destination = 'New York';

    // Detect origins
    if (lower.includes('from london')) origin = 'London (LHR)';
    else if (lower.includes('from san francisco') || lower.includes('from sfo')) origin = 'San Francisco (SFO)';
    else if (lower.includes('from chicago')) origin = 'Chicago (ORD)';
    else if (lower.includes('from los angeles') || lower.includes('from lax')) origin = 'Los Angeles (LAX)';
    else if (lower.includes('from tokyo')) origin = 'Tokyo (HND)';

    // Detect guests
    const guestMatch = lower.match(/(\d+)\s*(people|person|traveler|guests|adults)/);
    if (guestMatch) {
      guests = parseInt(guestMatch[1], 10);
    }

    // Detect flight schedule/timing preferences
    if (lower.includes('morning') || lower.includes('early') || lower.includes('before noon') || lower.includes('am flight')) {
      timePreference = 'morning';
    } else if (lower.includes('afternoon') || lower.includes('midday')) {
      timePreference = 'afternoon';
    } else if (lower.includes('evening') || lower.includes('after 5pm') || lower.includes('dusk')) {
      timePreference = 'evening';
    } else if (lower.includes('night') || lower.includes('red-eye') || lower.includes('late')) {
      timePreference = 'night';
    }

    // Detect cabin class preference
    if (lower.includes('first class') || lower.includes('first')) {
      preferredCabin = 'First Class';
    } else if (lower.includes('business class') || lower.includes('business')) {
      preferredCabin = 'Business';
    } else if (lower.includes('premium economy') || lower.includes('premium')) {
      preferredCabin = 'Premium Economy';
    } else if (lower.includes('economy')) {
      preferredCabin = 'Economy';
    }

    return { destination, origin, startDate, endDate, guests, timePreference, preferredCabin };
  }

  private async saveBotMessage(sessionId: string, content: string, metadata?: any) {
    await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  }
}

export const travelOrchestrator = new TravelOrchestrator();
