import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
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
});

export type IngestMeta = z.infer<typeof ingestMetaSchema>;

export const scopes = pgTable("scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("LOCKED"),
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
