// server/vector_engine/stability.ts
//
// Wiskundige kern van de Vector Legitimacy Engine.
//
// Stabiliteit meet hoe evenwichtig de drie governance-dimensies zijn.
// Een systeem kan alle afzonderlijke checks doorstaan maar toch instabiel
// zijn als de dimensies sterk van elkaar afwijken.
//
// Model:
//   mean      = (a + b + c) / 3
//   variance  = gemiddelde kwadratische afstand van de mean
//   stability = 1 − √variance
//
// Beslissingsdrempels:
//   stability < STABILITY_NO_GO (0.4) → NO_GO
//   stability < STABILITY_HOLD  (0.7) → HOLD
//   anders                            → GO

/** Minimale stabiliteitsdrempel — onder deze waarde: NO_GO */
export const STABILITY_NO_GO = 0.4 as const;

/** Stabiliteitsdremmpel voor menselijke review — onder deze waarde: HOLD */
export const STABILITY_HOLD = 0.7 as const;

/**
 * Berekent het rekenkundig gemiddelde van drie governance-dimensies.
 * Alle waarden moeten in [0..1] liggen (wordt niet geclamped hier —
 * clamping vindt plaats in evaluateVector).
 */
export function calculateMean(a: number, b: number, c: number): number {
  return (a + b + c) / 3;
}

/**
 * Berekent de variantie: gemiddelde kwadratische afstand van het gemiddelde.
 * Variantie ∈ [0..1] zolang de inputs ∈ [0..1].
 *
 * Maximale variantie is 2/3 (één dimensie=1, twee dimensies=0, of andersom).
 */
export function calculateVariance(a: number, b: number, c: number): number {
  const mean = calculateMean(a, b, c);
  return (
    ((a - mean) ** 2 + (b - mean) ** 2 + (c - mean) ** 2) / 3
  );
}

/**
 * Berekent de stabiliteitscore: 1 − √variance.
 *
 * Stabiliteitsbereik: [1 − √(2/3) ≈ 0.184 .. 1.0]
 * Perfecte balans (alle dimensies gelijk) → stability = 1.0
 * Maximale onbalans (één dimensie tegenover twee) → stability ≈ 0.184
 *
 * @param variance — uitvoer van calculateVariance()
 */
export function calculateStability(variance: number): number {
  return 1 - Math.sqrt(Math.max(0, variance));
}
