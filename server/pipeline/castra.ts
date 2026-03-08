import { hypatiaRisk, type HypatiaResult } from "../trace";
import { phronesisCapacity, type PhronesisResult } from "../trace";
import type { PipelineStep, CastraResult } from "./types";
import { normaliseDecision } from "./types";

export { hypatiaRisk } from "../trace";
export { phronesisCapacity } from "../trace";

export function runCastra(opts: {
  cerberusBlocked: boolean;
  impact: number;
  probability: number;
  tau: number;
  omega: number;
}): { result: CastraResult; steps: PipelineStep[] } {
  const { cerberusBlocked, impact, probability, tau, omega } = opts;
  const steps: PipelineStep[] = [];

  let hypatia: HypatiaResult;
  let phronesis: PhronesisResult;

  if (cerberusBlocked) {
    hypatia = { impact, probability, risk: 1.0, decision: "BLOCK", thresholdLabel: "CANON_OVERRIDE", reason: "Overgeslagen — Cerberus BLOCK actief." };
    steps.push({
      name: "Hypatia",
      symbol: "⚖",
      role: "Risk — risicoformule Risk = Impact × Probability",
      decision: "SKIPPED",
      detail: "Overgeslagen: Cerberus heeft BLOCK afgegeven. Risico-analyse niet nodig.",
      durationMs: 0,
    });

    phronesis = { tau, omega, SI: 0, risk: 1.0, overloaded: true, decision: "ESCALATE", reason: "Overgeslagen — Cerberus BLOCK actief." };
    steps.push({
      name: "Phronesis",
      symbol: "🧭",
      role: "Capacity — SI = τ × ω; besluitruimte vs risico",
      decision: "SKIPPED",
      detail: "Overgeslagen: Cerberus heeft BLOCK afgegeven. Capaciteitsanalyse niet nodig.",
      durationMs: 0,
    });

    return { result: { hypatia, phronesis, skipped: true }, steps };
  }

  let t = Date.now();
  hypatia = hypatiaRisk(impact, probability);
  steps.push({
    name: "Hypatia",
    symbol: "⚖",
    role: "Risk — risicoformule Risk = Impact × Probability",
    decision: normaliseDecision(hypatia.decision),
    detail: `Impact=${impact.toFixed(2)} × Kans=${probability.toFixed(2)} = Risico ${hypatia.risk.toFixed(3)} (drempel ${hypatia.thresholdLabel}). ${hypatia.reason}`,
    durationMs: Date.now() - t,
  });

  t = Date.now();
  phronesis = phronesisCapacity(tau, omega, hypatia.risk);
  steps.push({
    name: "Phronesis",
    symbol: "🧭",
    role: "Capacity — SI = τ × ω; besluitruimte vs risico",
    decision: phronesis.decision === "ESCALATE" ? "ESCALATE_HUMAN" : "PASS",
    detail: `SI = ${tau.toFixed(2)} × ${omega.toFixed(2)} = ${phronesis.SI.toFixed(3)}. ${phronesis.reason}`,
    durationMs: Date.now() - t,
  });

  return { result: { hypatia, phronesis, skipped: false }, steps };
}
