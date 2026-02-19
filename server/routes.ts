import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertObservationSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
    const observations = await storage.getObservations(context);
    return res.json(observations);
  });

  app.get("/api/observations/stats", async (req, res) => {
    const context = req.query.context as string | undefined;
    const stats = await storage.getStats(context);
    return res.json(stats);
  });

  return httpServer;
}
