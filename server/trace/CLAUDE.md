# server/trace — Hypatia (Risico) & DPIA

## Hypatia beslisdrempels (HYPATIA_THRESHOLDS)
Risk = Impact × Probability  [0..1]
< 0.20 → PASS
< 0.40 → PASS_WITH_TRANSPARENCY
< 0.70 → ESCALATE_HUMAN
≥ 0.70 → BLOCK

## DPIA-niveaus AVG art. 35 (DPIA_THRESHOLDS) — onafhankelijk van gate-beslissing
< 0.10 → niveau 0 — Geen risico, geen DPIA nodig
< 0.20 → niveau 1 — Verwaarloosbaar
< 0.40 → niveau 2 — Laag, DPIA aanbevolen
< 0.60 → niveau 3 — Middel, DPIA vereist
< 0.80 → niveau 4 — Hoog, DPIA verplicht (AVG art. 35)
≥ 0.80 → niveau 5 — Kritisch, DPIA verplicht + DPO-overleg

## Regels
- DPIA-niveau is informatief — overschrijft gate-beslissing NIET
- classifyDpiaLevel() klampt input naar [0..1] — nooit raw waarden doorgeven
- Drempelwaarden zijn wettelijk verankerd — niet aanpassen zonder juridisch akkoord
- Phronesis (phronesis.ts): SI = τ × ω — geldig alleen binnen TI-envelop (A11)
