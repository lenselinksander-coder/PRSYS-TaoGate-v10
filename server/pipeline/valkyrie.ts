import type { PipelineStep } from "./types";
import { DECISION_RANK } from "./types";

export type ValkyrieResult = {
  step: PipelineStep;
  exposureBlocked: boolean;
  exposureReason: string | null;
};

export function runValkyrie(
  D_gate: string,
  D_scope: string,
  D_runtime: string,
  escalation?: string | null,
): ValkyrieResult {
  const t = Date.now();

  const gateRank = DECISION_RANK[D_gate] ?? 0;
  const scopeRank = DECISION_RANK[D_scope] ?? 0;
  const runtimeRank = DECISION_RANK[D_runtime] ?? 0;
  const maxRank = Math.max(gateRank, scopeRank, runtimeRank);

  const exposureBlocked = maxRank >= (DECISION_RANK["ESCALATE_HUMAN"] ?? 2);

  let decision: string;
  let detail: string;
  let exposureReason: string | null = null;

  if (exposureBlocked) {
    decision = "GUARDED";
    exposureReason = escalation
      ? `Exposure geblokkeerd — escalatie naar ${escalation} vereist.`
      : "Exposure geblokkeerd — besluit vereist menselijke interventie.";
    detail = `Exposure guard actief: gate=${D_gate}, scope=${D_scope}, runtime=${D_runtime}. ${exposureReason}`;
  } else {
    decision = "CLEARED";
    detail = `Exposure guard doorgelaten: gate=${D_gate}, scope=${D_scope}, runtime=${D_runtime}. Geen blokkering vereist.`;
  }

  return {
    step: {
      name: "Valkyrie",
      symbol: "🛡",
      role: "Exposure Guard — bescherming tegen ongeautoriseerde blootstelling vóór TaoGate",
      decision,
      detail,
      durationMs: Date.now() - t,
    },
    exposureBlocked,
    exposureReason,
  };
}
