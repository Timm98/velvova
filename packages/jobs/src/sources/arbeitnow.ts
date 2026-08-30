import type { ProviderCapabilities } from "../adapter.ts";
import { normaliseWorkModel, type FetchOptions, type JobSourceAdapter, type RawListing } from "../adapter.ts";

/**
 * Arbeitnow — echte, öffentlich angebotene Stellenanzeigen.
 *
 * Warum ausgerechnet diese Quelle den Anfang macht:
 *
 * Sie stellt ihre Anzeigen selbst als offene Schnittstelle bereit, ohne
 * Schlüssel und ohne Anmeldung. Das ist der entscheidende Unterschied zu
 * einem Abruf, den man sich nimmt: hier wird nichts umgangen, kein
 * Zugriffsschutz überwunden, kein Vertrag verletzt. Die Anzeigen werden
 * genau so genutzt, wie der Anbieter sie anbietet — mit Herkunftsangabe
 * und mit einem Link auf das Original.
 *
 * Bewerbungen laufen nie über uns, sondern immer über das Original. Der
 * Link ist deshalb Pflichtfeld, nicht Kür: eine Anzeige ohne Weg zum
 * Original wäre für die suchende Person wertlos.
 */

const ENDPOINT = "https://www.arbeitnow.com/api/job-board-api";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links?: { next?: string | null };
}

/** Die Beschreibungen kommen als HTML. Für die Bewertung zählt der Text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Vertragsart aus den Angaben der Quelle.
 *
 * Unbekannt bleibt unbekannt. Eine geratene Vertragsart würde später in
 * die Passung eingehen und dort wie eine gesicherte Angabe wirken.
 */
export function readContractType(jobTypes: string[]): string | null {
  const joined = jobTypes.join(" ").toLowerCase();
  // Die Reihenfolge ist die Trennschärfe: "Werkstudent (Teilzeit)" ist
  // ein Werkstudentenvertrag, keine Teilzeitstelle.
  if (/werkstudent|working[\s-]?student/.test(joined)) return "working_student";
  if (/praktikum|internship|intern\b/.test(joined)) return "internship";
  if (/ausbildung|apprentice|azubi/.test(joined)) return "apprenticeship";
  if (/freelance|freiberuf|selbst[äa]ndig/.test(joined)) return "freelance";
  if (/zeitarbeit|temp[\s-]?agency|arbeitnehmer[üu]berlassung/.test(joined)) return "temp_agency";
  if (/befristet|fixed[\s-]?term|contract\b/.test(joined)) return "fixed_term";
  if (/vollzeit|full[\s-]?time|unbefristet|permanent/.test(joined)) return "permanent";
  // Teilzeit ist eine Arbeitszeit, keine Vertragsart. Sie hier auf eine
  // Vertragsart abzubilden hieße raten — unbekannt bleibt unbekannt.
  return null;
}

/**
 * Sprachanforderung nur, wenn die Anzeige sie ausspricht.
 *
 * Die Wortstämme stehen bewusst ohne abschließende Wortgrenze: im
 * Deutschen wird gebeugt. "Verhandlungssicheres Deutsch" ist genau die
 * Form, in der der Satz tatsächlich in Anzeigen steht — mit einer
 * Wortgrenze hinter dem Stamm wäre sie durchgerutscht und die
 * Anforderung eine Stufe zu niedrig eingeschätzt worden.
 */
const HIGH_LEVEL = /(verhandlungssicher|fließend|fliessend|fluent|muttersprach|native|\bc1\b|\bc2\b)/i;

export function readLanguages(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const high = HIGH_LEVEL.test(text);
  if (/\b(deutsch|german)\b/i.test(text)) out.de = high ? "C1" : "B2";
  if (/\b(englisch|english)\b/i.test(text)) out.en = high ? "C1" : "B2";
  return out;
}

export class ArbeitnowAdapter implements JobSourceAdapter {
  readonly key = "arbeitnow";
  readonly displayName = "Arbeitnow";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "public_link_only" as const;
  readonly attributionRequired = true;
  readonly attributionText = "Stellenanzeige über Arbeitnow. Bewerbung direkt beim Unternehmen.";
  readonly termsUrl = "https://www.arbeitnow.com/terms";

  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  /*
   * Die Wartezeit zwischen zwei Versuchen ist einstellbar.
   *
   * Nicht aus Flexibilität, sondern weil eine fest verdrahtete Pause
   * jeden Test, der den Fehlerpfad prüft, um zehn Sekunden verlängert —
   * und ein Test, der zehn Sekunden braucht, wird irgendwann
   * übersprungen. Im Betrieb bleibt der Vorgabewert.
   */
  private readonly backoffMs: number;

  constructor(
    options: { endpoint?: string; fetchImpl?: typeof fetch; backoffMs?: number } = {},
  ) {
    this.endpoint = options.endpoint ?? ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.backoffMs = options.backoffMs ?? 1500;
  }

  /**
   * Kein Schlüssel nötig — die Quelle ist immer einsatzbereit. Ob sie
   * gerade erreichbar ist, ist eine andere Frage, und die beantwortet
   * erst der Abruf; sie hier vorwegzunehmen hieße raten.
   */
  /**
   * Arbeitnow liefert eine einfache Liste ohne Suchparameter und ohne
   * Datumsfilter: jeder Abruf holt die aktuelle Seite. Gehalt steht
   * selten und nur im Fliesstext, ein Ablaufdatum gar nicht — deshalb
   * bleiben tote Anzeigen bei dieser Quelle länger stehen als bei
   * anderen, und die Linkprüfung ist hier wichtiger.
   */
  readonly capabilities: ProviderCapabilities = {
    search: false,
    details: false,
    since: false,
    maxPerRequest: 100,
    rateLimitPerMinute: null,
    salary: false,
    expiry: false,
    structuredRequirements: false,
  };

  isConfigured(): boolean {
    return true;
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    const limit = options.limit ?? 100;
    const collected: ArbeitnowJob[] = [];
    let url: string | null = this.endpoint;
    let page = 0;

    /*
     * Höchstens 25 Seiten je Lauf.
     *
     * Eine Obergrenze im Code, nicht nur im Aufrufer: sonst wird aus
     * einer freundlichen Abfrage bei einem Fehler in der Schleife
     * unbemerkt ein Massenabruf.
     *
     * Vorher standen hier fünf Seiten — was nie zum Tragen kam, weil
     * `collected.length < limit` mit dem Vorgabewert 100 schon nach
     * Seite eins abbrach. Arbeitnow liefert 175 Einträge je Seite; die
     * Schleife holte also genau eine Seite und schnitt sie auf 100.
     */
    while (url && collected.length < limit && page < 25) {
      /*
       * Wiederholung mit wachsendem Abstand bei 429 und 5xx.
       *
       * Eine Quelle, die uns umsonst beliefert, darf uns bremsen. Ohne
       * diese Schleife bricht der ganze Lauf beim ersten „zu viele
       * Anfragen“ ab — und dann steht in der Datenbank, was zufällig
       * vorher hineinkam.
       *
       * Ein 4xx, das kein 429 ist, wird NICHT wiederholt: es liegt an
       * uns, nicht an der Last, und dreimal dieselbe falsche Anfrage zu
       * stellen macht sie nicht richtiger.
       */
      let response: Response | null = null;
      for (let versuch = 0; versuch < 4; versuch += 1) {
        response = await this.fetchImpl(url, {
          signal: options.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "PaycheckJobConnector/1.0 (+kandidatenseitige Stellensuche)",
          },
        });
        if (response.ok) break;

        const wiederholbar = response.status === 429 || response.status >= 500;
        if (!wiederholbar || versuch === 3) break;

        // Die Quelle darf sagen, wie lange sie Ruhe braucht.
        const angesagt = Number(response.headers.get("retry-after"));
        const warten = Number.isFinite(angesagt) && angesagt > 0
          ? Math.min(angesagt * 1000, 30_000)
          : this.backoffMs * 2 ** versuch;
        await new Promise((r) => setTimeout(r, warten));
      }

      if (!response || !response.ok) {
        throw new Error(
          `Arbeitnow antwortete mit ${response?.status ?? "keiner Antwort"}. Es werden keine ` +
            `Stellen übernommen — lieber keine als halbe Daten.`,
        );
      }

      const body = (await response.json()) as ArbeitnowResponse;
      collected.push(...body.data);
      url = body.links?.next ?? null;
      page += 1;

      // Zwischen zwei Seiten kurz Luft holen. Eine Quelle, die uns
      // umsonst beliefert, soll das nicht bereuen.
      if (url && collected.length < limit) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    const since = options.since?.getTime();

    return collected
      .filter((j) => (since ? j.created_at * 1000 >= since : true))
      .slice(0, limit)
      .map((j) => this.toRawListing(j));
  }

  private toRawListing(j: ArbeitnowJob): RawListing {
    const description = htmlToText(j.description);
    const location = j.location?.trim() || "Nicht angegeben";

    return {
      externalId: j.slug,
      title: j.title.trim(),
      companyName: j.company_name.trim(),
      location,
      country: /deutschland|germany|berlin|münchen|munich|hamburg|köln|frankfurt|stuttgart/i.test(
        location,
      )
        ? "DE"
        : "DE",
      workModel: j.remote ? "remote" : normaliseWorkModel(location),
      remotePercent: j.remote ? 100 : null,
      // Arbeitnow überträgt keine Gehälter. Nicht offengelegt heißt
      // nicht offengelegt — keine Schätzung, keine Spanne aus dem Titel.
      salaryMin: null,
      salaryMax: null,
      contractType: readContractType(j.job_types ?? []),
      languageRequirements: readLanguages(description),
      industry: j.tags?.[0] ?? null,
      description,
      applyMethod: "portal",
      applyTarget: j.url,
      originalUrl: j.url,
      publishedAt: new Date(j.created_at * 1000),
      raw: {
        slug: j.slug,
        tags: j.tags,
        job_types: j.job_types,
        remote: j.remote,
        source: "arbeitnow",
      },
    };
  }
}
