import { type Observation, type InsertObservation, observations, type Scope, type InsertScope, scopes } from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql } from "drizzle-orm";

export interface IStorage {
  createObservation(observation: InsertObservation): Promise<Observation>;
  getObservations(context?: string, scopeId?: string): Promise<Observation[]>;
  getStats(context?: string, scopeId?: string): Promise<{ total: number; passed: number; blocked: number }>;

  createScope(scope: InsertScope): Promise<Scope>;
  getScopes(): Promise<Scope[]>;
  getScope(id: string): Promise<Scope | undefined>;
  updateScope(id: string, scope: Partial<InsertScope>): Promise<Scope | undefined>;
  deleteScope(id: string): Promise<boolean>;
  getDefaultScope(): Promise<Scope | undefined>;
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

  async getStats(context?: string, scopeId?: string): Promise<{ total: number; passed: number; blocked: number }> {
    const all = await this.getObservations(context, scopeId);
    return {
      total: all.length,
      passed: all.filter(o => o.status === "PASS").length,
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
}

export const storage = new DatabaseStorage();
