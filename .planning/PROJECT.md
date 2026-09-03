# SkyVoyage AI — Conversational Travel Assistant Framework

## What This Is
An AI-first end-to-end travel booking framework that enables travelers to plan, discover, filter, and complete complete itineraries (flights with cabin classes, hotels with photo carousels and filtering, and multi-route airport transfers) through natural conversation on a responsive web application. The platform includes a secure Admin Dashboard for runtime API key and provider configuration (Booking.com, Amadeus, LLMs), a RAG domain guardrail to prevent off-topic hallucinations, and personalized markdown user profiles (`.md`) to continuously tailor recommendations.

## Core Value
A frictionless, single-thread conversational experience that transitions a traveler seamlessly from discovery to flight, hotel, and cab booking with printable vouchers, while providing developers a plug-and-play admin interface to inject partner API keys without rebuilding.

## Key Stakeholders & Personas
- **Travelers / End Users:** Conversational planning, fast comparisons, rich card selections with image carousels, custom transfer options, and instant printable PDF vouchers.
- **Platform Administrator / Developers:** Secure dashboard to insert and manage Booking.com API credentials, Amadeus API keys, LLM API keys (Gemini, OpenAI, Anthropic), mock vs live switches, and view active bookings.

## System Architecture Summary
- **Frontend:** Responsive SPA (HTML5/CSS3/Vanilla JS + FontAwesome) with interactive cards, carousel view, live filter toolbar, and admin management UI.
- **Backend:** Node.js (v20+), Express REST APIs, TypeScript 5.6.
- **Database:** Prisma ORM with SQLite (dev) / PostgreSQL (prod).
- **AI / LLM:** Google Gemini 2.5 Flash + RAG Knowledge Retrieval + Guardrails.
- **Personalization:** Persistent Markdown Profile engine (`data/profiles/{userId}.md`).
- **Document Generation:** PDFKit vector e-ticket compiler with direct in-browser print triggers.
