import type { Herkunft } from "@paycheck/domain";
import {
  normaliseWorkModel,
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { envWert } from "../net.ts";

/**
 * USAJOBS — alle Stellen der US-Bundesverwaltung.
 *
 * ── Warum diese Quelle besonders ist ──────────────────────────
 *
 * Sie ist amtlich, wie die Bundesagentur: Der Arbeitgeber stellt hier
 * selbst ein, es ist keine Kopie von woanders. Und sie nennt bei jeder
 * Stelle eine **Gehaltsspanne** — bei US-Bundesstellen gesetzlich
 * vorgeschrieben. Unter allen geprüften Quellen ist das die einzige
 * mit lückenloser Gehaltsangabe.
 *
 * ── Die Eigenart der Anmeldung ────────────────────────────────
 *
 * Zwei Angaben statt einer: der Schlüssel als `Authorization-Key` und
 * die E-Mail-Adresse, mit der er beantragt wurde, als `User-Agent`.
 * Fehlt die Adresse, antwortet der Dienst mit 401 — und die Suche geht
 * dann nach dem Schlüssel, der richtig ist.
 */

const BASIS = "https://data.usajobs.gov/api/search";

interface UsaStelle {
  MatchedObjectId?: string;
  MatchedObjectDescriptor?: {
    PositionID?: string;
    PositionTitle?: string;
    PositionURI?: string;
    OrganizationName?: string;
    DepartmentName?: string;
    PositionLocationDisplay?: string;
    PublicationStartDate?: string;
    ApplicationCloseDate?: string;
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
    UserArea?: { Details?: { JobSummary?: string; MajorDuties?: string[] } };
  };
}

export class UsaJobsAdapter implements JobSourceAdapter {
  readonly key = "usajobs";
  readonly displayName = "USAJOBS (US-Bundesverwaltung)";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  /*
   * `licensed_partner`, nicht `aggregator`: Die Behörden stellen hier
   * selbst ein. Das ist die Stelle, an der die Anzeige entsteht.
   */
  readonly herkunft: Herkunft = "licensed_partner";
  readonly attributionRequired = false;
  readonly attributionText = "Stellendaten von USAJOBS, U.S. Office of Personnel Management.";
  readonly termsUrl = "https://developer.usajobs.gov/";

  private readonly apiKey?: string;
  private readonly email?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly abfragen: string[];

  constructor(o: { apiKey?: string; email?: string; fetchImpl?: typeof fetch; abfragen?: string[] } = {}) {
    this.apiKey = o.apiKey ?? envWert("USAJOBS_API_KEY");
    this.email = o.email ?? envWert("USAJOBS_EMAIL");
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.abfragen = o.abfragen ?? [];
  }

  /**
   * Beides muss da sein.
   *
   * Nur den Schlüssel zu prüfen hiesse: Der Abruf läuft los, bekommt
   * 401 und meldet einen Zugangsfehler — obwohl bloss eine E-Mail
   * fehlt. Der Unterschied gehört hierher, nicht ins Protokoll.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.email);
  }

  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: false,
    since: false,
    maxPerRequest: 500,
    rateLimitPerMinute: null,
    /* Gehalt ist bei US-Bundesstellen vorgeschrieben — lückenlos. */
    salary: true,
    expiry: true,
    structuredRequirements: false,
  };

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "USAJOBS ist nicht eingerichtet: USAJOBS_API_KEY oder USAJOBS_EMAIL fehlt. " +
          "Der Dienst verlangt beides — die E-Mail geht als Kennung mit.",
      );
    }

    const ziel = options.limit ?? 100;
    const jeSeite = Math.min(500, this.capabilities.maxPerRequest);
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();
    const begriffe: (string | null)[] = this.abfragen.length > 0 ? [...this.abfragen] : [null];

    for (const was of begriffe) {
      for (let seite = 1; seite <= 20 && raus.length < ziel; seite++) {
        const url = new URL(BASIS);
        if (was) url.searchParams.set("Keyword", was);
        url.searchParams.set("ResultsPerPage", String(jeSeite));
        url.searchParams.set("Page", String(seite));

        const antwort = await this.fetchImpl(url, {
          headers: {
            "Authorization-Key": this.apiKey!,
            "User-Agent": this.email!,
            Host: "data.usajobs.gov",
            Accept: "application/json",
          },
          signal: options.signal,
        }).catch(() => null);

        if (!antwort?.ok) {
          if (raus.length === 0) {
            throw new Error(
              `USAJOBS antwortete mit ${antwort?.status ?? "keiner Antwort"}. Es werden keine Stellen übernommen.`,
            );
          }
          console.warn(`[usajobs] ${antwort?.status} nach ${raus.length} Anzeigen — Lauf endet hier.`);
          return raus.slice(0, ziel);
        }

        const daten = (await antwort.json().catch(() => null)) as
          | { SearchResult?: { SearchResultItems?: UsaStelle[] } }
          | null;
        const treffer = daten?.SearchResult?.SearchResultItems ?? [];
        let neu = 0;
        for (const s of treffer) {
          const l = zuRawListing(s);
          if (!l || gesehen.has(l.externalId)) continue;
          gesehen.add(l.externalId);
          raus.push(l);
          neu++;
          if (raus.length >= ziel) break;
        }
        if (treffer.length < jeSeite || neu === 0) break;
      }
    }

    return raus.slice(0, ziel);
  }
}

/** Aus der Vergütungsangabe Betrag und Zeitraum. */
function gehalt(r: UsaStelle["MatchedObjectDescriptor"]): Partial<RawListing> {
  const v = r?.PositionRemuneration?.[0];
  if (!v) return {};
  const min = v.MinimumRange ? Number(v.MinimumRange) : null;
  const max = v.MaximumRange ? Number(v.MaximumRange) : null;
  if (min === null && max === null) return {};

  /*
   * `RateIntervalCode` ist ein Kürzel: PA = per annum, PH = per hour.
   * Ohne die Übersetzung landete ein Stundensatz als Jahresgehalt in
   * der Datenbank — um den Faktor zweitausend daneben.
   */
  const zeitraum = v.RateIntervalCode === "PH" ? "hour" : v.RateIntervalCode === "PM" ? "month" : "year";
  return {
    salaryMin: min,
    salaryMax: max,
    salaryCurrency: "USD",
    salaryPeriod: zeitraum as "year" | "month" | "hour",
  };
}

export function zuRawListing(s: UsaStelle): RawListing | null {
  const d = s.MatchedObjectDescriptor;
  const text = [d?.UserArea?.Details?.JobSummary ?? "", ...(d?.UserArea?.Details?.MajorDuties ?? [])]
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const firma = d?.OrganizationName ?? d?.DepartmentName ?? "";
  if (!s.MatchedObjectId || !d?.PositionTitle || !firma || text.length < 40) return null;

  return {
    externalId: String(s.MatchedObjectId),
    title: d.PositionTitle.trim(),
    companyName: firma.trim(),
    location: (d.PositionLocationDisplay ?? "").trim() || "Vereinigte Staaten",
    country: "US",
    workModel: normaliseWorkModel(`${d.PositionTitle} ${d.PositionLocationDisplay ?? ""}`),
    description: text,
    ...gehalt(d),
    applyMethod: "portal" as const,
    applyTarget: d.PositionURI ?? "",
    originalUrl: d.PositionURI ?? "",
    publishedAt: d.PublicationStartDate ? new Date(d.PublicationStartDate) : null,
    expiresAt: d.ApplicationCloseDate ? new Date(d.ApplicationCloseDate) : null,
    raw: { positionId: d.PositionID ?? null },
  } as RawListing;
}
