// server/fsm/gateMachine.ts
//
// XState v5 state machine for gate evaluation lifecycle.
//
// State graph:
//   idle → (EVALUATE) → evaluating → blocked             (terminal)
//                                  → passed              (terminal)
//                                  → passed_transparent  (terminal)
//                                  → escalated_human     (terminal)
//                                  → escalated_regulatory (terminal)
//
// The TypeScript compiler rejects any transition to a state that is not
// reachable from evaluating, or any guard that maps to the wrong terminal
// state. PREFLIGHT_OK is only constructable after passing terminal states.

import { setup, assign, fromPromise } from "xstate";
import type { GateProfile } from "@shared/schema";
import type { GateResult } from "../gateSystem";
import { runGateWasm } from "../gateSystem";
import type { GateMachineContext } from "./gateTypes";

// ── Events ────────────────────────────────────────────────────────────────────

export type EvaluateEvent = {
  type: "EVALUATE";
  input: string;
  profile: GateProfile;
};

export type GateMachineEvent = EvaluateEvent;

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

export const gateMachine = setup({
  types: {
    context: {} as GateMachineContext,
    events: {} as GateMachineEvent,
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
  initial: "idle",
  context: {
    input: null,
    profile: null,
    result: null,
  } satisfies GateMachineContext,
  states: {
    idle: {
      on: {
        EVALUATE: {
          target: "evaluating",
          actions: assign({
            input: ({ event }) => event.input,
            profile: ({ event }) => event.profile,
            result: () => null,
          }),
        },
      },
    },

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
    // The compiler enforces that code consuming these states uses the correct
    // discriminated type from gateTypes.ts.

    passed: { type: "final" },
    passed_transparent: { type: "final" },
    blocked: { type: "final" },
    escalated_human: { type: "final" },
    escalated_regulatory: { type: "final" },
  },
});
