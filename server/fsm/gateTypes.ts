// server/fsm/gateTypes.ts
//
// Discriminated union types for the gate FSM.
// Each terminal state has a precisely typed context so that
// the TypeScript compiler validates what fields are accessible.

import type { GateResult } from "../gateSystem";
import type { GateProfile } from "@shared/schema";

// ── Per-state context shapes ─────────────────────────────────────────────────

export type EvaluatingContext = {
  state: "evaluating";
  input: string;
  profile: GateProfile;
  result: null;
};

export type BlockedContext = {
  state: "blocked";
  input: string;
  profile: GateProfile;
  result: GateResult & { status: "BLOCK" };
};

export type PassedContext = {
  state: "passed";
  input: string;
  profile: GateProfile;
  result: GateResult & { status: "PASS" };
};

export type PassedTransparentContext = {
  state: "passed_transparent";
  input: string;
  profile: GateProfile;
  result: GateResult & { status: "PASS_WITH_TRANSPARENCY" };
};

export type EscalatedHumanContext = {
  state: "escalated_human";
  input: string;
  profile: GateProfile;
  result: GateResult & { status: "ESCALATE_HUMAN" };
};

export type EscalatedRegulatoryContext = {
  state: "escalated_regulatory";
  input: string;
  profile: GateProfile;
  result: GateResult & { status: "ESCALATE_REGULATORY" };
};

// ── Union of all terminal (pass/block) contexts ───────────────────────────────

export type TerminalGateContext =
  | BlockedContext
  | PassedContext
  | PassedTransparentContext
  | EscalatedHumanContext
  | EscalatedRegulatoryContext;

// ── Union of all possible contexts ──────────────────────────────────────────

export type GateStateContext = EvaluatingContext | TerminalGateContext;

// ── Flat context used internally by the XState machine ───────────────────────
// XState v5 requires a single context shape. We use a flat union-friendly
// shape and narrow to per-state types in the orchestrator layer.

export type GateMachineContext = {
  input: string | null;
  profile: GateProfile | null;
  result: GateResult | null;
};

// ── PREFLIGHT_OK branded type ────────────────────────────────────────────────
// This type can only be produced when the gate machine reaches a passing
// terminal state. Consumer code that requires an allowed decision must accept
// PreflightOk — the TypeScript compiler rejects any code path that skips the
// machine (the brand is unexported from this module intentionally).

declare const _PREFLIGHT_OK: unique symbol;

export type PreflightOk = {
  readonly [_PREFLIGHT_OK]: true;
  readonly result: GateResult & { status: "PASS" | "PASS_WITH_TRANSPARENCY" };
};

// ── Type guard helpers ───────────────────────────────────────────────────────

export function isPassContext(
  ctx: GateMachineContext,
  value: string,
): ctx is { input: string; profile: GateProfile; result: GateResult & { status: "PASS" | "PASS_WITH_TRANSPARENCY" } } {
  return (
    (value === "passed" || value === "passed_transparent") &&
    ctx.result !== null
  );
}

export function isBlockedContext(
  ctx: GateMachineContext,
  value: string,
): ctx is { input: string; profile: GateProfile; result: GateResult & { status: "BLOCK" } } {
  return value === "blocked" && ctx.result !== null;
}
