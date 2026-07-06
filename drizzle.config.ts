import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  // Migrations are generated here as SQL files under ./migrations.
  // They are APPLIED to local dev via:
  //   pnpm wrangler d1 migrations apply inkwell_db --local
  // ...and to production via:
  //   pnpm wrangler d1 migrations apply inkwell_db --remote
  // No live DB connection is needed for `drizzle-kit generate`.
});

