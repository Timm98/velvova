import { envWert, holJson, ProviderHttpError } from "../net.ts";

/**
 * Coresignal — Anreicherung von Unternehmen.
 *
 * ── Warum das kein JobSourceAdapter ist ────────────────────────
 *
 * Coresignal beantwortet eine andere Frage als die übrigen Anbieter.
 * Die liefern Stellen; Coresignal sagt etwas über das Unternehmen
 * dahinter — Grösse, Branche, Hauptsitz, Domain. Es als Jobquelle zu
 * registrieren hiesse, es bei jeder Suche mitlaufen zu lassen, und das
 * ist genau das teure Verhalten, das vermieden werden soll: eine
 * Abfrage je Stelle, bei tausend Stellen tausend Abfragen — bei einem
 * Anbieter, der je Abfrage abrechnet.
 *
 * Angereichert wird deshalb nur, was jemand tatsächlich öffnet.
 *
 * ── Zwei Schritte, und der zweite ist der wichtige ─────────────
 *
 * `search/filter` gibt nur Kennungen zurück, `collect/{id}` den
 * Datensatz. Dazwischen gehört eine Prüfung, die es beinahe nicht
 * gegeben hätte: die Suche nach `sap.com` liefert als ersten Treffer
 * „SAP Moment Marketing". Wer den ersten Treffer nimmt, hängt einer
 * Stelle die falsche Firma an — mit Mitarbeiterzahl, Branche und
 * Hauptsitz, alles plausibel und alles falsch.
 *
 * `passt()` verlangt deshalb, dass die Domain wirklich übereinstimmt
 * oder der Name deutlich näher liegt als bei den übrigen Treffern. Im
 * Zweifel: nichts. Keine Anreicherung ist ein sichtbares Loch,
 * eine falsche ist eine unsichtbare Falschaussage.
 *
 * ── Was der Plan hergibt, wurde gemessen, nicht angenommen ─────
 *
 * `pruefeZugang()` fragt die dokumentierten Pfade ab und meldet je Pfad
 * den Code. Gemessen am 2026-08-31 mit unserem Schlüssel:
 * `company_base` 200, `job_base` 200, `company_multi_source` 404
 * („no Route matched") — den gibt es für diesen Account nicht.
 */

const BASIS = "https://api.coresignal.com/cdapi/v2";

/**
 * Wie viele Kandidaten höchstens abgeholt werden.
 *
 * Jeder kostet zehn Einheiten, auch der verworfene. Drei ist die
 * Grenze, ab der ein Namenstreffer noch plausibel ist — darüber ist
 * die Suche zu unscharf, und `passt()` würde ohnehin alles verwerfen.
 */
const MAX_KANDIDATEN = 3;

/**
 * Die geprüften Sammlungen mit einem Anfragekörper, der wirklich passt.
 *
 * Der erste Anlauf schickte `{company_name}` und bekam 422 mit
 * „Extra inputs are not permitted" — das Feld heisst `name`. Genau
 * dafür ist diese Prüfung da: sie unterscheidet „der Plan gibt das
 * nicht her" von „meine Anfrage war falsch", und ohne sie sähe beides
 * gleich aus.
 */
export const SAMMLUNGEN = [
  { name: "company_base", pfad: `${BASIS}/company_base/search/filter`, koerper: { name: "SAP" }, zweck: "Unternehmen" },
  { name: "company_multi_source", pfad: `${BASIS}/company_multi_source/search/filter`, koerper: { company_name: "SAP" }, zweck: "Unternehmen, mehrere Quellen" },
  { name: "job_base", pfad: `${BASIS}/job_base/search/filter`, koerper: { title: "Customer Success" }, zweck: "Stellen" },
] as const;

export interface ZugangsBefund {
  name: string;
  zweck: string;
  status: number | null;
  offen: boolean;
  hinweis: string;
}

export interface Unternehmensdaten {
  name: string | null;
  website: string | null;
  branche: string | null;
  groesse: string | null;
  hauptsitz: string | null;
  gegruendet: number | null;
  /** Woran die Zuordnung hing. Ohne das ist die Anreicherung nicht prüfbar. */
  zugeordnetUeber: "domain" | "name";
}

export interface CoresignalOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /**
   * Das Land, mit dem eine unscharfe Suche nachgeschärft wird.
   *
   * Kostenlos und wirksam: „TEDi" liefert 122 Kandidaten, „TEDi" mit
   * Land 18. Ohne Land wird nicht nachgeschärft, sondern verworfen.
   */
  land?: string;
}

export class CoresignalEnrichment {
  readonly key = "coresignal";
  readonly displayName = "Coresignal";

  private readonly apiKey?: string;
  private readonly fetchImpl?: typeof fetch;
  /** Land zum kostenlosen Nachschärfen einer unscharfen Suche. */
  private readonly land?: string;
  /*
   * Gedächtnis für den Prozess — auch für Fehlschläge.
   *
   * Ohne das fragt eine Liste mit zwanzig Stellen desselben
   * Arbeitgebers zwanzigmal dasselbe. Und ohne die Fehlschläge fragt
   * sie zwanzigmal einen gesperrten Endpunkt: aus einem
   * Konfigurationsproblem würde eine Rechnung.
   */
  private readonly gedaechtnis = new Map<string, Unternehmensdaten | null>();

  constructor(o: CoresignalOptions = {}) {
    this.apiKey = o.apiKey ?? envWert("CORESIGNAL_API_KEY");
    this.fetchImpl = o.fetchImpl;
    this.land = o.land;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async pruefeZugang(signal?: AbortSignal): Promise<ZugangsBefund[]> {
    if (!this.apiKey) throw new Error("Coresignal: CORESIGNAL_API_KEY fehlt.");
    const raus: ZugangsBefund[] = [];

    for (const s of SAMMLUNGEN) {
      try {
        await holJson<unknown>({
          provider: `Coresignal ${s.name}`,
          url: s.pfad,
          method: "POST",
          headers: { apikey: this.apiKey },
          body: s.koerper,
          signal,
          versuche: 1,
          timeoutMs: 15_000,
          fetchImpl: this.fetchImpl,
        });
        raus.push({ name: s.name, zweck: s.zweck, status: 200, offen: true, hinweis: "zugänglich" });
      } catch (e) {
        const status = e instanceof ProviderHttpError ? e.status : null;
        raus.push({
          name: s.name,
          zweck: s.zweck,
          status,
          /*
           * Nur 200 heisst offen.
           *
           * Der erste Anlauf wertete 404 als „zugänglich" — mit der
           * Begründung, eine Suche ohne Treffer sei ja kein
           * Zugriffsfehler. Die Antwort lautete aber „no Route matched
           * with those values": den Pfad gibt es nicht. Der Bericht
           * meldete daraufhin eine Sammlung als verfügbar, die es nicht
           * ist — genau die Sorte Falschaussage, gegen die dieser
           * Rauchtest gebaut wurde.
           */
          offen: false,
          hinweis:
            e instanceof ProviderHttpError
              ? `${e.verdacht} ${e.antwort.slice(0, 120).replace(/\s+/g, " ")}`
              : e instanceof Error
                ? e.message.slice(0, 120)
                : "unbekannt",
        });
      }
    }
    return raus;
  }

  /**
   * Ein Unternehmen anreichern — oder ehrlich nichts liefern.
   *
   * Wirft nie. Eine Anreicherung, die fehlschlägt, darf keine Jobseite
   * umbringen; sie ist ein Extra, kein Bestandteil.
   */
  async unternehmen(
    name: string,
    domain?: string | null,
    signal?: AbortSignal,
  ): Promise<Unternehmensdaten | null> {
    if (!this.apiKey) return null;
    const schluessel = (domain ?? name).toLowerCase().trim();
    if (this.gedaechtnis.has(schluessel)) return this.gedaechtnis.get(schluessel) ?? null;

    const ergebnis = await this.suchen(name, domain, signal).catch(() => null);
    this.gedaechtnis.set(schluessel, ergebnis);
    return ergebnis;
  }

  private async suchen(
    name: string,
    domain: string | null | undefined,
    signal?: AbortSignal,
  ): Promise<Unternehmensdaten | null> {
    /*
     * ── Suchen ist frei, Abholen kostet ───────────────────────
     *
     * Gemessen am 3.9.2026: Eine Suche kostet null Einheiten, egal ob
     * sie einen oder 122 Kandidaten liefert. Ein einzelner Datensatz
     * kostet **zehn**.
     *
     * Die erste Fassung holte bis zu fünf Kandidaten und liess
     * `passt()` darüber urteilen. Das ist fachlich richtig und
     * wirtschaftlich falsch: Gemessen an fünfzig Firmen kostete ein
     * Treffer **37 Einheiten** — bezahlt wurde auch jeder verworfene
     * Kandidat. Die 18.293 wichtigsten Arbeitgeber anzureichern hätte
     * damit rund 677.000 Einheiten gekostet.
     *
     * Also erst kostenlos eingrenzen, dann gezielt abholen.
     */
    const suche = async (koerper: Record<string, unknown>) =>
      holJson<number[]>({
        provider: "Coresignal",
        url: `${BASIS}/company_base/search/filter`,
        method: "POST",
        headers: { apikey: this.apiKey! },
        body: koerper,
        signal,
        versuche: 1,
        timeoutMs: 15_000,
        fetchImpl: this.fetchImpl,
      }).catch(() => null);

    let ids = await suche(domain ? { website: domain } : { name });

    /*
     * Zu viele Kandidaten? Mit dem Land nachschärfen.
     *
     * „TEDi GmbH & Co. KG" liefert genau einen Treffer, „TEDi" 122 und
     * „TEDi" mit Land 18. Der vollständige Name ist also meist schon
     * die beste Suche — wo er es nicht ist, hilft das Land, und beides
     * kostet nichts.
     */
    if (Array.isArray(ids) && ids.length > MAX_KANDIDATEN && this.land) {
      const enger = await suche({ name, country: this.land });
      if (Array.isArray(enger) && enger.length > 0 && enger.length < ids.length) ids = enger;
    }

    if (!Array.isArray(ids) || ids.length === 0) return null;

    /*
     * Zu unklar heisst: gar nicht.
     *
     * Bei mehr als drei Kandidaten würde `passt()` fast immer alles
     * verwerfen — nur eben erst, nachdem jeder Abruf bezahlt ist.
     * Diese Firma bleibt lieber ohne Anreicherung. Ein sichtbares Loch
     * ist billiger als dreissig Einheiten für nichts.
     */
    if (ids.length > MAX_KANDIDATEN) return null;

    for (const id of ids.slice(0, MAX_KANDIDATEN)) {
      const roh = await holJson<Record<string, unknown>>({
        provider: "Coresignal",
        url: `${BASIS}/company_base/collect/${id}`,
        headers: { apikey: this.apiKey! },
        signal,
        versuche: 1,
        timeoutMs: 15_000,
        fetchImpl: this.fetchImpl,
      }).catch(() => null);
      if (!roh) continue;

      const wie = passt(roh, name, domain ?? null);
      if (!wie) continue;

      return {
        name: str(roh.name),
        website: str(roh.website),
        branche: str(roh.industry),
        groesse: str(roh.size),
        hauptsitz:
          [str(roh.headquarters_city), str(roh.headquarters_country)].filter(Boolean).join(", ") || null,
        gegruendet: typeof roh.founded === "number" ? roh.founded : null,
        zugeordnetUeber: wie,
      };
    }
    return null;
  }
}

/**
 * Ist dieser Datensatz wirklich die gesuchte Firma?
 *
 * Über die Domain, wenn wir eine haben — das ist der einzige harte
 * Schlüssel. Sonst über einen Namensvergleich, der Rechtsformen und
 * Zusätze abstreift und danach Gleichheit verlangt, nicht Ähnlichkeit.
 * „SAP" und „SAP Moment Marketing" sind ähnlich und trotzdem
 * verschiedene Unternehmen.
 */
export function passt(
  roh: Record<string, unknown>,
  name: string,
  domain: string | null,
): "domain" | "name" | null {
  if (domain) {
    const h = host(str(roh.website));
    const d = domain.toLowerCase().replace(/^www\./, "");
    if (h && (h === d || h.endsWith(`.${d}`) || d.endsWith(`.${h}`))) return "domain";
    return null;
  }
  const a = kern(name);
  const b = kern(str(roh.name) ?? "");
  return a.length > 1 && a === b ? "name" : null;
}

/** Rechtsform und Zusätze weg, Kleinschreibung, ein Wortabstand. */
function kern(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|ohg|mbh|co|ug|e\.?v|inc|ltd|llc|corp|group|holding|deutschland|germany)\b/g, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function host(u: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
