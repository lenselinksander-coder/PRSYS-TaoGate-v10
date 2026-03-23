# CLAUDE.md — PRSYS TaoGate v10

AI assistant guide for the ORFHEUSS/TaoGate governance codebase.

---

## Project Overview

PRSYS TaoGate v10 is a **constitutional AI-governance framework** implementing the ORFHEUSS architecture. It evaluates AI system requests through a multi-layer decision lattice that enforces EU AI Act compliance, GDPR requirements, and institutional governance rules. Decisions are deterministic, append-only audited, and governed by formal axioms.

The system produces exactly one of five verdicts per request:
```
PASS < PASS_WITH_TRANSPARENCY < ESCALATE_HUMAN < ESCALATE_REGULATORY < BLOCK
```

BLOCK is absolute and cannot be overridden by any lower layer.

---

## Repository Layout

```
PRSYS-TaoGate-v10/
├── client/              # React 19 + Vite frontend (triage UI, dashboard)
│   └── src/
│       ├── components/  # Radix UI + Tailwind components
│       ├── hooks/       # Custom React hooks
│       ├── pages/       # Route-level pages
│       └── lib/         # Client utilities
├── server/              # Express 5 backend + governance engine
│   ├── core/            # TRST Runtime & EU Legal Gate (TapeDeck) ← TAPE-EU2
│   ├── pipeline/        # Orchestration & decision lattice
│   ├── fsm/             # XState Cerberus fail-safe state machine
│   ├── trace/           # Hypatia risk + Phronesis capacity + DPIA
│   ├── vector_engine/   # Vector Legitimacy Engine (S = √(m²+i²+l²)/√3)
│   ├── middleware/       # Testudo shields (rate limit, content guards)
│   ├── audit/           # WORM append-only audit chain (S3 Object Lock)
│   ├── services/        # PDF parsing, utilities
│   ├── integrations/    # Algoritmeregister sync, external APIs
│   ├── prsys/           # PRSYS Canon layer files
│   ├── __tests__/       # Vitest test suite
│   ├── routes.ts        # HTTP route handlers (864 lines)
│   ├── storage.ts       # Drizzle ORM database abstraction
│   ├── db.ts            # PostgreSQL connection + auto-migration
│   ├── gateSystem.ts    # Gate decision logic & escalation routing
│   ├── clinicalGate.ts  # Clinical/healthcare-specific gate logic
│   ├── perplexity.ts    # Perplexity AI research integration
│   └── index.ts         # Express app entry point
├── shared/
│   └── schema.ts        # Drizzle ORM schema + Zod validators (single source of truth)
├── tao_gate/            # Python governance kernel (HDS evaluation)
│   ├── __main__.py
│   ├── supervisor.py    # Kernel supervisor
│   ├── state.py         # State management
│   ├── dymphna.py       # Load capacity (D_load > D_cap_eff → BLOCK)
│   ├── gdpr_bridge.py   # GDPR bridge (absolute stop)
│   ├── inuit.py         # Biological sensitivity (Siku = 0 → HOLD)
│   ├── valkyrie.py      # UX/presentation firewall
│   ├── system_check.py  # 20 independent diagnostic checks
│   └── demo.py          # PASS/HOLD/BLOCK scenario demos
├── tools/               # Tape compilation & signing
│   ├── build_tapes_from_db.ts
│   └── sign_tape.ts
├── docs/                # Architecture documentation
│   ├── system_architecture.md
│   ├── ORFHEUSS_INTEGRATION.md
│   └── trst_mapping.md
├── script/build.ts      # esbuild production build script
├── shared/schema.ts     # Database schema + Zod types
├── ARCHITECTURE.md      # Dependency diagram + public APIs + invariants
├── README.md            # Project overview & demo commands
├── replit.md            # Full ORFHEUSS Editio IV specification (canonical)
├── .env.example         # Required environment variables
├── .eslintrc.json       # Import boundary enforcement rules
├── tsconfig.json        # TypeScript strict config + path aliases
├── vite.config.ts       # Frontend build config
├── vitest.config.ts     # Test runner config
└── drizzle.config.ts    # ORM migration config
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TailwindCSS 4, Radix UI, Framer Motion, Recharts |
| Backend | Express 5, TypeScript 5.6, Node.js 20 |
| Database | PostgreSQL 16, Drizzle ORM 0.39 |
| State Machines | XState 5 (Cerberus gate orchestration) |
| AI Integration | OpenAI SDK 6, Perplexity AI |
| Audit Storage | AWS S3 (WORM/Object Lock), falls back to PostgreSQL |
| Python Kernel | Python 3.11 (tao_gate HDS evaluation) |
| Testing | Vitest 4 |

---

## Development Commands

```bash
# Install dependencies
npm install

# Start backend (development, hot-reload via tsx)
npm run dev

# Start frontend (Vite dev server on port 5000)
npm run dev:client

# TypeScript type check (no emit)
npm run check

# Run tests (single pass)
npm run test

# Run tests (watch mode)
npm run test:watch

# Production build (esbuild → dist/index.cjs)
npm run build

# Start production server
npm start

# Push database schema changes
npm run db:push

# Python governance kernel demos
python -m tao_gate.system_check   # 20 diagnostic checks
python -m tao_gate.demo           # PASS/HOLD/BLOCK scenario demos
```

---

## Environment Variables

Copy `.env.example` to `.env`. Required variables:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/prsys   # Required
PORT=5000
NODE_ENV=development

# Optional — AI research integration
PERPLEXITY_API_KEY=

# Optional — WORM audit chain (falls back to PostgreSQL-only if unset)
WORM_S3_BUCKET=
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

The app starts without S3 credentials — audit writes fall back to database-only mode.

---

## Architecture Layers & Dependency Rules

Layers flow strictly top-down. **Never import upward.**

```
client
  └─→ server/routes
        └─→ server/pipeline
              └─→ server/{fsm, storage, vector_engine, trace}
                    └─→ server/core
                          └─→ shared/schema
```

Each subsystem exposes a **public API via its `index.ts`** only. Direct imports of internal files are blocked by ESLint:

```typescript
// ✅ Allowed — via public index
import { hypatiaRisk } from "../trace";

// ❌ Blocked by ESLint — direct internal import
import { hypatiaRisk } from "../trace/hypatia";
```

Each subsystem has its own `CLAUDE.md` with detailed invariants:
- `server/core/CLAUDE.md` — TAPE-EU2, TRST axioms
- `server/pipeline/CLAUDE.md` — decision ranking, pipeline sequence
- `server/fsm/CLAUDE.md` — Cerberus fail-safe guarantees
- `server/trace/CLAUDE.md` — Hypatia thresholds, DPIA levels
- `server/audit/CLAUDE.md` — WORM chain, hash-chaining invariants
- `tools/CLAUDE.md` — Tape compilation and signing

---

## Core Subsystems & Public APIs

### `server/core/` — TRST Runtime & EU Legal Gate
```typescript
import {
  bootstrapTapeDeck, getTapeDeck,
  bootstrapTRST, getTRSTConfig,
  executeTaoGate, runEuLegalGate,
  EU_BASELINE_SCOPE
} from "./server/core";
```

### `server/pipeline/` — Decision Orchestration
```typescript
import {
  runPipeline, classifyWithScope,
  resolveOlympiaRules, gatewayClassify,
  classifyIntent, preflightCheck, cerberusEnforce
} from "./server/pipeline";
```

### `server/fsm/` — Cerberus Fail-Safe (XState)
```typescript
import { orchestrateGate } from "./server/fsm";
```

### `server/trace/` — Risk & DPIA Classification
```typescript
import {
  hypatiaRisk, classifyDpiaLevel,
  DPIA_LEVEL_LABELS, phronesisCapacity
} from "./server/trace";
```

### `server/vector_engine/` — Legitimacy Scoring
```typescript
import { evaluateVector } from "./server/vector_engine";
// GateVector: { mandate: number, integrity: number, load: number }
// VectorDecision: { score: number, stable: boolean, threshold: number }
```

### `server/middleware/` — Request Guards
```typescript
import {
  testudoShield, testudoContentLengthGuard, testudoStatus
} from "./server/middleware";
```

---

## Invariants — Never Violate These

These are formal axioms of the system. Any change that violates them is a breaking bug:

### Decision Lattice
1. `GDPR STOP → BLOCK` — absolute, no override possible
2. `Cerberus legitimacy = false → BLOCK`
3. `Barbatos: |Δ_ext| > √(V_max/α) → BLOCK`
4. `O36: ω > τ − σ_ext → BLOCK`
5. `SI/TI: TI < TI_min → BLOCK`
6. `DYMPHNA: D_load > D_cap_eff → BLOCK`
7. Vector stability below threshold → HOLD
8. `INUIT: Siku = 0 → PASS → HOLD` (soft escalation)

### System Axioms (from ARCHITECTURE.md)
- **No-override:** BLOCK is final. No lower layer can change it.
- **Determinism:** Identical `DecisionContext` → identical `decision_hash`
- **Append-only audit:** Never mutate or backfill audit records; all entries are hash-chained
- **CoVe Independence (I6):** No layer verifies its own output — `V(G) ≠ V(L) ≠ V(E)`
- **Existence law:** `∃x = 0 ⇒ Output = 0` (any zero factor collapses result to zero)

### Tape Architecture
- **Tape 0:** EU legal foundation — absolute, never overridable
- **Tapes 1–5:** Institutional rules, standards, financing, sector, agreements (Tape 0 takes precedence)
- Tapes are compiled from LOCKED scopes, cryptographically signed, and validated on boot
- Runtime executes tapes only; the database is authoring-time only

---

## Database Schema

Defined in `shared/schema.ts` (Drizzle ORM + Zod). Main tables:

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant organizations |
| `scopes` | Governance scope definitions |
| `scopeRules` | Rules within each scope |
| `scopeCategories` | Rule categories |
| `scopeDocuments` | Attached documents |
| `intents` | Audit trail of all gate decisions |
| `connectors` | AI agents, webhooks, data source bindings |
| `observations` | Audit events |

Schema changes go through `shared/schema.ts` → `npm run db:push`.

---

## Testing

Tests live in `server/__tests__/` and use Vitest.

```bash
npm run test          # Single run
npm run test:watch    # Watch mode
```

The main test file `taogate-lexicon.test.ts` is comprehensive (18,961 lines) — it tests the full governance lexicon.

When adding tests:
- Mirror the source file path under `server/__tests__/`
- Test public APIs via subsystem `index.ts`, not internal files
- Governance invariants (BLOCK conditions) must always have test coverage

---

## Code Conventions

### Language
- Comments and variable names are in **Dutch** throughout the codebase
- Identifier style: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants
- Subsystem names use classical/mythological references (Cerberus, Barbatos, Hypatia, Valkyrie, Dymphna, Phronesis, etc.)

### TypeScript
- Strict mode enforced — no `any` types
- Path aliases: `@/` (client src), `@shared/` (shared/), `@assets/` (assets)
- All public APIs typed with explicit return types
- Use Zod schemas (from `shared/schema.ts`) for runtime validation at boundaries

### Error Handling
- No silent failures — type-driven error handling
- Only validate at system boundaries (HTTP input, external APIs)
- Internal layer calls trust their inputs (validated at entry point)

### Imports
- Only import from subsystem `index.ts` files (ESLint enforced)
- Respect the layer dependency order — never import upward
- Group imports: external packages → internal subsystems → shared → types

---

## Vector Legitimacy Formula

```
S = √(m² + i² + l²) / √3

where:
  m = mandate score     (0–1)
  i = integrity score   (0–1)
  l = load score        (0–1)
```

Stability thresholds by sector:
- Healthcare: 0.8
- Policy: 0.7
- Infrastructure: 0.6

---

## Audit Chain

- WORM append-only via S3 Object Lock (COMPLIANCE mode, 7-year retention)
- Each entry hash-chained to previous (tamper-evident)
- Fire-and-forget: audit writes do **not** block API responses
- Graceful fallback to PostgreSQL-only if `WORM_S3_BUCKET` is not set

---

## Adding New Features — Checklist

1. Identify which layer owns the change (consult `ARCHITECTURE.md`)
2. Add or modify only within that layer; expose via `index.ts`
3. Do not import upward in the layer hierarchy
4. If adding a new BLOCK condition, update the invariants list above and add a test
5. Governance-relevant changes must produce audit entries via `server/audit/`
6. Run `npm run check` (TypeScript) and `npm run test` before committing
7. If modifying the DB schema, update `shared/schema.ts` and run `npm run db:push`

---

## Key Files Reference

| File | What it does |
|------|-------------|
| `ARCHITECTURE.md` | Canonical dependency diagram, public APIs, TaoGate invariants |
| `replit.md` | Full ORFHEUSS Editio IV specification — authoritative spec |
| `shared/schema.ts` | Database schema + Zod types (single source of truth for data shapes) |
| `server/routes.ts` | All HTTP endpoints (864 lines) |
| `server/gateSystem.ts` | Gate decision logic & escalation routing |
| `server/storage.ts` | Database abstraction (Drizzle ORM queries) |
| `server/index.ts` | App bootstrap: middleware, DB, WORM chain, TapeDeck init |
| `.eslintrc.json` | Import boundary rules — do not relax without architectural review |
