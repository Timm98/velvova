import { describe, expect, it } from "vitest";
import {
  gelegenheitenAusKlaerungen,
  gelegenheitenAusStellenlage,
  type Klaerungsstand,
} from "./erkenntnisse.ts";
import { klasseVon } from "./handlungsklassen.ts";

const widerspruch = (staerke: number, malGezeigt = 0): Klaerungsstand => ({
  art: "widerspruch",
  schluessel: "beleg-1",
  frage:
    "Du hattest erwähnt, dass du Vertrieb eher vermeiden möchtest. Gleichzeitig interessieren dich einige vertriebsnahe Stellen. Soll ich Vertrieb weiterhin ausschliessen?",
  staerke,
  malGezeigt,
});

const frage = (schluessel: string, malGezeigt = 0): Klaerungsstand => ({
  art: "frage",
  schluessel,
  frage: "Wo soll die Arbeit sein — und wie weit würdest du fahren?",
  staerke: null,
  malGezeigt,
});

describe("Widersprüche werden Gelegenheiten", () => {
  it("macht aus einem starken Widerspruch eine Frage, keine Feststellung", () => {
    const [g] = gelegenheitenAusKlaerungen([widerspruch(0.6)]);
    expect(g).toBeDefined();
    expect(g!.handlung).toBe("klaerung_ansprechen");
    expect(g!.brauchtZustimmung).toBe(true);
    expect(g!.nachricht).toContain("Soll ich");
  });

  it("ändert nichts von selbst — die Handlung braucht Zustimmung", () => {
    /*
     * Der Fall aus dem Auftrag: „Ich möchte keinen Vertrieb", dann
     * acht gespeicherte Vertriebsstellen. Die Präferenz bleibt, bis
     * die Person etwas anderes sagt.
     */
    expect(klasseVon("klaerung_ansprechen")).toBe("propose_first");
    expect(klasseVon("wissensluecke_fragen")).toBe("propose_first");
    expect(klasseVon("unsicherheit_melden")).toBe("propose_first");
  });

  it("schweigt bei einem schwachen Widerspruch", () => {
    expect(gelegenheitenAusKlaerungen([widerspruch(0.2)])).toHaveLength(0);
  });

  it("schweigt mitten in einer Bewerbung", () => {
    expect(
      gelegenheitenAusKlaerungen([widerspruch(0.6)], { beschaeftigtMit: "bewerbung" }),
    ).toHaveLength(0);
  });

  it("hört nach zwei Anläufen auf zu fragen", () => {
    expect(gelegenheitenAusKlaerungen([widerspruch(0.6, 1)])).toHaveLength(1);
    expect(gelegenheitenAusKlaerungen([widerspruch(0.6, 2)])).toHaveLength(0);
  });
});

describe("Wissenslücken", () => {
  it("fragt nach dem Arbeitsort — dem schwersten Feld", () => {
    const [g] = gelegenheitenAusKlaerungen([frage("arbeitsort")]);
    expect(g?.handlung).toBe("wissensluecke_fragen");
  });

  it("fragt nicht nach Entwicklungswünschen, nur weil sie fehlen", () => {
    /*
     * Gewicht 4 von 10. Eine echte Lücke, aber keine, für die man
     * jemanden unterbricht — die Empfehlungen werden davon kaum
     * besser.
     */
    expect(gelegenheitenAusKlaerungen([frage("entwicklung")])).toHaveLength(0);
  });

  it("fragt auch nach dem kleinen Feld, wenn die Analyse daran hängt", () => {
    const g = gelegenheitenAusKlaerungen([frage("entwicklung")], { analyseBlockiert: true });
    expect(g).toHaveLength(1);
    expect(g[0]!.dringlichkeit).toBe("hoch");
  });

  it("stellt die wichtigere Frage zuerst", () => {
    const g = gelegenheitenAusKlaerungen([frage("taetigkeit"), widerspruch(0.65)]);
    expect(g[0]!.handlung).toBe("klaerung_ansprechen");
  });
});

describe("Uneinigkeit zweier Läufe", () => {
  it("wird zu einer Meldung, wenn ein Hinweis vorliegt", () => {
    const g = gelegenheitenAusKlaerungen([], {
      unsicherheit: "Bei der Richtung komme ich zu keinem eindeutigen Bild.",
    });
    expect(g).toHaveLength(1);
    expect(g[0]!.handlung).toBe("unsicherheit_melden");
  });

  it("entsteht nicht ohne Hinweis", () => {
    expect(gelegenheitenAusKlaerungen([], { unsicherheit: null })).toHaveLength(0);
  });
});

describe("Die Stellenlage", () => {
  const konflikt = (passung: number) => ({
    jobId: "j1",
    titel: "Fachkraft für Lagerlogistik",
    einwand: "die Vergütung liegt unter deiner Untergrenze von 36.000 Euro.",
    passung,
  });

  it("meldet die sehr gut passende Stelle, die eine Bedingung verletzt", () => {
    const g = gelegenheitenAusStellenlage({
      harteKonflikte: [konflikt(88)],
      starkeTreffer: [],
    });
    expect(g).toHaveLength(1);
    expect(g[0]!.handlung).toBe("gehalt_lockern");
    expect(g[0]!.brauchtZustimmung).toBe(true);
  });

  it("schweigt bei einer mittelmässigen Stelle, die eine Bedingung verletzt", () => {
    /* Das ist der Normalfall der Stellensuche und keine Nachricht. */
    expect(
      gelegenheitenAusStellenlage({ harteKonflikte: [konflikt(60)], starkeTreffer: [] }),
    ).toHaveLength(0);
  });

  it("meldet erst ab drei ungewöhnlich guten Treffern", () => {
    const treffer = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ jobId: `j${i}`, titel: `Stelle ${i}`, passung: 85 }));

    expect(
      gelegenheitenAusStellenlage({ harteKonflikte: [], starkeTreffer: treffer(2) }),
    ).toHaveLength(0);
    expect(
      gelegenheitenAusStellenlage({ harteKonflikte: [], starkeTreffer: treffer(3) }),
    ).toHaveLength(1);
  });

  it("zählt nur, was wirklich gut passt", () => {
    const mittel = Array.from({ length: 5 }, (_, i) => ({
      jobId: `j${i}`,
      titel: `Stelle ${i}`,
      passung: 72,
    }));
    expect(
      gelegenheitenAusStellenlage({ harteKonflikte: [], starkeTreffer: mittel }),
    ).toHaveLength(0);
  });

  it("stellt den verletzten Gehaltsboden über die guten Treffer", () => {
    const g = gelegenheitenAusStellenlage({
      harteKonflikte: [konflikt(88)],
      starkeTreffer: Array.from({ length: 4 }, (_, i) => ({
        jobId: `t${i}`,
        titel: `Treffer ${i}`,
        passung: 90,
      })),
    });
    expect(g[0]!.handlung).toBe("gehalt_lockern");
  });
});
