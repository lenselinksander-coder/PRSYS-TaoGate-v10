# server/pipeline — Beslislattice & Escalatie

## Beslisrangorde (types.ts · DECISION_RANK)
BLOCK=4 > ESCALATE_REGULATORY=3 > ESCALATE_HUMAN=2 > PASS_WITH_TRANSPARENCY=1 > PASS=0

latticeMax() kiest altijd de meest restrictieve beslissing. Nooit verzachten.
D_final = max(D_gate, D_scope, D_runtime)

## Pipelinevolgorde (routes.ts)
1. EU Legal Gate (euLegalGate) — altijd EERST, voor elke tape-lookup
2. Tape lookup (tapeId of scopeId)
3. Valkyrie exposure guard — blokkeert exposure als D ≥ ESCALATE_HUMAN
4. executeTaoGate() — D_final = max(D_gate, D_scope, D_runtime)
4b. CoVe (q4b VERIFY) — CV = V(G)⊥V(L)⊥V(E)
    V(G)=Hypatia · V(L)=EuLegalGate · V(E)=Arachne (evaluators ≠ producenten, I6)
    D_final_verified = latticeMax(D_final, CV) — nooit verzachten
    Falen van één pad = ESCALATE_HUMAN, nooit stilte
5. Castra (Hypatia + Phronesis)
6. Vector Legitimacy Engine
7. Audit (Tabularium)

## Kritische regels
- `ESCALATE` (alias) = `ESCALATE_HUMAN` — normaliseDecision() converteert dit
- EU BLOCK in stap 1 is terminaal — stappen 2–7 worden nooit bereikt
- BLOCK van hogere canon-laag (EU > NATIONAL > REGIONAL > MUNICIPAL)
  kan nooit worden overschreven door lagere laag
- Olympia pressure = Infinity als een BLOCK-regel actief is
- escalation-veld ≠ status-veld — OversightBanner gebruikt effectiveDecision = escalation ?? status

## Wat NOOIT mag
- D_final verzachten na latticeMax()
- EU gate overslaan of uitstellen
- scopeDecision negeren in cerberusEnforce()
