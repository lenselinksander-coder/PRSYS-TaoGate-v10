import { type Observation, type InsertObservation, observations } from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql } from "drizzle-orm";

export interface IStorage {
  createObservation(observation: InsertObservation): Promise<Observation>;
  getObservations(context?: string): Promise<Observation[]>;
  getStats(context?: string): Promise<{ total: number; passed: number; blocked: number }>;
}

export class DatabaseStorage implements IStorage {
  async createObservation(observation: InsertObservation): Promise<Observation> {
    const [result] = await db.insert(observations).values(observation).returning();
    return result;
  }

  async getObservations(context?: string): Promise<Observation[]> {
    if (context) {
      return db.select().from(observations).where(eq(observations.context, context)).orderBy(desc(observations.createdAt)).limit(100);
    }
    return db.select().from(observations).orderBy(desc(observations.createdAt)).limit(100);
  }

  async getStats(context?: string): Promise<{ total: number; passed: number; blocked: number }> {
    const all = await this.getObservations(context);
    return {
      total: all.length,
      passed: all.filter(o => o.status === "PASS").length,
      blocked: all.filter(o => o.status === "BLOCK").length,
    };
  }
}

export const storage = new DatabaseStorage();
