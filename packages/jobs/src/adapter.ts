import { createHash } from "node:crypto";
import { anforderungEinstufen, istWunschUeberschrift } from "./anforderungsart.ts";
import { erfahrungsniveauAusText } from "./erfahrungsniveau.ts";
import type { Herkunft, Job, JobRequirement, JobSource } from "@paycheck/domain";
import { leistungsnamen } from "./leistungen.ts";
import { beschreibungsTokens } from "@paycheck/matching";
import { gehaltAusText } from "./gehalt-aus-text.ts";
import { waehrungBestimmen } from "./waehrung.ts";

/**
 * Jobquellen-Adapter.
 *
 * Jede Quelle liefert dieselbe normalisierte Form. Was sie NICHT darf,
 * steht genauso fest wie was sie liefert: kein Umgehen von
 * Nutzungsbedingungen, keine CAPTCHAs, keine Zugriffssperren, kein
 * Massenabruf ohne Lizenz. Eine Quelle ohne geklaerte Rechtslage wird
 * nicht aktiviert - `licenseStatus: "unclear"` bedeutet aus.
 */

export interface RawListing {
  /** Stabile Kennung innerhalb der Quelle. */
  externalId: string;
  title: string;
  companyName: string;
  location: string;
  country?: string;
  workModel?: "on_site" | "hybrid" | "remote";
  remotePercent?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  /**
   * Woher der Betrag stammt, wenn der Adapter es weiss.
   *
   * Nur nötig, wenn es NICHT die schlichte Anbieterangabe ist. Adzuna
   * etwa markiert eigene Schätzungen (`salary_is_predicted`) — die sind
   * eine brauchbare Grössenordnung, aber keine Zusage des Arbeitgebers.
   *
   * Ohne dieses Feld gab es nur zwei Möglichkeiten: die Schätzung
   * wegwerfen oder sie als Arbeitgeberangabe ausgeben. Beides falsch.
   */
  salaryProvenance?: "provider" | "board_estimate" | "text";
  salaryPeriod?: "year" | "month" | "hour";
  contractType?: string | null;
  weeklyHours?: number | null;
  shiftWork?: boolean | null;
  travelPercent?: number | null;
  experienceLevel?: string | null;
  industry?: string | null;
  languageRequirements?: Record<string, string>;
  requiredLicenses?: string[];
  workPermitRequired?: boolean | null;
  description: string;
  benefits?: string[];
  applyMethod?: "email" | "portal" | "form" | "unknown";
  applyTarget?: string | null;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  originalUrl?: string | null;
  /** Rohdaten für den Snapshot. Erlaubt später, Änderungen zu zeigen. */
  raw?: Record<string, unknown>;
}

export interface FetchOptions {
  /** Nur Anzeigen, die seit diesem Zeitpunkt neu oder geaendert sind. */
  since?: Date;
  limit?: number;
  signal?: AbortSignal;
}

export interface ProviderCapabilities {
  /** Freitextsuche über Stellen. */
  search: boolean;
  /** Einzelabruf einer Anzeige mit mehr Feldern. */
  details: boolean;
  /** Filter „nur seit Zeitpunkt X“. Fehlt er, wird jedes Mal alles geholt. */
  since: boolean;
  /** Höchstzahl Ergebnisse je Anfrage. */
  maxPerRequest: number;
  /** Anfragen je Minute, die der Anbieter zulässt. null heisst unbekannt. */
  rateLimitPerMinute: number | null;
  /** Liefert der Anbieter Gehaltsangaben? */
  salary: boolean;
  /** Liefert er ein Ablaufdatum? Ohne das bleiben tote Anzeigen länger stehen. */
  expiry: boolean;
  /** Liefert er strukturierte Anforderungen statt nur Fliesstext? */
  structuredRequirements: boolean;
}

/**
 * Die vorsichtige Annahme.
 *
 * Ein Anbieter, der nichts über sich sagt, kann suchen und sonst
 * nichts. Nicht: „kann alles, bis das Gegenteil bewiesen ist“ — diese
 * Richtung erzeugt stille Fehler, weil ein nicht unterstützter Filter
 * meistens einfach ignoriert wird und ein plausibles, falsches Ergebnis
 * liefert.
 */
export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  search: true,
  details: false,
  since: false,
  maxPerRequest: 100,
  rateLimitPerMinute: null,
  salary: false,
  expiry: false,
  structuredRequirements: false,
};

export interface JobSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly kind: JobSource["kind"];
  readonly licenseStatus: JobSource["licenseStatus"];
  /**
   * Wie nah diese Quelle am Arbeitgeber ist.
   *
   * Getrennt von `kind`, weil das eine Vertragsfrage ist und das hier
   * die Frage der Person vor dem Link: lande ich beim Arbeitgeber oder
   * bei einer weiteren Sammelstelle? Fehlt die Angabe, wird sie aus
   * `kind` abgeleitet — vorsichtig, also im Zweifel als Sammelstelle.
   */
  readonly herkunft?: Herkunft;

  readonly attributionRequired: boolean;
  readonly attributionText: string | null;
  readonly termsUrl: string | null;

  /** Was dieser Anbieter kann. Fehlt die Angabe, gilt DEFAULT_CAPABILITIES —
   *  also wenig. Die andere Richtung erzeugt stille Fehler. */
  readonly capabilities?: ProviderCapabilities;

  /** Ist die Quelle einsatzbereit? Fehlt ein Schlüssel, ist sie es nicht. */
  isConfigured(): boolean;
  fetchListings(options?: FetchOptions): Promise<RawListing[]>;
}

export class SourceNotConfiguredError extends Error {
  constructor(key: string, missing: string) {
    super(
      `Die Jobquelle "${key}" ist nicht eingerichtet: ${missing} fehlt. ` +
        `Sie wird deshalb nicht abgefragt und erscheint als "nicht verbunden".`,
    );
    this.name = "SourceNotConfiguredError";
  }
}

// --- Normalisierung ------------------------------------------------------

/**
 * Aufgaben aus dem Fließtext ziehen. Absichtlich schlicht und
 * konservativ: lieber wenige, sichere Aufgaben als viele geratene.
 * Das AI Transition Radar baut darauf auf - falsche Aufgaben wären
 * schlimmer als gar keine.
 */
export function extractCoreTasks(description: string): string[] {
  const lines = description
    .split(/\n|·|•|—|-\s/)
    .map((l) => l.trim())
    .filter((l) => l.length > 15 && l.length < 200);

  const verbLed = lines.filter((l) =>
    /^(du |sie |wir suchen|betreu|erstell|koordinier|analysier|entwickel|pfleg|berat|planen|fuehr)/i.test(l),
  );

  return (verbLed.length > 0 ? verbLed : lines).slice(0, 8);
}

const MUST_MARKERS = /\b(zwingend|voraussetzung|erforderlich|must|required|unbedingt|setzen wir voraus)\b/i;
const NICE_MARKERS = /\b(von vorteil|wünschenswert|idealerweise|nice to have|plus|gerne)\b/i;

export function classifyRequirement(text: string): "must" | "nice" {
  if (NICE_MARKERS.test(text)) return "nice";
  if (MUST_MARKERS.test(text)) return "must";
  // Ohne Signal als Muss einstufen. Der Fehler in diese Richtung ist
  // harmloser: eine zu streng gewertete Anforderung senkt den Fit, eine
  // zu lax gewertete täuscht Passung vor.
  return "must";
}

export function normaliseWorkModel(raw: string | undefined): Job["workModel"] {
  if (!raw) return "on_site";
  const s = raw.toLowerCase();
  if (/remote|homeoffice|ortsunabhaengig/.test(s)) return "remote";
  if (/hybrid|teilweise/.test(s)) return "hybrid";
  return "on_site";
}

/**
 * Inhaltshash zur Erkennung von Reposts. Bewusst über den inhaltlichen
 * Kern gebildet, nicht über die ganze Anzeige - Datum und Kennung
 * ändern sich bei einer Wiederveröffentlichung, der Text nicht.
 */
export function computeContentHash(listing: {
  title: string;
  companyName: string;
  location: string;
  description: string;
}): string {
  const normalised = [listing.title, listing.companyName, listing.location, listing.description]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 32);
}

export interface NormalisedListing {
  job: Omit<Job, "id" | "companyId" | "sourceId">;
  requirements: Omit<JobRequirement, "id" | "jobId">[];
  companyName: string;
  externalId: string;
  raw: Record<string, unknown>;
}

/**
 * Die Gehaltsangabe — vom Anbieter, sonst aus dem Text, sonst keine.
 *
 * Die Reihenfolge ist die Verlässlichkeit. Ein Feld, das der
 * Arbeitgeber ausgefüllt hat, gewinnt immer; erst wenn keines da ist,
 * wird die Beschreibung gelesen.
 *
 * Gemessen an echten Rohantworten: Arbeitnow kennt gar kein
 * Gehaltsfeld, Adzuna lieferte bei 20 deutschen Anzeigen keines,
 * JSearch bei 10 keines, TheirStack bei einer von zwanzig. Von 1015
 * gespeicherten Stellen hatte deshalb keine einzige eine Angabe —
 * während 4,5 % der Beschreibungen eine enthalten. Diese Angabe
 * wegzuwerfen, weil sie im falschen Feld steht, hiesse: die Person
 * sieht „keine Angabe", wo die Anzeige eine macht.
 *
 * `disclosed` bleibt bei der Textlesung bewusst `false`. Es bedeutet
 * „der Anbieter hat es offengelegt", und das hat er nicht.
 */
function gehaltFuer(listing: RawListing): Job["salary"] {
  /*
   * Die Währung wird bestimmt, nicht durchgereicht.
   *
   * Hier stand zweimal `listing.salaryCurrency ?? "EUR"`. Das reichte
   * die Anbieterangabe ungeprüft weiter — und machte aus fehlendem
   * Wissen einen Euro.
   *
   * Beides ging schief. Eine Stelle in Frankfurt kam von TheirStack mit
   * `salary_currency: "GBP"` und wurde als „60.000–80.000 GBP"
   * angezeigt: plausible Zahl, plausibles Kürzel, und zusammen ein um
   * rund fünfzehn Prozent falscher Betrag — in die Richtung, die eine
   * Stelle attraktiver aussehen lässt, als sie ist.
   *
   * `waehrungBestimmen()` lässt dem Anbieter den Vorrang, aber kein
   * Vetorecht: Widerspricht seine Angabe dem Land der Stelle und
   * bestätigt der Gehaltstext sie nicht, gilt das Land. Die Begründung
   * kommt mit, damit eine spätere Reparatur nachvollziehbar bleibt.
   */
  const befund = waehrungBestimmen({
    providerWaehrung: listing.salaryCurrency,
    rohtext: listing.description,
    land: listing.country,
  });

  const vomAnbieter = listing.salaryMin != null || listing.salaryMax != null;
  if (vomAnbieter) {
    /*
     * Eine Plattformschätzung ist nicht „offengelegt".
     *
     * `disclosed` heisst: Der Arbeitgeber hat die Zahl genannt. Bei
     * einer Schätzung der Jobplattform hat er das nicht — sie ist
     * gerechnet, nicht gemeldet. Sie trotzdem als offengelegt zu führen
     * hiesse, dem Arbeitgeber eine Aussage zuzuschreiben, die er nie
     * gemacht hat.
     */
    const herkunft = listing.salaryProvenance ?? "provider";
    return {
      min: listing.salaryMin ?? null,
      max: listing.salaryMax ?? null,
      currency: befund.waehrung ?? "EUR",
      period: listing.salaryPeriod ?? "year",
      disclosed: herkunft === "provider",
      provenance: herkunft,
      evidence: null,
    };
  }

  const ausText = gehaltAusText(listing.description);
  if (ausText) {
    return {
      min: ausText.min,
      max: ausText.max,
      currency: ausText.currency,
      period: ausText.period,
      // Nicht offengelegt: gelesen. Der Unterschied ist der Punkt.
      disclosed: false,
      provenance: "text",
      evidence: ausText.beleg,
    };
  }

  /*
   * Fehlt die Angabe, ist sie NICHT null-Gehalt, sondern schlicht
   * nicht vorhanden. Diese Unterscheidung trägt die ganze
   * Bedingungsprüfung.
   */
  /*
   * Ohne Betrag ist die Währung ohne Bedeutung.
   *
   * Sie steht hier trotzdem, weil das Feld in der Datenbank nicht
   * leer sein darf. Angezeigt wird sie nie — wo kein Betrag ist, steht
   * „Gehalt nicht angegeben".
   */
  return {
    min: null,
    max: null,
    currency: befund.waehrung ?? "EUR",
    period: listing.salaryPeriod ?? "year",
    disclosed: false,
    provenance: null,
    evidence: null,
  };
}

export function normalise(listing: RawListing, fetchedAt = new Date()): NormalisedListing {
  const contentHash = computeContentHash({
    title: listing.title,
    companyName: listing.companyName,
    location: listing.location,
    description: listing.description,
  });

  /*
   * Zeilen mit ihrem Abschnitt lesen, nicht einzeln.
   *
   * Viele Anzeigen kennzeichnen ihre Punkte gar nicht — sie machen die
   * Trennung nur über zwei Überschriften: „Das bringen Sie mit" und
   * „Das wäre zusätzlich schön". Die einzelne Zeile enthält dann kein
   * Signalwort, und wer sie für sich liest, verliert die einzige
   * Information darüber, ob sie Pflicht ist.
   *
   * Deshalb läuft die Extraktion einmal von oben durch und merkt sich,
   * in welchem Block sie gerade ist.
   */
  let imWunschblock = false;
  const requirementLines: { text: string; wunschblock: boolean }[] = [];
  for (const roh of listing.description.split(/\n/)) {
    const zeile = roh.replace(/^[-•·*]\s*/, "").trim();
    if (!zeile) continue;

    /*
     * Eine Überschrift ist selbst keine Anforderung.
     *
     * Sie ist kurz, endet oft ohne Satzzeichen und trägt keinen
     * Aufzählungspunkt. Erkennen wir sie als Anforderung, steht später
     * „Das wünschen wir uns" als Muss-Kriterium in der Liste.
     */
    if (istWunschUeberschrift(zeile)) { imWunschblock = true; continue; }
    if (/^(das\s+)?(bringen\s+Sie\s+mit|erwarten\s+wir|ihr\s+profil|dein\s+profil|anforderungen)\b/i.test(zeile)) {
      imWunschblock = false;
      continue;
    }

    if (zeile.length > 10 && zeile.length < 160
      && /\b(erfahrung|kenntnis|abschluss|sprach|fuehrerschein|sicher im|bereitschaft)\b/i.test(zeile)) {
      requirementLines.push({ text: zeile, wunschblock: imWunschblock });
    }
  }

  return {
    externalId: listing.externalId,
    companyName: listing.companyName,
    raw: listing.raw ?? {},
    requirements: requirementLines.slice(0, 12).map(({ text, wunschblock }) => ({
      kind: classifyRequirement(text),
      text,
      skillKey: null,
      /*
       * Ob die Anzeige es verlangt oder wünscht — und ob es holbar ist.
       *
       * Ohne diese Felder sind zwölf Aufzählungspunkte zwölf
       * gleichwertige Zeilen, und niemand kann sagen, ob neun von zwölf
       * reichen. Mit ihnen wird daraus der Satz, auf den es ankommt:
       * „Dir fehlt eines von sieben Muss-Kriterien, und das ist ein Kurs."
       */
      ...anforderungEinstufen(text, wunschblock),
      category: /sprach/i.test(text)
        ? ("language" as const)
        : /fuehrerschein|lizenz|zertifikat/i.test(text)
          ? ("license" as const)
          : /abschluss|studium|ausbildung/i.test(text)
            ? ("qualification" as const)
            : /erfahrung/i.test(text)
              ? ("experience" as const)
              : ("skill" as const),
    })),
    job: {
      title: listing.title.trim(),
      companyName: listing.companyName.trim(),
      location: listing.location.trim(),
      country: listing.country ?? "DE",
      /*
       * Beim Import noch offen.
       *
       * Die Kennung entsteht aus der Zuordnung des Titels zu einer
       * amtlichen Bezeichnung, und die steht erst fest, wenn
       * `entgelt-sammeln.mjs zuordnung` gelaufen ist.
       * `kldb-nachtragen.mjs` trägt sie danach nach. Hier zu raten
       * hiesse, eine amtliche Kennung zu erfinden.
       */
      kldb: null,
      latitude: null,
      longitude: null,
      workModel: listing.workModel ?? normaliseWorkModel(undefined),
      remotePercent: listing.remotePercent ?? null,
      salary: gehaltFuer(listing),
      contractType: (listing.contractType ?? null) as Job["contractType"],
      weeklyHours: listing.weeklyHours ?? null,
      shiftWork: listing.shiftWork ?? null,
      travelPercent: listing.travelPercent ?? null,
      /*
       * Fehlt die Angabe, wird sie aus dem Text gelesen.
       *
       * Gemessen an den 5.000 neuesten deutschen Anzeigen füllen 67
       * dieses Feld — 1,3 Prozent. Der Bewertungsfaktor `growth` mit
       * 15 Prozent Gewicht war damit praktisch immer unbekannt, und
       * eine niedrige Deckung ist der Grund, aus dem gar keine Passung
       * berechnet wird.
       *
       * Die Quelle hat Vorrang: Was der Arbeitgeber angibt, schlägt
       * das, was wir im Text finden.
       */
      experienceLevel: ((listing.experienceLevel ??
        erfahrungsniveauAusText(listing.title, listing.description)) ??
        null) as Job["experienceLevel"],
      industry: listing.industry ?? null,
      languageRequirements: listing.languageRequirements ?? {},
      requiredLicenses: listing.requiredLicenses ?? [],
      workPermitRequired: listing.workPermitRequired ?? null,
      coreTasks: extractCoreTasks(listing.description),
      description: listing.description.trim(),
      /*
       * Die Wortmenge entsteht hier, nicht in der Datenbank.
       *
       * Sie ist eine Ableitung der Beschreibung, und Ableitungen
       * gehören dorthin, wo das Original entsteht — sonst gibt es
       * einen Moment, in dem beide auseinanderlaufen. Beim Schreiben
       * zusammen, beim Lesen getrennt: die Rangfolge nimmt nur die
       * Wortmenge, die Detailseite nur den Text.
       */
      descriptionTokens: beschreibungsTokens(listing.description),
      descriptionLength: listing.description.trim().length,
      /*
       * Leistungen: erst der Anbieter, dann der Text.
       *
       * Gemessen am 1.9.2026 hatten 0 von 1.500 Stellen einen Eintrag.
       * Genau ein Anbieter liefert überhaupt ein Benefits-Feld, und der
       * deutsche Markt nennt Leistungen im Fliesstext. Sie lagen also
       * die ganze Zeit vor und wurden weggeworfen; die Textauswertung
       * findet sie bei zwei Dritteln der Anzeigen.
       *
       * Die Reihenfolge ist wie beim Gehalt: Was der Anbieter
       * ausdrücklich angibt, hat Vorrang. Gelesen wird nur, wo nichts
       * angegeben ist.
       */
      benefits: (listing.benefits ?? []).length > 0
        ? listing.benefits!
        : leistungsnamen(listing.description),
      applyMethod: listing.applyMethod ?? "unknown",
      applyTarget: listing.applyTarget ?? null,
      publishedAt: listing.publishedAt ?? null,
      expiresAt: listing.expiresAt ?? null,
      fetchedAt,
      lastLinkCheckAt: null,
      lastLinkCheckOk: null,
      originalUrl: listing.originalUrl ?? null,
      contentHash,
      isDemo: false,
    },
  };
}

/**
 * Deduplizierung. Gleicher Inhalt heisst nicht: wegwerfen. Die spätere
 * Anzeige bleibt, die frueheren werden als Vorgeschichte vermerkt - so
 * kann die Oberfläche sagen "das gab es schon einmal", statt still eine
 * Version verschwinden zu lassen.
 */
export interface DeduplicationResult<T extends { contentHash: string; publishedAt: Date | null }> {
  keep: T[];
  duplicates: { kept: T; earlier: T[] }[];
}

export function deduplicate<T extends { contentHash: string; publishedAt: Date | null }>(
  listings: T[],
): DeduplicationResult<T> {
  const groups = new Map<string, T[]>();
  for (const l of listings) {
    const list = groups.get(l.contentHash) ?? [];
    list.push(l);
    groups.set(l.contentHash, list);
  }

  const keep: T[] = [];
  const duplicates: { kept: T; earlier: T[] }[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      keep.push(group[0]!);
      continue;
    }
    const sorted = [...group].sort(
      (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    );
    const [newest, ...earlier] = sorted;
    keep.push(newest!);
    duplicates.push({ kept: newest!, earlier });
  }

  return { keep, duplicates };
}
