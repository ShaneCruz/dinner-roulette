import "./load-env";
import { databaseUrl, db } from "@/db";
import { runMigrations } from "@/db/migrate";

async function main() {
  const url = databaseUrl();
  const where = url.startsWith("pglite:") ? url : new URL(url).host;
  console.log(`Migrating database at ${where}...`);
  await runMigrations(db, url);
  console.log("Migrations are up to date.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
