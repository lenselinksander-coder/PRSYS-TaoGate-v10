# ORFHEUSS | Universal Governance Model

## Overview

**ORFHEUSS** is a universal governance model — a console that any organization can use to classify, escalate, and block intents based on configurable rules and datasets. Inside runs **PRSYS** (Paontologisch Resonantie Systeem), an ontological model for organizational movement built on **Paontologie**: the intersection of Merleau-Ponty (the body as knowledge) and Tao (the way, the flow).

### Core Concept: Universal Governance
- Organizations register with a **sector** and **gate profile** (Clinical, Financial, Legal, Educational, General, Custom)
- Each organization loads **Scopes** — datasets containing classification categories, keywords, rules, and documents
- External AI agents connect via **Connectors** with API keys
- The **Universal Gateway** (`/api/gateway/classify`) applies gate + scope + OLYMPIA resolution to every intent
- All decisions are logged in the **Intent Audit Trail**

### Modules
- **ARGOS (TaoGate)** — Pre-governance classification with pluggable gate profiles. Each organization's gate profile determines which patterns are blocked/escalated before scope classification.
- **SCOPES** — Organizational scope management. Each scope defines classification categories (with PASS/BLOCK status, escalation targets, keywords) and organizational documents.
- **OLYMPIA (Rule Execution Layer)** — Jurisdictional rule conflict resolution. 4 layers (EU → NATIONAL → REGIONAL → MUNICIPAL) with priority mechanics. BLOCK always wins. Higher jurisdiction wins on conflict.
- **Organizations** — Multi-tenant organization management. Each org gets its own scopes, connectors, and gate profile.
- **Connectors** — External AI agent/data source/webhook registry with API key generation.
- **Dataset Import** — CSV/JSON import pipeline that creates Scopes automatically.
- **Gateway Logs** — Audit trail of all intents processed through the universal gateway.

### Gate Profiles
- **CLINICAL** — Blocks medication orders, procedures, triage, imperatives. Only observations allowed.
- **GENERAL** — Blocks destructive imperatives, passes observations.
- **FINANCIAL** — Blocks fraud/money laundering indicators, escalates KYC/AML.
- **LEGAL** — Blocks criminal context, escalates legally sensitive intents.
- **EDUCATIONAL** — Escalates assessments/testing, transparency for educational observations.
- **CUSTOM** — Default general filtering, extensible per organization.

The UI language is predominantly **Dutch**, reflecting the target user base.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router DOM v7
- **State Management**: Local React state for UI, fetch for API calls
- **Styling**: Tailwind CSS v4 with CSS variables for theming, using a dark clinical/technical theme (cyan accent on dark blue-grey)
- **UI Components**: shadcn/ui (new-york style) with Radix UI primitives
- **Icons**: Lucide React
- **Build Tool**: Vite with path aliases (`@/` → `client/src/`, `@shared/` → `shared/`)

### Backend
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript, executed via `tsx`
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Gate System**: Pluggable gate profiles (`server/gateSystem.ts`) wrapping domain-specific gates (clinical, financial, legal, educational, general)
- **Build**: esbuild for server bundling, Vite for client bundling

### API Endpoints

#### Core
- `POST /api/classify` — Classify intent with scope (uses org's gate profile)
- `POST /api/olympia/resolve` — Resolve rule conflicts across jurisdictional layers
- `GET /api/system/info` — System overview (orgs, scopes, connectors, intent stats)

#### Organizations
- `GET /api/organizations` — List all organizations
- `GET /api/organizations/:id` — Get organization
- `POST /api/organizations` — Create organization (name, slug, sector, gateProfile)
- `PUT /api/organizations/:id` — Update organization
- `DELETE /api/organizations/:id` — Delete organization

#### Scopes
- `GET /api/scopes` — List all scopes (optional `?orgId=`)
- `GET /api/scopes/default` — Get default scope
- `GET /api/scopes/:id` — Get scope
- `POST /api/scopes` — Create scope
- `PUT /api/scopes/:id` — Update scope
- `DELETE /api/scopes/:id` — Delete scope
- `POST /api/scopes/:id/preflight` — Preflight check before lock
- `POST /api/scopes/:id/lock` — Lock scope

#### Connectors
- `GET /api/connectors` — List connectors (optional `?orgId=`)
- `GET /api/connectors/:id` — Get connector
- `POST /api/connectors` — Register connector (generates API key)
- `PUT /api/connectors/:id` — Update connector
- `DELETE /api/connectors/:id` — Delete connector

#### Universal Gateway
- `POST /api/gateway/classify` — Submit intent via API key auth (x-api-key header)

#### Intent Audit
- `GET /api/intents` — List intents (optional `?orgId=&limit=`)
- `GET /api/intents/stats` — Intent statistics

#### Dataset Import
- `POST /api/import/json` — Import JSON dataset as scope
- `POST /api/import/csv` — Import CSV dataset as scope

#### Observations
- `POST /api/observations` — Create observation
- `GET /api/observations` — List observations
- `GET /api/observations/stats` — Stats

#### Research (Perplexity)
- `POST /api/ingest/research` — Research topic via Perplexity
- `POST /api/ingest/extract` — Extract scope from research
- `POST /api/ingest/draft` — Create draft scope from research
- `POST /api/ingest/manual-draft` — Create manual draft scope

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod`
- **Tables**:
  - `organizations`: id, name, slug, description, sector, gate_profile, created_at
  - `scopes`: id, name, description, status, org_id, categories (JSONB), documents (JSONB), rules (JSONB), ingest_meta (JSONB), is_default, created_at, updated_at
  - `observations`: id, text, status, category, escalation, context, scope_id, olympia_rule_id, olympia_action, olympia_layer, created_at
  - `connectors`: id, org_id, name, type, provider, description, api_key, status, config (JSONB), last_used_at, created_at
  - `intents`: id, org_id, scope_id, connector_id, input_text, decision, category, layer, pressure, reason, escalation, processing_ms, created_at

### Pages
- `/` — Dashboard (system overview, stats, quick links)
- `/organizations` — Organization management
- `/triage` — ARGOS TaoGate (intent classification with scope selector)
- `/scopes` — Scope management
- `/import` — Dataset import (JSON/CSV)
- `/connectors` — Connector/agent registry
- `/gateway-logs` — Intent audit trail
- `/olympia` — OLYMPIA Rule Execution Layer
- `/ingest` — AI-powered research & scope extraction
- `/lexicon` — Lexicon

### Key Design Decisions
1. **Universal model** — Not tied to any specific sector. Gate profiles make it adaptable.
2. **Pluggable gate system** — Clinical gate is one profile among many. Organizations choose their profile.
3. **API-first gateway** — External agents authenticate via API keys and get full governance pipeline.
4. **Multi-tenant via organizations** — Each org gets isolated scopes and connectors.
5. **Dataset import** — CSV and JSON import creates draft Scopes automatically.
6. **Audit trail** — Every gateway intent is logged with decision, timing, and context.

## External Dependencies

### Required Services
- **PostgreSQL Database** — Required for all persistent data storage.

### Key NPM Packages
- `express` v5, `drizzle-orm`, `pg`, `zod`, `drizzle-zod`
- `react`, `react-router-dom`, `lucide-react`
- `tailwindcss`, `shadcn/ui` components
- `openai` (Perplexity integration)
