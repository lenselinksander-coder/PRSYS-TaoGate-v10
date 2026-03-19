// server/vector_engine/index.ts
//
// Public API van de Vector Legitimacy Engine.
//
// Importeer vanuit pipeline-code via:
//   import { evaluateVector } from "../vector_engine"
//   import type { GateVector, VectorDecision, VectorEvaluation } from "../vector_engine"
//
// Interne logica (stability.ts, vector.ts) is niet publiek.

/** Evalueer drie governance-dimensies (mandate, integrity, load) en geef een GO/HOLD/NO_GO beslissing. */
export { evaluateVector } from "./vector";

export type { GateVector, VectorDecision, VectorEvaluation } from "./vector";

/** Drempelwaarde waarbij de vector NO_GO geeft wegens systeeminstabiliteit. */
export { STABILITY_NO_GO } from "./stability";

/** Drempelwaarde waarbij de vector HOLD geeft als waarschuwing voor verminderde stabiliteit. */
export { STABILITY_HOLD } from "./stability";
