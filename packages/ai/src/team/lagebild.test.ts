import { describe, expect, it } from "vitest";
import { lagebild } from "./lagebild.ts";
import type { Agentenlauf } from "./lauf.ts";
import type { Prueflauf, Pruefurteil } from "./pruefung.ts";
import type { Rolle } from "./aufstellung.ts";

function lauf(rolle: Rolle, befunde: string[], belege: string[] = []): Agentenlauf {
  return {
    rolle,
    modellId: `m-${rolle}`,
    anbieter: "openai",
    status: "erfolg",
    ergebnis: {
      schluss: "…",
      befunde,
      risiken: [],
      unsicherheiten: [],
      empfehlungen: [],
      belege,
      sicherheit: 0.5,
    },
    fehler: null,
    dauerMs: 10,
  };
}

function pruefer(rolle: Rolle, urteile: Pruefurteil[]): Prueflauf {
  return {
    rolle,
    modellId: `m-${rolle}`,
    anbieter: "anthropic",
    status: "erfolg",
    ergebnis: { urteile },
    fehler: null,
    dauerMs: 10,
  };
}

describe("lagebild", () => {
  /*
   * ══════════════════════════════════════════════════════════════
   * Der Fall, für den die ganze Regel gebaut ist
   * ══════════════════════════════════════════════════════════════
   *
   * Zwei Modelle behaupten dasselbe ohne Beleg. Ein drittes
   * widerspricht mit Beleg. Nach Mehrheit stünde es 2:1 für die
   * Behauptung — und das Ergebnis wäre falsch.
   *
   * Modelle sind auf ähnlichen Daten trainiert und machen deshalb
   * ähnliche Fehler. Eine Mehrheit unter ihnen ist kein Beweis für
   * irgendetwas, sondern oft nur ein gemeinsamer blinder Fleck.
   */
  it("verwirft eine unbelegte Mehrheit gegen einen belegten Widerspruch", () => {
    const bild = lagebild(
      [
        lauf("hauptanalyse", ["Der Markt wächst zweistellig"]),
        lauf("alternative", ["Der Markt wächst zweistellig"]),
      ],
      [
        pruefer("gegenpruefung", [
          {
            aussage: "Der Markt wächst zweistellig",
            urteil: "widersprochen",
            begruendung: "Die Quelle nennt 3 Prozent.",
            beleg: "Branchenbericht 2026, S. 14",
          },
        ]),
      ],
      true,
    );

    const stand = bild.staende[0]!;
    expect(stand.vertretenVon).toHaveLength(2);
    expect(stand.stand).toBe("verworfen");
  });

  it("macht daraus Streit, sobald die Behauptung selbst belegt ist", () => {
    /* Beleg gegen Beleg entscheidet hier niemand — dafür ist der
       Richter da. Ein automatisches Gewicht wäre erfunden. */
    const bild = lagebild(
      [lauf("hauptanalyse", ["Der Markt wächst zweistellig"], ["Eigene Erhebung"])],
      [
        pruefer("gegenpruefung", [
          {
            aussage: "Der Markt wächst zweistellig",
            urteil: "widersprochen",
            begruendung: "Andere Zahl.",
            beleg: "Branchenbericht 2026",
          },
        ]),
      ],
      true,
    );
    expect(bild.staende[0]!.stand).toBe("strittig");
    expect(bild.strittig).toHaveLength(1);
  });

  it("stuft einen unbelegten Widerspruch nicht zur Verwerfung hoch", () => {
    const bild = lagebild(
      [lauf("hauptanalyse", ["Der Standort passt"])],
      [
        pruefer("gegenpruefung", [
          { aussage: "Der Standort passt", urteil: "widersprochen", begruendung: "Zweifel.", beleg: null },
        ]),
      ],
      true,
    );
    expect(bild.staende[0]!.stand).toBe("strittig");
  });

  /*
   * Ohne Runde 2 ist nichts geprüft — auch das Belegte nicht.
   *
   * Das ist der Unterschied zwischen „niemand hat widersprochen" und
   * „niemand hat hingesehen". Ohne ihn hiesse „gegengeprüft" auch
   * dann etwas, wenn die Prüfung ausgefallen ist.
   */
  it("nennt ohne Gegenprüfung alles ungeprüft, auch das Belegte", () => {
    const bild = lagebild([lauf("hauptanalyse", ["Belegte Sache"], ["Quelle"])], [], false);
    expect(bild.staende[0]!.stand).toBe("ungeprueft");
    expect(bild.gegengeprueft).toBe(false);
  });

  it("unterscheidet belegt-und-geprüft von nur-zugestimmt", () => {
    const bild = lagebild(
      [lauf("hauptanalyse", ["Mit Beleg"], ["Quelle"]), lauf("alternative", ["Ohne Beleg"])],
      [
        pruefer("gegenpruefung", [
          { aussage: "Mit Beleg", urteil: "gestuetzt", begruendung: "Passt.", beleg: null },
          { aussage: "Ohne Beleg", urteil: "gestuetzt", begruendung: "Klingt richtig.", beleg: null },
        ]),
      ],
      true,
    );
    const nach = Object.fromEntries(bild.staende.map((s) => [s.aussage, s.stand]));
    expect(nach["Mit Beleg"]).toBe("gesichert");
    expect(nach["Ohne Beleg"]).toBe("gestuetzt");
  });

  it("lässt niemanden die eigene Aussage stützen", () => {
    /* Selbstbestätigung wäre im Lagebild nicht mehr von einer
       echten Bestätigung zu unterscheiden. */
    const bild = lagebild(
      [lauf("hauptanalyse", ["Meine eigene These"], ["Quelle"])],
      [
        pruefer("hauptanalyse", [
          { aussage: "Meine eigene These", urteil: "gestuetzt", begruendung: "Ja.", beleg: null },
        ]),
      ],
      true,
    );
    expect(bild.staende[0]!.gestuetztVon).toEqual([]);
    expect(bild.staende[0]!.stand).toBe("ungeprueft");
  });

  it("sortiert Gesichertes vor Strittiges und Verworfenes ans Ende", () => {
    const bild = lagebild(
      [
        lauf("hauptanalyse", ["A gesichert"], ["Q"]),
        lauf("alternative", ["B unbelegt", "C strittig"], []),
      ],
      [
        pruefer("gegenpruefung", [
          { aussage: "A gesichert", urteil: "gestuetzt", begruendung: "ok", beleg: null },
          { aussage: "B unbelegt", urteil: "widersprochen", begruendung: "falsch", beleg: "Q2" },
          { aussage: "C strittig", urteil: "widersprochen", begruendung: "zweifel", beleg: null },
        ]),
      ],
      true,
    );
    expect(bild.staende.map((s) => s.stand)).toEqual(["gesichert", "strittig", "verworfen"]);
  });
});

describe("Selbstbestätigung gegen Selbstkorrektur", () => {
  /*
   * Gefunden, als die ganze Kette zum ersten Mal am Stück lief.
   * Stellen alle Modelle dieselbe Aussage auf, ist jeder Prüfer
   * zugleich Urheber — eine Sperre ohne diese Unterscheidung machte
   * die Aussage unwiderlegbar. Je einiger sich die Modelle waren,
   * desto weniger konnte ihnen widersprochen werden.
   */
  it("lässt einen widersprechen, der die Aussage selbst aufgestellt hat", () => {
    const bild = lagebild(
      [
        lauf("hauptanalyse", ["Quereinstieg ist ausgeschlossen"]),
        lauf("gegenpruefung", ["Quereinstieg ist ausgeschlossen"]),
      ],
      [
        pruefer("gegenpruefung", [
          {
            aussage: "Quereinstieg ist ausgeschlossen",
            urteil: "widersprochen",
            begruendung: "Es gibt Umschulungswege.",
            beleg: "Bundesagentur",
          },
        ]),
      ],
      true,
    );
    expect(bild.staende[0]!.stand).toBe("verworfen");
  });

  it("lässt ihn sie weiterhin nicht stützen", () => {
    const bild = lagebild(
      [lauf("hauptanalyse", ["Meine eigene These"], ["Quelle"])],
      [
        pruefer("hauptanalyse", [
          { aussage: "Meine eigene These", urteil: "gestuetzt", begruendung: "Ja.", beleg: null },
        ]),
      ],
      true,
    );
    expect(bild.staende[0]!.gestuetztVon).toEqual([]);
    expect(bild.staende[0]!.stand).toBe("ungeprueft");
  });
});
