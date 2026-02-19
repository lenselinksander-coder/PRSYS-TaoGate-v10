import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const observations = pgTable("observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  status: text("status").notNull(), // "PASS" or "BLOCK"
  category: text("category").notNull(), // "Observation", "Clinical_Intervention", "Operational_Command", "Allocation"
  escalation: text("escalation"), // null for PASS, "Intensivist" | "OvD" | "IC-Hoofdarts" for BLOCK
  context: text("context").notNull().default("IC"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObservationSchema = createInsertSchema(observations).omit({
  id: true,
  createdAt: true,
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observations.$inferSelect;
