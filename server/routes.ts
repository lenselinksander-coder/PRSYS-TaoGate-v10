import { runGate } from "./gateSystem";
import { orchestrateGate } from "./fsm/gateOrchestrator";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertObservationSchema, insertScopeSchema, ruleLayers, insertOrganizationSchema, gateProfiles } from "@shared/schema";
import type { Scope, GateDecision, ScopeRule, RuleLayer, GateProfile } from "@shared/schema";
import { z } from "zod";
import { researchTopic, extractScopeFromResearch, preflightCheck } from "./perplexity";

function classifyWithScope(text: string, scope: Scope): { status: string; category: string; escalation: string | null; reason: string | null } {
  const lower = text.toLowerCase();
  const priorityOrder: GateDecision[] = ["BLOCK", "ESCALATE_REGULATORY", "ESCALATE_HUMAN", "PASS_WITH_TRANSPARENCY", "PASS"];

  const reasonMap: Record<string, string> = {
    BLOCK: "Classificatie geblokt — menselijke beoordeling vereist.",
    ESCALATE_REGULATORY: "Regulatoire escalatie vereist — toezichthouder raadplegen.",
    ESCALATE_HUMAN: "Escalatie naar mens vereist — beoordeling door specialist.",
    PASS_WITH_TRANSPARENCY: "Doorgelaten met transparantieverplichting.",
  };

  for (const decision of priorityOrder) {
    const cats = scope.categories.filter(c => c.status === decision);
    for (const cat of cats) {
      if (cat.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
        let reason: string | null = null;
        if (decision !== "PASS") {
          reason = cat.escalation
            ? `${cat.label ?? cat.name} — escaleer naar ${cat.escalation}.`
            : reasonMap[decision] ?? null;
        }
        return { status: cat.status, category: cat.name, escalation: cat.escalation, reason };
      }
    }
  }

  const defaultPass = scope.categories.find(c => c.status === "PASS");
  return {
    status: "PASS",
    category: defaultPass?.name || "Observation",
    escalation: null,
    reason: null,
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

  // ── Classify (original, with pluggable gate) ─────────────
  app.post("/api/classify", async (req, res) => {
    try {
      const { text, scopeId } = req.body as { text?: string; scopeId?: string };

      if (!text || !scopeId) {
        return res.status(400).json({ error: "text and scopeId required" });
      }

      const scope = await storage.getScope(scopeId);
      if (!scope) return res.status(404).json({ error: "Scope not found" });

      let gateProfile: GateProfile = "GENERAL";
      if (scope.orgId) {
        const org = await storage.getOrganization(scope.orgId);
        if (org) gateProfile = org.gateProfile as GateProfile;
      } else {
        gateProfile = "CLINICAL";
      }

      const gate = runGate(text, gateProfile);

      if (gate.status === "BLOCK" || gate.status === "ESCALATE_HUMAN" || gate.status === "ESCALATE_REGULATORY") {
        return res.json({
          status: gate.status,
          olympia: gate.band,
          layer: gate.layer,
          pressure: gate.pressure,
          escalation: gate.escalation,
          reason: gate.reason,
          winningRule: null,
          signals: gate.signals,
        });
      }

      const classification = classifyWithScope(text, scope);

      const rules = (scope.rules || []) as ScopeRule[];
      const availableDomains = Array.from(new Set(rules.map(r => r.domain)));
      const matchedDomain = availableDomains.find(d => classification.category.toUpperCase().includes(d.toUpperCase()));

      const olympia = resolveOlympiaRules(scope, matchedDomain);
      return res.json({
        status: classification.status,
        olympia: olympia.winningRule?.ruleId ?? null,
        layer: olympia.winningRule?.layer ?? "EU",
        pressure: olympia.pressure === "INFINITE" ? "CRITICAL" : "NORMAL",
        escalation: classification.escalation ?? null,
        reason: classification.reason ?? (classification.status !== "PASS" ? (olympia.winningRule?.description ?? null) : null),
        winningRule: olympia.winningRule ?? null,
        signals: null,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: "internal_error",
        message: err?.message ?? String(err),
      });
    }
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

  // ── Observations ─────────────────────────────────────────
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

  // ── Scopes ───────────────────────────────────────────────
  app.get("/api/scopes", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    if (orgId) {
      const scopeList = await storage.getScopesByOrg(orgId);
      return res.json(scopeList);
    }
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

  // ── Organizations ────────────────────────────────────────
  app.get("/api/organizations", async (_req, res) => {
    const orgs = await storage.getOrganizations();
    return res.json(orgs);
  });

  app.get("/api/organizations/:id", async (req, res) => {
    const org = await storage.getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    return res.json(org);
  });

  const createOrgSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug mag alleen kleine letters, cijfers en koppeltekens bevatten"),
    description: z.string().optional(),
    sector: z.string().optional(),
    gateProfile: z.enum(gateProfiles).optional(),
  });

  app.post("/api/organizations", async (req, res) => {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const existing = await storage.getOrganizationBySlug(parsed.data.slug);
    if (existing) {
      return res.status(409).json({ error: "Organisatie met deze slug bestaat al" });
    }
    const org = await storage.createOrganization(parsed.data);
    return res.status(201).json(org);
  });

  app.put("/api/organizations/:id", async (req, res) => {
    const parsed = createOrgSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const org = await storage.updateOrganization(req.params.id, parsed.data);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    return res.json(org);
  });

  app.delete("/api/organizations/:id", async (req, res) => {
    const deleted = await storage.deleteOrganization(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Organization not found" });
    return res.json({ success: true });
  });

  // ── Connectors ───────────────────────────────────────────
  app.get("/api/connectors", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    const list = await storage.getConnectors(orgId);
    const safe = list.map(c => ({
      ...c,
      apiKey: c.apiKey.substring(0, 12) + "..." + c.apiKey.substring(c.apiKey.length - 4),
    }));
    return res.json(safe);
  });

  app.get("/api/connectors/:id", async (req, res) => {
    const connector = await storage.getConnector(req.params.id);
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    return res.json({
      ...connector,
      apiKey: connector.apiKey.substring(0, 12) + "..." + connector.apiKey.substring(connector.apiKey.length - 4),
    });
  });

  const createConnectorSchema = z.object({
    orgId: z.string(),
    name: z.string().min(1),
    type: z.enum(["AI_AGENT", "DATA_SOURCE", "WEBHOOK"]).optional(),
    provider: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    config: z.record(z.any()).optional(),
  });

  app.post("/api/connectors", async (req, res) => {
    const parsed = createConnectorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const connector = await storage.createConnector(parsed.data);
    return res.status(201).json(connector);
  });

  app.put("/api/connectors/:id", async (req, res) => {
    const parsed = createConnectorSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const connector = await storage.updateConnector(req.params.id, parsed.data);
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    return res.json(connector);
  });

  app.delete("/api/connectors/:id", async (req, res) => {
    const deleted = await storage.deleteConnector(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Connector not found" });
    return res.json({ success: true });
  });

  // ── Universal Gateway ────────────────────────────────────
  const gatewaySchema = z.object({
    text: z.string().min(1),
    scopeId: z.string().optional(),
  });

  app.post("/api/gateway/classify", async (req, res) => {
    const start = Date.now();
    try {
      const apiKey = req.headers["x-api-key"] as string;
      if (!apiKey) {
        return res.status(401).json({ error: "API key vereist (x-api-key header)" });
      }

      const connector = await storage.getConnectorByApiKey(apiKey);
      if (!connector) {
        return res.status(403).json({ error: "Ongeldige of gedeactiveerde API key" });
      }

      const parsed = gatewaySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const org = await storage.getOrganization(connector.orgId);
      if (!org) {
        return res.status(404).json({ error: "Organisatie niet gevonden" });
      }

      const gateProfile = (org.gateProfile as GateProfile) || "GENERAL";
      // Run gate evaluation inside the XState FSM (Feature 3: TypeScript FSM).
      // The FSM validates all state transitions at compile-time and treats any
      // evaluation error as BLOCK (fail-safe). Feature 1 (WASM sandbox) wires
      // into the machine's evaluateGate actor via gateSystem.ts.
      const gate = await orchestrateGate(parsed.data.text, gateProfile);

      let scopeResult = null;
      let olympiaResult = null;

      if (gate.status === "PASS" || gate.status === "PASS_WITH_TRANSPARENCY") {
        let scope: Scope | undefined;
        if (parsed.data.scopeId) {
          scope = await storage.getScope(parsed.data.scopeId);
        } else {
          const orgScopes = await storage.getScopesByOrg(org.id);
          scope = orgScopes.find(s => s.status === "LOCKED") || orgScopes[0];
        }

        if (scope) {
          scopeResult = classifyWithScope(parsed.data.text, scope);
          const rules = (scope.rules || []) as ScopeRule[];
          const availableDomains = Array.from(new Set(rules.map(r => r.domain)));
          const matchedDomain = availableDomains.find(d => scopeResult!.category.toUpperCase().includes(d.toUpperCase()));
          olympiaResult = resolveOlympiaRules(scope, matchedDomain);
        }
      }

      const finalDecision = scopeResult?.status || gate.status;
      const processingMs = Date.now() - start;

      await storage.touchConnector(connector.id);
      await storage.createIntent({
        orgId: org.id,
        scopeId: parsed.data.scopeId || null,
        connectorId: connector.id,
        inputText: parsed.data.text,
        decision: finalDecision,
        category: scopeResult?.category || gate.band,
        layer: olympiaResult?.winningRule?.layer || gate.layer,
        pressure: String(olympiaResult?.pressure ?? gate.pressure),
        reason: scopeResult?.reason || gate.reason,
        escalation: scopeResult?.escalation || gate.escalation,
        processingMs,
      });

      return res.json({
        decision: finalDecision,
        gate: {
          status: gate.status,
          layer: gate.layer,
          band: gate.band,
          pressure: gate.pressure,
          reason: gate.reason,
        },
        scope: scopeResult ? {
          status: scopeResult.status,
          category: scopeResult.category,
          escalation: scopeResult.escalation,
          reason: scopeResult.reason,
        } : null,
        olympia: olympiaResult?.winningRule ? {
          ruleId: olympiaResult.winningRule.ruleId,
          layer: olympiaResult.winningRule.layer,
          action: olympiaResult.winningRule.action,
          title: olympiaResult.winningRule.title,
          source: olympiaResult.winningRule.source,
        } : null,
        processingMs,
        organization: org.name,
        gateProfile,
      });
    } catch (err: any) {
      return res.status(500).json({ error: "internal_error", message: err?.message ?? String(err) });
    }
  });

  // ── Intent Audit Logs ────────────────────────────────────
  app.get("/api/intents", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const list = await storage.getIntents(orgId, limit);
    return res.json(list);
  });

  app.get("/api/intents/stats", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    const stats = await storage.getIntentStats(orgId);
    return res.json(stats);
  });

  // ── Dataset Import (CSV/JSON → Scope) ────────────────────
  const importJsonSchema = z.object({
    orgId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    data: z.object({
      categories: z.array(z.object({
        name: z.string(),
        label: z.string(),
        status: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
        escalation: z.string().nullable().optional().default(null),
        keywords: z.array(z.string()).optional().default([]),
      })).optional().default([]),
      rules: z.array(z.object({
        ruleId: z.string(),
        layer: z.enum(["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"]),
        domain: z.string(),
        title: z.string(),
        description: z.string(),
        action: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
        overridesLowerLayers: z.boolean().optional().default(false),
        source: z.string().optional().default(""),
        sourceUrl: z.string().optional().default(""),
        article: z.string().optional().default(""),
        citation: z.string().optional().default(""),
        qTriad: z.enum(["Mens×Mens", "Mens×Systeem", "Systeem×Systeem"]).optional(),
      })).optional().default([]),
      documents: z.array(z.object({
        type: z.enum(["visiedocument", "mandaat", "huisregel", "protocol", "overig"]),
        title: z.string(),
        content: z.string(),
      })).optional().default([]),
    }),
  });

  app.post("/api/import/json", async (req, res) => {
    const parsed = importJsonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const { orgId, name, description, data } = parsed.data;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });

      const scope = await storage.createScope({
        name,
        description: description || `Geïmporteerd dataset voor ${org.name}`,
        status: "DRAFT",
        orgId,
        categories: data.categories,
        rules: data.rules,
        documents: data.documents,
        ingestMeta: {
          query: `Import: ${name}`,
          citations: [],
          researchedAt: new Date().toISOString(),
          model: "import-json",
          gaps: [],
        },
      });

      return res.status(201).json(scope);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Import mislukt" });
    }
  });

  const importCsvSchema = z.object({
    orgId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    csvContent: z.string(),
    mapping: z.object({
      type: z.enum(["categories", "rules"]),
      columns: z.record(z.string()),
    }),
  });

  app.post("/api/import/csv", async (req, res) => {
    const parsed = importCsvSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const { orgId, name, description, csvContent, mapping } = parsed.data;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });

      const lines = csvContent.split("\n").map(l => l.trim()).filter(l => l);
      if (lines.length < 2) return res.status(400).json({ error: "CSV moet minimaal een header en één rij bevatten" });

      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });

      const categories: any[] = [];
      const rules: any[] = [];

      if (mapping.type === "categories") {
        for (const row of rows) {
          categories.push({
            name: row[mapping.columns.name || "name"] || "",
            label: row[mapping.columns.label || "label"] || "",
            status: (row[mapping.columns.status || "status"] || "PASS") as any,
            escalation: row[mapping.columns.escalation || "escalation"] || null,
            keywords: (row[mapping.columns.keywords || "keywords"] || "").split(";").map(k => k.trim()).filter(k => k),
          });
        }
      } else {
        for (const row of rows) {
          rules.push({
            ruleId: row[mapping.columns.ruleId || "ruleId"] || `RULE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            layer: (row[mapping.columns.layer || "layer"] || "NATIONAL") as any,
            domain: row[mapping.columns.domain || "domain"] || "general",
            title: row[mapping.columns.title || "title"] || "",
            description: row[mapping.columns.description || "description"] || "",
            action: (row[mapping.columns.action || "action"] || "PASS") as any,
            overridesLowerLayers: row[mapping.columns.overrides || "overrides"] === "true",
            source: row[mapping.columns.source || "source"] || "",
            sourceUrl: row[mapping.columns.sourceUrl || "sourceUrl"] || "",
            article: row[mapping.columns.article || "article"] || "",
            citation: row[mapping.columns.citation || "citation"] || "",
          });
        }
      }

      const scope = await storage.createScope({
        name,
        description: description || `CSV import voor ${org.name}`,
        status: "DRAFT",
        orgId,
        categories,
        rules,
        documents: [],
        ingestMeta: {
          query: `CSV Import: ${name}`,
          citations: [],
          researchedAt: new Date().toISOString(),
          model: "import-csv",
          gaps: [],
        },
      });

      return res.status(201).json({ scope, imported: { categories: categories.length, rules: rules.length } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "CSV import mislukt" });
    }
  });

  // ── Research (Perplexity) ────────────────────────────────
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
          model: "sonar",
          gaps: extraction.gaps,
        },
      });

      return res.status(201).json(scope);
    } catch (err: any) {
      console.error("Draft creation error:", err);
      return res.status(502).json({ error: err.message || "Draft creation failed" });
    }
  });

  const manualDraftSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    orgId: z.string().optional(),
    rules: z.array(z.object({
      ruleId: z.string(),
      layer: z.enum(["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"]),
      domain: z.string(),
      title: z.string(),
      description: z.string(),
      action: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
      overridesLowerLayers: z.boolean().optional().default(false),
      source: z.string().optional().default(""),
      sourceUrl: z.string().optional().default(""),
      article: z.string().optional().default(""),
      citation: z.string().optional().default(""),
      qTriad: z.enum(["Mens×Mens", "Mens×Systeem", "Systeem×Systeem"]).optional(),
    })).optional().default([]),
    categories: z.array(z.object({
      name: z.string(),
      label: z.string(),
      status: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
      escalation: z.string().nullable().optional().default(null),
      keywords: z.array(z.string()).optional().default([]),
    })).optional().default([]),
    sourceText: z.string().optional().default(""),
    sourceUrls: z.array(z.string()).optional().default([]),
  });

  app.post("/api/ingest/manual-draft", async (req, res) => {
    const parsed = manualDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const data = parsed.data;
      const scope = await storage.createScope({
        name: data.name,
        description: data.description,
        status: "DRAFT",
        orgId: data.orgId,
        categories: data.categories,
        rules: data.rules,
        documents: [],
        ingestMeta: {
          query: `Handmatig: ${data.name}`,
          citations: data.sourceUrls,
          researchedAt: new Date().toISOString(),
          model: "manual",
          gaps: [],
          sourceText: data.sourceText,
        },
      });

      return res.status(201).json(scope);
    } catch (err: any) {
      console.error("Manual draft creation error:", err);
      return res.status(500).json({ error: err.message || "Draft creation failed" });
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

  // ── System Info ──────────────────────────────────────────
  app.get("/api/system/info", async (_req, res) => {
    const orgs = await storage.getOrganizations();
    const allScopes = await storage.getScopes();
    const allConnectors = await storage.getConnectors();
    const intentStats = await storage.getIntentStats();

    return res.json({
      version: "2.0.0",
      model: "ORFHEUSS Universal",
      organizations: orgs.length,
      scopes: allScopes.length,
      connectors: allConnectors.length,
      intents: intentStats,
      gateProfiles: ["CLINICAL", "GENERAL", "FINANCIAL", "LEGAL", "EDUCATIONAL", "CUSTOM"],
      sectors: ["healthcare", "finance", "education", "government", "technology", "legal", "energy", "transport", "retail", "manufacturing", "other"],
    });
  });

  return httpServer;
}
