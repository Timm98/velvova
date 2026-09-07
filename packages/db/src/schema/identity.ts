import { relations } from "drizzle-orm";
import {
  boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { consentKindEnum, integrationKindEnum, integrationStatusEnum, localeEnum,
  privacyRequestKindEnum, privacyRequestStatusEnum, userRoleEnum } from "./enums.ts";

/**
 * Identität, Einwilligungen und Datenschutzanfragen.
 *
 * Jede Tabelle mit Nutzerbezug trägt user_id. Darauf setzt die
 * Zugriffskontrolle auf (siehe migrate.ts, Row Level Security).
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /*
   * Optional, seit es die Anmeldung per Telefonnummer gibt.
   *
   * Der bequeme Ausweg wäre eine erfundene Adresse gewesen —
   * "+491701234567@telefon.velvova.de". Eine Adresse, an die niemand
   * schreiben kann, fällt spätestens beim ersten Versand auf.
   *
   * Die Datenbank stellt über `users_kennung_vorhanden` sicher, dass
   * mindestens eines von beiden dasteht.
   */
  email: text("email"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** Immer im E.164-Format: +491701234567. Eindeutig. */
  phone: text("phone"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  /** Argon2id- oder Scrypt-Hash. Niemals das Passwort selbst. */
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("candidate"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Soft Delete. Der harte Löschlauf räumt später kontrolliert auf. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("users_email_unique").on(t.email),
  uniqueIndex("users_phone_unique").on(t.phone),
]);

export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("auth_accounts_provider_unique").on(t.provider, t.providerAccountId)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Nur der Hash des Tokens. Das Token selbst steht ausschließlich im Cookie. */
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  deviceLabel: text("device_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]);

export const magicLinks = pgTable("magic_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose").notNull().default("login"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("magic_links_token_unique").on(t.tokenHash)]);

/**
 * Der sechsstellige Bestätigungscode.
 *
 * ── Warum nicht über `magicLinks` ─────────────────────────────
 *
 * Ein Anmeldelink trägt 43 zufällige Zeichen. Ein Code trägt sechs
 * Ziffern — eine Million Möglichkeiten, und die durchprobiert ein
 * Skript in Minuten. Dieser Code braucht deshalb, was ein Link nicht
 * braucht: einen Versuchszähler und eine kurze Gültigkeit.
 *
 * Gespeichert wird nur der Hash. Wer die Datenbank liest, kann sich
 * damit nichts bestätigen.
 */
export const bestaetigungscodes = pgTable(
  "bestaetigungscodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /**
     * Die Adresse, an die gesendet wurde.
     *
     * Sie kann von `users.email` abweichen: Wer im zweiten Schritt
     * seine Adresse korrigiert, bestätigt die neue, bevor sie ins
     * Konto wandert.
     */
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    zweck: text("zweck").notNull().default("business_email"),
    versuche: smallint("versuche").notNull().default(0),
    /**
     * Bis wann die Eingabe gesperrt ist.
     *
     * Die Sperre gilt der Person, nicht dem Code. Vorher war ein Code
     * nach fünf Fehlversuchen verbraucht — wer riet, forderte einfach
     * den nächsten an und hatte wieder fünf.
     */
    gesperrtBis: timestamp("gesperrt_bis", { withTimezone: true }),
    /**
     * Der Hash der anfragenden IP.
     *
     * Eine Begrenzung nur nach Adresse hilft gegen den Tippfehler,
     * nicht gegen den Angriff: Wer raten will, nimmt tausend Adressen.
     * Gespeichert wird der Hash — für „wie viele Anfragen kamen von
     * hier" reicht er, und mehr braucht diese Tabelle nicht zu wissen.
     */
    ipHash: text("ip_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bestaetigungscodes_offen_idx").on(t.userId, t.zweck, t.createdAt)],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),

  /* ---- Sprache ----
     Drei getrennte Sprachen, weil es drei getrennte Entscheidungen sind:
     Jemand kann die Oberfläche auf Deutsch wollen, mit der Assistenz
     lieber auf Türkisch sprechen und die Bewerbung auf Englisch
     schreiben. Ein einziges Feld würde alle drei aneinanderketten. */
  /*
   * ══════════════════════════════════════════════════════════════
   * `null` heisst: nicht gesagt
   * ══════════════════════════════════════════════════════════════
   *
   * Sie standen auf `notNull().default("de")`. Beim Anlegen eines
   * Kontos entsteht die Zeile mit dieser Vorgabe — und danach ist
   * nicht mehr zu erkennen, ob jemand deutsch GEWÄHLT hat oder ob es
   * nie zur Sprache kam.
   *
   * Gemessen am 7. September 2026: 1.001 Zeilen, alle mit
   * `locale = 'de'`. Es hatte also praktisch niemand etwas gewählt —
   * und alle bekamen deutsch, auch wer aus Zürich oder London kam.
   *
   * Wer nichts gesagt hat, bekommt jetzt die Sprache aus seiner
   * Anfrage. Wer etwas gewählt hat, behält sie — auch im Urlaub.
   */
  locale: localeEnum("locale"),
  assistantLocale: localeEnum("assistant_locale"),
  documentLocale: localeEnum("document_locale"),

  /* ---- Ort und Markt ----
     Wohnort und Jobmarkt sind nicht dasselbe: wer in Basel wohnt, kann
     auf den deutschen Markt schauen. */
  country: text("country").notNull().default("DE"),
  jobMarketCountry: text("job_market_country").notNull().default("DE"),
  currency: text("currency").notNull().default("EUR"),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  distanceUnit: text("distance_unit").notNull().default("km"),
  baseLocation: text("base_location"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  searchRadiusKm: integer("search_radius_km"),
  maxCommuteMinutes: integer("max_commute_minutes"),
  commuteMode: text("commute_mode").notNull().default("public_transport"),
  willingToRelocate: boolean("willing_to_relocate").notNull().default(false),

  /* ---- Suche ---- */
  remotePreference: text("remote_preference").notNull().default("no_preference"),
  employmentTypes: jsonb("employment_types").$type<string[]>().notNull().default([]),
  /** Wunschgehalt. Bleibt leer, wenn nichts gesagt wurde — 0 wäre eine Aussage. */
  desiredSalaryMin: integer("desired_salary_min"),
  desiredSalaryPeriod: text("desired_salary_period").notNull().default("year"),

  /* ---- Darstellung und Benachrichtigungen ---- */
  theme: text("theme").notNull().default("system"),
  notificationEmail: boolean("notification_email").notNull().default(true),
  notificationPush: boolean("notification_push").notNull().default(false),

  /* ---- Stimme und Gespräch ---- */
  microphoneEnabled: boolean("microphone_enabled").notNull().default(false),
  voiceAutoplay: boolean("voice_autoplay").notNull().default(false),

  /**
   * Der Pfad zum Profilbild in der Ablage — nicht das Bild selbst.
   *
   * Bilder gehören nicht in die Datenbank: Jede Abfrage auf
   * `user_settings` schleppte sie dann mit, auch wenn nur die Region
   * gebraucht wird. Der Pfad zeigt in denselben Ablagemechanismus, der
   * schon die Bewerbungsunterlagen trägt.
   *
   * `null` heisst „kein Bild" — dann steht der Anfangsbuchstabe da,
   * wie bisher.
   */
  avatarPfad: text("avatar_pfad"),
  /*
   * Das Bild eines Fremdanbieters, als Adresse.
   *
   * Ein hochgeladenes Bild (`avatarPfad`) hat Vorrang: Es ist die
   * Wahl der Person, das hier nur das, was Google mitgeschickt hat.
   */
  avatarUrl: text("avatar_url"),

  /*
   * Ob Monday diese Person Arbeitgebern vorschlagen darf.
   *
   * Voreingestellt aus, und das ist die wichtigste Voreinstellung im
   * Schema. Ein Vorschlag ist etwas anderes als eine Bewerbung: Bei
   * der Bewerbung hat sich ein Mensch entschieden, beim Vorschlag
   * entscheidet ein System über ihn. Wer davon erfasst wird, muss
   * vorher zugestimmt haben — sonst ist die Einwilligungskette
   * dahinter eine Formalie auf einer Annahme.
   */
  auffindbar: boolean("auffindbar").notNull().default(false),
  auffindbarSeit: timestamp("auffindbar_seit", { withTimezone: true }),
  voiceCaptions: boolean("voice_captions").notNull().default(true),
  voiceSpeed: doublePrecision("voice_speed").notNull().default(1),
  /** Aufnahme nach dem Abtippen löschen. Voreinstellung: ja. */
  deleteAudioAfterTranscript: boolean("delete_audio_after_transcript").notNull().default(true),

  /** Nutzergewichte für den Fit, in Grenzen anpassbar. */
  fitWeights: jsonb("fit_weights").$type<Record<string, number>>(),
  /** Ist das Onboarding durchlaufen? Steuert die Weiterleitung. */
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Einwilligungs-Ledger. Jede Einwilligung einzeln, mit Zweck, Fassung und
 * Zeitpunkt - und mit dem Widerruf in derselben Zeile, damit die Historie
 * nachvollziehbar bleibt.
 */
export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: consentKindEnum("kind").notNull(),
  granted: boolean("granted").notNull(),
  /** Fassung des Textes, dem zugestimmt wurde. */
  policyVersion: text("policy_version").notNull(),
  purpose: text("purpose").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("consents_user_kind_idx").on(t.userId, t.kind)]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** institution · employer */
  kind: text("kind").notNull().default("institution"),
  slug: text("slug"),
  website: text("website"),
  /** Das Unternehmen im Stellenindex, sobald zugeordnet. */
  companyId: uuid("company_id"),
  /**
   * Wann die Zugehörigkeit zum Unternehmen geprüft wurde.
   *
   * Ungeprüfte Konten dürfen keine Stellen veröffentlichen. Sonst stünde
   * im Index eine Anzeige im Namen eines Unternehmens, das nichts davon
   * weiss — und die Person, die sich darauf bewirbt, schickt ihre Daten
   * an jemanden, den sie für diesen Arbeitgeber hält.
   */
  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  /* Die Angaben aus der Registrierung. */
  rechtsname: text("rechtsname"),
  domain: text("domain"),
  branche: text("branche"),
  groesse: text("groesse"),
  hauptsitz: text("hauptsitz"),
  handelsregister: text("handelsregister"),
  ustId: text("ust_id"),

  /*
   * Woran die Prüfung gerade hängt.
   *
   * `verifiedAt` beantwortet eine Ja-Nein-Frage. Dazwischen liegen
   * aber Tage, in denen jemand wissen will, woran es liegt — läuft die
   * Domainprüfung, wartet eine E-Mail, sieht ein Mensch drauf, fehlt
   * eine Angabe. „Noch nicht bestätigt" ist für jemanden, der seit
   * drei Tagen wartet, keine Auskunft.
   *
   * domain_pruefung · bestaetigung_gesendet · manuelle_pruefung ·
   * bestaetigt · angaben_fehlen
   */
  pruefstand: text("pruefstand").notNull().default("angaben_fehlen"),
  pruefstandSeit: timestamp("pruefstand_seit", { withTimezone: true }),

  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  /*
   * Die Funktion im Unternehmen — nicht die Berechtigung.
   *
   * `role` sagt, was jemand DARF. `funktion` sagt, was jemand IST:
   * Geschäftsführung, Personalabteilung, Fachbereich. Beides in eine
   * Spalte zu legen hiesse, dass eine Beförderung Rechte ändert und
   * eine Rechteänderung eine Beförderung behauptet.
   */
  funktion: text("funktion"),
  /** Standardmäßig sieht ein Partner ausschließlich aggregierte Daten. */
  canSeeIndividualProfiles: boolean("can_see_individual_profiles").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("memberships_unique").on(t.organizationId, t.userId)]);

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: integrationKindEnum("kind").notNull(),
  status: integrationStatusEnum("status").notNull().default("not_connected"),
  displayName: text("display_name"),
  /** Verschlüsselt abgelegt. Nie im Klartext, nie in Logs. */
  credentialsEncrypted: text("credentials_encrypted"),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastError: text("last_error"),
}, (t) => [uniqueIndex("integrations_user_kind_unique").on(t.userId, t.kind)]);

export const privacyRequests = pgTable("privacy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: privacyRequestKindEnum("kind").notNull(),
  status: privacyRequestStatusEnum("status").notNull().default("open"),
  targetRef: text("target_ref"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  resultRef: text("result_ref"),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  subjectUserId: uuid("subject_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  /** Bei Supportzugriff verpflichtend: warum wurde zugegriffen. */
  justification: text("justification"),
  breakGlass: boolean("break_glass").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_logs_subject_idx").on(t.subjectUserId, t.createdAt)]);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  consents: many(consents),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
}));

/* ── Abrechnung ────────────────────────────────────────────────
   Anbieterneutral: `provider` und `provider_ref` halten die Kennungen
   des jeweiligen Zahlungsdienstes. Zahlungsdaten selbst — Kartennummer,
   IBAN, Prüfziffer — stehen hier NIRGENDS. Sie gehören zum Anbieter. */

/*
 * Drei Pläne.
 *
 * `max` ist nicht „Premium mit höheren Zahlen", sondern ein anderer
 * Umgang: Monday beobachtet dort laufend, vergleicht Stellen und begleitet
 * Bewerbungen. Deshalb steht er als eigener Wert und nicht als Merkmal
 * an einem Premium-Abo.
 */
export const planKeyEnum = pgEnum("plan_key", ["free", "premium", "max"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "trialing", "past_due", "canceled", "incomplete",
]);
export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year"]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: planKeyEnum("plan").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  interval: billingIntervalEnum("interval"),
  /** Seit wann der laufende Zeitraum läuft — Grundlage jeder anteiligen Rechnung. */
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  /** Bis wann bezahlt ist. Danach fällt der Zugang von selbst auf free. */
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  /** Ende einer Testphase. Eigener Vorgang, kein Abrechnungszeitraum. */
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingCustomers = pgTable("billing_customers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerCustomerId: text("provider_customer_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** card, paypal, apple_pay, google_pay, sepa_debit, bank_transfer */
  kind: text("kind").notNull(),
  /** Nur zur Wiedererkennung: „Visa •••• 4242". Nie die volle Nummer. */
  label: text("label").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** In Cent. Beträge als Fliesskomma sind der Klassiker unter den
      Abrechnungsfehlern. */
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  pdfUrl: text("pdf_url"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
});

/* ══════════════════════════════════════════════════════════════
   Mondays Einrichtung
   ══════════════════════════════════════════════════════════════ */

/**
 * Was jemand Monday einmalig erlaubt hat.
 *
 * ── Warum eine eigene Tabelle und nicht `user_settings` ───────
 *
 * `user_settings` ist eine Sammlung von Vorlieben: Sprache, Thema,
 * Radius. Was hier steht, ist etwas anderes — eine Einwilligung mit
 * Zeitpunkt, Textfassung und Widerrufsstand. Beides in derselben
 * Zeile hiesse, dass ein Wechsel des Farbschemas dieselbe Zeile
 * anfasst wie eine Berechtigung, und dass ein `updated_at` für beides
 * steht.
 *
 * ── Warum der Kontotyp mitgespeichert wird ────────────────────
 *
 * Er liesse sich aus `memberships` ableiten. Aber die Zustimmung galt
 * dem Text, der zum damaligen Kontotyp gehörte: Ein Arbeitnehmer hat
 * etwas anderes gelesen als ein Unternehmen. Wer später eine
 * Organisation anlegt, hat den Unternehmenstext nie gesehen — und
 * genau das muss hier ablesbar bleiben.
 */
export const ninaEinrichtung = pgTable("nina_einrichtung", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** arbeitnehmer · unternehmen */
  kontotyp: text("kontotyp").notNull(),
  abgeschlossen: boolean("abgeschlossen").notNull().default(false),
  abgeschlossenAm: timestamp("abgeschlossen_am", { withTimezone: true }),

  /** sprache · text — null, solange nichts gewählt wurde. */
  bedienart: text("bedienart"),
  /**
   * nur_bestaetigte · transkript
   *
   * Die datenschutzfreundliche Fassung ist der Standard, und zwar in
   * der Spalte selbst. Stünde sie nur im Formular, entstünde bei jedem
   * Weg, der am Formular vorbeigeht, eine Zeile ohne Entscheidung —
   * und die läse sich später wie eine Zustimmung zum Mitschreiben.
   */
  sprachspeicherung: text("sprachspeicherung").notNull().default("nur_bestaetigte"),

  /** manual · observe_and_save · prepare_and_connect */
  stufe: text("stufe"),

  briefingAktiv: boolean("briefing_aktiv").notNull().default(false),
  /** taeglich · werktags · woechentlich */
  briefingRhythmus: text("briefing_rhythmus").notNull().default("werktags"),
  /** „08:00" — Ortszeit in der Zeitzone daneben. */
  briefingZeit: text("briefing_zeit").notNull().default("08:00"),
  zeitzone: text("zeitzone").notNull().default("Europe/Berlin"),
  /** in_app · email · push */
  kanaele: jsonb("kanaele").$type<string[]>().notNull().default(["in_app"]),

  /** Die Fassung des Textes, dem zugestimmt wurde. */
  textfassung: text("textfassung"),
  zugestimmtAm: timestamp("zugestimmt_am", { withTimezone: true }),
  widerrufenAm: timestamp("widerrufen_am", { withTimezone: true }),

  /**
   * Was Monday je Handlung darf.
   *
   * ── Warum hier und nicht in einer eigenen Tabelle ──────────
   *
   * `nina_einrichtung` hält bereits die Stufe (`manual` /
   * `observe_and_save` / `prepare_and_connect`) und den
   * Widerrufsstand. Eine zweite Tabelle daneben hiesse: zwei Orte,
   * an denen steht, was Monday darf — und irgendwann widersprechen sie
   * sich.
   *
   * Die Stufe bleibt die grobe Einstellung. Diese Karte ist die
   * feine: je Handlung `denied`, `ask_every_time` oder `allowed`.
   *
   * ── Die Vorbelegung ist das Entscheidende ─────────────────
   *
   * Suchen und Speichern dürfen von selbst laufen. Alles, was nach
   * aussen geht — bewerben, Nachrichten senden, Profil teilen,
   * Unternehmen kontaktieren — steht auf `ask_every_time` oder
   * `denied`, und zwar unabhängig von der Stufe. Eine Stufe, die
   * solche Handlungen freischaltet, wäre eine Einwilligung, deren
   * Umfang niemand gelesen hat.
   *
   * Fehlt ein Schlüssel, gilt `denied`. Nicht `ask_every_time`: Eine
   * unbekannte Handlung ist keine, für die eine Erlaubnis erteilt
   * wurde.
   */
  berechtigungen: jsonb("berechtigungen")
    .$type<Record<string, "denied" | "ask_every_time" | "allowed">>()
    .notNull()
    .default({
      search_jobs: "allowed",
      save_jobs: "allowed",
      prepare_application: "ask_every_time",
      send_application: "denied",
      prepare_message: "ask_every_time",
      send_message: "denied",
      share_profile: "ask_every_time",
      contact_company: "denied",
    }),

  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Was wann entschieden wurde.
 *
 * ── Warum getrennt von der Tabelle darüber ────────────────────
 *
 * Die Zeile oben sagt, was JETZT gilt. Sie wird überschrieben. Eine
 * Einwilligung, die sich überschreiben lässt, ohne dass die vorherige
 * nachweisbar bleibt, ist keine — bei einer Rückfrage liesse sich
 * nicht mehr zeigen, wann jemand was erlaubt und wann er es
 * zurückgenommen hat.
 *
 * ── Was hier NICHT hineingehört ──────────────────────────────
 *
 * Keine Audioinhalte, keine Transkripte, keine Profildaten. Nur die
 * Entscheidung selbst: was, wann, in welcher Textfassung. Ein
 * Protokoll, das Inhalte mitschreibt, wird zur zweiten Datenbank —
 * einer, die niemand beim Löschen mitdenkt.
 */
export const ninaEinrichtungProtokoll = pgTable(
  "nina_einrichtung_protokoll",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** bedienart · sprachspeicherung · stufe · briefing · kanaele · widerruf · abschluss */
    ereignis: text("ereignis").notNull(),
    vorher: text("vorher"),
    nachher: text("nachher"),
    textfassung: text("textfassung"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nina_protokoll_user_idx").on(t.userId, t.erstelltAm)],
);
