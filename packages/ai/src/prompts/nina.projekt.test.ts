import { describe, expect, it } from "vitest";
import { buildNinaSystemPrompt, type NinaPromptContext } from "./nina.ts";

const BASIS: NinaPromptContext = {
  locale: "de",
  confirmedFacts: ["Mindestens 50.000 € brutto im Jahr"],
  openHypotheses: [],
  hardConstraints: ["Keine reine Provision"],
  rejectedStatements: [],
  currentStage: "job_search",
  externalProviderActive: true,
};

describe("Das offene Vorhaben im Systemprompt", () => {
  it("steht gar nicht da, wenn keins offen ist", () => {
    /* Ein Projekt ist etwas, das dazukommt — kein Pflichtfeld. */
    const p = buildNinaSystemPrompt(BASIS);
    expect(p).not.toMatch(/OFFENES VORHABEN/);
  });

  it("nennt Name und Ziel, wenn eins offen ist", () => {
    const p = buildNinaSystemPrompt({
      ...BASIS,
      projekt: { name: "Zürich", ziel: "Projektmanagement in der Verwaltung" },
    });
    expect(p).toMatch(/OFFENES VORHABEN/);
    expect(p).toMatch(/Zürich — Projektmanagement in der Verwaltung/);
  });

  it("kommt ohne Ziel aus", () => {
    const p = buildNinaSystemPrompt({ ...BASIS, projekt: { name: "Berlin", ziel: null } });
    expect(p).toMatch(/OFFENES VORHABEN\nBerlin/);
  });

  it("sagt ausdrücklich, dass das Wissen über die Person weiter gilt", () => {
    /*
     * Der wichtigere Satz. Ohne ihn liest ein Modell "anderes Projekt"
     * als "anderer Mensch" und erfragt neu, was längst bestätigt ist.
     * Für den Menschen sieht das aus wie Vergesslichkeit — dabei weiss
     * Monday alles noch, sie hält es nur für unzuständig.
     */
    const p = buildNinaSystemPrompt({ ...BASIS, projekt: { name: "Zürich", ziel: null } });
    expect(p).toMatch(/ALLES, was du über diesen Menschen weisst, gilt weiter/);
    expect(p).toMatch(/Frage nichts erneut/);
  });

  it("lässt die bestätigten Fakten dabei stehen", () => {
    /*
     * Der Satz nützt nichts, wenn die Fakten fehlen. Beide gehören in
     * denselben Prompt — sonst verweist er auf etwas, das nicht da ist.
     */
    const p = buildNinaSystemPrompt({ ...BASIS, projekt: { name: "Zürich", ziel: null } });
    expect(p).toMatch(/Mindestens 50\.000 € brutto/);
    expect(p).toMatch(/Keine reine Provision/);
  });

  it("sagt es auch auf Englisch", () => {
    const p = buildNinaSystemPrompt({
      ...BASIS, locale: "en", projekt: { name: "Zurich", ziel: null },
    });
    expect(p).toMatch(/CURRENT PROJECT/);
    expect(p).toMatch(/EVERYTHING you know about this person still applies/);
  });
});
