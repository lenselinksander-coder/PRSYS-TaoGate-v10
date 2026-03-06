import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertScopeSchema } from "@shared/schema";
import { resolveOlympiaRules, preflightCheck } from "../pipeline";

export function registerScopeRoutes(app: Express): void {
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
    return res.status(201).json(await storage.createScope(parsed.data));
  });

  app.put("/api/scopes/:id", async (req, res) => {
    const parsed = insertScopeSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const scope = await storage.updateScope(req.params.id, parsed.data);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    return res.json(scope);
  });

  app.delete("/api/scopes/:id", async (req, res) => {
    const deleted = await storage.deleteScope(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Scope not found" });
    return res.json({ success: true });
  });

  app.post("/api/scopes/:id/preflight", async (req, res) => {
    const scope = await storage.getScope(req.params.id);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    return res.json(preflightCheck({ rules: scope.rules || [], categories: scope.categories || [] }));
  });

  app.post("/api/scopes/:id/lock", async (req, res) => {
    const scope = await storage.getScope(req.params.id);
    if (!scope) return res.status(404).json({ error: "Scope not found" });
    if (scope.status === "LOCKED") return res.status(400).json({ error: "Scope is al LOCKED" });
    const preflight = preflightCheck({ rules: scope.rules || [], categories: scope.categories || [] });
    if (!preflight.canLock) return res.status(422).json({ error: "Preflight gefaald — scope kan niet gelocked worden", preflight });
    const locked = await storage.updateScope(scope.id, { status: "LOCKED" });
    return res.json({ scope: locked, preflight });
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
}
