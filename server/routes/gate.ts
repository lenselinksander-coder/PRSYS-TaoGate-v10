import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { gateProfiles } from "@shared/schema";
import { getTapeDeck } from "../core/init";
import { executeTaoGate } from "../core/trst";
import { classifyIntent, runPipeline } from "../pipeline";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function registerGateRoutes(app: Express): void {
  app.post("/api/gate", async (req, res) => {
    try {
      const { text, scopeId, tapeId } = req.body as { text?: string; scopeId?: string; tapeId?: string };
      if (!text) return res.status(400).json({ error: "text required" });
      if (!scopeId && !tapeId) return res.status(400).json({ error: "scopeId or tapeId required" });

      const tapeDeck = getTapeDeck();
      if (!tapeDeck || tapeDeck.tapes.size === 0) {
        return res.status(503).json({ error: "tape_deck_empty", message: "No verified tapes loaded. Build and sign tapes first." });
      }

      const tape = tapeId ? tapeDeck.tapes.get(tapeId) : scopeId ? tapeDeck.byScopeId.get(scopeId) : undefined;
      if (!tape) {
        return res.status(404).json({
          error: "tape_not_found",
          message: `No verified tape found for ${tapeId ? `tapeId=${tapeId}` : `scopeId=${scopeId}`}`,
          available: Array.from(tapeDeck.tapes.keys()),
        });
      }

      const decision = executeTaoGate(text, tape, tapeDeck);

      if (decision.hard_block) {
        return res.json({
          status: "HARD_BLOCK", category: "TRST_VIOLATION", escalation: null, rule_id: null,
          layer: "TRST", reason: decision.hard_block_reason, tape_id: decision.dc.tape_id,
          processingMs: decision.processing_ms, lexiconSource: "internal", lexiconDeterministic: "true",
          trst: { decision_context: decision.dc, canon: decision.canon, physics: decision.physics, axioms_satisfied: decision.axioms_satisfied, axioms_violated: decision.axioms_violated },
        });
      }

      return res.json({
        ...decision.result, processingMs: decision.processing_ms, lexiconSource: "internal", lexiconDeterministic: "true",
        trst: { decision_context: decision.dc, canon: decision.canon, physics: decision.physics, axioms_satisfied: decision.axioms_satisfied, axioms_violated: [] },
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: "internal_error", message: errMsg(err) });
    }
  });

  app.post("/api/classify", async (req, res) => {
    try {
      const { text, scopeId } = req.body as { text?: string; scopeId?: string };
      if (!text || !scopeId) return res.status(400).json({ error: "text and scopeId required" });
      const result = await classifyIntent(text, scopeId);
      if (result.error) return res.status(404).json(result);
      return res.json(result);
    } catch (err: unknown) {
      return res.status(500).json({ error: "internal_error", message: errMsg(err) });
    }
  });

  const traceSchema = z.object({
    input: z.string().min(0).max(4000),
    profile: z.enum(gateProfiles).optional(),
    tau: z.number().min(0).max(1000).optional(),
    omega: z.number().min(0).max(1).optional(),
    impact: z.number().min(0).max(1).optional(),
    probability: z.number().min(0).max(1).optional(),
  });

  app.post("/api/trace", async (req, res) => {
    const parsed = traceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.json(await runPipeline(parsed.data));
    } catch (err: unknown) {
      return res.status(500).json({
        error: "trace_error", message: errMsg(err),
        finalDecision: "BLOCK", finalReason: "Pipeline fout — geblokkeerd als fail-safe (Lex Tabularium).",
      });
    }
  });
}
