/**
 * `npm run dev`: starts a local Postgres (real Postgres binaries from the
 * embedded-postgres package, nothing to install), applies migrations, then
 * runs `next dev`. Stopping the dev server stops Postgres too.
 *
 * If DATABASE_URL points somewhere else (a Neon dev branch, say), the local
 * Postgres is skipped.
 */
import "./load-env";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const LOCAL_URL = "postgres://dinner:dinner@localhost:5433/dinner_roulette";
const url = process.env.DATABASE_URL ?? LOCAL_URL;
const useLocal = url === LOCAL_URL;

async function startLocalPostgres() {
  const dir = ".data/postgres";
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "dinner",
    password: "dinner",
    port: 5433,
    persistent: true,
    onLog: () => {},
  });
  if (!existsSync(`${dir}/PG_VERSION`)) {
    console.log("Creating local Postgres in .data/postgres (first run only)…");
    await pg.initialise();
  }
  await pg.start();
  await pg.createDatabase("dinner_roulette").catch(() => {
    // Already exists
  });
  return pg;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawn(command, args, { stdio: "inherit", env });
}

async function main() {
  const pg = useLocal ? await startLocalPostgres() : null;
  const env = { ...process.env, DATABASE_URL: url };

  const migrate = run("npx", ["tsx", "scripts/migrate.ts"], env);
  const migrateCode = await new Promise<number | null>((resolve) => migrate.on("exit", resolve));
  if (migrateCode !== 0) {
    await pg?.stop();
    process.exit(migrateCode ?? 1);
  }

  const next = run("npx", ["next", "dev", "--port", "3100", ...process.argv.slice(2)], env);
  let stopping = false;
  const stop = async (code: number) => {
    if (stopping) return;
    stopping = true;
    next.kill("SIGTERM");
    await pg?.stop();
    process.exit(code);
  };
  process.on("SIGINT", () => void stop(0));
  process.on("SIGTERM", () => void stop(0));
  next.on("exit", (code) => void stop(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
