# Codebase Concerns

**Analysis Date:** 2026-09-03

## Security & Credentials

**API Key in Repository Environment:**
- Issue: `.env` currently contains an active or semi-active `GEMINI_API_KEY`.
- Impact: If pushed to a public repository, credentials could be compromised.
- Fix approach: Ensure `.env` is strictly listed in `.gitignore` (or rotate the key if exposed).

**Input Sanitization & Rate Limiting:**
- Issue: No express rate-limiter or API throttle configured on `/api/chat/message`.
- Impact: Potential denial-of-service or uncontrolled Gemini API usage under heavy traffic.
- Fix approach: Introduce `express-rate-limit` and request payload validation.

## Automated Testing

**Lack of Automated Test Suite:**
- Issue: No test runner (e.g. Jest, Vitest, or Mocha) is installed in `package.json`.
- Impact: Regressions in the state machine or provider parsers must be verified manually.
- Fix approach: Add Vitest/Jest unit tests for `travelOrchestrator` state transitions and provider data mapping.

## Production Readiness relative to PRD

**Database Scaling:**
- Current setup defaults to SQLite (`dev.db`). In multi-container cloud deployments (e.g. AWS ECS / Render), a centralized PostgreSQL database should be connected via `DATABASE_URL`.

**Live API Operator Provisioning:**
- As explicitly noted in the PRD disclaimer, external API keys for Amadeus, Booking.com, and Uber need to be provisioned by the operator to switch from mock to live data.
