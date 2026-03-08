// server/fsm/index.ts
//
// Public API van de Gate FSM laag.
//
// Importeer vanuit pipeline-code via:
//   import { orchestrateGate } from "../fsm"
//   import type { GateStateContext, GateMachineContext } from "../fsm"
//
// Interne details (gateMachine, XState-configuratie) zijn niet publiek.

/** Run the gate FSM for one classify request. Never rejects — any error resolves as BLOCK. */
export { orchestrateGate } from "./gateOrchestrator";

export type {
  GateMachineContext,
  GateStateContext,
  IdleContext,
  EvaluatingContext,
  BlockedContext,
  PassedContext,
  PassedTransparentContext,
  EscalatedHumanContext,
  EscalatedRegulatoryContext,
  TerminalGateContext,
  PreflightOk,
} from "./gateTypes";

export { isPassContext, isBlockedContext } from "./gateTypes";
