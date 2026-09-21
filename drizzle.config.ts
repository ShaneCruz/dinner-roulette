import { defineConfig } from "drizzle-kit";

// Only used to generate SQL migrations from src/db/schema.ts
// (`npm run db:generate`). Applying them is done by scripts/migrate.ts so the
// same code path works for PGlite locally and Neon in production.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
