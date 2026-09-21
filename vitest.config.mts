import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Booting an in-memory Postgres (PGlite) takes a few seconds.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: "pglite:memory",
      BETTER_AUTH_SECRET: "test-secret-not-for-production",
    },
  },
});
