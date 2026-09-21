import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { Database } from "./index";

const migrationsFolder = "./drizzle";

export async function runMigrations(db: Database, url: string) {
  if (url.startsWith("pglite:")) {
    await migratePglite(db as unknown as PgliteDatabase, { migrationsFolder });
  } else {
    await migratePostgres(db, { migrationsFolder });
  }
}
