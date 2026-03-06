// server/fsm/gateOrchestrator.ts
//
// Typed async wrapper around the XState gate machine actor.
// Creates a fresh actor per classify request, starts it with typed input,
// and resolves/rejects when the machine reaches a terminal state.

import { createActor, ActorRefFrom, SnapshotFrom } from "xstate";
import { gateLogic } from "./gateMachine";
import type { GateProfile } from "@shared/schema";
import type { GateResult } from "../gateSystem";

// ── Public types ──────────────────────────────────────────────────────────────

export interface GateInput {
  text: string;
  profile: GateProfile;
}

export type GateOutput = GateResult;

export interface GateError {
  message: string;
  code?: string;
  cause?: unknown;
}

// ── Internal actor types ──────────────────────────────────────────────────────

type GateActor = ActorRefFrom<typeof gateLogic>;
type GateSnapshot = SnapshotFrom<typeof gateLogic>;

// ── runGate ───────────────────────────────────────────────────────────────────

/**
 * Run the gate FSM for one classify request.
 *
 * Resolves with GateOutput when the machine reaches any terminal state.
 * Rejects with GateError if the machine enters an error state.
 *
 * Subscription is explicitly unsubscribed and the actor stopped in both
 * terminal branches to prevent event-loop retention.
 */
export function runGate(input: GateInput): Promise<GateOutput> {
  const actor: GateActor = createActor(gateLogic, { input }).start();

  return new Promise<GateOutput>((resolve, reject) => {
    const subscription = actor.subscribe((snapshot: GateSnapshot) => {
      // Done-pad: strikt getypt via snapshot.output
      if (snapshot.status === "done") {
        subscription.unsubscribe();
        actor.stop();
        resolve(snapshot.output as GateOutput);
        return;
      }

      // Error-pad: strikt getypt via snapshot.error
      if (snapshot.status === "error") {
        subscription.unsubscribe();
        actor.stop();
        reject(snapshot.error as GateError);
      }
    });
  });
}

// ── orchestrateGate (backward-compat shim) ────────────────────────────────────

/**
 * @deprecated Use runGate({ text, profile }) instead.
 *
 * Wraps runGate with the old positional-argument signature and restores the
 * Cerberus fail-safe: any rejection is caught and resolved as BLOCK so that
 * existing callers that expect a never-rejecting Promise keep working.
 */
export async function orchestrateGate(
  text: string,
  profile: GateProfile,
): Promise<GateOutput> {
  return runGate({ text, profile }).catch((): GateOutput => ({
    status: "BLOCK",
    layer: "SYSTEM",
    band: "ORCHESTRATOR_ERROR",
    pressure: "CRITICAL",
    escalation: "SYSTEM_ADMIN",
    reason: "Gate orchestrator fout — geblokkeerd als fail-safe (Cerberus).",
    signals: null,
  }));
}
