import { describe, expect, it } from "vitest";
import type { Modelldefinition } from "../registry/katalog.ts";
import type { Rolle, Teamplatz } from "./aufstellung.ts";
import {
  aussagenLage,
  teamLauf,
  type AgentAusfuehren,
  type Agentenergebnis,
  type Laufgrenzen,
} from "./lauf.ts";

function modell(id: string, anbieter: Modelldefinition["anbieter"]): Modelldefinition {
  return {
    internId: id, anbieter, apiModellId: `api-${id}`, anzeigename: id,
    beschreibung: "", lebenszyklus: "stabil", faehigkeiten: {}, eignung: {},
    kostenklasse: "mittel", tempoklasse: "mittel", maxKontext: null,
    eingaben: ["text"], ersatz: [],
  };
}

const platz = (rolle: Rolle, id: string, anbieter: Modelldefinition["anbieter"]): Teamplatz => ({
  rolle, modell: modell(id, anbieter), grund: "Test",
});

const TEAM: Teamplatz[] = [
  platz("hauptanalyse", "a", "openai"),
  platz("gegenpruefung", "b", "anthropic"),
  platz("alternative", "c", "openai"),
];

function ergebnis(teil: Partial<Agentenergebnis> = {}): Agentenergebnis {
  return {
    schluss: "Passt", befunde: [], risiken: [], unsicherheiten: [],
    empfehlungen: [], belege: [], sicherheit: 0.5, ...teil,
  };
}

const SCHNELL: Laufgrenzen = { agentFristMs: 200, gesamtFristMs: 500, minErgebnisse: 2 };

describe("Der Lauf", () => {
  it("führt alle Plätze aus und ordnet jedes Ergebnis seiner Rolle zu", async () => {
    const ausfuehren: AgentAusfuehren = async (p) => ergebnis({ schluss: p.rolle });
    const r = await teamLauf(TEAM, ausfuehren, SCHNELL);

    expect(r.erfolgreich).toBe(3);
    expect(r.laeufe.map((l) => l.ergebnis?.schluss)).toEqual([
      "hauptanalyse", "gegenpruefung", "alternative",
    ]);
  });

  it("startet die Agenten gleichzeitig, nicht nacheinander", async () => {
    /*
     * Nicht nur schneller: In Runde 1 sollen die Modelle unabhängig
     * arbeiten. Nacheinander wäre die Gelegenheit, das Ergebnis des
     * einen in den Kontext des nächsten zu geben — und dann bekäme
     * man eine Meinung mit Zeugen.
     */
    let gleichzeitig = 0;
    let hoechstens = 0;
    const ausfuehren: AgentAusfuehren = async () => {
      hoechstens = Math.max(hoechstens, ++gleichzeitig);
      await new Promise((r) => setTimeout(r, 20));
      gleichzeitig--;
      return ergebnis();
    };

    await teamLauf(TEAM, ausfuehren, SCHNELL);
    expect(hoechstens).toBe(3);
  });

  it("protokolliert Modell und Anbieter je Platz", async () => {
    const r = await teamLauf(TEAM, async () => ergebnis(), SCHNELL);
    expect(r.laeufe.map((l) => `${l.modellId}/${l.anbieter}`)).toEqual([
      "a/openai", "b/anthropic", "c/openai",
    ]);
  });
});

describe("Wenn etwas schiefgeht", () => {
  it("arbeitet mit zwei von drei Ergebnissen weiter", async () => {
    const ausfuehren: AgentAusfuehren = async (p) => {
      if (p.modell.internId === "b") throw new Error("Anbieter überlastet");
      return ergebnis();
    };
    const r = await teamLauf(TEAM, ausfuehren, SCHNELL);

    expect(r.erfolgreich).toBe(2);
    expect(r.gescheitert).toBe(1);
    expect(r.zuWenig).toBe(false);
  });

  it("meldet zuWenig, wenn nur ein Modell geliefert hat", async () => {
    /*
     * Ein Ergebnis ist kein Team. Der Lauf ist nicht wertlos — das
     * Ergebnis steht da —, er darf nur nicht als Team dargestellt
     * werden.
     */
    const ausfuehren: AgentAusfuehren = async (p) => {
      if (p.modell.internId !== "a") throw new Error("weg");
      return ergebnis();
    };
    const r = await teamLauf(TEAM, ausfuehren, SCHNELL);

    expect(r.erfolgreich).toBe(1);
    expect(r.zuWenig).toBe(true);
    expect(r.ergebnisse).toHaveLength(1);
  });

  it("wirft nicht, wenn alle drei scheitern", async () => {
    const r = await teamLauf(TEAM, async () => { throw new Error("alles weg"); }, SCHNELL);
    expect(r.gescheitert).toBe(3);
    expect(r.zuWenig).toBe(true);
    expect(r.laeufe.every((l) => l.status === "fehlschlag")).toBe(true);
  });

  it("unterscheidet eine überschrittene Frist von einem Fehler", async () => {
    /*
     * „Hat nicht geantwortet" und „hat einen Fehler geliefert" führen
     * zu verschiedenen Entscheidungen: Beim ersten lohnt ein Ersatz,
     * beim zweiten meist nicht.
     */
    const ausfuehren: AgentAusfuehren = async (p, signal) => {
      if (p.modell.internId === "b") {
        await new Promise((_, ab) =>
          signal.addEventListener("abort", () => ab(signal.reason)));
      }
      return ergebnis();
    };
    const r = await teamLauf(TEAM, ausfuehren, { ...SCHNELL, agentFristMs: 30 });

    expect(r.laeufe.find((l) => l.modellId === "b")?.status).toBe("frist");
    expect(r.erfolgreich).toBe(2);
  });

  it("bricht die Agenten ab, wenn der Aufrufer abbricht", async () => {
    /*
     * Ohne diese Verknüpfung überlebt ein Agent den Abbruch des Laufs
     * und rechnet auf Kosten weiter, die niemand mehr braucht.
     */
    const steuer = new AbortController();
    const ausfuehren: AgentAusfuehren = async (_p, signal) =>
      new Promise((_, ab) => signal.addEventListener("abort", () => ab(signal.reason)));

    setTimeout(() => steuer.abort(new DOMException("Abbruch", "AbortError")), 20);
    const r = await teamLauf(TEAM, ausfuehren, SCHNELL, steuer.signal);

    expect(r.erfolgreich).toBe(0);
    expect(r.laeufe.every((l) => l.status === "frist")).toBe(true);
  });

  it("gibt bei leerer Aufstellung ein leeres Protokoll zurück", async () => {
    const r = await teamLauf([], async () => ergebnis(), SCHNELL);
    expect(r.geplant).toBe(0);
    expect(r.zuWenig).toBe(true);
  });
});

describe("Belege schlagen Mehrheit", () => {
  async function lage(...paare: [string[], string[]][]) {
    const ausfuehren: AgentAusfuehren = async (p) => {
      const i = TEAM.findIndex((t) => t.modell.internId === p.modell.internId);
      const [befunde, belege] = paare[i] ?? [[], []];
      return ergebnis({ befunde, belege });
    };
    const r = await teamLauf(TEAM, ausfuehren, SCHNELL);
    return aussagenLage(r.ergebnisse);
  }

  it("stellt eine belegte Einzelstimme über eine unbelegte Mehrheit", async () => {
    /*
     * Der Kern von §8. Zwei Modelle können denselben Fehler machen —
     * sie haben oft ähnliche Daten gesehen. Zwei unbelegte Stimmen
     * für A und eine belegte für B sind kein Ergebnis für A.
     */
    const l = await lage(
      [["Gehalt liegt über dem Wunsch"], []],
      [["Gehalt liegt über dem Wunsch"], []],
      [["Gehalt ist nicht angegeben"], ["Stellenanzeige, Abschnitt Vergütung"]],
    );

    expect(l[0]?.aussage).toBe("Gehalt ist nicht angegeben");
    expect(l[0]?.belegt).toBe(true);
    expect(l[0]?.vertreten).toHaveLength(1);

    expect(l[1]?.belegt).toBe(false);
    expect(l[1]?.vertreten).toHaveLength(2);
  });

  it("führt dieselbe Aussage zweier Modelle als eine mit zwei Stimmen", async () => {
    const l = await lage(
      [["Der Standort passt"], []],
      [["der standort passt."], []],
      [[], []],
    );
    expect(l).toHaveLength(1);
    expect(l[0]?.vertreten.map((v) => v.rolle)).toEqual(["hauptanalyse", "gegenpruefung"]);
  });

  it("verschmilzt zwei verschieden formulierte Aussagen nicht", async () => {
    /*
     * Die Zuordnung ist absichtlich grob. Zwei echte Aussagen zu
     * verschmelzen wäre schlimmer, als eine doppelt zu führen.
     */
    const l = await lage(
      [["Der Standort passt"], []],
      [["Der Standort ist gut erreichbar"], []],
      [[], []],
    );
    expect(l).toHaveLength(2);
  });

  it("merkt sich, welches Modell eine Aussage belegt hat", async () => {
    const l = await lage(
      [["Digitalisierung ist ein Schwerpunkt"], ["Karriereseite"]],
      [["Digitalisierung ist ein Schwerpunkt"], []],
      [[], []],
    );
    expect(l[0]?.vertreten.map((v) => v.belegt)).toEqual([true, false]);
  });
});
