import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

(async () => {
  try {
    await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS active_scope_id varchar`);
  } catch {}
})();
