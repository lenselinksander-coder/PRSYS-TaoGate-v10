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

// DPIA-niveaudrempelwaarden (AVG art. 35)
export const DPIA_THRESHOLDS = {
  D1: 0.1,  // Verwaarloosbaar
  D2: 0.2,  // Laag risico
  D3: 0.4,  // Middel risico
  D4: 0.6,  // Hoog risico
  D5: 0.8,  // Kritisch risico
} as const;

/** DPIA-niveau 0–5 conform AVG artikel 35 */
export type DpiaLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const DPIA_LEVEL_LABELS: Record<DpiaLevel, string> = {
  0: "Geen risico — geen DPIA nodig",
  1: "Verwaarloosbaar — geen DPIA nodig",
  2: "Laag risico — DPIA aanbevolen",
  3: "Middel risico — DPIA vereist",
  4: "Hoog risico — DPIA verplicht (AVG art. 35)",
  5: "Kritisch risico — DPIA verplicht + DPO-overleg",
};

/**
 * Classificeer het DPIA-niveau (0–5) op basis van de risicoscore.
 * Onafhankelijk van de Hypatia gate-beslissing.
 */
export function classifyDpiaLevel(riskScore: number): DpiaLevel {
  const r = Math.max(0, Math.min(1, riskScore));
  if (r < DPIA_THRESHOLDS.D1) return 0;
  if (r < DPIA_THRESHOLDS.D2) return 1;
  if (r < DPIA_THRESHOLDS.D3) return 2;
  if (r < DPIA_THRESHOLDS.D4) return 3;
  if (r < DPIA_THRESHOLDS.D5) return 4;
  return 5;
}

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
  dpiaLevel: DpiaLevel;
  dpiaLabel: string;
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

  const dpiaLevel = classifyDpiaLevel(risk);
  const dpiaLabel = DPIA_LEVEL_LABELS[dpiaLevel];

  return { impact: clampedImpact, probability: clampedProb, risk, decision, thresholdLabel, reason, dpiaLevel, dpiaLabel };
}
