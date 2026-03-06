/**
 * registerAdapter.ts
 *
 * Maps a RawRegisterItem (from the Algoritmeregister) into an
 * ArgosAlgorithmInput compatible with the PRSYS governance pipeline.
 *
 * This is a pure, deterministic function with no side effects.
 */

import type { RawRegisterItem } from "./fetchRegister";

// ── Public shapes ────────────────────────────────────────────────────────────

export interface ArgosAlgorithmInput {
  algorithm_id: string;
  scope: string;
  jurisdiction: string;
  mandaat: string;
  impact: string;
  omega: string;
  dataset: string;
  description: string;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Maps a RawRegisterItem to an ArgosAlgorithmInput.
 *
 * Field mapping:
 *   id               → algorithm_id
 *   purpose          → scope
 *   organization     → jurisdiction
 *   legal_basis      → mandaat
 *   impact_category  → impact
 *   human_intervention → omega
 *   dataset          → dataset  (1:1)
 *   description      → description  (1:1)
 */
export function adaptRegisterItem(item: RawRegisterItem): ArgosAlgorithmInput {
  return {
    algorithm_id: item.id,
    scope: item.purpose,
    jurisdiction: item.organization,
    mandaat: item.legal_basis,
    impact: item.impact_category,
    omega: item.human_intervention,
    dataset: item.dataset,
    description: item.description,
  };
}

/**
 * Serialises an ArgosAlgorithmInput into a plain-text string suitable for
 * passing to the PRSYS pipeline's `input` field.
 *
 * The format is deterministic and human-readable.
 */
export function serializeToText(input: ArgosAlgorithmInput): string {
  return [
    `Algorithm: ${input.algorithm_id}`,
    `Scope: ${input.scope}`,
    `Jurisdiction: ${input.jurisdiction}`,
    `Legal basis (mandaat): ${input.mandaat}`,
    `Impact category: ${input.impact}`,
    `Human intervention (omega): ${input.omega}`,
    `Dataset: ${input.dataset}`,
    `Description: ${input.description}`,
  ]
    .filter((line) => {
      const value = line.split(": ").slice(1).join(": ");
      return value.trim() !== "";
    })
    .join("\n");
}
