import { describe, expect, it } from "vitest";
import { checkConstraints } from "./constraints.js";
import { computeFit, DEFAULT_FIT_WEIGHTS, normaliseWeights } from "./fit.js";
import { computeConfidence } from "./confidence.js";
import { computeJobQuality } from "./jobQuality.js";
import { computeAiTransition } from "./aiTransition.js";
import { computeListingConfidence } from "./listingConfidence.js";
import { computeOverall, sortJobs, type RankableJob } from "./ranking.js";
import { weightedScore } from "./weighted.js";
import { makeConstraints, makeEvidence, makeJob, makeRequirements, makeSource, testCommute } from "./fixtures.js";

// ---------------------------------------------------------------------------
// Das zentrale Versprechen: Unbekanntes ist neutral.
// ---------------------------------------------------------------------------
describe("Unbekanntes ist neutral", () => {
  it("wertet einen fehlenden Faktor nicht als Null", () => {
    const alleBekannt = weightedScore([
      { key: "a", label: "A", raw: 0.8, weight: 0.5, explanation: "" },
      { key: "b", label: "B", raw: 0.8, weight: 0.5, explanation: "" },
    ]);
    const einerFehlt = weightedScore([
      { key: "a", label: "A", raw: 0.8, weight: 0.5, explanation: "" },
      { key: "b", label: "B", raw: null, weight: 0.5, explanation: "" },
    ]);
    // Der Wert bleibt gleich; nur die Abdeckung faellt.
    expect(einerFehlt.value).toBeCloseTo(alleBekannt.value!, 5);
    expect(einerFehlt.coverage).toBe(0.5);
    expect(alleBekannt.coverage).toBe(1);
  });

  it("liefert keinen Wert, wenn gar nichts bekannt ist", () => {
    const r = weightedScore([{ key: "a", label: "A", raw: null, weight: 1, explanation: "" }]);
    expect(r.value).toBeNull();
    expect(r.coverage).toBe(0);
  });

  it("senkt den Fit nicht, wenn die Anzeige unvollstaendig ist", () => {
    const evidence = makeEvidence();
    const basis = {
      requirements: makeRequirements(), evidence, constraints: makeConstraints(),
      energisingTasks: ["Kunden betreuen", "praesentieren"], drainingTasks: ["Kaltakquise"],
      workStylePreferences: ["viel Austausch im Team"], rankedValues: ["Lernen", "Flexibilitaet"],
      statedInterests: ["Customer Success"],
    };
    const voll = computeFit({ job: makeJob(), ...basis });
    // Dieselbe Stelle, aber ohne Aufgaben und ohne Erfahrungsniveau.
    const duenn = computeFit({ job: makeJob({ coreTasks: [], experienceLevel: null }), ...basis });

    expect(voll.score).not.toBeNull();
    // Die Passung bricht nicht ein, nur weil Angaben fehlen.
    expect(duenn.coverage).toBeLessThan(voll.coverage);
    if (duenn.score !== null && voll.score !== null) {
      expect(duenn.score).toBeGreaterThan(voll.score - 25);
    }
  });
});

// ---------------------------------------------------------------------------
// Harte Bedingungen
// ---------------------------------------------------------------------------
describe("harte Bedingungen", () => {
  it("blockiert bei unterschrittenem Mindestgehalt", () => {
    const job = makeJob({ salary: { min: 32000, max: 36000, currency: "EUR", period: "year", disclosed: true } });
    const r = checkConstraints(job, makeConstraints({ minSalaryPerYear: 42000 }), testCommute);
    expect(r.overall).toBe("blocked");
    expect(r.blockedBy).toContain("salary");
  });

  it("blockiert nicht, wenn das Gehalt schlicht fehlt", () => {
    const job = makeJob({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false } });
    const r = checkConstraints(job, makeConstraints({ minSalaryPerYear: 42000 }), testCommute);
    const salary = r.checks.find((c) => c.key === "salary");
    expect(salary?.verdict).toBe("uncertain");
    expect(r.blockedBy).not.toContain("salary");
  });

  it("blockiert bei fehlender Pflichtlizenz", () => {
    const job = makeJob({ requiredLicenses: ["Fuehrerschein C1", "Staplerschein"] });
    const r = checkConstraints(job, makeConstraints({ licenses: ["Fuehrerschein C1"] }), testCommute);
    expect(r.blockedBy).toContain("licenses");
    expect(r.checks.find((c) => c.key === "licenses")?.reason).toContain("Staplerschein");
  });

  it("blockiert bei zu langem Arbeitsweg, aber nicht bei Umzugsbereitschaft", () => {
    const job = makeJob({ location: "Luebeck", workModel: "on_site" });
    const c = makeConstraints({ acceptedWorkModels: ["on_site", "hybrid"], maxCommuteMinutes: 45 });
    expect(checkConstraints(job, c, testCommute).blockedBy).toContain("commute");
    const umzug = checkConstraints(job, { ...c, willingToRelocate: true }, testCommute);
    expect(umzug.blockedBy).not.toContain("commute");
    expect(umzug.uncertainAbout).toContain("commute");
  });

  it("blockiert Schichtarbeit, wenn sie ausgeschlossen wurde", () => {
    const r = checkConstraints(makeJob({ shiftWork: true }), makeConstraints({ acceptsShiftWork: false }), testCommute);
    expect(r.blockedBy).toContain("shift");
  });

  it("blockiert bei fehlendem Sprachniveau", () => {
    const job = makeJob({ languageRequirements: { de: "C1", fr: "B2" } });
    const r = checkConstraints(job, makeConstraints(), testCommute);
    expect(r.blockedBy).toContain("language");
  });

  it("laesst eine passende Stelle vollstaendig durch", () => {
    const r = checkConstraints(makeJob(), makeConstraints(), testCommute);
    expect(r.blockedBy).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fit
// ---------------------------------------------------------------------------
describe("Fit", () => {
  const basis = {
    requirements: makeRequirements(), constraints: makeConstraints(),
    energisingTasks: ["Kunden betreuen", "Schulungen praesentieren"], drainingTasks: ["Kaltakquise"],
    workStylePreferences: ["viel Austausch im Team", "eigenstaendig priorisieren"],
    rankedValues: ["Lernen", "Flexibilitaet"], statedInterests: ["Customer Success"],
  };

  it("zeigt keine Zahl ohne ausreichende Datenbasis", () => {
    const r = computeFit({ job: makeJob({ coreTasks: [], experienceLevel: null, benefits: [] }), ...basis, evidence: [] });
    expect(r.score).toBeNull();
    expect(["insufficient_data", "exploratory"]).toContain(r.band);
  });

  it("nennt immer auch einen Vorbehalt, selbst bei guter Passung", () => {
    const r = computeFit({ job: makeJob(), ...basis, evidence: makeEvidence() });
    expect(r.topReservation.length).toBeGreaterThan(10);
    expect(r.topReason.length).toBeGreaterThan(10);
  });

  it("zaehlt unbestaetigte Hypothesen nicht als Beleg", () => {
    const bestaetigt = computeFit({ job: makeJob(), ...basis, evidence: makeEvidence() });
    const hypothesen = computeFit({
      job: makeJob(), ...basis,
      evidence: makeEvidence().map((e) => ({ ...e, userConfirmed: false, sourceType: "ai_hypothesis" as const })),
    });
    expect(hypothesen.factors.find((f) => f.key === "proven_skills")?.raw).toBeNull();
    expect(bestaetigt.factors.find((f) => f.key === "proven_skills")?.raw).not.toBeNull();
  });

  it("ignoriert geloeschte und abgelehnte Evidenz", () => {
    const geloescht = makeEvidence().map((e) => ({ ...e, deletedAt: new Date() }));
    const r = computeFit({ job: makeJob(), ...basis, evidence: geloescht });
    expect(r.factors.find((f) => f.key === "proven_skills")?.raw).toBeNull();
  });

  it("verknuepft belegte Faktoren mit Evidenz-IDs", () => {
    const r = computeFit({ job: makeJob(), ...basis, evidence: makeEvidence() });
    const skills = r.factors.find((f) => f.key === "proven_skills");
    expect(skills?.evidenceIds.length ?? 0).toBeGreaterThan(0);
  });

  it("haelt Nutzergewichte in vernuenftigen Grenzen und normalisiert sie", () => {
    const w = normaliseWeights({ provenSkills: 0.99, statedInterest: 0.99 });
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(w.provenSkills).toBeLessThanOrEqual(0.51);
    const std = Object.values(DEFAULT_FIT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(std).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// Confidence, Jobqualitaet, KI, Anzeige
// ---------------------------------------------------------------------------
describe("Confidence", () => {
  it("faellt bei duennem Profil und nennt den Grund", () => {
    const hoch = computeConfidence({ job: makeJob(), fitCoverage: 1, profileCoverage: 1, requirementCount: 3, reviews: [], now: new Date("2026-08-29") });
    const niedrig = computeConfidence({ job: makeJob(), fitCoverage: 0.3, profileCoverage: 0.2, requirementCount: 0, reviews: [], now: new Date("2026-08-29") });
    expect(niedrig.score).toBeLessThan(hoch.score);
    expect(niedrig.reducedBy.join(" ")).toMatch(/Profil/);
  });

  it("benennt fehlende Angaben der Anzeige einzeln", () => {
    const job = makeJob({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false }, contractType: null });
    const r = computeConfidence({ job, fitCoverage: 1, profileCoverage: 1, requirementCount: 3, reviews: [], now: new Date("2026-08-29") });
    expect(r.reducedBy.join(" ")).toContain("Gehalt");
  });
});

describe("Jobqualitaet", () => {
  it("sagt bei duenner Datenlage 'nicht beurteilbar' statt schlecht", () => {
    const job = makeJob({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false }, contractType: null, remotePercent: null, shiftWork: null });
    const r = computeJobQuality({ job, reviews: [], themes: [] });
    expect(r.insufficientData).toBe(true);
    expect(r.score).toBeNull();
  });

  it("liefert einen Wert, sobald genug Dimensionen bekannt sind", () => {
    const r = computeJobQuality({
      job: makeJob(), reviews: [], salaryBenchmarkPerYear: 46000,
      themes: [
        { id: "t1", companyId: "co-1", aggregateId: "a1", theme: "Weiterbildung", sentiment: "positive", mentionCount: 20, summary: "Viel Lernen moeglich", sourceUrl: null, periodFrom: null, periodTo: null },
        { id: "t2", companyId: "co-1", aggregateId: "a1", theme: "Arbeitsbelastung", sentiment: "mixed", mentionCount: 12, summary: "Zeitweise hoher Druck", sourceUrl: null, periodFrom: null, periodTo: null },
        { id: "t3", companyId: "co-1", aggregateId: "a1", theme: "Fuehrung", sentiment: "positive", mentionCount: 9, summary: "Gute Vorgesetzte", sourceUrl: null, periodFrom: null, periodTo: null },
      ],
    });
    expect(r.insufficientData).toBe(false);
    expect(r.score).not.toBeNull();
  });
});

describe("AI Transition Radar", () => {
  it("bewertet Aufgaben, nicht den Berufstitel", () => {
    const r = computeAiTransition({ job: makeJob(), dataAsOf: new Date("2026-06-01") });
    expect(r.tasks).toHaveLength(4);
    expect(r.tasks[0]!.task).toContain("betreuen");
  });

  it("erkennt menschlichen Kern bei Aushandlung und Verantwortung", () => {
    const r = computeAiTransition({ job: makeJob({ coreTasks: ["Bei Eskalationen vermitteln und entscheiden", "Team anleiten und Verantwortung tragen"] }) });
    expect(r.category).toBe("relatively_robust");
  });

  it("sagt bei fehlenden Aufgaben ehrlich nichts", () => {
    const r = computeAiTransition({ job: makeJob({ coreTasks: [] }) });
    expect(r.category).toBe("unclear_data");
    expect(r.confidence).toBe("low");
  });

  it("nennt Szenarien statt einer Prognose mit Jahreszahl", () => {
    const r = computeAiTransition({ job: makeJob() });
    expect(r.scenarios.length).toBeGreaterThanOrEqual(2);
    const text = JSON.stringify(r).toLowerCase();
    expect(text).not.toMatch(/verschwindet in \d/);
    expect(text).not.toMatch(/in (fuenf|5|zehn|10) jahren (weg|ersetzt)/);
  });
});

describe("Listing Confidence", () => {
  it("markiert alte Anzeigen als moeglicherweise veraltet", () => {
    const job = makeJob({ publishedAt: new Date("2026-01-01") });
    const r = computeListingConfidence({ job, source: makeSource(), now: new Date("2026-08-29") });
    expect(r.possiblyStale).toBe(true);
    expect(r.level).not.toBe("high");
  });

  it("erkennt moegliche Wiederveroeffentlichung", () => {
    const r = computeListingConfidence({ job: makeJob(), source: makeSource(), earlierDuplicateCount: 2, now: new Date("2026-08-29") });
    expect(r.possibleRepost).toBe(true);
    expect(r.signals.find((s) => s.key === "repost")?.detail).toContain("2");
  });

  it("verwendet nirgends das Wort Fake", () => {
    const r = computeListingConfidence({ job: makeJob({ originalUrl: null, publishedAt: null }), source: null, now: new Date("2026-08-29") });
    expect(JSON.stringify(r).toLowerCase()).not.toContain("fake");
  });
});

// ---------------------------------------------------------------------------
// Gesamtranking
// ---------------------------------------------------------------------------
describe("Gesamtranking", () => {
  function parts(job = makeJob()) {
    const requirements = makeRequirements();
    const constraints = checkConstraints(job, makeConstraints(), testCommute);
    const fit = computeFit({
      job, requirements, evidence: makeEvidence(), constraints: makeConstraints(),
      energisingTasks: ["Kunden betreuen"], drainingTasks: ["Kaltakquise"],
      workStylePreferences: ["viel Austausch"], rankedValues: ["Lernen"], statedInterests: ["Customer Success"],
    });
    return {
      constraints, fit,
      confidence: computeConfidence({ job, fitCoverage: fit.coverage, profileCoverage: 0.9, requirementCount: 3, reviews: [], now: new Date("2026-08-29") }),
      jobQuality: computeJobQuality({ job, reviews: [], themes: [], salaryBenchmarkPerYear: 46000 }),
      aiTransition: computeAiTransition({ job }),
      listingConfidence: computeListingConfidence({ job, source: makeSource(), now: new Date("2026-08-29") }),
    };
  }

  it("bildet keinen Gesamtwert fuer eine blockierte Stelle", () => {
    const job = makeJob({ shiftWork: true });
    const p = parts(job);
    p.constraints = checkConstraints(job, makeConstraints({ acceptsShiftWork: false }), testCommute);
    const r = computeOverall(p);
    expect(r.score).toBeNull();
    expect(r.suppressedReason).toContain("harten Bedingungen");
  });

  it("bildet einen Gesamtwert bei ausreichender Datenlage", () => {
    const r = computeOverall(parts());
    expect(r.score).not.toBeNull();
    expect(r.components.length).toBe(4);
  });

  it("sortiert blockierte Stellen immer ans Ende", () => {
    const ok = parts();
    const blockedJob = makeJob({ id: "job-2", shiftWork: true });
    const blocked = { ...parts(blockedJob), constraints: checkConstraints(blockedJob, makeConstraints({ acceptsShiftWork: false }), testCommute) };
    const items: RankableJob[] = [
      { jobId: "job-2", overall: computeOverall(blocked), ...blocked, salaryPerYear: 90000, commuteMinutes: 5, publishedAt: new Date("2026-08-28") },
      { jobId: "job-1", overall: computeOverall(ok), ...ok, salaryPerYear: 48000, commuteMinutes: 20, publishedAt: new Date("2026-08-20") },
    ];
    for (const key of ["best_overall", "highest_salary", "shortest_commute", "newest"] as const) {
      expect(sortJobs(items, key)[0]!.jobId, `Sortierung ${key}`).toBe("job-1");
    }
  });

  it("stellt Stellen ohne Wert hinter Stellen mit Wert", () => {
    const p = parts();
    const items: RankableJob[] = [
      { jobId: "ohne", overall: { score: null, components: [], suppressedReason: "x", version: "t" }, ...p, salaryPerYear: null, commuteMinutes: null, publishedAt: null },
      { jobId: "mit", overall: { score: 70, components: [], suppressedReason: null, version: "t" }, ...p, salaryPerYear: 50000, commuteMinutes: 10, publishedAt: new Date() },
    ];
    expect(sortJobs(items, "best_overall")[0]!.jobId).toBe("mit");
    expect(sortJobs(items, "highest_salary")[0]!.jobId).toBe("mit");
  });
});
