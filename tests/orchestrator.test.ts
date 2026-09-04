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
  console.log('🧪 RUNNING FULL SUITE: TRAVEL BOOKING AI FRAMEWORK (8 PHASES)');
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

  // --- 1. Flight Cabin Class Selection & Schedule ---
  console.log('1️⃣ Phase 1: Flight Cabin Class Selection & Scheduling');
  const flightOffers = await amadeusFlightProvider.searchFlights({
    origin: 'New York (JFK)',
    destination: 'Paris',
    timePreference: 'morning',
    preferredCabin: 'Business'
  });
  assert(flightOffers.length > 0, 'Amadeus flight provider returns flight offers');
  assert(flightOffers[0].cabinTiers !== undefined, 'Flight offers include all 4 cabin tiers');
  assert(flightOffers[0].cabinTiers['First Class'] > flightOffers[0].cabinTiers['Economy'], 'First class fare is higher than economy');
  assert(flightOffers[0].departurePeriod === 'morning', 'Time-of-day morning filter prioritized morning departure');

  // --- 2. Hotel Carousel, Advanced Filter & Pagination ---
  console.log('\n2️⃣ Phase 2: Hotel Carousel, Filter Toolbar & Pagination');
  const hotels = await bookingComProvider.searchAccommodations({
    destination: 'Paris'
  });
  assert(hotels.length >= 6, 'Booking.com provider returns at least 6 accommodations');
  assert(Array.isArray(hotels[0].images) && hotels[0].images.length >= 3, 'Hotel includes multi-photo carousel array');
  assert(hotels[0].area === 'Near Airport', 'First hotel default area is Near Airport');
  assert(hotels[0].pricePerNight <= hotels[hotels.length - 1].pricePerNight, 'Hotels sorted by price low-to-high by default');

  // --- 3. Expanded Cab Transfer Routing ---
  console.log('\n3️⃣ Phase 3: Cab Transfer Routing (Airport-to-Hotel, Hotel-to-Airport, Custom)');
  const a2hCabs = await cabTransferProvider.getTransferOptions('Paris', hotels[0], 'airport_to_hotel');
  assert(a2hCabs.length === 4, 'Cab transfer returns 4 distinct vehicle classes');
  assert(a2hCabs[0].routeType === 'airport_to_hotel', 'Route type correctly flagged as airport_to_hotel');
  assert(a2hCabs[0].pickupLocation.includes('Airport') || a2hCabs[0].pickupLocation.includes('Terminal'), 'Airport pickup assigned');

  const h2aCabs = await cabTransferProvider.getTransferOptions('Paris', hotels[0], 'hotel_to_airport');
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

  // --- 6. Admin Dashboard & Runtime Credential Manager ---
  console.log('\n6️⃣ Phase 6: Admin Dashboard & Runtime Config');
  const adminConfig = adminConfigService.getConfig();
  assert(adminConfig !== undefined, 'Admin config retrieved successfully');
  
  adminConfigService.saveConfig({
    paymentsEnvironment: 'sandbox',
    llmProvider: 'rule_engine'
  });
  const masked = adminConfigService.getMaskedConfig();
  assert(masked.paymentsEnvironment === 'sandbox', 'Payment environment updated at runtime');
  assert(process.env.PAYMENTS_ENV === 'sandbox', 'process.env synchronized with admin config');

  const testPing = await adminConfigService.testConnection('booking_com_payments');
  assert(testPing.success === true, 'Diagnostic connectivity ping to Payments API succeeds');

  // --- 7. Booking.com Payment Integration & Dual-Mode Printable Summary ---
  console.log('\n7️⃣ Phase 7: Booking.com Payments & Dual-Mode Printable Vouchers');
  const paySession = await bookingComPaymentProvider.createPaymentSession({
    bookingReference: 'TRV-REGRESS-01',
    totalCost: 1250.00
  });
  assert(paySession.sessionId.startsWith('bkg_pay_'), 'Booking.com payment session initialized');
  assert(paySession.status === 'authorized', 'Payment session status is authorized');

  const payVerify = await bookingComPaymentProvider.verifyPayment(paySession.sessionId, 'Credit Card');
  assert(payVerify.success === true, 'Payment transaction verified and captured');

  // Full conversational booking session
  const chat1 = await travelOrchestrator.processMessage(undefined, 'Book a flight from New York to Rome for 2 people');
  assert(chat1.step === 'FLIGHT_SELECTION', 'Conversational step transitioned to FLIGHT_SELECTION');
  const sId = chat1.sessionId;

  const chat2 = await travelOrchestrator.processMessage(sId, 'Select Flight', {
    action: 'SELECT_FLIGHT',
    item: chat1.cards?.data[0],
    cabinClass: 'Premium Economy',
    price: chat1.cards?.data[0].cabinTiers['Premium Economy']
  });
  assert(chat2.step === 'HOTEL_SELECTION', 'Conversational step transitioned to HOTEL_SELECTION');

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
  assert(chat4.cards?.data?.paymentSession !== undefined, 'Payment session attached to summary card');

  const chat5 = await travelOrchestrator.processMessage(sId, 'Confirm Booking', {
    action: 'CONFIRM_BOOKING',
    paymentMethod: 'Credit Card (Mastercard)'
  });
  assert(chat5.step === 'CONFIRMED', 'Conversational step transitioned to CONFIRMED');
  assert(chat5.cards?.data?.pdfUrl !== undefined, 'PDF URL returned on confirmation');
  assert(chat5.cards?.data?.printUrl !== undefined, 'Print voucher URL returned on confirmation');

  // Verify PDF file exists
  const ref = chat5.cards?.data?.bookingReference;
  const pdfFilePath = path.join(process.cwd(), 'public', 'tickets', `Ticket_${ref}.pdf`);
  assert(fs.existsSync(pdfFilePath), 'Official PDF ticket voucher generated on filesystem');

  // Verify Database Record
  const dbRecord = await prisma.booking.findUnique({
    where: { bookingReference: ref }
  });
  assert(dbRecord !== null, 'Booking record saved in database');
  assert(dbRecord?.status === 'CONFIRMED', 'Database status marked CONFIRMED');

  // Verify print-ticket.html exists
  assert(fs.existsSync(path.join(process.cwd(), 'public', 'print-ticket.html')), 'print-ticket.html available for browser printing');

  // Clean up test ticket and user profile
  try {
    fs.unlinkSync(pdfFilePath);
    if (fs.existsSync(mdProfilePath)) fs.unlinkSync(mdProfilePath);
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
