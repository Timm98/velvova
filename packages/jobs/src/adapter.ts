import { createHash } from "node:crypto";
import type { Job, JobRequirement, JobSource } from "@paycheck/domain";

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
  /** Rohdaten fuer den Snapshot. Erlaubt spaeter, Aenderungen zu zeigen. */
  raw?: Record<string, unknown>;
}

export interface FetchOptions {
  /** Nur Anzeigen, die seit diesem Zeitpunkt neu oder geaendert sind. */
  since?: Date;
  limit?: number;
  signal?: AbortSignal;
}

export interface JobSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly kind: JobSource["kind"];
  readonly licenseStatus: JobSource["licenseStatus"];
  readonly attributionRequired: boolean;
  readonly attributionText: string | null;
  readonly termsUrl: string | null;

  /** Ist die Quelle einsatzbereit? Fehlt ein Schluessel, ist sie es nicht. */
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
 * Aufgaben aus dem Fliesstext ziehen. Absichtlich schlicht und
 * konservativ: lieber wenige, sichere Aufgaben als viele geratene.
 * Das AI Transition Radar baut darauf auf - falsche Aufgaben waeren
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
const NICE_MARKERS = /\b(von vorteil|wuenschenswert|idealerweise|nice to have|plus|gerne)\b/i;

export function classifyRequirement(text: string): "must" | "nice" {
  if (NICE_MARKERS.test(text)) return "nice";
  if (MUST_MARKERS.test(text)) return "must";
  // Ohne Signal als Muss einstufen. Der Fehler in diese Richtung ist
  // harmloser: eine zu streng gewertete Anforderung senkt den Fit, eine
  // zu lax gewertete taeuscht Passung vor.
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
 * Inhaltshash zur Erkennung von Reposts. Bewusst ueber den inhaltlichen
 * Kern gebildet, nicht ueber die ganze Anzeige - Datum und Kennung
 * aendern sich bei einer Wiederveroeffentlichung, der Text nicht.
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

export function normalise(listing: RawListing, fetchedAt = new Date()): NormalisedListing {
  const contentHash = computeContentHash({
    title: listing.title,
    companyName: listing.companyName,
    location: listing.location,
    description: listing.description,
  });

  const requirementLines = listing.description
    .split(/\n/)
    .map((l) => l.replace(/^[-•·*]\s*/, "").trim())
    .filter((l) => l.length > 10 && l.length < 160 && /\b(erfahrung|kenntnis|abschluss|sprach|fuehrerschein|sicher im|bereitschaft)\b/i.test(l));

  return {
    externalId: listing.externalId,
    companyName: listing.companyName,
    raw: listing.raw ?? {},
    requirements: requirementLines.slice(0, 12).map((text) => ({
      kind: classifyRequirement(text),
      text,
      skillKey: null,
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
      latitude: null,
      longitude: null,
      workModel: listing.workModel ?? normaliseWorkModel(undefined),
      remotePercent: listing.remotePercent ?? null,
      salary: {
        min: listing.salaryMin ?? null,
        max: listing.salaryMax ?? null,
        currency: listing.salaryCurrency ?? "EUR",
        period: listing.salaryPeriod ?? "year",
        // Entscheidend: fehlt die Angabe, ist sie NICHT null-Gehalt,
        // sondern schlicht nicht offengelegt.
        disclosed: listing.salaryMin != null || listing.salaryMax != null,
      },
      contractType: (listing.contractType ?? null) as Job["contractType"],
      weeklyHours: listing.weeklyHours ?? null,
      shiftWork: listing.shiftWork ?? null,
      travelPercent: listing.travelPercent ?? null,
      experienceLevel: (listing.experienceLevel ?? null) as Job["experienceLevel"],
      industry: listing.industry ?? null,
      languageRequirements: listing.languageRequirements ?? {},
      requiredLicenses: listing.requiredLicenses ?? [],
      workPermitRequired: listing.workPermitRequired ?? null,
      coreTasks: extractCoreTasks(listing.description),
      description: listing.description.trim(),
      benefits: listing.benefits ?? [],
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
 * Deduplizierung. Gleicher Inhalt heisst nicht: wegwerfen. Die spaetere
 * Anzeige bleibt, die frueheren werden als Vorgeschichte vermerkt - so
 * kann die Oberflaeche sagen "das gab es schon einmal", statt still eine
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
