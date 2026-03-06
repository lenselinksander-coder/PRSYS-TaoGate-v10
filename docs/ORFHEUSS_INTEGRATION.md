# ORFHEUSS Integration Specification

PRSYS-TaoGate v10 operates as the decision engine within the ORFHEUSS constitutional stack.

The system layers are defined as:

```
ORFHEUSS Canon
↓
PRSYS Architecture
↓
TRST Runtime
↓
GLE Validation
↓
TaoGate v10
↓
Sandbox
↓
Execution
↓
Audit
```

Important constraint:

TaoGate v10 datasets and scope definitions remain immutable.
They represent the epistemic classification layer of the system.

The constitutional layers above TaoGate provide:

- legitimacy validation
- human authority enforcement
- runtime determinism
- audit traceability

but do not modify the scope engine.

This separation ensures:

```
Generation ≠ Legitimacy ≠ Execution
```

---

## Hybrid Dynamical System (HDS) Model

ORFHEUSS operates as an HDS with three discrete modes and a continuous state vector.

### Discrete modes

| Mode  | Meaning                                                         |
|-------|-----------------------------------------------------------------|
| PASS  | All constraints satisfied; execution may proceed.               |
| HOLD  | Instability approaching V_max, or sensor layer prevents PASS.   |
| BLOCK | One or more hard constraints violated; execution unconditionally stopped. |

Supervisory logic may only **tighten** decisions (PASS → HOLD/BLOCK). It may never relax them.

### Continuous state vector

```
x = (Delta_ext, sigma_ext, omega, tau, TI, D_load, D_cap_eff)
```

| Field       | Component | Description                                           |
|-------------|-----------|-------------------------------------------------------|
| Delta_ext   | Barbatos  | Reality drift / external pressure signal              |
| sigma_ext   | —         | External uncertainty / noise spread                   |
| omega       | O36       | Decision velocity / momentary human load              |
| tau         | SI        | Human carrying capacity (mandate horizon)             |
| TI          | SI/TI     | Temporal integrity index                              |
| D_load      | DYMPHNA   | Cumulative load D_l(t) = Σ (load × duration)         |
| D_cap_eff   | DYMPHNA   | Effective capacity D_k^e                              |

### Instability function

```
V(x) = α · Delta_ext² + β · sigma_ext² + γ · omega²
```

The **safety region** S = { x | V(x) ≤ V_max } is intended to be forward-invariant under TaoGate supervision.

---

## TaoGate Decision Logic

TaoGate evaluates the following checks **in priority order**. The first failing check determines the output mode.

### Hard constraints → BLOCK

| Check   | Condition                                     | Layer         |
|---------|-----------------------------------------------|---------------|
| GDPR    | `gdpr_result.decision == STOP`                | PrivacyGate   |
| Cerberus| `legitimacy_ok == False`                      | Cerberus      |
| Barbatos| `|Delta_ext| > sqrt(V_max / alpha)`           | Barbatos      |
| O36     | `omega > tau − sigma_ext`                     | O36           |
| SI/TI   | `TI < TI_min`                                 | TI-GATE       |
| DYMPHNA | `D_load > D_cap_eff`                          | DYMPHNA       |

If all hard constraints pass:

- **HOLD** — if V(x) ≥ V_hold_ratio × V_max (instability approaching safety boundary).
- **HOLD** — if INUIT signals Siku = 0 (pre-reflexive context sensor prevents PASS).
- **PASS** — otherwise.

---

## Sensor Layers

### GDPR / PrivacyGate

Implemented in `tao_gate/gdpr_bridge.py`. Wraps `server/argos.py::PrivacyGate`.

- Returns `DecisionResult` with `decision ∈ {PASS, STOP}`.
- STOP is a **hard override**: no other layer may produce PASS when GDPR signals STOP.
- Any exception raised by PrivacyGate is treated as STOP (fail-safe).

### Cerberus

External legitimacy signal (`legitimacy_ok: bool`). Validates:

- Agent mandate (authority to act)
- Temporality (action within permitted time window)
- Reversibility (action can be undone if needed)

### Barbatos

Provides the `Delta_ext` (reality drift) component of the state. TaoGate enforces |Delta_ext| ≤ sqrt(V_max / α).

### O36

Enforces human carrying capacity: `omega ≤ max(0, tau − sigma_ext)`.

### SI/TI

Temporal stability gate: `TI ≥ TI_min`. Prevents decisions when the temporal integrity buffer is too low.

### INUIT · BIOLOGY

Pre-reflexive context sensor. Implemented in `tao_gate/inuit.py`.

```
Siku ∈ {0, 1}
```

- **Siku = 0** — insufficient relational/cultural/biological carrying capacity. TaoGate must not issue PASS; any would-be PASS is tightened to HOLD.
- **Siku = 1** — sufficient carrying capacity; normal TaoGate logic applies.

INUIT has **no decision power** (Macht(INUIT) = 0). It can only tighten, never block outright. Hard constraints (GDPR, DYMPHNA, etc.) operate independently of INUIT.

Sub-sensors evaluated by `inuit_context_check(context)`:

| Key                    | Meaning                                          |
|------------------------|--------------------------------------------------|
| `siku`                 | Direct override (0 or 1)                         |
| `relational_capacity_ok` | Social/relational network can absorb a PASS    |
| `cultural_context_ok`  | No cultural moratorium or governance protocol    |
| `biology_signal_ok`    | Human actor has sufficient physiological capacity |

### DYMPHNA

Cumulative load and damage sensor. Implemented in `tao_gate/dymphna.py`.

```
D_l(t) = Σ (load_i × duration_i)
D_l > D_k^e  ⟹  dysregulation — BLOCK required
```

DYMPHNA enforces a **hard constraint** on long-term load, complementing SI (momentary) and O36 (velocity). When `state.D_load > state.D_cap_eff`, the supervisor emits BLOCK unconditionally. Only human remediation (reducing D_load or increasing D_cap_eff) can restore PASS eligibility.

The `DymphnaSignal` is auto-derived from `state.D_load` and `state.D_cap_eff` when not explicitly provided. Default state values (`D_load=0`, `D_cap_eff=∞`) are always safe (not overloaded).

---

## Governance Invariants

1. **GDPR STOP → BLOCK** — unconditional, overrides all other signals.
2. **Monotone safety** — tao_gate_decide is monotone: BLOCK for a state implies BLOCK for any state with equal or higher instability / fewer satisfied constraints.
3. **No relaxation** — supervisory logic (INUIT, V(x) threshold) can tighten PASS → HOLD; it never relaxes HOLD → PASS or BLOCK → HOLD/PASS.
4. **Siku ∩ Decision = ∅** — INUIT is a sensor only; it cannot override hard constraints.
5. **DYMPHNA is hard** — D_l > D_k^e always produces BLOCK, regardless of INUIT or instability.

