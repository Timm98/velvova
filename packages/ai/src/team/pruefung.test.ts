import { describe, expect, it } from "vitest";
import type { Rolle, Teamplatz } from "./aufstellung.ts";
import type { Agentenlauf } from "./lauf.ts";
import { PRUEFGRENZEN, pruefrunde, pruefungOrdnen, vorlageFuer, type Vorlage } from "./pruefung.ts";

function platz(rolle: Rolle): Teamplatz {
  return {
    rolle,
    modell: {
      internId: `m-${rolle}`,
      anbieter: "openai",
      apiId: "x",
      anzeigename: rolle,
      eignung: {},
      freigabeSchalter: "MONDAY_OPENAI_PRODUCTION_APPROVED",
    } as unknown as Teamplatz["modell"],
    grund: "Test",
  };
}

function lauf(rolle: Rolle, befunde: string[], belege: string[] = [], status: Agentenlauf["status"] = "erfolg"): Agentenlauf {
  return {
    rolle,
    modellId: `m-${rolle}`,
    anbieter: "openai",
    status,
    ergebnis: status === "erfolg"
      ? { schluss: "…", befunde, risiken: [], unsicherheiten: [], empfehlungen: [], belege, sicherheit: 0.5 }
      : null,
    fehler: null,
    dauerMs: 5,
  };
}

describe("vorlageFuer", () => {
  it("legt niemandem die eigenen Aussagen vor", () => {
    /* Ein Modell, dem man die eigene Aussage zur Prüfung vorlegt,
       bestätigt sie. Das wäre ein Echo, kein Urteil. */
    const vorlagen = vorlageFuer("hauptanalyse", [
      lauf("hauptanalyse", ["Meine These"]),
      lauf("gegenpruefung", ["Fremde These"]),
    ]);
    expect(vorlagen.map((v) => v.aussage)).toEqual(["Fremde These"]);
  });

  it("nennt keine Urheber — nur Buchstaben", () => {
    /* Wer weiss, dass eine Behauptung vom teuersten Modell kommt,
       widerspricht ihr seltener. Genau das macht Runde 2 wertlos. */
    const vorlagen = vorlageFuer("hauptanalyse", [
      lauf("gegenpruefung", ["Fremde These"]),
      lauf("alternative", ["Andere These"]),
    ]);
    expect(vorlagen.map((v) => v.kennung)).toEqual(["A", "B"]);
    expect(JSON.stringify(vorlagen)).not.toMatch(/gegenpruefung|alternative|m-/);
  });

  it("stellt Belegtes nach vorn, damit die Grenze nicht das Wichtige abschneidet", () => {
    const vorlagen = vorlageFuer(
      "hauptanalyse",
      [lauf("gegenpruefung", ["Ohne Beleg"]), lauf("alternative", ["Mit Beleg"], ["Quelle"])],
      { ...PRUEFGRENZEN, maxVorlagen: 1 },
    );
    expect(vorlagen).toHaveLength(1);
    expect(vorlagen[0]!.aussage).toBe("Mit Beleg");
  });

  it("führt dieselbe Aussage zweier Modelle als eine", () => {
    const vorlagen = vorlageFuer("hauptanalyse", [
      lauf("gegenpruefung", ["Gleiche Aussage"]),
      lauf("alternative", ["Gleiche Aussage"], ["Quelle"]),
    ]);
    expect(vorlagen).toHaveLength(1);
    expect(vorlagen[0]!.belegt).toBe(true);
  });
});

describe("pruefungOrdnen", () => {
  const vorlagen: Vorlage[] = [{ kennung: "A", aussage: "Vorgelegte Aussage", belegt: false }];

  it("wirft Urteile über nie vorgelegte Aussagen weg", () => {
    /* Ein Modell kann sich eine Aussage ausdenken und sie
       „widerlegen". Ungeprüft verschöbe das im Lagebild echte
       Ergebnisse. */
    const raus = pruefungOrdnen(
      { urteile: [{ aussage: "Nie gesagt", urteil: "widersprochen", begruendung: "…", beleg: null }] },
      vorlagen,
    );
    expect(raus).toEqual([]);
  });

  it("stuft einen unbegründeten Widerspruch auf unklar herab", () => {
    /* Der Zweifel bleibt erhalten — er reicht nur nicht, um eine
       Aussage zu kippen. */
    const raus = pruefungOrdnen(
      { urteile: [{ aussage: "Vorgelegte Aussage", urteil: "widersprochen", begruendung: "  ", beleg: null }] },
      vorlagen,
    );
    expect(raus[0]!.urteil).toBe("unklar");
  });

  it("zählt je Aussage nur ein Urteil", () => {
    const raus = pruefungOrdnen(
      {
        urteile: [
          { aussage: "Vorgelegte Aussage", urteil: "gestuetzt", begruendung: "ja", beleg: null },
          { aussage: "vorgelegte aussage", urteil: "widersprochen", begruendung: "nein", beleg: "Q" },
        ],
      },
      vorlagen,
    );
    expect(raus).toHaveLength(1);
    expect(raus[0]!.urteil).toBe("gestuetzt");
  });
});

describe("pruefrunde", () => {
  it("fällt aus, wenn es nichts gegenzuprüfen gibt", async () => {
    const e = await pruefrunde([platz("hauptanalyse")], [lauf("hauptanalyse", ["Allein"])], async () => {
      throw new Error("darf nicht aufgerufen werden");
    });
    expect(e.ausgefallen).toBe(true);
    expect(e.grund).toMatch(/nichts gegenzuprüfen/i);
    expect(e.ergebnisse).toEqual([]);
  });

  it("lässt nur prüfen, wer in Runde 1 geliefert hat", async () => {
    /* Wer ausgefallen ist, urteilt sonst über Arbeit, an der er sich
       nicht beteiligt hat — mit demselben Gewicht. */
    const gefragt: Rolle[] = [];
    const e = await pruefrunde(
      [platz("hauptanalyse"), platz("gegenpruefung"), platz("alternative")],
      [
        lauf("hauptanalyse", ["A"]),
        lauf("gegenpruefung", ["B"]),
        lauf("alternative", [], [], "frist"),
      ],
      async (p) => {
        gefragt.push(p.rolle);
        return { urteile: [] };
      },
    );
    expect(gefragt.sort()).toEqual(["gegenpruefung", "hauptanalyse"]);
    expect(e.ausgefallen).toBe(false);
  });

  it("überlebt einen Prüfer, der scheitert", async () => {
    const e = await pruefrunde(
      [platz("hauptanalyse"), platz("gegenpruefung")],
      [lauf("hauptanalyse", ["A"]), lauf("gegenpruefung", ["B"])],
      async (p) => {
        if (p.rolle === "hauptanalyse") throw new Error("Anbieter weg");
        return { urteile: [{ aussage: "A", urteil: "gestuetzt", begruendung: "ok", beleg: null }] };
      },
    );
    expect(e.ergebnisse).toHaveLength(1);
    expect(e.laeufe.find((l) => l.rolle === "hauptanalyse")!.status).toBe("fehlschlag");
  });

  it("nennt eine Frist eine Frist und keinen Fehlschlag", async () => {
    const e = await pruefrunde(
      [platz("hauptanalyse"), platz("gegenpruefung")],
      [lauf("hauptanalyse", ["A"]), lauf("gegenpruefung", ["B"])],
      async () => {
        throw new Error("The operation was aborted due to timeout");
      },
    );
    expect(e.laeufe.every((l) => l.status === "frist")).toBe(true);
  });
});
