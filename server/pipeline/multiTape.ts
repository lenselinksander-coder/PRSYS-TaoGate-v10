// server/pipeline/multiTape.ts
//
// Parallelle multi-tape pipeline orchestrator.
//
// Haalt alle LOCKED tape-scopes op voor de organisatie (gesorteerd op tapeNumber),
// evalueert ze parallel via Promise.all, combineert de beslissingen via latticeMax (I2),
// en produceert één definitieve GateDecision.
//
// Invarianten:
//   A9  Non-Override: BLOCK van hogere canon-laag is terminaal.
//   I2  latticeMax: meest restrictieve beslissing wint altijd.
//   A8  Immutable Trace: elke tape + de finale beslissing worden geaudit.
//   TGA4: geen tape-scopes beschikbaar → ESCALATE_HUMAN (operationele continuïteit).

import { storage } from "../storage";
import { getTapeDeck, executeTaoGate, runEuLegalGate } from "../core";
import { auditLog } from "../audit";
import { latticeMax } from "./types";
import type { Scope } from "@shared/schema";
import type { TRSTDecision } from "../core";

// ── Typen ────────────────────────────────────────────────────────────────────

export interface TapeEvalResult {
  tapeNumber: number | null;
  scopeId: string;
  scopeName: string;
  decision: string;
  reason: string | null;
  layer: string | null;
  ruleId: string | null;
  processingMs: number;
  trstDecision: TRSTDecision;
}

export interface MultiTapePipelineResult {
  orgId: string;
  intent: string;
  euBlocked: boolean;
  euGround: string | null;
  tapeResults: TapeEvalResult[];
  finalDecision: string;
  finalReason: string | null;
  processingMs: number;
}

// ── Interne hulpfunctie ───────────────────────────────────────────────────────

function decideTRST(trst: TRSTDecision): string {
  if (trst.hard_block) return "BLOCK";
  if (!trst.result) return "ESCALATE_HUMAN";
  return trst.result.status;
}

function reasonTRST(trst: TRSTDecision): string | null {
  if (trst.hard_block) return trst.hard_block_reason;
  return trst.result?.reason ?? null;
}

// ── Evalueer één tape-scope ───────────────────────────────────────────────────

async function evalTapeScope(
  scope: Scope,
  intent: string,
  orgId: string,
): Promise<TapeEvalResult> {
  const start = Date.now();
  const tapeDeck = getTapeDeck();

  // Zoek de bijbehorende TapeModule op basis van scopeId of tapeNumber.
  // Fallback: eerste beschikbare tape als geen directe match gevonden.
  const tapeEntries = Array.from(tapeDeck.tapes.entries());
  const matchedEntry = tapeEntries.find(([id]) => id === scope.id)
    ?? tapeEntries.find(([, tape]) => tape.meta.tape_id === String(scope.tapeNumber))
    ?? tapeEntries[0];

  const tape = matchedEntry?.[1];

  if (!tape) {
    // Geen tape beschikbaar voor deze scope — ESCALATE_HUMAN (TGA4-achterstelling)
    const processingMs = Date.now() - start;
    return {
      tapeNumber: scope.tapeNumber,
      scopeId: scope.id,
      scopeName: scope.name,
      decision: "ESCALATE_HUMAN",
      reason: `Geen tape geladen voor scope '${scope.name}' (TGA4-achterstelling).`,
      layer: null,
      ruleId: null,
      processingMs,
      trstDecision: {
        dc: null as any,
        canon: { delta: false, phi: false, psi: false, valid: false, failures: ["TGA4"] },
        result: null,
        hard_block: false,
        hard_block_reason: null,
        processing_ms: processingMs,
        physics: null,
        axioms_satisfied: [],
        axioms_violated: ["TGA4"],
      },
    };
  }

  const trst = executeTaoGate(intent, tape, tapeDeck);
  const decision = decideTRST(trst);
  const reason = reasonTRST(trst);
  const processingMs = Date.now() - start;

  // Per-tape audit (A8 — Immutable Trace)
  auditLog({
    decision,
    orgId,
    connectorId: null,
    inputText: intent,
    endpoint: `MULTI_TAPE_EVAL:scope=${scope.id}`,
    cove: `TAPE_EVAL:tape=${scope.tapeNumber ?? "none"}:scope=${scope.name}`,
    layer: trst.result?.layer ?? null,
    processingMs,
  });

  return {
    tapeNumber: scope.tapeNumber,
    scopeId: scope.id,
    scopeName: scope.name,
    decision,
    reason,
    layer: trst.result?.layer ?? null,
    ruleId: trst.result?.rule_id ?? null,
    processingMs,
    trstDecision: trst,
  };
}

// ── Hoofd-orchestrator ────────────────────────────────────────────────────────

/**
 * Voert de multi-tape pipeline uit voor een organisatie.
 *
 * Stap 1: EU Legal Gate (terminaal bij Art. 5 treffer — BLOCK).
 * Stap 2: Haal alle LOCKED tape-scopes op (gesorteerd op tapeNumber ASC).
 *         Geen tape-scopes → ESCALATE_HUMAN (TGA4).
 * Stap 3: Evalueer alle tapes parallel (Promise.all).
 * Stap 4: Combineer via latticeMax (I2 — BLOCK wint altijd).
 * Stap 5: Audit finale beslissing (A8).
 */
export async function runMultiTapePipeline(
  orgId: string,
  intent: string,
): Promise<MultiTapePipelineResult> {
  const start = Date.now();

  // ── Stap 1: EU Legal Gate (altijd eerst, terminaal) ──────────────────────
  const euResult = runEuLegalGate(intent);
  if (euResult.blocked) {
    const processingMs = Date.now() - start;
    const euGround = euResult.ground ?? null;

    auditLog({
      decision: "BLOCK",
      orgId,
      connectorId: null,
      inputText: intent,
      endpoint: "MULTI_TAPE_EU_GATE",
      cove: "EU_AI_ACT_ART5_BLOCK",
      layer: "EU",
      processingMs,
    });

    return {
      orgId,
      intent,
      euBlocked: true,
      euGround,
      tapeResults: [],
      finalDecision: "BLOCK",
      finalReason: `EU AI Act Art. 5 — absolute weigering. Grond: ${euGround ?? "onbekend"}.`,
      processingMs,
    };
  }

  // ── Stap 2: Haal LOCKED tape-scopes op ──────────────────────────────────
  const tapeScopes = await storage.getTapeScopesByOrg(orgId);

  if (tapeScopes.length === 0) {
    // TGA4: geen tapes geladen — ESCALATE_HUMAN voor operationele continuïteit
    const processingMs = Date.now() - start;

    auditLog({
      decision: "ESCALATE_HUMAN",
      orgId,
      connectorId: null,
      inputText: intent,
      endpoint: "MULTI_TAPE_PIPELINE",
      cove: "TGA4_NO_TAPE_SCOPES",
      processingMs,
    });

    return {
      orgId,
      intent,
      euBlocked: false,
      euGround: null,
      tapeResults: [],
      finalDecision: "ESCALATE_HUMAN",
      finalReason: "TGA4: geen actieve tape-scopes beschikbaar voor deze organisatie — escalatie naar mens.",
      processingMs,
    };
  }

  // ── Stap 3: Parallel evalueren ───────────────────────────────────────────
  const tapeResults = await Promise.all(
    tapeScopes.map((scope: Scope) => evalTapeScope(scope, intent, orgId)),
  );

  // ── Stap 4: latticeMax over alle tape-beslissingen (I2) ──────────────────
  let finalDecision = "PASS";
  let finalReason: string | null = null;

  for (const result of tapeResults) {
    const combined = latticeMax(finalDecision, result.decision);
    if (combined !== finalDecision) {
      finalDecision = combined;
      finalReason = result.reason;
    }
  }

  const processingMs = Date.now() - start;

  // ── Stap 5: Finale audit (A8) ────────────────────────────────────────────
  auditLog({
    decision: finalDecision,
    orgId,
    connectorId: null,
    inputText: intent,
    endpoint: "MULTI_TAPE_PIPELINE",
    cove: `MULTI_TAPE_FINAL:tapes=${tapeResults.length}`,
    processingMs,
  });

  return {
    orgId,
    intent,
    euBlocked: false,
    euGround: null,
    tapeResults,
    finalDecision,
    finalReason,
    processingMs,
  };
}
