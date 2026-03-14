# ORFHEUSS | Governance OS

## Overview

ORFHEUSS is a universal governance operating system designed to classify, escalate, and block intents based on configurable rules and datasets for any organization. Built on the TaoGate Lexicon Editio IV (TRST Layer 0), it implements a constitutionally anchored decision pipeline where every request must pass through the gate before execution. The system incorporates PRSYS (Paontologisch Resonantie Systeem) for secure tape-based runtime execution.

Organizations register with specific sector and gate profiles (Clinical, Financial, Legal, Educational, General, Custom), load custom Scopes (datasets of categories, rules, and documents), and integrate external AI agents. The Universal Gateway applies gate and scope resolutions to all incoming intents, with all decisions recorded in an Intent Audit Trail.

### TaoGate — Five Sources (Editio IV)
1. **Tao (Taoism)**: Yin (Mens/Veld) × Yang (AI/Vorm) = coherence event. Gate opens only when coherence is present.
2. **Gate (IBM System/360, 1964)**: Binary decision point — signal meets threshold or is blocked.
3. **Flight Operations (NASA)**: Formal go/no-go gate review. All tapes must be green.
4. **CoVe (Chain of Verification, AM-III-001)**: No layer verifies its own output. G ≠ L ≠ E enforced at verification level.
5. **Existentie-architectuur (AM-IV-001)**: BLOCK is not a decision — it is the mathematical outcome of a missing component. ∃x = 0 ⇒ Output = 0.

### Canonical Axioms (TGA)
- **TGA∞ (Prefix)**: ∃x = 0 ⇒ Output = 0. Zero Dominance. BLOCK is mathematics, not policy.
- **TGA1**: G ≠ L ≠ E — Generation is not Legitimacy. Legitimacy is not Execution.
- **TGA2**: BLOCK > everything. One BLOCK in one tape blocks the whole pipeline.
- **TGA3**: TI < TI_min → BLOCK. Below existence threshold: component does not exist.
- **TGA4**: ¬ Silence ⇒ BLOCK. In doubt: escalate to human. Never silently pass.
- **TGA5**: ¬ Audit ⇒ ¬ L. What is not recorded is not legitimate.
- **TGA6**: Runtime ≠ DB. Runtime may never decide directly from database.
- **TGA7**: Pre-execution hash mandatory. Deviation stops execution.
- **TGA8**: Δ ∧ Φ ∧ Ψ required. Every gate passage requires full Decision Context.
- **TGA9**: Human > System. Phronesis is not computer science.
- **TGA10**: Timeout → HARD_BLOCK. Bounded execution.
- **TGA11**: CoVe ⊥. No layer verifies its own output.

### Canonical Formulas
- **F-P1**: V = Δ ∧ Φ ∧ Ψ (Validity = Decision Context ∧ Mandate ∧ Purpose-boundedness)
- **F-P2**: SI = τ × ω (only when ∀x > 0, i.e. TI ≥ TI_min)
- **F-P3**: L = Mandate ∧ Temporality ∧ Revocability
- **F-P4**: ω ≤ f(τ − σ_ext) (velocity bounded by capacity minus external pressure)
- **F-P5**: TI-GATE: TI < TI_min ⇒ BLOCK; TI ≥ TI_min ⇒ calculate SI
- **F-P6**: CV = V(G) ⊥ V(L) ⊥ V(E) (CoVe integrity)
- **F-P7**: ∃x = 0 ⇒ Output = 0 / ∀x > 0 ⇒ Output = f(x) (Existence Law, AM-IV-001)

### TI (Transfer Integrity) — AM-II-001
TI = α·H + β·T + γ·S where H = hash integrity, T = temporal consistency, S = source integrity. α + β + γ = 1. Domain-specific weights: Zorg (0.5/0.3/0.2), Beleid (0.2/0.3/0.5), Infra (0.4/0.3/0.3).

### Invariants (I1–I6, not configurable)
- **I1**: Pre-execution hash — no tape executed without hash verification.
- **I2**: BLOCK always wins — one BLOCK in one tape blocks the whole. (∃x = 0 ⇒ Output = 0)
- **I3**: No silent pass — in doubt, escalate to human.
- **I4**: Audit logging — every decision with timestamp, tape-id, rule-id, chainhash. cove field mandatory.
- **I5**: Scope expansion — Runtime ≠ database. Database is authoring, not execution.
- **I6**: CoVe independence — no layer verifies its own output. Independent path, evaluator, trace.

### Decision Lattice
PASS < PASS_WITH_TRANSPARENCY < ESCALATE_HUMAN < ESCALATE_REGULATORY < BLOCK

### Architecture Order (Editio IV, constitutionally anchored)
1. ∃x = 0? → BLOCK (TI-gate, structure law)
2. ∀x > 0? → Calculate SI (quality measurement)
3. SI ≥ θ? → PASS / HOLD / ESCALATE
4. CV = 1? → Execution free
5. CV < 1? → ESCALATE_HUMAN
6. CV = 0? → BLOCK (terminal)

### Execution Law
E = Audit(Sandbox(CoVe(TaoGate(GLE(Generatio(I))))))

### Layer Order (Governance)
Hardware/OS < TRST < TGR < TaoGate < PRSYS < Interface. Lower layers cannot override higher layers. BLOCK is absolute and inherits upward.

### Role Purity (Five Layers)
- **Generative Layer**: Observes. Stochastic. No power.
- **Legitimacy Layer**: Validates. Deterministic. No generation.
- **Execution Layer**: Acts. Only after full validation.
- **Verification Layer (CoVe)**: Verifies. Orthogonal. No overlap.
- **Existence Layer**: Measures. ∃x = 0 ⇒ Output = 0. No override. (AM-IV-001)

### Ateliers (CoVe cross-verification)
- **Cerberus**: HARD_BLOCK / V(E) verification
- **Arachne**: ESCALATE / V(G) verification
- **Hypatia**: MANDATE_CHECK / V(L) verification
- **Logos**: STRUCTURAL / Architecture guardian
- **Hermes**: TRANSFER / Carrier without ownership

### Vector Engine
- S = √(m² + i² + l²) / √3 where m=mandate, i=integrity, l=load
- S ∈ [0,1]. S decides nothing — it records how firmly a decision stands.
- Sector thresholds: zorg 0.8, beleid 0.7, infra 0.6
- Legal gate: if legal_basis === false → BLOCK (absolute)

### Tape Architecture
- Tape 0: Legal foundation (national + EU) — absolute, no override
- Tape 1: Institutional rules — overridable by Tape 0
- Tape 2: Professional standards — overridable by Tape 0
- Tape 3: Financing and accountability (NZa, DBC) — overridable by Tape 0
- Tape 4: Sector standards — overridable by Tape 0
- Tape 5: Chain agreements (VSV, MDO, network protocol) — overridable by Tapes 0–2

## User Preferences

Preferred communication style: Simple, everyday language (Dutch).

## System Architecture

ORFHEUSS is built as a multi-tenant governance OS with a clear separation of concerns between its frontend, backend, and core governance pipeline.

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
- **Gate System**: A pluggable gate system (`server/gateSystem.ts`) allowing for different domain-specific profiles (clinical, financial, legal, educational, general, custom).
- **Build**: esbuild for server bundling.

### Core Pipeline (server/pipeline/)
The business logic is modularized into a pipeline service processing intents through the canonical state machine (q0–q8):

**State Machine (Editio IV)**:
- q0 INIT → q1 MANDATE_CHECK → q2 PRE_GATE (TI) → q3 EXECUTE (SI) → q4 POST_GATE → q4b VERIFY (CoVe) → q5 REPORT → q8 CLOSE
- q2 TI < TI_min → q7 BLOCK (existence failure)
- q4b CV < 1 → q6 ESCALATE; CV = 0 → q7 BLOCK
- q8 CLOSE bij fouten: VERBODEN

**Pipeline Modules**:
- **Argos**: Input detection and normalization (q0).
- **Arachne**: Syntax and intent-structure analysis + V(G) verification.
- **Logos**: Domain and keyword classification using scope data.
- **Olympia**: Jurisdictional rule resolution and Cerberus gate enforcement.
- **Castra**: Risk assessment — Hypatia (Impact × Probability + V(L) verification), Phronesis (SI = τ × ω).
- **Valkyrie**: Exposure guard — blocks unguarded exposure before TaoGate.
- **TaoGate**: Final decision lattice resolution (deterministic, rule-based).
- **CoVe**: Chain of Verification — CV = V(G) ⊥ V(L) ⊥ V(E) at state q4b.
- **Audit (Tabularium)**: Creation of audit records with mandatory cove and existence fields.
- **Clinical**: Specialized clinical evaluation (Implicit Pressure LLM evaluation).

**Pipeline Execution Order**: Argos → Arachne → Logos → Cerberus/OLYMPIA → Castra(Hypatia+Phronesis) → Vector → Valkyrie → TaoGate(+Sandbox+Hermes) → CoVe(q4b) → Tabularium

### PRSYS Tape Pipeline
Runtime execution is secure and immutable. Scopes, once locked, are compiled into signed JavaScript tapes.
- **Workflow**: Scopes → versioned `.js` tapes → cryptographically signed (SHA-256 + Ed25519) → loaded into TapeDeck.
- **PRSYS_INVARIANT (I5)**: `/api/gate` exclusively executes from verified tapes, never directly querying database.
- **Canon Layer Schema**: Tapes categorized into canonical layers with defined precedence.
- **Release Manifests**: Multi-tape coherence via versioned manifests preventing version drift.

### TRST/TGR Runtime Physics
Runtime physics for decision processing — metadata only, does not influence decision_hash (A6 intact).
- **τ (Draagkracht / Torque)**: Structural complexity of a decision.
- **ω (Besluit-velocity)**: System-level load / decision frequency.
- **TI (Transfer Integrity)**: Pre-gate existence check. TI = α·H + β·T + γ·S. TI < TI_min ⇒ BLOCK.
- **SI (Spanningsindex)**: SI = τ × ω. Only valid when TI ≥ TI_min (∀x > 0).
- **State Machine**: q0–q8 with q4b VERIFY (CoVe).

### Key Design Decisions
- **Governance OS Architecture**: Universal, pluggable, multi-tenant governance operating system.
- **Five Sources**: Tao, IBM Gate, Flight Ops, CoVe, Existence — constitutionally anchored.
- **Existence-first**: TI check before SI calculation (AM-IV-001). BLOCK is structure, not policy.
- **CoVe Independence (I6)**: No layer verifies its own output. Cross-verification mandatory.
- **API-first Gateway**: External AI agent integration through API key authentication.
- **Multi-tenant Architecture**: Isolates scopes and connectors per organization.
- **Secure Tape Pipeline**: Signed, immutable classification logic at runtime (I5).
- **Comprehensive Audit Trail**: All decisions logged with cove-trace and existence-field (I4).
- **Deterministic TaoGate**: Rule-based decision lattice — no LLM in the decision path.

### Seed Demo Organizations & Scopes
- **Erasmus MC** (healthcare, CLINICAL): Erasmus scope with clinical categories
- **Kraaijenvanger** (other, CUSTOM): Architecture firm
- **SVB** (finance, FINANCIAL): Finance scope with fraud detection, credit scoring, AML/Wwft compliance
- **LEYEN** (no org, default): EU AI Act baseline scope — canonical categories A1–A7

## External Dependencies

- **Database**: PostgreSQL (for all persistent data storage).
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Frontend Libraries**: `react`, `react-router-dom`, `lucide-react`, `tailwindcss`, `shadcn/ui`.
- **Backend Libraries**: `express`, `pg`, `zod`.
- **AI Integration**: `openai` (used for Perplexity integration).

## Amendement Register
- **AM-II-001**: TI defined as composite quantity (TI = α·H + β·T + γ·S)
- **AM-II-002**: Typography correction in vector formula (1 → l)
- **AM-III-001**: CoVe — Chain of Verification — as fourth source and Invariant I6
- **AM-IV-001**: Existence Dominance Law — TGA∞ as prefix axiom, F-P7, fifth source