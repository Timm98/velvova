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
 * Bright Data — ausschliesslich über freigegebene Datasets.
 *
 * ── Was dieser Adapter bewusst NICHT tut ───────────────────────
 *
 * Er scrapt nichts. Bright Data kann das, und genau deshalb steht es
 * hier ausdrücklich: es gibt keinen Codepfad in dieser Datei, der eine
 * Webseite abruft, einen Proxy benutzt oder einen Sammelauftrag
 * startet. Der Adapter liest ausschliesslich einen Datensatz, den
 * jemand vorher ausdrücklich freigeschaltet und in
 * `BRIGHT_DATA_DATASET_ID` eingetragen hat.
 *
 * ── Warum kein Endpunkt geraten wird ───────────────────────────
 *
 * Welche Datasets ein Account hat, hängt am Vertrag. Einen Namen zu
 * erfinden und danach eine Fehlermeldung zu deuten wäre teuer und
 * unehrlich. Stattdessen fragt `verfuegbareDatensaetze()` die
 * Verwaltungsschnittstelle, welche Datasets es für DIESEN Schlüssel
 * gibt, und der Rauchtest schreibt die Antwort hin.
 *
 * Ohne eingetragene Dataset-Kennung gilt der Adapter als nicht
 * eingerichtet. Das ist kein Mangel, sondern die richtige Antwort: ein
 * Token allein sagt nicht, welche Daten wir verwenden dürfen.
 */

interface DatensatzZeile {
  id?: string;
  name?: string;
  records?: number;
  status?: string;
}

export interface BrightDataOptions {
  apiKey?: string;
  datasetId?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Datensätze, deren Quelle wir nicht auslesen dürfen.
 *
 * Dieselbe Regel wie bei Apify und aus demselben Grund: der Name eines
 * Datensatzes ist Konfiguration, und Konfiguration wird eingetragen,
 * kopiert und vergessen. Ein Datensatz „LinkedIn job listings
 * information" ist ausgelesenes LinkedIn, gleichgültig über welchen
 * Dienstleister er kommt.
 *
 * Das ist bei diesem Account keine hypothetische Vorsichtsmassnahme:
 * die Abfrage der verfügbaren Datensätze ergab, dass JEDER
 * stellenbezogene Datensatz darin von LinkedIn, Indeed, Glassdoor oder
 * ZipRecruiter stammt — und alle davon 0 Sätze enthalten.
 */
const GESPERRTE_QUELLEN = [
  "linkedin",
  "indeed",
  "glassdoor",
  "ziprecruiter",
  "stepstone",
  "monster",
  "xing",
  "kununu",
];

export function gesperrterDatensatz(name: string): string | null {
  const n = name.toLowerCase();
  return GESPERRTE_QUELLEN.find((q) => n.includes(q)) ?? null;
}

export class BrightDataAdapter implements JobSourceAdapter {
  readonly key = "brightdata";
  readonly displayName = "Bright Data";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "external_api";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten aus einem lizenzierten Bright-Data-Datensatz.";
  readonly termsUrl = "https://brightdata.com/legal/terms-of-service";

  private readonly apiKey?: string;
  private readonly datasetId?: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(o: BrightDataOptions = {}) {
    this.apiKey = o.apiKey ?? envWert("BRIGHT_DATA_API_KEY");
    this.datasetId = o.datasetId ?? envWert("BRIGHT_DATA_DATASET_ID");
    this.fetchImpl = o.fetchImpl;
  }

  readonly capabilities: ProviderCapabilities = {
    ...DEFAULT_CAPABILITIES,
    search: false,
    details: false,
    since: false,
    maxPerRequest: 1000,
    rateLimitPerMinute: null,
    salary: false,
    expiry: false,
    structuredRequirements: false,
  };

  /** Beides nötig: Schlüssel UND ein ausdrücklich freigegebener Datensatz. */
  isConfigured(): boolean {
    return Boolean(this.apiKey) && this.datensatzPlausibel();
  }

  /**
   * Sieht der Wert überhaupt wie eine Dataset-Kennung aus?
   *
   * Bright-Data-Kennungen beginnen mit `gd_`. Diese Prüfung kostet
   * keinen Netzzugriff und fängt den Fehler, der hier tatsächlich
   * auftrat: in `BRIGHT_DATA_DATASET_ID` stand der API-Schlüssel, weil
   * beide Felder in der Datei untereinanderstehen.
   *
   * Ohne sie meldete die Startprüfung „active" — und der Fehler zeigte
   * sich erst beim ersten echten Abruf, als 404 von einem Endpunkt, der
   * damit nichts zu tun hat. Eine Betriebsansicht, die „bereit" sagt,
   * wo nichts bereit ist, ist schlimmer als keine.
   */
  datensatzPlausibel(): boolean {
    return Boolean(this.datasetId?.startsWith("gd_"));
  }

  /** Nur der Schlüssel — reicht, um zu fragen, was es gibt. */
  hatSchluessel(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Welche Datensätze dieser Account hat.
   *
   * Für den Rauchtest und die Betriebsansicht. Sie schreiben die
   * Antwort hin, statt eine Kennung zu erfinden.
   */
  async verfuegbareDatensaetze(signal?: AbortSignal): Promise<DatensatzZeile[]> {
    if (!this.apiKey) throw new Error("Bright Data: BRIGHT_DATA_API_KEY fehlt.");
    const antwort = await holJson<DatensatzZeile[] | { datasets?: DatensatzZeile[] }>({
      provider: "Bright Data",
      /*
       * `/datasets/list`, nicht `/datasets/v3/list`.
       *
       * Der v3-Pfad antwortet mit 404 („Cannot GET /datasets/v3/list") —
       * v3 gibt es für die Auslöse- und Snapshot-Aufrufe, nicht für die
       * Auflistung. Gemessen, nicht der Dokumentation entnommen.
       */
      url: "https://api.brightdata.com/datasets/list",
      headers: { authorization: `Bearer ${this.apiKey}` },
      signal,
      timeoutMs: 20_000,
      fetchImpl: this.fetchImpl,
    });
    return Array.isArray(antwort) ? antwort : (antwort.datasets ?? []);
  }

  /**
   * Die Datensätze, die Stellen enthalten UND verwendet werden dürfen.
   *
   * Für den Rauchtest und die Betriebsansicht. Ein Account voller
   * LinkedIn-Datensätze soll nicht als „viele Quellen verfügbar"
   * erscheinen — verfügbar ist, was auch benutzt werden darf.
   */
  async nutzbareDatensaetze(signal?: AbortSignal): Promise<{
    nutzbar: DatensatzZeile[];
    gesperrt: { name: string; quelle: string }[];
  }> {
    const alle = await this.verfuegbareDatensaetze(signal);
    const stellen = alle.filter((d) => /job|vacan|career|stelle|hiring|recruit/i.test(d.name ?? ""));
    const nutzbar: DatensatzZeile[] = [];
    const gesperrt: { name: string; quelle: string }[] = [];
    for (const d of stellen) {
      const q = gesperrterDatensatz(d.name ?? "");
      if (q) gesperrt.push({ name: d.name ?? "?", quelle: q });
      else nutzbar.push(d);
    }
    return { nutzbar, gesperrt };
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "Bright Data ist nicht eingerichtet: BRIGHT_DATA_API_KEY oder BRIGHT_DATA_DATASET_ID fehlt. " +
          "Welche Datensätze der Account hat, zeigt `node scripts/provider-smoketest.mjs`. " +
          "Ohne ausdrücklich eingetragenen Datensatz wird nichts abgerufen.",
      );
    }

    /*
     * Vor dem Abruf prüfen, was hinter der Kennung steckt.
     *
     * Die Kennung allein sagt nichts — `gd_lpfll7v5hcqtkxl6l` ist
     * „Linkedin job listings information". Ohne diese Prüfung entschiede
     * die Frage, ob wir LinkedIn auslesen, eine Zeichenkette in einer
     * Umgebungsvariable.
     */
    const { gesperrt } = await this.nutzbareDatensaetze(options.signal).catch(() => ({ gesperrt: [] }));
    const alle = await this.verfuegbareDatensaetze(options.signal).catch(() => []);
    const meiner = alle.find((d) => d.id === this.datasetId);
    if (!meiner && alle.length > 0) {
      /*
       * Die eingetragene Kennung gehört zu keinem Datensatz des Accounts.
       *
       * Ohne diesen Hinweis liefe der Abruf weiter und endete in einem
       * nackten 404 vom Snapshot-Aufruf — und die Suche ginge zur
       * Schnittstelle statt zur Konfiguration. Der häufigste Grund ist
       * banal und schwer zu sehen: in `BRIGHT_DATA_DATASET_ID` steht
       * derselbe Wert wie in `BRIGHT_DATA_API_KEY`, weil beide Felder
       * untereinanderstehen. Dataset-Kennungen beginnen mit `gd_`.
       */
      throw new Error(
        `Bright Data: BRIGHT_DATA_DATASET_ID passt zu keinem der ${alle.length} Datensätze dieses Accounts. ` +
          `Dataset-Kennungen beginnen mit "gd_" — steht dort versehentlich der API-Schlüssel? ` +
          `Welche Datensätze es gibt, zeigt \`node scripts/provider-smoketest.mjs\`.`,
      );
    }
    if (meiner) {
      const q = gesperrterDatensatz(meiner.name ?? "");
      if (q) {
        throw new Error(
          `Bright Data: der eingetragene Datensatz "${meiner.name}" stammt von ${q}. ` +
            `Das automatisierte Auslesen dieser Quelle ist untersagt — daran ändert ein Dienstleister ` +
            `dazwischen nichts. Es wird nichts abgerufen.` +
            (gesperrt.length > 0
              ? ` (In diesem Account sind ${gesperrt.length} weitere Stellendatensätze aus derselben Gruppe.)`
              : ""),
        );
      }
    }

    const url = new URL("https://api.brightdata.com/datasets/v3/snapshot");
    url.searchParams.set("dataset_id", this.datasetId!);
    url.searchParams.set("format", "json");
    if (options.limit) url.searchParams.set("limit", String(options.limit));

    const zeilen = await holJson<Record<string, unknown>[]>({
      provider: "Bright Data",
      url: url.toString(),
      headers: { authorization: `Bearer ${this.apiKey!}` },
      signal: options.signal,
      timeoutMs: 30_000,
      fetchImpl: this.fetchImpl,
    });

    const raus: RawListing[] = [];
    for (const z of Array.isArray(zeilen) ? zeilen : []) {
      const r = zuRawListing(z);
      if (r) raus.push(r);
    }
    return options.limit ? raus.slice(0, options.limit) : raus;
  }
}

/**
 * Aus einer Datensatzzeile eine Anzeige machen — oder nichts.
 *
 * Die Feldnamen sind je Datensatz verschieden, deshalb werden mehrere
 * gängige Schreibweisen geprüft. Was sich nicht sicher zuordnen lässt,
 * wird verworfen statt geraten: ein Datensatz mit erfundenem
 * Arbeitgeber ist schlimmer als einer weniger.
 */
export function zuRawListing(z: Record<string, unknown>): RawListing | null {
  const s = (...namen: string[]): string | null => {
    for (const n of namen) {
      const w = z[n];
      if (typeof w === "string" && w.trim().length > 0) return w.trim();
    }
    return null;
  };

  const titel = s("job_title", "title", "position");
  const firma = s("company_name", "company", "employer", "employer_name");
  const text = s("job_description", "description", "job_summary");
  const id = s("id", "job_id", "jobid", "url", "job_url");

  if (!titel || !firma || !text || !id || text.length < 40) return null;

  const url = s("url", "job_url", "apply_link", "link");
  const datumRoh = s("date_posted", "posted_at", "published_at", "job_posted_at");
  const d = datumRoh ? new Date(datumRoh) : null;

  return {
    externalId: id,
    title: titel,
    companyName: firma,
    location: s("location", "job_location", "city") ?? "Deutschland",
    country: (s("country", "country_code") ?? "DE").toUpperCase().slice(0, 2),
    workModel: /remote/i.test(s("remote", "workplace_type", "job_type") ?? "") ? "remote" : "on_site",
    description: text,
    applyMethod: url ? "portal" : "unknown",
    applyTarget: url,
    publishedAt: d && !Number.isNaN(d.getTime()) ? d : null,
    originalUrl: url,
    raw: z,
  };
}
