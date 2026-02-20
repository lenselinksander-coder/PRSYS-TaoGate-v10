import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertObservationSchema, insertScopeSchema, ruleLayers } from "@shared/schema";
import type { Scope, GateDecision, ScopeRule, RuleLayer } from "@shared/schema";
import { z } from "zod";
import { researchTopic, extractScopeFromResearch, preflightCheck } from "./perplexity";

function classifyWithScope(text: string, scope: Scope): { status: string; category: string; escalation: string | null } {
  const lower = text.toLowerCase();
  const priorityOrder: GateDecision[] = ["BLOCK", "ESCALATE_REGULATORY", "ESCALATE_HUMAN", "PASS_WITH_TRANSPARENCY", "PASS"];

  for (const decision of priorityOrder) {
    const cats = scope.categories.filter(c => c.status === decision);
    for (const cat of cats) {
      if (cat.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
        return { status: cat.status, category: cat.name, escalation: cat.escalation };
      }
    }
  }

  const defaultPass = scope.categories.find(c => c.status === "PASS");
  return {
    status: "PASS",
    category: defaultPass?.name || "Observation",
    escalation: null,
  };
}

function resolveOlympiaRules(scope: Scope, domain?: string, category?: string) {
  const rules = (scope.rules || []) as ScopeRule[];
  let applicable = rules;
  if (domain) {
    applicable = applicable.filter(r => r.domain === domain);
  }
  if (category) {
    applicable = applicable.filter(r =>
      r.ruleId.toLowerCase().includes(category.toLowerCase()) ||
      r.title.toLowerCase().includes(category.toLowerCase()) ||
      r.domain.toLowerCase().includes(category.toLowerCase())
    );
  }

  const priorityIndex = (layer: RuleLayer) => ruleLayers.indexOf(layer);
  const actionSeverity = (action: string) => {
    const order: Record<string, number> = { BLOCK: 5, ESCALATE_REGULATORY: 4, ESCALATE_HUMAN: 3, PASS_WITH_TRANSPARENCY: 2, PASS: 1 };
    return order[action] || 0;
  };
  const sorted = [...applicable].sort((a, b) => priorityIndex(a.layer) - priorityIndex(b.layer) || actionSeverity(b.action) - actionSeverity(a.action));

  let winningRule: ScopeRule | null = null;
  for (const layer of ruleLayers) {
    const layerRules = sorted.filter(r => r.layer === layer);
    if (layerRules.length === 0) continue;

    const layerBlock = layerRules.find(r => r.action === "BLOCK");
    if (layerBlock) {
      winningRule = layerBlock;
      break;
    }

    const overriding = layerRules.filter(r => r.overridesLowerLayers);
    if (overriding.length > 0) {
      winningRule = overriding[0];
      break;
    }

    if (!winningRule) {
      winningRule = layerRules[0];
    }
  }

  if (!winningRule && sorted.length > 0) {
    winningRule = sorted[0];
  }

  const layerSummary = ruleLayers.map(layer => {
    const layerRules = sorted.filter(r => r.layer === layer);
    return {
      layer,
      priority: priorityIndex(layer) + 1,
      ruleCount: layerRules.length,
      rules: layerRules,
      dominantAction: layerRules[0]?.action || null,
    };
  });

  const hasConflict = new Set(sorted.map(r => r.action)).size > 1;

  const pressure = sorted.reduce((acc, r) => {
    if (r.action === "BLOCK") return Infinity;
    const layerWeight = 4 - priorityIndex(r.layer);
    const actionWeight = actionSeverity(r.action);
    return acc + layerWeight * actionWeight;
  }, 0);

  return {
    winningRule,
    hasConflict,
    pressure: pressure === Infinity ? "INFINITE" as const : pressure,
    layers: layerSummary,
    applicableRules: sorted,
    totalRules: rules.length,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/classify", async (req, res) => {
    const { text, scopeId } = req.body;
    if (!text || !scopeId) {
      return res.status(400).json({ error: "text and scopeId required" });
    }
    const scope = await storage.getScope(scopeId);
    if (!scope) return res.status(404).json({ error: "Scope not found" });

    const classification = classifyWithScope(text, scope);

    const rules = (scope.rules || []) as ScopeRule[];
    const availableDomains = Array.from(new Set(rules.map(r => r.domain)));
    const matchedDomain = availableDomains.find(d => classification.category.toUpperCase().includes(d.toUpperCase()));

    const olympia = resolveOlympiaRules(scope, matchedDomain);
    return res.json({
      ...classification,
      olympiaRuleId: olympia.winningRule?.ruleId || null,
      olympiaAction: olympia.winningRule?.action || null,
      olympiaLayer: olympia.winningRule?.layer || null,
      olympiaRule: olympia.winningRule || null,
      olympiaHasConflict: olympia.hasConflict,
      olympiaPressure: olympia.pressure,
    });
  });

  const resolveInputSchema = z.object({
    scopeId: z.string(),
    domain: z.string().optional(),
    category: z.string().optional(),
  });

  app.post("/api/olympia/resolve", async (req, res) => {
    const parsed = resolveInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { scopeId, domain, category } = parsed.data;

    const scope = await storage.getScope(scopeId);
    if (!scope) return res.status(404).json({ error: "Scope not found" });

    return res.json(resolveOlympiaRules(scope, domain, category));
  });

  app.post("/api/observations", async (req, res) => {
    const parsed = insertObservationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const observation = await storage.createObservation(parsed.data);
    return res.status(201).json(observation);
  });

  app.get("/api/observations", async (req, res) => {
    const context = req.query.context as string | undefined;
    const scopeId = req.query.scopeId as string | undefined;
    const observations = await storage.getObservations(context, scopeId);
    return res.json(observations);
  });

  app.get("/api/observations/stats", async (req, res) => {
    const context = req.query.context as string | undefined;
    const scopeId = req.query.scopeId as string | undefined;
    const stats = await storage.getStats(context, scopeId);
    return res.json(stats);
  });

  app.get("/api/scopes", async (_req, res) => {
    const scopeList = await storage.getScopes();
    return res.json(scopeList);
  });

  app.get("/api/scopes/default", async (_req, res) => {
    const scope = await storage.getDefaultScope();
    if (!scope) return res.status(404).json({ error: "No default scope found" });
    return res.json(scope);
  });

  app.get("/api/scopes/:id", async (req, res) => {
    const scope = await storage.getScope(req.params.id);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    return res.json(scope);
  });

  app.post("/api/scopes", async (req, res) => {
    const parsed = insertScopeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const scope = await storage.createScope(parsed.data);
    return res.status(201).json(scope);
  });

  app.put("/api/scopes/:id", async (req, res) => {
    const parsed = insertScopeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const scope = await storage.updateScope(req.params.id, parsed.data);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    return res.json(scope);
  });

  app.delete("/api/scopes/:id", async (req, res) => {
    const deleted = await storage.deleteScope(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Scope not found" });
    return res.json({ success: true });
  });

  const researchSchema = z.object({
    query: z.string().min(3, "Zoekvraag moet minimaal 3 tekens zijn"),
  });

  app.post("/api/ingest/research", async (req, res) => {
    const parsed = researchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const result = await researchTopic(parsed.data.query);
      return res.json(result);
    } catch (err: any) {
      console.error("Perplexity research error:", err);
      return res.status(502).json({ error: err.message || "Perplexity API error" });
    }
  });

  const extractSchema = z.object({
    query: z.string(),
    content: z.string(),
    citations: z.array(z.string()),
  });

  app.post("/api/ingest/extract", async (req, res) => {
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const result = await extractScopeFromResearch(
        parsed.data.query,
        parsed.data.content,
        parsed.data.citations
      );
      return res.json(result);
    } catch (err: any) {
      console.error("Perplexity extraction error:", err);
      return res.status(502).json({ error: err.message || "Extraction failed" });
    }
  });

  app.post("/api/ingest/draft", async (req, res) => {
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const extraction = await extractScopeFromResearch(
        parsed.data.query,
        parsed.data.content,
        parsed.data.citations
      );

      const scope = await storage.createScope({
        name: extraction.name,
        description: extraction.description,
        status: "DRAFT",
        categories: extraction.categories,
        rules: extraction.rules,
        documents: [],
        ingestMeta: {
          query: parsed.data.query,
          citations: parsed.data.citations,
          researchedAt: new Date().toISOString(),
          model: "llama-3.1-sonar-small-128k-online",
          gaps: extraction.gaps,
        },
      });

      return res.status(201).json(scope);
    } catch (err: any) {
      console.error("Draft creation error:", err);
      return res.status(502).json({ error: err.message || "Draft creation failed" });
    }
  });

  app.post("/api/scopes/:id/preflight", async (req, res) => {
    const scope = await storage.getScope(req.params.id);
    if (!scope) return res.status(404).json({ error: "Scope not found" });

    const result = preflightCheck({
      rules: (scope.rules || []) as any,
      categories: (scope.categories || []) as any,
      gaps: (scope.ingestMeta as any)?.gaps,
    });

    return res.json(result);
  });

  app.post("/api/scopes/:id/lock", async (req, res) => {
    const scope = await storage.getScope(req.params.id);
    if (!scope) return res.status(404).json({ error: "Scope not found" });

    if (scope.status === "LOCKED") {
      return res.status(400).json({ error: "Scope is al LOCKED" });
    }

    const preflight = preflightCheck({
      rules: (scope.rules || []) as any,
      categories: (scope.categories || []) as any,
      gaps: (scope.ingestMeta as any)?.gaps,
    });

    if (!preflight.canLock) {
      return res.status(422).json({
        error: "Preflight gefaald — scope kan niet gelocked worden",
        preflight,
      });
    }

    const locked = await storage.updateScope(scope.id, { status: "LOCKED" });
    return res.json({ scope: locked, preflight });
  });

  return httpServer;
}
