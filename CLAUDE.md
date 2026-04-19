# CLAUDE.md — PRSYS TaoGate v10 / ORFHEUSS

Referentiegids voor Claude Code agents die op deze codebase werken.

## Projectidentiteit

**ORFHEUSS** is een universele governance console. Organisaties classificeren, escaleren en blokkeren intents via configureerbare scopes en gate-profielen.
Intern draait **PRSYS** (Paontologisch Resonantie Systeem) — ontologisch model voor organisatiebewegingen.
De taal in de UI is **Nederlands**.

Git branch voor actieve ontwikkeling: `claude/wasm-audit-security-y7nyz`

---

## Commando's

```bash
npm run dev        # start server + client (Vite HMR)
npm run check      # TypeScript typecheck — moet altijd 0 errors geven
npm run build      # production build
npm run db:push    # schema naar DB pushen (drizzle-kit push, geen migrations)
```

---

## Architectuur

### Frontend
- **React 18** + TypeScript + React Router DOM v7
- **Tailwind CSS v4** met `@theme inline` CSS-variabelen
- **Huisstijl**: Retro 80s × Matrix — matrix groen (`#00ff41`) als primary, neon oranje (`#ff6600`) als accent, JetBrains Mono, `border-radius: 0`, CRT scanlines overlay
- **Componenten**: shadcn/ui (new-york), Radix UI, Lucide React
- **Build**: Vite met path aliases (`@/` → `client/src/`, `@shared/` → `shared/`)

Kerncomponenten:
- `client/src/components/Layout.tsx` — MatrixRain achtergrond + cyberpunk header
- `client/src/components/MatrixRain.tsx` — Canvas falling-katakana animatie (85% groen / 15% oranje)
- `client/src/index.css` — Volledig theme: neon utilities (`.neon-text`, `.neon-border`, `.neon-orange`, `.neon-red`), CRT body::after, vignette

### Backend
- **Node.js + Express 5**, TypeScript via `tsx`
- **REST API** onder `/api/` prefix
- **Gate pipeline**: intent → XState FSM → QuickJS WASM sandbox → scope classificatie → OLYMPIA regel-resolutie → intent log

### Database
- **PostgreSQL** via Drizzle ORM + `drizzle-zod`
- Schema: `shared/schema.ts`
- Geen handmatige migrations — gebruik `npm run db:push`

Tabellen:
| Tabel | Relevante kolommen |
|---|---|
| `organizations` | id, name, slug, sector, gate_profile |
| `scopes` | id, name, status, org_id, categories (JSONB), documents (JSONB), rules (JSONB), ingest_meta (JSONB), **scope_meta (JSONB)**, is_default |
| `observations` | id, text, status, category, escalation, context, scope_id |
| `connectors` | id, org_id, name, type, api_key, status |
| `intents` | id, org_id, scope_id, connector_id, input_text, decision, category, layer, pressure, processing_ms |

---

## Gate Pipeline (Feature 1+3: WASM + FSM)

### XState FSM (`server/fsm/`)
- `gateTypes.ts` — discriminated union context types; `PreflightOk` branded type (uniek symbool)
- `gateMachine.ts` — XState v5 machine: `idle → evaluating → {passed|passed_transparent|blocked|escalated_human|escalated_regulatory}`
- `gateOrchestrator.ts` — `orchestrateGate(input, profile)` — async wrapper, geeft `GateResult` terug

De machine gebruikt `fromPromise` actor (`evaluateGate`) die `runGateWasm` aanroept. Bij elke fout → `blocked` (fail-safe).

### QuickJS WASM Sandbox (`server/wasm/`)
- `bundledGates.ts` — alle gate-logica als zelfstandige JS-string (`GATE_BUNDLE_SOURCE`), geen imports of I/O
- `gateRunner.ts` — `runGateWasm(input, profile)`:
  - QuickJS singleton via `getQuickJS()`
  - Verse runtime + context per request
  - Fuel-based interrupt: `FUEL_LIMIT = 100` polls → ~1 miljoen bytecode-instructies max
  - Globals `__input__` en `__profile__` geïnjecteerd; hermetic (geen fs, geen fetch, geen require)
  - `finally`: altijd `vm.dispose()` + `runtime.dispose()`
  - Bij timeout of fout → `BLOCK` als fail-safe

De gate in `routes.ts` gebruikt **altijd** `orchestrateGate()` (niet `runGate()` direct).

---

## WORM Audit Chain (Feature 2)

`server/audit/wormChain.ts`:
- SHA-256 hash-chaining: elke entry bevat `prevHash` + eigen `hash`
- Schrijft naar S3 met **Object Lock COMPLIANCE mode**, 7 jaar retentie
- `initWormChain()` — seeds prevHash van `audit/chain-tip.json` uit S3 bij startup
- `appendWormEntry()` — fire-and-forget (blokkeert nooit API response)
- PII opgeslagen als `SHA-256(inputText)` — geen plaintext
- No-op als `WORM_S3_BUCKET` niet is ingesteld

Environment variabelen:
```env
WORM_S3_BUCKET=        # verplicht voor WORM; afwezig = uitgeschakeld
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## Scope Schema

### scopeMetaSchema (`shared/schema.ts`)
Operationele TaoGate-parameters — opgeslagen als `scope_meta` JSONB kolom:
```ts
{
  tiMin?: number          // TI-drempel (0–1)
  sectorThreshold?: number // S-drempel Vector Engine (0–1)
  tiWeights?: { alpha, beta, gamma }  // α/β/γ gewichten TI-berekening
  gateProfile?: string    // sector gate-profiel override
}
```

### Import pipeline (`POST /api/import/json`)
Accepteert **twee formaten** (worden automatisch gemerged):

**CoVe / TaoGate v10 root-niveau format** (aanbevolen):
```json
{
  "orgId": "...", "name": "...",
  "categories": [...], "rules": [...], "documents": [...],
  "scope_meta": { "ti_min": 0.7, "sector_threshold": 0.8, "gate_profile": "FINANCIAL" }
}
```

**Legacy nested format** (ook geaccepteerd):
```json
{ "orgId": "...", "name": "...", "data": { "categories": [...], "rules": [...] } }
```

Merge-logica: root-niveau wint als niet-leeg, anders fallback naar `data.*`.
`scope_meta` snake_case → camelCase mapping in de route handler.

---

## Seeding (`server/seed.ts`)

Twee seed-functies, beide idempotent (controleren op bestaande data):

| Functie | Scope | Org |
|---|---|---|
| `seedDefaultScopes()` | LEYEN (EU AI Act + IC klinisch) | ORFHEUSS Demo (healthcare, CLINICAL) |
| `seedIndiaScope()` | TaoGate Goes India — Vehicle Insurance Fraud Triage v1.0 | TaoGate India (insurance, FRAUD_TRIAGE) |

India scope bevat: 6 categorieën (IIB cautionregister, duplicate claim, soft fraud, auto-approve, complex, IRDAI reporting), 3 documenten (visiedocument, mandaat, protocol), 6 IRDAI/IIB-regels.

Volgorde in `index.ts`:
```ts
await seedDefaultScopes();
await seedIndiaScope();
await initWormChain();
```

---

## API Endpoints

### Core
- `POST /api/classify` — classificeer intent (direct, geen FSM)
- `POST /api/gateway/classify` — universele gateway met API key auth (`x-api-key` header) — gebruikt FSM + WASM
- `POST /api/olympia/resolve` — regel-conflict resolutie
- `GET /api/system/info` — systeem overzicht

### Scopes
- `GET /api/scopes` — lijst (optioneel `?orgId=`)
- `POST /api/scopes` — maak scope aan
- `PUT /api/scopes/:id` — update scope
- `POST /api/scopes/:id/preflight` — preflight check
- `POST /api/scopes/:id/lock` — vergrendel scope

### Import
- `POST /api/import/json` — JSON import (CoVe v10 + legacy formaat)
- `POST /api/import/csv` — CSV import met kolom-mapping

### Research (Perplexity)
- `POST /api/ingest/research` — onderzoek via Perplexity
- `POST /api/ingest/extract` — extraheer scope uit onderzoek
- `POST /api/ingest/draft` — maak draft scope van onderzoek
- `POST /api/ingest/manual-draft` — handmatig draft aanmaken

### Organisaties / Connectors / Intents
Standaard CRUD + `GET /api/intents/stats`

---

## Gate Profielen
- `CLINICAL` — blokkeert medicatie-orders, procedures, imperatieven
- `GENERAL` — blokkeert destructieve imperatieven
- `FINANCIAL` — blokkeert fraude/witwassen, escaleert KYC/AML
- `LEGAL` — blokkeert criminele context
- `EDUCATIONAL` — escaleert toetsing/assessment
- `CUSTOM` — standaard algemeen filter, uitbreidbaar
- `FRAUD_TRIAGE` — vehicle insurance fraud (India, IRDAI/IIB)

---

## Bekende Patronen & Valkuilen

1. **Gate altijd via FSM** — gebruik `orchestrateGate()` uit `server/fsm/gateOrchestrator.ts`, nooit `runGate()` direct in nieuwe routes.

2. **WASM fuel-limit** — `FUEL_LIMIT = 100` polls ≈ 1M instructies. Bij aanpassen gate-logica: test of het binnen het budget past.

3. **Import formaat** — `POST /api/import/json` accepteert zowel root-niveau als nested `data.*`. Root-niveau wint als non-empty. Zend altijd `scope_meta` mee als TaoGate-parameters relevant zijn.

4. **db:push na schema-wijziging** — er zijn geen migration-files; `npm run db:push` synchroniseert het schema direct met de DB.

5. **Seed idempotentie** — seed-functies controleren op bestaande org/scope via slug of naam. Niet dubbel aanroepen zonder check.

6. **TypeScript check** — voer altijd `npm run check` uit vóór commit. Nul errors is de norm.

7. **WORM no-op** — als `WORM_S3_BUCKET` niet is ingesteld, doet `appendWormEntry()` niets. Geen error, geen log. Normaal gedrag voor lokale development.
