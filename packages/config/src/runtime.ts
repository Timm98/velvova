import { z } from "zod";
import { currentEnv, type Env } from "./env.ts";

/**
 * Laufzeitkonfiguration. Wird einmal beim Start validiert, damit ein
 * Konfigurationsfehler sofort und verstaendlich auffällt statt später
 * als undefinierter Wert mitten in einem Request.
 *
 * Grundsatz: Ohne einen einzigen Schlüssel muss das Projekt starten.
 * Fehlt ein Zugang, fällt der jeweilige Adapter auf einen deutlich
 * gekennzeichneten Demo-Pfad zurück - er täuscht nie Betrieb vor.
 */

export const OperatingModeSchema = z.enum(["demo", "live"]);
export type OperatingMode = z.infer<typeof OperatingModeSchema>;

const RuntimeSchema = z.object({
  mode: OperatingModeSchema.default("demo"),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),

  db: z.object({
    driver: z.enum(["pglite", "pg"]).default("pglite"),
    url: z.string().optional(),
    pgliteDataDir: z.string().default(".data/pglite"),
  }),

  auth: z.object({
    secret: z.string().optional(),
    cookieName: z.string().default("paycheck_session"),
    sessionTtlDays: z.coerce.number().int().positive().default(30),
  }),

  ai: z.object({
    provider: z.enum(["mock", "anthropic"]).default("mock"),
    apiKey: z.string().optional(),
    modelStrong: z.string().default("claude-opus-5"),
    modelFast: z.string().default("claude-haiku-4-5-20251001"),
    modelEmbed: z.string().default("local-hash-embedding"),
    maxTokensPerRun: z.coerce.number().int().positive().default(4096),
    timeoutMs: z.coerce.number().int().positive().default(60_000),
    monthlyBudgetEur: z.coerce.number().nonnegative().default(0),
  }),

  voice: z.object({
    provider: z.enum(["mock", "browser", "anthropic"]).default("mock"),
    storeTranscripts: z.coerce.boolean().default(false),
  }),

  mail: z.object({
    provider: z.enum(["draft", "mailpit", "gmail", "outlook"]).default("draft"),
    smtpUrl: z.string().optional(),
    from: z.string().optional(),
  }),

  storage: z.object({
    driver: z.enum(["local", "s3"]).default("local"),
    dir: z.string().default(".storage"),
    encryptionKey: z.string().optional(),
    s3: z
      .object({
        endpoint: z.string().optional(),
        bucket: z.string().optional(),
        region: z.string().default("eu-central-1"),
      })
      .optional(),
  }),

  jobs: z.object({ sources: z.array(z.string()).default(["seed"]) }),
  reviews: z.object({ sources: z.array(z.string()).default(["seed"]) }),
});

export type RuntimeConfig = z.infer<typeof RuntimeSchema>;

function list(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : fallback;
}

export function loadRuntimeConfig(env: Env = currentEnv()): RuntimeConfig {
  return RuntimeSchema.parse({
    mode: env.PAYCHECK_DEMO_MODE === "live" ? "live" : "demo",
    nodeEnv: env.NODE_ENV ?? "development",
    db: {
      driver: env.DATABASE_DRIVER ?? "pglite",
      url: env.DATABASE_URL,
      pgliteDataDir: env.PGLITE_DATA_DIR ?? ".data/pglite",
    },
    auth: {
      secret: env.AUTH_SECRET,
      cookieName: env.AUTH_COOKIE_NAME ?? "paycheck_session",
      sessionTtlDays: env.AUTH_SESSION_TTL_DAYS ?? 30,
    },
    ai: {
      provider: env.AI_PROVIDER ?? "mock",
      apiKey: env.ANTHROPIC_API_KEY,
      modelStrong: env.AI_MODEL_STRONG ?? "claude-opus-5",
      modelFast: env.AI_MODEL_FAST ?? "claude-haiku-4-5-20251001",
      modelEmbed: env.AI_MODEL_EMBED ?? "local-hash-embedding",
      maxTokensPerRun: env.AI_MAX_TOKENS_PER_RUN ?? 4096,
      timeoutMs: env.AI_TIMEOUT_MS ?? 60_000,
      monthlyBudgetEur: env.AI_MONTHLY_BUDGET_EUR ?? 0,
    },
    voice: {
      provider: env.VOICE_PROVIDER ?? "mock",
      storeTranscripts: env.VOICE_STORE_TRANSCRIPTS === "true",
    },
    mail: { provider: env.MAIL_PROVIDER ?? "draft", smtpUrl: env.SMTP_URL, from: env.MAIL_FROM },
    storage: {
      driver: env.STORAGE_DRIVER ?? "local",
      dir: env.STORAGE_DIR ?? ".storage",
      encryptionKey: env.STORAGE_ENCRYPTION_KEY,
      s3: { endpoint: env.S3_ENDPOINT, bucket: env.S3_BUCKET, region: env.S3_REGION ?? "eu-central-1" },
    },
    jobs: { sources: list(env.JOB_SOURCES, ["seed"]) },
    reviews: { sources: list(env.REVIEW_SOURCES, ["seed"]) },
  });
}

/**
 * Ein Adapter gilt nur als verbunden, wenn er wirklich konfiguriert ist.
 * Diese Funktion ist die Grundlage dafür, dass die Oberfläche ehrlich
 * "nicht verbunden" anzeigt, statt Betrieb vorzutaeuschen.
 */
export function integrationStatus(cfg: RuntimeConfig) {
  return {
    ai: cfg.ai.provider === "anthropic" && !!cfg.ai.apiKey ? "connected" : "mock",
    mail:
      cfg.mail.provider === "draft"
        ? "draft-only"
        : cfg.mail.provider === "mailpit" && cfg.mail.smtpUrl
          ? "connected"
          : "not-connected",
    storage: cfg.storage.driver === "s3" && cfg.storage.s3?.bucket ? "connected" : "local",
    voice: cfg.voice.provider === "mock" ? "mock" : "connected",
    jobSources: cfg.jobs.sources,
    reviewSources: cfg.reviews.sources,
  } as const;
}
