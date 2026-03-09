# server/pipeline — Beslislattice & Escalatie

## Beslisrangorde (types.ts · DECISION_RANK)
BLOCK=4 > ESCALATE_REGULATORY=3 > ESCALATE_HUMAN=2 > PASS_WITH_TRANSPARENCY=1 > PASS=0

latticeMax() kiest altijd de meest restrictieve beslissing. Nooit verzachten.
D_final = max(D_gate, D_scope, D_runtime)

## routes.ts /api/gate (tape-based, TRST)
1. EU Legal Gate (euLegalGate) — altijd EERST, terminaal bij Art. 5 treffer
2. Tape lookup (tapeId of scopeId)
3. executeTaoGate() via trst.ts — TRST axioma's + physics
NB: runPipeline() en classifyIntent() volgen een ander pad (zie onder)

## runPipeline() volgorde (pipeline/index.ts)
1.  Argos — lege invoer check → early return als EMPTY
2.  Arachne — structuur + imperatief-detectie
3.  Logos — domein-classificatie
4.  Cerberus (orchestrateGate) — gate-beslissing → D_gate
5.  Castra — Hypatia (risk) + Phronesis (capacity) → D_scope, D_runtime
6.  Vector Legitimacy Engine — D_vector → D_runtime_final
7.  Valkyrie — signaleert GUARDED/CLEARED (informatief; enforcement zit in TaoGate)
8.  TaoGate — D_final = max(D_gate, D_scope, D_runtime_final)
9.  CoVe q4b — D_final_verified = latticeMax(D_final, CV)
    CV = V(G)⊥V(L)⊥V(E) · I6: evaluators ≠ producenten
10. Audit (Tabularium)

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
