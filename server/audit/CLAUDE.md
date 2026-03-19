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
