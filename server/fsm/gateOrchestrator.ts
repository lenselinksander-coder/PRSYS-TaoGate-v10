// server/fsm/gateOrchestrator.ts
//
// Async wrapper around the XState gate machine actor.
// Creates a fresh actor per classify request, drives it, and resolves
// with the GateResult when the machine reaches any terminal state.
//
// Cerberus guarantee: this function NEVER rejects. Any internal failure
// (machine error state, missing result) resolves as BLOCK — the absolute
// fail-safe. Callers must never be able to bypass the gate via an exception.

import { createActor } from "xstate";
import { gateMachine } from "./gateMachine";
import type { GateProfile } from "@shared/schema";
import type { GateResult } from "../gateSystem";

// ── Cerberus fail-safe BLOCK (returned on orchestrator-level failures) ─────────

function orchestratorBlockResult(): GateResult {
  return {
    status: "BLOCK",
    layer: "SYSTEM",
    band: "ORCHESTRATOR_ERROR",
    pressure: "CRITICAL",
    escalation: "SYSTEM_ADMIN",
    reason: "Gate orchestrator fout — geblokkeerd als fail-safe (Cerberus).",
    signals: null,
  };
}

/**
 * Run the gate FSM for one classify request.
 * Returns the GateResult when the machine completes (any terminal state).
 * Never rejects — any machine error or missing result resolves as BLOCK
 * (Cerberus absolute boundary: no exception can bypass the gate).
 */
export async function orchestrateGate(
  input: string,
  profile: GateProfile,
): Promise<GateResult> {
  return new Promise<GateResult>((resolve) => {
    const actor = createActor(gateMachine);

    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.status === "done") {
        // Cerberus: missing result is treated as BLOCK, not as an exception
        subscription.unsubscribe();
        resolve(snapshot.context.result ?? orchestratorBlockResult());
        actor.stop();
      } else if (snapshot.status === "error") {
        // Cerberus: machine error state is treated as BLOCK, not rethrown
        subscription.unsubscribe();
        resolve(orchestratorBlockResult());
        actor.stop();
      }
    });

    actor.start();
    actor.send({ type: "EVALUATE", input, profile });
  });
}
