import type { Express } from "express";
import { storage } from "../storage";
import { insertObservationSchema } from "@shared/schema";

export function registerObservationRoutes(app: Express): void {
  app.post("/api/observations", async (req, res) => {
    const parsed = insertObservationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const observation = await storage.createObservation(parsed.data);
    return res.status(201).json(observation);
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
}
