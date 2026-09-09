import { describe, expect, it } from "vitest";
import type { Rolle, Teamplatz } from "./aufstellung.ts";
import { lagebild, type Lagebild } from "./lagebild.ts";
import type { Agentenlauf } from "./lauf.ts";
import type { Prueflauf } from "./pruefung.ts";
import { richterlauf, richterWaehlen, spruchAnwenden, streitvorlagen } from "./richter.ts";

function platz(rolle: Rolle): Teamplatz {
  return {
    rolle,
    modell: { internId: `m-${rolle}`, anbieter: "openai" } as unknown as Teamplatz["modell"],
    grund: "Test",
  };
}

function lauf(rolle: Rolle, befunde: string[], belege: string[] = []): Agentenlauf {
  return {
    rolle, modellId: `m-${rolle}`, anbieter: "openai", status: "erfolg",
    ergebnis: { schluss: "…", befunde, risiken: [], unsicherheiten: [], empfehlungen: [], belege, sicherheit: 0.5 },
    fehler: null, dauerMs: 5,
  };
}

function pruefer(rolle: Rolle, aussage: string, beleg: string | null): Prueflauf {
  return {
    rolle, modellId: `m-${rolle}`, anbieter: "anthropic", status: "erfolg",
    ergebnis: { urteile: [{ aussage, urteil: "widersprochen", begruendung: "Andere Zahl.", beleg }] },
    fehler: null, dauerMs: 5,
  };
}

/** Beleg gegen Beleg — der einzige Fall, für den es den Richter gibt. */
function strittigesBild(): Lagebild {
  return lagebild(
    [lauf("hauptanalyse", ["Der Markt wächst"], ["Eigene Erhebung"])],
    [pruefer("gegenpruefung", "Der Markt wächst", "Branchenbericht")],
    true,
  );
}

describe("richterWaehlen", () => {
  it("nimmt bevorzugt jemanden, der nicht mitgespielt hat", () => {
    const w = richterWaehlen([platz("hauptanalyse"), platz("alternative")], ["hauptanalyse"]);
    expect(w!.platz.rolle).toBe("alternative");
    expect(w!.befangen).toBe(false);
  });

  it("richtet notfalls befangen — sagt es aber", () => {
    /* Verschweigen wäre schlimmer als die Befangenheit selbst. */
    const w = richterWaehlen([platz("hauptanalyse")], ["hauptanalyse"]);
    expect(w!.befangen).toBe(true);
  });
});

describe("richterlauf", () => {
  it("tritt ohne Streitpunkt gar nicht erst an", async () => {
    const bild = lagebild([lauf("hauptanalyse", ["Unstrittig"], ["Q"])], [], false);
    const e = await richterlauf(bild, [platz("hauptanalyse")], ["hauptanalyse"], async () => {
      throw new Error("darf nicht aufgerufen werden");
    });
    expect(e.ausgefallen).toBe(true);
    expect(e.grund).toBe("Kein strittiger Punkt.");
  });

  it("legt nur Strittiges vor, nie das bereits Entschiedene", async () => {
    /* Sonst könnte eine Meinung ein Ergebnis kippen, das aus
       Belegen folgt. */
    const bild = lagebild(
      [lauf("hauptanalyse", ["Der Markt wächst", "Etwas Gesichertes"], ["Eigene Erhebung"])],
      [pruefer("gegenpruefung", "Der Markt wächst", "Branchenbericht")],
      true,
    );
    const vorlagen = streitvorlagen(bild);
    expect(vorlagen.map((v) => v.aussage)).toEqual(["Der Markt wächst"]);
  });

  it("nennt keine Urheber", async () => {
    const vorlagen = streitvorlagen(strittigesBild());
    expect(JSON.stringify(vorlagen)).not.toMatch(/hauptanalyse|gegenpruefung|m-/);
  });

  it("stuft einen unbegründeten Spruch auf unentschieden herab", async () => {
    const e = await richterlauf(strittigesBild(), [platz("alternative")], ["hauptanalyse"], async () => ({
      sprueche: [{ aussage: "Der Markt wächst", entscheidung: "nicht_haltbar" as const, begruendung: "" }],
    }));
    expect(e.sprueche[0]!.entscheidung).toBe("unentschieden");
  });

  it("lässt Strittiges strittig, wenn der Richter ausfällt", async () => {
    /* Der naheliegende Griff wäre, dann nach Mehrheit zu entscheiden
       — genau das, was zwei Runden lang vermieden wurde. */
    const bild = strittigesBild();
    const e = await richterlauf(bild, [platz("alternative")], ["hauptanalyse"], async () => {
      throw new Error("Anbieter weg");
    });
    expect(e.ausgefallen).toBe(true);
    expect(spruchAnwenden(bild, e).strittig).toHaveLength(1);
  });
});

describe("spruchAnwenden", () => {
  it("rettet eine belegte Aussage nach gesichert", () => {
    const bild = strittigesBild();
    const nach = spruchAnwenden(bild, {
      sprueche: [{ aussage: "Der Markt wächst", entscheidung: "haltbar", begruendung: "Erhebung ist neuer." }],
      befangen: false, ausgefallen: false, grund: null, dauerMs: 1,
    });
    expect(nach.staende[0]!.stand).toBe("gesichert");
    expect(nach.strittig).toEqual([]);
  });

  it("kann einen fehlenden Beleg nicht ersetzen", () => {
    /* „haltbar" macht aus einer unbelegten Aussage höchstens eine
       gestützte — der Richter urteilt, er belegt nicht. */
    const bild = lagebild(
      [lauf("hauptanalyse", ["Ohne Beleg"])],
      [pruefer("gegenpruefung", "Ohne Beleg", null)],
      true,
    );
    const nach = spruchAnwenden(bild, {
      sprueche: [{ aussage: "Ohne Beleg", entscheidung: "haltbar", begruendung: "Plausibel." }],
      befangen: false, ausgefallen: false, grund: null, dauerMs: 1,
    });
    expect(nach.staende[0]!.stand).toBe("gestuetzt");
  });

  it("lässt unentschieden stehen", () => {
    const bild = strittigesBild();
    const nach = spruchAnwenden(bild, {
      sprueche: [{ aussage: "Der Markt wächst", entscheidung: "unentschieden", begruendung: "Beide plausibel." }],
      befangen: false, ausgefallen: false, grund: null, dauerMs: 1,
    });
    expect(nach.staende[0]!.stand).toBe("strittig");
  });
});
