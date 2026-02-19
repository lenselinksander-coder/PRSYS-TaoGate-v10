# ORFHEUSS | OLYMPIA Console

## Overview

ORFHEUSS is a specialized organizational governance console built for clinical/medical environments (primarily ICU/Intensive Care contexts). It functions as a "mechanical canon" for measuring and bounding organizational pressure and movement. The system has two primary modules:

- **ARGOS (TaoGate)** — A gatekeeper that classifies input as either safe observations (PASS) or interventions requiring authorization (BLOCK). It auto-categorizes text into Observation, Intervention, Allocatie, or Command.
- **OLYMPIA (Decathlon)** — A monitoring dashboard that visualizes organizational "cost of movement" using mechanical metaphors (Speed/Omega vs. Carrying Capacity/Tau) across different operational disciplines (Sprint, Estafette, etc.).

The application also includes a Protocol Manual page and a printable/downloadable README page.

The UI language is predominantly **Dutch**, reflecting the target user base.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS v4 with CSS variables for theming, using a dark clinical/technical theme (cyan accent on dark blue-grey)
- **UI Components**: shadcn/ui (new-york style) with Radix UI primitives
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion
- **PDF Export**: jsPDF + html2canvas for the README page
- **Build Tool**: Vite with path aliases (`@/` → `client/src/`, `@shared/` → `shared/`)

### Backend
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript, executed via `tsx`
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Build**: esbuild for server bundling, Vite for client bundling (orchestrated via `script/build.ts`)

### API Endpoints
- `POST /api/observations` — Create a new observation (validated with Zod)
- `GET /api/observations?context=` — List observations, optionally filtered by context
- `GET /api/observations/stats?context=` — Get aggregated stats (total, passed, blocked)

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Connection**: `node-postgres` (pg) pool via `DATABASE_URL` environment variable
- **Schema**: Single `observations` table with fields: `id` (UUID), `text`, `status` (PASS/BLOCK), `category`, `context` (default "IC"), `createdAt`
- **Migrations**: Managed via `drizzle-kit push` (schema-push approach, not migration files)

### Shared Code
- `shared/schema.ts` contains the Drizzle table definition, Zod insert schema, and TypeScript types — shared between frontend and backend

### Development vs Production
- **Development**: Vite dev server with HMR proxied through Express, `tsx` for server execution
- **Production**: Client built to `dist/public/`, server bundled to `dist/index.cjs`, served as static files with SPA fallback

### Key Design Decisions
1. **Monorepo structure** (`client/`, `server/`, `shared/`) with shared schema — keeps types synchronized between frontend and backend without a separate package
2. **Drizzle over other ORMs** — lightweight, type-safe, close to SQL
3. **No authentication** — the system currently has no auth mechanism; it's designed as an internal tool
4. **Auto-classification on client** — the ARGOS module classifies observations into categories using keyword matching on the frontend, not server-side AI
5. **Polling for real-time updates** — observations refetch every 5 seconds via React Query's `refetchInterval` rather than WebSockets

## External Dependencies

### Required Services
- **PostgreSQL Database** — Required. Connection string must be provided via `DATABASE_URL` environment variable. Used for all persistent data storage.

### Key NPM Packages
- `express` v5 — HTTP server
- `drizzle-orm` + `drizzle-kit` — Database ORM and schema management
- `pg` — PostgreSQL client
- `@tanstack/react-query` — Server state management
- `recharts` — Chart visualizations
- `framer-motion` — Animations
- `wouter` — Client-side routing
- `jspdf` + `html2canvas` — PDF generation
- `zod` + `drizzle-zod` — Runtime validation
- `shadcn/ui` components (Radix UI based)

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` — Error overlay in development
- `@replit/vite-plugin-cartographer` — Dev tooling (dev only)
- `@replit/vite-plugin-dev-banner` — Dev banner (dev only)
- Custom `vite-plugin-meta-images` — Updates OpenGraph meta tags with Replit deployment URLs