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

  constructor(options: { endpoint?: string; fetchImpl?: typeof fetch } = {}) {
    this.endpoint = options.endpoint ?? ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Kein Schlüssel nötig — die Quelle ist immer einsatzbereit. Ob sie
   * gerade erreichbar ist, ist eine andere Frage, und die beantwortet
   * erst der Abruf; sie hier vorwegzunehmen hieße raten.
   */
  isConfigured(): boolean {
    return true;
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    const limit = options.limit ?? 100;
    const collected: ArbeitnowJob[] = [];
    let url: string | null = this.endpoint;
    let page = 0;

    // Höchstens fünf Seiten je Lauf. Eine Obergrenze im Code, nicht nur
    // im Aufrufer: sonst wird aus einer freundlichen Abfrage bei einem
    // Fehler in der Schleife unbemerkt ein Massenabruf.
    while (url && collected.length < limit && page < 5) {
      const response: Response = await this.fetchImpl(url, {
        signal: options.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "PaycheckJobConnector/1.0 (+kandidatenseitige Stellensuche)",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Arbeitnow antwortete mit ${response.status}. Es werden keine Stellen übernommen — ` +
            `lieber keine als halbe Daten.`,
        );
      }

      const body = (await response.json()) as ArbeitnowResponse;
      collected.push(...body.data);
      url = body.links?.next ?? null;
      page += 1;
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
