import type { ProviderCapabilities } from "../adapter.ts";
import { normaliseWorkModel, type FetchOptions, type JobSourceAdapter, type RawListing } from "../adapter.ts";

/**
 * Jooble.
 *
 * Aggregator mit Schlüssel. Die Antwort ist knapp: Gehalt kommt als
 * Freitext, das Datum als relative Angabe. Beides wird vorsichtig
 * ausgewertet — was nicht eindeutig ist, bleibt leer.
 *
 * Ohne `JOOBLE_API_KEY` gilt die Quelle als nicht eingerichtet.
 */

interface JoobleJob {
  id?: number | string;
  title: string;
  location: string;
  snippet: string;
  salary?: string;
  source?: string;
  type?: string;
  link: string;
  company?: string;
  updated?: string;
}

export interface JoobleOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  keywords?: string;
  location?: string;
}

/**
 * Gehalt aus Freitext.
 *
 * Bewusst streng: erkannt wird nur eine klare Zahl oder Spanne mit
 * Währung. „Attraktives Gehalt“, „nach Vereinbarung“ und „ab sofort“
 * ergeben nichts — und das ist richtig so.
 */
export function parseSalary(raw: string | undefined): {
  min: number | null;
  max: number | null;
  period: "year" | "month" | "hour";
} {
  if (!raw) return { min: null, max: null, period: "year" };

  // Die Bezugsgröße zuerst: sie entscheidet, welche Zahlen überhaupt
  // plausibel sind. 18,50 ist ein Stundensatz und ein absurdes
  // Jahresgehalt — dieselbe Zahl, zwei Bedeutungen.
  const period = /\bstd\b|stunde|hour|\/\s*h\b/i.test(raw)
    ? ("hour" as const)
    : /monat|month|\bmtl\b|p\.?\s*m\b/i.test(raw)
      ? ("month" as const)
      : ("year" as const);

  // Deutsche Schreibweise: Punkt trennt Tausender, Komma die
  // Nachkommastellen. Genau umgekehrt zur englischen — deshalb wird
  // beides ausdrücklich behandelt statt geraten.
  const numbers = [...raw.matchAll(/(\d[\d.,\s]*\d|\d)/g)]
    .map((m) => {
      const token = m[1]!.replace(/\s/g, "");
      const normalised = /,\d{1,2}$/.test(token)
        ? token.replace(/\./g, "").replace(",", ".")
        : token.replace(/[.,]/g, "");
      return Number(normalised);
    })
    .filter((n) => Number.isFinite(n));

  // Untergrenzen je Bezugsgröße. Sie halten Jahreszahlen, Postleitzahlen
  // und Stellenkennungen aus dem Gehaltsfeld heraus.
  const floor = period === "hour" ? 5 : period === "month" ? 300 : 8000;
  const plausible = numbers.filter((n) => n >= floor);

  if (plausible.length === 0) return { min: null, max: null, period };

  const [min, max] = plausible.length >= 2 ? [plausible[0]!, plausible[1]!] : [plausible[0]!, null];
  return { min, max, period };
}

/**
 * Die Länder, für die es einen eigenen Schlüssel geben kann.
 *
 * Jooble verlangt einen Schlüssel je Land. Einen gemeinsamen zu
 * verwenden verletzt die Bedingungen der Quelle — deshalb je Land ein
 * eigener Adapter mit eigenem Verzeichniseintrag, statt eines Adapters
 * mit einem Länderparameter.
 */
export const JOOBLE_COUNTRIES = ["de", "ch", "at"] as const;
export type JoobleCountry = (typeof JOOBLE_COUNTRIES)[number];

const LAND: Record<JoobleCountry, { name: string; code: string; standardOrt: string }> = {
  de: { name: "Deutschland", code: "DE", standardOrt: "Deutschland" },
  ch: { name: "Schweiz", code: "CH", standardOrt: "Schweiz" },
  at: { name: "Österreich", code: "AT", standardOrt: "Österreich" },
};

export class JoobleAdapter implements JobSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten von Jooble. Bewerbung über die Originalanzeige.";
  readonly termsUrl = "https://jooble.org/api/about";

  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly keywords: string;
  private readonly location: string;
  private readonly country: JoobleCountry;

  constructor(options: JoobleOptions & { country?: JoobleCountry } = {}) {
    this.country = options.country ?? "de";
    const land = LAND[this.country];

    this.key = `jooble_${this.country}`;
    this.displayName = `Jooble ${land.name}`;

    // Ein Schlüssel je Land. Ein gemeinsamer Schlüssel für mehrere
    // Länder verletzt die Bedingungen der Quelle — deshalb wird hier
    // ausdrücklich NICHT auf den deutschen Schlüssel zurückgefallen.
    this.apiKey =
      options.apiKey ??
      process.env[`JOOBLE_API_KEY_${this.country.toUpperCase()}`] ??
      // Ältere Schreibweise ohne Land, nur für Deutschland. Sie stand
      // in bestehenden .env-Dateien, während .env.example schon die
      // Länderfassung dokumentierte — eine Drift, die niemand bemerkt,
      // weil sie sich als "nicht eingerichtet" tarnt.
      (this.country === "de" ? process.env.JOOBLE_API_KEY : undefined);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.keywords = options.keywords ?? process.env.JOOBLE_KEYWORDS ?? "";
    this.location = options.location ?? process.env.JOOBLE_LOCATION ?? land.standardOrt;
  }

  /**
   * Jooble sucht über Begriff und Ort und liefert ein Aktualisierungs-
   * datum, aber keine strukturierten Anforderungen und kein
   * Ablaufdatum.
   */
  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: false,
    since: true,
    maxPerRequest: 100,
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
        `${this.displayName} ist nicht eingerichtet: ` +
          `JOOBLE_API_KEY_${this.country.toUpperCase()} fehlt. Es wird nichts abgerufen.`,
      );
    }

    const response = await this.fetchImpl(`https://jooble.org/api/${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
      body: JSON.stringify({
        keywords: this.keywords,
        location: this.location,
        page: "1",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Jooble antwortete mit ${response.status}. Es werden keine Stellen übernommen.`,
      );
    }

    const body = (await response.json()) as { jobs?: JoobleJob[] };
    return (body.jobs ?? []).slice(0, options.limit ?? 50).map((j) => this.toRawListing(j));
  }

  private toRawListing(j: JoobleJob): RawListing {
    const salary = parseSalary(j.salary);
    const location = j.location?.trim() || "Nicht angegeben";

    return {
      externalId: String(j.id ?? j.link),
      title: j.title.trim(),
      companyName: j.company?.trim() || "Nicht angegeben",
      location,
      country: LAND[this.country].code,
      workModel: normaliseWorkModel(`${j.title} ${location} ${j.type ?? ""}`),
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryPeriod: salary.period,
      description: j.snippet.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      applyMethod: "portal",
      applyTarget: j.link,
      originalUrl: j.link,
      // Jooble liefert das Datum relativ ("vor 3 Tagen"). Daraus ein
      // Datum zu rechnen hiesse raten; unbekannt bleibt unbekannt.
      publishedAt: null,
      raw: { source: "jooble", originalSource: j.source ?? null, rawSalary: j.salary ?? null },
    };
  }
}
