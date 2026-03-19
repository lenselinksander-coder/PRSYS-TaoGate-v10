# System Architecture

## Full Stack

```
INPUT
↓
GENERATIO
↓
SCOPE CLASSIFICATION (TaoGate v10 datasets)
↓
GLE VALIDATION
↓
TAOGATE DECISION
  ├─ GDPR / PrivacyGate       (hard: STOP → BLOCK)
  ├─ Cerberus                  (hard: legitimacy_ok=False → BLOCK)
  ├─ Barbatos                  (hard: |Delta_ext| > sqrt(V_max/α) → BLOCK)
  ├─ O36                       (hard: omega > tau − sigma_ext → BLOCK)
  ├─ SI/TI                     (hard: TI < TI_min → BLOCK)
  ├─ DYMPHNA                   (hard: D_load > D_cap_eff → BLOCK)
  ├─ V(x) threshold            (soft: V(x) ≥ V_hold_ratio × V_max → HOLD)
  └─ INUIT · BIOLOGY           (soft: Siku=0 tightens PASS → HOLD)
↓
VALKYRIE USER-EXPOSURE FIREWALL
  ├─ Valkyrie INUIT            (field access & timing guard)
  └─ Valkyrie UX               (ethics firewall: no dark patterns / A/B manipulation / coercion)
↓
SANDBOX EXECUTION
↓
EXECUTION
↓
AUDIT
```

Formal composition:

```
E = Audit(Sandbox(Valkyrie(TaoGate(GLE(Generatio(I))))))
```

---

## Discrete Modes

| Mode  | Meaning                                                                    |
|-------|----------------------------------------------------------------------------|
| PASS  | All constraints satisfied; execution may proceed to user exposure.         |
| HOLD  | Instability near V_max, or a sensor/Valkyrie layer prevents user exposure. |
| BLOCK | One or more hard constraints violated; execution unconditionally stopped.  |

Supervisory and Valkyrie logic may only **tighten** decisions. They may never relax HOLD → PASS or BLOCK → HOLD/PASS.

---

## TaoGate Decision Priority

```
Priority 1 (BLOCK)  — Hard constraints
  1a. GDPR STOP
  1b. Cerberus legitimacy_ok=False
  1c. Barbatos |Delta_ext| > sqrt(V_max/α)
  1d. O36 omega > tau − sigma_ext
  1e. SI/TI TI < TI_min
  1f. DYMPHNA D_load > D_cap_eff

Priority 2 (HOLD)   — Instability threshold
  V(x) ≥ V_hold_ratio × V_max

Priority 3 (HOLD)   — INUIT post-filter (soft tightening only)
  Siku = 0 → tighten PASS to HOLD

Priority 4 (PASS)   — All checks clear
```

---

## Valkyrie User-Exposure Firewall

Even when TaoGate emits PASS, user-facing exposure is still gated by two Valkyrie checks:

| Valkyrie     | Check                                        | Keys evaluated                                          |
|--------------|----------------------------------------------|---------------------------------------------------------|
| INUIT        | Field access & timing protection             | `field_access_ok`, `timing_ok`                          |
| UX           | Ethics firewall (no manipulation/coercion)   | `dark_patterns_absent`, `ab_testing_safe`, `no_coercion` |

Rule: **user exposure is only allowed if Mode=PASS ∧ V_INUIT=OK ∧ V_UX=OK**.

If either Valkyrie check returns FAIL for a PASS mode, the effective mode becomes HOLD. HOLD and BLOCK are never relaxed by the Valkyrie layer.

---

## Self-Diagnostic

The governance kernel can be validated at any time by running the system check:

```
python -m tao_gate.system_check
```

This executes 20 independent checks across all governance layers and reports overall health, including architecture-boundary checks for documentation, public subsystem indexes, and cross-subsystem imports. Exit code is 0 on success, 1 on failure.
