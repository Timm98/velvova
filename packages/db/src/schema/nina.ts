import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { localeEnum } from "./enums.ts";
import { users } from "./identity.ts";
import { projekte } from "./projekte.ts";
import { jobs, jobMatches } from "./jobs.ts";
import { applications } from "./applications.ts";
import { documents } from "./applications.ts";

/**
 * Mondays Gedächtnis und der Ort, an dem die Person stehengeblieben ist.
 *
 * Zwei Dinge, die bisher fehlten und deren Fehlen dieselbe Wirkung
 * hatte: der Verlauf war nach einem Neuladen weg, und wer sein
 * Interview abgeschlossen hatte, landete beim nächsten Login wieder am
 * Anfang. Beides sieht aus wie ein Designfehler und ist in Wahrheit
 * eine fehlende Tabelle.
 */

export const ninaConversationKindEnum = pgEnum("nina_conversation_kind", [
  /** Das strukturierte Karrieregespräch. */
  "career_interview",
  /** Die schwebende Monday auf einer beliebigen Seite. */
  "assistant",
  /** Eine Suchanfrage in natürlicher Sprache auf der Jobs-Seite. */
  "job_search",
  /**
   * Hilfe und FAQ.
   *
   * Bewusst eine eigene Art und kein Merkmal am Gespräch: nur so lässt
   * sich die Trennung aus §29 überhaupt durchsetzen. Eine Supportfrage
   * darf den Karrierekontext nicht sehen, und eine Karrierefrage nicht
   * die Produktdokumentation — das ist eine Zugriffsentscheidung, keine
   * Formulierungsfrage.
   */
  "support",
  /** Eine Kurzfrage zu genau einer Stellenanzeige. */
  "job_context",
]);

export const ninaMessageRoleEnum = pgEnum("nina_message_role", [
  "user",
  "assistant",
  "tool",
]);

export const careerInterviewStatusEnum = pgEnum("career_interview_status", [
  "not_started",
  "in_progress",
  "paused",
  "completed",
  "needs_review",
]);

/**
 * Mondays Gesprächsstufen.
 *
 * Sie liegen in der Datenbank und nicht im Modellkontext. Das ist der
 * Unterschied zwischen „der Server weiß, wo wir stehen“ und „das Modell
 * erinnert sich hoffentlich“.
 */
export const ninaStageEnum = pgEnum("nina_stage", [
  "orientation", "current_situation", "evidence_discovery", "task_preferences",
  "work_style", "values_and_tradeoffs", "constraints", "role_hypotheses",
  "validation", "job_ready", "job_search", "application", "follow_up", "career_mode",
]);

export const jobReadinessStateEnum = pgEnum("job_readiness_state", [
  "not_ready", "exploratory", "ready",
]);

export const careerProfileStatusEnum = pgEnum("career_profile_status", [
  "empty",
  "draft",
  "awaiting_confirmation",
  "confirmed",
  "outdated",
]);

/* ── Gespräche ─────────────────────────────────────────────────── */

export const ninaConversations = pgTable(
  "nina_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: ninaConversationKindEnum("kind").notNull().default("assistant"),
    locale: localeEnum("locale").notNull().default("de"),
    /** Aus der ersten Nutzernachricht abgeleitet, damit die Liste lesbar ist. */
    title: text("title"),

    /*
     * Woher das Gespräch kam.
     *
     * Nicht zur Anzeige, sondern damit Monday beim Wiederaufnehmen weiß,
     * worüber gesprochen wurde. Die Route ist ohne Anfrageteil
     * gespeichert; Suchparameter können personenbezogene Angaben
     * enthalten.
     */
    originRoute: text("origin_route"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),

    /*
     * Die verdichtete Fassung des bisherigen Gesprächs.
     *
     * An das Modell geht diese Zusammenfassung plus die letzten Züge —
     * nie der ganze Verlauf. Ein Gespräch, das mit jeder Runde länger
     * wird, wird mit jeder Runde teurer und ungenauer.
     */
    summary: text("summary"),
    summarisedThroughIndex: integer("summarised_through_index").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),

    /**
     * Zu welchem Vorhaben das gehört. `null` heisst: zu keinem.
     *
     * `set null` beim Löschen und NICHT cascade: Wer ein Projekt
     * löscht, will das Vorhaben loswerden — nicht seine Bewerbungen.
     */
    projektId: uuid("projekt_id").references(() => projekte.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("nina_conversations_user_idx").on(t.userId, t.updatedAt),
    index("nina_conversations_job_idx").on(t.jobId),
  ],
);

export const ninaMessages = pgTable(
  "nina_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => ninaConversations.id, { onDelete: "cascade" }),
    /* Redundant zur Konversation — aber ohne diese Spalte müsste jede
       Zeilensicherheitsregel über einen Join gehen, und eine Regel, die
       joint, ist eine Regel, die irgendwann jemand vereinfacht. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    role: ninaMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),

    /** Welche Werkzeuge in diesem Zug liefen. Namen und Ergebnis, kein Inhalt. */
    toolCalls: jsonb("tool_calls")
      .$type<{ name: string; ok: boolean; summary?: string }[]>()
      .notNull()
      .default([]),

    /** Seitenkontext zum Zeitpunkt der Nachricht. Beantwortet später „welcher Job war gemeint?“. */
    contextRoute: text("context_route"),
    contextJobId: uuid("context_job_id").references(() => jobs.id, { onDelete: "set null" }),

    /** In welcher Stufe dieser Zug entstand. Sonst ist er später nicht einzuordnen. */
    stage: ninaStageEnum("stage"),
    /** Was Monday in diesem Zug für richtig hielt: ask, confirm, offer_jobs … */
    recommendedAction: text("recommended_action"),

    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    fromVoice: boolean("from_voice").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nina_messages_conversation_idx").on(t.conversationId, t.index)],
);

/* ── Wo die Person stehengeblieben ist ─────────────────────────── */

/**
 * Ein Datensatz pro Person, nicht pro Sitzung.
 *
 * Genau deshalb überlebt der Zustand einen Gerätewechsel: er hängt an
 * der Person, nicht am Browser. Ein `localStorage`-Eintrag hätte
 * dasselbe für ein Gerät geleistet und für alle anderen nichts.
 */
export const workflowStates = pgTable("workflow_states", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  onboardingComplete: boolean("onboarding_complete").notNull().default(false),

  careerInterviewStatus: careerInterviewStatusEnum("career_interview_status")
    .notNull()
    .default("not_started"),
  careerInterviewCompletedAt: timestamp("career_interview_completed_at", {
    withTimezone: true,
  }),
  careerProfileStatus: careerProfileStatusEnum("career_profile_status")
    .notNull()
    .default("empty"),

  activeCareerProjectId: uuid("active_career_project_id"),
  activeConversationId: uuid("active_conversation_id").references(() => ninaConversations.id, {
    onDelete: "set null",
  }),

  /** Der Schritt im Produktablauf, nicht im Gespräch. */
  currentWorkflowStep: text("current_workflow_step").notNull().default("account_setup"),

  /* ---- Mondays Gesprächsstufe und Jobreife ----
     Beides ist eine Serverentscheidung. Das Modell darf die Stufe
     vorschlagen; ob sie gilt, prüft `resolveStage()` gegen die
     tatsächlich vorhandenen Angaben. */
  ninaStage: ninaStageEnum("nina_stage").notNull().default("orientation"),
  jobReadinessState: jobReadinessStateEnum("job_readiness_state").notNull().default("not_ready"),
  jobReadinessScore: integer("job_readiness_score").notNull().default(0),
  /* Zustimmung als eigene Spalte, nicht als abgeleiteter Wert: „hat wohl
     zugestimmt“ ist keine Grundlage dafür, jemandem Stellen vorzusetzen. */
  agreedToSeeJobs: boolean("agreed_to_see_jobs").notNull().default(false),
  profileCompleteness: integer("profile_completeness").notNull().default(0),

  /*
   * Die letzte Stelle, an der jemand gearbeitet hat.
   *
   * Ohne Anfrageteil gespeichert. Eine Suchanfrage in einer URL ist
   * eine Aussage über den Menschen, und sie gehört nicht in eine
   * Spalte, die beim nächsten Login wieder aufgerufen wird.
   */
  lastActiveRoute: text("last_active_route"),
  lastActiveJobId: uuid("last_active_job_id").references(() => jobs.id, { onDelete: "set null" }),
  lastActiveApplicationId: uuid("last_active_application_id").references(() => applications.id, {
    onDelete: "set null",
  }),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Rollenhypothesen.
 *
 * Eine ungewöhnliche Rolle darf nur mit Begründung erscheinen: worauf
 * sie beruht, was anders wäre, was fehlt, wie man es klein testet.
 * Deshalb sind das eigene Spalten und kein Freitext — ein Vorschlag
 * ohne diese vier Angaben lässt sich hier gar nicht vollständig
 * ablegen, und das ist der Punkt.
 */
export const ninaRoleHypotheses = pgTable(
  "nina_role_hypotheses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => ninaConversations.id, {
      onDelete: "set null",
    }),
    role: text("role").notNull(),
    /** adjacent | neighbouring | unusual */
    groupKind: text("group_kind").notNull(),
    basedOn: text("based_on").notNull(),
    difference: text("difference"),
    gap: text("gap"),
    smallTest: text("small_test"),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    userConfirmed: boolean("user_confirmed").notNull().default(false),
    userRejected: boolean("user_rejected").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nina_role_hypotheses_user_idx").on(t.userId)],
);

/* ══════════════════════════════════════════════════════════════
   Das Fundament für Chancenradar, Morning Review und Matching
   ══════════════════════════════════════════════════════════════

   Vier neue Tabellen. Jede füllt eine Lücke, die die Bestandsaufnahme
   gezeigt hat — und keine dupliziert etwas Vorhandenes:

     job_tasks      Aufgaben strukturiert. `jobs.coreTasks` ist eine
                    Textliste; vergleichen lässt sich damit nichts.
     nina_events    Es gab `notifications` (fertige Nachrichten) und
                    `watchlist_job_events` (nur Firmenbeobachtung).
                    Was fehlte, ist die Ebene davor: erkannte
                    Veränderungen, aus denen später eine Nachricht
                    werden KANN.
     profile_facts  Mondays Gedächtnis, kontrolliert. Bisher verstreut
                    zwischen `evidence_items` (Belege) und
                    `preferences` (Vorlieben) — beides sind Aussagen
                    über den Menschen, aber keines hält Sätze wie
                    „möchte langfristig Führung".
     match_feedback Warum eine Stelle abgelehnt wurde.
                    `empfehlungs_ergebnisse` misst, was NACH einer
                    Bewerbung passiert — das ist etwas anderes.
   ══════════════════════════════════════════════════════════════ */

/**
 * Die Aufgaben einer Stelle, einzeln und vergleichbar.
 *
 * ── Warum nicht `jobs.coreTasks` reicht ───────────────────────
 *
 * Dort steht eine Liste von Sätzen. Für die Anzeige genügt das; für
 * das Matching nicht. „Monatsabschlüsse erstellen" und „Erstellung
 * der Monats- und Jahresabschlüsse" sind dieselbe Tätigkeit und zwei
 * verschiedene Zeichenketten.
 *
 * `normalisiert` trägt die vereinheitlichte Form, `wichtigkeit` sagt,
 * ob es der Kern der Stelle ist oder eine Randaufgabe. Erst damit
 * lässt sich vergleichen, was jemand TUT — statt was seine Stelle
 * HEISST.
 */
export const jobTasks = pgTable(
  "job_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    aufgabe: text("aufgabe").notNull(),
    /** Vereinheitlicht — für den Vergleich, nicht für die Anzeige. */
    normalisiert: text("normalisiert"),
    /** kern · regelmaessig · gelegentlich */
    wichtigkeit: text("wichtigkeit").notNull().default("regelmaessig"),
    /** Anteil der Arbeitszeit, wenn die Anzeige ihn nennt. */
    anteil: smallint("anteil"),
    /**
     * Woher die Aufgabe stammt.
     *
     * `anzeige` heisst: steht wörtlich da. `abgeleitet` heisst: ein
     * Modell hat sie aus dem Fliesstext gelesen. Der Unterschied
     * gehört in die Daten, nicht in einen Kommentar — sonst zählt
     * eine Vermutung später wie eine Angabe.
     */
    quelle: text("quelle").notNull().default("anzeige"),
    konfidenz: smallint("konfidenz").notNull().default(100),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_tasks_job_idx").on(t.jobId)],
);

/**
 * Erkannte Veränderungen, aus denen später eine Meldung werden kann.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das keine Benachrichtigungstabelle ist
 * ══════════════════════════════════════════════════════════════
 *
 * `notifications` enthält fertige Nachrichten: Titel, Text, Ziel.
 * Sie beantwortet „was steht in der Glocke". Diese Tabelle hier
 * beantwortet etwas anderes: „was hat sich verändert".
 *
 * Der Unterschied trägt den Chancenradar. Ein Ereignis wie
 * `match_verbessert` entsteht, sobald ein Score steigt — ob daraus
 * eine Meldung wird, entscheidet später das Briefing anhand von
 * Priorität, Ruhezeiten und den Einstellungen des Menschen. Wer beides
 * in eine Tabelle legt, muss beim Erzeugen schon wissen, ob und wann
 * gemeldet wird, und das weiss er dort nicht.
 *
 * ── Warum `verarbeitet` und `gezeigt` getrennt sind ───────────
 *
 * `verarbeitet` heisst: Das Briefing hat es berücksichtigt.
 * `gezeigt` heisst: Ein Mensch hat es gesehen. Zwei Zustände, weil
 * ein Ereignis verarbeitet und trotzdem nie gezeigt werden kann —
 * etwa wenn zehn stärkere daneben standen.
 */
export const ninaEvents = pgTable(
  "nina_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /**
     * neuer_match · match_verbessert · stelle_geaendert · frist_naht ·
     * angabe_fehlt · muster_erkannt · nachfassen_faellig
     */
    art: text("art").notNull(),
    /** job · match · application · profil — worauf es sich bezieht. */
    bezugsart: text("bezugsart"),
    bezugId: uuid("bezug_id"),
    /** 1 kritisch, 2 wichtig, 3 interessant. */
    prioritaet: smallint("prioritaet").notNull().default(3),
    titel: text("titel").notNull(),
    /**
     * Die Zahlen dahinter — etwa vorheriger und neuer Score.
     *
     * Bewusst als JSON: Was ein Ereignis mitbringt, hängt an seiner
     * Art, und eine Spalte je Art wäre eine Tabelle mit dreissig
     * leeren Feldern.
     */
    nutzlast: jsonb("nutzlast").$type<Record<string, unknown>>().notNull().default({}),
    verarbeitetAm: timestamp("verarbeitet_am", { withTimezone: true }),
    gezeigtAm: timestamp("gezeigt_am", { withTimezone: true }),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("nina_events_offen_idx").on(t.userId, t.verarbeitetAm, t.prioritaet),
    index("nina_events_bezug_idx").on(t.bezugsart, t.bezugId),
  ],
);

/**
 * Mondays Gedächtnis — kontrolliert, nicht frei.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum kein Chatgedächtnis
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Modell, das sich „alles aus dem Gespräch" merkt, merkt sich
 * auch Falsches, und niemand kann es korrigieren. Hier ist jeder
 * Eintrag ein einzelner Satz mit Schlüssel, Wert, Herkunft und
 * Konfidenz — also etwas, das sich anzeigen, ändern und löschen
 * lässt.
 *
 * ── Warum `bestaetigt` der wichtigste Wert ist ────────────────
 *
 * Monday darf schliessen. Sie darf ihre Schlüsse nur nicht als Wissen
 * ausgeben. `bestaetigt = false` heisst: Ein Modell hat das
 * abgeleitet, und es zählt weniger — in der Anzeige, im Matching und
 * bei der Frage, ob ein bestehender Wert überschrieben werden darf.
 *
 * Genau dieser Fall steht in der Vorgabe: Wer „minimum_salary = 70k"
 * bestätigt hat, dessen Regel überschreibt ein späteres „60k wäre
 * auch okay" NICHT. Es entsteht ein zweiter, unbestätigter Fakt, und
 * Monday fragt nach.
 *
 * ── Warum `gueltig_bis` ───────────────────────────────────────
 *
 * „Sucht aktuell nicht aktiv" ist im März wahr und im Oktober
 * womöglich nicht mehr. Ein Fakt ohne Verfallsdatum wird mit der Zeit
 * zur Behauptung über einen Menschen, den es so nicht mehr gibt.
 */
export const profileFacts = pgTable(
  "profile_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** ziel · abneigung · bedingung · situation · praeferenz */
    art: text("art").notNull(),
    /** Der stabile Schlüssel, etwa „fuehrungsverantwortung". */
    schluessel: text("schluessel").notNull(),
    wert: jsonb("wert").notNull(),
    /** gespraech · dokument · feedback · nina_ableitung · nutzer */
    quelle: text("quelle").notNull(),
    /** Der Satz, auf den sich der Fakt stützt. */
    beleg: text("beleg"),
    konfidenz: smallint("konfidenz").notNull().default(50),
    bestaetigt: boolean("bestaetigt").notNull().default(false),
    bestaetigtAm: timestamp("bestaetigt_am", { withTimezone: true }),
    gueltigBis: timestamp("gueltig_bis", { withTimezone: true }),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* Ein Schlüssel je Person und Bestätigungsstand: Der bestätigte
       Wert und ein abweichender Vorschlag dürfen nebeneinander
       stehen — genau das ist der Fall, in dem Monday nachfragt. */
    uniqueIndex("profile_facts_schluessel_idx").on(t.userId, t.schluessel, t.bestaetigt),
  ],
);

/**
 * Warum eine Stelle abgelehnt wurde.
 *
 * ── Warum getrennt von `empfehlungs_ergebnisse` ───────────────
 *
 * Jene Tabelle misst, was NACH einer Bewerbung geschah: beworben,
 * Antwort, Gespräch, Angebot. Sie beantwortet „hat die Empfehlung
 * getragen".
 *
 * Diese hier beantwortet die Frage davor: „warum nicht". Das ist die
 * Auskunft, aus der Monday lernt — und sie entsteht bei Stellen, die
 * nie zu einer Bewerbung führen, also gerade dort, wo jene Tabelle
 * leer bleibt.
 *
 * ── Was daraus NICHT folgen darf ──────────────────────────────
 *
 * Aus sieben Ablehnungen wegen Kundenkontakt wird kein Filter. Es
 * wird ein Ereignis `muster_erkannt`, und daraus eine Frage: „Soll
 * ich solche Stellen künftig niedriger bewerten?" Erst die Antwort
 * wird zur Präferenz. Ein System, das aus beobachtetem Verhalten
 * stillschweigend Regeln macht, erklärt Menschen für festgelegt.
 */
export const matchFeedback = pgTable(
  "match_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => jobMatches.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    /** interessiert · abgelehnt · spaeter · beworben */
    art: text("art").notNull(),
    /**
     * gehalt · standort · remote · aufgaben · unternehmen ·
     * karrierestufe · arbeitszeit · branche · anforderungen ·
     * kein_interesse · sonstiges
     */
    grund: text("grund"),
    freitext: text("freitext"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_feedback_user_idx").on(t.userId, t.grund, t.erstelltAm)],
);


/**
 * Mondays tiefe Analyse einer Stelle.
 *
 * Sie liest Anzeige, Profil, Belege und Bedingungen zusammen und
 * braucht dafür mehrere Modellrunden — Minuten, nicht Sekunden.
 * Deshalb steht sie in der Datenbank und nicht im Speicher der Seite:
 * Wer weggeht und wiederkommt, findet sie vor, statt sie erneut zu
 * starten.
 *
 * `generated_artifacts` wäre der naheliegende Ort und geht nicht — die
 * Tabelle verlangt eine `application_id`, und eine Analyse entsteht
 * VOR der Entscheidung, sich zu bewerben.
 */
export const jobTiefenanalysen = pgTable(
  "job_tiefenanalysen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    /** laeuft · fertig · fehlgeschlagen */
    zustand: text("zustand").notNull().default("laeuft"),
    /** Der Text der Analyse. Leer, solange sie läuft. */
    inhalt: text("inhalt"),
    /** Warum sie fehlschlug — für die Person lesbar, kein Stacktrace. */
    fehler: text("fehler"),
    /** Die Fassung der Bewertungslogik. Eine Analyse von vor zwei
        Wochen ist keine Analyse von heute. */
    logikfassung: text("logikfassung"),
    begonnenAm: timestamp("begonnen_am", { withTimezone: true }).notNull().defaultNow(),
    beendetAm: timestamp("beendet_am", { withTimezone: true }),
  },
  (t) => [uniqueIndex("job_tiefenanalysen_user_job_idx").on(t.userId, t.jobId)],
);


/**
 * Die nutzerunabhängige Analyse einer Stelle.
 *
 * Getrennt von `job_matches`: Die Analyse gehört zur Stelle und ist
 * für alle gleich, der Match gehört zur Person. Eine Profiländerung
 * entwertet den Match, nicht die Analyse — in einer Tabelle löste
 * jede Profiländerung eine Neuanalyse aus.
 */
export const jobAnalysen = pgTable(
  "job_analysen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    /** Fingerabdruck der Eingabe — ohne `last_seen_at`. */
    eingabeSchluessel: text("eingabe_schluessel").notNull(),
    /** Schema, Prompt und Bewertungsregeln als eine Zahl. */
    fassung: integer("fassung").notNull(),
    /**
     * laeuft · fertig · fehlgeschlagen · unzureichende_daten
     *
     * `unzureichende_daten` ist kein Fehler: Der Lauf war technisch
     * erfolgreich, die Anzeige gab zu wenig her.
     */
    status: text("status").notNull().default("laeuft"),
    extraktion: jsonb("extraktion"),
    bewertung: jsonb("bewertung"),
    /** Warum eine Zahl fehlt — maschinenlesbar, je Dimension. */
    gruende: jsonb("gruende"),
    referenzSnapshot: text("referenz_snapshot"),
    modellkonfiguration: text("modellkonfiguration"),
    fehler: text("fehler"),
    begonnenAm: timestamp("begonnen_am", { withTimezone: true }).notNull().defaultNow(),
    beendetAm: timestamp("beendet_am", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("job_analysen_job_eingabe_idx").on(t.jobId, t.eingabeSchluessel, t.fassung),
    index("job_analysen_job_idx").on(t.jobId, t.begonnenAm),
  ],
);

/**
 * Die Filter der Stellenliste — was gerade zu sehen ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht der Suchauftrag ist
 * ══════════════════════════════════════════════════════════════
 *
 * Drei Dinge, die sich ähneln und nie ein Feld werden dürfen:
 *
 *   Profil        wer jemand ist und was er kann
 *   Suchauftrag   wonach Monday im Hintergrund weitersucht
 *   Listenfilter  was gerade auf dem Bildschirm steht
 *
 * „Zeig mir mal Bayern" ist keine Beauftragung. Wer das in den
 * Suchauftrag schriebe, bekäme morgen früh eine Mail über Stellen in
 * Bayern — für einen Satz, der „ich schau mich gerade um" hiess.
 *
 * ── Warum überhaupt gespeichert ──────────────────────────────
 *
 * Weil die Filter bisher nur in der Adresse standen: Ein geteilter
 * Link trug sie mit, ein frischer Besuch nicht. Wer gestern Umkreis,
 * Gehalt und Vertragsart eingestellt hatte, fing heute bei null an.
 */
export const listenfilter = pgTable("listenfilter", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * Die Filter als flaches Objekt, wie sie in der Adresse stehen.
   *
   * Als jsonb und nicht als Spalten: Ein neuer Filter ist dann eine
   * Zeile im Code und keine Migration. Die Datenbank prüft die
   * Schlüssel nicht — und ein unbekannter Schlüssel in der Adresse
   * tut ohnehin nichts.
   */
  filter: jsonb("filter").$type<Record<string, string>>().notNull().default({}),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
});
