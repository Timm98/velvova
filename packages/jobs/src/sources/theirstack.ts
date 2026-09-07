import type { Herkunft } from "@paycheck/domain";
import {
  DEFAULT_CAPABILITIES,
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { envWert, holJson } from "../net.ts";

/** Kurze Pause zwischen zwei Anfragen. */
function warte(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * TheirStack.
 *
 * Der Anbieter, von dem wir strukturierte Felder erwarten statt
 * Fliesstext — Gehaltsspanne als Zahlen, Firmendomain, Technologien,
 * Remote-Kennzeichen, Veröffentlichungsdatum. Deshalb steht er in der
 * ersten Reihe der Abrufreihenfolge: was hier als Feld ankommt, muss
 * nicht später von einem Sprachmodell aus einem Absatz geraten werden,
 * und geraten heisst hier immer auch: manchmal falsch.
 *
 * Die Firmendomain ist der zweite Grund. Sie ist der verlässlichste
 * Schlüssel für die Zusammenführung derselben Stelle über mehrere
 * Anbieter — Firmennamen sind es nicht („Muster GmbH" / „Muster
 * Deutschland GmbH" / „MUSTER").
 *
 * Herkunft: TheirStack sammelt Anzeigen und ist nicht der Arbeitgeber.
 * Liefert es allerdings ein `final_url` auf die Karriereseite der
 * Firmendomain, stufen wir DIESE Stelle herauf — das ist dann belegt
 * und nicht behauptet.
 */

interface TheirStackAntwort {
  metadata?: { total_results?: number; total_companies?: number };
  data?: TheirStackStelle[];
}

interface TheirStackStelle {
  id?: number | string;
  job_title?: string;
  url?: string;
  final_url?: string | null;
  date_posted?: string | null;
  location?: string | null;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  remote?: boolean | null;
  hybrid?: boolean | null;
  salary_string?: string | null;
  min_annual_salary?: number | null;
  max_annual_salary?: number | null;
  salary_currency?: string | null;
  seniority?: string | null;
  employment_statuses?: string[] | null;
  description?: string | null;
  technology_slugs?: string[] | null;
  company?: string | null;
  company_object?: {
    name?: string | null;
    domain?: string | null;
    url?: string | null;
    industry?: string | null;
    employee_count?: number | null;
  } | null;
}

export interface TheirStackOptions {
  apiKey?: string;
  /** Ländercodes, ISO-2. */
  laender?: string[];
  /** Titelfragmente. Leer heisst: keine Titelfilterung. */
  titel?: string[];
  /** Orte, auf die eingegrenzt wird. Leer heisst: ganzes Land. */
  orte?: string[];
  maxAlterTage?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Wie viele Seiten je Abruf höchstens.
 *
 * Nicht als fachliche Grenze gedacht, sondern als Schutz: TheirStack
 * rechnet je gelieferter Anzeige ab, und ein Tippfehler im Limit wäre
 * sonst eine Rechnung.
 */
const MAX_SEITE = 40;

export class TheirStackAdapter implements JobSourceAdapter {
  readonly key = "theirstack";
  readonly displayName = "TheirStack";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "aggregator";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten von TheirStack.";
  readonly termsUrl = "https://theirstack.com/en/terms";

  private readonly apiKey?: string;
  private readonly laender: string[];
  private readonly titel: string[];
  private readonly orte: string[];
  private readonly maxAlterTage: number;
  private readonly fetchImpl?: typeof fetch;

  constructor(o: TheirStackOptions = {}) {
    this.apiKey = o.apiKey ?? envWert("THEIRSTACK_API_KEY");
    this.laender = o.laender ?? ["DE"];
    this.titel = o.titel ?? [];
    this.orte = o.orte ?? [];
    this.maxAlterTage = o.maxAlterTage ?? 14;
    this.fetchImpl = o.fetchImpl;
  }

  readonly capabilities: ProviderCapabilities = {
    ...DEFAULT_CAPABILITIES,
    search: true,
    details: true,
    /*
     * `posted_at_max_age_days` ist ein echter Zeitfilter — grob, aber
     * er bezieht sich auf ein Datum und nicht auf eine Stufe. Damit
     * lässt sich ein Bestandsabruf sinnvoll begrenzen.
     */
    since: true,
    /*
     * 25, nicht 100.
     *
     * Gemessen: bei 40 antwortet TheirStack mit
     * „E-020 Premium functionality limitation — The free plan does not
     * allow more than 25 results per page."
     *
     * Die Zahl steht hier und nicht im Aufrufer, weil sie eine
     * Eigenschaft des Anbieters ist. Sie im Aufrufer zu begrenzen
     * hiesse: der nächste Aufrufer kennt sie nicht und läuft in
     * denselben 403.
     *
     * Wer einen bezahlten Tarif hat, hebt sie hier an — dann wird der
     * Grund derselbe Blick, der ihn gesenkt hat.
     */
    maxPerRequest: 25,
    rateLimitPerMinute: null,
    salary: true,
    expiry: false,
    structuredRequirements: false,
  };

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "TheirStack ist nicht eingerichtet: THEIRSTACK_API_KEY fehlt. Es wird nichts abgerufen.",
      );
    }

    const ziel = options.limit ?? 50;
    const jeSeite = Math.min(ziel, this.capabilities.maxPerRequest);
    const alter = options.since
      ? Math.max(1, Math.ceil((Date.now() - options.since.getTime()) / 86_400_000))
      : this.maxAlterTage;

    const body: Record<string, unknown> = {
      page: 0,
      limit: jeSeite,
      posted_at_max_age_days: alter,
      job_country_code_or: this.laender,
      /*
       * Ohne Beschreibung ist eine Stelle für uns wertlos.
       *
       * Die gesamte Einschätzung — Aufgaben, Anforderungen, Mondays
       * Begründung — hängt am Text. Eine Zeile mit Titel und Firma
       * würde in der Liste stehen und beim Öffnen nichts hergeben.
       */
      include_total_results: false,
      blur_company_data: false,
    };
    if (this.titel.length > 0) body.job_title_or = this.titel;
    /*
     * Der Ort gehört in die Anfrage, nicht in den Suchbegriff.
     *
     * Ohne ihn kam auf eine Suche für Karlsruhe eine Stelle in Neu-Ulm
     * zurück — TheirStack filtert nach Titel, nicht nach dem, was
     * zufällig im Suchwort steht. Bei jemandem mit einer Pendelgrenze
     * ist das keine Ungenauigkeit, sondern eine Liste voller Stellen,
     * die seine Bedingung verletzen.
     */
    if (this.orte.length > 0) body.job_location_pattern_or = this.orte;

    /*
     * ── Blättern, aber jede Seite kostet ──────────────────────
     *
     * `page: 0` stand hier fest. Ein Abruf mit Limit 400 holte 25
     * Anzeigen, der nächste dieselben 25 — dieselbe stille Verengung
     * wie bei Adzuna.
     *
     * Der Unterschied zur Bundesagentur: TheirStack rechnet je
     * gelieferter Anzeige ab. Blättern ist hier kein freies Tempo,
     * sondern Geld. Deshalb wird genau so weit geblättert, wie der
     * Aufrufer verlangt — kein grosszügiges Aufrunden, kein
     * Vorratsholen —, und bei einer nicht vollen Seite ist Schluss.
     *
     * Die Obergrenze `MAX_SEITE` ist der Schutz gegen den Tippfehler,
     * der aus einem Limit von 500 versehentlich 50.000 macht.
     */
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();

    for (let seite = 0; seite < MAX_SEITE && raus.length < ziel; seite++) {
      body.page = seite;
      body.limit = Math.min(jeSeite, ziel - raus.length);

      const antwort = await holJson<TheirStackAntwort>({
        provider: "TheirStack",
        url: "https://api.theirstack.com/v1/jobs/search",
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey!}` },
        body,
        signal: options.signal,
        timeoutMs: 20_000,
        fetchImpl: this.fetchImpl,
      });

      const treffer = antwort.data ?? [];
      for (const s of treffer) {
        const r = zuRawListing(s);
        if (!r || gesehen.has(r.externalId)) continue;
        gesehen.add(r.externalId);
        raus.push(r);
      }

      // Eine nicht volle Seite ist die letzte.
      if (treffer.length < Number(body.limit)) break;

      /*
       * Vier Anfragen je Sekunde erlaubt die Schnittstelle (Kopfzeile
       * `ratelimit-policy: "per-second";q=4`). Ein Viertelsekunden-
       * abstand bleibt sicher darunter, ohne dass es jemand merkt.
       */
      if (raus.length < ziel) await warte(260);
    }

    return raus;
  }
}

export function zuRawListing(s: TheirStackStelle): RawListing | null {
  const firma = s.company_object?.name ?? s.company ?? null;
  const beschreibung = (s.description ?? "").trim();
  if (s.id == null || !s.job_title || !firma || beschreibung.length < 40) return null;

  const domain = s.company_object?.domain ?? null;
  const zielUrl = s.final_url ?? s.url ?? null;

  return {
    externalId: String(s.id),
    title: s.job_title.trim(),
    companyName: firma.trim(),
    location: s.location ?? s.city ?? s.country ?? "Deutschland",
    country: (s.country_code ?? "DE").toUpperCase().slice(0, 2),
    workModel: s.remote ? "remote" : s.hybrid ? "hybrid" : "on_site",
    /*
     * Die Gehaltsangabe kommt bereits auf ein Jahr gerechnet.
     *
     * Deshalb hier `year` fest und nicht geraten. Der `salary_string`
     * wird NICHT geparst: er ist Fliesstext in wechselnder Form, und
     * eine falsch gelesene Zahl ist an dieser Stelle teurer als eine
     * fehlende — sie entscheidet über eine harte Bedingung.
     */
    salaryMin: zahl(s.min_annual_salary),
    salaryMax: zahl(s.max_annual_salary),
    salaryCurrency: s.salary_currency ?? "EUR",
    salaryPeriod: "year",
    contractType: vertrag(s.employment_statuses),
    experienceLevel: erfahrung(s.seniority),
    industry: s.company_object?.industry ?? null,
    description: beschreibung,
    applyMethod: zielUrl ? "portal" : "unknown",
    applyTarget: zielUrl,
    publishedAt: datum(s.date_posted),
    originalUrl: zielUrl,
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
      companyDomain: domain,
      companyUrl: s.company_object?.url ?? null,
      employeeCount: s.company_object?.employee_count ?? null,
      technologies: s.technology_slugs ?? [],
      salaryString: s.salary_string ?? null,
      /*
       * Zeigt der Link auf die Domain der Firma selbst, ist es ihre
       * eigene Seite — und die Herkunft dieser einen Stelle darf
       * „employer_direct" heissen. Belegt, nicht angenommen.
       */
      zeigtAufFirmendomain: Boolean(domain && zielUrl && hostVon(zielUrl)?.endsWith(domain)),
    },
  };
}

function hostVon(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function zahl(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

function datum(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function vertrag(v: string[] | null | undefined): string | null {
  const s = (v ?? []).join(" ").toLowerCase();
  if (/intern/.test(s)) return "internship";
  if (/contract|freelance/.test(s)) return "freelance";
  if (/full.?time|part.?time|permanent/.test(s)) return "permanent";
  return null;
}

function erfahrung(v: string | null | undefined): string | null {
  const s = (v ?? "").toLowerCase();
  if (/junior|entry/.test(s)) return "junior";
  if (/senior|lead|principal/.test(s)) return "senior";
  if (/mid|intermediate/.test(s)) return "mid";
  return null;
}
