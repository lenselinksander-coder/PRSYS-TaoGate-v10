/**
 * syncRegister.ts
 *
 * Orchestrates the full deterministic ingestion path:
 *   1. Fetch the Algoritmeregister
 *   2. Adapt each item into PRSYS pipeline input
 *   3. Run the existing PRSYS pipeline (Argos → … → TaoGate)
 *   4. Map the lattice decision to a public integration decision
 *   5. Write the result to Tabularium (WORM audit chain)
 *
 * No LLM calls, no randomness — same input ⇒ same output.
 */

import crypto from "crypto";
import { fetchRegister } from "./fetchRegister";
import { adaptRegisterItem, serializeToText } from "./registerAdapter";
import { runPipeline } from "../../pipeline";
import { appendWormEntry } from "../../audit/wormChain";

// ── Public shapes ────────────────────────────────────────────────────────────

export interface AlgorithmDecisionOutput {
  algorithm_id: string;
  organization: string;
  decision: "APPROVED" | "ESCALATE" | "BLOCK";
  risk_score: number;
  triggered_rules: string[];
  timestamp: string;
}

// ── Deterministic hash over a decision record ────────────────────────────────

/**
 * Computes a deterministic SHA-256 hash over the decision record.
 * The same record always produces the same hash (canonical key ordering).
 */
function computeDecisionHash(record: AlgorithmDecisionOutput): string {
  const canonical = JSON.stringify(record, Object.keys(record).sort() as any);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ── Lattice → integration decision mapping ───────────────────────────────────

function mapLatticeDecision(
  lattice: string
): AlgorithmDecisionOutput["decision"] {
  if (lattice === "BLOCK") return "BLOCK";
  if (lattice.startsWith("ESCALATE")) return "ESCALATE";
  return "APPROVED";
}

// ── Pipeline step → triggered rules ─────────────────────────────────────────

/**
 * Extracts rule-like identifiers from pipeline steps that reached a
 * non-PASS decision.  Deterministic: steps are ordered by the pipeline.
 */
function extractTriggeredRules(
  steps: Array<{ name: string; decision: string; detail: string }>
): string[] {
  const rules: string[] = [];
  for (const step of steps) {
    const d = step.decision;
    if (
      d === "BLOCK" ||
      d.startsWith("ESCALATE") ||
      d === "PASS_WITH_TRANSPARENCY"
    ) {
      rules.push(`${step.name}:${step.decision}`);
    }
  }
  return rules;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Runs every algorithm in the Algoritmeregister through the PRSYS pipeline
 * and returns a governance decision for each.
 *
 * Results are also written to the Tabularium (WORM audit chain).
 */
export async function syncAlgoritmeregister(): Promise<
  AlgorithmDecisionOutput[]
> {
  const rawItems = await fetchRegister();
  const outputs: AlgorithmDecisionOutput[] = [];
  // Single timestamp for the entire sync run — all decisions from one run
  // share the same timestamp, improving audit traceability.
  const syncTimestamp = new Date().toISOString();

  for (const rawItem of rawItems) {
    const adapted = adaptRegisterItem(rawItem);
    const inputText = serializeToText(adapted);

    // Run the deterministic PRSYS pipeline
    const pipelineResult = await runPipeline({
      input: inputText,
      profile: "GENERAL",
      // Use sensible defaults for numeric params;
      // impact/probability are derived from text length inside runPipeline
      // when not explicitly set, keeping this deterministic.
    });

    const latticeDecision = pipelineResult.lattice.D_final;
    const decision = mapLatticeDecision(latticeDecision);
    // risk_score: use Hypatia risk (0..1), round to 4 decimal places
    const risk_score =
      Math.round(pipelineResult.hypatia.risk * 10000) / 10000;
    const triggered_rules = extractTriggeredRules(pipelineResult.steps);
    const timestamp = syncTimestamp;

    const output: AlgorithmDecisionOutput = {
      algorithm_id: rawItem.id,
      organization: rawItem.organization,
      decision,
      risk_score,
      triggered_rules,
      timestamp,
    };

    const decision_hash = computeDecisionHash(output);

    // ── Write to Tabularium (WORM audit chain) ───────────────────────────
    appendWormEntry({
      orgId: "algoritmeregister_sync",
      connectorId: rawItem.id,
      inputText: inputText,
      decision: latticeDecision,
      category: "algoritmeregister",
      layer: "NATIONAL",
      pressure: String(risk_score),
      processingMs: pipelineResult.processingMs,
    });

    // Store full audit record in the WORM chain as a second entry that
    // carries the decision_hash and the complete output for traceability.
    appendWormEntry({
      orgId: "algoritmeregister_sync",
      connectorId: `${rawItem.id}:audit`,
      inputText: JSON.stringify({
        actor: "algoritmeregister_sync",
        object: rawItem.id,
        action: "taogate_evaluation",
        timestamp,
        decision_hash,
        record: output,
      }),
      decision: latticeDecision,
      category: "taogate_evaluation",
      layer: "NATIONAL",
      pressure: String(risk_score),
      processingMs: pipelineResult.processingMs,
    });

    outputs.push(output);
  }

  return outputs;
}
