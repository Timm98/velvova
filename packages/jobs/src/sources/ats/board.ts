import type {
  FetchOptions,
  JobSourceAdapter,
  ProviderCapabilities,
  RawListing,
} from "../../adapter.ts";

/**
 * Arbeitgeber-Stellenboards (Greenhouse, Lever, Ashby, SmartRecruiters).
 *
 * Der entscheidende Unterschied zu einem Aggregator steht schon im
 * Namen dieser Datei: das ist **ein Board pro Arbeitgeber**, kein
 * globaler Feed. Diese Anbieter betreiben kein durchsuchbares
 * Gesamtverzeichnis aller Kunden, und es wäre auch keines, wenn man
 * ihre Kundenliste durchprobierte.
 *
 * Genau das ist die Versuchung, die hier ausdrücklich nicht bedient
 * wird: `api.lever.co/v0/postings/{site}` beantwortet jede Anfrage, für
 * die man den Firmennamen errät. Ein Skript, das Firmennamen
 * durchprobiert, baut aus einem Arbeitgeberboard ein Verzeichnis, das
 * der Anbieter nie angeboten hat. Deshalb kommt der Board-Bezeichner
 * **immer aus einer Registrierung** — einer verifizierten
 * Arbeitgeberdomäne oder einer hinterlegten Autorisierung — und nie aus
 * einer Suche.
 *
 * Was diese Quellen so wertvoll macht: die Daten kommen vom
 * Arbeitgeber selbst. Kein Aggregator dazwischen, kein veralteter
 * Abzug, ein Bewerbungsweg ohne Zwischenstation. Für die suchende
 * Person ist das der kürzeste Weg, den es gibt.
 */

export type BoardKind = "greenhouse" | "lever" | "ashby" | "smartrecruiters";

export interface BoardRegistration {
  /** Der Bezeichner beim Anbieter, z. B. der Greenhouse-Board-Token. */
  boardToken: string;
  /** Anzeigename des Arbeitgebers. */
  employerName: string;
  /**
   * Woher die Berechtigung stammt. Ohne Eintrag wird nicht abgerufen —
   * ein leeres Feld ist keine Autorisierung, sondern eine fehlende.
   */
  authorization: {
    kind: "verified_domain" | "written_authorization" | "own_employer_account";
    reference: string;
    verifiedAt: Date;
  };
}

export interface BoardFetchResult {
  listings: RawListing[];
  /** Wenn ein Board ausfällt, sollen die anderen weiterlaufen. */
  errors: { boardToken: string; message: string }[];
}

const TIMEOUT_MS = 15_000;

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        // Ehrlich sagen, wer anfragt. Ein getarnter User-Agent wäre der
        // erste Schritt zu dem Verhalten, das dieses Produkt ablehnt.
        "user-agent": "VelvovaJobs/1.0 (+https://paycheck.example/bot)",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stripHtml(html: string): string {
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
 * Ein einzelner unbrauchbarer Eintrag darf nicht den ganzen Abruf
 * verwerfen. `null` in einer Jobliste kommt bei allen vier Anbietern
 * vor — und ohne diese Wache stürzt der Parser, statt neunundvierzig
 * gute Anzeigen zu liefern.
 */
function alsObjekt(raw: unknown): Record<string, unknown> | null {
  return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
}

/** Kein Ort heisst „nicht angegeben“, nicht „egal“ oder „remote“. */
const OHNE_ORT = "Nicht angegeben";

// ── Greenhouse ────────────────────────────────────────────────────

export function parseGreenhouse(payload: unknown, employerName: string): RawListing[] {
  const jobs = (payload as { jobs?: unknown[] })?.jobs;
  if (!Array.isArray(jobs)) return [];

  return jobs.flatMap((raw): RawListing[] => {
    const j = alsObjekt(raw);
    if (!j) return [];
    const id = j.id ?? j.internal_job_id;
    const title = text(j.title);
    const url = text(j.absolute_url);
    if (id === undefined || !title || !url) return [];

    const content = text(j.content);
    return [{
      externalId: `greenhouse:${id}`,
      title,
      companyName: employerName,
      location: text((j.location as Record<string, unknown> | undefined)?.name) ?? OHNE_ORT,
      description: content ? stripHtml(decodeEntities(content)) : "",
      originalUrl: url,
      publishedAt: parseDate(j.updated_at ?? j.first_published),
      raw: { board: "greenhouse" },
    }];
  });
}

// ── Lever ─────────────────────────────────────────────────────────

export function parseLever(payload: unknown, employerName: string): RawListing[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((raw): RawListing[] => {
    const j = alsObjekt(raw);
    if (!j) return [];
    const id = text(j.id);
    const title = text(j.text);
    const url = text(j.hostedUrl) ?? text(j.applyUrl);
    if (!id || !title || !url) return [];

    const categories = (j.categories ?? {}) as Record<string, unknown>;
    return [{
      externalId: `lever:${id}`,
      title,
      companyName: employerName,
      location: text(categories.location) ?? OHNE_ORT,
      description: stripHtml(
        [text(j.descriptionPlain) ?? text(j.description) ?? "", text(j.additionalPlain) ?? ""]
          .filter(Boolean)
          .join("\n\n"),
      ),
      originalUrl: url,
      publishedAt: typeof j.createdAt === "number" ? new Date(j.createdAt) : null,
      raw: { board: "lever", team: text(categories.team), commitment: text(categories.commitment) },
    }];
  });
}

// ── Ashby ─────────────────────────────────────────────────────────

export function parseAshby(payload: unknown, employerName: string): RawListing[] {
  const jobs = (payload as { jobs?: unknown[] })?.jobs;
  if (!Array.isArray(jobs)) return [];

  return jobs.flatMap((raw): RawListing[] => {
    const j = alsObjekt(raw);
    if (!j) return [];
    const id = text(j.id);
    const title = text(j.title);
    const url = text(j.jobUrl) ?? text(j.applyUrl);
    if (!id || !title || !url) return [];

    // Ashby liefert Gehalt nur, wenn der Arbeitgeber es veröffentlicht
    // hat. Fehlt es, bleibt es leer — nicht null als Zahl.
    const comp = j.compensation as Record<string, unknown> | undefined;

    return [{
      externalId: `ashby:${id}`,
      title,
      companyName: employerName,
      location: text(j.location) ?? OHNE_ORT,
      description: text(j.descriptionPlain)
        ?? (text(j.descriptionHtml) ? stripHtml(text(j.descriptionHtml)!) : ""),
      originalUrl: url,
      publishedAt: parseDate(j.publishedAt),
      raw: {
        board: "ashby",
        isRemote: j.isRemote === true,
        compensationSummary: text(comp?.compensationTierSummary),
      },
    }];
  });
}

// ── SmartRecruiters ───────────────────────────────────────────────

export function parseSmartRecruiters(payload: unknown, employerName: string): RawListing[] {
  const content = (payload as { content?: unknown[] })?.content;
  if (!Array.isArray(content)) return [];

  return content.flatMap((raw): RawListing[] => {
    const j = alsObjekt(raw);
    if (!j) return [];
    const id = text(j.id);
    const title = text(j.name);
    if (!id || !title) return [];

    const location = j.location as Record<string, unknown> | undefined;
    const ort = [text(location?.city), text(location?.region)].filter(Boolean).join(", ");

    return [{
      externalId: `smartrecruiters:${id}`,
      title,
      companyName: text((j.company as Record<string, unknown> | undefined)?.name) ?? employerName,
      location: ort || OHNE_ORT,
      // Die Listenantwort enthält keinen Volltext. Ihn zu erfinden wäre
      // schlimmer als ihn wegzulassen; der Link führt zum Original.
      description: "",
      originalUrl: text(j.applyUrl) ?? text(j.ref) ?? "",
      publishedAt: parseDate(j.releasedDate),
      raw: { board: "smartrecruiters", department: text((j.department as Record<string, unknown> | undefined)?.label) },
    }].filter((l) => l.originalUrl);
  });
}

// ── Gemeinsames ───────────────────────────────────────────────────

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function decodeEntities(html: string): string {
  return html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const ENDPOINTS: Record<BoardKind, (token: string) => string> = {
  greenhouse: (t) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(t)}/jobs?content=true`,
  lever: (t) => `https://api.lever.co/v0/postings/${encodeURIComponent(t)}?mode=json`,
  ashby: (t) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(t)}`,
  smartrecruiters: (t) => `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(t)}/postings`,
};

const PARSERS: Record<BoardKind, (payload: unknown, employer: string) => RawListing[]> = {
  greenhouse: parseGreenhouse,
  lever: parseLever,
  ashby: parseAshby,
  smartrecruiters: parseSmartRecruiters,
};

const CAPABILITIES: Record<BoardKind, ProviderCapabilities> = {
  greenhouse: {
    search: false, details: true, since: false, maxPerRequest: 1000,
    rateLimitPerMinute: null, salary: false, expiry: false, structuredRequirements: false,
  },
  lever: {
    search: false, details: true, since: false, maxPerRequest: 1000,
    rateLimitPerMinute: null, salary: false, expiry: false, structuredRequirements: false,
  },
  ashby: {
    search: false, details: true, since: false, maxPerRequest: 1000,
    rateLimitPerMinute: null, salary: true, expiry: false, structuredRequirements: false,
  },
  smartrecruiters: {
    // Die Listenantwort trägt keinen Volltext. Das als Fähigkeit zu
    // behaupten hiesse, ein leeres Feld später als "keine Beschreibung"
    // zu deuten statt als "hier nicht enthalten".
    search: false, details: false, since: false, maxPerRequest: 100,
    rateLimitPerMinute: null, salary: false, expiry: false, structuredRequirements: false,
  },
};

const NAMES: Record<BoardKind, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
};

/**
 * Ein Adapter je ATS, der über die registrierten Boards läuft.
 *
 * Ohne Registrierung fragt er niemanden. Das ist keine leere Liste aus
 * Versehen, sondern die richtige Antwort: wir kennen dann keinen
 * Arbeitgeber, dessen Stellen wir abrufen dürfen.
 */
export class AtsBoardAdapter implements JobSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly kind = "employer_feed" as const;
  readonly licenseStatus = "licensed" as const;
  readonly attributionRequired = false;
  readonly attributionText: string | null;
  readonly termsUrl: string | null = null;
  readonly capabilities: ProviderCapabilities;

  // Keine Parameter-Properties: Node kann TypeScript nur "strippen",
  // nicht übersetzen, und `private readonly` im Konstruktor erzeugt
  // Code statt nur Typen. Die Skripte zur Dokumentationserzeugung
  // laufen über genau diesen Weg — ein Adapter, den sie nicht laden
  // können, fehlt später still in einer erzeugten Tabelle.
  private readonly board: BoardKind;
  private readonly registrations: () => BoardRegistration[];

  constructor(board: BoardKind, registrations: () => BoardRegistration[]) {
    this.board = board;
    this.registrations = registrations;
    this.key = `ats_${board}`;
    this.displayName = `${NAMES[board]} (Arbeitgeberboards)`;
    this.attributionText = `Direkt vom Arbeitgeber über ${NAMES[board]}`;
    this.capabilities = CAPABILITIES[board];
  }

  isConfigured(): boolean {
    return this.registrations().length > 0;
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    const { listings } = await this.fetchWithErrors(options);
    return listings;
  }

  /**
   * Wie `fetchListings`, aber mit den Fehlern je Board.
   *
   * Ein ausgefallenes Board darf die anderen nicht mitreissen: bei
   * fünfzig registrierten Arbeitgebern ist immer einer gerade
   * unerreichbar, und die suchende Person hätte sonst eine leere Liste
   * statt neunundvierzig Ergebnissen.
   */
  async fetchWithErrors(options: FetchOptions = {}): Promise<BoardFetchResult> {
    const limit = options.limit ?? 500;
    const listings: RawListing[] = [];
    const errors: BoardFetchResult["errors"] = [];

    const ergebnisse = await Promise.allSettled(
      this.registrations().map(async (reg) => {
        const payload = await getJson(ENDPOINTS[this.board](reg.boardToken));
        return { reg, listings: PARSERS[this.board](payload, reg.employerName) };
      }),
    );

    for (const [i, ergebnis] of ergebnisse.entries()) {
      const reg = this.registrations()[i]!;
      if (ergebnis.status === "fulfilled") {
        listings.push(...ergebnis.value.listings);
      } else {
        errors.push({
          boardToken: reg.boardToken,
          message:
            ergebnis.reason instanceof Error ? ergebnis.reason.message : String(ergebnis.reason),
        });
      }
    }

    return { listings: listings.slice(0, limit), errors };
  }
}
