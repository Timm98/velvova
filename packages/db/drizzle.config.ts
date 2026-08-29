import type { Config } from "drizzle-kit";

/**
 * Migrationen werden gegen echtes Postgres-SQL erzeugt. Ob lokal PGlite
 * oder ein Server dahintersteht, spielt fuer die Migration keine Rolle -
 * beides ist Postgres.
 */
export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/paycheck" },
  verbose: true,
  strict: true,
} satisfies Config;
