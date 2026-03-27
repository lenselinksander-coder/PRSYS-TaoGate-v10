// server/trace/traceRunner.ts
//
// ORFHEUSS Trace Pipeline — OLYMPIA-first ordering (EN-2026-002)
//
// Full pipeline:
//   INPUT → Argos → Arachne → Logos → Cerberus → Hypatia → Phronesis
//         → TaoGate → Sandbox → Hermes → Tabularium
//
// OLYMPIA-first: Cerberus (boundary/gate) runs BEFORE Hypatia (risk) and
// Phronesis (capacity). If Cerberus issues BLOCK (e.g. CANON_A1), subsequent
// risk/capacity steps are short-circuited.
//
// TaoGate Decision Lattice (Lex Cerberus):
//   D = { PASS, PASS_WITH_TRANSPARENCY, ESCALATE, BLOCK }
//   Ordering: PASS ≤ PASS_T ≤ ESCALATE ≤ BLOCK
//   D_final = max(D_gate, D_scope, D_runtime)
//   Invariant: D_final >= D_gate  (the boundary dominates always)
//
// Fail-safe axiom (Lex Tabularium): error ⇒ BLOCK

import { runGate } from "../gateSystem";
import { hypatiaRisk, classifyDpiaLevel, DPIA_LEVEL_LABELS, type HypatiaResult, type DpiaLevel } from "./hypatia";
import { phronesisCapacity, type PhronesisResult } from "./phronesis";
import type { GateProfile } from "@shared/schema";
import { randomUUID } from "crypto";

// ── Decision Lattice ──────────────────────────────────────────────────────────

export const DECISION_ORDER = ["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"] as const;
export type LatticeDecision = typeof DECISION_ORDER[number];

const DECISION_RANK: Record<string, number> = {
  PASS: 0,
  PASS_WITH_TRANSPARENCY: 1,
  ESCALATE_HUMAN: 2,
  ESCALATE: 2,       // alias used internally by Hypatia/Phronesis
  ESCALATE_REGULATORY: 3,
  BLOCK: 4,
};

/**
 * Return the most restrictive of two decisions (higher rank wins).
 * Implements D_final = max(D_a, D_b) from the TaoGate lattice.
 */
function latticeMax(a: string, b: string): string {
  const rankA = DECISION_RANK[a] ?? 0;
  const rankB = DECISION_RANK[b] ?? 0;
  return rankA >= rankB ? a : b;
}

/** Normalise Hypatia/Phronesis "ESCALATE" to "ESCALATE_HUMAN" for the lattice. */
function normaliseDecision(d: string): LatticeDecision {
  if (d === "ESCALATE") return "ESCALATE_HUMAN";
  return d as LatticeDecision;
}

// ── Trace Types ───────────────────────────────────────────────────────────────

export type TraceStep = {
  name: string;
  symbol: string;
  role: string;
  decision: string;
  detail: string;
  durationMs: number;
};

export type TraceResult = {
  auditId: string;
  input: string;
  steps: TraceStep[];
  lattice: {
    D_gate: string;
    D_scope: string;
    D_runtime: string;
    D_final: string;
  };
  hypatia: HypatiaResult;
  phronesis: PhronesisResult;
  finalDecision: string;
  finalReason: string;
  dpiaLevel: DpiaLevel;
  dpiaLabel: string;
  processingMs: number;
};

// ── Pipeline Runner ───────────────────────────────────────────────────────────

export type TraceInput = {
  input: string;
  profile?: GateProfile;
  /** τ — time units available (default: 1.0) */
  tau?: number;
  /** ω — attention/capacity coefficient 0..1 (default: 0.8) */
  omega?: number;
  /** Impact score 0..1 for Hypatia (default: derived from input length heuristic) */
  impact?: number;
  /** Probability score 0..1 for Hypatia (default: 0.5) */
  probability?: number;
};

export async function runTrace(opts: TraceInput): Promise<TraceResult> {
  const totalStart = Date.now();
  const auditId = randomUUID();
  const steps: TraceStep[] = [];

  const {
    input,
    profile = "GENERAL",
    tau = 1.0,
    omega = 0.8,
    probability = 0.5,
  } = opts;

  // Heuristic: impact scales with input length (capped at 1.0)
  const impact = opts.impact ?? Math.min(1.0, input.length / 200);

  // ── Step 1: Argos (Observe) ───────────────────────────────────────────────
  let t = Date.now();
  const inputLength = input.trim().length;
  const wordCount = input.trim().split(/\s+/).filter(Boolean).length;
  steps.push({
    name: "Argos",
    symbol: "👁",
    role: "Observe — input detectie en normalisatie",
    decision: inputLength > 0 ? "OBSERVED" : "EMPTY",
    detail: inputLength > 0
      ? `Input ontvangen: ${wordCount} woorden, ${inputLength} tekens.`
      : "Lege invoer gedetecteerd.",
    durationMs: Date.now() - t,
  });

  if (inputLength === 0) {
    // Fail-safe: empty input → PASS (benign)
    const passResult = buildPassResult(auditId, input, steps, impact, probability, tau, omega, totalStart);
    return passResult;
  }

  // ── Step 2: Arachne (Structure) ───────────────────────────────────────────
  t = Date.now();
  const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const hasImperative = /\b(verwijder|delete|stop|blokkeer|override|forceer|immediately|nu uitvoeren)\b/i.test(input);
  const structureDetail = `${sentences} zin(nen), imperatief: ${hasImperative ? "JA" : "nee"}.`;
  steps.push({
    name: "Arachne",
    symbol: "🕸",
    role: "Structure — syntax en intent-structuur analyse",
    decision: "STRUCTURED",
    detail: structureDetail,
    durationMs: Date.now() - t,
  });

  // ── Step 3: Logos (Classify) ──────────────────────────────────────────────
  t = Date.now();
  const domainHints: string[] = [];
  if (/\b(patiënt|medicati|dosering|diagnos|verpleeg|triage)\b/i.test(input)) domainHints.push("CLINICAL");
  if (/\b(transactie|betaling|fraude|kyc|aml|witwas)\b/i.test(input)) domainHints.push("FINANCIAL");
  if (/\b(vonnis|rechtszaak|contract|aansprakelijk|advocaat)\b/i.test(input)) domainHints.push("LEGAL");
  if (/\b(leerling|toets|examen|beoordeling|cijfer)\b/i.test(input)) domainHints.push("EDUCATIONAL");
  const logosDomain = domainHints.length > 0 ? domainHints[0] : profile;
  steps.push({
    name: "Logos",
    symbol: "📐",
    role: "Classify — domeinclassificatie en profiel matching",
    decision: "CLASSIFIED",
    detail: `Domein: ${logosDomain}. Actief profiel: ${profile}.${domainHints.length > 1 ? ` Extra signalen: ${domainHints.slice(1).join(", ")}.` : ""}`,
    durationMs: Date.now() - t,
  });

  // ── Step 4: Cerberus (Boundary) — OLYMPIA-first ──────────────────────────
  t = Date.now();
  const D_gate_raw = runGate(input, profile);
  const D_gate = D_gate_raw.status;
  const cerberusBlocked = D_gate === "BLOCK";
  steps.push({
    name: "Cerberus",
    symbol: "🐺",
    role: "Boundary — gate-profiel grenshandhaving (Lex Cerberus: D_final ≥ D_gate)",
    decision: D_gate,
    detail: `Gate profiel '${profile}' resultaat: ${D_gate}. ${D_gate_raw.reason}${cerberusBlocked ? " ⛔ Short-circuit: Hypatia/Phronesis overgeslagen." : ""}`,
    durationMs: Date.now() - t,
  });

  // ── Step 5: Hypatia (Risk) ────────────────────────────────────────────────
  let hypatia: HypatiaResult;
  if (cerberusBlocked) {
    hypatia = { impact: 1.0, probability: 1.0, risk: 1.0, decision: "BLOCK" as const, thresholdLabel: "CANON_OVERRIDE", reason: "Overgeslagen — Cerberus BLOCK actief.", dpiaLevel: 5 as const, dpiaLabel: "Kritisch risico — DPIA verplicht + DPO-overleg" };
    steps.push({
      name: "Hypatia",
      symbol: "⚖",
      role: "Risk — risicoformule Risk = Impact × Probability",
      decision: "SKIPPED",
      detail: "Overgeslagen: Cerberus heeft BLOCK afgegeven. Risico-analyse niet nodig.",
      durationMs: 0,
    });
  } else {
    t = Date.now();
    hypatia = hypatiaRisk(impact, probability);
    steps.push({
      name: "Hypatia",
      symbol: "⚖",
      role: "Risk — risicoformule Risk = Impact × Probability",
      decision: normaliseDecision(hypatia.decision),
      detail: `Impact=${impact.toFixed(2)} × Kans=${probability.toFixed(2)} = Risico ${hypatia.risk.toFixed(3)} (drempel ${hypatia.thresholdLabel}). ${hypatia.reason}`,
      durationMs: Date.now() - t,
    });
  }

  // ── Step 6: Phronesis (Capacity) ──────────────────────────────────────────
  let phronesis: PhronesisResult;
  if (cerberusBlocked) {
    phronesis = { tau: 0, omega: 0, SI: 0, risk: 1.0, overloaded: true, decision: "ESCALATE" as const, reason: "Overgeslagen — Cerberus BLOCK actief." };
    steps.push({
      name: "Phronesis",
      symbol: "🧭",
      role: "Capacity — SI = τ × ω; besluitruimte vs risico",
      decision: "SKIPPED",
      detail: "Overgeslagen: Cerberus heeft BLOCK afgegeven. Capaciteitsanalyse niet nodig.",
      durationMs: 0,
    });
  } else {
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
  }

  // ── Step 7: TaoGate (Decision Lattice) ────────────────────────────────────
  t = Date.now();
  const D_scope = cerberusBlocked ? "BLOCK" as LatticeDecision : normaliseDecision(hypatia.decision);
  const D_runtime = cerberusBlocked ? "BLOCK" as string : (phronesis.decision === "ESCALATE" ? "ESCALATE_HUMAN" : "PASS");

  // D_final = max(D_gate, D_scope, D_runtime)
  const D_after_scope   = latticeMax(D_gate, D_scope);
  const D_final_raw     = latticeMax(D_after_scope, D_runtime);
  const D_final         = D_final_raw as LatticeDecision;

  steps.push({
    name: "TaoGate",
    symbol: "☯",
    role: "Decision Lattice — D_final = max(D_gate, D_scope, D_runtime)",
    decision: D_final,
    detail: `D_gate=${D_gate} | D_scope=${D_scope} | D_runtime=${D_runtime} → D_final=${D_final}`,
    durationMs: Date.now() - t,
  });

  // ── Step 8: Sandbox ───────────────────────────────────────────────────────
  t = Date.now();
  const sandboxStatus = D_final === "PASS" || D_final === "PASS_WITH_TRANSPARENCY"
    ? "ALLOWED"
    : "DENIED";
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

  // ── Step 9: Hermes (Communication) ────────────────────────────────────────
  t = Date.now();
  steps.push({
    name: "Hermes",
    symbol: "⚡",
    role: "Communication — resultaat communicatie en notificatie",
    decision: D_final,
    detail: `Besluit '${D_final}' wordt gecommuniceerd.${D_gate_raw.escalation ? ` Escalatie naar: ${D_gate_raw.escalation}.` : ""}`,
    durationMs: Date.now() - t,
  });

  // ── Step 10: Tabularium (Audit) ───────────────────────────────────────────
  t = Date.now();
  steps.push({
    name: "Tabularium",
    symbol: "📜",
    role: "Audit — onveranderlijk besluit-archief (Lex Tabularium: ¬Audit → ¬Authority)",
    decision: "RECORDED",
    detail: `Audit-ID: ${auditId}. Besluit ${D_final} vastgelegd om ${new Date().toISOString()}.`,
    durationMs: Date.now() - t,
  });

  // ── Final result ──────────────────────────────────────────────────────────
  const finalReason = D_gate_raw.reason || hypatia.reason || phronesis.reason;

  return {
    auditId,
    input,
    steps,
    lattice: {
      D_gate,
      D_scope,
      D_runtime,
      D_final,
    },
    hypatia,
    phronesis,
    finalDecision: D_final,
    finalReason,
    dpiaLevel: hypatia.dpiaLevel,
    dpiaLabel: hypatia.dpiaLabel,
    processingMs: Date.now() - totalStart,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPassResult(
  auditId: string,
  input: string,
  steps: TraceStep[],
  impact: number,
  probability: number,
  tau: number,
  omega: number,
  totalStart: number,
): TraceResult {
  const hypatia = hypatiaRisk(impact, probability);
  const phronesis = phronesisCapacity(tau, omega, hypatia.risk);
  return {
    auditId,
    input,
    steps,
    lattice: { D_gate: "PASS", D_scope: "PASS", D_runtime: "PASS", D_final: "PASS" },
    hypatia,
    phronesis,
    finalDecision: "PASS",
    finalReason: "Lege invoer — doorgelaten zonder verdere verwerking.",
    dpiaLevel: hypatia.dpiaLevel,
    dpiaLabel: hypatia.dpiaLabel,
    processingMs: Date.now() - totalStart,
  };
}
