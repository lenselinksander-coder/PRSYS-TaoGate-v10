import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scopeCategorySchema = z.object({
  name: z.string(),
  label: z.string(),
  status: z.enum(["PASS", "BLOCK"]),
  escalation: z.string().nullable(),
  keywords: z.array(z.string()),
  color: z.string().optional(),
});

export const scopeDocumentSchema = z.object({
  type: z.enum(["visiedocument", "mandaat", "huisregel", "protocol", "overig"]),
  title: z.string(),
  content: z.string(),
});

export type ScopeCategory = z.infer<typeof scopeCategorySchema>;
export type ScopeDocument = z.infer<typeof scopeDocumentSchema>;

export const scopes = pgTable("scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  categories: jsonb("categories").notNull().$type<ScopeCategory[]>(),
  documents: jsonb("documents").notNull().$type<ScopeDocument[]>().default([]),
  isDefault: text("is_default").default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScopeSchema = createInsertSchema(scopes, {
  categories: z.array(scopeCategorySchema),
  documents: z.array(scopeDocumentSchema).optional(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObservationSchema = createInsertSchema(observations).omit({
  id: true,
  createdAt: true,
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observations.$inferSelect;
