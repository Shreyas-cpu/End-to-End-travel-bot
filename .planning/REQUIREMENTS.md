# Requirements: SkyVoyage AI Framework

**Defined:** 2026-09-03
**Core Value:** Seamless conversational travel orchestration from natural intent to verified, printable PDF booking vouchers with an extensible admin control plane.

## v1 Requirements

### Flight Discovery & Selection (FLT)

- [x] **FLT-01**: Conversational entity extraction for origin, destination, departure date, return date, and optional time preferences (e.g. morning/evening).
- [x] **FLT-02**: Flight search display showing airline, flight number, departure/arrival times, duration, stops, and pricing.
- [x] **FLT-03**: Flight cabin class selector & sorting (Economy, Premium Economy, Business, First Class) with live price adjustment.
- [x] **FLT-04**: Interactive flight selection card triggering state transition to Hotel stage.

### Hotel Booking & Rich Filtering (HTL)

- [x] **HTL-01**: Chatbot prompts user if they would like to book a hotel upon flight confirmation.
- [x] **HTL-02**: Preferred location prompt with automatic default to "near the airport" if unspecified.
- [x] **HTL-03**: Hotel card with multi-photo scrollable carousel, star ratings (1-5★), review scores, and per-night rate.
- [x] **HTL-04**: Default ordering of hotel options from lowest to highest per-night price.
- [x] **HTL-05**: Top filter toolbar above hotel cards with:
  - Price sort toggle (Low-to-High / High-to-Low).
  - Neighborhood/Area filter dropdown (Airport, City Center, Downtown, Beachfront).
  - Max price range slider with dynamic client-side filtering.
- [x] **HTL-06**: Pagination limiting initial display to top 6 accommodations with a "See More" button to append remaining options.

### Ground Transfers & Cabs (CAB)

- [x] **CAB-01**: Chatbot prompts user for airport transfer preference with clear Yes/No selection.
- [x] **CAB-02**: Multi-routing options:
  - Airport to Hotel
  - Hotel to Airport
  - Custom pickup and drop-off points.
- [x] **CAB-03**: Vehicle cards displaying model, capacity, luggage allowance, driver rating, and flat-fare pricing.
- [x] **CAB-04**: Option to skip transfer without penalizing itinerary flow.

### Checkout, Payment & Printable Summary (SUM)

- [ ] **SUM-01**: Comprehensive Trip Summary aggregating flight, hotel, and transfer costs with 12% itemized taxes & service fees.
- [ ] **SUM-02**: "Proceed to Payment" action executing Booking.com Payments API checkout flow (with fallback mock payment session when credentials pending).
- [ ] **SUM-03**: Booking reference generation and persistence to Prisma database.
- [ ] **SUM-04**: High-resolution vector PDF e-ticket generation via PDFKit.
- [ ] **SUM-05**: Direct in-browser printing trigger (`window.print` / printable layout view) alongside instant PDF download.

### Admin Dashboard & API Management (ADM)

- [x] **ADM-01**: Dedicated Admin portal accessible via direct login link (`/admin`).
- [x] **ADM-02**: Admin authentication with secure password check and session storage.
- [x] **ADM-03**: API key configuration interface for:
  - Booking.com Demand API Key & Affiliate ID.
  - Amadeus Flight API Key & Secret.
  - LLM Provider Selection (Google Gemini, OpenAI, Claude) & API Key slot.
- [x] **ADM-04**: Provider Mode Toggles: Independent "Mock" vs "Live" switches for Hotels, Flights, Cabs, and LLM.
- [x] **ADM-05**: Operational monitoring view: Live session logs, recent bookings list, and ticket inspection.
- [x] **ADM-06**: RAG Knowledge Base text editor for updating travel policies, airport guides, and FAQ content.
- [ ] **ADM-07**: Booking.com Payments API credentials management — dedicated slots for Booking.com Payment API Key, Merchant ID / Secret, and Payment Mode (Live / Mock).

### RAG Domain Restriction & LLM Guardrails (RAG)

- [x] **RAG-01**: Domain restriction prompt guardrail preventing non-travel queries and gracefully re-steering to trip planning.
- [x] **RAG-02**: Context-augmented knowledge retrieval ingesting travel rules, baggage allowances, cancellation terms, and transit guidance.
- [x] **RAG-03**: Deterministic rule fallback ensuring continuous workflow progression if LLM API rate limits or network issues occur.

### User Personalization via Markdown Profiles (PRF)

- [x] **PRF-01**: Dedicated Markdown profile storage per user (`data/profiles/{userId}.md`).
- [x] **PRF-02**: Structured extraction and logging of user travel preferences (seat preference, hotel amenities, preferred airlines, budget level, past destinations).
- [x] **PRF-03**: Dynamic profile injection into Gemini/LLM prompt context for hyper-personalized recommendations and pre-selected filters.
