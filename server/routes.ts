import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertObservationSchema, insertScopeSchema } from "@shared/schema";
import type { Scope, GateDecision } from "@shared/schema";

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

    const result = classifyWithScope(text, scope);
    return res.json(result);
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

  return httpServer;
}
