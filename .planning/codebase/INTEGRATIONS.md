# External Integrations

**Analysis Date:** 2026-09-03

## APIs & External Services

**AI / Natural Language Understanding:**
- **Google Gemini API (Generative Language v1beta)**
  - Model: `gemini-2.5-flash`
  - Auth: API Key in `GEMINI_API_KEY`
  - Endpoints: `POST /v1beta/models/gemini-2.5-flash:generateContent`
  - Purpose: Structured travel entity extraction (origin, destination, dates, guests) with JSON response mode, plus natural language conversational concierge response generation.
  - Fallback: Deterministic regex/keyword entity extraction and rule-based conversational replies when API key is missing or calls fail.

**Hotel Accommodations:**
- **Booking.com Demand API v3**
  - SDK/Client: HTTP Fetch REST client (`src/providers/hotel/bookingComProvider.ts`)
  - Auth: Bearer Token (`BOOKING_COM_API_KEY`) + Affiliate ID (`BOOKING_COM_AFFILIATE_ID`)
  - Endpoints configured: `POST /accommodations/search`, `POST /orders/preview`
  - Status: Hybrid provider (Live API calls when credentials are supplied; comprehensive mock fallback matching Booking.com Demand v3 schema when mock mode is active).

**Flight Offers:**
- **Amadeus Flight Offers v2**
  - SDK/Client: HTTP REST client (`src/providers/flight/amadeusProvider.ts`)
  - Auth: API Key & Secret (`AMADEUS_API_KEY`, `AMADEUS_API_SECRET`)
  - Target Endpoint: `https://test.api.amadeus.com/v2/shopping/flight-offers`
  - Status: Framework plug-and-play adapter ready for operator credentials with structured fallback mock offers.

**Ground Transfers / Cabs:**
- **Transfer Aggregator / Uber API**
  - Client: Transfer Provider adapter (`src/providers/cab/transferProvider.ts`)
  - Credentials: `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET` (ready in `.env.example`)
  - Purpose: Airport pickup/hotel transfer routing with vehicle types, luggage/capacity specs, and flat-fare pricing.

**Document Generation:**
- **PDFKit Engine**
  - Internal generation pipeline (`src/services/pdfGenerator.ts`)
  - Output: High-resolution branded PDF e-tickets saved directly to `public/tickets/` and delivered in chat.
