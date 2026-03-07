// server/vector_engine/index.ts
//
// Public API van de Vector Legitimacy Engine.
//
// Importeer vanuit pipeline-code via:
//   import { evaluateVector } from "../vector_engine"
//   import type { GateVector, VectorDecision, VectorEvaluation } from "../vector_engine"

export { evaluateVector } from "./vector";
export type { GateVector, VectorDecision, VectorEvaluation } from "./vector";
export { STABILITY_NO_GO, STABILITY_HOLD } from "./stability";
