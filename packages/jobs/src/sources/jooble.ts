import type { ProviderCapabilities } from "../adapter.ts";
import { envWert, mitFrist } from "../net.ts";
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

/*
 * Der Host gehört zum Schlüssel, nicht zur Bequemlichkeit.
 *
 * Gemessen am 4.9.2026 mit demselben DE-Schlüssel, von derselben
 * Leitung, in derselben Minute:
 *   POST https://jooble.org/api/<schluessel>     -> 403 (Cloudflare, HTML)
 *   POST https://de.jooble.org/api/<schluessel>  -> 200, totalCount 68.358
 *
 * Die 403 kam also nie von einem Bot-Schutz gegen unsere Adresse,
 * sondern davon, dass ein länderspezifischer Schlüssel gegen den
 * länderlosen Host lief. Ein Schlüssel für DE gilt nur auf de., einer
 * für AT nur auf at. — deshalb steht der Host hier neben dem Land und
 * nicht als Konstante an der Abrufstelle.
 */
/** Gemessen am 8. September 2026: Jooble liefert 30 Anzeigen je Seite. */
const JE_SEITE = 30;

/** Eine Sekunde zwischen zwei Seiten. Jooble nennt kein Kontingent. */
const ABSTAND_MS = 1_000;

const LAND: Record<JoobleCountry, { name: string; code: string; standardOrt: string; host: string }> = {
  de: { name: "Deutschland", code: "DE", standardOrt: "Deutschland", host: "de.jooble.org" },
  ch: { name: "Schweiz", code: "CH", standardOrt: "Schweiz", host: "ch.jooble.org" },
  at: { name: "Österreich", code: "AT", standardOrt: "Österreich", host: "at.jooble.org" },
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
      /*
       * Der Name wird zusammengesetzt: JOOBLE_API_KEY_DE,
       * JOOBLE_API_KEY_AT, JOOBLE_API_KEY_CH. Jooble vergibt den
       * Schlüssel je Land, ein gemeinsamer funktioniert nicht.
       *
       * Die drei Namen stehen hier ausgeschrieben, weil sie sonst
       * nirgends im Quelltext vorkommen — und eine Umgebungsvariable,
       * die man nur findet, wenn man die Zusammensetzung im Kopf
       * nachvollzieht, ist praktisch undokumentiert. Der Wächtertest
       * über `.env.example` prüft genau das.
       */
      envWert(`JOOBLE_API_KEY_${this.country.toUpperCase()}`) ??
      // Ältere Schreibweise ohne Land, nur für Deutschland. Sie stand
      // in bestehenden .env-Dateien, während .env.example schon die
      // Länderfassung dokumentierte — eine Drift, die niemand bemerkt,
      // weil sie sich als "nicht eingerichtet" tarnt.
      (this.country === "de" ? envWert("JOOBLE_API_KEY") : undefined);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.keywords = options.keywords ??
      envWert("JOOBLE_KEYWORDS") ??
      /*
       * Ein Suchbegriff muss sein.
       *
       * Jooble braucht `keywords`; leer zu senden ist keine Anfrage
       * „alles", sondern eine unvollständige Anfrage. Diese Vorgabe ist
       * der Ausgangsbestand für den Bestandsabruf und bewusst breit.
       */
      "Kundenbetreuung Sachbearbeitung Vertrieb Logistik";
    this.location = options.location ?? envWert("JOOBLE_LOCATION") ?? land.standardOrt;
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
    /* Gemessen: 30 je Seite, nicht 100. Der frühere Wert war eine
       Annahme — und weil der Adapter nur eine Seite holte, fiel sie
       nie auf. */
    maxPerRequest: JE_SEITE,
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

    /*
     * ══════════════════════════════════════════════════════════════
     * Geblättert wird, bis nichts Neues mehr kommt
     * ══════════════════════════════════════════════════════════════
     *
     * Hier stand `page: "1"` fest eingetragen — eine einzige Anfrage,
     * und der Rest von Jooble blieb unsichtbar. Gemessen am
     * 8. September 2026: Egal ob 25, 100 oder 2000 Anzeigen angefragt
     * wurden, es kamen genau 30. Das sah aus wie eine Grenze des
     * Anbieters und war unsere eigene.
     *
     * `maxPerRequest: 100` in den Fähigkeiten war damit ebenfalls
     * falsch: Jooble liefert 30 je Seite.
     *
     * ── Woran der Lauf endet ────────────────────────────────────
     *
     * An drei Dingen, und keines davon ist eine geratene Seitenzahl:
     * eine nicht volle Seite, eine Seite ohne eine einzige neue
     * Anzeige, oder das erreichte Ziel. Die zweite Bedingung fängt
     * den Fall ab, dass Jooble jenseits einer inneren Decke dieselben
     * Ergebnisse wiederholt — genau das tut Careerjet ab Seite zehn.
     */
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();
    const ziel = options.limit ?? 50;
    let response!: Response;

    for (let seite = 1; raus.length < ziel; seite++) {
      /* Zwischen zwei Seiten wird gewartet, vor der ersten nicht. */
      if (seite > 1) await new Promise((f) => setTimeout(f, ABSTAND_MS));

      response = await this.fetchImpl(`https://${LAND[this.country].host}/api/${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: mitFrist(options.signal),
        body: JSON.stringify({
          keywords: this.keywords,
          location: this.location,
          page: String(seite),
        }),
      });

      if (!response.ok) break;

      const daten = (await response.json()) as { jobs?: JoobleJob[] };
      const treffer = daten.jobs ?? [];
      let neuAufSeite = 0;
      for (const j of treffer) {
        const l = this.toRawListing(j);
        if (gesehen.has(l.externalId)) continue;
        gesehen.add(l.externalId);
        raus.push(l);
        neuAufSeite++;
        if (raus.length >= ziel) break;
      }

      if (treffer.length === 0 || neuAufSeite === 0) break;
      if (treffer.length < JE_SEITE) break;
    }

    if (raus.length > 0) return raus.slice(0, ziel);

    /* Nichts geholt: Dann muss der Fehler laut sein — eine leere Liste
       sähe aus wie eine Quelle ohne Stellen. */
    if (!response.ok) {
      /*
       * Eine 403 von Jooble heisst „falscher Host", nicht „falscher
       * Schlüssel" und nicht „gesperrte Adresse".
       *
       * Die frühere Fassung rief jooble.org ohne Länderpräfix ab und
       * bekam eine HTML-Sperrseite von Cloudflare. Daraus wurde erst
       * auf einen abgelaufenen Zugang geschlossen — ein neuer
       * Schlüssel wurde beschafft und änderte nichts — und dann auf
       * eine Adresssperre, die Jooble hätte aufheben müssen. Beides
       * war falsch: derselbe Schlüssel liefert auf de.jooble.org
       * sofort 200. Ein länderspezifischer Schlüssel gilt nur auf dem
       * Host seines Landes.
       *
       * Deshalb nennt die Meldung jetzt den tatsächlich verwendeten
       * Host. Eine Meldung, die den Adressaten des Problems verfehlt,
       * kostet mehr Zeit als gar keine.
       */
      const koerper = await response.text().catch(() => "");
      const sperrseite = /^\s*<(!doctype|html)/i.test(koerper);
      throw new Error(
        sperrseite
          ? `Jooble: ${response.status} als HTML-Sperrseite von ${LAND[this.country].host} ` +
            `(${response.headers.get("server") ?? "unbekannter Dienst"}). ` +
            `Ein Schlüssel für ${LAND[this.country].code} gilt nur auf diesem Host — ` +
            `prüfe, ob JOOBLE_API_KEY_${this.country.toUpperCase()} zum Land passt.`
          : `Jooble (${LAND[this.country].host}) antwortete mit ${response.status}. Es werden keine Stellen übernommen.`,
      );
    }

    return raus;
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
