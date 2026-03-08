# server/fsm — Cerberus Fail-Safe

## Garantie
gateOrchestrator NOOIT rejecten. Elke interne fout → BLOCK (orchestratorBlockResult()).
Callers mogen de gate nooit via een exception kunnen omzeilen.

## Foutafhandeling
- Machine error state → BLOCK (layer: SYSTEM, pressure: CRITICAL)
- Missing result → BLOCK
- Timeout (A10) → BLOCK
- Alle throw-paden in gateOrchestrator.ts moeten resolve(BLOCK) zijn, nooit reject()

## XState v5 toestandsmachine (gateMachine.ts)
idle → evaluating → blocked | passed | escalated_human | escalated_regulatory
WASM sandbox-evaluatie. Elke sandbox-fout → BLOCK-fallback.

## Wat NOOIT mag
- catch(e) { throw e } — altijd omzetten naar BLOCK-resolve
- Promise.reject() vanuit orchestratorBlockResult()
- De BLOCK-fallback conditioneel maken op fouttype
