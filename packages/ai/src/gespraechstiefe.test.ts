import { describe, expect, it } from "vitest";
import { gespraechstiefe } from "./gespraechstiefe.ts";
import { route } from "./router.ts";

const stufe = (n: string) => route(gespraechstiefe(n).aufgabe).tier;

describe("H — triviale Fragen bleiben schnell", () => {
  const flach = [
    "Hallo Monday",
    "Danke!",
    "Wie viele Stellen hast du für mich?",
    "Zeig mir Jobs in Stuttgart",
    "Merk dir den Job",
    "Was bedeutet Fit Score?",
  ];
  for (const n of flach) {
    it(`„${n}" bleibt bei DEFAULT`, () => {
      expect(stufe(n)).toBe("DEFAULT");
    });
  }

  it("hält eine Bedienfrage klein, auch wenn Berufswörter darin stehen", () => {
    /*
     * „Wo kann ich meinen Beruf ändern?" ist eine Frage nach einem
     * Knopf, keine Karriereentscheidung. Ohne diese Regel würde die
     * Bedienhilfe das teuerste Modell wecken.
     */
    const b = gespraechstiefe("Wo kann ich meinen Beruf ändern in den Einstellungen?");
    expect(b.tiefe).toBe("flach");
    expect(b.merkmale).toContain("Bedienfrage");
  });
});

describe("A/B/D — echte Beratungsfragen gehen auf DEEP", () => {
  it("A — „Ich weiss nicht, was ich machen möchte“", () => {
    const n = "Ich weiß überhaupt nicht, was ich machen möchte. Welche Möglichkeiten habe ich denn?";
    expect(stufe(n)).toBe("DEEP");
  });

  it("B — „Ich habe keine besonderen Fähigkeiten“", () => {
    const n =
      "Ich habe keine besonderen Fähigkeiten. Lohnt es sich für mich überhaupt, mich woanders zu bewerben?";
    expect(stufe(n)).toBe("DEEP");
  });

  it("D — Branchenwechsel", () => {
    const n = "Ich möchte die Branche wechseln. Soll ich das mit vier Jahren Erfahrung wirklich machen?";
    const b = gespraechstiefe(n);
    expect(b.tiefe).toBe("entscheidung");
    expect(b.merkmale).toContain("Branchenwechsel");
    expect(stufe(n)).toBe("DEEP");
  });
});

describe("Abwägung und Entscheidung zusammen", () => {
  it("stuft eine Frage mit beidem als Entscheidung ein", () => {
    const b = gespraechstiefe(
      "Soll ich kündigen und eine Umschulung anfangen, oder lieber erst mal bleiben?",
    );
    expect(b.tiefe).toBe("entscheidung");
    expect(b.aufgabe).toBe("career_transition_analysis");
  });

  it("stuft eine Frage mit nur einem Merkmal als beratend ein", () => {
    /*
     * „Soll ich wechseln?" allein ist eine Frage, keine Analyse —
     * Monday fragt zurück, und das kann sie schnell.
     */
    const b = gespraechstiefe("Lohnt es sich, wenn ich mich dort bewerbe? Was meinst du dazu?");
    expect(b.tiefe).toBe("beratend");
    expect(b.aufgabe).toBe("career_analysis");
  });
});

describe("Eine ausdrückliche Bitte genügt allein", () => {
  it("folgt ihr sofort", () => {
    const b = gespraechstiefe("Kannst du das bitte mal ausführlich für mich analysieren?");
    expect(b.tiefe).toBe("entscheidung");
    expect(b.merkmale).toContain("ausdrücklich");
  });

  it("auch ohne weitere Merkmale", () => {
    expect(stufe("Nimm dir Zeit und denk gründlich darüber nach, was zu mir passt.")).toBe("DEEP");
  });
});

describe("Kürze", () => {
  it("lässt sehr kurze Nachrichten flach", () => {
    /* Eine Analyse passt nicht in fünf Wörter. */
    expect(gespraechstiefe("Soll ich wechseln?").tiefe).toBe("flach");
  });
});
