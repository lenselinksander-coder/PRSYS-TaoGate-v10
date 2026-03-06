import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { gateProfiles } from "@shared/schema";

const createOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug mag alleen kleine letters, cijfers en koppeltekens bevatten"),
  description: z.string().optional(),
  sector: z.string().optional(),
  gateProfile: z.enum(gateProfiles).optional(),
});

export function registerOrganizationRoutes(app: Express): void {
  app.get("/api/organizations", async (_req, res) => {
    return res.json(await storage.getOrganizations());
  });

  app.get("/api/organizations/:id", async (req, res) => {
    const org = await storage.getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    return res.json(org);
  });

  app.post("/api/organizations", async (req, res) => {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = await storage.getOrganizationBySlug(parsed.data.slug);
    if (existing) return res.status(409).json({ error: "Organisatie met deze slug bestaat al" });
    return res.status(201).json(await storage.createOrganization(parsed.data));
  });

  app.put("/api/organizations/:id", async (req, res) => {
    const parsed = createOrgSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const org = await storage.updateOrganization(req.params.id, parsed.data);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    return res.json(org);
  });

  app.delete("/api/organizations/:id", async (req, res) => {
    const deleted = await storage.deleteOrganization(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Organization not found" });
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
    const updated = await storage.updateOrganization(req.params.id, { activeScopeId: scopeId });
    return res.json({ success: true, org: updated, mountedScope: scope.name });
  });

  app.delete("/api/organizations/:id/mount", async (req, res) => {
    const org = await storage.getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    const updated = await storage.updateOrganization(req.params.id, { activeScopeId: null });
    return res.json({ success: true, org: updated });
  });

  app.get("/api/organizations/:id/active-scope", async (req, res) => {
    const org = await storage.getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (!org.activeScopeId) return res.json({ scope: null });
    const scope = await storage.getScope(org.activeScopeId);
    return res.json({ scope: scope || null });
  });
}
