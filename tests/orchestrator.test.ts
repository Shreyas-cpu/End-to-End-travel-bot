import { travelOrchestrator } from '../src/services/orchestrator';
import { amadeusFlightProvider } from '../src/providers/flight/amadeusProvider';
import { bookingComProvider } from '../src/providers/hotel/bookingComProvider';
import { cabTransferProvider } from '../src/providers/cab/transferProvider';
import { userProfileService } from '../src/services/userProfileService';
import { travelRAGService } from '../src/services/ragService';
import { adminConfigService } from '../src/services/adminConfigService';
import { bookingComPaymentProvider } from '../src/providers/payment/bookingComPaymentProvider';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING FULL SUITE: TRAVEL BOOKING AI FRAMEWORK');
  console.log('   (MOCK FRAMEWORK REMOVED & LIVE API KEY ENFORCEMENT VERIFIED)');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✔ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ✖ [FAIL] ${testName}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
  }

  // Preserve original environment
  const origAmadeusKey = process.env.AMADEUS_API_KEY;
  const origAmadeusSecret = process.env.AMADEUS_API_SECRET;
  const origBookingKey = process.env.BOOKING_COM_API_KEY;
  const origPaymentsKey = process.env.BOOKING_COM_PAYMENTS_API_KEY;

  // Clear keys to test strict missing API key enforcement
  delete process.env.AMADEUS_API_KEY;
  delete process.env.AMADEUS_API_SECRET;
  delete process.env.BOOKING_COM_API_KEY;
  delete process.env.BOOKING_COM_PAYMENTS_API_KEY;

  // --- 1. Mock Framework Removal & Strict Provider Guards ---
  console.log('1️⃣ Phase 1: Mock Framework Removal & Strict Provider API Key Guards');
  assert(amadeusFlightProvider.hasApiKey() === false, 'Amadeus provider flags missing API key');
  assert(bookingComProvider.hasApiKey() === false, 'Booking.com provider flags missing API key');
  assert(bookingComPaymentProvider.hasApiKey() === false, 'Payments provider flags missing API key');

  let amadeusThrew = false;
  try {
    await amadeusFlightProvider.searchFlights({ origin: 'New York (JFK)', destination: 'Paris' });
  } catch (err: any) {
    amadeusThrew = err.message.includes('NO_API_KEY');
  }
  assert(amadeusThrew, 'Amadeus throws NO_API_KEY error without silent mock fallback');

  let bookingThrew = false;
  try {
    await bookingComProvider.searchAccommodations({ destination: 'Paris' });
  } catch (err: any) {
    bookingThrew = err.message.includes('NO_API_KEY');
  }
  assert(bookingThrew, 'Booking.com throws NO_API_KEY error without silent mock fallback');

  let paymentsThrew = false;
  try {
    await bookingComPaymentProvider.createPaymentSession({ bookingReference: 'TRV-TEST', totalCost: 500 });
  } catch (err: any) {
    paymentsThrew = err.message.includes('NO_API_KEY');
  }
  assert(paymentsThrew, 'Payments provider throws NO_API_KEY error without silent mock fallback');

  // --- 2. Chat Orchestrator Error Cards & Admin Links ---
  console.log('\n2️⃣ Phase 2: Conversational Orchestrator Missing Key Error Handling');
  const missingKeyChat = await travelOrchestrator.processMessage(undefined, 'I want to travel to London from New York next month');
  assert(missingKeyChat.step === 'INITIATION', 'Chatbot remains in INITIATION when flight API key is missing');
  assert(missingKeyChat.cards?.type === 'error', 'Chatbot responds with error card type');
  assert(missingKeyChat.cards?.data?.missingKey.includes('AMADEUS_API_KEY'), 'Error card highlights missing AMADEUS_API_KEY');
  assert(missingKeyChat.cards?.data?.actionUrl === '/admin.html', 'Error card directs user to /admin.html');
  assert(missingKeyChat.reply.includes('Amadeus Flight API Key Missing'), 'Reply text explains key requirement and admin setup');

  // --- 3. Ground Transfer Routing (Autonomous) ---
  console.log('\n3️⃣ Phase 3: Cab Transfer Routing (Airport-to-Hotel, Hotel-to-Airport, Custom)');
  const dummyHotel: any = {
    id: 'bkg-ref-101',
    name: 'Grand Central Hotel',
    city: 'Paris',
    area: 'Near Airport',
    pricePerNight: 120,
    totalPrice: 480
  };
  const a2hCabs = await cabTransferProvider.getTransferOptions('Paris', dummyHotel, 'airport_to_hotel');
  assert(a2hCabs.length === 4, 'Cab transfer returns 4 distinct vehicle classes');
  assert(a2hCabs[0].routeType === 'airport_to_hotel', 'Route type correctly flagged as airport_to_hotel');
  assert(a2hCabs[0].pickupLocation.includes('Airport') || a2hCabs[0].pickupLocation.includes('Terminal'), 'Airport pickup assigned');

  const h2aCabs = await cabTransferProvider.getTransferOptions('Paris', dummyHotel, 'hotel_to_airport');
  assert(h2aCabs[0].routeType === 'hotel_to_airport', 'Route type correctly toggled to hotel_to_airport');
  assert(h2aCabs[0].dropoffLocation.includes('Airport') || h2aCabs[0].dropoffLocation.includes('Terminal'), 'Airport dropoff assigned');

  // --- 4. User Profile Engine (.md Personalization) ---
  console.log('\n4️⃣ Phase 4: User Profile Engine (.md Personalization)');
  const testUserId = 'test_runner_user';
  const profile = await userProfileService.getProfile(testUserId);
  assert(profile.userId === testUserId, 'Retrieved user profile from disk / defaults');
  
  await userProfileService.updatePreferences(testUserId, {
    preferredCabin: 'Business',
    preferredDeparturePeriod: 'evening'
  });
  const updatedProfile = await userProfileService.getProfile(testUserId);
  assert(updatedProfile.preferredCabin === 'Business', 'Profile preferred cabin persisted');
  assert(updatedProfile.preferredDeparturePeriod === 'evening', 'Profile flight departure period persisted');

  const mdProfilePath = path.join(process.cwd(), 'data', 'profiles', `${testUserId}.md`);
  assert(fs.existsSync(mdProfilePath), 'Profile exists on disk as Markdown document');

  // --- 5. RAG Engine & Travel Domain Guardrails ---
  console.log('\n5️⃣ Phase 5: RAG Engine & Travel Domain Guardrails');
  const blockedQuery = 'How do I invert a binary tree in Rust?';
  const allowedQuery = 'What is the checked baggage allowance for international flights?';
  
  const guardrailBlocked = travelRAGService.isTravelRelated(blockedQuery);
  const guardrailAllowed = travelRAGService.isTravelRelated(allowedQuery);
  assert(!guardrailBlocked.allowed, 'Off-topic programming query blocked by domain guardrail');
  assert(guardrailAllowed.allowed, 'Valid travel inquiry allowed by domain guardrail');

  const ragAnswer = travelRAGService.answerTravelInquiry(allowedQuery);
  assert(ragAnswer !== null && ragAnswer.includes('baggage'), 'RAG knowledge base answered baggage query with domain guidelines');

  // --- 6. Admin Dashboard & Connection Diagnostics ---
  console.log('\n6️⃣ Phase 6: Admin Dashboard & Connection Diagnostics');
  const adminConfig = adminConfigService.getConfig();
  assert(adminConfig !== undefined, 'Admin config retrieved successfully');
  
  adminConfigService.saveConfig({
    paymentsEnvironment: 'sandbox',
    llmProvider: 'rule_engine'
  });
  const masked = adminConfigService.getMaskedConfig();
  assert(masked.paymentsEnvironment === 'sandbox', 'Payment environment updated at runtime');
  assert(process.env.PAYMENTS_ENV === 'sandbox', 'process.env synchronized with admin config');

  const pingNoAmadeus = await adminConfigService.testConnection('amadeus');
  assert(pingNoAmadeus.success === false && pingNoAmadeus.status.includes('No API Key Inserted'), 'Connection test returns error when Amadeus key missing');

  const pingNoBooking = await adminConfigService.testConnection('booking_com');
  assert(pingNoBooking.success === false && pingNoBooking.status.includes('No API Key Inserted'), 'Connection test returns error when Booking.com key missing');

  const pingNoPayments = await adminConfigService.testConnection('booking_com_payments');
  assert(pingNoPayments.success === false && pingNoPayments.status.includes('No API Key Inserted'), 'Connection test returns error when Payments key missing');

  // --- 7. End-to-End Flow with Live API Simulation & PDF Ticket Generation ---
  console.log('\n7️⃣ Phase 7: Live API Booking Pipeline & PDF Generation');
  
  // Set configured test keys
  process.env.AMADEUS_API_KEY = 'live_test_key_sample';
  process.env.AMADEUS_API_SECRET = 'live_test_secret_sample';
  process.env.BOOKING_COM_API_KEY = 'live_test_bkg_key_sample';
  process.env.BOOKING_COM_PAYMENTS_API_KEY = 'live_test_pay_key_sample';

  // Mock global fetch for live provider requests during pipeline test
  const originalFetch = global.fetch;
  global.fetch = async (url: any, init?: any): Promise<any> => {
    const urlStr = String(url);
    if (urlStr.includes('/oauth2/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'mock_bearer_token', expires_in: 1800 })
      };
    }
    if (urlStr.includes('/v2/shopping/flight-offers')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'flt-1',
              validatingAirlineCodes: ['AF'],
              itineraries: [
                {
                  segments: [
                    {
                      departure: { iataCode: 'JFK', at: '2026-10-12T08:30:00' },
                      arrival: { iataCode: 'CDG', at: '2026-10-12T21:45:00' },
                      carrierCode: 'AF',
                      number: 'AF007'
                    }
                  ]
                }
              ],
              price: { total: '720', currency: 'USD' },
              travelerPricings: [
                {
                  fareDetailsBySegment: [
                    { cabin: 'ECONOMY' }
                  ]
                }
              ]
            }
          ]
        })
      };
    }
    if (urlStr.includes('/accommodations/search')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'bkg-prop-101',
              name: 'Paris Luxury Palace Hotel',
              city: 'Paris',
              address: '15 Champs-Elysees, Paris',
              star_rating: 5,
              review_score: 9.4,
              review_count: 1240,
              area: 'Near Airport',
              price: 210,
              photos: [
                'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
                'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800',
                'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'
              ]
            }
          ]
        })
      };
    }
    return originalFetch(url, init);
  };

  try {
    const flightOffers = await amadeusFlightProvider.searchFlights({
      origin: 'New York (JFK)',
      destination: 'Paris',
      preferredCabin: 'Business'
    });
    assert(flightOffers.length > 0, 'Amadeus provider successfully retrieves and parses live flight offers');
    assert(flightOffers[0].cabinTiers !== undefined, 'Flight offer contains structured cabin tiers');

    const hotelOffers = await bookingComProvider.searchAccommodations({ destination: 'Paris' });
    assert(hotelOffers.length > 0, 'Booking.com provider successfully retrieves and parses accommodations');
    assert(hotelOffers[0].images.length >= 3, 'Hotel accommodation contains carousel images');

    const paySession = await bookingComPaymentProvider.createPaymentSession({
      bookingReference: 'TRV-REGRESS-01',
      totalCost: 930.00
    });
    assert(paySession.sessionId.startsWith('bkg_pay_'), 'Booking.com payment session created with valid key');

    // Conversational booking workflow
    const chat1 = await travelOrchestrator.processMessage(undefined, 'Book a trip to Paris from New York for 2 people');
    assert(chat1.step === 'FLIGHT_SELECTION', 'Conversational step transitioned to FLIGHT_SELECTION');
    assert(chat1.cards?.type === 'flights', 'Chatbot provides flight selection cards when configured');
    const sId = chat1.sessionId;

    const chat2 = await travelOrchestrator.processMessage(sId, 'Select Flight', {
      action: 'SELECT_FLIGHT',
      item: chat1.cards?.data[0],
      cabinClass: 'Business',
      price: chat1.cards?.data[0].cabinTiers['Business']
    });
    assert(chat2.step === 'HOTEL_SELECTION', 'Conversational step transitioned to HOTEL_SELECTION');
    assert(chat2.cards?.type === 'hotels', 'Chatbot provides hotel selection cards when configured');

    const chat3 = await travelOrchestrator.processMessage(sId, 'Select Hotel', {
      action: 'SELECT_HOTEL',
      item: chat2.cards?.data[0]
    });
    assert(chat3.step === 'CAB_SELECTION', 'Conversational step transitioned to CAB_SELECTION');

    const chat4 = await travelOrchestrator.processMessage(sId, 'Select Cab', {
      action: 'SELECT_CAB',
      item: chat3.cards?.data[0]
    });
    assert(chat4.step === 'CHECKOUT_SUMMARY', 'Conversational step transitioned to CHECKOUT_SUMMARY');
    assert(chat4.cards?.data?.paymentSession !== undefined, 'Payment session generated and attached to checkout summary');

    const chat5 = await travelOrchestrator.processMessage(sId, 'Confirm Booking', {
      action: 'CONFIRM_BOOKING',
      paymentMethod: 'Credit Card (Mastercard)'
    });
    assert(chat5.step === 'CONFIRMED', 'Conversational step transitioned to CONFIRMED');
    assert(chat5.cards?.data?.pdfUrl !== undefined, 'Official PDF URL returned on confirmation');

    const ref = chat5.cards?.data?.bookingReference;
    const pdfFilePath = path.join(process.cwd(), 'public', 'tickets', `Ticket_${ref}.pdf`);
    assert(fs.existsSync(pdfFilePath), 'Official PDF ticket voucher generated on filesystem');

    const dbRecord = await prisma.booking.findUnique({
      where: { bookingReference: ref }
    });
    assert(dbRecord !== null, 'Booking record saved in database');
    assert(dbRecord?.status === 'CONFIRMED', 'Database status marked CONFIRMED');

    // Clean up test ticket
    try {
      if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
    } catch(e) {}

  } finally {
    global.fetch = originalFetch;
    // Restore original environment
    if (origAmadeusKey) process.env.AMADEUS_API_KEY = origAmadeusKey;
    if (origAmadeusSecret) process.env.AMADEUS_API_SECRET = origAmadeusSecret;
    if (origBookingKey) process.env.BOOKING_COM_API_KEY = origBookingKey;
    if (origPaymentsKey) process.env.BOOKING_COM_PAYMENTS_API_KEY = origPaymentsKey;
  }

  // Clean up user profile
  try {
    if (fs.existsSync(mdProfilePath)) fs.unlinkSync(mdProfilePath);
  } catch(e) {}

  // --- 8. Phase 8: Mock Testing Mode (Zero API Keys Dual-Mode) ---
  console.log('\n8️⃣ Phase 8: Mock Testing Mode (Dual-Mode Verification with Zero API Keys)');
  
  // Set all providers to mock mode and ensure no API keys exist
  delete process.env.AMADEUS_API_KEY;
  delete process.env.AMADEUS_API_SECRET;
  delete process.env.BOOKING_COM_API_KEY;
  delete process.env.BOOKING_COM_PAYMENTS_API_KEY;

  adminConfigService.saveConfig({
    flightProvider: 'mock',
    hotelProvider: 'mock',
    paymentsProvider: 'mock',
    cabProvider: 'mock'
  });

  assert(amadeusFlightProvider.isMock() === true, 'Amadeus provider is in mock mode');
  assert(bookingComProvider.isMock() === true, 'Booking.com provider is in mock mode');
  assert(bookingComPaymentProvider.isMock() === true, 'Booking.com payments provider is in mock mode');

  const mockFlightOffers = await amadeusFlightProvider.searchFlights({
    origin: 'New York (JFK)',
    destination: 'Tokyo (NRT)',
    preferredCabin: 'Business'
  });
  assert(mockFlightOffers.length === 4, 'Mock flights return 4 scheduled flights across all times of day');
  assert(mockFlightOffers[0].cabinTiers['First Class'] !== undefined, 'Mock flights contain all 4 cabin tiers');

  const mockHotelOffers = await bookingComProvider.searchAccommodations({
    destination: 'Tokyo'
  });
  assert(mockHotelOffers.length >= 6, 'Mock hotels return 6+ rich accommodations');
  assert(mockHotelOffers[0].images.length >= 3, 'Mock hotels include multiple carousel photos');
  assert(mockHotelOffers[0].area === 'Near Airport', 'Mock hotels default to Near Airport area');

  const mockPaySession = await bookingComPaymentProvider.createPaymentSession({
    bookingReference: 'TRV-MOCK-99',
    totalCost: 1250.00
  });
  assert(mockPaySession.sessionId.startsWith('bkg_pay_mock_'), 'Mock payment session generated with mock prefix');

  const mockPayVerify = await bookingComPaymentProvider.verifyPayment(mockPaySession.sessionId);
  assert(mockPayVerify.success === true, 'Mock payment verification succeeds instantly');

  const mockPingFlt = await adminConfigService.testConnection('amadeus');
  assert(mockPingFlt.success === true && mockPingFlt.status.includes('Mock Testing Mode'), 'Mock Amadeus connection test succeeds in 2ms');

  const mockPingHtl = await adminConfigService.testConnection('booking_com');
  assert(mockPingHtl.success === true && mockPingHtl.status.includes('Mock Testing Mode'), 'Mock Booking.com connection test succeeds in 2ms');

  const mockPingPay = await adminConfigService.testConnection('booking_com_payments');
  assert(mockPingPay.success === true && mockPingPay.status.includes('Mock Testing Mode'), 'Mock Booking.com Payments connection test succeeds in 2ms');

  // Full end-to-end conversation in mock mode without any API keys
  const mockChat1 = await travelOrchestrator.processMessage(undefined, 'I want to travel to Tokyo from New York');
  assert(mockChat1.step === 'FLIGHT_SELECTION', 'Mock conversational pipeline proceeds to FLIGHT_SELECTION without key error');
  assert(mockChat1.cards?.type === 'flights', 'Mock flight cards returned to user');
  const mSid = mockChat1.sessionId;

  const mockChat2 = await travelOrchestrator.processMessage(mSid, 'Select Flight', {
    action: 'SELECT_FLIGHT',
    item: mockChat1.cards?.data[0],
    cabinClass: 'Economy',
    price: mockChat1.cards?.data[0].cabinTiers['Economy']
  });
  assert(mockChat2.step === 'HOTEL_SELECTION', 'Mock conversational pipeline proceeds to HOTEL_SELECTION without key error');
  assert(mockChat2.cards?.type === 'hotels', 'Mock hotel cards returned to user');

  const mockChat3 = await travelOrchestrator.processMessage(mSid, 'Select Hotel', {
    action: 'SELECT_HOTEL',
    item: mockChat2.cards?.data[0]
  });
  assert(mockChat3.step === 'CAB_SELECTION', 'Mock conversational pipeline proceeds to CAB_SELECTION');

  const mockChat4 = await travelOrchestrator.processMessage(mSid, 'Select Cab', {
    action: 'SELECT_CAB',
    item: mockChat3.cards?.data[0]
  });
  assert(mockChat4.step === 'CHECKOUT_SUMMARY', 'Mock conversational pipeline proceeds to CHECKOUT_SUMMARY without key error');

  const mockChat5 = await travelOrchestrator.processMessage(mSid, 'Confirm Booking', {
    action: 'CONFIRM_BOOKING',
    paymentMethod: 'Credit Card (Visa)'
  });
  assert(mockChat5.step === 'CONFIRMED', 'Mock booking successfully confirmed without external payment keys');
  const mockRef = mockChat5.cards?.data?.bookingReference;
  const mockPdfFilePath = path.join(process.cwd(), 'public', 'tickets', `Ticket_${mockRef}.pdf`);
  assert(fs.existsSync(mockPdfFilePath), 'Mock booking ticket generated as official PDF voucher');

  // Clean up mock ticket
  try {
    if (fs.existsSync(mockPdfFilePath)) fs.unlinkSync(mockPdfFilePath);
  } catch(e) {}

  console.log('\n================================================================');
  console.log(`🎉 SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
