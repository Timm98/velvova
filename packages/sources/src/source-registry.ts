import type { AccessMode, LegalBasis, SourceOperation } from "./decision-types.ts";

/**
 * Das Quellenverzeichnis.
 *
 * Jede Quelle, die Paycheck kennt, steht hier — auch und gerade die,
 * die NICHT benutzt werden dürfen. Eine Sperrliste, die nur aus dem
 * Fehlen eines Eintrags besteht, ist keine Sperrliste: sie lässt jede
 * unbekannte Domain durch.
 *
 * Die Voreinstellung für alles Unbekannte ist deshalb
 * `pending_review` — nicht „erlaubt".
 *
 * Diese Datei ist die im Code eingebaute Grundausstattung. Im Betrieb
 * liegt dasselbe in der Tabelle `source_registry`, damit ein Admin eine
 * Quelle ohne Deployment abschalten kann.
 */

export interface SourceEntry {
  providerKey: string;
  displayName: string;
  /** Domains, an denen diese Quelle erkannt wird. */
  baseDomains: string[];
  sourceType: "aggregator" | "ats" | "employer" | "taxonomy" | "platform" | "distribution";
  legalBasis: LegalBasis;
  accessMode: AccessMode;
  legalStatus: "active" | "partner_pending" | "expired" | "blocked" | "review_due";
  allowedOperations: SourceOperation[];
  /** Welche Felder überhaupt gespeichert und gezeigt werden dürfen. */
  allowedFields: string[];
  fullTextAllowed: boolean;
  logoUsageAllowed: boolean;
  maxCacheHours: number | null;
  attributionText: string | null;
  requiresOriginalLink: boolean;
  nativeApplyAllowed: boolean;
  countriesAllowed: string[];
  termsUrl: string | null;
  termsVersion: string | null;
  termsCheckedAt: string | null;
  nextLegalReviewAt: string | null;
  reviewOwner: string;
  removalEndpoint: string | null;
  enabled: boolean;
  killSwitchReason: string | null;
  /** Warum diese Quelle so eingestuft ist. Steht in der Oberfläche. */
  note: string;
}

/** Felder, die bei eingeschränkten Quellen höchstens erlaubt sind. */
const METADATA_ONLY = [
  "title",
  "company_name",
  "location_text",
  "source_url",
  "published_at",
  "provider",
];

const FULL_FIELDS = [
  ...METADATA_ONLY,
  "description_text",
  "description_summary",
  "employment_type",
  "workplace_type",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_period",
  "requirements",
  "benefits",
  "apply_url",
  "valid_through",
];

export const SOURCE_REGISTRY: SourceEntry[] = [
  // ── Tier A: lizenzierte Aggregatoren ────────────────────────
  {
    providerKey: "jooble_de",
    displayName: "Jooble Deutschland",
    baseDomains: ["jooble.org", "de.jooble.org"],
    sourceType: "aggregator",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    // Bewusst OHNE PublicDisplay des Volltexts: Jooble liefert Ausschnitte
    // fremder Anzeigen. Angezeigt werden Metadaten und der Originallink.
    allowedOperations: ["Search", "FetchDetails", "Cache", "Summarize", "Embed", "Rank"],
    allowedFields: [...METADATA_ONLY, "description_summary", "employment_type", "salary_min", "salary_max"],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten über Jooble. Bewerbung über die Originalquelle.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE"],
    termsUrl: "https://jooble.org/api/about",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Kein Schlüssel hinterlegt (JOOBLE_API_KEY_DE).",
    note:
      "Freie Quote gilt als Entwicklungsquote. Produktiver Betrieb erst nach " +
      "schriftlicher Vereinbarung; Anzeige-, Caching- und Attributionsregeln sind " +
      "vorher zu dokumentieren.",
  },
  {
    providerKey: "adzuna_de",
    displayName: "Adzuna Deutschland",
    baseDomains: ["adzuna.de", "adzuna.com", "api.adzuna.com"],
    sourceType: "aggregator",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "Summarize", "Embed", "Rank"],
    allowedFields: [...METADATA_ONLY, "description_summary", "employment_type", "salary_min", "salary_max", "salary_currency"],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten von Adzuna. Bewerbung über die Originalanzeige.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE", "AT", "CH"],
    termsUrl: "https://developer.adzuna.com/",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Keine Zugangsdaten hinterlegt (ADZUNA_APP_ID, ADZUNA_APP_KEY).",
    note:
      "Attribution ist vertraglich zwingend. Geschätzte Gehälter werden als " +
      "Schätzung geführt und nie als offengelegte Angabe dargestellt.",
  },
  /*
   * Arbeitgeberboards (§4.5 bis 4.8).
   *
   * Vier Einträge, ein Muster: das ist **ein Board pro Arbeitgeber**,
   * kein globaler Feed. Diese Anbieter betreiben kein durchsuchbares
   * Gesamtverzeichnis ihrer Kunden, und es wäre auch keines, wenn man
   * ihre Kundenliste durchprobierte.
   *
   * Genau darin liegt die Versuchung: die Endpunkte antworten jedem,
   * der den Firmennamen errät. Ein Skript, das Namen durchprobiert,
   * baut aus Arbeitgeberboards ein Verzeichnis, das der Anbieter nie
   * angeboten hat. Deshalb steht die Rechtsgrundlage hier auf
   * `employer_authorization` und nicht auf `official_api_terms`: die
   * Erlaubnis kommt vom Arbeitgeber, nicht vom ATS.
   *
   * `enabled: true` bedeutet hier nicht "ruft ab". Ohne registrierte,
   * autorisierte Boards fragt der Adapter niemanden — die Freigabe
   * gilt der Quellenart, die Autorisierung dem einzelnen Arbeitgeber.
   */
  {
    providerKey: "ats_greenhouse",
    displayName: "Greenhouse (Arbeitgeberboards)",
    baseDomains: ["boards.greenhouse.io", "boards-api.greenhouse.io", "job-boards.greenhouse.io"],
    sourceType: "ats",
    legalBasis: "employer_authorization",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "PublicDisplay", "Summarize", "Embed", "Rank"],
    allowedFields: FULL_FIELDS,
    fullTextAllowed: true,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Direkt vom Arbeitgeber veröffentlicht.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE", "AT", "CH", "EU"],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Veröffentlichte Stellen eines einzelnen Arbeitgeberboards. Kein globaler Feed: der Board-Bezeichner kommt aus einer Registrierung mit verifizierter Domäne, nie aus einer Suche.",
  },
  {
    providerKey: "ats_lever",
    displayName: "Lever (Arbeitgeberboards)",
    baseDomains: ["jobs.lever.co", "api.lever.co"],
    sourceType: "ats",
    legalBasis: "employer_authorization",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "PublicDisplay", "Summarize", "Embed", "Rank"],
    allowedFields: FULL_FIELDS,
    fullTextAllowed: true,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Direkt vom Arbeitgeber veröffentlicht.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE", "AT", "CH", "EU"],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Public Postings je Site. Der Endpunkt antwortet jedem, der den Firmennamen errät — deshalb kommt er hier ausschliesslich aus einer hinterlegten Autorisierung.",
  },
  {
    providerKey: "ats_ashby",
    displayName: "Ashby (Arbeitgeberboards)",
    baseDomains: ["jobs.ashbyhq.com", "api.ashbyhq.com"],
    sourceType: "ats",
    legalBasis: "employer_authorization",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "PublicDisplay", "Summarize", "Embed", "Rank"],
    allowedFields: FULL_FIELDS,
    fullTextAllowed: true,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Direkt vom Arbeitgeber veröffentlicht.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE", "AT", "CH", "EU"],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Veröffentlichte Stellen je Job Board. Gehaltsangaben nur, soweit der Arbeitgeber sie selbst veröffentlicht hat.",
  },
  {
    providerKey: "ats_smartrecruiters",
    displayName: "SmartRecruiters (Arbeitgeberboards)",
    baseDomains: ["jobs.smartrecruiters.com", "api.smartrecruiters.com"],
    sourceType: "ats",
    legalBasis: "employer_authorization",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "PublicDisplay", "Summarize", "Embed", "Rank"],
    allowedFields: FULL_FIELDS,
    fullTextAllowed: true,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Direkt vom Arbeitgeber veröffentlicht.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE", "AT", "CH", "EU"],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Aktive Veröffentlichungen je Unternehmen. Die Listenantwort trägt keinen Volltext; die Beschreibung bleibt leer statt erfunden.",
  },
  {
    providerKey: "arbeitnow",
    displayName: "Arbeitnow",
    baseDomains: ["arbeitnow.com", "www.arbeitnow.com"],
    sourceType: "aggregator",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "PublicDisplay", "Summarize", "Embed", "Rank"],
    allowedFields: FULL_FIELDS,
    fullTextAllowed: true,
    logoUsageAllowed: false,
    maxCacheHours: 72,
    attributionText: "Stellenanzeige über Arbeitnow. Bewerbung direkt beim Unternehmen.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE"],
    termsUrl: "https://www.arbeitnow.com/terms",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Die Quelle bietet ihre Anzeigen selbst offen zum Abruf an — ohne Schlüssel, " +
      "ohne Anmeldung, ohne umgangenen Zugriffsschutz.",
  },
  {
    providerKey: "lightcast_global",
    displayName: "Lightcast",
    baseDomains: ["lightcast.io", "emsiservices.com"],
    sourceType: "aggregator",
    legalBasis: "commercial_contract",
    accessMode: "api",
    legalStatus: "partner_pending",
    allowedOperations: [],
    allowedFields: [],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: null,
    attributionText: null,
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: [],
    termsUrl: "https://docs.lightcast.dev/",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Kein Vertrag, keine Zugangsdaten.",
    note:
      "Welche Felder weiterveröffentlicht werden dürfen, ergibt sich aus dem " +
      "Vertrag. Ohne Vertrag wird nichts angenommen und nichts abgerufen.",
  },

  // ── Nicht freigegebene Plattformen ──────────────────────────
  // Sie stehen hier, damit ihre Domains erkannt und BLOCKIERT werden.
  // Ein fehlender Eintrag wäre keine Sperre, sondern eine Lücke.
  ...(
    [
      ["linkedin", "LinkedIn", ["linkedin.com", "de.linkedin.com"]],
      ["indeed", "Indeed", ["indeed.com", "de.indeed.com"]],
      ["stepstone", "StepStone", ["stepstone.de", "stepstone.com"]],
      ["monster", "Monster", ["monster.de", "monster.com"]],
      ["xing", "XING", ["xing.com"]],
      ["glassdoor", "Glassdoor", ["glassdoor.com", "glassdoor.de"]],
      ["kununu", "kununu", ["kununu.com"]],
      ["google_jobs", "Google for Jobs", ["google.com", "jobs.google.com"]],
    ] as const
  ).map(([key, name, domains]): SourceEntry => ({
    providerKey: `${key}_partner_pending`,
    displayName: name,
    baseDomains: [...domains],
    sourceType: key === "google_jobs" ? "distribution" : "platform",
    legalBasis: "link_only",
    accessMode: "link_only",
    legalStatus: "partner_pending",
    // Kein Abruf, kein Zwischenspeichern, kein Einbetten, kein Ranking.
    // Was bleibt, ist ein Verweis, den eine Person selbst öffnet.
    allowedOperations: [],
    allowedFields: ["source_url"],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: null,
    attributionText: null,
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: [],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Keine schriftliche Freigabe.",
    note:
      key === "google_jobs"
        ? "Verbreitungskanal, keine Datenquelle. Paycheck macht eigene erlaubte " +
          "Seiten auffindbar; es liest keine Trefferlisten aus."
        : "Ohne schriftliche Partnerschaft: kein Abruf, keine Kopie, keine " +
          "Indexierung. Ein von der Person selbst gespeicherter Link bleibt ein " +
          "privates Lesezeichen.",
  })),

  // ── Öffentliche Stellen, Partnerkanäle ──────────────────────
  {
    providerKey: "bundesagentur",
    displayName: "Bundesagentur für Arbeit",
    baseDomains: ["arbeitsagentur.de"],
    sourceType: "platform",
    legalBasis: "government_partnership",
    accessMode: "partner",
    legalStatus: "partner_pending",
    allowedOperations: [],
    allowedFields: ["source_url"],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: null,
    attributionText: null,
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE"],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Keine dokumentierte Schnittstelle für Stellenangebote.",
    note:
      "Die Statistik-Schnittstelle ist für Arbeitsmarktdaten, nicht für einen " +
      "Stellenfeed. Beides wird getrennt behandelt.",
  },
  {
    providerKey: "eures",
    displayName: "EURES",
    baseDomains: ["europa.eu", "eures.europa.eu"],
    sourceType: "platform",
    legalBasis: "government_partnership",
    accessMode: "partner",
    legalStatus: "partner_pending",
    allowedOperations: [],
    allowedFields: ["source_url"],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: null,
    attributionText: null,
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: [],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Mitgliedschaft/Partnerschaft nicht geklärt.",
    note: "Als Partnerkanal geplant. Kein Auslesen des Portals.",
  },

  // ── Vom Nutzer selbst eingebrachte Stellen ──────────────────
  {
    providerKey: "user_private_import",
    displayName: "Von dir hinzugefügt",
    baseDomains: [],
    sourceType: "employer",
    legalBasis: "user_private_import",
    accessMode: "user_private_import",
    legalStatus: "active",
    // Kein PublicDisplay: was eine Person privat einbringt, gehört ihr
    // und nicht in einen öffentlichen Index.
    allowedOperations: ["FetchDetails", "Cache", "Summarize", "Embed", "Rank"],
    allowedFields: FULL_FIELDS,
    fullTextAllowed: true,
    logoUsageAllowed: false,
    maxCacheHours: null,
    attributionText: null,
    requiresOriginalLink: false,
    nativeApplyAllowed: false,
    countriesAllowed: [],
    termsUrl: null,
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Bleibt privat, sichtbar nur für die Person, die den Inhalt eingebracht " +
      "hat. Wandert nie in den öffentlichen Stellenindex.",
  },
];

/** Eine Quelle über ihren Schlüssel finden. */
export function findByKey(providerKey: string): SourceEntry | null {
  return SOURCE_REGISTRY.find((s) => s.providerKey === providerKey) ?? null;
}

/**
 * Eine Quelle über eine URL finden.
 *
 * Der Abgleich läuft über die registrierbare Domain und ihre
 * Unterdomains — `de.linkedin.com` muss denselben Eintrag treffen wie
 * `linkedin.com`, sonst wäre die Sperre mit einer Unterdomain zu
 * umgehen.
 */
export function findByUrl(rawUrl: string): SourceEntry | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }

  return (
    SOURCE_REGISTRY.find((entry) =>
      entry.baseDomains.some((domain) => {
        const d = domain.toLowerCase().replace(/^www\./, "");
        return host === d || host.endsWith(`.${d}`);
      }),
    ) ?? null
  );
}
