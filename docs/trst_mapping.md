# TRST Runtime Mapping

The TaoGate runtime corresponds to the TRST state machine.

States:

```
q0  INIT
q1  MANDATE_CHECK
q2  PRE_GATE
q3  EXECUTE
q4  POST_GATE
q5  REPORT
```

Terminal states:

```
q6  ESCALATE
q7  BLOCK
q8  CLOSE
```

Invariant:

```
No stage may be bypassed.
```
