import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const observations = pgTable("observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  status: text("status").notNull(), // "PASS" or "BLOCK"
  category: text("category").notNull(), // "Observation", "Intervention", "Allocatie", "Command"
  context: text("context").notNull().default("IC"), // e.g. "IC", "Legal Review"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObservationSchema = createInsertSchema(observations).omit({
  id: true,
  createdAt: true,
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observations.$inferSelect;
