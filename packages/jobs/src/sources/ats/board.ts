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

export type BoardKind = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "recruitee";

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
  /**
   * Ob JEDES Board vollständig geladen wurde.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum ein einziger abgeschnittener Arbeitgeber genügt
   * ══════════════════════════════════════════════════════════════
   *
   * Der Lauf sammelt fünfzig Boards zu einer Liste. Fehlt bei einem
   * davon die Hälfte, fehlt sie auch in der Gesamtliste — und die
   * Verfügbarkeitslogik sähe die fehlenden Stellen als verschwunden.
   *
   * Zu unterscheiden, welche Stelle von welchem Board kam, wäre
   * möglich und wäre die falsche Feinheit: Ein Lauf, bei dem etwas
   * fehlte, ist ein Lauf, aus dem nichts folgt.
   *
   * Ein ausgefallenes Board zählt ebenfalls als unvollständig — auch
   * wenn die anderen neunundvierzig sauber durchliefen.
   */
  vollstaendig: boolean;
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

/**
 * Ob der Greenhouse-Abruf den ganzen Bestand gesehen hat.
 *
 * Die Antwort trägt `meta.total`. Gemessen am 8. September 2026 gegen
 * ein Board mit 86 Stellen: `meta.total` 86, geliefert 86 — der
 * Endpunkt liefert das ganze Board in einem Zug.
 *
 * Geprüft wird es trotzdem: Ein Board, das eines Tages paginiert,
 * würde sonst die Hälfte seines Bestands als verschwunden melden, und
 * niemand käme auf die Idee, danach zu suchen.
 */
export function greenhouseVollstaendig(payload: unknown): boolean {
  const p = payload as { jobs?: unknown[]; meta?: { total?: unknown } } | null;
  if (!p || !Array.isArray(p.jobs)) return false;
  const gesamt = typeof p.meta?.total === "number" ? p.meta.total : null;
  if (gesamt === null) return false;
  return p.jobs.length >= gesamt;
}

export function parseGreenhouse(payload: unknown, employerName: string): RawListing[] {
  const jobs = (payload as { jobs?: unknown[] })?.jobs;
  if (!Array.isArray(jobs)) return [];

  if (!greenhouseVollstaendig(payload)) {
    const gesamt = (payload as { meta?: { total?: number } }).meta?.total;
    console.warn(
      `[ats:greenhouse] ${employerName}: ${jobs.length} von ${gesamt ?? "?"} geladen — ` +
        "der Abruf ist abgeschnitten und taugt nicht als Momentaufnahme.",
    );
  }

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
      /*
       * Eine echte Bewerbungsfrist — wenn sie dasteht.
       *
       * `application_deadline` gehört zum Greenhouse-Modell, ist aber
       * optional: Bei den 86 geprüften Stellen war es durchgehend
       * leer. Deshalb wird es gelesen und nicht erwartet — und wo es
       * fehlt, entsteht keine Frist.
       */
      ...(parseDate(j.application_deadline)
        ? { expiresAt: parseDate(j.application_deadline) }
        : {}),
      raw: { board: "greenhouse" },
    }];
  });
}

// ── Lever ─────────────────────────────────────────────────────────

/**
 * Ob der Lever-Abruf vollständig war.
 *
 * Lever gibt das ganze Board als blankes Array zurück — keine Hülle,
 * kein `total`, keine Paginierung. Ein Array IST der Bestand.
 *
 * Die Prüfung sieht deshalb trivial aus und ist es nicht: Sie hält
 * fest, warum hier nichts zu prüfen ist. Käme eines Tages eine Hülle
 * mit Seitenangabe, fiele diese Funktion auf `false` und der Bestand
 * bliebe stehen, statt still zur Hälfte zu verschwinden.
 */
export function leverVollstaendig(payload: unknown): boolean {
  return Array.isArray(payload);
}

/** Levers `workplaceType` — `unspecified` heisst „nicht gesagt". */
function leverArbeitsmodell(v: unknown): "remote" | "hybrid" | "on_site" | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return t === "remote" ? "remote" : t === "hybrid" ? "hybrid" : t === "onsite" ? "on_site" : null;
}

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
      /*
       * `workplaceType` und `country` standen bisher nicht im
       * Ergebnis.
       *
       * Gemessen an einem Board: remote 4, hybrid 4, onsite 3,
       * unspecified 1 — ein sauber gepflegtes Feld des Arbeitgebers.
       * Es wurde weggeworfen, und das Arbeitsmodell danach aus dem
       * Titel geraten.
       *
       * `unspecified` heisst ausdrücklich „nicht gesagt" und ergibt
       * deshalb nichts.
       */
      ...(leverArbeitsmodell(j.workplaceType) ? { workModel: leverArbeitsmodell(j.workplaceType)! } : {}),
      ...(text(j.country) ? { country: text(j.country)!.toUpperCase() } : {}),
      raw: { board: "lever", team: text(categories.team), commitment: text(categories.commitment) },
    }];
  });
}

// ── Ashby ─────────────────────────────────────────────────────────

/**
 * Ob der Ashby-Abruf vollständig war.
 *
 * Ashby liefert `{ jobs, apiVersion }` ohne Gesamtzahl und ohne
 * Seitenangabe — das Board kommt in einem Zug. Geprüft an einem Board
 * mit 71 Stellen.
 *
 * Wie bei Lever hält die Funktion vor allem fest, WARUM hier nichts
 * zu prüfen ist. Käme eine Seitenangabe dazu, müsste sie hier
 * einziehen — und bis dahin steht die Annahme wenigstens an einer
 * Stelle geschrieben.
 */
export function ashbyVollstaendig(payload: unknown): boolean {
  return Array.isArray((payload as { jobs?: unknown[] })?.jobs);
}

/** Ashbys `workplaceType`, gegen `isRemote` geprüft. */
function ashbyArbeitsmodell(j: Record<string, unknown>): "remote" | "hybrid" | "on_site" | null {
  const t = typeof j.workplaceType === "string" ? j.workplaceType.trim().toLowerCase() : "";
  const aus: Record<string, "remote" | "hybrid" | "on_site"> = {
    remote: "remote",
    hybrid: "hybrid",
    onsite: "on_site",
    "on site": "on_site",
    "on-site": "on_site",
  };
  const gedeutet = aus[t];
  if (!gedeutet) return null;
  if (typeof j.isRemote === "boolean" && j.isRemote !== (gedeutet === "remote")) return null;
  return gedeutet;
}

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

    /*
     * `isListed` ist Ashbys Veröffentlichungsschalter.
     *
     * Eine Stelle mit `isListed: false` steht zwar in der Antwort,
     * ist aber nicht öffentlich ausgeschrieben — sie gehört nicht in
     * eine Momentaufnahme dessen, was gerade offen ist.
     *
     * Ausdrücklich `=== false` und nicht `!j.isListed`: Fehlt das
     * Feld ganz, ist damit nichts gesagt, und eine Stelle wegen eines
     * fehlenden Feldes wegzuwerfen wäre die falsche Richtung.
     */
    if (j.isListed === false) return [];

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
      /*
       * `workplaceType` vor `isRemote`.
       *
       * Der Text kennt drei Zustände, der Wahrheitswert nur zwei —
       * „Hybrid" und „On Site" sind für ihn dasselbe `false`. Wo
       * beides dasteht und sich widerspricht, wird nichts gesetzt.
       */
      ...(ashbyArbeitsmodell(j) ? { workModel: ashbyArbeitsmodell(j)! } : {}),
      raw: {
        board: "ashby",
        isRemote: j.isRemote === true,
        compensationSummary: text(comp?.compensationTierSummary),
      },
    }];
  });
}

// ── SmartRecruiters ───────────────────────────────────────────────

/**
 * Ob dieser Board-Abruf den ganzen Bestand gesehen hat.
 *
 * ══════════════════════════════════════════════════════════════
 * SmartRecruiters sagt es selbst
 * ══════════════════════════════════════════════════════════════
 *
 * Die Antwort trägt `totalFound`. Wer weniger Einträge bekommen hat,
 * als dort steht, wurde abgeschnitten — und aus so einem Abruf folgt
 * über eine fehlende Stelle nichts.
 *
 * Das ist besser als die allgemeine Regel in `ingest.ts`, die von der
 * Stückzahlgrenze auf Vollständigkeit schliesst: Hier steht die Zahl
 * in der Antwort, es muss nichts gefolgert werden.
 *
 * ── Warum das gerade hier zählt ─────────────────────────────
 *
 * Der öffentliche Endpunkt listet ausdrücklich die AKTIVEN
 * Ausschreibungen eines Arbeitgebers. Ein vollständiger Abruf ist
 * damit eine Momentaufnahme dessen, was gerade veröffentlicht ist —
 * und eine Stelle, die daraus verschwindet, ist ein starkes Signal.
 *
 * Ein abgeschnittener Abruf ist dagegen gar keins. Ohne diese Prüfung
 * gälte bei einem Arbeitgeber mit 300 Stellen und einer Antwort von
 * 100 der Rest als verschwunden.
 */
export function smartRecruitersVollstaendig(payload: unknown): boolean {
  const p = payload as { content?: unknown[]; totalFound?: unknown } | null;
  if (!p || !Array.isArray(p.content)) return false;
  const gesamt = typeof p.totalFound === "number" ? p.totalFound : null;
  /* Ohne Angabe wird nichts behauptet. */
  if (gesamt === null) return false;
  return p.content.length >= gesamt;
}

export function parseSmartRecruiters(payload: unknown, employerName: string): RawListing[] {
  const content = (payload as { content?: unknown[] })?.content;
  if (!Array.isArray(content)) return [];

  if (!smartRecruitersVollstaendig(payload)) {
    const gesamt = (payload as { totalFound?: number }).totalFound;
    console.warn(
      `[ats:smartrecruiters] ${employerName}: ${content.length} von ${gesamt ?? "?"} geladen — ` +
        "der Abruf ist abgeschnitten und taugt nicht als Momentaufnahme.",
    );
  }

  return content.flatMap((raw): RawListing[] => {
    const j = alsObjekt(raw);
    if (!j) return [];
    const id = text(j.id);
    const title = text(j.name);
    if (!id || !title) return [];

    const location = j.location as Record<string, unknown> | undefined;
    const ort = [text(location?.city), text(location?.region)].filter(Boolean).join(", ");

    /*
     * `location` trägt zwei Wahrheitswerte, die bisher wegfielen.
     *
     * SmartRecruiters liefert in der Ortsangabe `remote` und `hybrid`
     * als eigene Felder. Sie standen hier nie im Ergebnis — das
     * Arbeitsmodell wurde stattdessen später aus dem Titel geraten.
     *
     * Zwei Felder des Arbeitgebers sind mehr wert als jede Ableitung
     * aus einer Überschrift.
     *
     * Widersprechen sie sich — beide `true` —, wird nichts gesetzt:
     * Dann weiss die Quelle es selbst nicht.
     */
    const istRemote = location?.remote === true;
    const istHybrid = location?.hybrid === true;
    const modell =
      istRemote && istHybrid ? undefined : istRemote ? "remote" : istHybrid ? "hybrid" : undefined;

    return [{
      externalId: `smartrecruiters:${id}`,
      title,
      companyName: text((j.company as Record<string, unknown> | undefined)?.name) ?? employerName,
      location: ort || OHNE_ORT,
      ...(text(location?.country) ? { country: text(location?.country)!.toUpperCase() } : {}),
      ...(modell ? { workModel: modell as "remote" | "hybrid" } : {}),
      // Die Listenantwort enthält keinen Volltext. Ihn zu erfinden wäre
      // schlimmer als ihn wegzulassen; der Link führt zum Original.
      description: "",
      originalUrl: text(j.applyUrl) ?? text(j.ref) ?? "",
      publishedAt: parseDate(j.releasedDate),
      raw: { board: "smartrecruiters", department: text((j.department as Record<string, unknown> | undefined)?.label) },
    }].filter((l) => l.originalUrl);
  });
}

// ── Recruitee ─────────────────────────────────────────────────────

/**
 * Ob der Recruitee-Abruf den ganzen Bestand gesehen hat.
 *
 * Die Antwort ist ein Umschlag mit genau einem Schlüssel: `offers`.
 * Keine Seitenzahl, keine Gesamtzahl, kein `next` — gemessen am
 * 8. September 2026 gegen zwei Mandanten (194 und 9 Stellen, 29 MB
 * bzw. 116 kB in einem Zug).
 *
 * Es gibt hier also nichts zu vergleichen, und deshalb steht die
 * Annahme wenigstens geschrieben: Wenn Recruitee eines Tages
 * paginiert, meldet dieser Adapter den halben Bestand als
 * verschwunden — und diese Zeile ist die Stelle, an der man es merkt.
 */
export function recruiteeVollstaendig(payload: unknown): boolean {
  return Array.isArray((payload as { offers?: unknown[] })?.offers);
}

/**
 * Recruitees drei Schalter, zusammengelesen.
 *
 * `remote`, `hybrid` und `on_site` sind drei einzelne Wahrheitswerte,
 * nicht ein Feld mit drei Werten — und gemessen sind sie oft mehrfach
 * gesetzt: 16 Anzeigen tragen `remote` UND `hybrid`, 13 sogar alle
 * drei.
 *
 * Was das bedeuten soll, sagt die Antwort nicht. Vermutlich eine
 * Mehrfachauswahl im Sinne von „geht beides" — nur ist „vermutlich"
 * keine Grundlage, und unser `workModel` trägt genau einen Wert.
 *
 * Deshalb: nur ein einzeln gesetzter Schalter wird übernommen. Bei
 * Mehrfachnennung bleibt das Feld leer und die drei Rohwerte wandern
 * unverändert in `raw` — dort geht nichts verloren, und wer die
 * Bedeutung eines Tages belegen kann, findet die Daten noch vor.
 *
 * Gemessen: 171 von 203 Anzeigen (84 %) bekommen so ein Arbeitsmodell.
 */
function recruiteeArbeitsmodell(o: Record<string, unknown>): "remote" | "hybrid" | "on_site" | null {
  const gesetzt = ([["remote", "remote"], ["hybrid", "hybrid"], ["on_site", "on_site"]] as const)
    .filter(([feld]) => o[feld] === true)
    .map(([, wert]) => wert);
  return gesetzt.length === 1 ? gesetzt[0]! : null;
}

/** Nur Perioden, die unser Modell kennt. Alles andere bleibt leer. */
function recruiteePeriode(v: unknown): "year" | "month" | "hour" | null {
  return v === "year" || v === "month" || v === "hour" ? v : null;
}

/**
 * Recruitees Gehaltsobjekt.
 *
 * Es steht bei 100 % der Anzeigen da und ist bei 39 % durchgehend
 * `null` — das Feld ist also immer vorhanden und oft leer. Ein
 * `salary: { min: null, max: null, period: null, currency: null }`
 * heisst „nicht veröffentlicht", nicht „null Euro".
 *
 * Die Beträge kommen als ZEICHENKETTEN (`"46000"`), nicht als Zahlen.
 * Wer sie ungeprüft weiterreicht, bekommt später einen Vergleich, der
 * "9000" grösser findet als "46000".
 */
function recruiteeGehalt(roh: unknown): Pick<
  RawListing, "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryPeriod"
> {
  const s = alsObjekt(roh);
  if (!s) return {};
  const zahl = (v: unknown): number | null => {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const min = zahl(s.min);
  const max = zahl(s.max);
  if (min === null && max === null) return {};

  const periode = recruiteePeriode(s.period);
  const waehrung = text(s.currency);
  return {
    ...(min !== null ? { salaryMin: min } : {}),
    ...(max !== null ? { salaryMax: max } : {}),
    ...(waehrung ? { salaryCurrency: waehrung } : {}),
    ...(periode ? { salaryPeriod: periode } : {}),
  };
}

export function parseRecruitee(payload: unknown, employerName: string): RawListing[] {
  const offers = (payload as { offers?: unknown[] })?.offers;
  if (!Array.isArray(offers)) return [];

  return offers.flatMap((raw): RawListing[] => {
    const o = alsObjekt(raw);
    if (!o) return [];

    const id = o.id !== null && o.id !== undefined ? String(o.id) : null;
    const title = text(o.title);
    const url = text(o.careers_url) ?? text(o.careers_apply_url);
    if (!id || !title || !url) return [];

    /*
     * `status` ist KEIN Schliesssignal.
     *
     * Gemessen trägt es bei allen 203 Anzeigen den Wert `published` —
     * der Endpunkt liefert nur veröffentlichte Stellen. Aus dem Feld
     * folgt damit nichts über beendete Stellen; es taugt nur als
     * Wache gegen den Tag, an dem Recruitee auch andere Zustände
     * ausliefert.
     */
    if (text(o.status) && o.status !== "published") return [];

    /*
     * Beschreibung und Anforderungen sind zwei getrennte HTML-Felder.
     *
     * `requirements` ist bei 63 % gefüllt und steht auf der
     * Karriereseite unter der Beschreibung. Getrennt gelassen wären
     * es zwei halbe Texte; aneinandergehängt ist es die Anzeige.
     *
     * `translations` bleibt ungenutzt: gemessen ist `translations.de.
     * description` bei allen 203 Anzeigen zeichengleich mit
     * `description`, und mehr als `de` kam nicht vor. Es ist dieselbe
     * Angabe zweimal — und der Grund, warum ein Mandant mit 194
     * Stellen 29 MB wiegt.
     */
    const beschreibung = [text(o.description), text(o.requirements)]
      .filter((t): t is string => Boolean(t))
      .map(stripHtml)
      .filter(Boolean)
      .join("\n\n");

    const modell = recruiteeArbeitsmodell(o);

    return [{
      externalId: `recruitee:${id}`,
      title,
      /*
       * Der Firmenname kommt aus der ANTWORT, nicht aus der
       * Registrierung — anders als bei den vier anderen Boards.
       *
       * Grund: Der Mandantenname ist bei Recruitee oft eine Marke und
       * nicht die Firma. `deintraumjobwartet.recruitee.com` gehört
       * der ANGEHEUERT GmbH, und „Deintraumjobwartet" als Arbeitgeber
       * anzuzeigen wäre schlicht falsch.
       *
       * Gemessen ist `company_name` bei 100 % gefüllt und je Mandant
       * konstant — es ist der Arbeitgeber, nicht der Kunde einer
       * Agentur. Der Rückfall auf den registrierten Namen bleibt
       * trotzdem stehen: Wenn das Feld eines Tages fehlt, soll die
       * Anzeige nicht namenlos sein.
       */
      companyName: text(o.company_name) ?? employerName,
      location: text(o.location) ?? text(o.city) ?? OHNE_ORT,
      ...(text(o.country_code) ? { country: text(o.country_code)! } : {}),
      ...(modell ? { workModel: modell } : {}),
      ...recruiteeGehalt(o.salary),
      description: beschreibung,
      originalUrl: url,
      applyMethod: "portal",
      applyTarget: text(o.careers_apply_url) ?? url,
      publishedAt: parseDate(o.published_at) ?? parseDate(o.created_at),
      /*
       * `close_at` ist die Bewerbungsfrist — und sie war bei keiner
       * der 203 gemessenen Anzeigen gesetzt.
       *
       * Übernommen wird sie trotzdem: Das Feld existiert, es ist
       * eindeutig benannt, und eine Frist zu übergehen, weil sie in
       * der Stichprobe fehlte, wäre der teurere Fehler. Die
       * Fähigkeit `expiry` steht deshalb auf `false` — behauptet
       * wird nichts, verarbeitet wird es doch.
       */
      expiresAt: parseDate(o.close_at),
      ...(text(o.employment_type_code) ? { contractType: text(o.employment_type_code) } : {}),
      ...(text(o.experience_code) ? { experienceLevel: text(o.experience_code) } : {}),
      raw: {
        board: "recruitee",
        guid: text(o.guid),
        // Die drei Schalter roh — siehe `recruiteeArbeitsmodell`.
        remote: o.remote === true,
        hybrid: o.hybrid === true,
        onSite: o.on_site === true,
        department: text(o.department),
        categoryCode: text(o.category_code),
        educationCode: text(o.education_code),
        city: text(o.city),
        postalCode: text(o.postal_code),
        stateName: text(o.state_name),
      },
    }];
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

/**
 * Recruitees Mandant steht in der Subdomäne — und das ist gefährlicher
 * als ein Pfadsegment.
 *
 * `encodeURIComponent` schützt hier NICHT: Ein Punkt bleibt ein Punkt,
 * und aus dem Mandanten `evil.example.com` würde
 * `https://evil.example.com.recruitee.com/...` - oder, mit einem
 * Schrägstrich, gleich ein ganz anderer Host. Deshalb eine enge
 * Zeichenwache statt einer Kodierung.
 *
 * Erlaubt ist, was in einer Subdomäne stehen darf: Kleinbuchstaben,
 * Ziffern, Bindestrich. Gemessene Mandanten (`deintraumjobwartet`,
 * `zadragruppe`) passen; alles andere fliegt mit einer Meldung raus,
 * die sagt, was falsch war.
 */
function recruiteeMandant(token: string): string {
  const t = token.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(t)) {
    throw new Error(
      `Unzulässiger Recruitee-Mandant: ${JSON.stringify(token)}. Erlaubt sind Kleinbuchstaben, ` +
      `Ziffern und Bindestriche - der Name steht in der Subdomäne und darf keinen Host bilden.`,
    );
  }
  return t;
}

const ENDPOINTS: Record<BoardKind, (token: string) => string> = {
  greenhouse: (t) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(t)}/jobs?content=true`,
  lever: (t) => `https://api.lever.co/v0/postings/${encodeURIComponent(t)}?mode=json`,
  ashby: (t) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(t)}`,
  smartrecruiters: (t) => `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(t)}/postings`,
  // Der Bezeichner steht in der SUBDOMÄNE, nicht im Pfad. Deshalb
  // hier keine Pfadkodierung, sondern eine Zeichenwache in
  // `recruiteeMandant` — ein Mandant mit einem Punkt darin wäre
  // sonst ein Weg zu einem fremden Host.
  recruitee: (t) => `https://${recruiteeMandant(t)}.recruitee.com/api/offers/`,
};

const PARSERS: Record<BoardKind, (payload: unknown, employer: string) => RawListing[]> = {
  greenhouse: parseGreenhouse,
  lever: parseLever,
  ashby: parseAshby,
  smartrecruiters: parseSmartRecruiters,
  recruitee: parseRecruitee,
};

/**
 * Je Board: Hat dieser Abruf den ganzen Bestand gesehen?
 *
 * Vier Antworten auf dieselbe Frage, und sie fallen verschieden aus,
 * weil die Anbieter Verschiedenes mitliefern:
 *
 *   greenhouse       `meta.total`   — gemessen 86 von 86
 *   smartrecruiters  `totalFound`   — gemessen 1 von 1
 *   lever            blankes Array  — nichts zu prüfen
 *   ashby            `{ jobs }`     — nichts zu prüfen
 *
 * Die beiden unteren sehen trivial aus. Sie stehen trotzdem hier,
 * damit die Annahme „das Board kommt in einem Zug" an einer Stelle
 * geschrieben steht — und damit sie auffällt, wenn ein Anbieter
 * anfängt zu paginieren.
 */
const VOLLSTAENDIG: Record<BoardKind, (payload: unknown) => boolean> = {
  greenhouse: greenhouseVollstaendig,
  lever: leverVollstaendig,
  ashby: ashbyVollstaendig,
  smartrecruiters: smartRecruitersVollstaendig,
  recruitee: recruiteeVollstaendig,
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
  recruitee: {
    /*
     * Das einzige der fünf Boards mit STRUKTURIERTEM Gehalt.
     *
     * Gemessen am 8. September 2026 ueber 203 Anzeigen zweier
     * Mandanten: 123 (61 %) tragen einen Betrag, mit eigener Periode
     * (`year`, `month`) und eigener Währung. Das ist kein aus dem
     * Text geratener Betrag, sondern ein Feld, das der Arbeitgeber
     * gefüllt hat.
     *
     * `expiry` steht trotzdem auf `false`: `close_at` gibt es, war
     * aber bei keiner der 203 Anzeigen gesetzt. Verarbeitet wird das
     * Feld (siehe `parseRecruitee`), behauptet wird es nicht.
     *
     * `maxPerRequest` ist die gemessene Obergrenze, nicht eine
     * dokumentierte: Der größere Mandant lieferte 194 Stellen in
     * einem Zug. Eine Grenze nennt der Endpunkt nicht.
     */
    search: false, details: true, since: false, maxPerRequest: 1000,
    rateLimitPerMinute: null, salary: true, expiry: false, structuredRequirements: false,
  },
};

const NAMES: Record<BoardKind, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  recruitee: "Recruitee",
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
        return {
          reg,
          listings: PARSERS[this.board](payload, reg.employerName),
          vollstaendig: VOLLSTAENDIG[this.board](payload),
        };
      }),
    );

    let vollstaendig = true;

    for (const [i, ergebnis] of ergebnisse.entries()) {
      const reg = this.registrations()[i]!;
      if (ergebnis.status === "fulfilled") {
        listings.push(...ergebnis.value.listings);
        if (!ergebnis.value.vollstaendig) vollstaendig = false;
      } else {
        /* Ein ausgefallenes Board macht den Lauf unvollständig. */
        vollstaendig = false;
        errors.push({
          boardToken: reg.boardToken,
          message:
            ergebnis.reason instanceof Error ? ergebnis.reason.message : String(ergebnis.reason),
        });
      }
    }

    /*
     * Abgeschnitten heisst unvollständig — auch hier.
     *
     * Wer mehr gesammelt hat, als die Grenze zulässt, gibt einen
     * Ausschnitt zurück. Aus einem Ausschnitt folgt über eine
     * fehlende Stelle nichts.
     */
    if (listings.length > limit) vollstaendig = false;

    return { listings: listings.slice(0, limit), errors, vollstaendig };
  }
}
