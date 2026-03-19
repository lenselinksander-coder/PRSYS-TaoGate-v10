import type { PipelineStep } from "./types";
import { latticeMax, type LatticeDecision } from "./types";

export type TaoGateResult = {
  D_gate: string;
  D_scope: string;
  D_runtime: string;
  D_final: string;
  sandboxStatus: "ALLOWED" | "DENIED";
  steps: PipelineStep[];
};

export function runTaoGate(D_gate: string, D_scope: string, D_runtime: string, escalation?: string | null): TaoGateResult {
  const steps: PipelineStep[] = [];
  let t = Date.now();

  const D_after_scope = latticeMax(D_gate, D_scope);
  const D_final_raw = latticeMax(D_after_scope, D_runtime);
  const D_final = D_final_raw as LatticeDecision;

  steps.push({
    name: "TaoGate",
    symbol: "☯",
    role: "Decision Lattice — D_final = max(D_gate, D_scope, D_runtime)",
    decision: D_final,
    detail: `D_gate=${D_gate} | D_scope=${D_scope} | D_runtime=${D_runtime} → D_final=${D_final}`,
    durationMs: Date.now() - t,
  });

  t = Date.now();
  const sandboxStatus = D_final === "PASS" || D_final === "PASS_WITH_TRANSPARENCY"
    ? "ALLOWED" as const
    : "DENIED" as const;

  steps.push({
    name: "Sandbox",
    symbol: "🏛",
    role: "Sandbox — hermetic WASM execution boundary",
    decision: sandboxStatus,
    detail: sandboxStatus === "ALLOWED"
      ? "Sandbox-uitvoering toegestaan na besluitlatice goedkeuring."
      : `Sandbox-uitvoering geblokkeerd (${D_final}) — geen uitvoering.`,
    durationMs: Date.now() - t,
  });

  t = Date.now();
  steps.push({
    name: "Hermes",
    symbol: "⚡",
    role: "Communication — resultaat communicatie en notificatie",
    decision: D_final,
    detail: `Besluit '${D_final}' wordt gecommuniceerd.${escalation ? ` Escalatie naar: ${escalation}.` : ""}`,
    durationMs: Date.now() - t,
  });

  return { D_gate, D_scope, D_runtime, D_final, sandboxStatus, steps };
}
