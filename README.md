# ✈️ SkyVoyage AI — Conversational Travel Assistant Framework

> **An AI-first, end-to-end conversational travel assistant framework designed to plan, customize, and book complete journeys: Flights with multi-tier cabin selection, Booking.com accommodations with photo carousels & proximity filters, ground transfers, Booking.com Payments processing, and dual-mode confirmation delivering printable browser vouchers & official vector PDF tickets.**

---

## 🌟 Key Highlights & Capabilities

1. **Multi-Tier Flight Cabin & Timing Engine (Amadeus Offers v2 API)**:
   - Natural language extraction of origins, destinations, passenger counts, and departure timing preferences (`morning`, `afternoon`, `evening`, `night`).
   - Four distinct cabin classes per offer: **Economy**, **Premium Economy**, **Business**, and **First Class** with dynamic real-time fare calculation.
   - Time-of-day filtering that reorders flight schedules to match user preferences.

2. **Booking.com Demand API v3 Hotel Integration**:
   - Accommodations catalog with multi-photo interactive swipeable carousels.
   - Intelligent default: prioritizes **"Near Airport"** hotels sorted **low-to-high by price**.
   - Interactive top filter toolbar: price sort direction (↑ / ↓), area filter dropdown (Near Airport, City Center, Downtown, Historic), and dynamic maximum price slider.
   - 6-item pagination with responsive "See More Hotels" expansion.

3. **Expanded Ground Transfer & Chauffeur Services**:
   - Yes/No transfer prompt post-hotel booking with route switching toolbar.
   - Three routing modes: **Airport ➔ Hotel**, **Hotel ➔ Airport**, and **City / Custom Location**.
   - 4 vehicle classes: Standard Sedan, Executive Business (Mercedes E-Class), Eco Electric (Tesla Model Y), and Group Van.

4. **Booking.com Payments API & Secure Checkout Modal**:
   - Complete itemized bill: Flights + Hotels + Transfers + 12% mandatory taxes & service fees.
   - Interactive checkout modal supporting Credit/Debit Cards (Visa, Mastercard, Amex), PayPal / Digital Wallets, and Instant Bank Transfers / UPI.
   - PCI-DSS Level 1 compliant session handling with verified sandbox simulation and live gateway handoff.

5. **Dual-Mode Post-Confirmation Document Delivery**:
   - **Download Official PDF Voucher**: High-resolution vector PDF generated on the fly via `PDFKit` with cabin class badges, hotel policies, chauffeur details, order tokens, and barcode simulation (`/tickets/Ticket_{ref}.pdf`).
   - **Printable Itinerary (`/print-ticket.html?ref=...`)**: Standalone, clean, printer-optimized voucher page with dedicated `@media print` CSS rules, high contrast layout, and instant `window.print()` trigger.

6. **Markdown User Profile Engine (`data/profiles/{userId}.md`)**:
   - Human-readable and agent-editable user preferences stored as structured Markdown.
   - Automatically tracks cabin preference, preferred departure periods, favorite airlines, and logs confirmed bookings in an organized table.
   - Preconfigures search filters and customizes AI greetings for returning travelers.

7. **RAG Knowledge Base & Domain Guardrails (`data/knowledge/`)**:
   - Local knowledge retrieval over 4 travel policy guides: Baggage & Customs, Visa & Schengen rules, Airport Transit & Check-in, and Hotel Policies.
   - Strict travel domain guardrail deflects out-of-domain prompts (coding, math, politics) back to trip planning.

8. **Admin Dashboard & Runtime API Key Manager (`/admin.html`)**:
   - Zero-downtime hot-reloading for Google Gemini LLM API keys, Amadeus Flight keys, Booking.com Demand keys, and Booking.com Payments keys.
   - Seamless toggles between Sandbox and Live modes.
   - Built-in diagnostic connectivity test runner with live latency pings.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User([Traveler UI / Mobile Web]) <--> WebApp[Express Server :3000]
    
    subgraph Core Orchestration
        WebApp <--> Orch[Travel Orchestrator State Machine]
        Orch <--> Guard[Domain Guardrail & RAG Engine]
        Orch <--> Profile[User Profile Engine (.md)]
        Orch <--> AdminConfig[Admin Runtime Config Service]
    end

    subgraph External Provider Adapters
        Orch <--> Amadeus[Amadeus Flight Provider]
        Orch <--> BkgHotel[Booking.com Hotel Provider]
        Orch <--> Transfers[Chauffeur Transfer Provider]
        Orch <--> BkgPay[Booking.com Payment Gateway]
    end

    subgraph Document & Ticketing Engine
        Orch --> PDFKit[PDFKit Vector Ticket Engine]
        PDFKit --> PDFOut[(public/tickets/*.pdf)]
        Orch --> PrintHTML[public/print-ticket.html]
    end

    subgraph Persistence Layer
        WebApp <--> Prisma[(SQLite / PostgreSQL via Prisma)]
        Profile <--> DiskMD[(data/profiles/*.md)]
        AdminConfig <--> DiskJSON[(data/admin_config.json)]
    end
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 1. Installation
```bash
# Clone the repository
git clone git@github.com:Shreyas-cpu/End-to-End-travel-bot.git
cd End-to-End-travel-bot

# Install dependencies
npm install

# Initialize Prisma Database
npx prisma generate
npx prisma db push
```

### 2. Configure Environment (Optional)
The framework includes out-of-the-box sandbox & plug-and-play mock adapters for every provider. You can run immediately without API keys!

If you wish to test with live partner APIs, copy the example environment file or configure them directly via the **Admin Dashboard**:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:3000`**.

---

## ⚙️ Admin Dashboard & Runtime Configuration

Access the built-in Admin Dashboard at **`http://localhost:3000/admin.html`** or click the **"Admin Dashboard"** button in the header navigation bar.

The Admin Console allows you to configure and hot-swap:
- **Google Gemini API Key & Model**: Connect Gemini 2.5 Flash for natural language reasoning.
- **Amadeus Flight Offers v2 Key & Secret**: Connect live flight search.
- **Booking.com Demand API v3 Key & Affiliate ID**: Connect live hotel inventory.
- **Booking.com Payments API Key & Environment**: Toggle between Sandbox Simulation and Live checkout gateway.
- **Ground Transfer Provider**: Toggle between Standard and Live dispatch.
- **Diagnostic Connection Tests**: Run live connection checks with latency reporting for every provider.

All settings persist in `data/admin_config.json` and synchronize with `process.env` immediately without restarting the server.

---

## 🧪 Automated Testing

The repository contains a full end-to-end integration test suite verifying all 8 phases:
```bash
npm test
```
The test suite validates:
- [x] Flight entity extraction and 4-tier cabin fare calculation.
- [x] Booking.com hotel search, photo carousel, and low-to-high pricing sorting.
- [x] Bidirectional cab transfer routing (`airport_to_hotel`, `hotel_to_airport`, `custom`).
- [x] Markdown user profile reading and preference writing (`data/profiles/*.md`).
- [x] Travel domain guardrail deflects non-travel queries.
- [x] RAG knowledge retrieval for baggage and visa policies.
- [x] Admin dashboard runtime credential persistence and connectivity testing.
- [x] Booking.com payment session creation, capture, and database persistence.
- [x] PDF generation and printable HTML voucher availability.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/message` | Main conversational webhook for messages and interactive card actions. |
| `GET` | `/api/chat/history/:sessionId` | Retrieve chat message history and card payloads for a session. |
| `GET` | `/api/booking/:ref` | Retrieve confirmed booking record (flights, hotels, transfers, billing). |
| `GET` | `/api/user/profile/:userId?` | Retrieve user preferences and booking history in JSON & Markdown format. |
| `POST` | `/api/user/profile/:userId?` | Update user preferences in persistent Markdown. |
| `GET` | `/api/rag/search?q=...` | Query the RAG travel knowledge base with domain guardrail check. |
| `GET` | `/api/admin/config` | Retrieve masked runtime provider configuration. |
| `POST` | `/api/admin/config` | Save runtime API keys and settings with zero restart. |
| `POST` | `/api/admin/test-connection` | Perform diagnostic connectivity ping against selected provider. |
| `GET` | `/api/health` | Service health and connected provider status. |

---

## 📄 License
MIT License. Open source and ready for production deployment.
