import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export const dbReady = (async () => {
  try {
    await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS active_scope_id varchar`);
    await db.execute(sql`ALTER TABLE intents ADD COLUMN IF NOT EXISTS dpia_level INTEGER`);
    await db.execute(sql`ALTER TABLE intents ADD COLUMN IF NOT EXISTS subject_ref VARCHAR`);
    await db.execute(sql`ALTER TABLE intents ADD COLUMN IF NOT EXISTS subject_ref_type VARCHAR`);
    console.log("[DB] Schema migrations complete");
  } catch (e) {
    console.error("[DB] Migration error (non-fatal):", e);
  }
})();
