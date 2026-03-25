import {
  type Observation, type InsertObservation, observations,
  type Scope, type InsertScope, scopes, type ScopeRule,
  type Organization, type InsertOrganization, organizations,
  type Connector, type InsertConnector, connectors,
  type Intent, type InsertIntent, intents,
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql, and } from "drizzle-orm";
import crypto from "crypto";
import { appendWormEntry } from "./audit/wormChain";

export interface IStorage {
  createObservation(observation: InsertObservation): Promise<Observation>;
  getObservations(context?: string, scopeId?: string): Promise<Observation[]>;
  getStats(context?: string, scopeId?: string): Promise<{ total: number; passed: number; transparency: number; escalated: number; blocked: number }>;

  createScope(scope: InsertScope): Promise<Scope>;
  getScopes(): Promise<Scope[]>;
  getScopesByOrg(orgId: string): Promise<Scope[]>;
  getScope(id: string): Promise<Scope | undefined>;
  updateScope(id: string, scope: Partial<InsertScope>): Promise<Scope | undefined>;
  deleteScope(id: string): Promise<boolean>;
  getDefaultScope(): Promise<Scope | undefined>;
  getTapeScopesByOrg(orgId: string): Promise<Scope[]>;

  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;

  createConnector(connector: InsertConnector): Promise<Connector>;
  getConnectors(orgId?: string): Promise<Connector[]>;
  getConnector(id: string): Promise<Connector | undefined>;
  getConnectorByApiKey(apiKey: string): Promise<Connector | undefined>;
  updateConnector(id: string, connector: Partial<InsertConnector>): Promise<Connector | undefined>;
  deleteConnector(id: string): Promise<boolean>;
  touchConnector(id: string): Promise<void>;

  upsertScopeRules(scopeId: string, rules: ScopeRule[]): Promise<Scope | undefined>;

  createIntent(intent: InsertIntent): Promise<Intent>;
  getIntents(orgId?: string, limit?: number): Promise<Intent[]>;
  getIntentStats(orgId?: string): Promise<{ total: number; passed: number; blocked: number; escalated: number }>;
  getIntentsBySubjectRef(subjectRefHash: string): Promise<Pick<Intent, "id" | "decision" | "category" | "layer" | "reason" | "ruleId" | "dpiaLevel" | "escalation" | "createdAt">[]>;
  getHerautFeed(limit?: number): Promise<{ decision: string; category: string | null; layer: string | null; dpiaLevel: number | null; reasonShort: string | null; createdAt: Date }[]>;
}

export class DatabaseStorage implements IStorage {
  async createObservation(observation: InsertObservation): Promise<Observation> {
    const [result] = await db.insert(observations).values(observation).returning();
    return result;
  }

  async getObservations(context?: string, scopeId?: string): Promise<Observation[]> {
    if (scopeId) {
      return db.select().from(observations).where(eq(observations.scopeId!, scopeId)).orderBy(desc(observations.createdAt)).limit(100);
    }
    if (context) {
      return db.select().from(observations).where(eq(observations.context, context)).orderBy(desc(observations.createdAt)).limit(100);
    }
    return db.select().from(observations).orderBy(desc(observations.createdAt)).limit(100);
  }

  async getStats(context?: string, scopeId?: string): Promise<{ total: number; passed: number; transparency: number; escalated: number; blocked: number }> {
    const all = await this.getObservations(context, scopeId);
    return {
      total: all.length,
      passed: all.filter(o => o.status === "PASS").length,
      transparency: all.filter(o => o.status === "PASS_WITH_TRANSPARENCY").length,
      escalated: all.filter(o => o.status === "ESCALATE_HUMAN" || o.status === "ESCALATE_REGULATORY").length,
      blocked: all.filter(o => o.status === "BLOCK").length,
    };
  }

  async createScope(scope: InsertScope): Promise<Scope> {
    const [result] = await db.insert(scopes).values({
      ...scope,
      documents: scope.documents || [],
    }).returning();
    return result;
  }

  async getScopes(): Promise<Scope[]> {
    return db.select().from(scopes).orderBy(desc(scopes.createdAt));
  }

  async getScopesByOrg(orgId: string): Promise<Scope[]> {
    return db.select().from(scopes).where(eq(scopes.orgId!, orgId)).orderBy(desc(scopes.createdAt));
  }

  async getScope(id: string): Promise<Scope | undefined> {
    const [result] = await db.select().from(scopes).where(eq(scopes.id, id));
    return result;
  }

  async updateScope(id: string, scope: Partial<InsertScope>): Promise<Scope | undefined> {
    const [result] = await db.update(scopes)
      .set({ ...scope, updatedAt: new Date() })
      .where(eq(scopes.id, id))
      .returning();
    return result;
  }

  async deleteScope(id: string): Promise<boolean> {
    const result = await db.delete(scopes).where(eq(scopes.id, id)).returning();
    return result.length > 0;
  }

  async getDefaultScope(): Promise<Scope | undefined> {
    const [result] = await db.select().from(scopes).where(eq(scopes.isDefault!, "true"));
    return result;
  }

  async getTapeScopesByOrg(orgId: string): Promise<Scope[]> {
    return db.select().from(scopes)
      .where(and(eq(scopes.orgId!, orgId), eq(scopes.isTapeScope, true), eq(scopes.status, "LOCKED")))
      .orderBy(scopes.tapeNumber);
  }

  async upsertScopeRules(scopeId: string, rules: ScopeRule[]): Promise<Scope | undefined> {
    const scope = await this.getScope(scopeId);
    if (!scope) return undefined;

    const existingRules: ScopeRule[] = scope.rules || [];
    const ruleMap = new Map<string, ScopeRule>();

    for (const rule of existingRules) {
      ruleMap.set(rule.ruleId, rule);
    }

    for (const incoming of rules) {
      const existing = ruleMap.get(incoming.ruleId);
      if (existing) {
        ruleMap.set(incoming.ruleId, {
          ...existing,
          action: incoming.action,
          description: incoming.description,
          layer: incoming.layer,
          overridesLowerLayers: incoming.overridesLowerLayers,
        });
      } else {
        ruleMap.set(incoming.ruleId, incoming);
      }
    }

    const merged = Array.from(ruleMap.values());
    const [result] = await db.update(scopes)
      .set({ rules: merged, updatedAt: new Date() })
      .where(eq(scopes.id, scopeId))
      .returning();
    return result;
  }

  // ── Organizations ──────────────────────────────────────
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [result] = await db.insert(organizations).values(org).returning();
    return result;
  }

  async getOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.id, id));
    return result;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return result;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [result] = await db.update(organizations)
      .set(org)
      .where(eq(organizations.id, id))
      .returning();
    return result;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const result = await db.delete(organizations).where(eq(organizations.id, id)).returning();
    return result.length > 0;
  }

  // ── Connectors ─────────────────────────────────────────
  async createConnector(connector: InsertConnector): Promise<Connector> {
    const apiKey = `orf_${crypto.randomBytes(24).toString("hex")}`;
    const [result] = await db.insert(connectors).values({ ...connector, apiKey }).returning();
    return result;
  }

  async getConnectors(orgId?: string): Promise<Connector[]> {
    if (orgId) {
      return db.select().from(connectors).where(eq(connectors.orgId, orgId)).orderBy(desc(connectors.createdAt));
    }
    return db.select().from(connectors).orderBy(desc(connectors.createdAt));
  }

  async getConnector(id: string): Promise<Connector | undefined> {
    const [result] = await db.select().from(connectors).where(eq(connectors.id, id));
    return result;
  }

  async getConnectorByApiKey(apiKey: string): Promise<Connector | undefined> {
    const [result] = await db.select().from(connectors)
      .where(and(eq(connectors.apiKey, apiKey), eq(connectors.status, "ACTIVE")));
    return result;
  }

  async updateConnector(id: string, connector: Partial<InsertConnector>): Promise<Connector | undefined> {
    const [result] = await db.update(connectors)
      .set(connector)
      .where(eq(connectors.id, id))
      .returning();
    return result;
  }

  async deleteConnector(id: string): Promise<boolean> {
    const result = await db.delete(connectors).where(eq(connectors.id, id)).returning();
    return result.length > 0;
  }

  async touchConnector(id: string): Promise<void> {
    await db.update(connectors).set({ lastUsedAt: new Date() }).where(eq(connectors.id, id));
  }

  // ── Intents (audit log) ────────────────────────────────
  async createIntent(intent: InsertIntent): Promise<Intent> {
    const [result] = await db.insert(intents).values(intent).returning();
    // Feature 2: WORM audit chain — fire-and-forget write to S3 Object Lock.
    // Never blocks the API response. No-op if WORM_S3_BUCKET is not set.
    appendWormEntry({
      orgId: intent.orgId ?? null,
      connectorId: intent.connectorId ?? null,
      inputText: intent.inputText,
      decision: intent.decision,
      category: intent.category ?? null,
      layer: intent.layer ?? null,
      pressure: intent.pressure ?? null,
      processingMs: intent.processingMs ?? null,
    });
    return result;
  }

  async getIntents(orgId?: string, limit = 100): Promise<Intent[]> {
    if (orgId) {
      return db.select().from(intents).where(eq(intents.orgId!, orgId)).orderBy(desc(intents.createdAt)).limit(limit);
    }
    return db.select().from(intents).orderBy(desc(intents.createdAt)).limit(limit);
  }

  async getIntentStats(orgId?: string): Promise<{ total: number; passed: number; blocked: number; escalated: number }> {
    const all = await this.getIntents(orgId, 1000);
    return {
      total: all.length,
      passed: all.filter(i => i.decision === "PASS" || i.decision === "PASS_WITH_TRANSPARENCY").length,
      blocked: all.filter(i => i.decision === "BLOCK").length,
      escalated: all.filter(i => i.decision === "ESCALATE_HUMAN" || i.decision === "ESCALATE_REGULATORY").length,
    };
  }

  async getIntentsBySubjectRef(subjectRefHash: string): Promise<Pick<Intent, "id" | "decision" | "category" | "layer" | "reason" | "ruleId" | "dpiaLevel" | "escalation" | "createdAt">[]> {
    const rows = await db
      .select({
        id: intents.id,
        decision: intents.decision,
        category: intents.category,
        layer: intents.layer,
        reason: intents.reason,
        ruleId: intents.ruleId,
        dpiaLevel: intents.dpiaLevel,
        escalation: intents.escalation,
        createdAt: intents.createdAt,
      })
      .from(intents)
      .where(eq(intents.subjectRef!, subjectRefHash))
      .orderBy(desc(intents.createdAt))
      .limit(200);
    return rows;
  }

  async getHerautFeed(limit = 50): Promise<{ decision: string; category: string | null; layer: string | null; dpiaLevel: number | null; reasonShort: string | null; createdAt: Date }[]> {
    const rows = await db
      .select({
        decision: intents.decision,
        category: intents.category,
        layer: intents.layer,
        dpiaLevel: intents.dpiaLevel,
        reason: intents.reason,
        createdAt: intents.createdAt,
      })
      .from(intents)
      .orderBy(desc(intents.createdAt))
      .limit(Math.min(limit, 200));
    return rows.map(r => ({
      decision: r.decision,
      category: r.category,
      layer: r.layer,
      dpiaLevel: r.dpiaLevel,
      reasonShort: r.reason ? r.reason.slice(0, 80) : null,
      createdAt: r.createdAt,
    }));
  }
}

export const storage = new DatabaseStorage();
