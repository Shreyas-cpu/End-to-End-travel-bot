# Roadmap: SkyVoyage AI Framework

## Overview

This roadmap establishes a comprehensive 8-phase implementation plan transforming the SkyVoyage AI framework into a production-ready conversational booking platform. It enhances flight class sorting, introduces a rich hotel carousel with interactive filter toolbars and pagination, expands cab transfer routing, adds a user markdown personalization engine, enforces RAG travel guardrails, deploys a full Admin Dashboard for API keys and operational oversight, integrates payment handoff with printable summaries, and conducts end-to-end testing.

## Phases

- [x] **Phase 1: Flight Cabin Class Selection & Schedule Enhancements** - Implement cabin class filtering (Economy, Premium Economy, Business, First), timing filters, and interactive sorting. (completed 2026-09-04)
- [x] **Phase 2: Hotel Carousel, Advanced Filter Toolbar & Pagination** - Build photo carousels, "near airport" default logic, price/area filters, max price slider, and 6-item pagination with "See More". (completed 2026-09-04)
- [ ] **Phase 3: Expanded Cab Transfer Routing (Airport-Hotel, Hotel-Airport, Custom)** - Provide Yes/No transfer prompt and multi-directional route options.
- [ ] **Phase 4: User Profile Engine (`.md` Personalization)** - Implement user profile markdown manager, recording preferences and injecting them into recommendation prompts.
- [ ] **Phase 5: RAG Engine & Travel Domain Guardrails** - Build travel knowledge index and enforce guardrail prompts to keep LLM strictly on-topic.
- [ ] **Phase 6: Admin Dashboard & Runtime API Key Manager** - Build secure admin portal for Booking.com (Hotels, Flights, Cabs & Payment API), Amadeus, and LLM API keys, mock/live toggles, and booking telemetry.
- [ ] **Phase 7: Booking.com Payment Integration & Dual-Mode Printable Summary** - Implement Booking.com Payment API checkout session flow (with mock fallback), PDFKit voucher enhancement, and direct in-browser printing trigger.
- [ ] **Phase 8: End-to-End Integration, UI Polish & Verification** - Conduct end-to-end scenario testing across web and mobile layouts, ensuring seamless transitions.

## Phase Details

### Phase 1: Flight Cabin Class Selection & Schedule Enhancements

**Goal**: Allow users to view flights categorized by cabin classes with live price differences, and capture optional travel timing preferences.
**Depends on**: Existing amadeusProvider and orchestrator
**Requirements**: FLT-01, FLT-02, FLT-03, FLT-04
**Success Criteria**:

1. User can specify timing preferences (e.g. "morning flight", "arrive before 6 PM") and see appropriate options.
2. Flight cards display cabin class selector chips (Economy, Premium, Business, First) with dynamically updating fares.
3. Selecting a flight records cabin class and transitions seamlessly to hotel discovery.

### Phase 2: Hotel Carousel, Advanced Filter Toolbar & Pagination

**Goal**: Deliver a hotel shopping experience matching modern travel portals with image carousels, responsive filter toolbars, and 6-item pagination.
**Depends on**: Phase 1
**Requirements**: HTL-01, HTL-02, HTL-03, HTL-04, HTL-05, HTL-06
**Success Criteria**:

1. Bot asks user if they want a hotel and defaults to "near the airport" unless specified otherwise.
2. Each hotel card renders an interactive photo carousel with previous/next arrows and thumbnail dots.
3. A sticky filter bar above hotel cards enables price sorting (low-to-high default), area filtering, and max-price range slider.
4. Only top 6 hotels render initially; clicking "See More" appends remaining options smoothly.

### Phase 3: Expanded Cab Transfer Routing

**Goal**: Give travelers full control over airport transfers with bidirectional and custom location options.
**Depends on**: Phase 2
**Requirements**: CAB-01, CAB-02, CAB-03, CAB-04
**Success Criteria**:

1. Bot prompts with a clear Yes/No action for cab transfers.
2. If Yes, user can select "Airport to Hotel", "Hotel to Airport", or type custom pickup/dropoff points.
3. User can skip cab transfer with a single click and proceed immediately to checkout summary.

### Phase 4: User Profile Engine (`.md` Personalization)

**Goal**: Persist individual user travel interests in dedicated Markdown files and use them to enhance recommendations.
**Depends on**: Phase 1, Phase 2
**Requirements**: PRF-01, PRF-02, PRF-03
**Success Criteria**:

1. System maintains `data/profiles/{userId}.md` recording airline loyalty, favorite amenities, seat preferences, and past destinations.
2. Returning users receive tailored recommendations (e.g. auto-highlighting hotels with breakfast/pool if preferred).
3. Bot acknowledges user preferences in natural language commentary.

### Phase 5: RAG Engine & Travel Domain Guardrails

**Goal**: Restrict the conversational LLM strictly to travel-related queries and supply verified travel knowledge.
**Depends on**: Phase 4
**Requirements**: RAG-01, RAG-02, RAG-03
**Success Criteria**:

1. Non-travel questions (e.g. coding, general trivia, politics) are politely declined and redirected to travel planning.
2. Ingested knowledge documents (baggage limits, visa hints, airport transit) enrich responses when relevant.
3. Fallback rule engine continues workflow without crashing if LLM is unreachable.

### Phase 6: Admin Dashboard & Runtime API Key Manager

**Goal**: Provide an administrative web interface for managing API keys, partner credentials, and system settings.
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06
**Success Criteria**:

1. Admin enters credentials via `/admin` login screen and accesses dashboard.
2. Admin can input and persist Booking.com API Key & Affiliate ID, Booking.com Payment API Key & Merchant ID, Amadeus keys, and LLM keys to runtime config.
3. Independent Mock/Live switches instantly toggle backend provider behavior without server restarts.
4. Admin can review active bookings, inspect generated vouchers, and edit RAG knowledge documents.

### Phase 7: Payment Handoff & Dual-Mode Printable Summary

**Goal**: Complete the booking checkout loop with payment simulation and immediate printing/PDF access.
**Depends on**: Phase 3, Phase 6
**Requirements**: SUM-01, SUM-02, SUM-03, SUM-04, SUM-05
**Success Criteria**:

1. Trip summary shows transparent itemized pricing, taxes, and grand total.
2. "Proceed to Payment" triggers Booking.com Payment API checkout session (or simulated gateway when keys pending) with transaction verification.
3. Upon confirmation, user can download the PDF voucher or click "Print Itinerary" for direct browser printing.

### Phase 8: End-to-End Integration, UI Polish & Verification

**Goal**: Verify all system components, ensure responsive design on mobile and desktop, and run automated smoke tests.
**Depends on**: Phase 1 through 7
**Success Criteria**:

1. Complete happy-path travel booking runs from greeting to printable ticket without errors.
2. UI looks refined on mobile viewports and desktop resolutions.
3. Typecheck and unit tests pass with zero errors.
