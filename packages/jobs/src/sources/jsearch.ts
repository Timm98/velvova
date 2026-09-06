import type { Herkunft } from "@paycheck/domain";
import {
  DEFAULT_CAPABILITIES,
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { envWert, holJson } from "../net.ts";

/**
 * JSearch über RapidAPI.
 *
 * Eine Sammelstelle: JSearch führt Anzeigen aus vielen Portalen
 * zusammen. Das ist der Grund, warum die Herkunft hier ausdrücklich
 * `aggregator` ist und die Oberfläche „Weiter zu JSearch" schreibt statt
 * „Original ansehen" — wir wissen bei einer JSearch-Anzeige nicht, wo
 * der Arbeitgeber sie ursprünglich veröffentlicht hat.
 *
 * Was JSearch gut liefert: Titel, Arbeitgeber, Ort, Beschreibung,
 * Bewerbungslink, Veröffentlichungsdatum, oft ein Ablaufdatum und in
 * einem Teil der Fälle eine Gehaltsspanne mit Zeitraum. Dazu
 * `job_highlights` mit getrennten Listen für Anforderungen, Aufgaben
 * und Leistungen — strukturiert, statt aus Fliesstext geraten.
 *
 * Was es nicht liefert: eine Zusicherung, dass die Anzeige noch gilt.
 */

interface JSearchAntwort {
  status?: string;
  error?: { message?: string };
  data?: JSearchStelle[];
}

interface JSearchStelle {
  job_id?: string;
  employer_name?: string;
  employer_website?: string | null;
  job_title?: string;
  job_description?: string;
  job_apply_link?: string;
  job_publisher?: string;
  job_employment_type?: string;
  job_is_remote?: boolean;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_posted_at_datetime_utc?: string | null;
  job_offer_expiration_datetime_utc?: string | null;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
  job_highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
    Benefits?: string[];
  };
  apply_options?: { publisher?: string; apply_link?: string; is_direct?: boolean }[];
}

export interface JSearchOptions {
  apiKey?: string;
  host?: string;
  /** Suchbegriffe. Ohne sie fragt der Adapter nichts ab. */
  abfragen?: string[];
  land?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Standardsuchen, wenn niemand etwas anderes verlangt.
 *
 * Bewusst breit und deutschsprachig: JSearch braucht einen Suchbegriff,
 * eine leere Anfrage gibt es nicht. Diese Liste ist der Ausgangsbestand
 * für den Bestandsabruf; die Suche einer einzelnen Person läuft über
 * `abfragen`.
 */
const STANDARDSUCHEN = [
  "Kundenbetreuung Deutschland",
  "Sachbearbeitung Deutschland",
  "Disposition Logistik Deutschland",
  "Vertrieb Innendienst Deutschland",
  "Büromanagement Deutschland",
];

export class JSearchAdapter implements JobSourceAdapter {
  readonly key = "jsearch";
  readonly displayName = "JSearch";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "aggregator";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten über JSearch (RapidAPI).";
  readonly termsUrl = "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch";

  private readonly apiKey?: string;
  private readonly host: string;
  private readonly abfragen: string[];
  private readonly land: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(o: JSearchOptions = {}) {
    this.apiKey = o.apiKey ?? envWert("RAPIDAPI_KEY");
    this.host = o.host ?? envWert("RAPIDAPI_HOST") ?? "jsearch.p.rapidapi.com";
    this.abfragen = o.abfragen ?? STANDARDSUCHEN;
    this.land = (o.land ?? "de").toLowerCase();
    this.fetchImpl = o.fetchImpl;
  }

  readonly capabilities: ProviderCapabilities = {
    ...DEFAULT_CAPABILITIES,
    search: true,
    details: true,
    /*
     * `date_posted` kennt nur Stufen (today, 3days, week, month), kein
     * Datum. Das ist kein „seit X" — deshalb hier `false`. Ein Filter,
     * der so tut, als könnte er mehr, holt bei jedem Lauf zu viel oder
     * zu wenig, und niemand merkt es.
     */
    since: false,
    maxPerRequest: 10,
    rateLimitPerMinute: null,
    salary: true,
    expiry: true,
    structuredRequirements: true,
  };

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error("JSearch ist nicht eingerichtet: RAPIDAPI_KEY fehlt. Es wird nichts abgerufen.");
    }

    const proSuche = Math.max(1, Math.ceil((options.limit ?? 50) / this.abfragen.length));
    const seiten = Math.min(3, Math.ceil(proSuche / 10));
    const gesammelt: RawListing[] = [];
    const gesehen = new Set<string>();

    for (const abfrage of this.abfragen) {
      const url = new URL(`https://${this.host}/search`);
      url.searchParams.set("query", abfrage);
      url.searchParams.set("page", "1");
      url.searchParams.set("num_pages", String(seiten));
      url.searchParams.set("country", this.land);
      if (options.since) url.searchParams.set("date_posted", stufe(options.since));

      const antwort = await holJson<JSearchAntwort>({
        provider: "JSearch",
        url: url.toString(),
        headers: {
          "X-RapidAPI-Key": this.apiKey!,
          "X-RapidAPI-Host": this.host,
        },
        signal: options.signal,
        fetchImpl: this.fetchImpl,
      });

      for (const s of antwort.data ?? []) {
        const roh = zuRawListing(s);
        if (!roh || gesehen.has(roh.externalId)) continue;
        gesehen.add(roh.externalId);
        gesammelt.push(roh);
      }

      if (options.limit && gesammelt.length >= options.limit) break;
    }

    return options.limit ? gesammelt.slice(0, options.limit) : gesammelt;
  }
}

/** Die gröbste passende Stufe. JSearch kennt kein echtes Datum. */
function stufe(seit: Date): string {
  const tage = (Date.now() - seit.getTime()) / 86_400_000;
  if (tage <= 1) return "today";
  if (tage <= 3) return "3days";
  if (tage <= 7) return "week";
  return "month";
}

export function zuRawListing(s: JSearchStelle): RawListing | null {
  /*
   * Ohne Kennung, Titel oder Arbeitgeber ist der Datensatz unbrauchbar.
   *
   * Nicht mit Platzhaltern auffüllen: eine Stelle „bei Unbekannt" ist
   * keine Stelle, sondern eine Zeile, die eine Bewerbung unmöglich
   * macht und trotzdem einen Platz in der Liste belegt.
   */
  if (!s.job_id || !s.job_title || !s.employer_name) return null;

  const ort = [s.job_city, s.job_state].filter(Boolean).join(", ");

  /*
   * Anforderungen und Aufgaben getrennt übernehmen.
   *
   * JSearch liefert sie als eigene Listen. Sie in die Beschreibung zu
   * werfen und danach mit einem Muster wieder herauszuziehen, wäre ein
   * Rückschritt hinter die Daten, die schon strukturiert vorliegen.
   */
  const h = s.job_highlights ?? {};
  const beschreibung = [
    s.job_description?.trim() ?? "",
    h.Responsibilities?.length ? `\n\nAufgaben:\n${h.Responsibilities.map((z) => `- ${z}`).join("\n")}` : "",
    h.Qualifications?.length ? `\n\nAnforderungen:\n${h.Qualifications.map((z) => `- ${z}`).join("\n")}` : "",
  ].join("");

  if (beschreibung.trim().length < 40) return null;

  return {
    externalId: s.job_id,
    title: s.job_title.trim(),
    companyName: s.employer_name.trim(),
    location: ort || (s.job_country ?? "Deutschland"),
    country: (s.job_country ?? "DE").toUpperCase().slice(0, 2),
    workModel: s.job_is_remote ? "remote" : "on_site",
    salaryMin: zahlOderNull(s.job_min_salary),
    salaryMax: zahlOderNull(s.job_max_salary),
    salaryCurrency: s.job_salary_currency ?? "EUR",
    salaryPeriod: zeitraum(s.job_salary_period),
    contractType: vertrag(s.job_employment_type),
    description: beschreibung.trim(),
    benefits: h.Benefits ?? [],
    applyMethod: s.job_apply_link ? "portal" : "unknown",
    applyTarget: s.job_apply_link ?? null,
    publishedAt: datum(s.job_posted_at_datetime_utc),
    expiresAt: datum(s.job_offer_expiration_datetime_utc),
    originalUrl: s.job_apply_link ?? null,
    raw: {
      /*
       * Die vollständige Antwort des Anbieters.
       *
       * Alles andere hier ist handverlesen: Felder, die jemand einmal
       * gesehen und für wichtig gehalten hat. Genau daran ist die
       * Gehaltsauswertung schon einmal gescheitert — die Bundesagentur
       * schickt `gehaltsspanneVon`, und im Adapter stand ein Kommentar,
       * sie sende „keinen Betrag". Der Kommentar war falsch, und
       * niemand konnte es merken: Im Schnappschuss stand das Feld
       * nicht.
       *
       * Ein Feld, das niemand kennt, findet man nur in der ganzen
       * Antwort. `scripts/gehalt-rohdaten.mjs` sucht darin rekursiv.
       */
      rohantwort: s as unknown as Record<string, unknown>,
      publisher: s.job_publisher ?? null,
      employerWebsite: s.employer_website ?? null,
      /*
       * `is_direct` ist das interessanteste Feld der ganzen Antwort.
       *
       * Wo JSearch selbst sagt, dass ein Bewerbungsweg direkt zum
       * Arbeitgeber führt, können wir die Herkunft für DIESE Stelle
       * heraufstufen — von „Sammelstelle" auf „Arbeitgeberseite". Das
       * ist die einzige belastbare Angabe dazu in der Antwort, und sie
       * wird deshalb aufbewahrt statt weggeworfen.
       */
      applyOptions: s.apply_options ?? [],
      direkteBewerbung: s.apply_options?.find((a) => a.is_direct)?.apply_link ?? null,
    },
  };
}

function zahlOderNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function datum(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function zeitraum(v: string | null | undefined): "year" | "month" | "hour" {
  const s = (v ?? "").toUpperCase();
  if (s === "HOUR") return "hour";
  if (s === "MONTH") return "month";
  return "year";
}

function vertrag(v: string | null | undefined): string | null {
  switch ((v ?? "").toUpperCase()) {
    case "FULLTIME":
    case "PARTTIME":
      return "permanent";
    case "CONTRACTOR":
      return "freelance";
    case "INTERN":
      return "internship";
    default:
      return null;
  }
}
