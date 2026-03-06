# PRSYS TaoGate v10

Deterministic governance gate for AI decision systems.

Part of the ORFHEUSS constitutional architecture.

System stack:

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
Sandbox Execution
↓
Audit Ledger
```

Principle:

```
AI proposes
Human disposes
Audit remembers
```

---

## TaoGate Governance Kernel — Quick Demo

Deze demo laat in &lt; 5 minuten zien hoe de governance‑kernel werkt:
zelfdiagnose, HDS + Valkyries, en beslisprioriteit.

### 1. Systeemcheck (zelfdiagnostiek)

```bash
python -m tao_gate.system_check
```

Voert 17 onafhankelijke checks uit over alle governance-lagen
(GateParams, instabiliteit, GDPR, Cerberus, Barbatos, O36, SI/TI,
DYMPHNA, INUIT, HOLD-drempel, Valkyries, explain_decision).
Geeft `Overall: OK` als alle checks slagen.

### 2. HDS + Valkyries

```bash
python -m tao_gate.demo
```

Toont het volledige Hybrid Dynamical System (PASS / HOLD / BLOCK)
samen met de Valkyrie user-exposure firewall:

| Scenario | HDS | V_INUIT | V_UX | Gebruiker ziet |
|---|---|---|---|---|
| Gezonde toestand | PASS | OK | OK | **PASS** |
| Instabiliteit V ≥ drempel | HOLD | — | — | **HOLD** |
| Dark patterns gedetecteerd | PASS | OK | FAIL | **HOLD** |
| INUIT Siku=0 | PASS→HOLD | — | — | **HOLD** |
| TI-constraint geschonden | BLOCK | OK | OK | **BLOCK** |

### 3. Beslisprioriteit

De kernel dwingt de volgende volgorde af (hogere prioriteit wint):

1. **GDPR STOP** — overstijgt alle andere signalen
2. **Cerberus** — `legitimacy_ok=False` forceert BLOCK
3. **Barbatos** — `|Delta_ext| > √(V_max/α)` forceert BLOCK
4. **O36** — `omega > tau − sigma_ext` forceert BLOCK
5. **SI/TI** — `TI < TI_min` forceert BLOCK
6. **DYMPHNA** — `D_load > D_cap_eff` forceert BLOCK
7. **HOLD-drempel** — `V(x) ≥ V_hold_ratio × V_max` → HOLD
8. **INUIT** — `Siku=0` vernauwt PASS → HOLD
9. **PASS** — alle constraints voldaan

De complete demo (stap 2 + 3 samen) is te starten met:

```bash
python -m tao_gate.demo
```
