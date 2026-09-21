import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * DATABASE_URL picks the driver:
 * - postgres://... uses postgres-js (Neon in production, the embedded local
 *   Postgres that `npm run dev` starts in development)
 * - pglite:memory runs Postgres in-process via WebAssembly; tests use it so
 *   each suite gets a fresh, throwaway database
 */
export function createDatabase(url: string): Database {
  if (url.startsWith("pglite:")) {
    const target = url.slice("pglite:".length);
    if (target !== "memory") mkdirSync(target, { recursive: true });
    const client = new PGlite(target === "memory" ? undefined : target);
    // Both drivers expose the same query builder; only the result
    // metadata types differ, which this app never touches.
    return drizzlePglite(client, { schema }) as unknown as Database;
  }
  const client = postgres(url, {
    // Neon's pooled endpoint runs PgBouncer in transaction mode
    prepare: false,
    max: 5,
    onnotice: () => {},
  });
  return drizzlePostgres(client, { schema });
}

export function databaseUrl(): string {
  return process.env.DATABASE_URL || "postgres://dinner:dinner@localhost:5433/dinner_roulette";
}

// Next dev can evaluate this module more than once in the same process, and
// two PGlite instances must never open the same data directory.
const globalForDb = globalThis as unknown as { __dinnerRouletteDb?: Database };

export const db: Database = (globalForDb.__dinnerRouletteDb ??= createDatabase(databaseUrl()));

export { schema };
