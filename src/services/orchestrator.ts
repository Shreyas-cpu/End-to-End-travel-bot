import { prisma } from '../db';
import { amadeusFlightProvider } from '../providers/flight/amadeusProvider';
import { bookingComProvider } from '../providers/hotel/bookingComProvider';
import { cabTransferProvider } from '../providers/cab/transferProvider';
import { pdfTicketGenerator } from './pdfGenerator';
import { geminiService } from './geminiService';
import { userProfileService } from './userProfileService';
import { travelRAGService } from './ragService';
import { bookingComPaymentProvider } from '../providers/payment/bookingComPaymentProvider';
import { FlightOffer, HotelAccommodation, CabTransfer, BookingDetails } from '../providers/types';

export interface ChatResponse {
  sessionId: string;
  reply: string;
  step: string;
  cards?: {
    type: 'flights' | 'hotels' | 'cabs' | 'summary' | 'ticket' | 'help' | 'error';
    data: any;
    routeType?: string;
  };
}

/** Words that may sit where a city name is expected but never name a place */
const NON_CITY_WORDS = new Set([
  'the', 'and', 'for', 'with', 'have', 'want', 'need', 'like', 'would', 'could', 'please',
  'my', 'our', 'me', 'you', 'there', 'here', 'home', 'anywhere', 'somewhere', 'that', 'this',
  'next', 'today', 'tomorrow', 'tonight', 'now', 'later', 'day', 'days', 'week', 'weeks',
  'month', 'months', 'year', 'night', 'nights',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'book', 'find', 'search', 'travel', 'trip', 'fly', 'flying', 'flight', 'flights', 'get',
  'going', 'see', 'visit', 'depart', 'leave', 'leaving', 'start', 'starting', 'know', 'help',
  'plan', 'stay', 'check', 'hotel', 'hotels', 'cab', 'taxi', 'airport', 'city', 'people', 'adults'
]);

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
    const inActiveBooking = session.currentStep !== 'INITIATION' ||
      Boolean(session.destination || session.origin || session.startDate);
    const guardrail = travelRAGService.isTravelRelated(cleanInput, { inActiveBooking });
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

    // Question & Travel Inquiry Handler:
    // When any question or advisory inquiry is asked:
    // - If Gemini API key is missing: instruct them to add it to the API section in Admin Panel / contact admin
    // - If Gemini API key is provided: answer intelligently using Gemini model
    if (this.isQuestionOrInquiry(cleanInput)) {
      return this.handleQuestionInquiry(session, cleanInput);
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

    const destination = aiExtracted.destination || ruleExtracted.destination || session.destination;
    const origin = aiExtracted.origin || ruleExtracted.origin || session.origin;
    const startDate = aiExtracted.startDate || ruleExtracted.startDate || session.startDate;
    const endDate = aiExtracted.endDate || ruleExtracted.endDate || session.endDate;
    const guests = aiExtracted.guests || ruleExtracted.guests || session.guests || 2;

    // Conversational Trip Planning:
    // If the traveler hasn't specified both origin and destination yet (e.g. they said "book me a flight" or "help me plan a trip"),
    // talk with them conversationally (via Gemini if available) to gather the missing details (from where to where and when).
    // Do NOT trigger flight search API or show missing API key error until the necessary route is provided!
    if (!destination || !origin) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          destination: destination || null,
          origin: origin || null,
          startDate: startDate || null,
          endDate: endDate || null,
          guests,
          currentStep: 'INITIATION'
        }
      });

      const conversationalReply = await geminiService.planTripConversation(input, {
        destination,
        origin,
        startDate,
        endDate,
        guests
      });

      await this.saveBotMessage(session.id, conversationalReply);
      return {
        sessionId: session.id,
        reply: conversationalReply,
        step: 'INITIATION'
      };
    }

    const effectiveStartDate = startDate || '2026-10-12';
    const effectiveEndDate = endDate || '2026-10-16';

    const isMockFlights = (process.env.FLIGHT_PROVIDER || 'amadeus') === 'mock';
    if (!isMockFlights && !amadeusFlightProvider.hasApiKey()) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          destination,
          origin,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          guests,
          currentStep: 'INITIATION'
        }
      });

      const reply = `⚠️ **Amadeus Flight API Key Missing**\n\nLive Amadeus API mode is currently selected, but no API key was found.\n\n👉 Either configure your **AMADEUS_API_KEY** and **AMADEUS_API_SECRET**, or toggle **Flight Search Mode** to **Mock Data (Testing)** in the **[Admin Dashboard](/admin.html)**!`;
      const errCard = {
        type: 'error' as const,
        data: {
          title: 'Amadeus Flight API Key Missing',
          provider: 'Amadeus Flight Offers v2 (Live Mode)',
          message: 'Live API mode is selected, but no API Key is inserted. Switch to "Mock Data (Testing)" or insert credentials.',
          missingKey: 'AMADEUS_API_KEY & AMADEUS_API_SECRET',
          actionLabel: 'Configure in Admin Dashboard',
          actionUrl: '/admin.html'
        }
      };
      await this.saveBotMessage(session.id, reply, errCard);
      return {
        sessionId: session.id,
        reply,
        step: 'INITIATION',
        cards: errCard
      };
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        destination,
        origin,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        guests,
        currentStep: 'FLIGHT_SELECTION'
      }
    });

    let flightOffers: FlightOffer[] = [];
    try {
      flightOffers = await amadeusFlightProvider.searchFlights({
        origin,
        destination,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        guests,
        timePreference: effectiveTimePref,
        preferredCabin: effectiveCabin
      });
    } catch (err: any) {
      const reply = `⚠️ **Flight Search Error**: ${err.message}\n\nPlease check your Amadeus API credentials in the **[Admin Dashboard](/admin.html)**.`;
      const errCard = {
        type: 'error' as const,
        data: {
          title: 'Amadeus Flight Search Failed',
          provider: 'Amadeus Flight Offers v2',
          message: err.message,
          missingKey: 'AMADEUS_API_KEY',
          actionLabel: 'Check Admin Dashboard',
          actionUrl: '/admin.html'
        }
      };
      await this.saveBotMessage(session.id, reply, errCard);
      return {
        sessionId: session.id,
        reply,
        step: 'INITIATION',
        cards: errCard
      };
    }

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
   * Determine if the user message is asking a question or travel inquiry rather than a direct trip booking command
   */
  private isQuestionOrInquiry(input: string): boolean {
    const clean = (input || '').trim().toLowerCase();
    if (clean.length === 0) return false;

    // Booking and trip planning commands should be routed to conversational trip planning, NOT treated as generic questions
    const bookingPhrases = [
      'book me a flight', 'book a flight', 'book flight', 'book me', 'book a trip', 'book trip',
      'can you book', 'could you book', 'can i book', 'help me book', 'help me plan',
      'plan a trip', 'plan my trip', 'plan my travel', 'i want to book', 'i want to fly',
      'i want to travel', 'need a flight', 'find a flight', 'find flights', 'search flight',
      'fly to', 'trip to', 'tickets to', 'flights to'
    ];
    if (bookingPhrases.some(bp => clean.includes(bp))) {
      return false;
    }

    // Direct question mark
    const hasQuestionMark = clean.includes('?');

    // Common question starters
    const questionStarters = [
      'what', 'why', 'how', 'when', 'where', 'who', 'which',
      'can you tell', 'can you explain', 'tell me', 'explain',
      'is it', 'is there', 'are there', 'do you', 'do i', 'does ',
      'should i', 'recommend', 'suggest', 'help me with', 'help me understand',
      'what is', 'what are', 'how do', 'how can', 'how much'
    ];

    const startsWithQuestion = questionStarters.some(starter => 
      clean === starter || clean.startsWith(starter + ' ') || clean.startsWith(starter + "'")
    );

    // Specific travel advisory topics
    const advisoryTopics = [
      'baggage', 'luggage', 'visa', 'passport', 'check-in', 'etias',
      'schengen', 'tourist tax', 'refund', 'cancellation', 'policy', 'weather'
    ];
    const mentionsAdvisoryTopic = advisoryTopics.some(topic => clean.includes(topic));

    return hasQuestionMark || startsWithQuestion || mentionsAdvisoryTopic;
  }

  /**
   * Handle user questions and inquiries:
   * If Gemini API key is missing, instructs the user to add it in the Admin Panel / contact admin.
   * If Gemini API key is configured, answers via Gemini AI model.
   */
  private async handleQuestionInquiry(session: any, input: string): Promise<ChatResponse> {
    const isGeminiAvailable = geminiService.isEnabled();

    if (!isGeminiAvailable) {
      const ragAdvisory = travelRAGService.answerTravelInquiry(input);
      let reply = `⚠️ **Google Gemini API Key Not Configured**\n\nTo answer custom questions and provide dynamic AI travel assistance with Google Gemini, please add your **GEMINI_API_KEY** in the **API section** of the **[Admin Panel](/admin.html)**, or contact your system administrator.`;

      if (ragAdvisory) {
        reply += `\n\n---\n\n${ragAdvisory}`;
      } else {
        reply += `\n\n👉 *In the meantime, you can search flights, book hotels, and reserve cabs anytime — simply tell me where and when you'd like to travel!*`;
      }

      const errorCard = {
        type: 'error' as const,
        data: {
          title: 'Gemini AI API Key Required',
          provider: 'Google Gemini 2.5 Flash',
          message: 'To answer custom questions and provide AI conversational intelligence, please add your Gemini API Key in the API section of the Admin Panel or contact the administrator.',
          missingKey: 'GEMINI_API_KEY',
          actionLabel: 'Open Admin Panel API Section',
          actionUrl: '/admin.html'
        }
      };

      await this.saveBotMessage(session.id, reply, errorCard);
      return {
        sessionId: session.id,
        reply,
        step: session.currentStep,
        cards: errorCard
      };
    }

    // Gemini API key IS available: answer using the Gemini model
    const ragContext = travelRAGService.retrieve(input, 2);
    const aiResponse = await geminiService.answerUserQuestion(input, {
      currentStep: session.currentStep,
      destination: session.destination,
      ragContext
    });

    await this.saveBotMessage(session.id, aiResponse.reply, aiResponse.errorCard);
    return {
      sessionId: session.id,
      reply: aiResponse.reply,
      step: session.currentStep,
      cards: aiResponse.errorCard
    };
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

    // Query Booking.com Demand API provider (or mock adapter)
    const isMockHotels = (process.env.HOTEL_PROVIDER || 'booking_com') === 'mock';
    if (!isMockHotels && !bookingComProvider.hasApiKey()) {
      const reply = `✅ **Flight Selected**: ${flight.airline} (${flight.flightNumber}) — **${flight.cabinClass || 'Economy'}** ($${flight.price} USD).\n\n⚠️ **Booking.com Demand API Key Missing**\n\nLive Booking.com Demand API mode is currently selected, but no API key was found.\n\n👉 Either configure your **BOOKING_COM_API_KEY**, or toggle **Accommodation Search Mode** to **Mock Data (Testing)** in the **[Admin Dashboard](/admin.html)**.`;
      const errCard = {
        type: 'error' as const,
        data: {
          title: 'Booking.com API Key Missing',
          provider: 'Booking.com Demand API v3 (Live Mode)',
          message: 'Live API mode is selected, but no API Key is inserted. Switch to "Mock Data (Testing)" or insert credentials.',
          missingKey: 'BOOKING_COM_API_KEY',
          actionLabel: 'Configure in Admin Dashboard',
          actionUrl: '/admin.html'
        }
      };
      await this.saveBotMessage(session.id, reply, errCard);
      return {
        sessionId: session.id,
        reply,
        step: 'HOTEL_SELECTION',
        cards: errCard
      };
    }

    let hotels: HotelAccommodation[] = [];
    try {
      hotels = await bookingComProvider.searchAccommodations({
        destination: session.destination || 'Paris',
        startDate: session.startDate || '2026-10-12',
        endDate: session.endDate || '2026-10-16',
        guests: session.guests || 2
      });
    } catch (err: any) {
      const reply = `⚠️ **Booking.com Hotel Search Failed**: ${err.message}\n\nPlease verify your Booking.com credentials in the **[Admin Dashboard](/admin.html)**.`;
      const errCard = {
        type: 'error' as const,
        data: {
          title: 'Booking.com Search Error',
          provider: 'Booking.com Demand API v3',
          message: err.message,
          missingKey: 'BOOKING_COM_API_KEY',
          actionLabel: 'Check Admin Dashboard',
          actionUrl: '/admin.html'
        }
      };
      await this.saveBotMessage(session.id, reply, errCard);
      return {
        sessionId: session.id,
        reply,
        step: 'HOTEL_SELECTION',
        cards: errCard
      };
    }

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

    let paymentSession: any = null;
    let paymentError: string | null = null;
    const isMockPayments = (process.env.PAYMENTS_PROVIDER || 'booking_com_payments') === 'mock';
    if (isMockPayments || bookingComPaymentProvider.hasApiKey()) {
      try {
        paymentSession = await bookingComPaymentProvider.createPaymentSession({
          bookingReference: `TRV-${Math.floor(100000 + Math.random() * 900000)}`,
          totalCost,
          currency: 'USD',
          passengerEmail: 'alex.mercer@traveler.com'
        });
      } catch (err: any) {
        paymentError = err.message;
      }
    } else {
      paymentError = 'Live Booking.com Payments mode selected without API key. Configure key or switch to Mock Mode in Admin.';
    }

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
      currency: 'USD',
      paymentSession,
      paymentError,
      hasPaymentsKey: isMockPayments || bookingComPaymentProvider.hasApiKey()
    };

    const reply = `📋 Here is your complete **Trip Itinerary Summary** to **${session.destination}**! Please review the details below. Tap **Proceed to Payment** to complete your reservation via Booking.com Payments.`;

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
  private async handleCheckoutStep(session: any, input: string, payload?: any): Promise<ChatResponse> {
    const flight: FlightOffer = session.selectedFlightId ? JSON.parse(session.selectedFlightId) : null;
    const hotel: HotelAccommodation = session.selectedHotelId ? JSON.parse(session.selectedHotelId) : null;
    const cab: CabTransfer | undefined = session.selectedCabId ? JSON.parse(session.selectedCabId) : undefined;

    const subtotal = (flight?.price || 0) + (hotel?.totalPrice || 0) + (cab?.price || 0);
    const taxesAndFees = Math.round(subtotal * 0.12 * 100) / 100;
    const totalCost = subtotal + taxesAndFees;
    const bookingReference = `TRV-${Math.floor(100000 + Math.random() * 900000)}`;

    const isMockPayments = (process.env.PAYMENTS_PROVIDER || 'booking_com_payments') === 'mock';
    if (!isMockPayments && !bookingComPaymentProvider.hasApiKey()) {
      const reply = `⚠️ **Booking.com Payments API Key Missing**\n\nLive Booking.com Payments mode is currently selected, but no API Key is inserted.\n\n👉 Please configure your **BOOKING_COM_PAYMENTS_API_KEY** or toggle **Payment Provider Mode** to **Mock Data (Testing)** in the **[Admin Dashboard](/admin.html)**.`;
      const errCard = {
        type: 'error' as const,
        data: {
          title: 'Booking.com Payments API Key Missing',
          provider: 'Booking.com Payments API (Live Mode)',
          message: 'Live Payments mode requires a valid API key. Switch to "Mock Data (Testing)" or configure credentials in Admin.',
          missingKey: 'BOOKING_COM_PAYMENTS_API_KEY',
          actionLabel: 'Configure in Admin Dashboard',
          actionUrl: '/admin.html'
        }
      };
      await this.saveBotMessage(session.id, reply, errCard);
      return {
        sessionId: session.id,
        reply,
        step: 'CHECKOUT_SUMMARY',
        cards: errCard
      };
    }

    const paymentMethod = payload?.paymentMethod || 'Credit / Debit Card';
    let paymentResult: any = null;
    try {
      paymentResult = await bookingComPaymentProvider.verifyPayment(
        session.orderToken || `bkg_pay_${bookingReference}`,
        paymentMethod
      );
    } catch (err: any) {
      const reply = `⚠️ **Payment Authorization Failed**: ${err.message}\n\nPlease check your Booking.com Payments credentials in the **[Admin Dashboard](/admin.html)**.`;
      const errCard = {
        type: 'error' as const,
        data: {
          title: 'Payment Authorization Failed',
          provider: 'Booking.com Payments API',
          message: err.message,
          missingKey: 'BOOKING_COM_PAYMENTS_API_KEY',
          actionLabel: 'Check Admin Dashboard',
          actionUrl: '/admin.html'
        }
      };
      await this.saveBotMessage(session.id, reply, errCard);
      return {
        sessionId: session.id,
        reply,
        step: 'CHECKOUT_SUMMARY',
        cards: errCard
      };
    }

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

    const reply = `🎉 **Congratulations! Your Trip is Confirmed!**\n\nPayment authorized via **Booking.com Payments** (${paymentMethod}). Your official booking reference is **${bookingReference}**. Your e-tickets and printable vouchers are ready below.`;

    const ticketCardData = {
      ...bookingDetails,
      pdfUrl,
      printUrl: `/print-ticket.html?ref=${bookingReference}`,
      paymentResult
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
      return this.handleCheckoutStep(session, 'confirm', payload);
    }

    return this.handleInitiationStep(session, input);
  }

  /**
   * Entity extraction helper (origin, destination, dates, guests, timing, cabin)
   */
  private extractTripEntities(text: string) {
    const lower = text.toLowerCase();
    let destination: string | undefined = undefined;
    let origin: string | undefined = undefined;
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;
    let guests: number | undefined = undefined;
    let timePreference: string | undefined = undefined;
    let preferredCabin: any = undefined;

    // Detect destinations
    if (lower.includes('london')) destination = 'London';
    else if (lower.includes('tokyo')) destination = 'Tokyo';
    else if (lower.includes('paris')) destination = 'Paris';
    else if (lower.includes('rome')) destination = 'Rome';
    else if (lower.includes('dubai')) destination = 'Dubai';
    else if (lower.includes('bali')) destination = 'Bali';
    else if (lower.includes('singapore')) destination = 'Singapore';
    else if (lower.includes('new york') || lower.includes('nyc')) {
      if (!lower.includes('from new york') && !lower.includes('from nyc') && !lower.includes('from jfk')) {
        destination = 'New York';
      }
    }

    // Detect origins
    if (lower.includes('from london')) origin = 'London (LHR)';
    else if (lower.includes('from san francisco') || lower.includes('from sfo')) origin = 'San Francisco (SFO)';
    else if (lower.includes('from chicago')) origin = 'Chicago (ORD)';
    else if (lower.includes('from los angeles') || lower.includes('from lax')) origin = 'Los Angeles (LAX)';
    else if (lower.includes('from tokyo')) origin = 'Tokyo (HND)';
    else if (lower.includes('from new york') || lower.includes('from nyc') || lower.includes('from jfk')) origin = 'New York (JFK)';
    else if (lower.includes('from paris')) origin = 'Paris (CDG)';

    // Fall back to generic city capture for anywhere outside the shortlist above
    if (!origin) origin = this.extractCityAfter(lower, ['from', 'departing from', 'leaving from', 'flying out of']);
    if (!destination) destination = this.extractCityAfter(lower, ['to', 'towards', 'visiting', 'going to']);
    // "delhi to goa" states the origin without a "from"
    if (!origin) origin = this.extractCityBeforeTo(lower);

    // Detect dates
    const dateMatch = lower.match(/(\d{4}-\d{2}-\d{2})/);
    const naturalDate = this.parseNaturalDate(lower);
    if (dateMatch) {
      startDate = dateMatch[1];
    } else if (naturalDate) {
      startDate = naturalDate;
    } else if (lower.includes('oct 12') || lower.includes('october 12')) {
      startDate = '2026-10-12';
      endDate = '2026-10-16';
    } else if (lower.includes('next month')) {
      startDate = '2026-10-12';
      endDate = '2026-10-16';
    } else if (lower.includes('next week')) {
      startDate = '2026-09-15';
      endDate = '2026-09-20';
    }

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

    if (startDate && !endDate) {
      endDate = this.addDays(startDate, 4);
    }

    return { destination, origin, startDate, endDate, guests, timePreference, preferredCabin };
  }

  /**
   * Capture a city name following a preposition, e.g. "from mumbai at 25 october" -> "Mumbai"
   */
  private extractCityAfter(lower: string, prepositions: string[]): string | undefined {
    for (const preposition of prepositions) {
      // Lookahead keeps the candidate unconsumed, so "to fly to goa" still matches the second "to"
      const matches = lower.matchAll(
        new RegExp(`\\b${preposition}\\s+(?=([a-z][a-z'-]*(?:\\s+[a-z][a-z'-]*)?))`, 'g')
      );
      for (const match of matches) {
        const city = this.toCityName(match[1]);
        if (city) return city;
      }
    }

    return undefined;
  }

  /**
   * Capture the origin stated as a bare route, e.g. "delhi to goa" -> "Delhi"
   */
  private extractCityBeforeTo(lower: string): string | undefined {
    // Anchored so mid-sentence noise ("4-day trip to paris") is never read as an origin
    const match = lower.match(/^([a-z][a-z'-]{2,}(?:\s+[a-z][a-z'-]{2,})?)\s+to\s+[a-z]/);
    return match ? this.toCityName(match[1]) : undefined;
  }

  private toCityName(phrase: string): string | undefined {
    const words = phrase.split(/\s+/).filter(w => !NON_CITY_WORDS.has(w) && w.length > 2);
    if (!words.length) return undefined;

    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Parse conversational dates like "25 october" or "october 25th" into ISO form,
   * rolling to next year when the day has already passed.
   */
  private parseNaturalDate(lower: string): string | undefined {
    const monthToken = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
    const dayFirst = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthToken}\\b`));
    const monthFirst = lower.match(new RegExp(`\\b${monthToken}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));

    let day: number | undefined;
    let monthAbbr: string | undefined;
    if (dayFirst) {
      day = parseInt(dayFirst[1], 10);
      monthAbbr = dayFirst[2];
    } else if (monthFirst) {
      monthAbbr = monthFirst[1];
      day = parseInt(monthFirst[2], 10);
    }

    if (!day || !monthAbbr) return undefined;

    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = months.indexOf(monthAbbr);
    if (monthIndex < 0 || day < 1 || day > 31) return undefined;

    const today = new Date();
    let year = today.getFullYear();
    const candidate = new Date(Date.UTC(year, monthIndex, day));
    if (candidate.getTime() < today.getTime()) year += 1;

    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private addDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
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
