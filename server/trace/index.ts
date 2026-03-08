// server/trace/index.ts
//
// Public API van de Trace laag (Hypatia + Phronesis).
//
// Importeer vanuit pipeline-code via:
//   import { hypatiaRisk, classifyDpiaLevel, phronesisCapacity } from "../trace"
//   import type { HypatiaResult, DpiaLevel, PhronesisResult } from "../trace"
//
// Interne trace-logica (traceRunner, drempelconstanten) is niet publiek.

/** Bereken risico (Impact × Probability) en bepaal de Hypatia gate-beslissing. */
export { hypatiaRisk } from "./hypatia";

/** Classificeer het DPIA-niveau (0–5) op basis van een risicoscore. */
export { classifyDpiaLevel } from "./hypatia";

/** Labels voor DPIA-niveaus conform AVG artikel 35. */
export { DPIA_LEVEL_LABELS } from "./hypatia";

export type { HypatiaResult, HypatiaDecision, DpiaLevel } from "./hypatia";

/** Bereken beschikbare beslissingsruimte (SI = τ × ω) en escaleer bij overbelasting. */
export { phronesisCapacity } from "./phronesis";

export type { PhronesisResult } from "./phronesis";
