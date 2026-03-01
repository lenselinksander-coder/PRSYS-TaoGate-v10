// server/fsm/gateOrchestrator.ts
//
// Async wrapper around the XState gate machine actor.
// Creates a fresh actor per classify request, drives it, and resolves
// with the GateResult when the machine reaches any terminal state.

import { createActor } from "xstate";
import { gateMachine } from "./gateMachine";
import type { GateProfile } from "@shared/schema";
import type { GateResult } from "../gateSystem";

/**
 * Run the gate FSM for one classify request.
 * Returns the GateResult when the machine completes (any terminal state).
 * Never throws — errors inside the machine transition to `blocked` (fail-safe).
 */
export async function orchestrateGate(
  input: string,
  profile: GateProfile,
): Promise<GateResult> {
  return new Promise<GateResult>((resolve, reject) => {
    const actor = createActor(gateMachine);

    actor.subscribe((snapshot) => {
      if (snapshot.status === "done") {
        const result = snapshot.context.result;
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Gate machine reached done state without a result"));
        }
        actor.stop();
      } else if (snapshot.status === "error") {
        reject(new Error("Gate machine entered error state"));
        actor.stop();
      }
    });

    actor.start();
    actor.send({ type: "EVALUATE", input, profile });
  });
}
