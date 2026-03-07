// server/vector_engine/vector.ts
//
// Vector Legitimacy Engine — kern evaluatiefunctie.
//
// De engine evalueert drie governance-dimensies als een vector en detecteert
// instabiliteit die een traditionele checklist mist.
//
// Voorbeeld van het probleem:
//   Mandate=1.0 (hoge bevoegdheid), Integrity=1.0 (laag risico), Load=0.1
//   → Alle checks individueel positief, maar de vector is ernstig instabiel.
//   → Een checklist keurt goed; de vector engine geeft NO_GO of HOLD.
//
// Governance-regel: Generation → Legitimacy → Execution
//   GO       → uitvoering mag doorgaan
//   HOLD     → menselijke review vereist vóór uitvoering
//   NO_GO    → uitvoering geblokkeerd

import {
  calculateMean,
  calculateVariance,
  calculateStability,
  STABILITY_NO_GO,
  STABILITY_HOLD,
} from "./stability";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * De drie governance-dimensies van een legitimiteitsvector.
 * Alle waarden in [0..1]. Worden geclamped bij ingang van evaluateVector().
 */
export type GateVector = {
  /** Governance-bevoegdheid — hoe geautoriseerd is het verzoek? */
  mandate: number;
  /** Systeemcoherentie — hoe laag is het risico? */
  integrity: number;
  /** Organisationele draagkracht — hoe beschikbaar is capaciteit? */
  load: number;
};

/** Uitkomst van de vector-evaluatie */
export type VectorDecision = "GO" | "HOLD" | "NO_GO";

/** Volledig evaluatieobject — retourneert alle tussenliggende waarden */
export type VectorEvaluation = {
  /** De ingangsector (na clamping) */
  vector: GateVector;
  /** Rekenkundig gemiddelde van de drie dimensies */
  mean: number;
  /** Gemiddelde kwadratische afstand van het gemiddelde */
  variance: number;
  /** Stabiliteitscore ∈ [0..1]: 1 = perfect evenwicht, 0 = maximale onbalans */
  stability: number;
  /** Legitimiteitsscore = mean — hoe hoog is de gemiddelde bevoegdheid? */
  legitimacyScore: number;
  /**
   * Gecombineerd risico = (1 − stability) × legitimacyScore.
   * Hoog wanneer het systeem een hoge legitimiteitsaanspraak maakt
   * maar instabiel is — het gevaarlijkste scenario.
   */
  risk: number;
  /** Governance-beslissing */
  decision: VectorDecision;
  /** Uitleg van de beslissing */
  reason: string;
};

// ── Hoofdfunctie ──────────────────────────────────────────────────────────────

/**
 * Evalueer de legitimiteitsVector voor een governance-actie.
 *
 * Alle invoerwaarden worden geclamped naar [0..1].
 * De functie gooit nooit een uitzondering (Cerberus-garantie op aanroeperniveau).
 *
 * @param v - De drie governance-dimensies
 * @returns Volledig evaluatieobject met beslissing en motivatie
 *
 * @example
 * // Stabiel scenario — alle dimensies in balans
 * evaluateVector({ mandate: 0.9, integrity: 0.85, load: 0.8 })
 * // → { decision: "GO", stability: ~0.97, ... }
 *
 * @example
 * // Instabiel scenario — hoge bevoegdheid, lage capaciteit
 * evaluateVector({ mandate: 1.0, integrity: 0.5, load: 0.1 })
 * // → { decision: "NO_GO" of "HOLD", stability: < 0.7, ... }
 */
export function evaluateVector(v: GateVector): VectorEvaluation {
  // Clamp alle dimensies naar [0..1]
  const mandate   = Math.max(0, Math.min(1, v.mandate));
  const integrity = Math.max(0, Math.min(1, v.integrity));
  const load      = Math.max(0, Math.min(1, v.load));

  const clampedVector: GateVector = { mandate, integrity, load };

  // Wiskunde
  const mean             = calculateMean(mandate, integrity, load);
  const variance         = calculateVariance(mandate, integrity, load);
  const stability        = calculateStability(variance);
  const legitimacyScore  = mean;
  const risk             = (1 - stability) * legitimacyScore;

  // Beslissing op basis van stabiliteitsdrempels
  let decision: VectorDecision;
  let reason: string;

  if (stability < STABILITY_NO_GO) {
    decision = "NO_GO";
    reason =
      `Governance-vector instabiel (stabiliteit=${stability.toFixed(3)} < ${STABILITY_NO_GO}). ` +
      `Dimensies: mandate=${mandate.toFixed(2)}, integrity=${integrity.toFixed(2)}, ` +
      `load=${load.toFixed(2)}. Vectorrisico=${risk.toFixed(3)}. Uitvoering geblokkeerd.`;
  } else if (stability < STABILITY_HOLD) {
    decision = "HOLD";
    reason =
      `Governance-vector matig stabiel (stabiliteit=${stability.toFixed(3)} < ${STABILITY_HOLD}). ` +
      `Dimensies: mandate=${mandate.toFixed(2)}, integrity=${integrity.toFixed(2)}, ` +
      `load=${load.toFixed(2)}. Vectorrisico=${risk.toFixed(3)}. Menselijke review vereist.`;
  } else {
    decision = "GO";
    reason =
      `Governance-vector stabiel (stabiliteit=${stability.toFixed(3)} ≥ ${STABILITY_HOLD}). ` +
      `Dimensies: mandate=${mandate.toFixed(2)}, integrity=${integrity.toFixed(2)}, ` +
      `load=${load.toFixed(2)}. Legitimiteitsscore=${legitimacyScore.toFixed(3)}. Uitvoering toegestaan.`;
  }

  return {
    vector: clampedVector,
    mean,
    variance,
    stability,
    legitimacyScore,
    risk,
    decision,
    reason,
  };
}
