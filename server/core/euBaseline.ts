/**
 * EU AI Act Baseline Scope — TAPE-EU2
 * Tape 0: altijd actief, niet uitschakelbaar, niet overschrijfbaar.
 * Onafhankelijk van organisatie-scopes.
 */

export const EU_BASELINE_SCOPE = {
  id: "TAPE-EU2-BASELINE",
  name: "EU AI Act — Baseline",
  tape: 0,
  layer: "EU",
  override: false,
  active: true,
  source: "Regulation (EU) 2024/1689 · OJ 13 June 2024",
  nl_authority: "RDI — Rijksdienst Digitale Infrastructuur",
  active_since: {
    art5_forbidden: "2025-02-02",
    gpai: "2025-08-02",
    high_risk: "2026-08-02",
  },
  penalties: {
    art5: { max_eur: 35_000_000, max_pct: 0.07 },
    other: { max_eur: 15_000_000, max_pct: 0.03 },
  },
  invariants: {
    "EU2-I1": "Art. 5 BLOCK heeft geen drempel. Direct terminaal. Geen override.",
    "EU2-I2": "Postcode als ras-proxy = Art. 5.1(c) + Art. 5.1(g). Dubbele grond.",
    "EU2-I3": "Engine wint altijd van interface-indicatie.",
    "EU2-I4": "Sector-threshold (S=0.7) geldt niet voor Art. 5. Post-legal.",
    "EU2-I5": "Art. 14 menselijk toezicht is verplicht bij hoog-risico, geen optie.",
  },
} as const;

/**
 * Gebruik in system/info endpoint:
 * import { EU_BASELINE_SCOPE } from "./core/euBaseline";
 * return res.json({ ..., baseline: EU_BASELINE_SCOPE });
 */
