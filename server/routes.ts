import type { Express } from "express";
import { createServer, type Server } from "http";

import { z } from "zod";
import crypto from "crypto";
import { storage } from "./storage";
import { insertObservationSchema, insertScopeSchema, insertOrganizationSchema, gateProfiles } from "@shared/schema";
import type { ScopeMeta } from "@shared/schema";
import { getTapeDeck, executeTaoGate, runEuLegalGate, formatEuBlockAsGateResponse, EU_BASELINE_SCOPE } from "./core";
import { researchTopic, extractScopeFromResearch } from "./perplexity";
import { repairPdfJson, extractJsonObject, structurePdfText } from "./services/pdfParser";
import {
  runPipeline,
  classifyIntent,
  gatewayClassify,
  resolveOlympiaRules,
  preflightCheck,
  runMultiTapePipeline,
} from "./pipeline";
import { syncAlgoritmeregister } from "./integrations/algoritmeregister/syncRegister";
import { classifyDpiaLevel, DPIA_LEVEL_LABELS } from "./trace";
import { testudoStatus } from "./middleware";
import { appendWormEntry } from "./audit/wormChain";
import { executeWithGate } from "./gateSystem";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/gate", async (req, res) => {
    try {
      const { text, scopeId, tapeId } = req.body as { text?: string; scopeId?: string; tapeId?: string };
      if (!text) return res.status(400).json({ error: "text required" });
      if (!scopeId && !tapeId) return res.status(400).json({ error: "scopeId or tapeId required" });

      // ── EU LEGAL GATE — EERSTE STAP, ALTIJD ──────────────────────────────
      const euResult = runEuLegalGate(text);
      if (euResult.triggered) {
        return res.json(formatEuBlockAsGateResponse(euResult, text));
      }
      // ── LEGAL BASIS CLEAR ─────────────────────────────────────────────────

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
    } catch (err: any) {
      // Cerberus fail-safe: een onverwachte exception mag nooit een niet-BLOCK response produceren.
      // Retourneer altijd een gestructureerd BLOCK — nooit een 500 met debug-info naar de client.
      console.error("[taogate] executeTaoGate() exception:", err);
      // A8 (Immutable Trace): ook een SYSTEM_ERROR BLOCK moet in de WORM-keten verschijnen.
      // req.body is beschikbaar in catch (outer function scope); text kan ontbreken bij parse-fout.
      appendWormEntry({
        orgId: null,
        connectorId: null,
        inputText: typeof req.body?.text === "string" ? req.body.text : "",
        decision: "BLOCK",
        category: "SYSTEM_ERROR",
        layer: "SYSTEM",
        pressure: null,
        processingMs: 0,
      });
      return res.json({
        status: "BLOCK",
        category: "SYSTEM_ERROR",
        escalation: "SYSTEM_ADMIN",
        layer: "SYSTEM",
        reason: "Gate uitvoering mislukt — geblokkeerd als fail-safe (Cerberus).",
        processingMs: 0,
        lexiconSource: "internal",
        lexiconDeterministic: "false",
      });
    }
  });

  app.post("/api/classify", async (req, res) => {
    try {
      const { text, scopeId } = req.body as { text?: string; scopeId?: string };
      if (!text || !scopeId) return res.status(400).json({ error: "text and scopeId required" });
      const result = await classifyIntent(text, scopeId);
      if (result.error) return res.status(404).json(result);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "internal_error", message: err?.message ?? String(err) });
    }
  });

  const resolveInputSchema = z.object({
    scopeId: z.string(),
    domain: z.string().optional(),
    category: z.string().optional(),
  });

  app.post("/api/olympia/resolve", async (req, res) => {
    const parsed = resolveInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { scopeId, domain, category } = parsed.data;
    const scope = await storage.getScope(scopeId);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    return res.json(resolveOlympiaRules(scope, domain, category));
  });

  app.post("/api/observations", async (req, res) => {
    const parsed = insertObservationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { gateOutcome, result } = await executeWithGate(
      "Observatie aanmaken",
      () => storage.createObservation(parsed.data),
      { orgId: null, connectorId: null, endpoint: "POST /api/observations" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    return res.status(201).json(result);
  });

  app.get("/api/observations", async (req, res) => {
    const context = req.query.context as string | undefined;
    const scopeId = req.query.scopeId as string | undefined;
    return res.json(await storage.getObservations(context, scopeId));
  });

  app.get("/api/observations/stats", async (req, res) => {
    const context = req.query.context as string | undefined;
    const scopeId = req.query.scopeId as string | undefined;
    return res.json(await storage.getStats(context, scopeId));
  });

  app.get("/api/scopes", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    const scopeList = orgId ? await storage.getScopesByOrg(orgId) : await storage.getScopes();
    const orgs = await storage.getOrganizations();
    const orgMap = new Map(orgs.map(o => [o.id, o.name]));
    return res.json(scopeList.map(s => ({ ...s, orgName: s.orgId ? orgMap.get(s.orgId) ?? null : null })));
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
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { gateOutcome, result } = await executeWithGate(
      `Scope aanmaken: ${parsed.data.name}`,
      () => storage.createScope(parsed.data),
      { orgId: parsed.data.orgId ?? null, connectorId: null, endpoint: "POST /api/scopes" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    return res.status(201).json(result);
  });

  app.put("/api/scopes/:id", async (req, res) => {
    const parsed = insertScopeSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { gateOutcome, result } = await executeWithGate(
      `Scope bijwerken: ${req.params.id}`,
      () => storage.updateScope(req.params.id, parsed.data),
      { orgId: parsed.data.orgId ?? null, connectorId: null, endpoint: "PUT /api/scopes/:id" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    if (!result) return res.status(404).json({ error: "Scope not found" });
    return res.json(result);
  });

  app.delete("/api/scopes/:id", async (req, res) => {
    const { gateOutcome, result } = await executeWithGate(
      `Scope verwijderen: ${req.params.id}`,
      () => storage.deleteScope(req.params.id),
      { orgId: null, connectorId: null, endpoint: "DELETE /api/scopes/:id" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    if (!result) return res.status(404).json({ error: "Scope not found" });
    return res.json({ success: true });
  });

  app.get("/api/organizations", async (_req, res) => {
    return res.json(await storage.getOrganizations());
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
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = await storage.getOrganizationBySlug(parsed.data.slug);
    if (existing) return res.status(409).json({ error: "Organisatie met deze slug bestaat al" });
    const { gateOutcome, result } = await executeWithGate(
      `Organisatie aanmaken: ${parsed.data.name}`,
      () => storage.createOrganization(parsed.data),
      { orgId: null, connectorId: null, endpoint: "POST /api/organizations" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    return res.status(201).json(result);
  });

  app.put("/api/organizations/:id", async (req, res) => {
    const parsed = createOrgSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { gateOutcome, result } = await executeWithGate(
      `Organisatie bijwerken: ${req.params.id}`,
      () => storage.updateOrganization(req.params.id, parsed.data),
      { orgId: req.params.id, connectorId: null, endpoint: "PUT /api/organizations/:id" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    if (!result) return res.status(404).json({ error: "Organization not found" });
    return res.json(result);
  });

  app.delete("/api/organizations/:id", async (req, res) => {
    const { gateOutcome, result } = await executeWithGate(
      `Organisatie verwijderen: ${req.params.id}`,
      () => storage.deleteOrganization(req.params.id),
      { orgId: req.params.id, connectorId: null, endpoint: "DELETE /api/organizations/:id" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    if (!result) return res.status(404).json({ error: "Organization not found" });
    return res.json({ success: true });
  });

  app.post("/api/organizations/:id/mount", async (req, res) => {
    const { scopeId } = req.body as { scopeId?: string };
    if (!scopeId) return res.status(400).json({ error: "scopeId required" });
    const org = await storage.getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    const scope = await storage.getScope(scopeId);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    if (scope.status !== "LOCKED") return res.status(422).json({ error: "Alleen LOCKED scopes kunnen worden gemount" });
    const updated = await storage.updateOrganization(req.params.id, { activeScopeId: scopeId } as any);
    return res.json({ success: true, org: updated, mountedScope: scope.name });
  });

  app.delete("/api/organizations/:id/mount", async (req, res) => {
    const org = await storage.getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    const updated = await storage.updateOrganization(req.params.id, { activeScopeId: null } as any);
    return res.json({ success: true, org: updated });
  });

  app.get("/api/organizations/:id/active-scope", async (req, res) => {
    const org = await storage.getOrganization(req.params.id) as any;
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (!org.activeScopeId) return res.json({ scope: null });
    const scope = await storage.getScope(org.activeScopeId);
    return res.json({ scope: scope || null });
  });

  app.get("/api/connectors", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    const list = await storage.getConnectors(orgId);
    return res.json(list.map(c => ({ ...c, apiKey: c.apiKey.substring(0, 12) + "..." + c.apiKey.substring(c.apiKey.length - 4) })));
  });

  app.get("/api/connectors/:id", async (req, res) => {
    const connector = await storage.getConnector(req.params.id);
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    return res.json({ ...connector, apiKey: connector.apiKey.substring(0, 12) + "..." + connector.apiKey.substring(connector.apiKey.length - 4) });
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
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { gateOutcome, result } = await executeWithGate(
      `Connector aanmaken: ${parsed.data.name}`,
      () => storage.createConnector(parsed.data),
      { orgId: parsed.data.orgId, connectorId: null, endpoint: "POST /api/connectors" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    return res.status(201).json(result);
  });

  app.put("/api/connectors/:id", async (req, res) => {
    const parsed = createConnectorSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { gateOutcome, result } = await executeWithGate(
      `Connector bijwerken: ${req.params.id}`,
      () => storage.updateConnector(req.params.id, parsed.data),
      { orgId: parsed.data.orgId ?? null, connectorId: req.params.id, endpoint: "PUT /api/connectors/:id" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    if (!result) return res.status(404).json({ error: "Connector not found" });
    return res.json(result);
  });

  app.delete("/api/connectors/:id", async (req, res) => {
    const { gateOutcome, result } = await executeWithGate(
      `Connector verwijderen: ${req.params.id}`,
      () => storage.deleteConnector(req.params.id),
      { orgId: null, connectorId: req.params.id, endpoint: "DELETE /api/connectors/:id" },
    );
    if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
    if (!result) return res.status(404).json({ error: "Connector not found" });
    return res.json({ success: true });
  });

  const gatewaySchema = z.object({
    text: z.string().min(1),
    scopeId: z.string().optional(),
    subjectEmail: z.string().email().optional(),
    subjectBsn: z.string().regex(/^\d{8,9}$/).optional(),
  });

  app.post("/api/gateway/classify", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      if (!apiKey) return res.status(401).json({ error: "API key vereist (x-api-key header)" });
      const connector = await storage.getConnectorByApiKey(apiKey);
      if (!connector) return res.status(403).json({ error: "Ongeldige of gedeactiveerde API key" });
      const parsed = gatewaySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      let subjectRef: string | undefined;
      let subjectRefType: string | undefined;
      if (parsed.data.subjectEmail) {
        subjectRef = crypto.createHash("sha256").update(parsed.data.subjectEmail.toLowerCase().trim()).digest("hex");
        subjectRefType = "EMAIL";
      } else if (parsed.data.subjectBsn) {
        subjectRef = crypto.createHash("sha256").update(parsed.data.subjectBsn.trim()).digest("hex");
        subjectRefType = "BSN";
      }
      // ── EU LEGAL GATE — EERSTE STAP, ALTIJD ──────────────────────────────
      const euResult = runEuLegalGate(parsed.data.text);
      if (euResult.triggered) {
        return res.json(formatEuBlockAsGateResponse(euResult, parsed.data.text));
      }
      // ── LEGAL BASIS CLEAR ─────────────────────────────────────────────────
      const result = await gatewayClassify({
        text: parsed.data.text,
        orgId: connector.orgId,
        connectorId: connector.id,
        scopeId: parsed.data.scopeId,
        subjectRef,
        subjectRefType,
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "internal_error", message: err?.message ?? String(err) });
    }
  });

  app.get("/api/intents", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    return res.json(await storage.getIntents(orgId, limit));
  });

  app.get("/api/intents/stats", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    return res.json(await storage.getIntentStats(orgId));
  });

  // ── Glazen Bastion: Burgerportaal ──────────────────────
  const burgerLookupSchema = z.object({
    email: z.string().email().optional(),
    bsn: z.string().regex(/^\d{8,9}$/).optional(),
  }).refine(d => d.email || d.bsn, { message: "email of bsn is vereist" });

  app.post("/api/burgerportaal/lookup", async (req, res) => {
    try {
      const parsed = burgerLookupSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const raw = parsed.data.email
        ? parsed.data.email.toLowerCase().trim()
        : parsed.data.bsn!.trim();
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      const results = await storage.getIntentsBySubjectRef(hash);
      return res.json({ besluiten: results });
    } catch (err: any) {
      return res.status(500).json({ error: "internal_error", message: err?.message ?? String(err) });
    }
  });

  // ── Multi-tape pipeline evaluatie ──────────────────────
  app.post("/api/multi-tape/evaluate", async (req, res) => {
    try {
      const schema = z.object({
        orgId: z.string().min(1),
        intent: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const result = await runMultiTapePipeline(parsed.data.orgId, parsed.data.intent);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "internal_error", message: err?.message ?? String(err) });
    }
  });

  // ── Glazen Bastion: Heraut publiek prikbord ────────────
  app.get("/api/heraut/feed", async (req, res) => {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 200) : 50;
    const feed = await storage.getHerautFeed(limit);
    return res.json({ feed });
  });

  app.post("/api/import/parse-pdf", async (req, res) => {
    const schema = z.object({
      pdfBase64: z.string().min(1, "PDF data is verplicht"),
      fileName: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
      const { PDFParse } = await import("pdf-parse") as any;
      const buffer = Buffer.from(parsed.data.pdfBase64, "base64");
      const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
      await parser.load();
      const textResult = await parser.getText();
      const fullText = typeof textResult === "string" ? textResult : (textResult?.text || "");
      const numPages = textResult?.total || parser.doc?.numPages || 1;
      await parser.destroy();

      const extracted: { categories?: any[]; rules?: any[]; documents?: any[] } = {};

      const rawCleaned = fullText
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\n*--\s*\d+\s+of\s+\d+\s*--\n*/g, "\n");

      let jsonBlock = extractJsonObject(rawCleaned);
      if (!jsonBlock) {
        const firstBrace = rawCleaned.indexOf('{');
        const lastBrace = rawCleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonBlock = rawCleaned.substring(firstBrace, lastBrace + 1);
        }
      }
      if (jsonBlock) {
        const parsed2 = repairPdfJson(jsonBlock);
        if (parsed2 && typeof parsed2 === "object") {
          if (Array.isArray(parsed2.categories)) extracted.categories = parsed2.categories;
          if (Array.isArray(parsed2.rules)) extracted.rules = parsed2.rules;
          if (Array.isArray(parsed2.documents)) extracted.documents = parsed2.documents;
        }
      }

      const sections = structurePdfText(fullText, numPages);

      if (!extracted.categories && !extracted.rules) {
        const allContent = sections.map(s => s.content).join("\n");
        const fullParsed = repairPdfJson(allContent);
        if (fullParsed && typeof fullParsed === "object" && !Array.isArray(fullParsed)) {
          if (Array.isArray(fullParsed.categories)) extracted.categories = fullParsed.categories;
          if (Array.isArray(fullParsed.rules)) extracted.rules = fullParsed.rules;
        }
      }

      if (!extracted.categories && !extracted.rules) {
        for (const s of sections) {
          const obj = repairPdfJson(s.content);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            if (Array.isArray(obj.categories) && obj.categories.length > 0) extracted.categories = [...(extracted.categories || []), ...obj.categories];
            if (Array.isArray(obj.rules) && obj.rules.length > 0) extracted.rules = [...(extracted.rules || []), ...obj.rules];
          } else if (Array.isArray(obj) && obj.length > 0) {
            if (obj[0].name && obj[0].keywords) extracted.categories = [...(extracted.categories || []), ...obj];
            else if (obj[0].ruleId && obj[0].layer) extracted.rules = [...(extracted.rules || []), ...obj];
          }
        }
      }

      return res.json({
        fileName: parsed.data.fileName || "document.pdf",
        pages: numPages,
        totalChars: fullText.length,
        sections,
        extracted: Object.keys(extracted).length > 0 ? extracted : undefined,
      });
    } catch (err: any) {
      return res.status(400).json({ error: `PDF parsing mislukt: ${err.message}` });
    }
  });

  // ── Dataset Import (CSV/JSON → Scope) ────────────────────
  //
  // Accepts two equivalent formats:
  //   A) Legacy nested:  { orgId, name, data: { categories, rules, documents } }
  //   B) CoVe / TaoGate v10 root-level: { orgId, name, categories, rules, documents, scope_meta }
  //
  // When both are present, root-level wins if non-empty (CoVe takes precedence).

  const _importCategorySchema = z.object({
    name: z.string(),
    label: z.string(),
    status: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
    escalation: z.string().nullable().optional().default(null),
    keywords: z.array(z.string()).optional().default([]),
  });

  const _importRuleSchema = z.object({
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
  });

  const _importDocSchema = z.object({
    type: z.enum(["visiedocument", "mandaat", "huisregel", "protocol", "overig"]),
    title: z.string(),
    content: z.string(),
  });

  const _importScopeMetaSchema = z.object({
    ti_min: z.number().optional(),
    sector_threshold: z.number().optional(),
    ti_weights: z.object({ alpha: z.number(), beta: z.number(), gamma: z.number() }).optional(),
    gate_profile: z.string().optional(),
  }).optional();

  const importJsonSchema = z.object({
    orgId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    // CoVe / TaoGate v10 root-level format
    categories: z.array(_importCategorySchema).optional().default([]),
    rules: z.array(_importRuleSchema).optional().default([]),
    documents: z.array(_importDocSchema).optional().default([]),
    scope_meta: _importScopeMetaSchema,
    // Legacy nested format (still accepted)
    data: z.object({
      categories: z.array(_importCategorySchema).optional().default([]),
      rules: z.array(_importRuleSchema).optional().default([]),
      documents: z.array(_importDocSchema).optional().default([]),
    }).optional(),
  });

  app.post("/api/import/json", async (req, res) => {
    const parsed = importJsonSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const { orgId, name, description, data, scope_meta: scopeMeta } = parsed.data;

      // Merge: root-level arrays win when non-empty (CoVe format), else fall back to data.*
      const categories = parsed.data.categories.length ? parsed.data.categories : (data?.categories ?? []);
      const rules = parsed.data.rules.length ? parsed.data.rules : (data?.rules ?? []);
      const documents = parsed.data.documents.length ? parsed.data.documents : (data?.documents ?? []);

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });

      // Map snake_case scope_meta keys to camelCase schema
      const scopeMetaMapped: ScopeMeta | undefined = scopeMeta ? {
        tiMin: scopeMeta.ti_min,
        sectorThreshold: scopeMeta.sector_threshold,
        tiWeights: scopeMeta.ti_weights,
        gateProfile: scopeMeta.gate_profile,
      } : undefined;

      const { gateOutcome, result: scope } = await executeWithGate(
        `JSON import aanmaken: ${name}`,
        () => storage.createScope({
          name,
          description: description || `Geïmporteerd dataset voor ${org.name}`,
          status: "DRAFT",
          orgId,
          categories,
          rules,
          documents,
          scopeMeta: scopeMetaMapped,
          ingestMeta: {
            query: `Import: ${name}`,
            citations: [],
            researchedAt: new Date().toISOString(),
            model: "import-json",
            gaps: [],
          },
        }),
        { orgId, connectorId: null, endpoint: "POST /api/import/json" },
      );
      if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
      return res.status(201).json(scope);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Import mislukt" });
    }
  });

  const importCsvSchema = z.object({
    orgId: z.string(), name: z.string().min(1), description: z.string().optional(),
    csvContent: z.string(),
    mapping: z.object({ type: z.enum(["categories", "rules"]), columns: z.record(z.string()) }),
  });

  app.post("/api/import/csv", async (req, res) => {
    const parsed = importCsvSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const { orgId, name, description, csvContent, mapping } = parsed.data;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });

      const lines = csvContent.split("\n").map(l => l.trim()).filter(l => l);
      if (lines.length < 2) return res.status(400).json({ error: "CSV moet minimaal een header en één rij bevatten" });

      const parseCsvLine = (line: string): string[] => {
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
          else if ((ch === "," || ch === ";") && !inQuotes) { fields.push(current.trim()); current = ""; }
          else current += ch;
        }
        fields.push(current.trim());
        return fields;
      };

      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map(line => {
        const values = parseCsvLine(line);
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

      const { gateOutcome, result: scope } = await executeWithGate(
        `CSV import aanmaken: ${name}`,
        () => storage.createScope({
          name, description: description || `CSV import voor ${org.name}`, status: "DRAFT", orgId,
          categories, rules, documents: [],
          ingestMeta: { query: `CSV Import: ${name}`, citations: [], researchedAt: new Date().toISOString(), model: "import-csv", gaps: [] },
        }),
        { orgId, connectorId: null, endpoint: "POST /api/import/csv" },
      );
      if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
      return res.status(201).json({ scope, imported: { categories: categories.length, rules: rules.length } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "CSV import mislukt" });
    }
  });

  const researchSchema = z.object({ query: z.string().min(3, "Zoekvraag moet minimaal 3 tekens zijn") });

  app.post("/api/ingest/research", async (req, res) => {
    const parsed = researchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.json(await researchTopic(parsed.data.query));
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "Perplexity API error" });
    }
  });

  const extractSchema = z.object({ query: z.string(), content: z.string(), citations: z.array(z.string()) });

  app.post("/api/ingest/extract", async (req, res) => {
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.json(await extractScopeFromResearch(parsed.data.query, parsed.data.content, parsed.data.citations));
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "Extraction failed" });
    }
  });

  app.post("/api/ingest/draft", async (req, res) => {
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const extraction = await extractScopeFromResearch(parsed.data.query, parsed.data.content, parsed.data.citations);
      const scope = await storage.createScope({
        name: extraction.name, description: extraction.description, status: "DRAFT",
        categories: extraction.categories, rules: extraction.rules, documents: [],
        ingestMeta: { query: parsed.data.query, citations: parsed.data.citations, researchedAt: new Date().toISOString(), model: "sonar", gaps: extraction.gaps },
      });
      return res.status(201).json(scope);
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "Draft creation failed" });
    }
  });

  const manualDraftSchema = z.object({
    name: z.string().min(1), description: z.string().optional().default(""), orgId: z.string().optional(),
    rules: z.array(z.object({
      ruleId: z.string(), layer: z.enum(["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"]),
      domain: z.string(), title: z.string(), description: z.string(),
      action: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
      overridesLowerLayers: z.boolean().optional().default(false),
      source: z.string().optional().default(""), sourceUrl: z.string().optional().default(""),
      article: z.string().optional().default(""), citation: z.string().optional().default(""),
      qTriad: z.enum(["Mens×Mens", "Mens×Systeem", "Systeem×Systeem"]).optional(),
    })).optional().default([]),
    categories: z.array(z.object({
      name: z.string(), label: z.string(),
      status: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
      escalation: z.string().nullable().optional().default(null),
      keywords: z.array(z.string()).optional().default([]),
    })).optional().default([]),
    sourceText: z.string().optional().default(""), sourceUrls: z.array(z.string()).optional().default([]),
  });

  app.post("/api/ingest/manual-draft", async (req, res) => {
    const parsed = manualDraftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const data = parsed.data;
      const scope = await storage.createScope({
        name: data.name, description: data.description, status: "DRAFT", orgId: data.orgId,
        categories: data.categories, rules: data.rules, documents: [],
        ingestMeta: { query: `Handmatig: ${data.name}`, citations: data.sourceUrls, researchedAt: new Date().toISOString(), model: "manual", gaps: [], sourceText: data.sourceText },
      });
      return res.status(201).json(scope);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Draft creation failed" });
    }
  });

  app.post("/api/scopes/:id/preflight", async (req, res) => {
    const scope = await storage.getScope(req.params.id);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    return res.json(preflightCheck({ rules: (scope.rules || []) as any, categories: (scope.categories || []) as any }));
  });

  app.post("/api/scopes/:id/lock", async (req, res) => {
    const scope = await storage.getScope(req.params.id);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    if (scope.status === "LOCKED") return res.status(400).json({ error: "Scope is al LOCKED" });
    const preflight = preflightCheck({ rules: (scope.rules || []) as any, categories: (scope.categories || []) as any });
    if (!preflight.canLock) return res.status(422).json({ error: "Preflight gefaald — scope kan niet gelocked worden", preflight });
    const locked = await storage.updateScope(scope.id, { status: "LOCKED" });
    return res.json({ scope: locked, preflight });
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
      // ── EU LEGAL GATE — EERSTE STAP, ALTIJD ──────────────────────────────
      // E = Audit(Sandbox(TaoGate(LEGAL_EU2(GLE(Generatio(I))))))
      const euResult = runEuLegalGate(parsed.data.input);
      if (euResult.triggered) {
        return res.json(formatEuBlockAsGateResponse(euResult, parsed.data.input));
      }
      // ── LEGAL BASIS CLEAR: door naar pipeline ─────────────────────────────
      return res.json(await runPipeline(parsed.data));
    } catch (err: any) {
      return res.status(500).json({
        error: "trace_error", message: err?.message ?? String(err),
        finalDecision: "BLOCK", finalReason: "Pipeline fout — geblokkeerd als fail-safe (Lex Tabularium).",
      });
    }
  });

  app.get("/api/system/info", async (_req, res) => {
    const [orgs, allScopes, allConnectors, intentStats] = await Promise.all([
      storage.getOrganizations(), storage.getScopes(), storage.getConnectors(), storage.getIntentStats(),
    ]);
    return res.json({
      version: "2.0.0", model: "ORFHEUSS Universal",
      baseline: EU_BASELINE_SCOPE,
      organizations: orgs.length, scopes: allScopes.length, connectors: allConnectors.length, intents: intentStats,
      gateProfiles: ["CLINICAL", "GENERAL", "FINANCIAL", "LEGAL", "EDUCATIONAL", "CUSTOM"],
      sectors: ["healthcare", "finance", "education", "government", "technology", "legal", "energy", "transport", "retail", "manufacturing", "other"],
      testudo: testudoStatus(),
    });
  });

  app.post("/api/seed-demo", async (_req, res) => {
    try {
      const existingOrgs = await storage.getOrganizations();
      const existingScopes = await storage.getScopes();

      const orgDefs = [
        { name: "Erasmus MC", slug: "erasmus-mc", description: "Academisch Ziekenhuis", sector: "healthcare", gateProfile: "CLINICAL" },
        { name: "Kraaijenvanger", slug: "kraaijenvanger", description: "Architectenbureau", sector: "other", gateProfile: "CUSTOM" },
        { name: "SVB", slug: "svb", description: "Sociale Verzekeringsbank — Publieke financiële instelling", sector: "finance", gateProfile: "FINANCIAL" },
      ];

      const createdOrgs: Record<string, string> = {};
      for (const def of orgDefs) {
        const existing = existingOrgs.find(o => o.slug === def.slug);
        if (existing) { createdOrgs[def.name] = existing.id; }
        else { const org = await storage.createOrganization(def); createdOrgs[def.name] = org.id; }
      }

      const scopeDefs: Array<{name: string; description: string; orgName: string | null; isDefault: string; categories: any[]; documents: any[]; rules: any[]}> = [
        {
          name: "LEYEN", description: "EU AI Act — Deterministische pre-governance classificatie voor AI-systemen.", orgName: null, isDefault: "true",
          categories: [
            { name: "POLITICAL_MANIPULATION", color: "", label: "Politieke Manipulatie (Verboden)", status: "BLOCK", keywords: ["kiezers manipuleren","stemgedrag beïnvloeden","politieke profilering","electorale manipulatie","kiezers targeting","politieke polarisatie","desinformatie campagne","nepnieuws verspreiden","verkiezingsfraude ai","stemadvies manipulatie","publieke opinie manipuleren","politieke microtargeting","voter suppression","election interference","political deepfake"], escalation: "AI Office / Toezichthouder" },
            { name: "PERSONAL_DATA_PROCESSING", color: "", label: "Persoonsgegevens Verwerking (AVG/GDPR)", status: "BLOCK", keywords: ["naam verzamelen","e-mail opslaan","bsn database","medisch dossier exporteren","telefoonnummer lijst","adres verkopen","persoonsgegevens delen","biometrische gegevens bewaren","geboortedatum profileren","locatiegegevens scrapen"], escalation: "Data Protection Officer" },
            { name: "EU_AI_PROHIBITED", color: "", label: "Verboden AI (Onaanvaardbaar Risico)", status: "BLOCK", keywords: ["social scoring","sociaal kredietsysteem","manipulatie","subliminal","kwetsbare groepen uitbuiting","biometrische massa-identificatie","real-time biometrie","gezichtsherkenning massa","emotieherkenning werkplek","emotieherkenning onderwijs","predictive policing","voorspellend politiewerk","gedragsmanipulatie","dark patterns ai","scoring overheidsdiensten"], escalation: "AI Office / Toezichthouder" },
            { name: "EU_AI_HIGH_RISK", color: "", label: "Hoog Risico (Annex III)", status: "ESCALATE_HUMAN", keywords: ["biometrisch","kritieke infrastructuur","onderwijs toelating","werkgelegenheid selectie","kredietbeoordeling","rechtshandhaving","migratie","asiel","rechtspraak ai","medisch hulpmiddel","veiligheidssysteem","sollicitatie ai","cv screening ai","grenscontrole","autonome besluitvorming","geautomatiseerde beslissing","bijzondere persoonsgegevens","kwetsbare groepen","fundamentele rechten","critical infrastructure"], escalation: "DPO / Legal / Conformiteitsbeoordelaar" },
            { name: "EU_AI_GPAI", color: "", label: "General Purpose AI", status: "ESCALATE_REGULATORY", keywords: ["foundation model","large language model","llm","gpt","general purpose","generatieve ai","chatbot breed inzetbaar","systemisch risico","training data","compute threshold","10^25 flops","gpai","basismodel"], escalation: "AI Office / DPO" },
            { name: "EU_AI_LIMITED_RISK", color: "", label: "Beperkt Risico (Transparantie)", status: "PASS_WITH_TRANSPARENCY", keywords: ["chatbot","deepfake","ai-gegenereerde content","synthetische media","transparantieverplichting","ai-label","ai-disclosure","emotieherkenning beperkt","biometrische categorisatie","ai-interactie melding"], escalation: "Transparantieverplichting" },
            { name: "EU_AI_MINIMAL", color: "", label: "Minimaal Risico", status: "PASS", keywords: ["spamfilter","ai gaming","aanbevelingssysteem","zoekalgoritme","autocorrect","vertaalsoftware","voorraadoptimalisatie","routeplanning","beeldverbetering","contentfilter"], escalation: null },
            { name: "PRIVACY_DOSSIER", color: "", label: "Privacy / Dossier", status: "ESCALATE_HUMAN", keywords: ["dossier","medisch dossier","patiëntgegevens","ouders","avg","wgbo","beroepsgeheim","inzagerecht","deel_dossier"], escalation: "DPO" },
          ],
          documents: [
            { type: "visiedocument", title: "EU AI Act — Scope Visie MC LEYEN", content: "MC LEYEN implementeert deterministische pre-governance classificatie voor AI-systemen conform de EU AI Act (Verordening (EU) 2024/1689).\n\nDe TaoGate observeert en classificeert. De mens autoriseert." },
            { type: "mandaat", title: "Mandaat — Menselijk Toezicht", content: "Conform Artikel 14 EU AI Act is menselijk toezicht verplicht voor alle hoog-risico AI-systemen." },
            { type: "protocol", title: "Protocol — Conformiteitsbeoordeling", content: "Verplichte checks voor hoog-risico AI-systemen: Risicomanagementsysteem, Data governance, Technische documentatie, Registratie in EU-databank, DPIA, Transparantie, Menselijk toezicht, Nauwkeurigheid." },
            { type: "huisregel", title: "Huisregel — Mechanica Mapping", content: "ORFHEUSS Mechanica Layer: Regeldruk MINIMAAL -> PASS, LAAG -> PASS_WITH_TRANSPARENCY, HOOG -> ESCALATE_HUMAN, VARIABEL -> ESCALATE_REGULATORY, ONEINDIG -> BLOCK." },
          ],
          rules: [
            { layer: "EU", title: "Verboden AI — Politieke Manipulatie", action: "BLOCK", domain: "AI", ruleId: "EU_AI_ART_5_POL", source: "EU AI Act", article: "Artikel 5(1)(a)", description: "AI-systemen die manipulatieve of misleidende technieken inzetten om stemgedrag of politieke overtuigingen te beïnvloeden zijn verboden.", overridesLowerLayers: true },
            { layer: "EU", title: "AVG — Onrechtmatige verwerking persoonsgegevens", action: "BLOCK", domain: "PRIVACY", ruleId: "EU_AVG_ART_6", source: "AVG/GDPR", article: "Artikel 6/Artikel 9", description: "Verwerking van persoonsgegevens zonder rechtmatige grondslag is verboden. Bijzondere categorieën (medisch, biometrisch, BSN) vereisen expliciete toestemming of wettelijke grondslag.", overridesLowerLayers: true },
            { layer: "EU", title: "Verboden AI-praktijken", action: "BLOCK", domain: "AI", ruleId: "EU_AI_ART_5", source: "EU AI Act", article: "Artikel 5", description: "AI-systemen voor sociale scoring, manipulatieve technieken, biometrische classificatie op gevoelige kenmerken, en voorspellende politie zijn verboden.", overridesLowerLayers: true },
            { layer: "EU", title: "Hoog-risico AI-systemen", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "EU_AI_ART_6", source: "EU AI Act", article: "Artikel 6-7", description: "AI-systemen in kritieke infrastructuur, onderwijs, werkgelegenheid, rechtshandhaving en migratie vereisen conformiteitsbeoordeling.", overridesLowerLayers: true },
            { layer: "EU", title: "Transparantieverplichtingen", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "EU_AI_ART_50", source: "EU AI Act", article: "Artikel 50", description: "AI-systemen die interageren met personen moeten transparant zijn.", overridesLowerLayers: true },
            { layer: "EU", title: "GPAI-modellen", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "EU_AI_ART_51", source: "EU AI Act", article: "Artikel 51-56", description: "Aanbieders van General Purpose AI-modellen moeten technische documentatie bijhouden.", overridesLowerLayers: true },
            { layer: "EU", title: "Minimaal-risico AI", action: "PASS", domain: "AI", ruleId: "EU_AI_ART_95", source: "EU AI Act", article: "Artikel 95", description: "AI-systemen met minimaal risico mogen vrij worden ingezet.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "UAVG biometrische gegevens", action: "BLOCK", domain: "AI", ruleId: "NL_UAVG_BIO", source: "UAVG (NL)", article: "Art. 29", description: "Verwerking van biometrische gegevens ter identificatie is verboden.", overridesLowerLayers: true },
            { layer: "NATIONAL", title: "WGBO AI in zorg", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "NL_WGBO_AI", source: "WGBO (NL)", article: "Art. 7:448 BW", description: "AI-ondersteuning bij medische besluitvorming vereist informatie aan de patiënt.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "AP toezicht algoritmes", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "NL_AP_ALGO", source: "Autoriteit Persoonsgegevens", article: "AVG Art. 35", description: "De AP houdt toezicht op geautomatiseerde besluitvorming.", overridesLowerLayers: false },
            { layer: "REGIONAL", title: "GGD regionaal protocol AI", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "REG_GGD_AI", source: "GGD Protocol", article: "Regionaal", description: "Regionale GGD-protocollen voor AI-gebruik.", overridesLowerLayers: false },
            { layer: "MUNICIPAL", title: "Gemeentelijk algoritmeregister", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "MUN_ALGO_REG", source: "Gemeentelijke verordening", article: "Lokaal", description: "Gemeente vereist registratie van algoritmes.", overridesLowerLayers: false },
          ],
        },
        {
          name: "Erasmus", description: "Erasmus MC — Klinisch AI governance scope", orgName: "Erasmus MC", isDefault: "true",
          categories: [
            { name: "Observation", color: "text-green-400", label: "Observatie", status: "PASS", keywords: [] as string[], escalation: null },
            { name: "PRIVACY_DOSSIER", color: "", label: "Privacy / Dossier", status: "ESCALATE_HUMAN", keywords: ["dossier","medisch dossier","patiëntgegevens","ouders","avg","wgbo","beroepsgeheim","inzagerecht","deel_dossier"], escalation: "DPO" },
            { name: "BIOMETRIC_BLOCK", color: "", label: "Biometrische Identificatie (Verboden)", status: "BLOCK", keywords: ["gezichtsherkenning","facial recognition","gezichtsprofiel","biometrische identificatie commercieel"], escalation: "AI Office / Toezichthouder" },
          ],
          documents: [] as any[],
          rules: [
            { layer: "EU", title: "Verboden AI-praktijken", action: "BLOCK", domain: "AI", ruleId: "EU_AI_ART_5", source: "EU AI Act", article: "Artikel 5", description: "AI-systemen voor sociale scoring zijn verboden.", overridesLowerLayers: true },
            { layer: "EU", title: "Hoog-risico AI-systemen", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "EU_AI_ART_6", source: "EU AI Act", article: "Artikel 6-7", description: "AI in kritieke infrastructuur vereist conformiteitsbeoordeling.", overridesLowerLayers: true },
            { layer: "EU", title: "Transparantieverplichtingen", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "EU_AI_ART_50", source: "EU AI Act", article: "Artikel 50", description: "AI-systemen moeten transparant zijn.", overridesLowerLayers: true },
            { layer: "EU", title: "GPAI-modellen", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "EU_AI_ART_51", source: "EU AI Act", article: "Artikel 51-56", description: "GPAI-modellen vereisen documentatie.", overridesLowerLayers: true },
            { layer: "EU", title: "Minimaal-risico AI", action: "PASS", domain: "AI", ruleId: "EU_AI_ART_95", source: "EU AI Act", article: "Artikel 95", description: "Minimaal risico AI mag vrij ingezet.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "UAVG biometrische gegevens", action: "BLOCK", domain: "AI", ruleId: "NL_UAVG_BIO", source: "UAVG (NL)", article: "Art. 29", description: "Biometrische gegevens verboden.", overridesLowerLayers: true },
            { layer: "NATIONAL", title: "WGBO AI in zorg", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "NL_WGBO_AI", source: "WGBO (NL)", article: "Art. 7:448 BW", description: "AI in zorg vereist patiëntinformatie.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "AP toezicht algoritmes", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "NL_AP_ALGO", source: "Autoriteit Persoonsgegevens", article: "AVG Art. 35", description: "AP houdt toezicht op algoritmes.", overridesLowerLayers: false },
            { layer: "REGIONAL", title: "GGD regionaal protocol AI", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "REG_GGD_AI", source: "GGD Protocol", article: "Regionaal", description: "GGD-protocollen voor AI.", overridesLowerLayers: false },
            { layer: "MUNICIPAL", title: "Gemeentelijk algoritmeregister", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "MUN_ALGO_REG", source: "Gemeentelijke verordening", article: "Lokaal", description: "Gemeente algoritmeregister.", overridesLowerLayers: false },
          ],
        },
        {
          name: "Finance", description: "SVB — Financiële AI governance scope voor publieke financiële dienstverlening", orgName: "SVB", isDefault: "true",
          categories: [
            { name: "FRAUDE_DETECTIE", color: "", label: "Fraude Detectie", status: "ESCALATE_HUMAN", keywords: ["fraude","witwassen","money laundering","verdachte transactie","suspicious transaction","fraude detectie","anti-witwas","wwft","aml","unusual transaction","ongebruikelijke transactie","fraudepatroon","identity fraud","identiteitsfraude"], escalation: "Compliance Officer / FIU" },
            { name: "KREDIET_SCORING", color: "", label: "Kredietbeoordeling (Hoog Risico)", status: "ESCALATE_HUMAN", keywords: ["kredietbeoordeling","credit scoring","credit check","kredietscore","leencapaciteit","kredietwaardigheid","risicoprofiel klant","automatische afwijzing","loan decision","hypotheek beoordeling","schuldbeoordeling","betalingsgedrag","creditrating"], escalation: "Risk Manager / DPO" },
            { name: "GEAUTOMATISEERDE_BESLUITVORMING", color: "", label: "Geautomatiseerde Financiële Besluitvorming", status: "BLOCK", keywords: ["automatische afwijzing uitkering","geautomatiseerde beslissing","automated decision","uitkering stopzetten","benefiet weigering","automatisch blokkeren rekening","account freeze automated","sanctiescreening automatisch","pep screening automated","zonder menselijke beoordeling"], escalation: "Bezwaarcommissie / DPO" },
            { name: "TRANSACTIE_MONITORING", color: "", label: "Transactie Monitoring", status: "PASS_WITH_TRANSPARENCY", keywords: ["transactie monitoring","payment monitoring","betaalverkeer","transactiepatroon","real-time monitoring","batch monitoring","betaalgedrag analyse","cashflow analyse","transaction screening","sanctions screening"], escalation: "Compliance Officer" },
            { name: "KLANT_PROFILERING", color: "", label: "Klant Profilering (AVG Risico)", status: "ESCALATE_HUMAN", keywords: ["klantprofiel","customer profiling","gedragsprofiel","risicoprofiel","klant segmentatie","predictive analytics klant","churn prediction","lifetime value","koopgedrag","financieel profiel","doelgroep targeting"], escalation: "DPO / Marketing Compliance" },
            { name: "REGULATORY_REPORTING", color: "", label: "Regulatoire Rapportage", status: "PASS_WITH_TRANSPARENCY", keywords: ["dnb rapportage","ecb rapportage","regulatory reporting","toezichthouder rapportage","mifid","solvency","capital requirements","liquiditeitsrapportage","stresstesten","afm melding"], escalation: "Regulatory Affairs" },
            { name: "FINANCIEEL_ADVIES_AI", color: "", label: "AI-gestuurd Financieel Advies", status: "ESCALATE_HUMAN", keywords: ["robo advisor","beleggingsadvies ai","geautomatiseerd advies","financieel advies","pensioenadvies ai","vermogensbeheer ai","portfolio optimalisatie","investment recommendation","automated financial advice","hypotheekadvies ai"], escalation: "AFM / Compliance" },
          ],
          documents: [
            { type: "visiedocument", title: "SVB — Financiële AI Governance Visie", content: "SVB implementeert AI-governance conform de EU AI Act, Wwft, en AVG voor alle geautomatiseerde financiële processen. Geen financieel besluit zonder menselijke autorisatie." },
            { type: "mandaat", title: "Mandaat — Menselijk Toezicht Financiële AI", content: "Alle geautomatiseerde financiële besluitvorming (krediet, uitkeringen, sancties) vereist menselijke beoordeling conform AVG Art. 22 en EU AI Act Art. 14." },
            { type: "protocol", title: "Protocol — Wwft/AML Compliance", content: "AI-systemen voor transactiemonitoring en fraudedetectie opereren onder Wwft-verplichting: ongebruikelijke transacties melden bij FIU-Nederland." },
          ],
          rules: [
            { layer: "EU", title: "Verboden AI — Financiële Sociale Scoring", action: "BLOCK", domain: "FINANCE", ruleId: "EU_AI_FIN_ART5", source: "EU AI Act", article: "Artikel 5", description: "AI-systemen die financiële sociale scoring toepassen op basis van gedragsdata zijn verboden.", overridesLowerLayers: true },
            { layer: "EU", title: "Hoog-risico — Kredietbeoordeling AI", action: "ESCALATE_HUMAN", domain: "FINANCE", ruleId: "EU_AI_FIN_ART6", source: "EU AI Act", article: "Artikel 6 / Annex III(5b)", description: "AI voor kredietbeoordeling en risicoclassificatie is hoog-risico en vereist conformiteitsbeoordeling.", overridesLowerLayers: true },
            { layer: "EU", title: "AVG Art. 22 — Geautomatiseerde Besluitvorming", action: "BLOCK", domain: "FINANCE", ruleId: "EU_AVG_ART22_FIN", source: "AVG/GDPR", article: "Artikel 22", description: "Volledig geautomatiseerde besluiten met rechtsgevolgen (krediet, uitkering, blokkade) zijn verboden zonder menselijke tussenkomst.", overridesLowerLayers: true },
            { layer: "NATIONAL", title: "Wwft — Meldplicht Ongebruikelijke Transacties", action: "ESCALATE_REGULATORY", domain: "FINANCE", ruleId: "NL_WWFT_MOT", source: "Wwft", article: "Art. 16", description: "Ongebruikelijke transacties moeten worden gemeld bij FIU-Nederland.", overridesLowerLayers: true },
            { layer: "NATIONAL", title: "Wft — Zorgplicht Financiële Dienstverlening", action: "ESCALATE_HUMAN", domain: "FINANCE", ruleId: "NL_WFT_ZORG", source: "Wft", article: "Art. 4:24a", description: "Financiële dienstverleners hebben zorgplicht richting klant; AI-advies vereist menselijke validatie.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "DNB Toezicht — AI in Financiële Sector", action: "ESCALATE_REGULATORY", domain: "FINANCE", ruleId: "NL_DNB_AI", source: "DNB Guidance", article: "Good Practice", description: "DNB verwacht modelvalidatie en uitlegbaarheid voor AI-modellen in de financiële sector.", overridesLowerLayers: false },
          ],
        },
      ];

      const { gateOutcome, result: demoResult } = await executeWithGate(
        "Demo setup uitvoeren",
        async () => {
          const created: string[] = [];
          for (const def of scopeDefs) {
            const existing = existingScopes.find(s => s.name === def.name);
            if (existing) { created.push(`${def.name} (already exists)`); continue; }
            const orgId = def.orgName ? createdOrgs[def.orgName] || null : null;
            await storage.createScope({
              name: def.name, description: def.description, orgId, categories: def.categories,
              documents: def.documents, rules: def.rules, isDefault: def.isDefault,
            });
            created.push(`${def.name} (created, org: ${def.orgName || "none"})`);
          }
          const finalOrgs = await storage.getOrganizations();
          const finalScopes = await storage.getScopes();
          return {
            success: true,
            organizations: finalOrgs.map(o => ({ name: o.name, gateProfile: o.gateProfile })),
            scopes: created,
            totals: { organizations: finalOrgs.length, scopes: finalScopes.length },
          };
        },
        { orgId: null, connectorId: null, endpoint: "POST /api/seed-demo" },
      );
      if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
      return res.json(demoResult);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/algoritmeregister", async (_req, res) => {
    try {
      const { gateOutcome, result: syncResults } = await executeWithGate(
        "Algoritmeregister synchronisatie uitvoeren",
        () => syncAlgoritmeregister(),
        { orgId: null, connectorId: null, endpoint: "GET /api/algoritmeregister" },
      );
      if (!gateOutcome.allowed) return res.status(gateOutcome.httpStatus).json(gateOutcome.body);
      return res.json(
        (syncResults ?? []).map((r) => {
          const dpiaLevel = classifyDpiaLevel(r.risk_score ?? 0);
          return {
            algorithm: r.algorithm_id,
            organization: r.organization,
            decision: r.decision,
            risk_score: r.risk_score,
            dpia_level: dpiaLevel,
            dpia_label: DPIA_LEVEL_LABELS[dpiaLevel],
          };
        })
      );
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dpia-level", async (req, res) => {
    try {
      const riskScore = parseFloat(req.query.risk_score as string ?? "0");
      if (isNaN(riskScore) || riskScore < 0 || riskScore > 1) {
        return res.status(400).json({ error: "risk_score moet een getal zijn tussen 0 en 1" });
      }
      const dpiaLevel = classifyDpiaLevel(riskScore);
      return res.json({
        risk_score: riskScore,
        dpia_level: dpiaLevel,
        dpia_label: DPIA_LEVEL_LABELS[dpiaLevel],
        thresholds: { D1: 0.1, D2: 0.2, D3: 0.4, D4: 0.6, D5: 0.8 },
        schema: [
          { level: 0, naam: "Geen risico", actie: "Geen DPIA nodig", range: "< 0.1" },
          { level: 1, naam: "Verwaarloosbaar", actie: "Geen DPIA nodig", range: "0.1 – 0.2" },
          { level: 2, naam: "Laag risico", actie: "DPIA aanbevolen", range: "0.2 – 0.4" },
          { level: 3, naam: "Middel risico", actie: "DPIA vereist", range: "0.4 – 0.6" },
          { level: 4, naam: "Hoog risico", actie: "DPIA verplicht (AVG art. 35)", range: "0.6 – 0.8" },
          { level: 5, naam: "Kritisch risico", actie: "DPIA verplicht + DPO-overleg", range: ">= 0.8" },
        ],
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
