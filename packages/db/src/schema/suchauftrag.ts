import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { jobs } from "./jobs.ts";
import { jobAnalysen } from "./nina.ts";
import { projekte } from "./projekte.ts";

/**
 * „Monday sucht für dich weiter" — der Suchauftrag und alles daran.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Trennung, an der alles hängt
 * ══════════════════════════════════════════════════════════════
 *
 * Drei Dinge, die leicht zu einem Feld verschmelzen und es nicht
 * dürfen:
 *
 *   Das Karriereprofil    gilt für die Person.
 *   Der Suchauftrag       gilt für eine Suche — davon mehrere.
 *   Die Benachrichtigung  ist eine eigene Entscheidung.
 *
 * Ohne sie überschreibt eine vorübergehende Recherche das Profil, und
 * wer zwei Suchen laufen hat, bekommt zwei fast gleiche Mails.
 *
 * Siehe Migration 0082.
 */

export const suchAuftraege = pgTable(
  "such_auftraege",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /**
     * entwurf · aktiv · pausiert · beendet
     *
     * `entwurf` sucht nicht und versendet nicht. Schweigen lässt ihn
     * dort stehen — keine Reaktion aktiviert nichts.
     */
    status: text("status").notNull().default("entwurf"),
    /** einmalig · fortlaufend */
    laufzeit: text("laufzeit").notNull().default("fortlaufend"),
    endetAm: timestamp("endet_am", { withTimezone: true }),
    /** nur_app · app_und_email */
    kanal: text("kanal").notNull().default("nur_app"),
    /** taeglich · woechentlich */
    rhythmus: text("rhythmus").notNull().default("taeglich"),
    /** nur_bei_treffern · immer */
    versandbedingung: text("versandbedingung").notNull().default("nur_bei_treffern"),
    /** Ortszeit „HH:MM". Ohne Zone keine Uhrzeit — deshalb beides. */
    sendezeitLokal: text("sendezeit_lokal").notNull().default("08:00"),
    zeitzone: text("zeitzone").notNull().default("Europe/Berlin"),
    /** 1 (Montag) bis 7 — nur bei woechentlich. */
    wochentag: smallint("wochentag"),
    /** Für wen gesucht wird. „Für meinen Bruder" gehört hierher, nicht ins Profil. */
    geltungsbereich: jsonb("geltungsbereich").$type<Record<string, unknown>>().notNull().default({}),
    /** chat · voice · suchergebnisse · vorschlag */
    herkunft: text("herkunft").notNull().default("chat"),
    /**
     * Zu welchem Vorhaben diese Suche gehört.
     *
     * Der Weg zu den Stellen eines Projekts führt hierüber: Projekt →
     * Suchauftrag → `auftragTreffer` → Stellen. Eine eigene
     * Trefferkette am Projekt wäre eine zweite Rechnung derselben
     * Frage, und zwei solche Rechnungen laufen auseinander.
     *
     * Nullbar: Suchaufträge gab es vor den Projekten und soll es
     * weiter ohne geben.
     */
    projektId: uuid("projekt_id").references(() => projekte.id, { onDelete: "set null" }),
    aktiveProfilVersion: uuid("aktive_profil_version"),
    aktualisierungNoetig: boolean("aktualisierung_noetig").notNull().default(true),
    zuletztGeprueft: timestamp("zuletzt_geprueft", { withTimezone: true }),
    /** Das nächste Versandfenster, in UTC gerechnet. */
    naechsteFaelligkeit: timestamp("naechste_faelligkeit", { withTimezone: true }),
    bestaetigtAm: timestamp("bestaetigt_am", { withTimezone: true }),
    beendetAm: timestamp("beendet_am", { withTimezone: true }),
    /** endzeit · nutzer · konto_geloescht · fehlende_zustimmung */
    abschlussgrund: text("abschlussgrund"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("such_auftraege_user_idx").on(t.userId, t.status),
    index("such_auftraege_faellig_idx").on(t.status, t.naechsteFaelligkeit),
    index("such_auftraege_offen_idx").on(t.aktualisierungNoetig, t.status),
    /* Teilindex in der Migration: Aufträge ohne Projekt sind der
       häufige Fall und beantworten die Frage nicht, für die dieser
       Index da ist. */
    index("such_auftraege_projekt_idx").on(t.projektId),
  ],
);

/**
 * Eine unveränderliche Fassung des kompilierten Suchprofils.
 *
 * Ein Treffer verweist auf die Fassung, mit der er berechnet wurde.
 * Änderte sie sich nachträglich, stünde in der Mail eine Begründung,
 * die zu keiner gespeicherten Angabe passt.
 */
export const suchProfile = pgTable(
  "such_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auftragId: uuid("auftrag_id").notNull().references(() => suchAuftraege.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** entwurf · aktiv · ersetzt · verworfen */
    zustand: text("zustand").notNull().default("entwurf"),
    /** Was das Modell vorgeschlagen hat, unverändert — der Nachweis,
     *  dass das Backend und nicht das Modell entschieden hat. */
    vorschlag: jsonb("vorschlag").$type<Record<string, unknown>>().notNull().default({}),
    konflikte: jsonb("konflikte").$type<unknown[]>().notNull().default([]),
    offenePunkte: jsonb("offene_punkte").$type<unknown[]>().notNull().default([]),
    rueckfrage: text("rueckfrage"),
    bestaetigungstext: text("bestaetigungstext"),
    promptFassung: text("prompt_fassung").notNull().default("suchprofil-1"),
    modellkonfiguration: jsonb("modellkonfiguration").$type<Record<string, unknown>>().notNull().default({}),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktiviertAm: timestamp("aktiviert_am", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("such_profile_version_idx").on(t.auftragId, t.version),
    index("such_profile_user_idx").on(t.userId, t.zustand),
  ],
);

/**
 * Ein einzelnes Kriterium einer Profilfassung.
 *
 * ── Warum `gruppe` ────────────────────────────────────────────
 *
 * „Stuttgart oder vollständig remote" sind zwei Zeilen mit derselben
 * Gruppe. Gleiche Gruppe heisst ODER, verschiedene Gruppen heissen
 * UND. Ohne dieses Feld würden aus einer Alternative zwei gleichzeitig
 * zwingende Standortbedingungen — und die Suche fände nichts.
 *
 * ── Warum `staerke` und `bestaetigungsstatus` getrennt sind ───
 *
 * „Homeoffice wäre schön" ist ausdrücklich gesagt und trotzdem kein
 * Muss. Ein gemeinsames Feld hätte aus jedem bestätigten Wunsch einen
 * Ausschluss gemacht.
 */
export const suchKriterien = pgTable(
  "such_kriterien",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profilId: uuid("profil_id").notNull().references(() => suchProfile.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Der stabile Schlüssel, etwa „arbeitsort" oder „mindestgehalt". */
    kriterium: text("kriterium").notNull(),
    wert: jsonb("wert").notNull(),
    einheit: text("einheit"),
    /** gleich · mindestens · hoechstens · enthaelt · einer_von · nicht */
    operator: text("operator").notNull().default("gleich"),
    /** muss · wunsch · interesse */
    staerke: text("staerke").notNull().default("wunsch"),
    /** Alternativen teilen sich eine Gruppe. `null` heisst: steht für sich. */
    gruppe: text("gruppe"),
    /** auftrag · profil · befristet */
    geltungsbereich: text("geltungsbereich").notNull().default("auftrag"),
    /** nutzer_aussage · uebernommener_filter · nutzerfakt · verhalten · nina_ableitung */
    herkunft: text("herkunft").notNull(),
    signalIds: jsonb("signal_ids").$type<string[]>().notNull().default([]),
    beobachtetAm: timestamp("beobachtet_am", { withTimezone: true }),
    bestaetigtAm: timestamp("bestaetigt_am", { withTimezone: true }),
    /** bestaetigt · offen · abgelehnt */
    bestaetigungsstatus: text("bestaetigungsstatus").notNull().default("offen"),
    gueltigBis: timestamp("gueltig_bis", { withTimezone: true }),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("such_kriterien_profil_idx").on(t.profilId, t.staerke),
    index("such_kriterien_user_idx").on(t.userId),
  ],
);

/**
 * Neue Signale, aus denen ein Profil kompiliert wird.
 *
 * Täglich alle bisherigen Gespräche erneut auszuwerten kostet bei
 * jedem Lauf dasselbe Geld und liefert dasselbe Ergebnis. Hier steht,
 * was seit dem letzten Profilstand hinzukam.
 */
export const profilSignale = pgTable(
  "profil_signale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    auftragId: uuid("auftrag_id").references(() => suchAuftraege.id, { onDelete: "cascade" }),
    /** Dieselbe Nachricht darf nicht zweimal zu einem Signal werden. */
    ereignisSchluessel: text("ereignis_schluessel").notNull(),
    /** nachricht · filter_uebernommen · gespeichert · abgelehnt · beworben ·
     *  einstellung · auftrag_geaendert */
    art: text("art").notNull(),
    inhalt: jsonb("inhalt").$type<Record<string, unknown>>().notNull().default({}),
    /** chat · voice · ui_filter · feedback · einstellungen */
    quelle: text("quelle").notNull(),
    nachrichtId: uuid("nachricht_id"),
    /** Ausdrücklich gesagt oder beobachtet. Beobachtetes darf kein Muss erzeugen. */
    ausdruecklich: boolean("ausdruecklich").notNull().default(false),
    beobachtetAm: timestamp("beobachtet_am", { withTimezone: true }).notNull().defaultNow(),
    verarbeitetAm: timestamp("verarbeitet_am", { withTimezone: true }),
    verfaelltAm: timestamp("verfaellt_am", { withTimezone: true }),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profil_signale_ereignis_idx").on(t.userId, t.ereignisSchluessel),
    index("profil_signale_offen_idx").on(t.userId, t.verarbeitetAm),
  ],
);

/**
 * Wohin Benachrichtigungen gehen — und ob überhaupt.
 *
 * Getrennt von `users.email`: Eine verifizierte Anmeldeadresse ist
 * kein Einverständnis mit Jobmails.
 */
export const benachrichtigungEinstellungen = pgTable("benachrichtigung_einstellungen", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailAktiv: boolean("email_aktiv").notNull().default(false),
  emailAdresse: text("email_adresse"),
  /** Der Nachweis des Double-Opt-in. Ohne ihn geht nichts hinaus. */
  adresseBestaetigtAm: timestamp("adresse_bestaetigt_am", { withTimezone: true }),
  doiTokenHash: text("doi_token_hash"),
  doiGesendetAm: timestamp("doi_gesendet_am", { withTimezone: true }),
  zeitzone: text("zeitzone").notNull().default("Europe/Berlin"),
  sendezeitLokal: text("sendezeit_lokal").notNull().default("08:00"),
  pausiertBis: timestamp("pausiert_bis", { withTimezone: true }),
  zuletztAktivAm: timestamp("zuletzt_aktiv_am", { withTimezone: true }),
  hinweisFassung: text("hinweis_fassung"),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Ein persönlicher Treffer: diese Stelle, für diesen Auftrag, mit
 * dieser Profilfassung, nach dieser Regelfassung.
 *
 * Die Zahlen kommen aus demselben Matchingservice wie die normale
 * Suche. Es gibt hier keine zweite Gewichtung und keinen nächtlichen
 * Sonderscore.
 */
export const auftragTreffer = pgTable(
  "auftrag_treffer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    auftragId: uuid("auftrag_id").notNull().references(() => suchAuftraege.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    /** Dieselbe Stelle über mehrere Portale; bei einer Einzelstelle sie selbst. */
    kanonischeJobId: uuid("kanonische_job_id").notNull(),
    profilId: uuid("profil_id").notNull().references(() => suchProfile.id, { onDelete: "cascade" }),
    analyseId: uuid("analyse_id").references(() => jobAnalysen.id, { onDelete: "set null" }),
    analyseFassung: integer("analyse_fassung"),
    matchingFassung: text("matching_fassung").notNull(),
    karriereprofilStand: timestamp("karriereprofil_stand", { withTimezone: true }),
    /** `null`, wenn das Profil zu dünn ist. Eine erfundene Zahl wäre schlimmer. */
    fitScore: integer("fit_score"),
    fitAbdeckung: doublePrecision("fit_abdeckung"),
    /**
     * eligible · ineligible · needs_clarification
     *
     * Eine unbekannte Muss-Angabe ist nicht erfüllt und nicht
     * verletzt. Sie zu „erfüllt" zu runden ist der Fehler, den der
     * Auftrag ausdrücklich verbietet.
     */
    zulaessigkeit: text("zulaessigkeit").notNull().default("needs_clarification"),
    /** empfohlen · zurueckgestellt · ausgeschlossen */
    empfehlungsstatus: text("empfehlungsstatus").notNull().default("zurueckgestellt"),
    empfehlungsgruende: jsonb("empfehlungsgruende").$type<string[]>().notNull().default([]),
    kriterienErgebnisse: jsonb("kriterien_ergebnisse").$type<unknown[]>().notNull().default([]),
    gruende: jsonb("gruende").$type<string[]>().notNull().default([]),
    offenePunkte: jsonb("offene_punkte").$type<string[]>().notNull().default([]),
    caveat: text("caveat"),
    /** Fingerabdruck der Angaben, die eine erneute Mail rechtfertigen. */
    materielleFassung: text("materielle_fassung").notNull(),
    /** offen · ausgewaehlt · benachrichtigt · verfallen · ungueltig */
    zustand: text("zustand").notNull().default("offen"),
    ungueltigGrund: text("ungueltig_grund"),
    berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
    verfaelltAm: timestamp("verfaellt_am", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("auftrag_treffer_unique").on(t.auftragId, t.jobId),
    index("auftrag_treffer_auswahl_idx").on(t.auftragId, t.zustand, t.empfehlungsstatus),
    index("auftrag_treffer_user_idx").on(t.userId, t.zustand),
  ],
);

/**
 * Was dieser Person zu welcher Stelle schon gemeldet wurde.
 *
 * Nutzerweit, nicht je Auftrag: Wer zwei Suchen laufen hat, soll
 * dieselbe Stelle nicht zweimal als Entdeckung bekommen.
 */
export const jobBenachrichtigungen = pgTable(
  "job_benachrichtigungen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kanonischeJobId: uuid("kanonische_job_id").notNull(),
    /** Nur eine Änderung daran rechtfertigt eine zweite Meldung. */
    materielleFassung: text("materielle_fassung").notNull(),
    anzahl: integer("anzahl").notNull().default(1),
    zuerstAm: timestamp("zuerst_am", { withTimezone: true }).notNull().defaultNow(),
    zuletztAm: timestamp("zuletzt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("job_benachrichtigungen_unique").on(t.userId, t.kanonischeJobId)],
);

/**
 * Die Zusammenfassung eines Versandfensters.
 *
 * Der Fensterschlüssel ist stabil aus Person, lokalem Datum und
 * Rhythmus gebildet. Die Eindeutigkeit steht in der Datenbank und
 * nicht in der Hoffnung, dass der Scheduler sich benimmt.
 */
export const zusammenfassungen = pgTable(
  "zusammenfassungen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fensterschluessel: text("fensterschluessel").notNull(),
    fensterBeginn: timestamp("fenster_beginn", { withTimezone: true }).notNull(),
    /** entwurf · freigegeben · versendet · uebersprungen */
    zustand: text("zustand").notNull().default("entwurf"),
    /** keine_treffer · keine_zustimmung · unterdrueckt · budget · anbieter_fehlt */
    uebersprungenGrund: text("uebersprungen_grund"),
    /** „Bestätigter Suchauftrag vom …" — serverseitig erzeugt. */
    basisLabel: text("basis_label"),
    betreff: text("betreff"),
    einleitung: text("einleitung"),
    abschluss: text("abschluss"),
    textFassung: text("text_fassung").notNull().default("zusammenfassung-1"),
    modell: jsonb("modell").$type<Record<string, unknown>>().notNull().default({}),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    freigegebenAm: timestamp("freigegeben_am", { withTimezone: true }),
  },
  (t) => [uniqueIndex("zusammenfassungen_fenster_idx").on(t.userId, t.fensterschluessel)],
);

export const zusammenfassungPosten = pgTable(
  "zusammenfassung_posten",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    zusammenfassungId: uuid("zusammenfassung_id").notNull().references(() => zusammenfassungen.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    trefferId: uuid("treffer_id").notNull().references(() => auftragTreffer.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    kanonischeJobId: uuid("kanonische_job_id").notNull(),
    materielleFassung: text("materielle_fassung").notNull(),
    grund: text("grund"),
    caveat: text("caveat"),
    /** neu · aktualisierung */
    art: text("art").notNull().default("neu"),
    position: smallint("position").notNull().default(0),
  },
  (t) => [uniqueIndex("zusammenfassung_posten_unique").on(t.zusammenfassungId, t.kanonischeJobId)],
);

/**
 * Der Versandausgang.
 *
 * `accepted` heisst: Der Anbieter hat sie angenommen. Nicht: sie liegt
 * im Postfach. Das sind zwei verschiedene Aussagen, und nur eine davon
 * können wir belegen.
 */
export const mailAusgang = pgTable(
  "mail_ausgang",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    zusammenfassungId: uuid("zusammenfassung_id").references(() => zusammenfassungen.id, { onDelete: "set null" }),
    /** Bleibt über Wiederholungen gleich. Ein neuer Schlüssel wäre eine zweite Mail. */
    idempotenzSchluessel: text("idempotenz_schluessel").notNull(),
    an: text("an").notNull(),
    betreff: text("betreff").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    /**
     * Die Abmeldeadresse dieser Mail.
     *
     * Steht getrennt, weil `List-Unsubscribe` sie als Kopfzeile
     * braucht — und weil sie sich nicht rekonstruieren lässt: Das
     * Token ist zufällig und nur als Hash gespeichert.
     */
    abmeldeUrl: text("abmelde_url"),
    /** queued · sending · accepted · delivered · failed · suppressed · unknown */
    zustand: text("zustand").notNull().default("queued"),
    anbieter: text("anbieter"),
    anbieterId: text("anbieter_id"),
    versuche: smallint("versuche").notNull().default(0),
    naechsterVersuch: timestamp("naechster_versuch", { withTimezone: true }),
    fehler: text("fehler"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    gesendetAm: timestamp("gesendet_am", { withTimezone: true }),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mail_ausgang_idempotenz_idx").on(t.idempotenzSchluessel),
    index("mail_ausgang_offen_idx").on(t.zustand, t.naechsterVersuch),
  ],
);

export const zustellEreignisse = pgTable(
  "zustell_ereignisse",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ausgangId: uuid("ausgang_id").references(() => mailAusgang.id, { onDelete: "cascade" }),
    /** Webhooks kommen doppelt und verspätet. Ohne diese Kennung
     *  liesse sich ein Ereignis nicht zweimal erkennen. */
    anbieterEreignisId: text("anbieter_ereignis_id"),
    art: text("art").notNull(),
    nutzlast: jsonb("nutzlast").$type<Record<string, unknown>>().notNull().default({}),
    ereignisAm: timestamp("ereignis_am", { withTimezone: true }),
    empfangenAm: timestamp("empfangen_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("zustell_ereignisse_anbieter_idx").on(t.anbieterEreignisId)],
);

/**
 * Adressen, an die nichts mehr geht.
 *
 * Ohne Nutzerbezug: Eine Adresse, die hart abprallt, bleibt gesperrt,
 * auch wenn sie später zu einem anderen Konto gehört.
 */
export const unterdrueckungen = pgTable("unterdrueckungen", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  /** hard_bounce · beschwerde · abgemeldet · manuell */
  grund: text("grund").notNull(),
  quelle: text("quelle"),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Abmeldung ohne Anmeldung.
 *
 * Das Token erlaubt genau eine Sache. Es ist kein Login und öffnet
 * keine Profilansicht. Gespeichert wird nur der Hash.
 */
export const abmeldeToken = pgTable(
  "abmelde_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    /** abmelden · bestaetigen */
    zweck: text("zweck").notNull().default("abmelden"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    verwendetAm: timestamp("verwendet_am", { withTimezone: true }),
    gueltigBis: timestamp("gueltig_bis", { withTimezone: true }),
  },
  (t) => [uniqueIndex("abmelde_token_hash_idx").on(t.tokenHash)],
);

/**
 * Wo ein Auftrag stehengeblieben ist.
 *
 * Nicht `created_at > last_digest_at`: Eine Stelle wird gestern
 * importiert und heute analysiert — und fällt aus jedem Zeitfenster,
 * das am Importdatum hängt.
 */
export const verarbeitungsFortschritt = pgTable(
  "verarbeitungs_fortschritt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auftragId: uuid("auftrag_id").notNull().references(() => suchAuftraege.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** profil · suche · matching · zusammenfassung */
    art: text("art").notNull(),
    stand: jsonb("stand").$type<Record<string, unknown>>().notNull().default({}),
    /** Bis zu welchem Analysezeitpunkt gearbeitet wurde. */
    analyseBis: timestamp("analyse_bis", { withTimezone: true }),
    letzterLauf: timestamp("letzter_lauf", { withTimezone: true }),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("verarbeitungs_fortschritt_unique").on(t.auftragId, t.art)],
);


/* ═══════════════════════════════════════════════════════════════
   Einbettungen
   ═══════════════════════════════════════════════════════════════ */

/**
 * Der Vektor einer Stelle.
 *
 * ── Warum jsonb und nicht pgvector ────────────────────────────
 *
 * `vector` ist in dieser Instanz verfügbar und nicht installiert. Der
 * Kandidatenpool sind analysierte Stellen; über ein paar tausend
 * Vektoren rechnet der Prozess in Millisekunden. Eine Erweiterung in
 * der Produktionsdatenbank kostet dauerhaft Betrieb und liesse sich
 * in der Testumgebung nicht nachbauen.
 *
 * Der Zeitpunkt für den Wechsel ist messbar: wenn die Auswahlrunde
 * länger dauert als der Modellaufruf danach.
 *
 * ── Warum Modell und Dimensionen dabeistehen ──────────────────
 *
 * Zwei Vektoren verschiedener Modelle sind nicht vergleichbar, und
 * die Kosinusrechnung sagt trotzdem eine Zahl.
 */
export const jobEinbettungen = pgTable(
  "job_einbettungen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    /** Fingerabdruck des eingebetteten Textes — ändert er sich nicht, bleibt der Vektor. */
    textSchluessel: text("text_schluessel").notNull(),
    modell: text("modell").notNull(),
    dimensionen: integer("dimensionen").notNull(),
    vektor: jsonb("vektor").$type<number[]>().notNull(),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("job_einbettungen_unique").on(t.jobId, t.modell),
    index("job_einbettungen_modell_idx").on(t.modell, t.erstelltAm),
  ],
);

/**
 * Der Vektor einer Person, je Suchauftrag.
 *
 * Er entsteht aus gewünschten Tätigkeiten, bestätigten Fähigkeiten,
 * Berufsfeldern und weichen Vorlieben — nicht aus Gesprächsverläufen.
 * Ein Vektor geht an einen Anbieter, wird gespeichert und lässt sich
 * nicht zurücknehmen; man sieht ihm nicht an, was in ihm steckt.
 */
export const profilEinbettungen = pgTable(
  "profil_einbettungen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    auftragId: uuid("auftrag_id").references(() => suchAuftraege.id, { onDelete: "cascade" }),
    textSchluessel: text("text_schluessel").notNull(),
    modell: text("modell").notNull(),
    dimensionen: integer("dimensionen").notNull(),
    vektor: jsonb("vektor").$type<number[]>().notNull(),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * ══════════════════════════════════════════════════════════════
 * Der Nachtlauf — als Sache, die man ansehen kann
 * ══════════════════════════════════════════════════════════════
 *
 * `durchlaufAusfuehren` rechnet jede Nacht: Kandidaten, Muss-Prüfung,
 * semantische Runde, Belege, Treffer. Die Zahlen gingen bisher als
 * Rückgabewert an den Zeitplan-Aufruf und starben dort.
 *
 * Damit fehlte dem Produkt sein Morgenmoment. „Ich habe heute Nacht
 * 143 Stellen geprüft, 61 erfüllten deine Mindestanforderungen" lässt
 * sich ohne festgehaltene Zahlen nicht sagen, ohne zu erfinden.
 *
 * ── Warum das nichts nachrechnet ──────────────────────────────
 *
 * Diese Zeile hält fest, was `auftragslaufRunde` ohnehin zurückgibt.
 * Eine zweite Rechnung neben der laufenden liefe auseinander, und dann
 * stünde im Bericht eine andere Zahl als in der Trefferliste.
 *
 * Siehe Migration 0108.
 */
export const nachtLaeufe = pgTable(
  "nacht_laeufe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    auftragId: uuid("auftrag_id").notNull().references(() => suchAuftraege.id, { onDelete: "cascade" }),
    /** Stabil aus Person, lokalem Datum und Auftrag — wie `fensterschluessel`. */
    nachtSchluessel: text("nacht_schluessel").notNull(),
    /** Die Phasen stehen in `nachtlauf.ts`, nicht als enum. */
    phase: text("phase").notNull().default("ruhe"),

    /* ── Gezählt, nicht geschätzt ── */
    gefunden: integer("gefunden").notNull().default(0),
    nachFiltern: integer("nach_filtern").notNull().default(0),
    geprueft: integer("geprueft").notNull().default(0),
    empfohlen: integer("empfohlen").notNull().default(0),
    zurueckgestellt: integer("zurueckgestellt").notNull().default(0),
    ausgeschlossen: integer("ausgeschlossen").notNull().default(0),
    stilleChancen: integer("stille_chancen").notNull().default(0),

    /** Quellen, die nicht antworteten. Gehört in den Bericht, auch wenn er kleiner aussieht. */
    quellenFehler: jsonb("quellen_fehler").$type<string[]>().notNull().default([]),
    /** kein_aktives_profil · keine_kriterien · keine_kandidaten · fehler */
    grund: text("grund"),

    begonnenAm: timestamp("begonnen_am", { withTimezone: true }).notNull().defaultNow(),
    beendetAm: timestamp("beendet_am", { withTimezone: true }),
    /** Ein Bericht, den niemand geöffnet hat, ist kein zugestellter Bericht. */
    gesehenAm: timestamp("gesehen_am", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("nacht_laeufe_schluessel_idx").on(t.userId, t.auftragId, t.nachtSchluessel),
    index("nacht_laeufe_user_idx").on(t.userId, t.begonnenAm),
  ],
);
