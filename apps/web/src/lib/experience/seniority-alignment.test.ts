import { describe, expect, it } from "vitest";
import { ABWERTEND, assessSeniority, levelFromTitle, levelFromYears } from "./seniority-alignment.ts";

describe("Niveau ableiten", () => {
  it("aus Jahren", () => {
    expect(levelFromYears(0.5)).toBe("entry");
    expect(levelFromYears(2)).toBe("junior");
    expect(levelFromYears(4)).toBe("mid");
    expect(levelFromYears(12)).toBe("lead");
  });

  it("bleibt ohne Angabe unbekannt", () => {
    expect(levelFromYears(null)).toBe("unknown");
    expect(levelFromTitle("Sachbearbeitung")).toBe("unknown");
  });

  it("aus dem Titel", () => {
    expect(levelFromTitle("Senior Backend Engineer")).toBe("senior");
    expect(levelFromTitle("Teamleitung Logistik")).toBe("lead");
    expect(levelFromTitle("Junior Controller (m/w/d)")).toBe("junior");
  });
});

describe("Überqualifikation", () => {
  const a = assessSeniority({ userLevel: "lead", jobLevel: "junior" });

  it("erkennt den Abstand", () => {
    expect(a.status).toBe("potentially_overqualified");
  });

  it("schliesst die Stelle nicht aus", () => {
    // Filtern nimmt der Person die Möglichkeit. Benennen gibt ihr die
    // Gelegenheit, den Punkt selbst anzusprechen.
    expect(a.status).not.toBe("blocked");
    expect(a.questions.length).toBeGreaterThan(0);
  });

  it("formuliert nie abwertend", () => {
    const text = [a.headline, ...a.riskReasons, ...a.questions].join(" ");
    expect(text).not.toMatch(ABWERTEND);
  });

  it("sagt nicht voraus, was der Arbeitgeber tut", () => {
    const text = [a.headline, ...a.riskReasons].join(" ");
    expect(text).not.toMatch(/wird (dich )?(ablehnen|nehmen)|bekommst du (nicht|sicher)/i);
    expect(text).toMatch(/kann erklärungsbedürftig sein/);
  });

  it("fragt nach der Motivation, statt sie zu erfinden", () => {
    expect(a.questions.join(" ")).toMatch(/Was reizt dich/);
  });

  it("nennt es Wechsel, wenn es einer ist", () => {
    const w = assessSeniority({ userLevel: "lead", jobLevel: "junior", careerChange: true });
    expect(w.status).toBe("career_change");
    expect(w.headline).toMatch(/Wechsel/);
  });
});

describe("Einstiegslücke", () => {
  it("benennt sie ohne Entmutigung", () => {
    const a = assessSeniority({ userLevel: "entry", jobLevel: "senior" });
    expect(a.status).toBe("entry_gap");
    expect(a.questions.join(" ")).toMatch(/bereits in ähnlicher Form/);
    expect([a.headline, ...a.riskReasons].join(" ")).not.toMatch(ABWERTEND);
  });

  it("nennt einen Schritt nach oben erreichbar", () => {
    const a = assessSeniority({ userLevel: "mid", jobLevel: "senior" });
    expect(a.status).toBe("stretch");
    expect(a.headline).toMatch(/erreichbar/);
  });
});

describe("Unbekanntes", () => {
  it("behauptet nichts ohne Datenlage", () => {
    const a = assessSeniority({ userLevel: "unknown", jobLevel: "senior" });
    expect(a.status).toBe("unclear");
    expect(a.riskReasons).toEqual([]);
    expect(a.confidence).toBeLessThan(0.3);
  });
});
