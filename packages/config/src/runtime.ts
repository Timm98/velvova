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
  /** Absolute Basisadresse. Für Links in E-Mails und für Rückkehradressen —
   *  dort ist ein relativer Pfad wertlos. */
  appUrl: z.string().default("http://localhost:3000"),
  /** Die fachliche Umgebung, unabhängig von NODE_ENV. Ein Staging-System
   *  läuft als Produktionsbuild und ist trotzdem keine Produktion. */
  appEnv: z.string().default("development"),

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
    /**
     * "self_hosted" spricht einen OpenAI-kompatiblen Endpunkt an, der
     * selbst betrieben wird. Das ist kein Beiwerk: für besonders
     * schutzbedürftige Verarbeitung muss ein Weg offenstehen, der das
     * Haus nicht verlässt — und der darf keinen Umbau erfordern.
     */
    /* "none" statt "mock": es gibt keinen simulierten Anbieter mehr.
       Ohne eingerichteten Anbieter antwortet Nina nicht — sie erfindet
       nichts. */
    provider: z.enum(["none", "openai", "anthropic", "self_hosted"]).default("none"),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),

    /*
     * Vier Stufen statt eines Modells. Die Aufteilung ist nicht
     * kosmetisch: ein Gespräch braucht Tempo, eine Profilsynthese
     * braucht Tiefe, eine Klassifikation braucht beides nicht. Alles
     * über dasselbe Modell laufen zu lassen heißt, für jede Kleinigkeit
     * das Teuerste zu zahlen und für jede Analyse das Schnellste zu
     * nehmen.
     */
    modelInteractive: z.string().default("gpt-5.6-terra"),
    modelDeep: z.string().default("gpt-5.6-sol"),
    modelFast: z.string().default("gpt-5.6-luna"),
    modelRealtime: z.string().default("gpt-realtime-2.1"),
    modelTranscribe: z.string().optional(),
    modelSpeech: z.string().optional(),
    modelEmbed: z.string().default("local-hash-embedding"),
    speechVoice: z.string().optional(),
    maxTokensPerRun: z.coerce.number().int().positive().default(4096),
    timeoutMs: z.coerce.number().int().positive().default(60_000),
    monthlyBudgetEur: z.coerce.number().nonnegative().default(0),
  }),

  /*
   * Stimme.
   *
   * "browser" ist die Spracherkennung des Geräts. Sie ist ehrlich
   * benannt: nichts verlässt das Gerät, aber es ist auch nicht Nina,
   * die zuhört — es ist ein Diktiergerät. Als vollständige Sprach-Nina
   * darf sie nirgends ausgegeben werden.
   *
   * "openai" ist die echte Sprachverbindung über die Realtime- bzw.
   * Audio-Modelle. Sie war bisher gar nicht als Wert erlaubt, obwohl
   * die Anbieterklasse sie längst kann — wer VOICE_PROVIDER=openai
   * setzte, bekam beim Start einen Schemafehler.
   *
   * "none" heißt: es gibt keinen Sprachmodus. Ehrlicher als der frühere
   * Wert "mock", der so klang, als würde etwas simuliert.
   */
  voice: z.object({
    provider: z.enum(["none", "browser", "openai", "anthropic"]).default("browser"),
    storeTranscripts: z.coerce.boolean().default(false),
    /*
     * Ninas Stimme.
     *
     * Getrennt vom `provider` oben: der beschreibt, wie ZUGEHÖRT wird
     * (Diktat im Browser, Realtime bei OpenAI). Hier steht, wie Nina
     * SPRICHT. Beides zusammenzulegen hieße, dass ein fehlendes
     * Mikrofon ihre Stimme abschaltet.
     *
     * Der Schlüssel ist ausschließlich serverseitig lesbar — kein
     * NEXT_PUBLIC_-Präfix, und er verlässt diese Konfiguration nie.
     */
    tts: z.object({
      apiKey: z.string().optional(),
      voiceId: z.string().optional(),
      modelId: z.string().default("eleven_turbo_v2_5"),
    }),
    /*
     * Wie zugehört wird.
     *
     * Getrennt von `tts`, weil es ein anderer Anbieter ist und getrennt
     * ausfallen darf: ohne Spracherkennung bleibt Ninas Stimme, ohne
     * Stimme bleibt die Spracherkennung, und ohne beides bleibt der
     * Text. Ein gemeinsamer Schalter würde aus einem halben Ausfall
     * einen ganzen machen.
     */
    stt: z.object({
      /* Das Transkriptionsmodell innerhalb der Realtime-Sitzung. */
      modelId: z.string().default("gpt-4o-transcribe"),
      /* Ab wann gilt Stille als Ende eines Redebeitrags. 600 ms ist
         kurz genug, dass niemand auf Nina wartet, und lang genug, dass
         eine Denkpause mitten im Satz nicht als Ende zählt. */
      silenceMs: z.coerce.number().default(600),
    }),
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

  jobs: z.object({
    sources: z.array(z.string()).default(["seed"]),
    /*
     * Bilderzeugung für die Jobvisual-Bibliothek (V7 §21.5).
     *
     * Standardmässig aus, und zwar aus einem handfesten Grund: bei 975
     * Stellen wäre eine Erzeugung je Seitenaufruf eine Rechnung pro
     * Besucher. Bilder entstehen ausschliesslich in einem
     * Admin-Durchlauf; die Anwendung selbst greift nie darauf zu.
     */
    imageGeneration: z.coerce.boolean().default(false),
  }),
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
    appUrl: env.APP_URL ?? "http://localhost:3000",
    appEnv: env.APP_ENV ?? env.NODE_ENV ?? "development",
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
      provider: env.AI_PROVIDER ?? "none",
      // Je Anbieter ein eigener Schlüsselname. Ein gemeinsamer wäre die
      // Sorte Abkürzung, bei der irgendwann der falsche Schlüssel an den
      // falschen Anbieter geht.
      apiKey:
        env.AI_PROVIDER === "anthropic"
          ? env.ANTHROPIC_API_KEY
          : env.AI_PROVIDER === "self_hosted"
            ? (env.SELF_HOSTED_API_KEY ?? "nicht-erforderlich")
            : env.OPENAI_API_KEY,
      baseUrl: env.AI_PROVIDER === "self_hosted" ? env.SELF_HOSTED_BASE_URL : undefined,
      // Die Namen aus .env.example haben Vorrang. Die alten bleiben als
      // Rückfall, damit eine vorhandene .env.local nicht plötzlich
      // stumm auf Standardwerte fällt — die Drift war schon da: das
      // Beispiel dokumentierte OPENAI_MODEL_DEFAULT, gelesen wurde
      // OPENAI_MODEL_INTERACTIVE. Wer dem Beispiel folgte, setzte eine
      // Variable, die niemand las.
      modelInteractive:
        env.OPENAI_MODEL_DEFAULT ?? env.OPENAI_MODEL_INTERACTIVE ?? "gpt-5.6-terra",
      modelDeep: env.OPENAI_MODEL_DEEP ?? "gpt-5.6-sol",
      modelFast: env.OPENAI_MODEL_FAST ?? "gpt-5.6-luna",
      modelRealtime: env.OPENAI_MODEL_REALTIME ?? env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1",
      modelTranscribe: env.OPENAI_TRANSCRIBE_MODEL,
      modelSpeech: env.OPENAI_SPEECH_MODEL,
      // Ohne echten Anbieter bleibt die lokale Hash-Einbettung: sie ist
      // deterministisch und kostet nichts, taugt aber nur zum Testen der
      // Pipeline, nicht zur Bedeutungssuche.
      modelEmbed: env.OPENAI_EMBEDDING_MODEL ?? "local-hash-embedding",
      speechVoice: env.OPENAI_SPEECH_VOICE,
      maxTokensPerRun: env.AI_MAX_TOKENS_PER_RUN ?? 4096,
      timeoutMs: env.AI_TIMEOUT_MS ?? 60_000,
      monthlyBudgetEur: env.AI_MONTHLY_BUDGET_EUR ?? 0,
    },
    voice: {
      provider: env.VOICE_PROVIDER ?? "browser",
      storeTranscripts: env.VOICE_STORE_TRANSCRIPTS === "true",
      tts: {
        apiKey: env.ELEVENLABS_API_KEY,
        voiceId: env.ELEVENLABS_VOICE_ID,
        modelId: env.ELEVENLABS_TTS_MODEL ?? env.ELEVENLABS_MODEL_ID ?? "eleven_turbo_v2_5",
      },
      stt: {
        modelId: env.OPENAI_TRANSCRIBE_MODEL ?? env.ELEVENLABS_STT_MODEL ?? "gpt-4o-transcribe",
        silenceMs: Number(env.VOICE_SILENCE_MS ?? 600),
      },
    },
    mail: { provider: env.MAIL_PROVIDER ?? "draft", smtpUrl: env.SMTP_URL, from: env.MAIL_FROM },
    storage: {
      driver: env.STORAGE_DRIVER ?? "local",
      dir: env.STORAGE_DIR ?? ".storage",
      encryptionKey: env.STORAGE_ENCRYPTION_KEY,
      s3: { endpoint: env.S3_ENDPOINT, bucket: env.S3_BUCKET, region: env.S3_REGION ?? "eu-central-1" },
    },
    jobs: {
      sources: list(env.JOB_SOURCES, ["seed"]),
      imageGeneration: env.IMAGE_GENERATION_ENABLED === "true",
    },
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
    ai: cfg.ai.provider !== "none" && !!cfg.ai.apiKey ? "connected" : "not-connected",
    aiProvider: cfg.ai.provider,
    aiModel: cfg.ai.provider === "none" ? null : cfg.ai.modelInteractive,
    mail:
      cfg.mail.provider === "draft"
        ? "draft-only"
        : cfg.mail.provider === "mailpit" && cfg.mail.smtpUrl
          ? "connected"
          : "not-connected",
    storage: cfg.storage.driver === "s3" && cfg.storage.s3?.bucket ? "connected" : "local",
    /* "browser" ist eine echte, aber begrenzte Fähigkeit: Diktat auf dem
       Gerät, keine sprechende Nina. Sie als "connected" auszuweisen
       hätte genau die Verwechslung erzeugt, die hier verboten ist. */
    voice:
      cfg.voice.provider === "none"
        ? "not-connected"
        : cfg.voice.provider === "browser"
          ? "dictation-only"
          : "connected",
    jobSources: cfg.jobs.sources,
    reviewSources: cfg.reviews.sources,
  } as const;
}
