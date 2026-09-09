import { describe, expect, it } from "vitest";
import type { Modelldefinition } from "../registry/katalog.ts";
import type { Umgebung } from "../registry/registry.ts";
import {
  GRENZEN,
  NIE_IM_TEAM,
  SCHWELLE,
  teamAufstellen,
  teamWert,
  type Lage,
} from "./aufstellung.ts";

const OFFEN: Umgebung = {
  OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "k",
  MONDAY_OPENAI_PRODUCTION_APPROVED: "true",
  MONDAY_ANTHROPIC_PRODUCTION_APPROVED: "true",
};

function modell(id: string, anbieter: Modelldefinition["anbieter"], eignung: number): Modelldefinition {
  return {
    internId: id, anbieter, apiModellId: `api-${id}`, anzeigename: id,
    beschreibung: "", lebenszyklus: "stabil",
    faehigkeiten: { reasoning: true, writing: true, structuredOutput: true },
    eignung: { career_analysis: eignung },
    kostenklasse: "mittel", tempoklasse: "mittel", maxKontext: null,
    eingaben: ["text"], ersatz: [],
  };
}

/* Zwei Anbieter, vier Modelle — der realistische Fall. */
const VIER = [
  modell("oa-1", "openai", 0.9),
  modell("oa-2", "openai", 0.85),
  modell("an-1", "anthropic", 0.8),
  modell("an-2", "anthropic", 0.7),
];

const schwer: Lage = {
  task: "career_transition_analysis",
  komplexitaet: "hoch", wichtigkeit: "kritisch",
  unsicherheit: "hoch", tragweite: "kritisch",
};

describe("Wann sich ein Team lohnt", () => {
  it("empfiehlt ein Team bei einer folgenreichen Karrierefrage", () => {
    const u = teamWert(schwer);
    expect(u.lohntSich).toBe(true);
    expect(u.punkte).toBeGreaterThanOrEqual(SCHWELLE);
  });

  it("empfiehlt kein Team bei einer beiläufigen Rückfrage", () => {
    expect(
      teamWert({
        task: "nina_chat", komplexitaet: "niedrig", wichtigkeit: "niedrig",
        unsicherheit: "niedrig", tragweite: "niedrig",
      }).lohntSich,
    ).toBe(false);
  });

  it("verweigert ein Team bei Aufgaben ohne Beratungsbedarf — egal wie die Stufen stehen", () => {
    /*
     * Der Fall, der ohne die feste Liste durchrutscht: Jemand setzt
     * alle Stufen auf kritisch, und eine Spracherkennung läuft durch
     * drei Modelle.
     */
    for (const task of NIE_IM_TEAM) {
      const u = teamWert({
        task, komplexitaet: "kritisch", wichtigkeit: "kritisch",
        unsicherheit: "kritisch", tragweite: "kritisch", quellen: 50,
      });
      expect(u.lohntSich, task).toBe(false);
      expect(u.punkte, task).toBe(0);
    }
  });

  it("zieht Wartezeit ab, wenn es eilig ist", () => {
    const ruhig = teamWert(schwer).punkte;
    const eilig = teamWert({ ...schwer, eiligkeit: 1 }).punkte;
    expect(eilig).toBeLessThan(ruhig);
  });

  it("kann eine Grenzentscheidung durch Eile kippen", () => {
    /* Der Sinn des Abzugs: Er muss das Ergebnis ändern können. */
    const mittel: Lage = {
      task: "career_analysis", komplexitaet: "hoch", wichtigkeit: "hoch",
      unsicherheit: "hoch", tragweite: "hoch",
    };
    expect(teamWert(mittel).lohntSich).toBe(true);
    expect(teamWert({ ...mittel, eiligkeit: 1 }).lohntSich).toBe(false);
  });

  it("begründet jedes Urteil nachvollziehbar", () => {
    expect(teamWert(schwer).begruendung).toMatch(/Schwelle/);
  });
});

describe("Wer im Team sitzt", () => {
  const anf = { task: "career_analysis" as const, qualitaetVorKosten: 0.9 };

  it("verteilt die drei Rollen", () => {
    const team = teamAufstellen(anf, GRENZEN, OFFEN, VIER);
    expect(team.map((p) => p.rolle)).toEqual([
      "hauptanalyse", "gegenpruefung", "alternative",
    ]);
  });

  it("setzt das beste Modell auf die Hauptanalyse", () => {
    const team = teamAufstellen(anf, GRENZEN, OFFEN, VIER);
    expect(team[0]?.modell.internId).toBe("oa-1");
  });

  it("holt für die Gegenprüfung einen anderen Anbieter, nicht das zweitbeste Modell", () => {
    /*
     * Der Kern der Aufstellung. `oa-2` hat die höhere Eignung, aber
     * dieselben blinden Flecken wie `oa-1`. Eine zweite Meinung vom
     * selben Anbieter ist eher Bestätigung als Prüfung.
     */
    const team = teamAufstellen(anf, GRENZEN, OFFEN, VIER);
    expect(team[1]?.modell.internId).toBe("an-1");
    expect(team[1]?.modell.anbieter).toBe("anthropic");
  });

  it("nimmt nie dasselbe Modell zweimal", () => {
    const team = teamAufstellen(anf, GRENZEN, OFFEN, VIER);
    const ids = team.map((p) => p.modell.internId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hält die Obergrenze ein", () => {
    const team = teamAufstellen(anf, GRENZEN, OFFEN, VIER);
    expect(team.length).toBeLessThanOrEqual(GRENZEN.maxAgenten);
  });

  it("stellt kein Team auf, wenn nur ein Modell freigegeben ist", () => {
    /*
     * Sonst entstünde ein Lauf mit einem Agenten, der in der
     * Oberfläche als Team erschiene. §36: keine gefakten Teams.
     */
    const nurOpenai: Umgebung = {
      OPENAI_API_KEY: "k", MONDAY_OPENAI_PRODUCTION_APPROVED: "true",
    };
    expect(teamAufstellen(anf, GRENZEN, nurOpenai, [VIER[0]!])).toEqual([]);
  });

  it("nimmt zwei vom selben Anbieter, wenn es keinen zweiten gibt", () => {
    /*
     * Schwächer als zwei verschiedene, aber immer noch mehr als eine
     * Stimme — und die Begründung sagt genau das.
     */
    const nurOpenai: Umgebung = {
      OPENAI_API_KEY: "k", MONDAY_OPENAI_PRODUCTION_APPROVED: "true",
    };
    const team = teamAufstellen(anf, GRENZEN, nurOpenai, [VIER[0]!, VIER[1]!]);
    expect(team).toHaveLength(2);
    expect(team[1]?.grund).toMatch(/kein weiterer Anbieter/i);
  });

  it("stellt kein Team auf, wenn eine benötigte Fähigkeit niemanden übrig lässt", () => {
    expect(
      teamAufstellen(
        { task: "document_analysis" as never, benoetigt: ["vision"] },
        GRENZEN, OFFEN, VIER,
      ),
    ).toEqual([]);
  });

  it("beachtet die Datenschutzliste erlaubter Anbieter", () => {
    const team = teamAufstellen(
      { ...anf, erlaubteAnbieter: ["anthropic"] }, GRENZEN, OFFEN, VIER,
    );
    expect(team.every((p) => p.modell.anbieter === "anthropic")).toBe(true);
  });
});
