import type { Express } from "express";
import { storage } from "../storage";
import { syncAlgoritmeregister } from "../integrations/algoritmeregister/syncRegister";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function registerSystemRoutes(app: Express): void {
  app.get("/api/system/info", async (_req, res) => {
    const [orgs, allScopes, allConnectors, intentStats] = await Promise.all([
      storage.getOrganizations(), storage.getScopes(), storage.getConnectors(), storage.getIntentStats(),
    ]);
    return res.json({
      version: "2.0.0", model: "ORFHEUSS Universal",
      organizations: orgs.length, scopes: allScopes.length, connectors: allConnectors.length, intents: intentStats,
      gateProfiles: ["CLINICAL", "GENERAL", "FINANCIAL", "LEGAL", "EDUCATIONAL", "CUSTOM"],
      sectors: ["healthcare", "finance", "education", "government", "technology", "legal", "energy", "transport", "retail", "manufacturing", "other"],
    });
  });

  app.get("/api/algoritmeregister", async (_req, res) => {
    try {
      const results = await syncAlgoritmeregister();
      return res.json(
        results.map((r) => ({
          algorithm: r.algorithm_id,
          organization: r.organization,
          decision: r.decision,
          risk_score: r.risk_score,
        }))
      );
    } catch (err: unknown) {
      return res.status(500).json({ error: errMsg(err) });
    }
  });
}
