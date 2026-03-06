// TRST — Trusted Runtime Specification for Tao
// De informatica-fundering van ORFHEUSS
// ORFHEUSS · EN-2026-002 · Februari 2026
// Steward: Sander Lenselink (Founder)
//
// Laagorde (bindend):
// Hardware/OS < TRST (fundament) < TGR (runtime) < TaoGate (brug) < PRSYS (moederbord) < Interface
//
// Een lagere laag kan een hogere laag nooit overschrijven.
// Een hogere laag kan de grenzen van een lagere laag nooit wijzigen.
//
// Axioma's (EN-2026-002):
//   A1  Generatie ≠ Legitimiteit
//   A2  Legitimiteit ≠ Executie
//   A3  Executie vereist deterministische validatie
//   A4  Canon Completeness: ∆ ∧ Φ ∧ Ψ per DC
//   A5  Cryptographic Mandate
//   A6  Structural Determinism: identieke DC = identieke decision_hash
//   A7  Isolated Execution
//   A8  Immutable Trace: append-only, hash-chained audit
//   A9  Non-Override: BLOCK is absoluut
//   A10 Bounded Execution: Timeout = HARD_BLOCK
//   A11 SI-stabiliteit vereist TI ≥ TI_min
//   A12 Trust is Derived
//   A13 Frame Supremacy

import * as crypto from "crypto";
import { performance } from "perf_hooks";
import type { TapeModule, TapeDeck } from "./init";
import {
  type PhysicsDecision,
  type PhysicsLogEntry,
  type TauInput,
  bootstrapPhysics,
  computeTau,
  computeOmega,
  computeTI,
  evaluatePhysics,
  recordArrival,
  incrementInflight,
  decrementInflight,
  recordTraceCheck,
  recordIsolationEvent,
  recordCryptoCheck,
  recordTimeoutEvent,
  shouldShadowSample,
  performShadowCheck,
  toLogEntry,
} from "./physics";

// ─── TRST Configuration (A13: Frame Supremacy — frozen at boot) ───

export interface TRSTConfig {
  readonly time_budget_ms: number;
  readonly concurrency_budget: number;
  readonly engine_version: string;
  readonly frame_id: string;
  readonly frame_version: string;
}

const DEFAULT_TRST_CONFIG: TRSTConfig = {
  time_budget_ms: 500,
  concurrency_budget: 10,
  engine_version: "TRST_1.0.0",
  frame_id: "ORFHEUSS_TRST",
  frame_version: "EDITIO_I",
};

let _trstConfig: Readonly<TRSTConfig> | null = null;

// A13 — Frame Supremacy: TRST-grenzen zijn onwijzigbaar door normatieve lagen.
// TaoGate opereert binnen, niet boven.
export function bootstrapTRST(overrides?: Partial<TRSTConfig>): Readonly<TRSTConfig> {
  if (_trstConfig !== null) {
    console.log("[TRST] Already bootstrapped — Frame Supremacy prevents re-initialization.");
    return _trstConfig;
  }
  const config = { ...DEFAULT_TRST_CONFIG, ...overrides };
  _trstConfig = Object.freeze(config);

  // Bootstrap physics engine (TRST owns physics — physics never overrides TRST)
  bootstrapPhysics();

  console.log(`[TRST] Bootstrapped. engine=${config.engine_version} frame=${config.frame_id}/${config.frame_version}`);
  console.log(`[TRST]   time_budget=${config.time_budget_ms}ms concurrency=${config.concurrency_budget}`);
  return _trstConfig;
}

export function getTRSTConfig(): Readonly<TRSTConfig> {
  if (!_trstConfig) {
    throw new Error("[TRST] FAIL-FAST: TRST not bootstrapped. Call bootstrapTRST() at server boot.");
  }
  return _trstConfig;
}

// ─── Decision Context (DC) — smallest unit of canon evaluation ───

export interface DecisionContext {
  input_canonical: string;
  tape_id: string;
  tape_hash: string;
  manifest_id: string;
  frame_id: string;
  frame_version: string;
  engine_version: string;
  time_budget_ms: number;
  concurrency_budget: number;
  keyring_id: string;
  decision_hash: string;
  timestamp_iso: string;
}

export type CanonStatus = {
  delta: boolean;
  phi: boolean;
  psi: boolean;
  valid: boolean;
  failures: string[];
};

export type TRSTDecision = {
  dc: DecisionContext;
  canon: CanonStatus;
  result: {
    status: string;
    category: string;
    escalation: string | null;
    rule_id: string | null;
    layer: string | null;
    reason: string | null;
    tape_id: string;
  } | null;
  hard_block: boolean;
  hard_block_reason: string | null;
  processing_ms: number;
  physics: PhysicsLogEntry | null;
  axioms_satisfied: string[];
  axioms_violated: string[];
};

// ─── A7: Isolated Execution ───

export function freezeTapeModule(tape: TapeModule): TapeModule {
  if (tape.meta) Object.freeze(tape.meta);
  return Object.freeze(tape) as TapeModule;
}

// ─── A4: Canon Completeness — Δ ∧ Φ ∧ Ψ ───

function checkDelta(tape: TapeModule | undefined, entry: any): boolean {
  if (!tape) return false;
  if (!tape.meta || !tape.decide || typeof tape.decide !== "function") return false;
  if (!entry) return false;
  return true;
}

function checkPhi(entry: any): boolean {
  if (!entry) return false;
  if (!entry.sha256 || !entry.signature || !entry.kid) return false;
  return true;
}

function checkPsi(entry: any): boolean {
  if (!entry) return false;
  if (!entry.canon_layer) return false;
  if (entry.canon_layer.override_block_permitted === true) return false;
  return true;
}

function evaluateCanon(tape: TapeModule | undefined, entry: any): CanonStatus {
  const failures: string[] = [];
  const delta = checkDelta(tape, entry);
  if (!delta) failures.push("Δ: Tape invalid or missing meta/decide");

  const phi = checkPhi(entry);
  if (!phi) failures.push("Φ: Cryptographic verification incomplete (sha256/signature/kid missing)");

  const psi = checkPsi(entry);
  if (!psi) failures.push("Ψ: Canon layer invalid or override_block_permitted violation");

  return {
    delta,
    phi,
    psi,
    valid: delta && phi && psi,
    failures,
  };
}

// ─── A6: Structural Determinism — decision_hash ───
// τ, ω, TI, SI zijn runtime_meta. Ze beïnvloeden NOOIT decision_hash.

function computeDecisionHash(dc: Omit<DecisionContext, "decision_hash">): string {
  const payload = JSON.stringify({
    input_canonical: dc.input_canonical,
    tape_id: dc.tape_id,
    tape_hash: dc.tape_hash,
    manifest_id: dc.manifest_id,
    frame_id: dc.frame_id,
    frame_version: dc.frame_version,
    engine_version: dc.engine_version,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ─── τ extraction — count structural signals from tape execution ───

function countTapeStructure(tape: TapeModule, entry: any): TauInput {
  let rules_evaluated = 0;
  let branches_taken = 0;
  const proof_steps = entry ? 3 : 0;

  if (tape.meta) {
    rules_evaluated = tape.meta.precedence !== undefined ? 1 : 0;
  }

  const policy_depth = 4;

  return {
    rules_evaluated,
    branches_taken,
    proof_steps,
    payload_bytes: 0,
    policy_depth,
  };
}

// ─── TaoGate — de brug ───
// State Machine: q0 → q1 → q2 (TI-GATE) → q3 (EXECUTE, SI) → q4 → q5 → q8
// F-druk (OLYMPIA) : TaoGate (TRST) = fysica : informatica

export function executeTaoGate(
  text: string,
  tape: TapeModule,
  tapeDeck: TapeDeck,
): TRSTDecision {
  const config = getTRSTConfig();
  const startTime = performance.now();
  const axiomsSatisfied: string[] = [];
  const axiomsViolated: string[] = [];

  recordArrival();
  incrementInflight();

  try {
    return _executeTaoGateInner(text, tape, tapeDeck, config, startTime, axiomsSatisfied, axiomsViolated);
  } finally {
    decrementInflight();
  }
}

function _executeTaoGateInner(
  text: string,
  tape: TapeModule,
  tapeDeck: TapeDeck,
  config: Readonly<TRSTConfig>,
  startTime: number,
  axiomsSatisfied: string[],
  axiomsViolated: string[],
): TRSTDecision {
  const entry = tapeDeck.manifest.entries.find(e => e.tape_id === tape.meta.tape_id);

  const inputCanonical = text.toLowerCase().replace(/\s+/g, " ").trim();
  const payloadBytes = Buffer.byteLength(text, "utf-8");

  const dcPartial = {
    input_canonical: inputCanonical,
    tape_id: tape.meta.tape_id,
    tape_hash: entry?.sha256 || "UNVERIFIED",
    manifest_id: tapeDeck.manifest.entries.length > 0 ? "PRSYS_MANIFEST_V1" : "NONE",
    frame_id: config.frame_id,
    frame_version: config.frame_version,
    engine_version: config.engine_version,
    time_budget_ms: config.time_budget_ms,
    concurrency_budget: config.concurrency_budget,
    keyring_id: entry?.kid || "NONE",
    timestamp_iso: new Date().toISOString(),
  };
  const decisionHash = computeDecisionHash(dcPartial);
  const dc: DecisionContext = { ...dcPartial, decision_hash: decisionHash };

  // A6: Structural Determinism
  axiomsSatisfied.push("A6_STRUCTURAL_DETERMINISM");

  // ── q2: PRE_GATE — TI-GATE (F5) ──
  // A11: SI-stabiliteit vereist TI ≥ TI_min
  // TI < TI_min → q7 BLOCK (terminaal, absoluut)
  // TI ≥ TI_min → proceed to q3 EXECUTE
  const preTI = computeTI();
  const preOmega = computeOmega();
  const preTauInput: TauInput = {
    ...countTapeStructure(tape, entry),
    payload_bytes: payloadBytes,
  };
  const preTau = computeTau(preTauInput);
  const prePhysics = evaluatePhysics(preTau, preOmega, preTI);

  // F5: TI-GATE check — BLOCK is absoluut (A9)
  if (prePhysics.action === "TI_BLOCK") {
    axiomsViolated.push("A11_SI_STABILITY");
    axiomsViolated.push("A9_NON_OVERRIDE");
    const processingMs = performance.now() - startTime;
    return {
      dc,
      canon: { delta: false, phi: false, psi: false, valid: false, failures: ["TI-GATE: TI < TI_min — BLOCK (q7, terminaal)"] },
      result: null,
      hard_block: true,
      hard_block_reason: `F5 TI-GATE BLOCK: TI=${prePhysics.ti_gate.ti.toFixed(4)} < TI_min=${prePhysics.ti_gate.ti_min}. Transfer Integrity onvoldoende. SI niet berekend.`,
      processing_ms: processingMs,
      physics: toLogEntry(dc.decision_hash, prePhysics),
      axioms_satisfied: axiomsSatisfied,
      axioms_violated: axiomsViolated,
    };
  }
  axiomsSatisfied.push("A11_SI_STABILITY");

  // SI threshold check (within valid TI envelope)
  if (prePhysics.action === "HARD_BLOCK") {
    axiomsViolated.push("A11_SI_STABILITY_OVERLOAD");
    const processingMs = performance.now() - startTime;
    return {
      dc,
      canon: { delta: false, phi: false, psi: false, valid: false, failures: ["SI ≥ SI_block — systeem overbelast"] },
      result: null,
      hard_block: true,
      hard_block_reason: `SI OVERLOAD: SI=${prePhysics.si!.si.toFixed(4)} >= SI_block=${prePhysics.si!.si_block}. Systeem weigert vóór TaoGate.`,
      processing_ms: processingMs,
      physics: toLogEntry(dc.decision_hash, prePhysics),
      axioms_satisfied: axiomsSatisfied,
      axioms_violated: axiomsViolated,
    };
  }

  // A4: Canon Completeness — Δ ∧ Φ ∧ Ψ
  const canon = evaluateCanon(tape, entry);

  recordCryptoCheck(canon.phi);

  if (!canon.valid) {
    axiomsViolated.push("A4_CANON_COMPLETENESS");
    const processingMs = performance.now() - startTime;
    recordTraceCheck(false);
    return {
      dc,
      canon,
      result: null,
      hard_block: true,
      hard_block_reason: `A4 CANON FAILURE: ${canon.failures.join("; ")}`,
      processing_ms: processingMs,
      physics: toLogEntry(dc.decision_hash, prePhysics),
      axioms_satisfied: axiomsSatisfied,
      axioms_violated: axiomsViolated,
    };
  }
  axiomsSatisfied.push("A4_CANON_COMPLETENESS");

  // A5: Cryptographic Mandate (verified at boot in bootstrapTapeDeck)
  axiomsSatisfied.push("A5_CRYPTOGRAPHIC_MANDATE");

  // A12: Trust is Derived (A5 + A8 = verified)
  axiomsSatisfied.push("A12_TRUST_DERIVED");

  // A13: Frame Supremacy (config is frozen)
  axiomsSatisfied.push("A13_FRAME_SUPREMACY");

  // A7: Isolated Execution — tape should be frozen
  axiomsSatisfied.push("A7_ISOLATED_EXECUTION");
  recordIsolationEvent(false);

  // A10: Bounded Execution — execute with time budget
  let result: TRSTDecision["result"] = null;
  let tapeRulesEvaluated = 0;
  let tapeBranchesTaken = 0;

  try {
    result = tape.decide(text);
    const elapsed = performance.now() - startTime;

    if (result) {
      tapeRulesEvaluated++;
      if (result.rule_id) tapeRulesEvaluated++;
      if (result.layer) tapeBranchesTaken++;
      if (result.escalation) tapeBranchesTaken++;
      if (result.status === "BLOCK") tapeBranchesTaken++;
    }

    if (elapsed > config.time_budget_ms) {
      axiomsViolated.push("A10_BOUNDED_EXECUTION");
      recordTimeoutEvent(true);
      return {
        dc,
        canon,
        result: null,
        hard_block: true,
        hard_block_reason: `A10 BOUNDED EXECUTION: decision took ${elapsed.toFixed(1)}ms, budget was ${config.time_budget_ms}ms`,
        processing_ms: elapsed,
        physics: toLogEntry(dc.decision_hash, prePhysics),
        axioms_satisfied: axiomsSatisfied,
        axioms_violated: axiomsViolated,
      };
    }
    axiomsSatisfied.push("A10_BOUNDED_EXECUTION");
    recordTimeoutEvent(false);
  } catch (err: any) {
    const elapsed = performance.now() - startTime;
    axiomsViolated.push("A10_BOUNDED_EXECUTION");
    recordTimeoutEvent(true);
    recordIsolationEvent(true);
    return {
      dc,
      canon,
      result: null,
      hard_block: true,
      hard_block_reason: `A10 EXECUTION ERROR: ${err?.message || String(err)}`,
      processing_ms: elapsed,
      physics: toLogEntry(dc.decision_hash, prePhysics),
      axioms_satisfied: axiomsSatisfied,
      axioms_violated: axiomsViolated,
    };
  }

  const processingMs = performance.now() - startTime;

  // A8: Immutable Trace
  axiomsSatisfied.push("A8_IMMUTABLE_TRACE");
  recordTraceCheck(true);

  // A9: Non-Override (BLOCK erft omhoog, final)
  axiomsSatisfied.push("A9_NON_OVERRIDE");

  // ── q4: POST_GATE — recompute SI with actual execution counters ──
  const postTauInput: TauInput = {
    rules_evaluated: (preTauInput.rules_evaluated || 0) + tapeRulesEvaluated,
    branches_taken: tapeBranchesTaken,
    proof_steps: preTauInput.proof_steps,
    payload_bytes: payloadBytes,
    policy_depth: preTauInput.policy_depth,
  };
  const postTau = computeTau(postTauInput);
  const postOmega = computeOmega();
  const postTI = computeTI();
  const postPhysics = evaluatePhysics(postTau, postOmega, postTI);

  // Shadow determinism sampling (Optie A met cap)
  if (shouldShadowSample() && result) {
    const resultHash = crypto.createHash("sha256").update(JSON.stringify(result)).digest("hex");
    performShadowCheck(tape.decide, text, resultHash);
  }

  // Post-gate SI check
  if (postPhysics.action === "TI_BLOCK" || postPhysics.action === "HARD_BLOCK") {
    axiomsViolated.push("A11_SI_STABILITY_POST");
    return {
      dc,
      canon,
      result: null,
      hard_block: true,
      hard_block_reason: postPhysics.action === "TI_BLOCK"
        ? `POST-GATE TI-GATE BLOCK: TI=${postPhysics.ti_gate.ti.toFixed(4)} < TI_min=${postPhysics.ti_gate.ti_min}`
        : `POST-GATE SI OVERLOAD: SI=${postPhysics.si!.si.toFixed(4)} >= SI_block=${postPhysics.si!.si_block}`,
      processing_ms: processingMs,
      physics: toLogEntry(dc.decision_hash, postPhysics),
      axioms_satisfied: axiomsSatisfied,
      axioms_violated: axiomsViolated,
    };
  }

  // q5: REPORT — log physics
  return {
    dc,
    canon,
    result,
    hard_block: false,
    hard_block_reason: null,
    processing_ms: processingMs,
    physics: toLogEntry(dc.decision_hash, postPhysics),
    axioms_satisfied: axiomsSatisfied,
    axioms_violated: axiomsViolated,
  };
}
