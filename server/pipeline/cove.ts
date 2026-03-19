// server/pipeline/cove.ts
//
// CoVe — Compositional Verification
// CV = V(G) ⊥ V(L) ⊥ V(E)
//
// Invariant I6 (EN-2026-002): Geen laag verifieert haar eigen output.
// Verificatie vereist een onafhankelijk pad, een onafhankelijke evaluator,
// en een onafhankelijke trace.
//
// Evaluators (hardcoded — nooit runtime-configureerbaar, I6):
//   V(G) Hypatia         — mandaat-check gate-beslissing     (≠ Cerberus)
//   V(L) EuLegalGate     — juridische basischeck             (≠ Olympia)
//   V(E) Arachne         — weefselbreuk executiestructuur    (≠ Phronesis)
//
// Als één pad faalt of een fout veroorzaakt: CV = ESCALATE_HUMAN. Nooit stilte.
// State: q4b VERIFY — na TaoGate (q4), vóór Audit (q5). Buiten WASM-sandbox.

import type { CoVeResult } from "./types";
import { latticeMax, normaliseDecision } from "./types";
import { hypatiaRisk } from "../trace";
import { runEuLegalGate } from "../core";
import { evaluateArachne } from "./arachne";

// I6: evaluators zijn hardcoded — structureel ≠ producenten (Cerberus, Olympia, Phronesis)
const COVE_EVALUATORS = ["Hypatia", "EuLegalGate", "Arachne"] as const;

export function runCoVe(input: string, impact: number, probability: number): CoVeResult {
  const t = Date.now();
  let V_G = "PASS";
  let V_L = "PASS";
  let V_E = "PASS";
  let failed = false;

  // V(G) — Hypatia verificeert gate-mandate onafhankelijk van Cerberus
  try {
    V_G = normaliseDecision(hypatiaRisk(impact, probability).decision);
  } catch {
    V_G = "ESCALATE_HUMAN";
    failed = true;
  }

  // V(L) — EuLegalGate verificeert juridische basis onafhankelijk van Olympia
  try {
    const eu = runEuLegalGate(input);
    V_L = eu.triggered ? eu.decision : "PASS";
  } catch {
    V_L = "ESCALATE_HUMAN";
    failed = true;
  }

  // V(E) — Arachne verificeert executiestructuur onafhankelijk van Phronesis
  try {
    V_E = evaluateArachne(input);
  } catch {
    V_E = "ESCALATE_HUMAN";
    failed = true;
  }

  const CV = latticeMax(latticeMax(V_G, V_L), V_E);
  const failedNote = failed ? " ⚠ pad-fout → ESCALATE_HUMAN" : "";
  const detail = `V(G)=${V_G}[${COVE_EVALUATORS[0]}] ⊥ V(L)=${V_L}[${COVE_EVALUATORS[1]}] ⊥ V(E)=${V_E}[${COVE_EVALUATORS[2]}] → CV=${CV}${failedNote}`;

  return {
    V_G, V_L, V_E, CV, failed,
    step: {
      name: "CoVe",
      symbol: "⊥",
      role: "CoVe q4b — CV = V(G)⊥V(L)⊥V(E) · I6: geen laag verifieert haar eigen output",
      decision: CV,
      detail,
      durationMs: Date.now() - t,
    },
  };
}
