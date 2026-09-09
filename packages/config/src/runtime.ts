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
       Ohne eingerichteten Anbieter antwortet Monday nicht — sie erfindet
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
    /*
     * ══════════════════════════════════════════════════════════════
     * Warum hier getestete Namen stehen und keine angekündigten
     * ══════════════════════════════════════════════════════════════
     *
     * Bis hierher waren die Grundwerte `gpt-5.6-terra`, `gpt-5.6-sol`
     * und `gpt-5.6-luna`. Auf unserem Konto gibt es sie nicht — jeder
     * Aufruf endete mit 404.
     *
     * Das ist die schlimmste Sorte Grundwert: Er greift genau dann,
     * wenn eine Umgebungsvariable fehlt, also beim frisch
     * aufgesetzten Server, und er führt dort zu einem Fehler, der wie
     * ein Anbieterproblem aussieht.
     *
     * Ein Grundwert soll das Sichere sein. Hier stehen deshalb die
     * Modelle, die am 6. September 2026 auf unserem Konto tatsächlich
     * geantwortet haben. Sie bleiben über ENV austauschbar — der
     * Grundwert ist der Boden, nicht die Vorgabe.
     */
    modelInteractive: z.string().default("gpt-5-mini"),
    modelDeep: z.string().default("gpt-5"),
    modelFast: z.string().default("gpt-4.1-mini"),
    modelRealtime: z.string().default("gpt-realtime-2.1"),
    modelTranscribe: z.string().optional(),
    modelSpeech: z.string().optional(),
    modelEmbed: z.string().default("local-hash-embedding"),
    /*
     * Das Modell, das einspringt, wenn das eigentliche ausfällt.
     *
     * ── Warum je Stufe ein anderes ──────────────────────────────
     *
     * Ein einziges Ersatzmodell für alles wäre entweder zu langsam
     * für die Extraktion oder zu schwach für die Analyse. Die Kette
     * geht deshalb quer: Fällt das tiefe Modell aus, übernimmt das
     * schnellere derselben Familie; fällt das schnelle aus,
     * übernimmt das mittlere.
     *
     * Der Ersatz ist immer ein anderes Modell als das Original —
     * sonst wäre es ein Wiederholungsversuch und keine Absicherung.
     */
    modelInteractiveFallback: z.string().default("gpt-4.1-mini"),
    modelDeepFallback: z.string().default("gpt-5-mini"),
    modelFastFallback: z.string().default("gpt-5-mini"),
    modelEmbedFallback: z.string().optional(),
    /*
     * Die höchste Stufe — nur für aussergewöhnlich komplexe Fälle.
     *
     * ══════════════════════════════════════════════════════════════
     * Warum sie optional ist und keinen Grundwert hat
     * ══════════════════════════════════════════════════════════════
     *
     * Ein Grundwert würde sie überall einschalten, wo niemand sie
     * bestellt hat. „Hallo Monday" darf nicht das teuerste Modell
     * wecken.
     *
     * Fehlt der Eintrag, gibt es die Stufe nicht, und alles, was sie
     * gebraucht hätte, fällt auf `deep` zurück. Das ist der richtige
     * Grundzustand: Ohne ausdrückliche Entscheidung kein Premiumlauf.
     */
    modelUltraDeep: z.string().optional(),
    modelUltraDeepFallback: z.string().optional(),
    speechVoice: z.string().optional(),
    maxTokensPerRun: z.coerce.number().int().positive().default(4096),
    timeoutMs: z.coerce.number().int().positive().default(60_000),
    monthlyBudgetEur: z.coerce.number().nonnegative().default(0),
  }),

  /*
   * Stimme.
   *
   * "browser" ist die Spracherkennung des Geräts. Sie ist ehrlich
   * benannt: nichts verlässt das Gerät, aber es ist auch nicht Monday,
   * die zuhört — es ist ein Diktiergerät. Als vollständige Sprach-Monday
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
     * Mondays Stimme.
     *
     * Getrennt vom `provider` oben: der beschreibt, wie ZUGEHÖRT wird
     * (Diktat im Browser, Realtime bei OpenAI). Hier steht, wie Monday
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
     * ausfallen darf: ohne Spracherkennung bleibt Mondays Stimme, ohne
     * Stimme bleibt die Spracherkennung, und ohne beides bleibt der
     * Text. Ein gemeinsamer Schalter würde aus einem halben Ausfall
     * einen ganzen machen.
     */
    stt: z.object({
      /* Das Transkriptionsmodell innerhalb der Realtime-Sitzung. */
      modelId: z.string().default("gpt-4o-transcribe"),
      /* Ab wann gilt Stille als Ende eines Redebeitrags. 600 ms ist
         kurz genug, dass niemand auf Monday wartet, und lang genug, dass
         eine Denkpause mitten im Satz nicht als Ende zählt. */
      silenceMs: z.coerce.number().default(600),
    }),
  }),

  mail: z.object({
    provider: z.enum(["draft", "mailpit", "gmail", "outlook", "resend"]).default("draft"),
    smtpUrl: z.string().optional(),
    from: z.string().optional(),
    /**
     * Der Resend-Schlüssel. Trägt bewusst kein `NEXT_PUBLIC_`.
     *
     * Er darf nie ins Browserbündel: Wer ihn hat, versendet Mails im
     * Namen der verifizierten Absenderdomain — also im Namen von
     * Velvova.
     */
    resendKey: z.string().optional(),
    /**
     * Das Geheimnis, mit dem Zustellereignisse signiert sind.
     *
     * Ohne es nimmt der Webhook nichts an. Ein Endpunkt, der
     * unsignierte Ereignisse verarbeitet, lässt sich von jedem
     * beschicken — und ein gefälschtes `bounced` sperrt eine Adresse,
     * ein gefälschtes `delivered` verdeckt einen echten Fehler.
     */
    webhookSecret: z.string().optional(),
  }),

  storage: z.object({
    driver: z.enum(["local", "s3", "supabase"]).default("local"),
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

/**
 * ══════════════════════════════════════════════════════════════════
 * Welcher Datenbanktreiber gilt
 * ══════════════════════════════════════════════════════════════════
 *
 * Hier stand `env.DATABASE_DRIVER ?? "pglite"`, und das war die
 * Ursache eines Produktionsfehlers:
 *
 *   Error: ENOENT: no such file or directory,
 *   mkdir '/var/task/.data/pglite'
 *
 * Auf Vercel war `DATABASE_DRIVER` nicht gesetzt. Der Standard griff,
 * PGlite versuchte ein Verzeichnis in einem schreibgeschützten
 * Dateisystem anzulegen — und `DATABASE_URL` wurde dabei nie
 * angesehen, obwohl eine echte Datenbank vorhanden gewesen sein mag.
 *
 * ── Warum der Standard falsch herum war ─────────────────────────
 *
 * Er machte die Entwicklungsdatenbank zur Vorgabe und die echte zur
 * Ausnahme. Wer eine Umgebung neu aufsetzt und eine Variable vergisst,
 * bekommt dann nicht „es fehlt etwas", sondern eine andere Datenbank —
 * still, mit leerem Bestand, und der Fehler zeigt sich erst dort, wo
 * Daten fehlen.
 *
 * ── Die neue Regel ──────────────────────────────────────────────
 *
 *   1. `DATABASE_DRIVER` gesetzt   → das gilt, ohne Diskussion
 *   2. `DATABASE_URL` vorhanden    → `pg`
 *   3. sonst                       → `pglite`
 *
 * Schritt 2 ist der Punkt: Wer eine Datenbankadresse hinterlegt, will
 * sie benutzen. Sie zu hinterlegen und dann eine andere Datenbank zu
 * bekommen, ist kein Standardverhalten, das man erwarten könnte.
 *
 * Schritt 1 bleibt, weil es den umgekehrten Fall gibt: eine gesetzte
 * `DATABASE_URL` und trotzdem PGlite, etwa in einem Test.
 */
function waehleTreiber(env: Env): string {
  /*
   * Ein gesetzter Wert wird durchgereicht, auch ein falscher.
   *
   * Der erste Anlauf prüfte hier auf „pg" oder „pglite" und fiel sonst
   * auf die Ableitung zurück. Damit wurde aus `DATABASE_DRIVER=mysql`
   * still PGlite — ein Tippfehler, der keine Fehlermeldung erzeugt,
   * sondern eine andere Datenbank. Ein vorhandener Test hat das
   * gefangen.
   *
   * Die Prüfung gehört ins Schema darunter, nicht hierher: Dort steht
   * die Aufzählung, dort entsteht die Fehlermeldung, und dort bleibt
   * sie richtig, wenn einmal ein dritter Treiber dazukommt.
   */
  if (env.DATABASE_DRIVER !== undefined && env.DATABASE_DRIVER.trim() !== "") {
    return env.DATABASE_DRIVER;
  }
  return env.DATABASE_URL && env.DATABASE_URL.trim() !== "" ? "pg" : "pglite";
}

/**
 * ══════════════════════════════════════════════════════════════════
 * Welche Dateiablage gilt
 * ══════════════════════════════════════════════════════════════════
 *
 * Dasselbe Muster wie beim Datenbanktreiber, und derselbe Fehler:
 * `env.STORAGE_DRIVER ?? "local"` machte die Entwicklungsablage zur
 * Vorgabe. `local` schreibt mit `mkdir` und `writeFile` in ein
 * Verzeichnis — auf einer serverlosen Plattform ist das Dateisystem
 * schreibgeschützt, und das Hochladen eines Profilbilds scheitert.
 *
 * Der zweite Ausweg war keiner: `s3` warf „Die S3-Ablage ist noch
 * nicht angeschlossen." Es gab also gar keine Ablage, die in
 * Produktion funktioniert.
 *
 * Die Regel:
 *
 *   1. STORAGE_DRIVER gesetzt        → das gilt
 *   2. Supabase-Zugang vorhanden     → supabase
 *   3. sonst                         → local
 *
 * Schritt 2 benutzt, was ohnehin da ist: Dieselbe Supabase, die schon
 * die Datenbank trägt, hat eine Dateiablage. Ein neuer Dienst wäre
 * dafür nicht nötig und ist nicht vorgesehen.
 */
function waehleAblage(env: Env): string {
  if (env.STORAGE_DRIVER !== undefined && env.STORAGE_DRIVER.trim() !== "") {
    return env.STORAGE_DRIVER;
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const schluessel = (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return url && schluessel ? "supabase" : "local";
}

export function loadRuntimeConfig(env: Env = currentEnv()): RuntimeConfig {
  return RuntimeSchema.parse({
    mode: env.PAYCHECK_DEMO_MODE === "live" ? "live" : "demo",
    nodeEnv: env.NODE_ENV ?? "development",
    appUrl: env.APP_URL ?? "http://localhost:3000",
    appEnv: env.APP_ENV ?? env.NODE_ENV ?? "development",
    db: {
      driver: waehleTreiber(env),
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
        env.OPENAI_MODEL_DEFAULT ?? env.OPENAI_MODEL_INTERACTIVE ?? "gpt-5-mini",
      modelDeep: env.OPENAI_MODEL_DEEP ?? "gpt-5",
      modelFast: env.OPENAI_MODEL_FAST ?? "gpt-4.1-mini",
      modelInteractiveFallback: env.OPENAI_MODEL_DEFAULT_FALLBACK ?? "gpt-4.1-mini",
      modelDeepFallback: env.OPENAI_MODEL_DEEP_FALLBACK ?? "gpt-5-mini",
      modelFastFallback: env.OPENAI_MODEL_FAST_FALLBACK ?? "gpt-5-mini",
      /*
       * Kein Grundwert für den Einbettungsersatz.
       *
       * Zwei Einbettungsmodelle haben verschiedene Dimensionen, und
       * ihre Vektoren sind nicht vergleichbar. Ein stillschweigender
       * Wechsel würde die gespeicherten Vektoren unbrauchbar machen,
       * ohne dass irgendwo ein Fehler steht — deshalb nur, wenn ihn
       * jemand ausdrücklich einträgt.
       */
      modelEmbedFallback: env.OPENAI_EMBEDDING_MODEL_FALLBACK,
      modelUltraDeep: env.OPENAI_MODEL_ULTRA_DEEP,
      modelUltraDeepFallback: env.OPENAI_MODEL_ULTRA_DEEP_FALLBACK,
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
    mail: {
      provider: env.MAIL_PROVIDER ?? "draft",
      smtpUrl: env.SMTP_URL,
      from: env.MAIL_FROM,
      resendKey: env.RESEND_API_KEY,
      webhookSecret: env.MAIL_WEBHOOK_SECRET,
    },
    storage: {
      driver: waehleAblage(env),
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
       Gerät, keine sprechende Monday. Sie als "connected" auszuweisen
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
