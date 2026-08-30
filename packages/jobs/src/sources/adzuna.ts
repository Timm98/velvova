import type { ProviderCapabilities } from "../adapter.ts";
import { normaliseWorkModel, type FetchOptions, type JobSourceAdapter, type RawListing } from "../adapter.ts";

/**
 * Adzuna.
 *
 * Eine lizenzierte Schnittstelle mit Zugangsdaten. Sie liefert etwas,
 * das Arbeitnow nicht hat: Gehaltsangaben — teils gemeldet, teils
 * geschätzt. Der Unterschied wird mitgeführt und in der Oberfläche
 * ausgewiesen. Eine Schätzung, die wie eine Zusage aussieht, ist
 * schlimmer als keine Angabe.
 *
 * Ohne `ADZUNA_APP_ID` und `ADZUNA_APP_KEY` gilt die Quelle als nicht
 * eingerichtet und wird nicht abgefragt.
 */

interface AdzunaResult {
  id: string;
  title: string;
  description: string;
  created: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_time?: string;
  contract_type?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
}

export interface AdzunaOptions {
  appId?: string;
  appKey?: string;
  country?: string;
  fetchImpl?: typeof fetch;
}

export class AdzunaAdapter implements JobSourceAdapter {
  readonly key = "adzuna_de";
  readonly displayName = "Adzuna";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten von Adzuna. Bewerbung über die Originalanzeige.";
  readonly termsUrl = "https://developer.adzuna.com/";

  private readonly appId?: string;
  private readonly appKey?: string;
  private readonly country: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AdzunaOptions = {}) {
    this.appId = options.appId ?? process.env.ADZUNA_APP_ID;
    this.appKey = options.appKey ?? process.env.ADZUNA_APP_KEY;
    this.country = (options.country ?? process.env.ADZUNA_COUNTRY ?? "de").toLowerCase();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Adzuna kennt Suchbegriffe, Ort und Gehaltsfilter und liefert
   * Gehaltsspannen mit. Ein Ablaufdatum gibt es nicht; die API begrenzt
   * auf 50 Ergebnisse je Seite.
   */
  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: true,
    since: false,
    maxPerRequest: 50,
    rateLimitPerMinute: 25,
    salary: true,
    expiry: false,
    structuredRequirements: false,
  };

  isConfigured(): boolean {
    return Boolean(this.appId && this.appKey);
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "Adzuna ist nicht eingerichtet: ADZUNA_APP_ID oder ADZUNA_APP_KEY fehlt. " +
          "Es wird nichts abgerufen.",
      );
    }

    const limit = Math.min(options.limit ?? 50, 50);
    const url = new URL(
      `https://api.adzuna.com/v1/api/jobs/${this.country}/search/1`,
    );
    url.searchParams.set("app_id", this.appId!);
    url.searchParams.set("app_key", this.appKey!);
    url.searchParams.set("results_per_page", String(limit));
    url.searchParams.set("content-type", "application/json");
    if (options.since) {
      const days = Math.ceil((Date.now() - options.since.getTime()) / 86_400_000);
      url.searchParams.set("max_days_old", String(Math.max(1, days)));
    }

    const response = await this.fetchImpl(url, { signal: options.signal });
    if (!response.ok) {
      throw new Error(
        `Adzuna antwortete mit ${response.status}. Es werden keine Stellen übernommen.`,
      );
    }

    const body = (await response.json()) as { results?: AdzunaResult[] };
    return (body.results ?? []).map((r) => this.toRawListing(r));
  }

  private toRawListing(r: AdzunaResult): RawListing {
    const location = r.location?.display_name?.trim() || "Nicht angegeben";
    // Adzuna kennzeichnet geschätzte Gehälter mit "1". Nur gemeldete
    // Werte gelten als offengelegt; eine Schätzung wandert in die
    // Rohdaten und wird in der Oberfläche als solche ausgewiesen.
    const predicted = r.salary_is_predicted === "1";

    return {
      externalId: String(r.id),
      title: r.title.replace(/<[^>]+>/g, "").trim(),
      companyName: r.company?.display_name?.trim() || "Nicht angegeben",
      location,
      country: this.country.toUpperCase(),
      workModel: normaliseWorkModel(`${r.title} ${location}`),
      salaryMin: predicted ? null : (r.salary_min ?? null),
      salaryMax: predicted ? null : (r.salary_max ?? null),
      salaryCurrency: this.country === "de" ? "EUR" : undefined,
      salaryPeriod: "year",
      contractType:
        r.contract_type === "permanent"
          ? "permanent"
          : r.contract_type === "contract"
            ? "fixed_term"
            : null,
      industry: r.category?.label ?? null,
      description: r.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      applyMethod: "portal",
      applyTarget: r.redirect_url,
      originalUrl: r.redirect_url,
      publishedAt: r.created ? new Date(r.created) : null,
      raw: {
        source: "adzuna",
        salaryIsPredicted: predicted,
        predictedSalaryMin: predicted ? (r.salary_min ?? null) : null,
        predictedSalaryMax: predicted ? (r.salary_max ?? null) : null,
        contractTime: r.contract_time ?? null,
      },
    };
  }
}
