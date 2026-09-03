# Technology Stack

**Analysis Date:** 2026-09-03

## Languages

**Primary:**
- TypeScript 5.6.3 - Server and domain business logic (`src/**/*`)
- JavaScript (ES2022) - Client-side logic and PWA service worker (`public/app.js`, `public/sw.js`)
- HTML5 & CSS3 - Responsive conversational UI (`public/index.html`, `public/style.css`)

**Secondary:**
- SQL / Prisma Schema - Data modeling and migrations (`prisma/schema.prisma`)

## Runtime & Environment

- **Runtime:** Node.js (v20+ LTS recommended, ES2022 target, CommonJS module resolution)
- **Development Server:** `tsx watch` (v4.19.2) for hot-reloading TypeScript execution
- **Database Engine:** SQLite (`file:./dev.db`) for local zero-config testing; compatible with PostgreSQL via Prisma provider swap
- **Mobile Packaging:** Capacitor 6.x (`capacitor.config.json` targeting Android app `com.skyvoyage.travelbot`)

## Frameworks & Core Libraries

**Backend Framework:**
- Express.js 4.21.1 - HTTP REST API and webhook handlers
- CORS 2.8.5 - Cross-Origin Resource Sharing middleware
- Dotenv 16.4.5 - Environment variable loader

**ORM & Database Client:**
- Prisma 5.22.0 - Object-Relational Mapping, type-safe query generation, database migrations (`@prisma/client`)

**Document & PDF Generation:**
- PDFKit 0.15.0 - Programmatic vector PDF voucher generation for flight, hotel, and transfer booking receipts

**AI / LLM Client:**
- Native Fetch / REST integration with Google Generative Language API (`gemini-2.5-flash`) for travel entity extraction and dynamic conversational commentary

**Client / Frontend:**
- Vanilla JavaScript (SPA architecture, no heavy front-end frameworks needed for low-latency chat)
- FontAwesome 6.4.0 (CDN) - Icons
- Google Fonts (Outfit & Plus Jakarta Sans) - Typography

## Package Management & Tooling

- **Package Manager:** npm (with `package-lock.json` lockfile)
- **TypeScript Compiler:** `tsc` (TypeScript 5.6.3)
- **Development Tooling:** `@types/express`, `@types/node`, `@types/cors`, `@types/pdfkit`, `@types/uuid`
