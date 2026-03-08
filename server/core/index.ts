// server/core/index.ts
//
// Public API van de Core laag (TapeDeck + TRST).
//
// Importeer vanuit routes via:
//   import { bootstrapTapeDeck, getTapeDeck } from "../core"
//   import { bootstrapTRST, getTRSTConfig, executeTaoGate } from "../core"
//
// Interne setup-details (physics, euBaseline, euLegalGate) zijn alleen via
// de expliciete exports hieronder publiek.

/** Initialiseer de TapeDeck vanuit het manifest. Faalt hard bij ongeldige tapes. */
export { bootstrapTapeDeck, getTapeDeck } from "./init";

export type { TapeDeck, TapeModule } from "./init";

/** Initialiseer de TRST runtime-configuratie (eenmalig; Frame Supremacy). */
export { bootstrapTRST, getTRSTConfig } from "./trst";

/** Voer een TaoGate-beslissing uit voor één tape. Nooit een uitzondering. */
export { executeTaoGate, freezeTapeModule } from "./trst";

export type {
  TRSTConfig,
  TRSTDecision,
  DecisionContext,
  CanonStatus,
} from "./trst";

/** Voer de EU AI Act Legal Gate uit (TAPE-EU2). */
export { runEuLegalGate, formatEuBlockAsGateResponse } from "./euLegalGate";

/** EU AI Act Baseline Scope — altijd actief, niet uitschakelbaar. */
export { EU_BASELINE_SCOPE } from "./euBaseline";
