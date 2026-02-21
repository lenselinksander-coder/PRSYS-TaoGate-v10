import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const gateDecisions = ["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"] as const;
export type GateDecision = typeof gateDecisions[number];

export const scopeCategorySchema = z.object({
  name: z.string(),
  label: z.string(),
  status: z.enum(gateDecisions),
  escalation: z.string().nullable(),
  keywords: z.array(z.string()),
  color: z.string().optional(),
});

export const scopeDocumentSchema = z.object({
  type: z.enum(["visiedocument", "mandaat", "huisregel", "protocol", "overig"]),
  title: z.string(),
  content: z.string(),
});

export const ruleLayers = ["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"] as const;
export type RuleLayer = typeof ruleLayers[number];

export const scopeRuleSchema = z.object({
  ruleId: z.string(),
  layer: z.enum(ruleLayers),
  domain: z.string(),
  title: z.string(),
  description: z.string(),
  action: z.enum(gateDecisions),
  overridesLowerLayers: z.boolean().default(true),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  article: z.string().optional(),
  citation: z.string().optional(),
  qTriad: z.enum(["Mens×Mens", "Mens×Systeem", "Systeem×Systeem"]).optional(),
});

export type ScopeRule = z.infer<typeof scopeRuleSchema>;
export type ScopeCategory = z.infer<typeof scopeCategorySchema>;
export type ScopeDocument = z.infer<typeof scopeDocumentSchema>;

export const scopeStatuses = ["DRAFT", "LOCKED"] as const;
export type ScopeStatus = typeof scopeStatuses[number];

export const ingestMetaSchema = z.object({
  query: z.string(),
  citations: z.array(z.string()),
  researchedAt: z.string(),
  model: z.string(),
  gaps: z.array(z.string()).optional(),
  sourceText: z.string().optional(),
});

export type IngestMeta = z.infer<typeof ingestMetaSchema>;

export const gateProfiles = ["CLINICAL", "GENERAL", "FINANCIAL", "LEGAL", "EDUCATIONAL", "CUSTOM"] as const;
export type GateProfile = typeof gateProfiles[number];

export const orgSectors = [
  "healthcare", "finance", "education", "government", "technology",
  "legal", "energy", "transport", "retail", "manufacturing", "other"
] as const;
export type OrgSector = typeof orgSectors[number];

export const connectorTypes = ["AI_AGENT", "DATA_SOURCE", "WEBHOOK"] as const;
export type ConnectorType = typeof connectorTypes[number];

export const connectorStatuses = ["ACTIVE", "INACTIVE", "REVOKED"] as const;
export type ConnectorStatus = typeof connectorStatuses[number];

// ── Organizations ──────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sector: text("sector").notNull().default("other"),
  gateProfile: text("gate_profile").notNull().default("GENERAL"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// ── Scopes ─────────────────────────────────────────────────
export const scopes = pgTable("scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("LOCKED"),
  orgId: varchar("org_id"),
  categories: jsonb("categories").notNull().$type<ScopeCategory[]>(),
  documents: jsonb("documents").notNull().$type<ScopeDocument[]>().default([]),
  rules: jsonb("rules").notNull().$type<ScopeRule[]>().default([]),
  ingestMeta: jsonb("ingest_meta").$type<IngestMeta>(),
  isDefault: text("is_default").default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScopeSchema = createInsertSchema(scopes, {
  categories: z.array(scopeCategorySchema),
  documents: z.array(scopeDocumentSchema).optional(),
  rules: z.array(scopeRuleSchema).optional(),
  status: z.enum(scopeStatuses).optional(),
  ingestMeta: ingestMetaSchema.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScope = z.infer<typeof insertScopeSchema>;
export type Scope = typeof scopes.$inferSelect;

// ── Observations ───────────────────────────────────────────
export const observations = pgTable("observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  status: text("status").notNull(),
  category: text("category").notNull(),
  escalation: text("escalation"),
  context: text("context").notNull().default("IC"),
  scopeId: varchar("scope_id"),
  olympiaRuleId: text("olympia_rule_id"),
  olympiaAction: text("olympia_action"),
  olympiaLayer: text("olympia_layer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObservationSchema = createInsertSchema(observations).omit({
  id: true,
  createdAt: true,
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observations.$inferSelect;

// ── Connectors (external AI agents, data sources, webhooks) ──
export const connectors = pgTable("connectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("AI_AGENT"),
  provider: text("provider"),
  description: text("description"),
  apiKey: text("api_key").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  config: jsonb("config").$type<Record<string, any>>().default({}),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConnectorSchema = createInsertSchema(connectors).omit({
  id: true,
  apiKey: true,
  lastUsedAt: true,
  createdAt: true,
});

export type InsertConnector = z.infer<typeof insertConnectorSchema>;
export type Connector = typeof connectors.$inferSelect;

// ── Intents (gateway audit log) ────────────────────────────
export const intents = pgTable("intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  scopeId: varchar("scope_id"),
  connectorId: varchar("connector_id"),
  inputText: text("input_text").notNull(),
  decision: text("decision").notNull(),
  category: text("category"),
  layer: text("layer"),
  pressure: text("pressure"),
  reason: text("reason"),
  escalation: text("escalation"),
  processingMs: integer("processing_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIntentSchema = createInsertSchema(intents).omit({
  id: true,
  createdAt: true,
});

export type InsertIntent = z.infer<typeof insertIntentSchema>;
export type Intent = typeof intents.$inferSelect;
