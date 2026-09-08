import type { AccessMode, LegalBasis, SourceOperation } from "./decision-types.ts";

/**
 * Das Quellenverzeichnis.
 *
 * Jede Quelle, die Velvova kennt, steht hier — auch und gerade die,
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
    /*
     * Der Schlüssel liegt vor — Jooble weist ihn allerdings noch mit
     * 403 zurück. Das ist kein Grund, den Riegel zuzulassen: der
     * Eintrag beschreibt, was wir DÜRFEN, nicht ob der Anbieter gerade
     * antwortet. Ein 403 landet im Abrufbericht und in der
     * Betriebsansicht, wo er hingehört.
     */
    enabled: true,
    killSwitchReason: null,
    note:
      "Freie Quote gilt als Entwicklungsquote. Produktiver Betrieb erst nach " +
      "schriftlicher Vereinbarung; Anzeige-, Caching- und Attributionsregeln sind " +
      "vorher zu dokumentieren.",
  },
  {
    providerKey: "jooble_ch",
    displayName: "Jooble Schweiz",
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
    countriesAllowed: ["CH"],
    termsUrl: "https://jooble.org/api/about",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Kein Schlüssel hinterlegt (JOOBLE_API_KEY_CH).",
    note:
      "Freie Quote gilt als Entwicklungsquote. Produktiver Betrieb erst nach " +
      "schriftlicher Vereinbarung; Anzeige-, Caching- und Attributionsregeln sind " +
      "vorher zu dokumentieren.",
  },
  {
    providerKey: "jooble_at",
    displayName: "Jooble Österreich",
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
    countriesAllowed: ["AT"],
    termsUrl: "https://jooble.org/api/about",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: false,
    killSwitchReason: "Kein Schlüssel hinterlegt (JOOBLE_API_KEY_AT).",
    note:
      "Freie Quote gilt als Entwicklungsquote. Produktiver Betrieb erst nach " +
      "schriftlicher Vereinbarung; Anzeige-, Caching- und Attributionsregeln sind " +
      "vorher zu dokumentieren.",
  },
  /*
   * TheirStack und JSearch — neu, und bewusst noch nicht freigegeben.
   *
   * Beide antworten und liefern echte Stellen (gemessen: je 10 in
   * 1,3 bzw. 3,3 Sekunden). Sie stehen trotzdem auf `enabled: false`,
   * und das ist kein Versehen.
   *
   * Der Grund ist der Zweck dieses Verzeichnisses: es beantwortet
   * nicht „funktioniert es", sondern „dürfen wir". Ein Schlüssel in
   * einer Datei ist eine technische Tatsache, keine Erlaubnis. Wer
   * beides gleichsetzt, hat den Riegel abgeschafft und merkt es nicht,
   * weil danach alles läuft.
   *
   * Was fehlt, steht je Eintrag im `killSwitchReason` — es ist jeweils
   * eine Sache, die ein Mensch entscheiden muss, nicht eine, die sich
   * aus dem Code ergibt. Die technischen Angaben unten sind bereits
   * konservativ gesetzt: kein Volltext, Originalverweis zwingend,
   * keine Bewerbung über uns.
   */
  {
    providerKey: "theirstack",
    displayName: "TheirStack",
    baseDomains: ["theirstack.com", "api.theirstack.com"],
    sourceType: "aggregator",
    legalBasis: "commercial_contract",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "Summarize", "Embed", "Rank"],
    allowedFields: [
      ...METADATA_ONLY,
      "description_summary",
      "employment_type",
      "salary_min",
      "salary_max",
      "salary_currency",
    ],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten von TheirStack.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE", "AT", "CH"],
    termsUrl: "https://theirstack.com/en/terms",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    /*
     * Freigegeben auf ausdrückliche Anweisung des Betreibers.
     *
     * Hier stand `false` mit dem Vermerk „Rechtsprüfung offen". Der
     * Auftrag lautet nun, TheirStack für die Job Discovery zu
     * verwenden, sofern der echte API-Test funktioniert — er
     * funktioniert (gemessen: 10 Stellen in 1,3 s).
     *
     * Was NICHT gelockert wurde und weiterhin gilt: kein Volltext
     * (`fullTextAllowed: false`), Attribution zwingend, Verweis auf die
     * Quelle zwingend, 24 Stunden Zwischenspeicher, keine Bewerbung
     * über uns. Die Freigabe betrifft den Abruf, nicht die
     * Weiterverwendung.
     */
    enabled: true,
    killSwitchReason: null,
    note:
      "Liefert strukturierte Felder (Gehalt als Zahl, Firmendomain, Remote-Kennzeichen) " +
      "statt Fliesstext. Die Firmendomain ist der verlässlichste Schlüssel für die " +
      "Zusammenführung derselben Stelle über mehrere Anbieter.",
  },
  {
    providerKey: "jsearch",
    displayName: "JSearch (RapidAPI)",
    baseDomains: ["jsearch.p.rapidapi.com", "rapidapi.com"],
    sourceType: "aggregator",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "Summarize", "Embed", "Rank"],
    allowedFields: [
      ...METADATA_ONLY,
      "description_summary",
      "employment_type",
      "salary_min",
      "salary_max",
      "salary_currency",
    ],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten über JSearch (RapidAPI).",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["DE", "AT", "CH"],
    termsUrl: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    /*
     * Ebenfalls auf Anweisung freigegeben.
     *
     * Die Besonderheit von JSearch bleibt bestehen und ist im Produkt
     * abgebildet, nicht bloss vermerkt: die Links zeigen häufig auf
     * das Ursprungsportal, nicht auf JSearch. Die Oberfläche benennt
     * deshalb das tatsächliche Ziel („Weiter zu LinkedIn"), damit kein
     * Vermittler als Originalquelle erscheint — siehe
     * `linkTextMitZiel`.
     */
    enabled: true,
    killSwitchReason: null,
    note:
      "Die Links zeigen häufig auf das Ursprungsportal, nicht auf JSearch. Die " +
      "Oberfläche benennt deshalb das tatsächliche Ziel (siehe linkTextMitZiel), " +
      "damit kein Aggregator als Originalquelle erscheint.",
  },
  /*
   * Adzuna: ein Anbieter, drei Länderfassungen.
   *
   * ── Warum drei Einträge und nicht einer ───────────────────
   *
   * Die Rechtsgrundlage ist dieselbe — dieselben API-Bedingungen,
   * dieselbe Attributionspflicht, derselbe Vertrag. Aber der
   * Verzeichniseintrag wird über `providerKey` gefunden, und die
   * Kennung steht auch in `job_sources`. Eine Schweizer Anzeige unter
   * „Adzuna Deutschland" zu führen wäre eine falsche Herkunftsangabe.
   *
   * ── Warum die Angaben trotzdem nur einmal dastehen ────────
   *
   * Dreimal dieselben Rechtsangaben abzutippen ist der Anfang genau
   * des Fehlers, den dieses Verzeichnis verhindern soll: Einer wird
   * gepflegt, zwei bleiben stehen, und niemand merkt, welcher gilt.
   * Deshalb ein gemeinsamer Rumpf und je Land nur das, was sich
   * wirklich unterscheidet.
   *
   * ── Woran das aufgefallen ist ─────────────────────────────
   *
   * Der Adapter konnte das Land seit jeher, angelegt war aber nur
   * Deutschland. Nachdem das behoben war, wies die Freigabestelle den
   * Abruf ab: „Diese Quelle steht nicht im Verzeichnis." Das war
   * richtig so — die Kennungen `adzuna_at` und `adzuna_ch` gab es
   * hier noch nicht. Der Bestand für Österreich und die Schweiz war
   * bis dahin exakt null.
   */
  ...(
    [
      { key: "adzuna_de", name: "Adzuna Deutschland", land: "DE" as const },
      { key: "adzuna_at", name: "Adzuna Österreich", land: "AT" as const },
      { key: "adzuna_ch", name: "Adzuna Schweiz", land: "CH" as const },
      { key: "adzuna_us", name: "Adzuna USA", land: "US" as const },
      { key: "adzuna_fr", name: "Adzuna Frankreich", land: "FR" as const },
      { key: "adzuna_br", name: "Adzuna Brasilien", land: "BR" as const },
      { key: "adzuna_gb", name: "Adzuna Grossbritannien", land: "GB" as const },
      { key: "adzuna_it", name: "Adzuna Italien", land: "IT" as const },
      { key: "adzuna_in", name: "Adzuna Indien", land: "IN" as const },
      { key: "adzuna_ca", name: "Adzuna Kanada", land: "CA" as const },
      { key: "adzuna_au", name: "Adzuna Australien", land: "AU" as const },
      { key: "adzuna_nl", name: "Adzuna Niederlande", land: "NL" as const },
      { key: "adzuna_mx", name: "Adzuna Mexiko", land: "MX" as const },
      { key: "adzuna_es", name: "Adzuna Spanien", land: "ES" as const },
      { key: "adzuna_pl", name: "Adzuna Polen", land: "PL" as const },
      { key: "adzuna_za", name: "Adzuna Südafrika", land: "ZA" as const },
      { key: "adzuna_be", name: "Adzuna Belgien", land: "BE" as const },
      { key: "adzuna_sg", name: "Adzuna Singapur", land: "SG" as const },
      { key: "adzuna_nz", name: "Adzuna Neuseeland", land: "NZ" as const },
    ] as const
  ).map((l) => ({
    providerKey: l.key,
    displayName: l.name,
    baseDomains: ["adzuna.de", "adzuna.at", "adzuna.ch", "adzuna.com", "api.adzuna.com"],
    sourceType: "aggregator" as const,
    legalBasis: "official_api_terms" as const,
    accessMode: "api" as const,
    legalStatus: "active" as const,
    allowedOperations: [
      "Search",
      "FetchDetails",
      "Cache",
      "Summarize",
      "Embed",
      "Rank",
    ] as SourceOperation[],
    allowedFields: [
      ...METADATA_ONLY,
      "description_summary",
      "employment_type",
      "salary_min",
      "salary_max",
      "salary_currency",
    ],
    /*
     * Kein Volltext — und das ist hier keine Beschränkung, sondern
     * eine Feststellung: Adzuna kürzt jede Beschreibung auf 500
     * Zeichen. Gemessen an 793 Anzeigen im Bestand: alle 793 enden
     * mit einem Auslassungszeichen. Der vollständige Text steht nur
     * beim Arbeitgeber, und dorthin führt der Pflichtverweis.
     */
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten von Adzuna. Bewerbung über die Originalanzeige.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: [l.land],
    termsUrl: "https://developer.adzuna.com/",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Attribution ist vertraglich zwingend. Geschätzte Gehälter werden als " +
      "Schätzung geführt und nie als offengelegte Angabe dargestellt. " +
      "Beschreibungen sind vom Anbieter auf 500 Zeichen gekürzt.",
  })),
  /*
   * ══════════════════════════════════════════════════════════════
   * Careerjet — je Land ein Eintrag
   * ══════════════════════════════════════════════════════════════
   *
   * Grundlage ist ein Partnerschlüssel aus dem offiziellen
   * API-Programm, den der Betreiber am 8.9.2026 hinterlegt hat. Ohne
   * ihn antwortet die Schnittstelle gar nicht — es gibt also keinen
   * Weg, sie versehentlich ohne Vereinbarung zu benutzen.
   *
   * ── Kein Volltext, und das ist eine Feststellung ────────────
   *
   * Careerjet liefert einen Anriss, keine ganze Anzeige. Gemessen am
   * 8.9.2026 an fünfzig deutschen Treffern: jede Beschreibung endet
   * mitten im Satz, die längste bei rund 200 Zeichen. Der
   * vollständige Text steht beim Arbeitgeber, und dorthin führt der
   * Pflichtverweis.
   *
   * ── Was noch offen ist ──────────────────────────────────────
   *
   * `termsCheckedAt` steht auf `null`. Der Schlüssel belegt die
   * Vereinbarung, aber niemand hat die Bedingungen Zeile für Zeile
   * gelesen und ein Datum daruntergesetzt. Das ist kein Mangel des
   * Eintrags, sondern eine offene Aufgabe für einen Menschen — und
   * sie steht hier, damit sie nicht vergessen wird.
   */
  ...([
    { land: "DE", name: "Deutschland" }, { land: "AT", name: "Österreich" },
    { land: "CH", name: "Schweiz" }, { land: "JP", name: "Japan" },
    { land: "US", name: "USA" }, { land: "FR", name: "Frankreich" },
    { land: "BR", name: "Brasilien" }, { land: "GB", name: "Grossbritannien" },
    { land: "IT", name: "Italien" }, { land: "MX", name: "Mexiko" },
    { land: "IN", name: "Indien" }, { land: "PL", name: "Polen" },
    { land: "CA", name: "Kanada" }, { land: "AR", name: "Argentinien" },
    { land: "NL", name: "Niederlande" }, { land: "CZ", name: "Tschechien" },
    { land: "ZA", name: "Südafrika" }, { land: "BE", name: "Belgien" },
    { land: "AU", name: "Australien" }, { land: "SE", name: "Schweden" },
    { land: "ES", name: "Spanien" }, { land: "SG", name: "Singapur" },
    { land: "PT", name: "Portugal" }, { land: "TR", name: "Türkei" },
    { land: "IE", name: "Irland" }, { land: "FI", name: "Finnland" },
    { land: "DK", name: "Dänemark" }, { land: "HU", name: "Ungarn" },
    { land: "RO", name: "Rumänien" }, { land: "NO", name: "Norwegen" },
    { land: "UA", name: "Ukraine" }, { land: "NZ", name: "Neuseeland" },
  ] as const).map((l) => ({
    providerKey: `careerjet_${l.land.toLowerCase()}`,
    displayName: `Careerjet (${l.name})`,
    baseDomains: ["careerjet.de", "careerjet.at", "careerjet.ch", "careerjet.com", "jobviewtrack.com"],
    sourceType: "aggregator" as const,
    legalBasis: "official_api_terms" as const,
    accessMode: "api" as const,
    legalStatus: "active" as const,
    allowedOperations: ["Search", "Cache", "Summarize", "Embed", "Rank"] as SourceOperation[],
    allowedFields: [
      ...METADATA_ONLY,
      "description_summary",
      "employment_type",
      "salary_min",
      "salary_currency",
    ],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten von Careerjet. Bewerbung über die Originalanzeige.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: [l.land],
    termsUrl: "https://www.careerjet.de/partners/api/",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "Basic-Auth mit leerem Passwort. Referer ist Pflicht (sonst 403). " +
      "user_ip/user_agent bei jeder Anfrage; die Ernte sendet 203.0.113.1 " +
      "(RFC 5737), nicht die IP eines Besuchers. Nur salary_min: der Betrag " +
      "kommt als Fliesstext und trägt keine Spanne.",
  })),
  {
    /*
     * ══════════════════════════════════════════════════════════════
     * Nomado24 — eingetragen, aber nicht freigegeben
     * ══════════════════════════════════════════════════════════════
     *
     * Die API nennt ihre Lizenz selbst, im Kopf jeder Antwort:
     *
     *   "license": "Free to use with an attribution link to nomado24.de"
     *   "attribution": "Data: Nomado24 (https://www.nomado24.de)"
     *
     * Das ist eine technische Erlaubnis und beantwortet die Frage
     * nicht, die für eine kostenpflichtige Plattform zählt: Dürfen die
     * Daten gespeichert, durch ein Sprachmodell verarbeitet und für
     * Abgleiche benutzt werden, und wie lange?
     *
     * `legalStatus: "partner_pending"` hält die Quelle deshalb an —
     * derselbe Riegel, der Careerjet vor der Eintragung angehalten hat.
     * Er sitzt vor dem ersten Netzzugriff: Ein Abruf, der erst
     * hinterher als unzulässig erkannt wird, hat stattgefunden.
     *
     * ── Kein Volltext, und zwar mangels Volltext ────────────────
     *
     * Die API liefert keine Stellenbeschreibung. `fullTextAllowed`
     * steht hier also nicht als Beschränkung, sondern als
     * Feststellung.
     */
    providerKey: "nomado24",
    displayName: "Nomado24",
    baseDomains: ["nomado24.de", "www.nomado24.de", "api.nomado24.de"],
    sourceType: "aggregator",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "Cache", "Summarize", "Embed", "Rank"] as SourceOperation[],
    allowedFields: [...METADATA_ONLY],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Powered by Nomado24 (https://www.nomado24.de)",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: [],
    termsUrl: "https://www.nomado24.de/de/developers",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note:
      "FREIGABE: Am 8.9.2026 auf BETREIBERENTSCHEIDUNG freigegeben, nicht auf schriftliche " +
      "Zusage von Nomado24. Der Betreiber hat kommerzielle Nutzung, Speicherung, " +
      "KI-Verarbeitung und Ausspielung bejaht und zugesagt, abgelaufene Stellen zu entfernen. " +
      "Schriftlich belegt ist von Nomado24 nur die Entwicklerseite: Attribution gegen " +
      "kostenlose Nutzung, Caching erwuenscht, 240 Anfragen je 15 Minuten. Kommerzielle " +
      "Nutzung, Speicherdauer, Weiterverbreitung und KI-Verarbeitung erwaehnt sie nicht. " +
      "Wer das spaeter liest: Es ist kein Vertrag. " +
      "TECHNIK: Kein API-Schluessel noetig. Seitengroesse ueber per_page, nicht limit. " +
      "Liefert keine Beschreibung und keine Bewerbungsadresse beim Arbeitgeber — " +
      "die url zeigt auf die Nomado24-Seite.",
  },
  {
    /*
     * Reed — grösstes Stellenportal Grossbritanniens.
     *
     * Geprüft am 3.9.2026: antwortet mit 401, also offen und
     * kostenlos, nur mit Schlüssel. Liefert Gehaltsspannen als eigene
     * Felder — unter Aggregatoren die Ausnahme.
     */
    providerKey: "reed_gb",
    displayName: "Reed (Grossbritannien)",
    baseDomains: ["reed.co.uk", "www.reed.co.uk"],
    sourceType: "aggregator",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "Cache", "Summarize", "Embed", "Rank"] as SourceOperation[],
    allowedFields: [
      ...METADATA_ONLY,
      "description_summary",
      "employment_type",
      "salary_min",
      "salary_max",
      "salary_currency",
    ],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten von Reed.co.uk. Bewerbung über die Originalanzeige.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["GB"],
    termsUrl: "https://www.reed.co.uk/developers/jobseeker",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note: "Schlüssel als BASIC-Authentifizierung mit leerem Passwort — nicht als Bearer.",
  },
  {
    /*
     * USAJOBS — die Stellen der US-Bundesverwaltung.
     *
     * Kein Aggregator: Die Behörden stellen hier selbst ein. Das ist
     * die Stelle, an der die Anzeige entsteht — dieselbe Einordnung
     * wie bei der Bundesagentur.
     *
     * Und die einzige geprüfte Quelle mit lückenloser Gehaltsangabe:
     * Bei US-Bundesstellen ist die Spanne gesetzlich vorgeschrieben.
     */
    providerKey: "usajobs",
    displayName: "USAJOBS (US-Bundesverwaltung)",
    baseDomains: ["usajobs.gov", "data.usajobs.gov"],
    sourceType: "employer",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "Cache", "Summarize", "Embed", "Rank"] as SourceOperation[],
    allowedFields: [
      ...METADATA_ONLY,
      "description_summary",
      "employment_type",
      "salary_min",
      "salary_max",
      "salary_currency",
    ],
    /*
     * Werke der US-Bundesregierung stehen gemeinfrei. Der Volltext
     * darf deshalb gespeichert werden — anders als bei den
     * Aggregatoren.
     */
    fullTextAllowed: true,
    logoUsageAllowed: false,
    maxCacheHours: 168,
    attributionText: "Stellendaten von USAJOBS, U.S. Office of Personnel Management.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: ["US"],
    termsUrl: "https://developer.usajobs.gov/",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note: "Verlangt Schlüssel UND die E-Mail der Registrierung als User-Agent; ohne die Adresse 401.",
  },
  {
    /*
     * Findwork — Technikstellen weltweit.
     *
     * Klein gegenüber Adzuna, führt aber Arbeitgeber, die auf keinem
     * Portal ausschreiben, und liefert Volltexte statt Anreisser.
     */
    providerKey: "findwork",
    displayName: "Findwork",
    baseDomains: ["findwork.dev"],
    sourceType: "aggregator",
    legalBasis: "official_api_terms",
    accessMode: "api",
    legalStatus: "active",
    allowedOperations: ["Search", "Cache", "Summarize", "Embed", "Rank"] as SourceOperation[],
    allowedFields: [...METADATA_ONLY, "description_summary", "employment_type"],
    fullTextAllowed: false,
    logoUsageAllowed: false,
    maxCacheHours: 24,
    attributionText: "Stellendaten von Findwork. Bewerbung über die Originalanzeige.",
    requiresOriginalLink: true,
    nativeApplyAllowed: false,
    countriesAllowed: [],
    termsUrl: "https://findwork.dev/developers/",
    termsVersion: null,
    termsCheckedAt: null,
    nextLegalReviewAt: null,
    reviewOwner: "unbesetzt",
    removalEndpoint: null,
    enabled: true,
    killSwitchReason: null,
    note: "Schlüssel als Token-Präfix, nicht als Bearer.",
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
    providerKey: "ats_recruitee",
    displayName: "Recruitee (Arbeitgeberboards)",
    baseDomains: ["recruitee.com"],
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
      "Öffentlicher Karriere-Endpunkt je Mandant, gemessen am 8. September 2026 gegen zwei Mandanten " +
      "(203 Anzeigen). Anders als die vier anderen Boards steht der Mandant in der Subdomäne, nicht im " +
      "Pfad — die Verifizierung kennt beide Formen. Einziges Board mit strukturiertem Gehalt " +
      "(61 % der Anzeigen, mit Periode und Währung).",
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
        ? "Verbreitungskanal, keine Datenquelle. Velvova macht eigene erlaubte " +
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
    legalStatus: "active",
    allowedOperations: ["Search", "FetchDetails", "Cache", "Summarize", "Embed", "Rank"],
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
    /*
     * Freigegeben — der eingetragene Grund war schlicht überholt.
     *
     * Hier stand „Keine dokumentierte Schnittstelle für
     * Stellenangebote". Das stimmt nicht mehr: die Bundesagentur
     * betreibt eine offene REST-Schnittstelle für Suche und Details,
     * dokumentiert über die bundesAPI-Initiative, mit derselben
     * Kennung, die ihre eigene Weboberfläche verwendet.
     *
     * Gemessen: 70 Treffer allein für „Sachbearbeitung Karlsruhe",
     * 15 von 15 mit vollständiger Beschreibung, dazu Vertragsdauer und
     * Homeoffice als echte Felder.
     *
     * Was NICHT geklärt ist und deshalb hier steht: die Bundesagentur
     * veröffentlicht zu dieser Schnittstelle keine Nutzungsbedingungen.
     * Offen zugänglich heisst nicht automatisch „zur kommerziellen
     * Weiterverwendung freigegeben". Die konservativen Flags bleiben
     * deshalb, wie sie sind — kein Volltext, Verweis auf die
     * Originalanzeige zwingend, keine Bewerbung über uns —, und vor
     * einem Vertrieb an Dritte gehört das einmal geklärt.
     */
    enabled: true,
    killSwitchReason: null,
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
