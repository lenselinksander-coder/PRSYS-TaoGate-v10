# System Architecture

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
↓
SANDBOX EXECUTION
↓
EXECUTION
↓
AUDIT
```

Formal composition:

```
E = Audit(Sandbox(TaoGate(GLE(Generatio(I)))))
```
