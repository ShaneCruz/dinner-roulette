import { createDatabase } from "@/db";
import { runMigrations } from "@/db/migrate";

/** A fresh in-memory Postgres with all migrations applied. */
export async function createTestDatabase() {
  const db = createDatabase("pglite:memory");
  await runMigrations(db, "pglite:memory");
  return db;
}
