// server/prsys/canon/decisionLattice.ts
//
// Formal decision lattice for the TaoGate decision calculus.
//
// Lattice order (ascending restrictiveness):
//
//   PASS < PASS_WITH_TRANSPARENCY < ESCALATE_HUMAN < ESCALATE_REGULATORY < BLOCK
//
// Key formula:
//   D_final = maxDecision(D_gate, D_scope)
//
// This ensures the gate decision is the absolute lower bound: a scope or
// runtime decision can only tighten a passing gate result, never loosen it.
// This property is the mathematical foundation of the Cerberus boundary.

import type { GateDecision } from "@shared/schema";

// ── Lattice definition ────────────────────────────────────────────────────────
// Index in this array is the lattice rank: higher = more restrictive.

const LATTICE: readonly GateDecision[] = [
  "PASS",
  "PASS_WITH_TRANSPARENCY",
  "ESCALATE_HUMAN",
  "ESCALATE_REGULATORY",
  "BLOCK",
] as const;

function rankOf(d: GateDecision): number {
  const idx = LATTICE.indexOf(d);
  // Unknown decisions are treated as maximally restrictive (BLOCK rank)
  return idx === -1 ? LATTICE.length - 1 : idx;
}

/**
 * Compare two gate decisions by lattice rank.
 *
 * Returns:
 *  -1  if `a` is less restrictive than `b`  (a < b)
 *   0  if `a` and `b` are equally restrictive (a = b)
 *   1  if `a` is more restrictive than `b`  (a > b)
 */
export function compareDecision(a: GateDecision, b: GateDecision): -1 | 0 | 1 {
  const ra = rankOf(a);
  const rb = rankOf(b);
  if (ra < rb) return -1;
  if (ra > rb) return 1;
  return 0;
}

/**
 * Return the more restrictive of two gate decisions.
 *
 *   D_final = maxDecision(D_gate, D_scope)
 *
 * This is the Cerberus enforcement formula: the gate decision is the absolute
 * lower bound. If `b` is absent or null/undefined, `a` is returned unchanged.
 */
export function maxDecision(
  a: GateDecision,
  b?: GateDecision | null,
): GateDecision {
  if (b == null) return a;
  return rankOf(a) >= rankOf(b) ? a : b;
}

/**
 * Return the complete ordered lattice array (ascending restrictiveness).
 * Useful for UI rendering and documentation.
 */
export function getLattice(): readonly GateDecision[] {
  return LATTICE;
}
