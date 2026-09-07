import { boolean, doublePrecision, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.ts";
import { jobs } from "./jobs.ts";

/**
 * Der Arbeitgeberbereich.
 *
 * ── Die Trennlinie, die dieses Schema durchzieht ──────────────
 *
 * Ein Unternehmen sieht NIE das Profil einer Person. Was es sieht, ist
 * `posting_candidates` — eine Kopie der Angaben, die jemand für GENAU
 * DIESE Stelle freigegeben hat, entstanden im Moment der Bewerbung.
 *
 * Der naheliegende Entwurf wäre gewesen, `applications` um eine
 * Organisationskennung zu erweitern. Daran hängen aber die Notizen der
 * Person, ihre Termine, ihre Coaching-Sitzungen — und über `user_id` ihr
 * ganzes Profil. Ein vergessener Filter, und das Unternehmen liest mit.
 *
 * Die Trennung ist deshalb eine Eigenschaft des Schemas und keine
 * Sorgfaltspflicht beim Abfragen. Wer hier alles liest, was er lesen
 * darf, sieht trotzdem nichts Privates.
 */

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("recruiter"),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Nur der Hash. Das Geheimnis steht im Link und sonst nirgends. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_invitations_token_idx").on(t.tokenHash),
    index("organization_invitations_org_idx").on(t.organizationId, t.createdAt),
  ],
);

export const jobPostings = pgTable(
  "job_postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Die Stelle im gemeinsamen Index — erst beim Veröffentlichen. */
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    location: text("location").notNull().default(""),
    country: text("country").notNull().default("DE"),
    workModel: text("work_model"),
    contractType: text("contract_type"),
    weeklyHours: integer("weekly_hours"),

    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency").notNull().default("EUR"),
    salaryPeriod: text("salary_period").notNull().default("year"),

    description: text("description").notNull().default(""),
    benefits: jsonb("benefits").$type<string[]>().notNull().default([]),

    /*
     * Die Angaben, nach denen im Gespräch als Erstes gefragt wird.
     *
     * Sie gehören an die Anzeige und nicht ins Unternehmensprofil:
     * Wochenstunden, Reiseanteil und Berichtslinie unterscheiden sich
     * zwischen zwei Stellen desselben Hauses — im Profil stünde ein
     * Durchschnitt, der für keine der beiden stimmt.
     */
    team: text("team"),
    bereich: text("bereich"),
    starttermin: text("starttermin"),
    aufgaben: text("aufgaben"),

    /*
     * Muss und Kann getrennt — das ist der Kern.
     *
     * In einer Fliesstextanzeige stehen beide in derselben Aufzählung,
     * und niemand hält sie auseinander. Getrennt gespeichert führt Monday
     * eine fehlende Kann-Fähigkeit als „entwickelbar" statt als
     * Ausschluss — und genau daran scheitern sonst Menschen, die die
     * Arbeit könnten.
     */
    mussFaehigkeiten: jsonb("muss_faehigkeiten").$type<string[]>().notNull().default([]),
    kannFaehigkeiten: jsonb("kann_faehigkeiten").$type<string[]>().notNull().default([]),

    gewuenschteErfahrung: text("gewuenschte_erfahrung"),
    arbeitssprache: text("arbeitssprache"),
    reiseanteil: text("reiseanteil"),
    verantwortungsumfang: text("verantwortungsumfang"),
    berichtslinie: text("berichtslinie"),
    interviewablauf: text("interviewablauf"),

    /*
     * Die Antwortzeit ist eine Zusage, keine Beschreibung. Sie steht in
     * der Anzeige, im Dashboard als Frist, und Monday erinnert daran,
     * bevor sie überschritten wird.
     */
    antwortzeit: text("antwortzeit"),
    kontaktperson: text("kontaktperson"),

    /** draft · in_pruefung · published · paused · closed · archived */
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("job_postings_org_idx").on(t.organizationId, t.createdAt),
    index("job_postings_job_idx").on(t.jobId),
  ],
);

export const postingCandidates = pgTable(
  "posting_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postingId: uuid("posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /**
     * Der Schlüssel, nicht der Zugang.
     *
     * Über diese Kennung wird NICHTS nachgeladen. Sie steht hier, damit
     * die Person ihre Bewerbung wiederfindet und zurückziehen kann.
     */
    candidateUserId: uuid("candidate_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    displayName: text("display_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    headline: text("headline"),
    coverNote: text("cover_note"),
    sharedProfile: jsonb("shared_profile").$type<Record<string, unknown>>().notNull().default({}),
    documentIds: jsonb("document_ids").$type<string[]>().notNull().default([]),

    /** new · screening · interview · offer · hired · rejected */
    stage: text("stage").notNull().default("new"),
    /** Gehört dem Unternehmen und ist für die Person nicht sichtbar. */
    employerNote: text("employer_note").notNull().default(""),
    rejectedReason: text("rejected_reason"),

    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("posting_candidates_unique").on(t.postingId, t.candidateUserId),
    index("posting_candidates_org_idx").on(t.organizationId, t.stage),
  ],
);

export const organizationEvents = pgTable(
  "organization_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    subjectId: uuid("subject_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("organization_events_org_idx").on(t.organizationId, t.occurredAt)],
);

/**
 * Die Role Truth Card — was der Arbeitgeber über die Rolle sagt.
 *
 * Dieselben zehn Achsen wie der Career Twin. Dadurch lässt sich die
 * Aussage des Arbeitgebers direkt gegen die Person halten, statt beide
 * über Stichwörter im Fliesstext zu vergleichen.
 *
 * Siehe Migration 0046.
 */
export const rollenAussagen = pgTable("rollen_aussagen", {
  id: uuid("id").primaryKey().defaultRandom(),
  postingId: uuid("posting_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
  dimension: text("dimension").notNull(),
  wert: doublePrecision("wert").notNull(),
  /** Eine Zahl ohne Begründung ist keine Auskunft. */
  begruendung: text("begruendung").notNull().default(""),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("rollen_aussagen_unique").on(t.postingId, t.dimension)]);

/**
 * Was Mitarbeiter derselben Rolle dazu sagen.
 *
 * Der eigene Wert, nicht ein Ja/Nein: Wer widerspricht, sagt damit
 * auch, wie es stattdessen ist. Ein blosses „stimmt nicht" liesse die
 * Frage offen, die es zu beantworten gilt.
 */
export const rollenBestaetigungen = pgTable("rollen_bestaetigungen", {
  id: uuid("id").primaryKey().defaultRandom(),
  postingId: uuid("posting_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
  /** Nie sichtbar — nur, damit dieselbe Person nicht zweimal zählt. */
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dimension: text("dimension").notNull(),
  wert: doublePrecision("wert").notNull(),
  kommentar: text("kommentar").notNull().default(""),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("rollen_bestaetigungen_unique").on(t.postingId, t.userId, t.dimension)]);

/**
 * Welche Aufgabe wie viel Zeit frisst.
 *
 * Die Anzeige listet Aufgaben als gleichrangige Punkte. In Wahrheit
 * macht eine davon sechzig Prozent des Tages aus — und genau die
 * entscheidet, ob jemand bleibt.
 */
export const rollenAufgaben = pgTable("rollen_aufgaben", {
  id: uuid("id").primaryKey().defaultRandom(),
  postingId: uuid("posting_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
  aufgabe: text("aufgabe").notNull(),
  /** 0 bis 100. Muss sich nicht zu 100 summieren. */
  zeitanteil: integer("zeitanteil").notNull(),
  reihenfolge: integer("reihenfolge").notNull().default(0),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("rollen_aufgaben_posting_idx").on(t.postingId, t.reihenfolge)]);

/** Warum Menschen diese Position wieder verlassen — vom Arbeitgeber genannt. */
export const rollenAbgaenge = pgTable("rollen_abgaenge", {
  id: uuid("id").primaryKey().defaultRandom(),
  postingId: uuid("posting_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
  grund: text("grund").notNull(),
  reihenfolge: integer("reihenfolge").notNull().default(0),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Reality Sessions — die konkrete Stelle erleben.
 *
 * Die allgemeinen Arbeitsproben zeigen, ob jemand zu einem Berufsfeld
 * passt. Sie zeigen nicht, wie DIESER Vorgesetzte kommuniziert oder wie
 * sich das Tempo in DIESEM Haus anfühlt.
 *
 * Die kleine Fassung — fünfzehn Minuten mit jemandem, der die Rolle
 * kennt — braucht keinen Arbeitgeber, der mitmacht. Siehe Migration
 * 0051.
 */
export const realitaetsproben = pgTable("realitaetsproben", {
  id: uuid("id").primaryKey().defaultRandom(),
  postingId: uuid("posting_id").references(() => jobPostings.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  /** gespraech · aufgabe · teamtermin */
  art: text("art").notNull().default("gespraech"),
  anbieterUserId: uuid("anbieter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  beschreibung: text("beschreibung").notNull().default(""),
  dauerMinuten: integer("dauer_minuten").notNull().default(15),
  /**
   * Eine Aufgabe ohne Vergütung darf keine produktive Arbeit sein.
   *
   * Steht hier, damit es prüfbar bleibt — und nicht nur als Absicht in
   * einer Beschreibung.
   */
  verguetet: boolean("verguetet").notNull().default(false),
  aktiv: boolean("aktiv").notNull().default(true),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("realitaetsproben_stelle_idx").on(t.jobId)]);

/**
 * Was der Bewerber danach sagt — anonym.
 *
 * Beide Seiten bewerten: nicht nur das Unternehmen den Bewerber. Und
 * `energie` steht getrennt von `klarheit`, aus demselben Grund wie bei
 * den Arbeitsproben — „ich konnte es" und „es hat mir gutgetan" sind
 * verschiedene Aussagen.
 */
export const realitaetsrueckmeldungen = pgTable("realitaetsrueckmeldungen", {
  id: uuid("id").primaryKey().defaultRandom(),
  probeId: uuid("probe_id").notNull().references(() => realitaetsproben.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  klarheit: integer("klarheit"),
  rueckmeldung: integer("rueckmeldung"),
  respekt: integer("respekt"),
  tempo: integer("tempo"),
  /** Stimmte, was in der Anzeige stand? */
  stimmtMitAnzeige: integer("stimmt_mit_anzeige"),
  energie: integer("energie"),
  notiz: text("notiz").notNull().default(""),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("realitaetsrueckmeldungen_unique").on(t.probeId, t.userId)]);


/**
 * Die öffentliche Unternehmensseite.
 *
 * ── Warum getrennt von `organizations` ────────────────────────
 *
 * `organizations` trägt, wer wer ist — Name, Slug, Prüfstand —, und
 * daran hängen Rechte. Das Profil ist erzählender Text, den ein Team
 * laufend überarbeitet. Beides in einer Tabelle hiesse, bei jedem
 * Tippfehler in der Beschreibung eine Zeile anzufassen, an der die
 * Zugriffsrechte hängen.
 *
 * ── Warum fast alles optional ist ─────────────────────────────
 *
 * Ein Profil entsteht über Wochen. Pflichtfelder erzwängen entweder
 * erfundene Angaben oder einen Entwurf, den man nicht speichern kann.
 * Was fehlt, steht auf der öffentlichen Seite als „vom Unternehmen
 * noch nicht angegeben" — eine ehrlichere Auskunft als ein
 * ausgeblendeter Abschnitt, denn eine fehlende Angabe ist selbst eine.
 */
export const unternehmensprofile = pgTable("unternehmensprofile", {
  organizationId: uuid("organization_id").primaryKey(),

  /* Grundlagen */
  logoPfad: text("logo_pfad"),
  titelbildPfad: text("titelbild_pfad"),
  kurzbeschreibung: text("kurzbeschreibung"),
  beschreibung: text("beschreibung"),
  branche: text("branche"),
  gruendungsjahr: smallint("gruendungsjahr"),
  groesse: text("groesse"),
  hauptsitz: text("hauptsitz"),
  weitereStandorte: text("weitere_standorte"),
  arbeitssprachen: text("arbeitssprachen"),

  /* Arbeitsrealität */
  arbeitsmodell: text("arbeitsmodell"),
  wochenstunden: text("wochenstunden"),
  gleitzeit: text("gleitzeit"),
  kernarbeitszeit: text("kernarbeitszeit"),
  schichtarbeit: text("schichtarbeit"),
  reisetaetigkeit: text("reisetaetigkeit"),
  ueberstunden: text("ueberstunden"),
  meetingkultur: text("meetingkultur"),
  entscheidungswege: text("entscheidungswege"),
  fuehrungsstil: text("fuehrungsstil"),
  teamgroessen: text("teamgroessen"),
  arbeitsmittel: text("arbeitsmittel"),

  /*
   * Kultur und Entwicklung.
   *
   * Die Werte liegen als JSON: Zu jedem Wert gehört ein Beispiel, und
   * ein Wert ohne Beispiel ist eine Behauptung. Als Paar gespeichert
   * lässt sich genau das prüfen — und Monday weist darauf hin.
   */
  werte: jsonb("werte").$type<{ wert: string; beispiel: string }[]>().notNull().default([]),
  feedbackRhythmus: text("feedback_rhythmus"),
  weiterbildung: text("weiterbildung"),
  weiterbildungsbudget: text("weiterbildungsbudget"),
  karrierewege: text("karrierewege"),
  interneWechsel: text("interne_wechsel"),
  onboarding: text("onboarding"),
  barrierefreiheit: text("barrierefreiheit"),

  /* Leistungen */
  urlaubstage: text("urlaubstage"),
  homeoffice: text("homeoffice"),
  bonusmodell: text("bonusmodell"),
  altersvorsorge: text("altersvorsorge"),
  mobilitaet: text("mobilitaet"),
  gesundheit: text("gesundheit"),
  ausstattung: text("ausstattung"),
  elternzeit: text("elternzeit"),
  weitereLeistungen: text("weitere_leistungen"),

  /* Bewerbungsprozess */
  ansprechperson: text("ansprechperson"),
  antwortzeit: text("antwortzeit"),
  anzahlGespraeche: text("anzahl_gespraeche"),
  beteiligteRollen: text("beteiligte_rollen"),
  prozessdauer: text("prozessdauer"),
  probearbeit: text("probearbeit"),
  unterlagen: text("unterlagen"),
  anpassungen: text("anpassungen"),

  /*
   * Entwurf und Veröffentlichung sind zwei Stände desselben Profils,
   * nicht zwei Profile. Wer nach der Veröffentlichung weiterschreibt,
   * ändert den Entwurf; die öffentliche Seite bleibt stehen, bis
   * jemand sie ausdrücklich erneuert.
   */
  veroeffentlichtAm: timestamp("veroeffentlicht_am", { withTimezone: true }),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  aktualisiertVon: uuid("aktualisiert_von"),
});


/* ══════════════════════════════════════════════════════════════
   Vorschläge
   ══════════════════════════════════════════════════════════════ */

/** Die vier Arten von Aussage, aus denen eine Begründung besteht. */
export type MatchBegruendung = {
  /** Was durch bestätigte Angaben gedeckt ist. */
  belegt: string[];
  /** Was die Datenlage nicht beantwortet — Fragen fürs Gespräch. */
  offen: string[];
  /** Was fehlt, aber in der Einarbeitung erreichbar wäre. */
  entwickelbar: string[];
  /** Echte Ausschlusskriterien. Nicht verhandelbar. */
  ausschluss: string[];
};

/**
 * Die neun Zustände der Einwilligungskette.
 *
 * Sie sind eine Reihenfolge, keine Menge: Ein Kontakt öffnet sich
 * nicht, ohne dass vorher eine Freigabe erteilt wurde. Die Übergänge
 * stehen in `lib/arbeitgeber/matches.ts` und nirgends sonst.
 */
export type MatchZustand =
  | "anonym_erkannt"
  | "freigabe_angefragt"
  | "profil_freigegeben"
  | "interesse_gesendet"
  | "gegenseitiges_interesse"
  | "kontakt_offen"
  | "abgelehnt"
  | "freigabe_widerrufen"
  | "abgelaufen";

/**
 * Ein Vorschlag zu einer Stelle.
 *
 * ── Warum die Bewertung mitgespeichert wird ───────────────────
 *
 * Sie liesse sich bei jedem Aufruf neu rechnen. Dann änderte sich aber
 * die Zahl unter der Hand: Ein Profil wird ergänzt, eine Anzeige
 * überarbeitet — und der Wert, über den ein Team gestern gesprochen
 * hat, ist heute ein anderer, ohne dass jemand es merkt. Gespeichert
 * ist die Bewertung ein Befund mit Datum.
 */
export const stellenMatches = pgTable(
  "stellen_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postingId: uuid("posting_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    /**
     * Der Schlüssel, nicht der Zugang.
     *
     * Über diese Kennung wird nichts nachgeladen, solange der Zustand
     * nicht mindestens `profil_freigegeben` ist. Sie steht hier, damit
     * die Person ihren Vorschlag wiederfindet und widerrufen kann.
     */
    candidateUserId: uuid("candidate_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    fitGesamt: smallint("fit_gesamt"),
    fitFachlich: smallint("fit_fachlich"),
    fitPersoenlich: smallint("fit_persoenlich"),
    fitLangfristig: smallint("fit_langfristig"),
    band: text("band").notNull().default("insufficient_data"),
    /** Anteil der Kriterien mit Daten, 0..100. */
    datenbasis: smallint("datenbasis").notNull().default(0),

    belegt: jsonb("belegt").$type<string[]>().notNull().default([]),
    offen: jsonb("offen").$type<string[]>().notNull().default([]),
    entwickelbar: jsonb("entwickelbar").$type<string[]>().notNull().default([]),
    ausschluss: jsonb("ausschluss").$type<string[]>().notNull().default([]),

    gehaltUeberschneidung: text("gehalt_ueberschneidung"),
    verfuegbarkeit: text("verfuegbarkeit"),

    zustand: text("zustand").$type<MatchZustand>().notNull().default("anonym_erkannt"),
    freigabeAngefragtAm: timestamp("freigabe_angefragt_am", { withTimezone: true }),
    freigabeErteiltAm: timestamp("freigabe_erteilt_am", { withTimezone: true }),
    freigabeWiderrufenAm: timestamp("freigabe_widerrufen_am", { withTimezone: true }),
    interesseUnternehmenAm: timestamp("interesse_unternehmen_am", { withTimezone: true }),
    interessePersonAm: timestamp("interesse_person_am", { withTimezone: true }),
    kontaktOffenAm: timestamp("kontakt_offen_am", { withTimezone: true }),
    abgelehntAm: timestamp("abgelehnt_am", { withTimezone: true }),
    abgelehntVon: text("abgelehnt_von"),
    ablaufAm: timestamp("ablauf_am", { withTimezone: true }),

    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stellen_matches_unique").on(t.postingId, t.candidateUserId),
    index("stellen_matches_org_idx").on(t.organizationId, t.zustand),
    index("stellen_matches_person_idx").on(t.candidateUserId, t.zustand),
  ],
);

/**
 * Die Automatisierungsstufe — je Stelle oder als Vorgabe der
 * Organisation (`postingId is null`).
 *
 * Stufe 1 ist die Vorgabe: Monday rechnet, ein Mensch entscheidet. Eine
 * höhere Vorgabe hiesse, dass Nachrichten an Menschen herausgehen,
 * weil niemand die Einstellung gelesen hat.
 */
export const matchRegeln = pgTable(
  "match_regeln",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    postingId: uuid("posting_id").references(() => jobPostings.id, { onDelete: "cascade" }),
    /** 1 nur Vorschläge · 2 Freigaben anfragen · 3 automatisch verbinden */
    stufe: smallint("stufe").notNull().default(1),
    minFit: smallint("min_fit").notNull().default(80),
    bedingungen: jsonb("bedingungen").$type<Record<string, unknown>>().notNull().default({}),
    pausiertAm: timestamp("pausiert_am", { withTimezone: true }),
    geaendertVon: uuid("geaendert_von"),
    geaendertAm: timestamp("geaendert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_regeln_org_idx").on(t.organizationId)],
);

/**
 * Was eine Automatisierung getan hat.
 *
 * Ohne dieses Protokoll wäre „jederzeit widerrufbar" nicht prüfbar:
 * Man könnte eine Automatisierung abschalten, aber nicht mehr
 * feststellen, was sie vorher getan hat.
 */
export const matchProtokoll = pgTable(
  "match_protokoll",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    matchId: uuid("match_id"),
    /** „regel" oder eine Nutzerkennung. */
    ausgeloestVon: text("ausgeloest_von").notNull(),
    handlung: text("handlung").notNull(),
    begruendung: text("begruendung").notNull().default(""),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_protokoll_org_idx").on(t.organizationId, t.erstelltAm)],
);

/* ══════════════════════════════════════════════════════════════
   Monday-Onboarding
   ══════════════════════════════════════════════════════════════ */

/** Woher eine Angabe kommt. */
export type Angabenquelle = "gespraech" | "website" | "dokument" | "nutzer";

/**
 * Wie belastbar eine Angabe ist.
 *
 * `nicht_angegeben` ist kein leerer Wert, sondern eine Aussage:
 * „danach wurde gefragt und es kam nichts". Das ist etwas anderes als
 * eine Zeile, die es nie gab — und nur so lässt sich später sagen, ob
 * eine Frage schon gestellt wurde.
 */
export type Angabenstatus =
  | "bestaetigt"
  | "gefunden"
  | "abgeleitet"
  | "unklar"
  | "nicht_angegeben";

/**
 * Ein Einrichtungsgespräch mit Monday.
 *
 * Es gehört der Organisation, nicht der Person: Wer es angefangen hat,
 * steht in `begonnenVon`, fortsetzen darf es jedes Teammitglied. Ein
 * Gespräch, das mit dem Konto seines Urhebers verschwindet, ist für
 * ein Unternehmen die falsche Zuordnung.
 */
export const onboardingGespraeche = pgTable(
  "onboarding_gespraeche",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    /** Null, solange nur das Unternehmen besprochen wird. */
    postingId: uuid("posting_id").references(() => jobPostings.id, { onDelete: "set null" }),
    /** entwurf · abgeschlossen */
    status: text("status").notNull().default("entwurf"),
    /** text · sprache */
    letzterModus: text("letzter_modus").notNull().default("text"),
    begonnenVon: uuid("begonnen_von"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("onboarding_gespraeche_org_idx").on(t.organizationId, t.aktualisiertAm)],
);

/**
 * Der Gesprächsverlauf.
 *
 * Getrennt von den Angaben, weil beides verschiedene Lebensdauern hat:
 * Eine Angabe wird korrigiert und behält ihre Kennung; eine Nachricht
 * ist ein Ereignis und ändert sich nie.
 */
export const onboardingNachrichten = pgTable(
  "onboarding_nachrichten",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gespraechId: uuid("gespraech_id").notNull().references(() => onboardingGespraeche.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    /** nina · mensch */
    rolle: text("rolle").notNull(),
    text: text("text").notNull(),
    /**
     * Bei Spracheingabe das Transkript vor der Korrektur.
     *
     * Es bleibt stehen, damit sich eine Fehlerkennung später
     * nachvollziehen lässt — „das habe ich nie gesagt" ist sonst nicht
     * zu klären.
     */
    transkriptRoh: text("transkript_roh"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("onboarding_nachrichten_idx").on(t.gespraechId, t.erstelltAm)],
);

/**
 * Eine einzelne Angabe — mit Herkunft.
 *
 * ── Warum eine Zeile je Angabe ────────────────────────────────
 *
 * Der naheliegende Entwurf wäre ein grosses JSON-Dokument je Gespräch.
 * Er scheitert an dem, was dieses Onboarding von einem Chatbot
 * unterscheidet: Jede Angabe trägt, woher sie kommt und wie sicher sie
 * ist. In einem Dokument stünde diese Herkunft als verschachteltes
 * Objekt, das keine Abfrage lesen kann — und die Frage „welche
 * Angaben kommen von der Website und sind noch nicht bestätigt" ist
 * genau die, die die Oberfläche auf jeder Seite stellt.
 */
export const onboardingAngaben = pgTable(
  "onboarding_angaben",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gespraechId: uuid("gespraech_id").notNull().references(() => onboardingGespraeche.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),

    bereich: text("bereich").notNull(),
    feld: text("feld").notNull(),
    /** Als JSON: ein Wert kann Zahl, Text oder Liste sein. */
    wert: jsonb("wert").$type<unknown>().notNull(),

    quelle: text("quelle").$type<Angabenquelle>().notNull(),
    /**
     * Wo genau: die Adresse der Seite, der Dateiname, die Nachricht.
     * Ohne diese Angabe ist „von der Website" nicht überprüfbar.
     */
    quelleDetail: text("quelle_detail"),

    /** 0 bis 100. Bei `quelle = nutzer` immer 100. */
    konfidenz: smallint("konfidenz").notNull().default(50),
    status: text("status").$type<Angabenstatus>().notNull().default("gefunden"),

    erfasstAm: timestamp("erfasst_am", { withTimezone: true }).notNull().defaultNow(),
    bestaetigtAm: timestamp("bestaetigt_am", { withTimezone: true }),
    bestaetigtVon: uuid("bestaetigt_von"),
  },
  (t) => [
    uniqueIndex("onboarding_angaben_unique").on(t.gespraechId, t.bereich, t.feld),
    index("onboarding_angaben_status_idx").on(t.organizationId, t.status),
  ],
);
