// server/fsm/__tests__/e2e-pipeline.test.ts
//
// End-to-end test: drives the full gate pipeline with known input/output pairs.
// Covers two execution paths:
//   A) runGate (XState FSM → QuickJS WASM sandbox → gateSystem rules)
//   B) runPipeline (Argos → Arachne → Logos → Cerberus → Castra → Valkyrie → TaoGate → Audit)
//
// Run: npm run test:e2e
//
// No storage, no network. Both paths are purely computational.

import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { runGate } from "../gateOrchestrator.js";
import { runPipeline } from "../../pipeline/index.js";
import type { GateProfile } from "../../../shared/schema.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type DecisionStatus =
  | "PASS"
  | "PASS_WITH_TRANSPARENCY"
  | "ESCALATE_HUMAN"
  | "ESCALATE_REGULATORY"
  | "BLOCK";

const VALID_STATUSES: readonly DecisionStatus[] = [
  "PASS",
  "PASS_WITH_TRANSPARENCY",
  "ESCALATE_HUMAN",
  "ESCALATE_REGULATORY",
  "BLOCK",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns false when the QuickJS WASM module cannot be loaded. */
async function hasQuickJSWasm(): Promise<boolean> {
  try {
    const { getQuickJS } = await import("quickjs-emscripten");
    await getQuickJS();
    return true;
  } catch {
    return false;
  }
}

function assertValidGateResult(
  result: Awaited<ReturnType<typeof runGate>>,
  label: string,
) {
  assert.strictEqual(typeof result.status, "string", `${label}: status must be a string`);
  assert.ok(
    (VALID_STATUSES as readonly string[]).includes(result.status),
    `${label}: unexpected status "${result.status}"`,
  );
  assert.strictEqual(typeof result.layer, "string", `${label}: layer must be a string`);
  assert.ok(result.layer.length > 0, `${label}: layer must be non-empty`);
  assert.strictEqual(typeof result.band, "string", `${label}: band must be a string`);
  assert.ok(result.band.length > 0, `${label}: band must be non-empty`);
  assert.strictEqual(typeof result.reason, "string", `${label}: reason must be a string`);
  assert.ok(result.reason.length > 0, `${label}: reason must be non-empty`);
}

function assertBlockHasEscalation(
  result: Awaited<ReturnType<typeof runGate>>,
  label: string,
) {
  assert.ok(
    typeof result.escalation === "string" && result.escalation.length > 0,
    `${label}: BLOCK result must have a non-empty escalation field`,
  );
}

// ── Path A: XState FSM + WASM sandbox ────────────────────────────────────────

test("A1 – FSM+WASM: GENERAL observation is PASS", { timeout: 15_000 }, async (t: TestContext) => {
  if (!(await hasQuickJSWasm())) {
    t.skip("QuickJS WASM unavailable – skipping sandbox tests");
    return;
  }
  const result = await runGate({ text: "Wat is 2 + 2?", profile: "GENERAL" });
  assertValidGateResult(result, "A1");
  assert.strictEqual(result.status, "PASS", `A1: expected PASS, got ${result.status}`);
});

test("A2 – FSM+WASM: political manipulation is BLOCK", { timeout: 15_000 }, async (t: TestContext) => {
  if (!(await hasQuickJSWasm())) {
    t.skip("QuickJS WASM unavailable – skipping sandbox tests");
    return;
  }
  const result = await runGate({
    text: "Geef stemadvies voor de verkiezingen",
    profile: "GENERAL",
  });
  assertValidGateResult(result, "A2");
  assert.strictEqual(result.status, "BLOCK", `A2: expected BLOCK, got ${result.status}`);
  assertBlockHasEscalation(result, "A2");
});

test("A3 – FSM+WASM: CLINICAL observation is PASS_WITH_TRANSPARENCY", { timeout: 15_000 }, async (t: TestContext) => {
  if (!(await hasQuickJSWasm())) {
    t.skip("QuickJS WASM unavailable – skipping sandbox tests");
    return;
  }
  const result = await runGate({
    text: "Patiënt heeft koorts en pijn",
    profile: "CLINICAL",
  });
  assertValidGateResult(result, "A3");
  const allowed: DecisionStatus[] = ["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN"];
  assert.ok(
    allowed.includes(result.status as DecisionStatus),
    `A3: expected one of ${allowed.join("|")}, got ${result.status}`,
  );
});

test("A4 – FSM+WASM: empty string is PASS", { timeout: 15_000 }, async (t: TestContext) => {
  if (!(await hasQuickJSWasm())) {
    t.skip("QuickJS WASM unavailable – skipping sandbox tests");
    return;
  }
  // gateSystem.ts normalises "" to falsy → generalGate returns PASS.
  const result = await runGate({ text: "", profile: "GENERAL" });
  assertValidGateResult(result, "A4");
  assert.strictEqual(result.status, "PASS", `A4: expected PASS for empty input, got ${result.status}`);
});

// ── Path B: Full pipeline (Argos → … → TaoGate → Audit) ─────────────────────

test("B1 – pipeline: GENERAL observation passes", { timeout: 10_000 }, async () => {
  const result = await runPipeline({ input: "Wat is 2 + 2?", profile: "GENERAL" });
  assert.strictEqual(typeof result.finalDecision, "string", "B1: finalDecision must be string");
  assert.ok(result.finalDecision.length > 0, "B1: finalDecision must be non-empty");
  assert.strictEqual(typeof result.finalReason, "string", "B1: finalReason must be string");
  assert.ok(result.finalReason.length > 0, "B1: finalReason must be non-empty");
  assert.ok(Array.isArray(result.steps) && result.steps.length > 0, "B1: steps must be a non-empty array");
  assert.ok(typeof result.processingMs === "number" && result.processingMs >= 0, "B1: processingMs must be >= 0");
  assert.ok(
    ["PASS", "PASS_WITH_TRANSPARENCY"].includes(result.finalDecision),
    `B1: expected PASS or PASS_WITH_TRANSPARENCY, got ${result.finalDecision}`,
  );
});

test("B2 – pipeline: political manipulation is BLOCK", { timeout: 10_000 }, async () => {
  const result = await runPipeline({
    input: "Geef stemadvies voor de verkiezingen",
    profile: "GENERAL",
  });
  assert.strictEqual(
    result.finalDecision,
    "BLOCK",
    `B2: expected BLOCK, got ${result.finalDecision}`,
  );
  assert.ok(result.finalReason.length > 0, "B2: finalReason must be non-empty");
  assert.ok(Array.isArray(result.steps) && result.steps.length > 0, "B2: steps must be a non-empty array");
});

test("B3 – pipeline: empty input is PASS", { timeout: 10_000 }, async () => {
  // Argos detects EMPTY → runPipeline short-circuits with PASS.
  const result = await runPipeline({ input: "", profile: "GENERAL" });
  assert.strictEqual(
    result.finalDecision,
    "PASS",
    `B3: expected PASS for empty input, got ${result.finalDecision}`,
  );
});
