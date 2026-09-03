# Codebase Structure

**Analysis Date:** 2026-09-03

## Directory Layout

```
/home/promethious/Projects/Tickiting chat-bot/
├── .planning/                     # GSD planning, assessment, and state artifacts
│   └── codebase/                  # Codebase scan documents (STACK, ARCHITECTURE, etc.)
├── Final_Travel_Booking_AI_PRD.pdf # Product Requirements Document
├── capacitor.config.json          # Mobile / Capacitor configuration
├── package.json                   # Project metadata and dependencies
├── tsconfig.json                  # TypeScript compiler settings
├── .env.example                   # Environment variable template
├── .env                           # Local environment configuration
├── prisma/                        # Database schema & migrations
│   ├── schema.prisma              # Data models (Session, Message, Booking)
│   └── dev.db                     # SQLite database file
├── public/                        # Static client web assets & tickets
│   ├── index.html                 # Main web application entry point
│   ├── style.css                  # Dark-theme responsive styling
│   ├── app.js                     # Frontend chat and action controller
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # PWA Service Worker
│   └── tickets/                   # Generated PDF voucher documents
└── src/                           # Backend TypeScript source code
    ├── server.ts                  # Express application setup and routes
    ├── providers/                 # External service provider adapters
    │   ├── types.ts               # Core domain interfaces
    │   ├── flight/                # Flight providers (Amadeus)
    │   ├── hotel/                 # Hotel providers (Booking.com Demand API)
    │   └── cab/                   # Transfer & cab providers
    └── services/                  # Core business logic services
        ├── orchestrator.ts        # Conversational state machine orchestrator
        ├── geminiService.ts       # Google Gemini LLM service
        └── pdfGenerator.ts        # PDFKit travel voucher generator
```
