# ORFHEUSS | Universal Governance Model

## Overview

ORFHEUSS is a universal governance model designed to classify, escalate, and block intents based on configurable rules and datasets for any organization. It incorporates PRSYS (Paontologisch Resonantie Systeem), an ontological model for organizational movement. The system allows organizations to register with specific sector and gate profiles (e.g., Clinical, Financial, Legal), load custom Scopes (datasets of categories, rules, and documents), and integrate external AI agents. A core feature is the Universal Gateway, which applies gate and scope resolutions to all incoming intents, with all decisions recorded in an Intent Audit Trail.

Key capabilities include:
- **ARGOS (TaoGate)**: Pre-governance classification with customizable gate profiles.
- **SCOPES**: Management of organizational datasets for classification.
- **OLYMPIA**: A rule execution layer for jurisdictional conflict resolution across multiple layers (EU, National, Regional, Municipal).
- **PRSYS Tape Pipeline**: Compiles scopes into signed, verifiable JavaScript tapes for secure and efficient runtime execution.

The project aims to provide a robust and adaptable governance framework, ensuring compliance and controlled AI interactions across diverse organizational contexts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

ORFHEUSS is built as a multi-tenant application with a clear separation of concerns between its frontend, backend, and core governance pipeline.

### Frontend
- **Framework**: React 18 with TypeScript.
- **Routing**: React Router DOM v7.
- **State Management**: Local React state, with `fetch` for API interactions.
- **Styling**: Tailwind CSS v4 using CSS variables, featuring a dark clinical/technical theme (cyan on dark blue-grey).
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives.
- **Icons**: Lucide React.
- **Build Tool**: Vite, with path aliases for improved development experience.
- **Admin Pages**: Dashboard, Organisaties, ARGOS (Triage), Scopes, Castra, Import, Connectors, OLYMPIA, Vectoren (Vector Engine), Register (Algoritmeregister), Gateway Logs, Ingest.
- **Public Pages**: CVI (landing), Glazen Bastion (burgerportaal).
- The UI language is predominantly **Dutch**.

### Testudo (server/middleware/testudo.ts)
Defensive shield layer protecting TaoGate. Handles validation, rate limits, auth guards and abuse protection. All API requests pass through Testudo before reaching the pipeline.
- **Rate Limiting**: Per-client (IP or API key) with separate limits for gateway (60/min) and general API (120/min).
- **Input Validation**: Deep recursive scanning for XSS, SQL injection, path traversal, template injection.
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy.
- **Abuse Protection**: Body size limits, nesting depth limits, oversized input blocking.
- **Status**: Exposed via `/api/system/info` → `testudo` field.

### Backend
- **Runtime**: Node.js with Express 5.
- **Language**: TypeScript, executed via `tsx`.
- **API Pattern**: RESTful JSON API under the `/api/` prefix.
- **Gate System**: A pluggable gate system (`server/gateSystem.ts`) allowing for different domain-specific profiles (clinical, financial, legal, educational, general).
- **Build**: esbuild for server bundling.

### Core Pipeline (server/pipeline/)
The business logic is modularized into a pipeline service, which processes intents through a series of steps:
- **Argos**: Input detection and normalization.
- **Arachne**: Syntax and intent-structure analysis.
- **Logos**: Domain and keyword classification using scope data.
- **Olympia**: Jurisdictional rule resolution and Cerberus gate enforcement.
- **Castra**: Risk assessment (Hypatia for Impact x Probability, Phronesis for SI).
- **Valkyrie**: Exposure guard — blocks unguarded exposure before TaoGate when escalation or high-risk decisions are pending.
- **TaoGate**: Final decision lattice resolution and notifications.
- **Audit**: Creation of audit records.
- Specialized modules for clinical evaluation (e.g., `clinical.ts` for Implicit Pressure LLM evaluation).

### PRSYS Tape Pipeline
This pipeline ensures that runtime execution is secure and immutable. Scopes, once locked, are compiled into signed JavaScript tapes.
- **Workflow**: Scopes are built into versioned `.js` tapes, cryptographically signed (SHA-256 + Ed25519), and then loaded into a TapeDeck for execution.
- **PRSYS_INVARIANT**: The `/api/gate` endpoint exclusively executes from these verified tapes, never directly querying the database for classification logic.
- **Canon Layer Schema**: Tapes are categorized into canonical layers (e.g., `PRSYS_CORE_COMPLIANCE_LAYER` for EU regulation, `PRSYS_DOMAIN_LAW_LAYER` for national law) with defined precedence rules. Higher precedence layers or BLOCK decisions from any layer cannot be overridden by lower layers.

### TRST/TGR Runtime Physics
This module defines runtime physics for decision processing, influencing system behavior and stability but not the decision's semantic outcome.
- **τ (Draagkracht / Torque)**: Represents the structural complexity of a decision.
- **ω (Besluit-velocity)**: Represents the system-level load.
- **TI (Transfer Integrity)**: A pre-gate condition for assessing data integrity before execution.
- **SI (Spanningsindex)**: Calculated as τ × ω, used for system load indication with thresholds for throttling and hard blocking.
- **State Machine**: Intents pass through a state machine (e.g., INIT, PRE_GATE, EXECUTE, BLOCK) during processing.
- **Invariants**: τ, ω, TI, SI are runtime metadata and do not influence the `decision_hash` (A6 intact). They serve as runtime controls.

### Key Design Decisions
- **Universal and Pluggable Gate System**: Adaptable across sectors via configurable gate profiles.
- **API-first Gateway**: Facilitates external AI agent integration through API key authentication.
- **Multi-tenant Architecture**: Isolates scopes and connectors per organization.
- **Automated Dataset Import**: Simplifies scope creation from JSON/CSV.
- **Comprehensive Audit Trail**: Logs all gateway intents for transparency and accountability.
- **Secure Tape Pipeline**: Ensures integrity and immutability of classification logic at runtime.

## External Dependencies

- **Database**: PostgreSQL (for all persistent data storage).
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Frontend Libraries**: `react`, `react-router-dom`, `lucide-react`, `tailwindcss`, `shadcn/ui`.
- **Backend Libraries**: `express`, `pg`, `zod`.
- **AI Integration**: `openai` (used for Perplexity integration).