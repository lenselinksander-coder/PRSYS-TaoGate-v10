import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { gatewayClassify } from "../pipeline";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const gatewaySchema = z.object({ text: z.string().min(1), scopeId: z.string().optional() });

export function registerGatewayRoutes(app: Express): void {
  app.post("/api/gateway/classify", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      if (!apiKey) return res.status(401).json({ error: "API key vereist (x-api-key header)" });
      const connector = await storage.getConnectorByApiKey(apiKey);
      if (!connector) return res.status(403).json({ error: "Ongeldige of gedeactiveerde API key" });
      const parsed = gatewaySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const result = await gatewayClassify({
        text: parsed.data.text,
        orgId: connector.orgId,
        connectorId: connector.id,
        scopeId: parsed.data.scopeId,
      });
      return res.json(result);
    } catch (err: unknown) {
      return res.status(500).json({ error: "internal_error", message: errMsg(err) });
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
}
