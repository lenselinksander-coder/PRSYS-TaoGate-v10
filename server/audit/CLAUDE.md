# server/audit — WORM Audit Chain

## Wat dit is
SHA-256 hash-chained audit log op S3 met COMPLIANCE-mode Object Lock.
Elke entry bevat de hash van de vorige. 7 jaar retentie. Tamper-evident.

## Invarianten (A8 · TRST)
- Entries zijn append-only. Nooit muteren, nooit verwijderen, nooit backfill.
- Elke entry bevat prev_hash — breek de keten = audit ongeldig.
- Fire-and-forget: appendWormEntry() vertraagt de API-response nooit.
- initWormChain() eenmalig bij serverstart — seed vanuit laatste S3-entry.

## Configuratie
WORM_S3_BUCKET  — S3 bucket met Object Lock (COMPLIANCE mode) — ontbreekt = feature stil uit
AWS_REGION      — default: eu-west-1

## Wat NOOIT mag
- Bestaande S3-entries overschrijven of verwijderen
- appendWormEntry() await-en in de request-handler (blocking)
- De hash-keten resetten of opnieuw seeden met fake entries
- seq-nummers aanpassen

## ⚠ MONITORING VEREIST — S3 write failure is silent by design

`appendWormEntry()` is fire-and-forget: een S3-schrijffout logt alleen naar `console.error`
en blokkeert de API-response NIET. Dit is intentioneel (A8: nooit blocking).

**Gevolg:** Een aanhoudende S3-fout breekt de hash-keten stilzwijgend — de API blijft werken
maar de tamper-evident audit is niet meer gegarandeerd.

**Vereiste operationele maatregelen (buiten deze codebase):**
1. CloudWatch-alarm op `[worm] S3 write failed` log-events (ERROR-level) — alert binnen 5 min.
2. S3 bucket-metrics: PUT-errors / PutObject-throttling → alert ops-team.
3. Dagelijkse hash-keten-verificatie via apart auditscript (seq-gaten detecteren).
4. WORM_S3_BUCKET ontbreekt → feature stil uit; detecteer via `/api/status` health-check.

Zonder deze monitoring is A8 (Immutable Trace) operationeel niet gegarandeerd.
