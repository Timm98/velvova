import { describe, expect, it } from "vitest";
import { estimateEffort, fitsInBudget, type EffortInput } from "./effort-estimator.ts";
import { classifyRequirement } from "@/lib/experience/requirement-classifier";

const basis: EffortInput = {
  applyMethod: "external",
  applyTarget: null,
  originalUrl: null,
  requirements: [],
};

describe("Aufwandsschätzung", () => {
  it("erkennt ein aufwendiges Bewerbungssystem an der Adresse", () => {
    const e = estimateEffort({
      ...basis,
      originalUrl: "https://muster.wd3.myworkdayjobs.com/de/jobs/123",
    });
    expect(e.level).toBe("hoch");
    expect(e.drivers).toContain("Konto nötig");
    expect(e.drivers).toContain("Werdegang von Hand");
  });

  it("erkennt ein schlankes System", () => {
    const e = estimateEffort({
      ...basis,
      originalUrl: "https://boards.greenhouse.io/muster/jobs/1",
    });
    expect(e.level).toBe("gering");
    expect(e.minutesMax).toBeLessThanOrEqual(20);
  });

  it("bleibt unbekannt, statt zu raten", () => {
    // Eine erfundene Schätzung wäre schlimmer als keine: die Person
    // plant ihre Woche danach.
    const e = estimateEffort(basis);
    expect(e.level).toBe("unbekannt");
    expect(e.minutesMin).toBeNull();
    expect(e.confidence).toBe(0);
    expect(e.summary).toMatch(/nicht erkennbar/);
  });

  it("rechnet ein Anschreiben als das dazu, was es kostet", () => {
    const ohne = estimateEffort({ ...basis, originalUrl: "https://boards.greenhouse.io/x/jobs/1" });
    const mit = estimateEffort({
      ...basis,
      originalUrl: "https://boards.greenhouse.io/x/jobs/1",
      known: { coverLetterRequired: true },
    });
    expect(mit.minutesMax!).toBeGreaterThan(ohne.minutesMax! + 30);
    expect(mit.drivers).toContain("Anschreiben verlangt");
  });

  it("zählt Screening-Fragen einzeln", () => {
    const e = estimateEffort({
      ...basis,
      originalUrl: "https://boards.greenhouse.io/x/jobs/1",
      known: { screeningQuestionsCount: 5 },
    });
    expect(e.drivers).toContain("5 Fragen");
  });

  it("rechnet beizulegende Nachweise mit", () => {
    const e = estimateEffort({
      ...basis,
      originalUrl: "https://boards.greenhouse.io/x/jobs/1",
      requirements: [
        classifyRequirement("Führerschein Klasse C erforderlich"),
        classifyRequirement("Gesundheitszeugnis erforderlich"),
      ],
    });
    expect(e.drivers.join(" ")).toMatch(/2 Nachweise/);
  });

  it("nennt Quelle und Sicherheit", () => {
    const geraten = estimateEffort({ ...basis, originalUrl: "https://boards.greenhouse.io/x/1" });
    expect(geraten.source).toBe("inferred");

    const gemessen = estimateEffort({
      ...basis,
      originalUrl: "https://boards.greenhouse.io/x/1",
      known: { screeningQuestionsCount: 3 },
    });
    expect(gemessen.source).toBe("provider_data");
    expect(gemessen.confidence).toBeGreaterThan(geraten.confidence);
  });

  it("gibt keine Einstellungswahrscheinlichkeit aus", () => {
    const e = estimateEffort({ ...basis, originalUrl: "https://boards.greenhouse.io/x/1" });
    expect(JSON.stringify(e)).not.toMatch(/wahrscheinlich.*eingestellt|chance/i);
  });
});

describe("Wochenbudget", () => {
  const e = (max: number) =>
    ({ minutesMax: max, minutesMin: max - 5 }) as ReturnType<typeof estimateEffort>;

  it("plant mit der oberen Schätzung", () => {
    // Eine Planung, die vom besten Fall ausgeht, geht schief — und zwar
    // bei der Person, nicht bei uns.
    const { passt, verplantMinuten } = fitsInBudget([e(60), e(60)], 2);
    expect(passt).toHaveLength(2);
    expect(verplantMinuten).toBe(120);
  });

  it("schiebt heraus, was nicht mehr passt", () => {
    const { passt, darueber } = fitsInBudget([e(60), e(60), e(60)], 2);
    expect(passt).toHaveLength(2);
    expect(darueber).toHaveLength(1);
  });

  it("rechnet unbekannten Aufwand vorsichtig, nicht als null", () => {
    const { passt } = fitsInBudget(
      [{ minutesMax: null } as ReturnType<typeof estimateEffort>],
      0.25,
    );
    // 30 Minuten Annahme passen nicht in 15 Minuten Budget.
    expect(passt).toHaveLength(0);
  });
});
