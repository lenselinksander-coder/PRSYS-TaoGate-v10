# tools — Tape Compilatie & Signing

## PRSYS-invariant
Runtime executes tapes only. DB is authoring, not execution.
Tapes worden alleen gecompileerd vanuit LOCKED scopes.

## Canon-laagvolgorde (onoverkomelijk)
EU > NATIONAL > REGIONAL > MUNICIPAL
BLOCK van hogere laag kan niet worden overschreven door lagere laag.
build_tapes_from_db.ts valideert dit in manifest-generatie.

## Volgorde bij wijziging
1. Scope LOCKEN in DB
2. build_tapes_from_db.ts uitvoeren
3. sign_tape.ts uitvoeren — tape zonder handtekening wordt niet geladen
4. init.ts valideert manifest en canon-laag-invarianten bij boot

## Wat NOOIT mag
- Tapes handmatig aanpassen na signing
- UNLOCKED scopes compileren naar tape
- BLOCK van EU-tape overriden in lager-laag tape
- Manifest aanpassen zonder herbouw
