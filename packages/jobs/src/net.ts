/**
 * Die eine Stelle, an der dieses Paket ins Netz greift.
 *
 * Fünf Anbieter, fünf Arten zu scheitern — aber nur eine Art, damit
 * umzugehen. Was hier steht, steht deshalb nicht fünfmal in den
 * Adaptern:
 *
 *   **Zeitgrenze.** Ohne sie hält eine hängende Verbindung die ganze
 *   Jobseite auf. Ein Anbieter, der nicht antwortet, ist kein Grund,
 *   niemandem etwas zu zeigen.
 *
 *   **Wiederholung nur, wo sie hilft.** Bei 429 und 5xx, mit
 *   wachsendem Abstand. Bei 401, 403 und 404 nicht: ein falscher
 *   Schlüssel wird beim dritten Versuch nicht richtig, und drei
 *   Versuche verbrennen nur Kontingent.
 *
 *   **Fehler, die man lesen kann.** Statuscode, Anbieter und der
 *   Anfang der Antwort des Anbieters. Ohne die Antwort ist „500" eine
 *   Sackgasse; mit ihr steht meistens dabei, ob es am Plan, am
 *   Schlüssel oder am Format lag.
 *
 *   **Nie der Schlüssel.** Kein Feld dieser Fehler enthält je einen
 *   Kopfzeilenwert. Fehlermeldungen landen in Logs, Logs werden
 *   weitergereicht.
 */

export class ProviderHttpError extends Error {
  /*
   * Felder ausgeschrieben statt als Parameter-Properties.
   *
   * Dieses Paket wird von Skripten direkt als `.ts` ausgeführt, und
   * Node entfernt Typen nur — es baut nichts um. Eine
   * Parameter-Property ist aber keine Typangabe, sondern erzeugt Code,
   * und der Start bricht mit ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX ab.
   * Der Typprüfer sieht das nicht; erst der Rauchtest.
   */
  readonly provider: string;
  readonly status: number;
  readonly antwort: string;
  readonly url: string;

  constructor(provider: string, status: number, antwort: string, url: string) {
    super(`${provider}: HTTP ${status} — ${antwort.slice(0, 300)}`);
    this.name = "ProviderHttpError";
    this.provider = provider;
    this.status = status;
    this.antwort = antwort;
    this.url = url;
  }

  /**
   * Die wahrscheinliche Ursache in einem Satz.
   *
   * Kein Ersatz für die Antwort des Anbieters, sondern der erste
   * Verdacht — damit niemand bei „403" anfangen muss zu raten,
   * ob der Schlüssel falsch ist oder der Plan zu klein.
   */
  get verdacht(): string {
    if (this.status === 401) return "Schlüssel fehlt oder ist ungültig.";
    if (this.status === 403) return "Schlüssel gültig, aber der Plan gibt diesen Endpunkt nicht her.";
    if (this.status === 404) return "Endpunkt gibt es nicht (oder nicht für diesen Account).";
    if (this.status === 422 || this.status === 400) return "Anfrageformat passt nicht zur Schnittstelle.";
    if (this.status === 429) return "Kontingent oder Taktgrenze erreicht.";
    if (this.status >= 500) return "Störung beim Anbieter.";
    return "Unerwartete Antwort.";
  }
}

import { merkeErfolg, merkeFehler } from "./nutzung.ts";

export interface HolOptions {
  provider: string;
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  /** Millisekunden bis zum Abbruch. */
  timeoutMs?: number;
  versuche?: number;
  fetchImpl?: typeof fetch;
}

/** Bei diesen Codes ist ein weiterer Versuch sinnvoll. */
function nochmal(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function holJson<T>(o: HolOptions): Promise<T> {
  /*
   * Gezählt wird hier und sonst nirgends.
   *
   * Jeder Anbieter geht durch diese Funktion; ein Zähler je Adapter
   * hiesse fünf Stellen, an denen einer vergessen werden kann — und
   * ein vergessener Zähler sieht in der Betriebsansicht aus wie ein
   * ungenutzter Anbieter.
   */
  const begonnen = Date.now();
  const f = o.fetchImpl ?? fetch;
  const versuche = o.versuche ?? 3;
  const timeout = o.timeoutMs ?? 12_000;
  let letzter: unknown;

  for (let i = 0; i < versuche; i++) {
    const abbruch = new AbortController();
    const uhr = setTimeout(() => abbruch.abort(), timeout);
    /*
     * Das äussere Signal muss durchschlagen.
     *
     * Ohne diese Verbindung läuft die Anfrage weiter, nachdem der
     * Aufrufer längst aufgegeben hat — und ein abgebrochener
     * Seitenaufruf kostet trotzdem Kontingent.
     */
    const weiterleiten = () => abbruch.abort();
    o.signal?.addEventListener("abort", weiterleiten, { once: true });

    try {
      const antwort = await f(o.url, {
        method: o.method ?? "GET",
        headers: {
          accept: "application/json",
          ...(o.body ? { "content-type": "application/json" } : {}),
          ...o.headers,
        },
        body: o.body ? JSON.stringify(o.body) : undefined,
        signal: abbruch.signal,
      });

      if (!antwort.ok) {
        const text = await antwort.text().catch(() => "");
        const fehler = new ProviderHttpError(o.provider, antwort.status, text, o.url);
        if (nochmal(antwort.status) && i < versuche - 1) {
          letzter = fehler;
          await warte(400 * 2 ** i);
          continue;
        }
        merkeFehler(o.provider, antwort.status, text);
        throw fehler;
      }

      const daten = (await antwort.json()) as T;
      merkeErfolg(o.provider, Date.now() - begonnen, Array.isArray(daten) ? daten.length : 0);
      return daten;
    } catch (e) {
      // Abbruch von aussen ist kein Fehler des Anbieters.
      if (o.signal?.aborted) throw e;
      letzter = e;
      const zeitueberschreitung = e instanceof Error && e.name === "AbortError";
      if ((zeitueberschreitung || !(e instanceof ProviderHttpError)) && i < versuche - 1) {
        await warte(400 * 2 ** i);
        continue;
      }
      merkeFehler(o.provider, null, e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      clearTimeout(uhr);
      o.signal?.removeEventListener("abort", weiterleiten);
    }
  }

  throw letzter instanceof Error ? letzter : new Error(`${o.provider}: unbekannter Fehler`);
}

function warte(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Einen Umgebungswert lesen und eine bekannte Fehlbedienung heilen.
 *
 * In eine `.env` gerät leicht `RAPIDAPI_KEY=RAPIDAPI_KEY=abc…`, wenn
 * jemand eine ganze Zeile in ein Feld kopiert, das schon den Namen
 * enthält. Der Wert ist dann still falsch, der Anbieter antwortet mit
 * 401, und die Suche geht nach dem Schlüssel — der ja richtig aussieht.
 *
 * Deshalb: den eigenen Namen am Anfang abschneiden, dazu Anführungs-
 * zeichen und Leerraum. Nur der eigene Name, nichts sonst — ein
 * Schlüssel, der zufällig so anfängt, bleibt unberührt, weil das
 * Gleichheitszeichen dahinterstehen muss.
 */
export function envWert(name: string): string | undefined {
  const roh = process.env[name];
  if (!roh) return undefined;
  let w = roh.trim().replace(/^["']|["']$/g, "").trim();
  while (w.startsWith(`${name}=`)) w = w.slice(name.length + 1).trim();
  return w.length > 0 ? w : undefined;
}
