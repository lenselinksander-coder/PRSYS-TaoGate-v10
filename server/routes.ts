import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerGateRoutes } from "./routes/gate";
import { registerObservationRoutes } from "./routes/observations";
import { registerScopeRoutes } from "./routes/scopes";
import { registerOrganizationRoutes } from "./routes/organizations";
import { registerConnectorRoutes } from "./routes/connectors";
import { registerGatewayRoutes } from "./routes/gateway";
import { registerImportRoutes } from "./routes/import";
import { registerSystemRoutes } from "./routes/system";
import { registerSeedRoutes } from "./routes/seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerGateRoutes(app);
  registerObservationRoutes(app);
  registerScopeRoutes(app);
  registerOrganizationRoutes(app);
  registerConnectorRoutes(app);
  registerGatewayRoutes(app);
  registerImportRoutes(app);
  registerSystemRoutes(app);
  registerSeedRoutes(app);

  return httpServer;
}
