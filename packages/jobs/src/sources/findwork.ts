import type { Herkunft } from "@paycheck/domain";
import {
  normaliseWorkModel,
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { envWert, mitFrist } from "../net.ts";

/**
 * Findwork — Technikstellen weltweit.
 *
 * Geprüft am 3.9.2026: antwortet mit `401 Registrierung nötig`. Der
 * Schlüssel geht als `Authorization: Token <key>` mit — nicht als
 * `Bearer`, was die verbreitete Form wäre und hier 401 ergäbe.
 *
 * Die Quelle ist klein gegenüber Adzuna, aber sie führt Stellen von
 * Arbeitgebern, die auf keinem Portal ausschreiben, und liefert
 * Volltexte statt Anreisser.
 */

const BASIS = "https://findwork.dev/api/jobs/";

interface FindworkStelle {
  id?: number | string;
  role?: string;
  company_name?: string;
  location?: string;
  remote?: boolean;
  text?: string;
  url?: string;
  date_posted?: string;
  employment_type?: string | null;
  keywords?: string[];
}

export class FindworkAdapter implements JobSourceAdapter {
  readonly key = "findwork";
  readonly displayName = "Findwork";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "aggregator";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten von Findwork. Bewerbung über die Originalanzeige.";
  readonly termsUrl = "https://findwork.dev/developers/";

  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly abfragen: string[];

  constructor(o: { apiKey?: string; fetchImpl?: typeof fetch; abfragen?: string[] } = {}) {
    this.apiKey = o.apiKey ?? envWert("FINDWORK_API_KEY");
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.abfragen = o.abfragen ?? [];
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: false,
    since: false,
    maxPerRequest: 100,
    rateLimitPerMinute: null,
    salary: false,
    expiry: false,
    structuredRequirements: false,
  };

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error("Findwork ist nicht eingerichtet: FINDWORK_API_KEY fehlt.");
    }

    const ziel = options.limit ?? 100;
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();
    const begriffe: (string | null)[] = this.abfragen.length > 0 ? [...this.abfragen] : [null];

    for (const was of begriffe) {
      for (let seite = 1; seite <= 20 && raus.length < ziel; seite++) {
        const url = new URL(BASIS);
        if (was) url.searchParams.set("search", was);
        url.searchParams.set("page", String(seite));

        const antwort = await this.fetchImpl(url, {
          headers: {
            /* `Token`, nicht `Bearer` — sonst 401 bei richtigem Schlüssel. */
            Authorization: `Token ${this.apiKey}`,
            Accept: "application/json",
          },
          signal: mitFrist(options.signal),
        }).catch(() => null);

        if (!antwort?.ok) {
          if (raus.length === 0) {
            throw new Error(
              `Findwork antwortete mit ${antwort?.status ?? "keiner Antwort"}. Es werden keine Stellen übernommen.`,
            );
          }
          console.warn(`[findwork] ${antwort?.status} nach ${raus.length} Anzeigen — Lauf endet hier.`);
          return raus.slice(0, ziel);
        }

        const daten = (await antwort.json().catch(() => null)) as
          | { results?: FindworkStelle[]; next?: string | null }
          | null;
        const treffer = daten?.results ?? [];
        let neu = 0;
        for (const s of treffer) {
          const l = zuRawListing(s);
          if (!l || gesehen.has(l.externalId)) continue;
          gesehen.add(l.externalId);
          raus.push(l);
          neu++;
          if (raus.length >= ziel) break;
        }
        if (!daten?.next || neu === 0) break;
      }
    }

    return raus.slice(0, ziel);
  }
}

export function zuRawListing(s: FindworkStelle): RawListing | null {
  const text = (s.text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (s.id == null || !s.role || !s.company_name || text.length < 40) return null;

  return {
    externalId: String(s.id),
    title: s.role.trim(),
    companyName: s.company_name.trim(),
    location: (s.location ?? "").trim() || (s.remote ? "Remote" : "Nicht angegeben"),
    /*
     * Findwork nennt kein Land, nur einen Ortsnamen. Es zu raten wäre
     * eine Erfindung an einer Stelle, an der Pendelzeit und Währung
     * daran hängen — der Ingest erkennt es aus dem Ortsnamen, oder es
     * bleibt offen.
     */
    workModel: s.remote ? ("remote" as const) : normaliseWorkModel(`${s.role} ${s.location ?? ""}`),
    description: text,
    applyMethod: "portal" as const,
    applyTarget: s.url ?? "",
    originalUrl: s.url ?? "",
    publishedAt: s.date_posted ? new Date(s.date_posted) : null,
    raw: { keywords: s.keywords ?? [], employmentType: s.employment_type ?? null },
  } as RawListing;
}
