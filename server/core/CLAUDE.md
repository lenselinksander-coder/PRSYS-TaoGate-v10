# server/core — EU Legal Gate & TRST

## EU AI Act Art. 5 — TAPE-EU2 (euLegalGate.ts, euBaseline.ts)
BLOCK hier is absoluut. Geen drempel. Geen override. Geen uitzondering.
Fine: EUR 35.000.000 / 7% omzet (Art. 83.1).

Verboden praktijken (hardcoded, keyword-match):
- Art. 5.1(a) Subliminale manipulatie
- Art. 5.1(b) Kwetsbaarheidsuitbuiting (leeftijd, beperking, armoede)
- Art. 5.1(c) Sociale scoring door overheid — postcode-profilering = directe treffer
- Art. 5.1(d) Voorspellend politiewerk individueel risico
- Art. 5.1(e) Massa biometrische scraping
- Art. 5.1(f) Emotieherkenning werk/onderwijs
- Art. 5.1(g) Biometrische inferentie ras/religie/seks — postcode als proxy = dubbele grond

EU2-I1: Art. 5 BLOCK heeft geen drempel. Direct terminaal.
EU2-I2: Postcode als ras-proxy = Art. 5.1(c) + 5.1(g). Beide gronden tegelijk.
EU2-I3: Engine wint altijd van interface-indicatie.
Tape: EU_BASELINE_SCOPE, tape=0, layer=EU, override=false, altijd actief.

Tijdlijn: art5_forbidden actief 2025-02-02 · GPAI 2025-08-02 · high_risk 2026-08-02

## TRST-axioma's (EN-2026-002) — trst.ts
A9  Non-Override: BLOCK is absoluut — lagere laag kan hogere laag nooit opheffen
A8  Immutable Trace: append-only, hash-chained audit — nooit schrijven, nooit muteren
A6  Structural Determinism: identieke DecisionContext = identieke decision_hash
A13 Frame Supremacy: TRSTConfig wordt bevroren bij boot, nooit runtime wijzigen
A10 Bounded Execution: timeout = HARD_BLOCK

Laagorde (bindend): Hardware/OS < TRST < TGR < TaoGate < PRSYS < Interface
