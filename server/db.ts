import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "WARNING: DATABASE_URL environment variable is not set. Database functionality will be unavailable.",
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost/dummy",
});

export const db = drizzle(pool, { schema });
