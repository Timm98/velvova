import type { EvidenceItem, Job, JobRequirement, JobSource, UserConstraints } from "@paycheck/domain";
import { beschreibungsTokens } from "./fit.ts";

/** Testbausteine. Ausschließlich synthetisch, keine realen Firmen. */

const T0 = new Date("2026-08-01T00:00:00Z");

export function makeJob(over: Partial<Job> = {}): Job {
  /*
   * Die abgeleiteten Felder werden abgeleitet, nicht mitgeschrieben.
   *
   * Ein Test, der `description` überschreibt und `descriptionTokens`
   * vergisst, würde sonst gegen eine Stelle prüfen, die es so nie
   * gibt: einen Text ohne die dazugehörige Wortmenge. Im Betrieb füllt
   * der Import beides zusammen — hier tut es der Baustein.
   */
  const basis: Job = {
    id: "job-1", title: "Customer Success Manager", companyId: "co-1",
    companyName: "Demo Nordlicht GmbH", location: "Hamburg", country: "DE",
    latitude: null, longitude: null, workModel: "hybrid", remotePercent: 50, kldb: null,
    salary: { min: 44000, max: 52000, currency: "EUR", period: "year", disclosed: true, provenance: null, evidence: null },
    contractType: "permanent", weeklyHours: 40, shiftWork: false, travelPercent: 10,
    /* Der Baustein beschreibt eine offene Ausschreibung. */
    availabilityState: "active", availabilityReason: null,
    experienceLevel: "junior", industry: "Software", languageRequirements: { de: "C1" },
    requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Kundinnen und Kunden nach dem Onboarding betreuen",
      "Nutzungsdaten auswerten und Berichte erstellen",
      "Bei Eskalationen zwischen Kunde und Produktteam vermitteln",
      "Schulungen vorbereiten und präsentieren",
    ],
    description:
      "Du begleitest unsere Kundinnen und Kunden nach dem Start. Du arbeitest eng mit Produkt " +
      "und Support zusammen, priorisierst eigenstaendig und hast viel Austausch im Team. " +
      "Wir bieten Weiterbildung, flexible Arbeitszeit und ein festes Lernbudget.",
    benefits: ["Weiterbildung", "flexible Arbeitszeit", "Lernbudget"],
    applyMethod: "email", applyTarget: "jobs@demo.invalid",
    publishedAt: new Date("2026-08-20T00:00:00Z"), expiresAt: null,
    fetchedAt: new Date("2026-08-28T00:00:00Z"),
    lastLinkCheckAt: new Date("2026-08-28T00:00:00Z"), lastLinkCheckOk: true,
    originalUrl: "https://demo.invalid/jobs/1", sourceId: "src-seed",
    contentHash: "hash-1", isDemo: true,
    descriptionTokens: "", descriptionLength: 0,
    ...over,
  };
  const text = basis.description ?? "";
  return {
    ...basis,
    descriptionTokens: over.descriptionTokens ?? beschreibungsTokens(text),
    descriptionLength: over.descriptionLength ?? text.length,
  };
}

export function makeRequirements(jobId = "job-1"): JobRequirement[] {
  return [
    { id: "r1", jobId, kind: "must", text: "Erfahrung in der Kundenbetreuung", skillKey: "customer_service", category: "experience" },
    { id: "r2", jobId, kind: "must", text: "Sehr gute Deutschkenntnisse", skillKey: "lang_de", category: "language" },
    { id: "r3", jobId, kind: "nice", text: "Erfahrung mit Auswertungen und Berichten", skillKey: "reporting", category: "skill" },
  ];
}

export function makeEvidence(over: Partial<EvidenceItem>[] = []): EvidenceItem[] {
  const base: EvidenceItem[] = [
    {
      id: "ev-1", userId: "u1", type: "experience_episode",
      statement: "Zwei Jahre Kundenbetreuung im Kundenservice, taeglich rund 40 Anfragen bearbeitet",
      sourceType: "user_stated", sourceRef: "turn-4", confidence: 0.9, userConfirmed: true,
      userRejected: false, sensitivityLevel: "normal", retentionClass: "profile",
      createdAt: T0, updatedAt: T0, deletedAt: null,
    },
    {
      id: "ev-2", userId: "u1", type: "skill",
      statement: "Auswertungen und Berichte in Tabellen erstellt und monatlich präsentiert",
      sourceType: "user_stated", sourceRef: "turn-7", confidence: 0.8, userConfirmed: true,
      userRejected: false, sensitivityLevel: "normal", retentionClass: "profile",
      createdAt: T0, updatedAt: T0, deletedAt: null,
    },
    {
      id: "ev-3", userId: "u1", type: "skill",
      statement: "Deutschkenntnisse auf Muttersprachniveau",
      sourceType: "user_confirmed", sourceRef: "turn-9", confidence: 0.95, userConfirmed: true,
      userRejected: false, sensitivityLevel: "normal", retentionClass: "profile",
      createdAt: T0, updatedAt: T0, deletedAt: null,
    },
  ];
  return [...base, ...over.map((o, i) => ({ ...base[0]!, id: `ev-x${i}`, ...o }))];
}

export function makeConstraints(over: Partial<UserConstraints> = {}): UserConstraints {
  return {
    minSalaryPerYear: 42000, currency: "EUR", salaryTradeOffs: [],
    baseLocation: "Hamburg", country: "DE", maxCommuteMinutes: 45,
    commuteMode: "public_transport", acceptedWorkModels: ["hybrid", "remote"],
    willingToRelocate: false, targetCountries: [],
    weeklyHoursMin: null, weeklyHoursMax: null, acceptsShiftWork: false,
    maxTravelPercent: 30, acceptedContractTypes: ["permanent", "fixed_term"],
    languages: { de: "C2", en: "B2" }, licenses: [], workPermitCountries: ["DE"],
    needsVisaSponsorship: false, earliestStartDate: null,
    hardNoGos: ["reine Kaltakquise"],
    /*
     * Die Voreinstellung der Testdaten ist dieselbe wie im Schema.
     *
     * Dieselbe wie im Schema. Ein Test, der eine Sonderkonfiguration
     * annimmt, prüft nicht mehr das Verhalten der Anwendung.
     */
    unklaresBehandeln: "mitzeigen",
    ...over,
  };
}

export function makeSource(over: Partial<JobSource> = {}): JobSource {
  return {
    id: "src-seed", key: "seed", displayName: "Demo-Datensatz", kind: "seed",
    licenseStatus: "demo", attributionRequired: false, attributionText: null,
    termsUrl: null, enabled: true, ...over,
  };
}

/** Schätzt Reisezeiten für Tests deterministisch. */
export const testCommute = {
  estimateMinutes(from: string, to: string): number | null {
    if (from === to) return 20;
    if (from === "Hamburg" && to === "Lübeck") return 70;
    if (from === "Hamburg" && to === "München") return 400;
    return null;
  },
};
