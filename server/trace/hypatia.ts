// server/trace/hypatia.ts
//
// Hypatia — Risk Formula
//
// Risk = Impact × Probability
//
// Decision thresholds (Lex Hypatia):
//   Risk < threshold_1 (0.20) → PASS
//   Risk < threshold_2 (0.40) → PASS_WITH_TRANSPARENCY
//   Risk < threshold_3 (0.70) → ESCALATE
//   Risk >= threshold_3        → BLOCK

export const HYPATIA_THRESHOLDS = {
  T1: 0.2,  // PASS boundary
  T2: 0.4,  // PASS_WITH_TRANSPARENCY boundary
  T3: 0.7,  // ESCALATE boundary; above → BLOCK
} as const;

export type HypatiaDecision =
  | "PASS"
  | "PASS_WITH_TRANSPARENCY"
  | "ESCALATE"
  | "BLOCK";

export type HypatiaResult = {
  impact: number;
  probability: number;
  risk: number;
  decision: HypatiaDecision;
  thresholdLabel: string;
  reason: string;
};

/**
 * Evaluate risk using the Hypatia formula: Risk = Impact × Probability.
 *
 * @param impact      - Impact score [0..1]
 * @param probability - Probability score [0..1]
 */
export function hypatiaRisk(impact: number, probability: number): HypatiaResult {
  const clampedImpact = Math.max(0, Math.min(1, impact));
  const clampedProb   = Math.max(0, Math.min(1, probability));
  const risk = clampedImpact * clampedProb;

  let decision: HypatiaDecision;
  let thresholdLabel: string;
  let reason: string;

  if (risk < HYPATIA_THRESHOLDS.T1) {
    decision = "PASS";
    thresholdLabel = `< ${HYPATIA_THRESHOLDS.T1}`;
    reason = `Risico ${risk.toFixed(3)} is laag — doorgelaten.`;
  } else if (risk < HYPATIA_THRESHOLDS.T2) {
    decision = "PASS_WITH_TRANSPARENCY";
    thresholdLabel = `< ${HYPATIA_THRESHOLDS.T2}`;
    reason = `Risico ${risk.toFixed(3)} vereist transparantie — doorgelaten met verantwoording.`;
  } else if (risk < HYPATIA_THRESHOLDS.T3) {
    decision = "ESCALATE";
    thresholdLabel = `< ${HYPATIA_THRESHOLDS.T3}`;
    reason = `Risico ${risk.toFixed(3)} overschrijdt drempel — escalatie naar mens vereist.`;
  } else {
    decision = "BLOCK";
    thresholdLabel = `>= ${HYPATIA_THRESHOLDS.T3}`;
    reason = `Risico ${risk.toFixed(3)} is kritiek — geblokkeerd (Cerberus).`;
  }

  return { impact: clampedImpact, probability: clampedProb, risk, decision, thresholdLabel, reason };
}
