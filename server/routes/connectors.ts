import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";

const createConnectorSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1),
  type: z.enum(["AI_AGENT", "DATA_SOURCE", "WEBHOOK"]).optional(),
  provider: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

function maskApiKey(apiKey: string): string {
  return apiKey.substring(0, 12) + "..." + apiKey.substring(apiKey.length - 4);
}

export function registerConnectorRoutes(app: Express): void {
  app.get("/api/connectors", async (req, res) => {
    const orgId = req.query.orgId as string | undefined;
    const list = await storage.getConnectors(orgId);
    return res.json(list.map(c => ({ ...c, apiKey: maskApiKey(c.apiKey) })));
  });

  app.get("/api/connectors/:id", async (req, res) => {
    const connector = await storage.getConnector(req.params.id);
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    return res.json({ ...connector, apiKey: maskApiKey(connector.apiKey) });
  });

  app.post("/api/connectors", async (req, res) => {
    const parsed = createConnectorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json(await storage.createConnector(parsed.data));
  });

  app.put("/api/connectors/:id", async (req, res) => {
    const parsed = createConnectorSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const connector = await storage.updateConnector(req.params.id, parsed.data);
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    return res.json(connector);
  });

  app.delete("/api/connectors/:id", async (req, res) => {
    const deleted = await storage.deleteConnector(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Connector not found" });
    return res.json({ success: true });
  });
}
