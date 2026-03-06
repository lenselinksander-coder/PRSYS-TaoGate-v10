// server/fsm/gateMachine.ts
//
// XState v5 state machine for gate evaluation lifecycle.
//
// State graph:
//   evaluating → blocked             (terminal)
//              → passed              (terminal)
//              → passed_transparent  (terminal)
//              → escalated_human     (terminal)
//              → escalated_regulatory (terminal)
//
// Input is provided at actor-creation time via createActor(gateLogic, { input }).
// Each terminal state emits a typed output (GateResult) via snapshot.output.

import { setup, assign, fromPromise } from "xstate";
import type { GateProfile } from "@shared/schema";
import type { GateResult } from "../gateSystem";
import { runGateWasm } from "../gateSystem";
import type { GateMachineContext } from "./gateTypes";
import type { GateInput, GateOutput } from "./gateOrchestrator";

// ── BLOCK fallback result (used when the sandbox itself errors) ───────────────

function sandboxBlockResult(): GateResult {
  return {
    status: "BLOCK",
    layer: "SYSTEM",
    band: "SANDBOX_ERROR",
    pressure: "CRITICAL",
    escalation: "SYSTEM_ADMIN",
    reason: "Gate evaluation error — geblokkeerd als fail-safe (sandbox fout).",
    signals: null,
  };
}

// ── Machine definition ────────────────────────────────────────────────────────

export const gateLogic = setup({
  types: {
    input: {} as GateInput,
    output: {} as GateOutput,
    context: {} as GateMachineContext,
  },
  actors: {
    // evaluateGate: runs the gate inside the QuickJS WASM sandbox (Feature 1).
    // The WASM VM is hermetic (no I/O) with fuel-based instruction-counter
    // termination. Errors are handled by the onError transition → blocked.
    evaluateGate: fromPromise<GateResult, { input: string; profile: GateProfile }>(
      async ({ input: actorInput }) => {
        return runGateWasm(actorInput.input, actorInput.profile);
      },
    ),
  },
}).createMachine({
  id: "gate",
  initial: "evaluating",
  context: ({ input }) => ({
    input: input.text,
    profile: input.profile,
    result: null,
  }),
  output: ({ context }) => context.result as GateOutput,
  states: {
    evaluating: {
      invoke: {
        src: "evaluateGate",
        input: ({ context }) => ({
          input: context.input!,
          profile: context.profile!,
        }),
        onDone: [
          {
            // BLOCK: hard stop — no further processing allowed
            guard: ({ event }) => event.output.status === "BLOCK",
            target: "blocked",
            actions: assign({
              result: ({ event }) => event.output,
            }),
          },
          {
            // PASS: clean pass — downstream execution permitted
            guard: ({ event }) => event.output.status === "PASS",
            target: "passed",
            actions: assign({
              result: ({ event }) => event.output,
            }),
          },
          {
            // PASS_WITH_TRANSPARENCY: permitted but must be logged
            guard: ({ event }) => event.output.status === "PASS_WITH_TRANSPARENCY",
            target: "passed_transparent",
            actions: assign({
              result: ({ event }) => event.output,
            }),
          },
          {
            // ESCALATE_HUMAN: human review required before execution
            guard: ({ event }) => event.output.status === "ESCALATE_HUMAN",
            target: "escalated_human",
            actions: assign({
              result: ({ event }) => event.output,
            }),
          },
          {
            // ESCALATE_REGULATORY: regulatory body review required
            target: "escalated_regulatory",
            actions: assign({
              result: ({ event }) => event.output,
            }),
          },
        ],
        onError: {
          // Any gate evaluation error is treated as BLOCK (fail-safe principle)
          target: "blocked",
          actions: assign({
            result: () => sandboxBlockResult(),
          }),
        },
      },
    },

    // ── Terminal states ───────────────────────────────────────────────────────
    // Each maps 1:1 to a GateResult.status value.
    // output: forwards context.result as the typed machine output.

    passed: { type: "final", output: ({ context }) => context.result as GateOutput },
    passed_transparent: { type: "final", output: ({ context }) => context.result as GateOutput },
    blocked: { type: "final", output: ({ context }) => context.result as GateOutput },
    escalated_human: { type: "final", output: ({ context }) => context.result as GateOutput },
    escalated_regulatory: { type: "final", output: ({ context }) => context.result as GateOutput },
  },
});

/** @deprecated Use gateLogic instead. */
export const gateMachine = gateLogic;
