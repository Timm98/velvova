import type {
  FetchOptions,
  JobSourceAdapter,
  ProviderCapabilities,
  RawListing,
} from "../adapter.ts";
import { mitFrist } from "../net.ts";

/**
 * Lightcast — vorbereitet, ohne Vertrag abgeschaltet.
 *
 * Dieser Adapter ist vollständig geschrieben und läuft trotzdem nicht.
 * Das ist kein Zwischenstand, sondern der Zustand, der zum Vertrag
 * passt: Lightcast ist eine kostenpflichtige Lizenz, und welche Felder
 * weiterveröffentlicht werden dürfen, steht dort und nicht hier.
 *
 * Deshalb zwei Riegel statt einem:
 *
 *   `LIGHTCAST_ENABLED` muss ausdrücklich auf `true` stehen. Nur
 *   Zugangsdaten zu hinterlegen reicht nicht — sonst schaltet sich die
 *   Quelle in dem Moment ein, in dem jemand zum Ausprobieren einen
 *   Schlüssel einträgt.
 *
 *   Die Policy Engine muss sie freigeben. Der Verzeichniseintrag steht
 *   auf `pending_review`, bis jemand den Vertrag gelesen und die
 *   erlaubten Felder eingetragen hat.
 *
 * Was hier bewusst FEHLT: eine Annahme darüber, welche Felder
 * angezeigt werden dürfen. `allowedFields` kommt aus dem Verzeichnis,
 * und dort steht, was im Vertrag steht.
 */

const AUTH_URL = "https://auth.emsicloud.com/connect/token";
const API_URL = "https://emsiservices.com/jpa";

interface Token {
  value: string;
  expiresAt: number;
}

export interface LightcastOptions {
  clientId?: string;
  clientSecret?: string;
  enabled?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class LightcastAdapter implements JobSourceAdapter {
  readonly key = "lightcast_global";
  readonly displayName = "Lightcast";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "unclear" as const;
  readonly attributionRequired = true;
  readonly attributionText = "Arbeitsmarktdaten von Lightcast.";
  readonly termsUrl = "https://docs.lightcast.dev";

  /**
   * Die Fähigkeiten stehen hier, obwohl nichts läuft. Sie beschreiben,
   * was die Schnittstelle kann — nicht, was wir zeigen dürfen. Das
   * zweite entscheidet der Vertrag.
   */
  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: true,
    since: true,
    maxPerRequest: 100,
    rateLimitPerMinute: null,
    salary: true,
    expiry: true,
    structuredRequirements: true,
  };

  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly enabled: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private token: Token | null = null;

  constructor(options: LightcastOptions = {}) {
    this.clientId = options.clientId ?? process.env.LIGHTCAST_CLIENT_ID;
    this.clientSecret = options.clientSecret ?? process.env.LIGHTCAST_CLIENT_SECRET;
    this.enabled = options.enabled ?? process.env.LIGHTCAST_ENABLED === "true";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Beides muss stimmen.
   *
   * Zugangsdaten allein schalten nichts ein. Wer einen Schlüssel zum
   * Ausprobieren einträgt, soll damit keinen kostenpflichtigen Abruf
   * auslösen — und keinen, dessen Anzeigerechte niemand geprüft hat.
   */
  isConfigured(): boolean {
    return this.enabled && Boolean(this.clientId) && Boolean(this.clientSecret);
  }

  /** Was genau fehlt. Für die Betriebsansicht, nicht für Protokolle. */
  missingRequirement(): string | null {
    if (!this.clientId || !this.clientSecret) {
      return "Zugangsdaten fehlen (LIGHTCAST_CLIENT_ID, LIGHTCAST_CLIENT_SECRET).";
    }
    if (!this.enabled) {
      return (
        "Zugangsdaten liegen vor, aber LIGHTCAST_ENABLED steht nicht auf true. " +
        "Der Schalter ist Absicht: die Lizenz bestimmt, welche Felder gezeigt werden dürfen, " +
        "und das gehört geprüft, bevor abgerufen wird."
      );
    }
    return null;
  }

  private async accessToken(signal?: AbortSignal): Promise<string> {
    // Ein gültiges Token wiederverwenden. Jeder Abruf ein neues zu
    // holen kostet bei einem kostenpflichtigen Anbieter Geld für nichts.
    if (this.token && this.token.expiresAt > this.now() + 30_000) {
      return this.token.value;
    }

    const response = await this.fetchImpl(AUTH_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: mitFrist(signal),
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        grant_type: "client_credentials",
        scope: "emsi_open",
      }),
    });

    if (!response.ok) {
      // Der Antworttext kann die Zugangsdaten enthalten. Nur der Code.
      throw new Error(`Lightcast-Anmeldung fehlgeschlagen (${response.status}).`);
    }

    const daten = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!daten.access_token) throw new Error("Lightcast hat kein Token geliefert.");

    this.token = {
      value: daten.access_token,
      expiresAt: this.now() + (daten.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    const fehlt = this.missingRequirement();
    if (fehlt) {
      // Kein leeres Array: das sähe aus wie „keine Stellen gefunden"
      // und erschiene im Bericht als erfolgreicher Abruf.
      throw new Error(`Lightcast wird nicht abgerufen. ${fehlt}`);
    }

    const token = await this.accessToken(options.signal);
    const response = await this.fetchImpl(`${API_URL}/postings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      signal: mitFrist(options.signal),
      body: JSON.stringify({
        filter: {
          when: options.since
            ? { start: options.since.toISOString().slice(0, 10) }
            : { start: "active" },
        },
        limit: Math.min(options.limit ?? 100, this.capabilities.maxPerRequest),
      }),
    });

    if (!response.ok) throw new Error(`Lightcast antwortet mit ${response.status}.`);

    const daten = (await response.json()) as { data?: unknown[] };
    return parseLightcast(daten);
  }
}

/**
 * Die Antwort in unsere Form bringen.
 *
 * Ausgelagert und exportiert, damit sie ohne Vertrag und ohne Netz
 * geprüft werden kann. Ein Adapter, dessen Auslegung des Formats erst
 * am Tag der Vertragsunterschrift zum ersten Mal läuft, ist ein Adapter
 * ohne Aussage.
 */
export function parseLightcast(payload: unknown): RawListing[] {
  const rows = (payload as { data?: unknown[] })?.data;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((raw): RawListing[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const j = raw as Record<string, unknown>;

    const id = text(j.id);
    const title = text(j.title) ?? text(j.title_clean);
    const url = text(j.url) ?? text(j.original_url);
    if (!id || !title || !url) return [];

    return [{
      externalId: `lightcast:${id}`,
      title,
      companyName: text(j.company_name) ?? text(j.company) ?? "Nicht angegeben",
      location: text(j.city_name) ?? text(j.state_name) ?? "Nicht angegeben",
      description: text(j.body) ?? "",
      originalUrl: url,
      publishedAt: datum(j.posted),
      raw: {
        provider: "lightcast",
        // Gehalt nur, wenn es geliefert wird. Ein fehlender Wert ist
        // „nicht angegeben“, nie eine Null.
        salaryMin: typeof j.salary_from === "number" ? j.salary_from : null,
        salaryMax: typeof j.salary_to === "number" ? j.salary_to : null,
        expired: datum(j.expired),
      },
    }];
  });
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function datum(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
