import { describe, expect, it } from "vitest";
import {
  aehnlichste,
  AEHNLICHKEIT_SCHWELLE,
  jobEinbettungstext,
  kosinus,
  profilEinbettungstext,
} from "./vektor.ts";

describe("Kosinus", () => {
  it("erkennt Gleichheit und Gegensatz", () => {
    expect(kosinus([1, 0], [1, 0])).toBeCloseTo(1);
    expect(kosinus([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(kosinus([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("vergleicht keine Vektoren verschiedener Länge", () => {
    /* Zwei Modelle liefern verschiedene Dimensionen. Eine Zahl daraus
       wäre erfunden. */
    expect(kosinus([1, 0], [1, 0, 0])).toBeNull();
  });

  it("gibt für einen Nullvektor nichts zurück", () => {
    expect(kosinus([0, 0], [1, 0])).toBeNull();
  });
});

describe("Ähnlichste", () => {
  const eintraege = [
    { schluessel: "a", vektor: [1, 0], wert: "kommissionierer" },
    { schluessel: "b", vektor: [0.9, 0.1], wert: "lagerhelfer" },
    { schluessel: "c", vektor: [0, 1], wert: "buchhalter" },
  ];

  it("nimmt nur, was über der Schwelle liegt", () => {
    const t = aehnlichste([1, 0], eintraege, 10);
    expect(t.map((x) => x.eintrag)).toEqual(["kommissionierer", "lagerhelfer"]);
    /* „buchhalter" steht senkrecht dazu — Ähnlichkeit 0. */
    expect(t.map((x) => x.eintrag)).not.toContain("buchhalter");
  });

  it("hat eine gemessene Schwelle, keine geratene", () => {
    /*
     * 0.62 liess nur durch, was die Stichwortsuche ohnehin fand. Ein
     * Recall-Schritt, der nichts Neues findet, ist keiner.
     */
    expect(AEHNLICHKEIT_SCHWELLE).toBeLessThan(0.55);
    expect(AEHNLICHKEIT_SCHWELLE).toBeGreaterThan(0.45);
  });

  it("hält die Obergrenze ein", () => {
    expect(aehnlichste([1, 0], eintraege, 1)).toHaveLength(1);
  });

  it("sortiert bei Gleichstand stabil", () => {
    const gleich = [
      { schluessel: "zzz", vektor: [1, 0], wert: "z" },
      { schluessel: "aaa", vektor: [1, 0], wert: "a" },
    ];
    const vorwaerts = aehnlichste([1, 0], gleich, 10).map((t) => t.eintrag);
    const rueckwaerts = aehnlichste([1, 0], [...gleich].reverse(), 10).map((t) => t.eintrag);
    expect(vorwaerts).toEqual(rueckwaerts);
  });
});

describe("Was eingebettet wird", () => {
  it("lässt Werbung aus der Stelle heraus", () => {
    /*
     * Zwei Anzeigen desselben Personaldienstleisters ähneln sich sonst
     * stark — auch wenn die eine einen Lageristen und die andere einen
     * Pfleger sucht.
     */
    const text = jobEinbettungstext({
      titel: "Kommissionierer (m/w/d)",
      aufgaben: ["Waren kommissionieren", "Ladung sichern"],
      anforderungen: ["Staplerschein"],
      berufseinordnung: "51302",
    });
    expect(text).toContain("Kommissionierer");
    expect(text).toContain("Waren kommissionieren");
    expect(text).toContain("51302");
    expect(text).not.toContain("Work hard");
  });

  it("nimmt aus dem Profil nur, was über Arbeit gesagt wurde", () => {
    const text = profilEinbettungstext({
      taetigkeiten: ["lager"],
      berufsfelder: ["logistik"],
      faehigkeiten: ["Kommissionierung und Warenannahme", "Staplerschein"],
      vorlieben: ["Körperliche Arbeit gibt mir Energie"],
    });
    expect(text).toContain("Staplerschein");
    expect(text).toContain("logistik");
  });

  it("entdoppelt und begrenzt", () => {
    const text = profilEinbettungstext({
      taetigkeiten: ["lager", "lager"],
      berufsfelder: [],
      faehigkeiten: [],
      vorlieben: [],
    });
    expect(text).toBe("lager");
  });
});
