# Architecture

**Analysis Date:** 2026-09-03

## Pattern Overview

**Overall:** Conversational State Machine with Provider Adapter Pattern & Event-Driven UI

**Key Characteristics:**
- **Single-Page Chat Interface (PWA):** Eliminates complex traditional form wizards in favor of a guided, multi-step conversation with interactive action cards.
- **Finite State Machine (FSM):** Orchestrates strict travel booking progression (`INITIATION` -> `FLIGHT_SELECTION` -> `HOTEL_SELECTION` -> `CAB_SELECTION` -> `CHECKOUT_SUMMARY` -> `CONFIRMED`).
- **Adapter-Based Provider Abstraction:** Decouples business logic from external booking providers (Amadeus, Booking.com, Transfer aggregators) with seamless live/mock switching.
- **Server-Driven Rich Card UI:** Server sends JSON card payloads (`flights`, `hotels`, `cabs`, `summary`, `ticket`) rendered dynamically into the chat stream.

## Layers

1. **Client / Presentation Layer (`public/`):**
   - `index.html`: Dual-pane responsive layout (Sidebar Workflow Tracker + Main Chat Workspace).
   - `app.js`: Chat lifecycle controller, local storage session persistence, action button event dispatchers.
   - `sw.js` & `manifest.json`: Service worker caching for PWA & mobile standalone readiness.

2. **HTTP & Routing Layer (`src/server.ts`):**
   - Express REST API hosting health checks (`/api/health`), chat webhook (`/api/chat/message`), and session history recovery (`/api/chat/history/:sessionId`).

3. **Orchestration Layer (`src/services/orchestrator.ts`):**
   - Manages user sessions, parses conversational intent via Gemini or regex rules, controls state progression, accumulates itinerary selections, itemizes costs, and triggers ticket generation.

4. **Intelligence & Domain Services Layer (`src/services/`):**
   - `geminiService.ts`: Generative AI travel extraction and tone-crafted responses.
   - `pdfGenerator.ts`: Vector PDF voucher compilation with styled flight routes, hotel badges, driver info, and billing receipts.

5. **Provider Adapter Layer (`src/providers/`):**
   - `types.ts`: Common domain models (`FlightOffer`, `HotelAccommodation`, `CabTransfer`, `BookingDetails`).
   - Adapters for Amadeus, Booking.com Demand API, and Transfer providers.

6. **Persistence Layer (`prisma/`):**
   - SQLite/PostgreSQL through Prisma ORM storing sessions, messages with card metadata, and finalized booking records.
