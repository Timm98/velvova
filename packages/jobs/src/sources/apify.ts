import type { Herkunft } from "@paycheck/domain";
import {
  DEFAULT_CAPABILITIES,
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { envWert, holJson } from "../net.ts";
import { zuRawListing as ausDatensatzZeile } from "./brightdata.ts";

/**
 * Apify — nur ausdrücklich freigegebene Actors.
 *
 * ── Die Freigabeliste ist der ganze Punkt ──────────────────────
 *
 * Ein Apify-Token öffnet den gesamten Store, und darin steht alles, was
 * wir nicht dürfen: Sammler für LinkedIn, Indeed, StepStone, XING. Ein
 * Adapter, der „irgendeinen Job-Actor" nimmt, wäre ein Scraper mit
 * Zwischenhändler.
 *
 * Deshalb läuft hier nichts ohne `APIFY_ACTORS`. Kein Standardwert,
 * keine Vorauswahl, kein „wenn leer, dann der übliche". Leere Liste
 * heisst: eingerichtet, aber nichts freigegeben — und der Adapter fragt
 * nichts ab. Wer einen Actor hinzufügt, trifft damit eine ausdrückliche
 * Entscheidung, und die steht in der Konfiguration statt im Code.
 *
 * ── Was ein Actor liefert ──────────────────────────────────────
 *
 * Freie Datensätze mit je eigenen Feldnamen. Die Zuordnung teilt sich
 * dieser Adapter deshalb mit Bright Data: dort steht dieselbe
 * vorsichtige Regel, und zwei Kopien davon würden früher oder später
 * auseinanderlaufen.
 */

export interface ApifyOptions {
  token?: string;
  /** Freigegebene Actors, z. B. `nutzer~mein-actor`. */
  actors?: string[];
  /** Eingabe je Actor. Ohne Eintrag läuft er mit seiner Vorgabe. */
  eingaben?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}

export class ApifyAdapter implements JobSourceAdapter {
  readonly key = "apify";
  readonly displayName = "Apify";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "external_api";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten über einen freigegebenen Apify-Actor.";
  readonly termsUrl = "https://apify.com/terms-of-use";

  private readonly token?: string;
  private readonly actors: string[];
  private readonly eingaben: Record<string, unknown>;
  private readonly fetchImpl?: typeof fetch;

  constructor(o: ApifyOptions = {}) {
    this.token = o.token ?? envWert("APIFY_TOKEN");
    this.actors = o.actors ?? liste(envWert("APIFY_ACTORS"));
    this.eingaben = o.eingaben ?? {};
    this.fetchImpl = o.fetchImpl;
  }

  readonly capabilities: ProviderCapabilities = {
    ...DEFAULT_CAPABILITIES,
    search: false,
    details: false,
    since: false,
    maxPerRequest: 500,
    rateLimitPerMinute: null,
    salary: false,
    expiry: false,
    structuredRequirements: false,
  };

  isConfigured(): boolean {
    return Boolean(this.token) && this.erlaubteActors().length > 0;
  }

  /** Die freigegebenen Actors ohne die gesperrten Ziele. */
  erlaubteActors(): string[] {
    return this.actors.filter((a) => gesperrterActor(a) === null);
  }

  /** Was eingetragen, aber gesperrt ist — für die Betriebsansicht. */
  gesperrteActors(): { actor: string; ziel: string }[] {
    return this.actors
      .map((actor) => ({ actor, ziel: gesperrterActor(actor) }))
      .filter((x): x is { actor: string; ziel: string } => x.ziel !== null);
  }

  hatToken(): boolean {
    return Boolean(this.token);
  }

  /** Was freigegeben ist — für die Betriebsansicht. */
  freigegebeneActors(): string[] {
    return [...this.actors];
  }

  /** Wer der Token gehört. Zum Prüfen der Verbindung, ohne einen Actor zu starten. */
  async konto(signal?: AbortSignal): Promise<{ username?: string; plan?: string }> {
    if (!this.token) throw new Error("Apify: APIFY_TOKEN fehlt.");
    const a = await holJson<{ data?: { username?: string; plan?: { id?: string } } }>({
      provider: "Apify",
      url: "https://api.apify.com/v2/users/me",
      headers: { authorization: `Bearer ${this.token}` },
      signal,
      fetchImpl: this.fetchImpl,
    });
    return { username: a.data?.username, plan: a.data?.plan?.id };
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.token) {
      throw new Error("Apify ist nicht eingerichtet: APIFY_TOKEN fehlt. Es wird nichts abgerufen.");
    }
    if (this.erlaubteActors().length === 0) {
      const gesperrt = this.gesperrteActors();
      throw new Error(
        gesperrt.length > 0
          ? `Apify hat ein Token, aber kein verwendbarer Actor ist freigegeben. Eingetragen und gesperrt: ` +
            gesperrt.map((g) => `"${g.actor}" (zielt auf ${g.ziel})`).join(", ") +
            `. Das automatisierte Auslesen dieser Quellen ist untersagt — daran ändert ein Dienstleister dazwischen nichts. ` +
            `Trage einen Actor ein, der eine Quelle liest, die wir verwenden dürfen.`
          : "Apify hat ein Token, aber keinen freigegebenen Actor (APIFY_ACTORS ist leer). " +
            "Das ist Absicht: ein Token ist keine Erlaubnis, eine beliebige Quelle abzugreifen. " +
            "Trage die Actors ein, die verwendet werden dürfen.",
      );
    }

    const raus: RawListing[] = [];
    for (const actor of this.actors) {
      /*
       * Vor dem Start, nicht danach.
       *
       * Ein gesperrter Actor wird übersprungen und laut gemeldet — er
       * darf den Lauf nicht abbrechen, denn dann fielen auch die
       * erlaubten Actors aus, und jemand würde die Sperre entfernen,
       * um überhaupt wieder Ergebnisse zu bekommen.
       */
      const gesperrt = gesperrterActor(actor);
      if (gesperrt) {
        console.warn(
          `[apify] Actor "${actor}" wird NICHT ausgeführt: er zielt auf ${gesperrt}. ` +
            `Das automatisierte Auslesen dieser Quelle ist untersagt. ` +
            `Nimm ihn aus APIFY_ACTORS oder beschaffe eine Lizenz für die Quelle.`,
        );
        continue;
      }
      const url = new URL(
        `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`,
      );
      if (options.limit) url.searchParams.set("limit", String(options.limit));

      const zeilen = await holJson<Record<string, unknown>[]>({
        provider: `Apify (${actor})`,
        url: url.toString(),
        method: "POST",
        headers: { authorization: `Bearer ${this.token}` },
        body: this.eingaben[actor] ?? {},
        signal: options.signal,
        /*
         * Ein Actor läuft, er antwortet nicht bloss. Zwölf Sekunden
         * wie bei einer Suchschnittstelle wären hier fast immer ein
         * Abbruch kurz vor dem Ergebnis.
         */
        timeoutMs: 120_000,
        versuche: 1,
        fetchImpl: this.fetchImpl,
      });

      for (const z of Array.isArray(zeilen) ? zeilen : []) {
        const r = ausDatensatzZeile(z);
        if (r) raus.push({ ...r, externalId: `${actor}:${r.externalId}` });
      }
    }
    return options.limit ? raus.slice(0, options.limit) : raus;
  }
}

function liste(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Quellen, die wir nicht abgreifen dürfen.
 *
 * Die Liste steht im Code und nicht in der Konfiguration, und das ist
 * der Punkt: eine Regel, die man durch Eintragen einer Umgebungsvariable
 * aufheben kann, ist keine Regel. Diese Portale untersagen das
 * automatisierte Auslesen in ihren Nutzungsbedingungen. Über Apify zu
 * gehen ändert daran nichts — es schiebt nur einen Dienstleister
 * dazwischen.
 *
 * Der Anlass war konkret: in `APIFY_ACTORS` stand
 * `curious_coder~linkedin-jobs-scraper`, und der Adapter hat ihn
 * anstandslos gestartet. Ein Actor-Name ist Konfiguration, und
 * Konfiguration wird eingetragen, kopiert und vergessen — die Prüfung
 * muss deshalb dort sitzen, wo sie niemand aus Versehen umgeht.
 */
const GESPERRTE_ZIELE = [
  "linkedin",
  "indeed",
  "stepstone",
  "monster",
  "xing",
  "glassdoor",
  "kununu",
  "google-jobs",
  "googlejobs",
];

export function gesperrterActor(actor: string): string | null {
  const n = actor.toLowerCase();
  const treffer = GESPERRTE_ZIELE.find((z) => n.includes(z));
  return treffer ?? null;
}
