import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
  smallint,
} from "drizzle-orm/pg-core";
import { applyMethodEnum, contractTypeEnum, experienceLevelEnum, jobSourceKindEnum,
  licenseStatusEnum, requirementKindEnum, reviewSourceKindEnum, salaryPeriodEnum,
  salaryProvenanceEnum,
  sentimentEnum, workModelEnum } from "./enums.ts";
import { users } from "./identity.ts";
import { projekte } from "./projekte.ts";

/** Stellen, Unternehmen, Quellen und Bewertungen. */

export const jobSources = pgTable("job_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  displayName: text("display_name").notNull(),
  kind: jobSourceKindEnum("kind").notNull(),
  /** Eine Quelle ohne geklaerte Lizenz wird nicht aktiviert. */
  licenseStatus: licenseStatusEnum("license_status").notNull().default("unclear"),
  attributionRequired: boolean("attribution_required").notNull().default(false),
  attributionText: text("attribution_text"),
  termsUrl: text("terms_url"),
  enabled: boolean("enabled").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunOk: boolean("last_run_ok"),
  lastRunError: text("last_run_error"),
  /**
   * Wann diese Quelle zuletzt VOLLSTÄNDIG geladen wurde.
   *
   * `lastRunAt` beantwortet die falsche Frage: Es sagt, wann ein Lauf
   * war, nicht ob er den ganzen Bestand gesehen hat. Ein Lauf mit
   * Zeitbudget oder Stückzahlgrenze endet mittendrin — und aus so
   * einem Lauf folgt über eine fehlende Stelle nichts.
   */
  lastFullSyncAt: timestamp("last_full_sync_at", { withTimezone: true }),
}, (t) => [uniqueIndex("job_sources_key_unique").on(t.key)]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  sizeBand: text("size_band"),
  headquarters: text("headquarters"),
  /** Nur true, wenn aus einem offiziellen Register bestätigt. */
  registryVerified: boolean("registry_verified").notNull().default(false),
  registryRef: text("registry_ref"),
  isDemo: boolean("is_demo").notNull().default(false),
  /**
   * Wann zuletzt angereichert — „gefragt", nicht „gefunden".
   *
   * Die Anreicherung kostet: 14 Einheiten je Treffer, und nur 38 % der
   * Firmen lassen sich zuordnen. Ohne diesen Vermerk versuchte jeder
   * Lauf dieselben 62 % erneut.
   */
  angereichertAm: timestamp("angereichert_am", { withTimezone: true }),
  /** Mitarbeiterzahl als Spanne — „10,001+" ist keine Zahl. */
  mitarbeiter: text("mitarbeiter"),
  gegruendet: integer("gegruendet"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  location: text("location").notNull(),
  country: text("country").notNull().default("DE"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  /* ── Woher die Koordinate kommt (Migration 0087) ───────────
   *
   * `latitude`/`longitude` allein sagen nicht, ob sie aus einer
   * vollständigen Adresse, aus einem Stadtmittelpunkt oder aus einem
   * gleichnamigen Ort im falschen Bundesland stammen. Für eine
   * Umkreisbedingung ist genau das der Unterschied. */
  geoStadt: text("geo_stadt"),
  geoPlz: text("geo_plz"),
  geoRegion: text("geo_region"),
  /** resolved_exact · resolved_city · ambiguous · not_found ·
   *  not_applicable_remote · invalid_input */
  geoStatus: text("geo_status"),
  /** geonames_plz · geonames_ort · nominatim_cache · anbieter */
  geoQuelle: text("geo_quelle"),
  /** exact · plz · stadt · region */
  geoGenauigkeit: text("geo_genauigkeit"),
  geoAufgeloestAm: timestamp("geo_aufgeloest_am", { withTimezone: true }),
  /** Steigt sie, gelten alle älteren Auflösungen als veraltet. */
  geoFassung: integer("geo_fassung"),
  /** Die Rohangabe, aus der aufgelöst wurde — Grundlage der Idempotenz. */
  geoRohangabe: text("geo_rohangabe"),
  workModel: workModelEnum("work_model").notNull(),
  remotePercent: integer("remote_percent"),
  /*
   * Nachkommastellen, weil Stundenlöhne krumm sind.
   *
   * Als Ganzzahl scheiterte jede Anzeige mit „17,65 € je Stunde" beim
   * Schreiben und fiel still aus dem Bestand. Siehe Migration 0034 für
   * die Begründung, warum hier `double precision` steht und nicht
   * `numeric`.
   */
  salaryMin: doublePrecision("salary_min"),
  salaryMax: doublePrecision("salary_max"),
  salaryCurrency: text("salary_currency").notNull().default("EUR"),
  salaryPeriod: salaryPeriodEnum("salary_period").notNull().default("year"),
  /** false heisst: die Anzeige schweigt. Nie als 0 interpretieren. */
  salaryDisclosed: boolean("salary_disclosed").notNull().default(false),
  /**
   * Woher die Gehaltsangabe stammt.
   *
   * `provider` — der Anbieter hat ein Feld geliefert.
   * `text` — aus der Beschreibung gelesen; belegt, aber nicht bestätigt.
   * `null` — keine Angabe.
   *
   * Die Unterscheidung ist nicht kosmetisch: eine aus Fliesstext
   * gelesene Zahl darf keine Stelle ausschliessen, ein bestätigtes
   * Feld schon.
   */
  salaryProvenance: salaryProvenanceEnum("salary_provenance"),
  /** Die Textstelle, aus der gelesen wurde. Macht die Angabe prüfbar. */
  salaryEvidence: text("salary_evidence"),
  contractType: contractTypeEnum("contract_type"),
  weeklyHours: doublePrecision("weekly_hours"),
  shiftWork: boolean("shift_work"),
  travelPercent: integer("travel_percent"),
  experienceLevel: experienceLevelEnum("experience_level"),
  industry: text("industry"),
  languageRequirements: jsonb("language_requirements").$type<Record<string, string>>().notNull().default({}),
  /**
   * Die Sprache, in der die Anzeige geschrieben ist.
   *
   * Deterministisch über Funktionswörter erkannt, nicht mit einem
   * Modell: Bei 2,3 Mio. Anzeigen wäre ein Modellaufruf je Anzeige
   * nicht bezahlbar, und Zählen ist prüfbar.
   *
   * `null` heisst „noch nicht geprüft", `"unbekannt"` heisst „geprüft
   * und nicht entscheidbar". Der Unterschied bestimmt, ob die
   * Nachtragung sie noch einmal ansieht.
   */
  originalLanguage: text("original_language"),
  requiredLicenses: jsonb("required_licenses").$type<string[]>().notNull().default([]),
  workPermitRequired: boolean("work_permit_required"),
  coreTasks: jsonb("core_tasks").$type<string[]>().notNull().default([]),
  description: text("description").notNull(),
  /*
   * Zwei Ableitungen der Beschreibung — beim Import gefüllt.
   *
   * Die Rangfolge braucht den Fliesstext nie: `overlap()` in fit.ts
   * reduziert ihn auf eine Menge eindeutiger Wörter über drei Zeichen,
   * und listingConfidence prüft nur die Länge. Wer beides vorhält,
   * kann die 4,35 MB Beschreibungstext aus der Ranglistenabfrage
   * herausnehmen, ohne einen einzigen Wert zu verändern.
   */
  /*
   * Kein `.default()` — mit Absicht.
   *
   * Ein Standardwert erlaubt dem INSERT, die Spalte wegzulassen, und
   * dann fehlt sie still. So verlangt Drizzle beide Felder bei jedem
   * Schreibvorgang, und wer sie vergisst, erfährt es beim Übersetzen
   * statt Wochen später an einer Rangfolge, die nicht stimmt.
   */
  descriptionTokens: text("description_tokens").notNull(),
  descriptionLength: integer("description_length").notNull(),
  benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
  applyMethod: applyMethodEnum("apply_method").notNull().default("unknown"),
  applyTarget: text("apply_target"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  /**
   * Der Zustand der STELLE, aus ihren Fundstellen gebildet.
   *
   * Die Fundstellen tragen ihren eigenen Zustand (siehe
   * `jobSourceLinks`); hier steht die Antwort auf die Frage, die eine
   * Liste stellt: Soll das noch angezeigt werden?
   *
   * Gebildet mit `standAusFundstellen` aus `@paycheck/domain` — die
   * nähere Quelle entscheidet, und bei Gleichstand die aktivste
   * Aussage.
   */
  availabilityState: text("availability_state").notNull().default("unknown"),
  availabilityReason: text("availability_reason"),
  availabilityCheckedAt: timestamp("availability_checked_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  lastLinkCheckAt: timestamp("last_link_check_at", { withTimezone: true }),
  lastLinkCheckOk: boolean("last_link_check_ok"),
  originalUrl: text("original_url"),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id),
  /** Erkennt Reposts derselben Stelle über Quellen hinweg. */
  contentHash: text("content_hash").notNull(),
  /**
   * Die amtliche Berufskennung (KldB 2010) zu dieser Stelle.
   *
   * Steht hier und nicht nur in `beruf_zuordnung`, weil `berufsbild()`
   * beim Rendern jeder Zeile läuft und synchron ist. Siehe Migration
   * 0041 für die Begründung.
   */
  kldb: text("kldb"),
  /** Zeigt die Stelle als Demo-Datensatz aus, nie als Live-Angebot. */
  isDemo: boolean("is_demo").notNull().default(false),
}, (t) => [
  index("jobs_content_hash_idx").on(t.contentHash),
  index("jobs_published_idx").on(t.publishedAt),
  index("jobs_company_idx").on(t.companyId),
]);

/** Rohfassung je Abruf. Erlaubt später zu zeigen, was sich geaendert hat. */
export const jobSnapshots = pgTable("job_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
  contentHash: text("content_hash").notNull(),
}, (t) => [index("job_snapshots_job_idx").on(t.jobId, t.fetchedAt)]);

export const jobRequirements = pgTable("job_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  kind: requirementKindEnum("kind").notNull(),
  text: text("text").notNull(),
  skillKey: text("skill_key"),
  category: text("category").notNull().default("other"),
  /**
   * Ob es ein Ausschlusskriterium ist.
   *
   * `kind` unterschied bisher „must" und „nice" aus der Anzeige. Das
   * ist die Behauptung des Textes. Diese Spalte hält fest, was NACH
   * der Prüfung gilt — und die beiden gehen auseinander: „SAP von
   * Vorteil" steht unter Muss, ist aber keins.
   */
  zwingend: boolean("zwingend").notNull().default(false),
  /**
   * Ob sich die Lücke in der Einarbeitung schliessen liesse.
   *
   * Der Unterschied zwischen „passt nicht" und „passt noch nicht" —
   * und die Grundlage für den späteren Skill-Gap-Plan.
   */
  erlernbar: boolean("erlernbar").notNull().default(false),
  /** 0 bis 100, wie wichtig innerhalb ihrer Art. */
  wichtigkeit: smallint("wichtigkeit").notNull().default(50),
  konfidenz: smallint("konfidenz").notNull().default(70),
  /** Der Satz aus der Anzeige, auf den sich das stützt. */
  belegstelle: text("belegstelle"),

  /* ── Struktur, Migration 0116 ─────────────────────────────── */

  /** Eine aus `ANFORDERUNGSKATEGORIEN`. `TASK` fordert nichts. */
  kategorie: text("kategorie").notNull().default("UNKNOWN"),
  /** `muss` · `wunsch` · `unklar`. Der häufigste Wert ist `unklar`. */
  verbindlichkeit: text("verbindlichkeit").notNull().default("unklar"),
  /** Der Satz ohne Beiwerk. Das Original steht in `text`. */
  bedeutung: text("bedeutung"),
  /** Bei EXPERIENCE: worin. `null` heisst unbekannt, nie „egal". */
  erfahrungsfeld: text("erfahrungsfeld"),
  erfahrungsmass: text("erfahrungsmass"),
  /**
   * Welche Regeln diese Zeile erzeugt haben.
   *
   * Die neue Fassung wird neben die alte geschrieben, nicht darüber.
   * Leser nehmen die höchste vorhandene je Stelle.
   */
  extraktionFassung: text("extraktion_fassung").notNull().default("anforderung-1"),
}, (t) => [
  index("job_requirements_job_idx").on(t.jobId),
  index("job_requirements_fassung_idx").on(t.jobId, t.extraktionFassung),
]);

export const companySources = pgTable("company_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sourceKind: reviewSourceKindEnum("source_kind").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  licenseStatus: licenseStatusEnum("license_status").notNull().default("public_link_only"),
  attributionText: text("attribution_text"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewAggregates = pgTable("review_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  /** Art der Quelle steht immer sichtbar dabei: Kundenurteile sind keine
   *  Aussage über die Arbeitskultur. */
  sourceKind: reviewSourceKindEnum("source_kind").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  ratingAverage: doublePrecision("rating_average"),
  ratingScaleMax: doublePrecision("rating_scale_max").notNull().default(5),
  sampleSize: integer("sample_size"),
  locationScope: text("location_scope"),
  roleScope: text("role_scope"),
  periodFrom: timestamp("period_from", { withTimezone: true }),
  periodTo: timestamp("period_to", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  attributionText: text("attribution_text"),
  /** Wie die Quelle selbst auswaehlt und sortiert. Nie verschweigen. */
  selectionNote: text("selection_note"),
  isDemo: boolean("is_demo").notNull().default(false),
}, (t) => [index("review_aggregates_company_idx").on(t.companyId)]);

export const reviewThemes = pgTable("review_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  aggregateId: uuid("aggregate_id").notNull().references(() => reviewAggregates.id, { onDelete: "cascade" }),
  theme: text("theme").notNull(),
  sentiment: sentimentEnum("sentiment").notNull(),
  mentionCount: integer("mention_count").notNull().default(0),
  /** Als KI-Zusammenfassung gekennzeichnet, mit Quelle und Zeitraum. */
  summary: text("summary").notNull(),
  sourceUrl: text("source_url"),
  periodFrom: timestamp("period_from", { withTimezone: true }),
  periodTo: timestamp("period_to", { withTimezone: true }),
});

/** Jede externe Aussage im Produkt trägt eine Zeile hier. */
export const sourceCitations = pgTable("source_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  sourceKind: text("source_kind").notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  licenseNote: text("license_note"),
}, (t) => [index("source_citations_subject_idx").on(t.subjectType, t.subjectId)]);

/**
 * Wo dieselbe Stelle sonst noch steht.
 *
 * Eine offene Stelle, mehrere Portale. Für die Person ist es eine
 * Stelle — sie soll sie einmal sehen und dabei wissen, wo sie sich
 * bewerben kann. Für uns ist es ein kanonischer Datensatz in `jobs` und
 * je Fundstelle eine Zeile hier.
 *
 * `canonicalKey` ist der Schlüssel, unter dem zusammengeführt wurde. Er
 * steht mit in der Zeile, damit später nachvollziehbar ist, WARUM zwei
 * Anzeigen als dieselbe gelten — und damit eine falsche Zusammenführung
 * gefunden werden kann, statt nur vermutet zu werden.
 *
 * `rank` entscheidet, welcher Link die Bewerbung trägt: die Quelle mit
 * der niedrigsten Zahl. Eine direkte Karriereseite steht vor einem
 * Portal, weil dort weniger zwischen Person und Unternehmen steht.
 */
/**
 * Registrierte Arbeitgeberboards.
 *
 * Der Board-Bezeichner steht hier und nirgends sonst. Das ist der
 * Unterschied zwischen „wir rufen die veröffentlichten Stellen eines
 * Arbeitgebers ab, der uns dazu berechtigt hat" und „wir probieren
 * Firmennamen durch, bis ein Endpunkt antwortet".
 *
 * Die Endpunkte der ATS-Anbieter antworten nämlich jedem. Sie
 * unterscheiden nicht, ob jemand berechtigt ist — das muss diese
 * Tabelle tun.
 *
 * `verifiedAt` ist Pflicht: eine Autorisierung ohne Zeitpunkt lässt
 * sich später nicht nachvollziehen, und genau das wird bei einer
 * Beschwerde verlangt.
 */
export const employerBoards = pgTable("employer_boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** greenhouse | lever | ashby | smartrecruiters */
  board: text("board").notNull(),
  /** Der Bezeichner beim ATS-Anbieter. */
  boardToken: text("board_token").notNull(),
  employerName: text("employer_name").notNull(),
  /** Die verifizierte Domäne des Arbeitgebers. */
  employerDomain: text("employer_domain"),
  /** verified_domain | written_authorization | own_employer_account */
  authorizationKind: text("authorization_kind").notNull(),
  /** Worauf sich die Berechtigung stützt: Domäne, Vertragsnummer, Vorgang. */
  authorizationReference: text("authorization_reference").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  /** Abschalten ohne Löschen: die Nachvollziehbarkeit bleibt erhalten. */
  enabled: boolean("enabled").notNull().default(true),
  disabledReason: text("disabled_reason"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncOk: boolean("last_sync_ok"),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("employer_boards_unique").on(t.board, t.boardToken),
  index("employer_boards_enabled_idx").on(t.enabled),
]);

export const jobSourceLinks = pgTable("job_source_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "cascade" }),
  /** Die Kennung der Anzeige beim jeweiligen Anbieter. */
  externalId: text("external_id").notNull(),
  url: text("url").notNull(),
  /** Der Schlüssel, unter dem zusammengeführt wurde. Belegt die Entscheidung. */
  canonicalKey: text("canonical_key"),
  rank: integer("rank").notNull().default(100),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  /** Letzte Linkprüfung dieser einen Fundstelle. */
  lastCheckOk: boolean("last_check_ok"),
  /**
   * Ob diese Fundstelle noch eine aktive Ausschreibung ist.
   *
   * Siehe `Verfuegbarkeit` in `@paycheck/domain` — dort steht die
   * Zustandslogik, und dort ist sie geprüft.
   *
   * Am LINK, nicht an der Stelle: Dieselbe Vakanz kann beim ATS des
   * Arbeitgebers aktiv sein und beim Aggregator verschwunden. Welche
   * Aussage gilt, entscheidet `rank` — kleiner ist näher an der
   * Quelle.
   */
  availabilityState: text("availability_state").notNull().default("unknown"),
  /** Warum. Der Grund unterscheidet eine Auskunft von einer Behauptung. */
  availabilityReason: text("availability_reason"),
  /**
   * Wann zuletzt wirklich geprüft wurde.
   *
   * Bleibt bei einem unvollständigen Lauf stehen: Es gab keine
   * Prüfung, und ein Zeitstempel liesse den Stand frischer aussehen,
   * als er ist.
   */
  availabilityCheckedAt: timestamp("availability_checked_at", { withTimezone: true }),
  /**
   * Wie oft die Stelle bei einem VOLLSTÄNDIGEN Lauf gefehlt hat.
   *
   * Nur dort gezählt. Ohne diese Bedingung schliesst ein
   * fünfminütiger Ausfall eines ATS den halben Bestand — lautlos,
   * denn eine Stelle, die verschwindet, beschwert sich nicht.
   */
  missingSuccessfulSyncCount: integer("missing_successful_sync_count").notNull().default(0),
  /** Bewerbungsfrist laut DIESER Quelle. */
  validThrough: timestamp("valid_through", { withTimezone: true }),
}, (t) => [
  uniqueIndex("job_source_links_unique").on(t.sourceId, t.externalId),
  index("job_source_links_job_idx").on(t.jobId),
  index("job_source_links_key_idx").on(t.canonicalKey),
]);

export const savedJobs = pgTable("saved_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  note: text("note"),
  /**
   * Zu welchem Vorhaben das gehört. `null` heisst: zu keinem.
   *
   * `set null` beim Löschen und NICHT cascade: Wer ein Projekt
   * löscht, will das Vorhaben loswerden — nicht seine Bewerbungen.
   */
  projektId: uuid("projekt_id").references(() => projekte.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("saved_jobs_unique").on(t.userId, t.jobId)]);

export const jobMatches = pgTable("job_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  fitScore: integer("fit_score"),
  fitBand: text("fit_band").notNull(),
  fitCoverage: doublePrecision("fit_coverage").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  jobQualityScore: integer("job_quality_score"),
  listingConfidenceScore: integer("listing_confidence_score").notNull().default(0),
  aiTransitionCategory: text("ai_transition_category").notNull().default("unclear_data"),
  overallScore: integer("overall_score"),
  constraintVerdict: text("constraint_verdict").notNull().default("uncertain"),
  topReason: text("top_reason").notNull().default(""),
  topReservation: text("top_reservation").notNull().default(""),
  /** Fassung der Bewertungslogik, damit alte Ergebnisse lesbar bleiben. */
  scoringVersion: text("scoring_version").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("job_matches_unique").on(t.userId, t.jobId), index("job_matches_user_idx").on(t.userId)]);

/** Einzelne Faktoren je Bewertung, damit ein Score reproduzierbar bleibt. */
export const matchFactors = pgTable("match_factors", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => jobMatches.id, { onDelete: "cascade" }),
  scoreKind: text("score_kind").notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  raw: doublePrecision("raw"),
  weight: doublePrecision("weight").notNull(),
  contribution: doublePrecision("contribution").notNull().default(0),
  explanation: text("explanation").notNull(),
  evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
  /**
   * Was für eine Aussage das ist.
   *
   * positiv · neutral · fehlende_angabe · konflikt · blocker
   *
   * Bisher war jeder Faktor ein Wert mit Erklärung. Damit liess sich
   * nicht unterscheiden zwischen „drei Remote-Tage erfüllen deine
   * Bedingung" und „du willst höchstens 30 Minuten fahren, es sind
   * 47". Beides sind Begründungen, aber nur eine ist ein Einwand.
   */
  art: text("art").notNull().default("neutral"),
  /** 1 leicht bis 3 schwer — nur bei Konflikt und Blocker gesetzt. */
  schwere: smallint("schwere"),
}, (t) => [index("match_factors_match_idx").on(t.matchId, t.scoreKind)]);

/**
 * Beiträge: was gerade am Arbeitsmarkt passiert.
 *
 * Nicht als Nachrichtenportal, sondern weil die Zahlen in diesem
 * Bestand Aussagen tragen, die sonst niemand macht. Jeder Beitrag
 * trägt seinen Beleg — eine Aussage ohne nachvollziehbare Grundlage
 * wäre eine Behauptung.
 *
 * Siehe Migration 0049.
 */
export const beitraege = pgTable("beitraege", {
  id: uuid("id").primaryKey().defaultRandom(),
  titel: text("titel").notNull(),
  /** Ein Satz. Er steht in der Übersicht und trägt die Aussage allein. */
  kernaussage: text("kernaussage").notNull(),
  text: text("text").notNull().default(""),
  /** krise · markt · beruf · ratgeber */
  art: text("art").notNull().default("markt"),
  /** Kurzname aus der Fotobibliothek — kein Pfad. */
  bildSlug: text("bild_slug"),
  kldbHauptgruppe: text("kldb_hauptgruppe"),
  /** Woraus die Aussage stammt. Lesbar, nicht ausführbar. */
  beleg: text("beleg").notNull().default(""),
  veroeffentlichtAm: timestamp("veroeffentlicht_am", { withTimezone: true }),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Übersetzte Fassungen einer Anzeige.
 *
 * ── Warum gespeichert und nicht bei jedem Aufruf erzeugt ──────
 *
 * Eine Übersetzung bei jedem Seitenaufruf neu zu erzeugen kostet bei
 * jedem Leser dasselbe Geld für dasselbe Ergebnis — und sie wäre
 * nicht reproduzierbar: Zwei Menschen sähen zwei verschiedene
 * Fassungen derselben Anzeige.
 *
 * ── Warum das Original unangetastet bleibt ────────────────────
 *
 * Was hier steht, ist eine zusätzliche Fassung, keine Ersetzung. Die
 * Oberfläche zeigt „Automatisch übersetzt" und bietet jederzeit das
 * Original an. Wer sich auf eine Anzeige beruft, muss auf den Text
 * zurückkommen können, den der Arbeitgeber geschrieben hat.
 */
export const jobUebersetzungen = pgTable(
  "job_uebersetzungen",
  {
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    /** Zielsprache, zweistellig. */
    sprache: text("sprache").notNull(),
    titel: text("titel").notNull(),
    beschreibung: text("beschreibung").notNull(),
    /** Modell und Fassung — sonst lässt sich später nicht erklären,
        warum eine Übersetzung so aussieht, wie sie aussieht. */
    modell: text("modell").notNull(),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.sprache] })],
);


/**
 * Die Ortsdatenbasis für die Umkreisprüfung.
 *
 * ══════════════════════════════════════════════════════════════
 * Quelle und Lizenz
 * ══════════════════════════════════════════════════════════════
 *
 *   GeoNames Postleitzahlen — https://download.geonames.org/export/zip/
 *   Creative Commons Attribution 4.0, laut `readme.txt` der Quelle
 *   (geprüft am 6. September 2026)
 *
 * Die Namensnennung gehört damit ins Produkt, wo Entfernungen gezeigt
 * werden. Ein Datensatz mit Attributionspflicht, dessen Quelle niemand
 * nennt, ist eine Lizenzverletzung mit Ansage.
 *
 * ── Warum offline und nicht per Anfrage ───────────────────────
 *
 * Nominatim untersagt Massenabfragen ausdrücklich. Der bestehende
 * Zwischenspeicher `geo_orte` bleibt als zweite Quelle — seine
 * Einträge sind bereits erfragt und werden nicht neu geholt.
 */
export const geoReferenz = pgTable(
  "geo_referenz",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    land: text("land").notNull(),
    /** Kleingeschrieben und normalisiert — der Suchschlüssel. */
    nameNorm: text("name_norm").notNull(),
    name: text("name").notNull(),
    region: text("region"),
    /**
     * Der Landkreis, ohne das Wort “Landkreis”.
     *
     * Das Bundesland trennt gleichnamige Orte nicht: Es gibt Bernau in
     * Brandenburg und Bernau in Baden-Württemberg, Moosburg in Bayern
     * und Moosburg in Baden-Württemberg. Die Anzeige schreibt den
     * Kreis dahinter — “Bernau bei Berlin, Barnim (Kreis)” — und erst
     * damit ist der Ort eindeutig.
     */
    kreis: text("kreis"),
    plz: text("plz"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    /** Wie viele Postleitzahlen zu diesem Ort gehören. */
    plzAnzahl: integer("plz_anzahl").notNull().default(1),
    quelle: text("quelle").notNull(),
    quelleFassung: text("quelle_fassung").notNull(),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("geo_referenz_name_idx").on(t.land, t.nameNorm),
    index("geo_referenz_plz_idx").on(t.land, t.plz),
  ],
);
