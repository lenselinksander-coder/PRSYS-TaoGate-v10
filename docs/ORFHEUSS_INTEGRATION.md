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
