# Architecture — PRSYS TaoGate v10

## Dependency Direction (strict)

```
client → server/routes → server/pipeline → server/{fsm, storage, vector_engine, trace} → server/core
  ↑                                                    ↓
  └────────────────── shared types (shared/) ──────────┘
```

### Layer Definitions

| Layer | Path | Public API via |
|---|---|---|
| Client UI | `client/` | n.v.t. |
| Routes (HTTP handlers) | `server/routes.ts` | direct export |
| Pipeline (orchestratie) | `server/pipeline/index.ts` | `runPipeline`, `classifyWithScope`, `resolveOlympiaRules`, `gatewayClassify` |
| FSM (gate state machine) | `server/fsm/index.ts` | `orchestrateGate`, FSM-state types |
| Vector Engine | `server/vector_engine/index.ts` | `evaluateVector`, `GateVector`, `VectorDecision` |
| Trace (Hypatia + Phronesis) | `server/trace/index.ts` | `hypatiaRisk`, `classifyDpiaLevel`, `phronesisCapacity` |
| Middleware (Testudo) | `server/middleware/index.ts` | `testudoShield`, `testudoContentLengthGuard`, `testudoStatus` |
| Storage (database) | `server/storage.ts` | `IStorage`, `storage` singleton |
| Core (TRST + TapeDeck) | `server/core/index.ts` | `bootstrapTapeDeck`, `bootstrapTRST`, `executeTaoGate` |
| Shared types | `shared/` | schema types, Zod validators |

## Dependency Rules

- **client** mag NIET rechtstreeks importeren uit `server/core`, `server/pipeline` of andere server-interna.
- **server/routes** importeert uit `server/pipeline`, `server/core`, `server/trace`, `server/middleware` — altijd via de publieke index.
- **server/pipeline** mag `server/fsm`, `server/trace`, `server/vector_engine` en `server/storage` gebruiken; niet `server/routes`.
- **server/fsm** mag `server/gateSystem` gebruiken; niet `server/pipeline` of hoger.
- **server/trace** en **server/vector_engine** zijn bladlagen: zij importeren niets boven zichzelf.
- **server/core** is de onderste server-laag. Core-modules importeren niets uit `server/pipeline`, `server/routes` of `server/fsm`.
- **shared/** types mogen overal worden gebruikt.

## Import Enforcement

De `.eslintrc.json` in de root bevat een `no-restricted-imports` regel die directe imports uit interne bestanden blokkeert:

```json
"no-restricted-imports": ["error", {
  "patterns": [
    { "group": ["server/*/!(index)", "server/*/*/!(index)"],
      "message": "Importeer alleen via de publieke index van een subsysteem." }
  ]
}]
```

Dit betekent:
- ✅ `import { hypatiaRisk } from "../trace"` — via de publieke index
- ❌ `import { hypatiaRisk } from "../trace/hypatia"` — directe import van intern bestand

> **Uitzondering:** De `index.ts`-bestanden zelf en test-bestanden zijn vrijgesteld van deze regel.
>
> Deze grens wordt ook meegenomen in `python -m tao_gate.system_check`, samen met checks op de aanwezigheid van de architectuurdocumentatie en de publieke `index.ts`-bestanden per subsysteem.

## Public API Index Files per Subsysteem

Elk subsysteem definieert zijn openbare interface via `index.ts`:

### `server/vector_engine/index.ts`
- **Public:** `evaluateVector`, types `GateVector`, `VectorDecision`, `VectorEvaluation`, `STABILITY_NO_GO`, `STABILITY_HOLD`
- **Private:** `vector.ts` (berekeningslogica), `stability.ts` (drempelwaarden intern)

### `server/pipeline/index.ts`
- **Public:** `runPipeline`, `classifyWithScope`, `resolveOlympiaRules`, `gatewayClassify`, `classifyIntent`, `preflightCheck`, `cerberusEnforce`
- **Private:** `argos.ts`, `arachne.ts`, `logos.ts`, `olympia.ts`, `cerberus`, `castra.ts`, `taogate.ts`, `valkyrie.ts`, `audit.ts`, `clinical.ts`

### `server/fsm/index.ts`
- **Public:** `orchestrateGate`, FSM state types (`GateStateContext`, `GateMachineContext`, etc.)
- **Private:** `gateMachine.ts` (XState machine definitie), interne state guards

### `server/middleware/index.ts`
- **Public:** `testudoShield`, `testudoContentLengthGuard`, `testudoStatus`
- **Private:** rate-bucket logica, pattern-matching, interne helpers

### `server/trace/index.ts`
- **Public:** `hypatiaRisk`, `classifyDpiaLevel`, `DPIA_LEVEL_LABELS`, `phronesisCapacity`, types
- **Private:** `traceRunner.ts` (interne pipeline), drempelconstanten

### `server/core/index.ts`
- **Public:** `bootstrapTapeDeck`, `getTapeDeck`, `bootstrapTRST`, `getTRSTConfig`, `executeTaoGate`, `EU_BASELINE_SCOPE`, `runEuLegalGate`
- **Private:** `physics.ts` (runtime metrics), interne TRST state

### `server/storage.ts` *(flat file, toekomstige migratie naar `server/storage/index.ts`)*
- **Public:** `IStorage` interface, `storage` singleton
- **Private:** ORM-query details (Drizzle)

## TaoGate Governance Invariants

| Constraint | Effect |
|---|---|
| GDPR STOP | → BLOCK (absoluut) |
| Cerberus legitimacy = false | → BLOCK |
| Barbatos `\|Δ_ext\| > √(V_max/α)` | → BLOCK |
| O36 `ω > capacity` | → BLOCK |
| SI/TI: `TI < TI_min` | → BLOCK (absoluut) |
| DYMPHNA: `D_load > D_cap_eff` | → BLOCK |
| INUIT: `Siku = 0` | PASS → HOLD (zacht) |

Zie ook: `docs/system_architecture.md`, `docs/trst_mapping.md`, `docs/ORFHEUSS_INTEGRATION.md`
