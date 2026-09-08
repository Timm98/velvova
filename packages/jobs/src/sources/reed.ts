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
 * Reed.co.uk — das grösste Stellenportal Grossbritanniens.
 *
 * ── Warum diese Quelle ────────────────────────────────────────
 *
 * Geprüft am 3.9.2026: Die Schnittstelle antwortet mit `401
 * Registrierung nötig` — offen und kostenlos, nur mit Schlüssel. Sie
 * liefert Gehaltsspannen als eigene Felder, was unter den
 * Aggregatoren die Ausnahme ist.
 *
 * ── Die Eigenart der Anmeldung ────────────────────────────────
 *
 * Reed erwartet den Schlüssel als BASIC-Authentifizierung mit dem
 * Schlüssel als Benutzername und leerem Passwort. Wer ihn als
 * `Authorization: <key>` schickt — die verbreitetste Form — bekommt
 * 401 und sucht den Fehler beim Schlüssel.
 */

const BASIS = "https://www.reed.co.uk/api/1.0";

interface ReedStelle {
  jobId?: number;
  employerName?: string;
  jobTitle?: string;
  locationName?: string;
  minimumSalary?: number | null;
  maximumSalary?: number | null;
  currency?: string | null;
  jobDescription?: string;
  jobUrl?: string;
  date?: string;
  expirationDate?: string;
  applications?: number;
}

export class ReedAdapter implements JobSourceAdapter {
  readonly key = "reed_gb";
  readonly displayName = "Reed (Grossbritannien)";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "aggregator";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten von Reed.co.uk. Bewerbung über die Originalanzeige.";
  readonly termsUrl = "https://www.reed.co.uk/developers/jobseeker";

  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly abfragen: string[];

  constructor(o: { apiKey?: string; fetchImpl?: typeof fetch; abfragen?: string[] } = {}) {
    this.apiKey = o.apiKey ?? envWert("REED_API_KEY");
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.abfragen = o.abfragen ?? [];
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Reed kennt Suchbegriffe und liefert Gehalt als eigene Felder — das
   * ist mehr, als die meisten Aggregatoren hergeben. Ein Ablaufdatum
   * gibt es ebenfalls, strukturierte Anforderungen nicht.
   */
  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: false,
    since: true,
    maxPerRequest: 100,
    rateLimitPerMinute: null,
    salary: true,
    expiry: true,
    structuredRequirements: false,
  };

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error("Reed ist nicht eingerichtet: REED_API_KEY fehlt. Es wird nichts abgerufen.");
    }

    const ziel = options.limit ?? 100;
    const jeSeite = Math.min(100, this.capabilities.maxPerRequest);
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();

    /* Ohne Suchbegriff liefert Reed den allgemeinen Bestand. */
    const begriffe: (string | null)[] = this.abfragen.length > 0 ? [...this.abfragen] : [null];

    for (const was of begriffe) {
      for (let von = 0; von < 1000 && raus.length < ziel; von += jeSeite) {
        const url = new URL(`${BASIS}/search`);
        if (was) url.searchParams.set("keywords", was);
        url.searchParams.set("resultsToTake", String(jeSeite));
        url.searchParams.set("resultsToSkip", String(von));

        const antwort = await this.fetchImpl(url, {
          headers: {
            /*
             * Schlüssel als Benutzername, Passwort leer.
             *
             * Reeds Eigenart. `Authorization: <key>` — die verbreitete
             * Form — antwortet mit 401, und die Suche geht dann nach
             * dem Schlüssel statt nach der Kodierung.
             */
            Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
            Accept: "application/json",
          },
          signal: mitFrist(options.signal),
        }).catch(() => null);

        if (!antwort?.ok) {
          if (raus.length === 0) {
            throw new Error(
              `Reed antwortete mit ${antwort?.status ?? "keiner Antwort"}. Es werden keine Stellen übernommen.`,
            );
          }
          console.warn(`[reed] ${antwort?.status} nach ${raus.length} Anzeigen — Lauf endet hier.`);
          return raus.slice(0, ziel);
        }

        const daten = (await antwort.json().catch(() => null)) as { results?: ReedStelle[] } | null;
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
        if (treffer.length < jeSeite || neu === 0) break;
      }
    }

    return raus.slice(0, ziel);
  }
}

export function zuRawListing(s: ReedStelle): RawListing | null {
  const beschreibung = (s.jobDescription ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!s.jobId || !s.jobTitle || !s.employerName || beschreibung.length < 40) return null;

  return {
    externalId: String(s.jobId),
    title: s.jobTitle.trim(),
    companyName: s.employerName.trim(),
    location: (s.locationName ?? "").trim() || "Vereinigtes Königreich",
    country: "GB",
    workModel: normaliseWorkModel(`${s.jobTitle} ${s.locationName ?? ""}`),
    description: beschreibung,
    /*
     * Reed nennt Jahresbeträge in Pfund. Die Währung kommt mit, damit
     * `waehrungBestimmen()` sie nicht gegen das Land prüfen muss.
     */
    ...(s.minimumSalary || s.maximumSalary
      ? {
          salaryMin: s.minimumSalary ?? null,
          salaryMax: s.maximumSalary ?? null,
          salaryCurrency: s.currency ?? "GBP",
          salaryPeriod: "year" as const,
        }
      : {}),
    applyMethod: "portal" as const,
    applyTarget: s.jobUrl ?? "",
    originalUrl: s.jobUrl ?? "",
    publishedAt: s.date ? new Date(s.date.split("/").reverse().join("-")) : null,
    expiresAt: s.expirationDate ? new Date(s.expirationDate.split("/").reverse().join("-")) : null,
    raw: { applications: s.applications ?? null },
  } as RawListing;
}
