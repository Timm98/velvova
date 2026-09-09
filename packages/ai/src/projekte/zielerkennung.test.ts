import { describe, expect, it } from "vitest";
import {
  aehnlichkeit,
  PROJEKTGRENZEN,
  zuordnungPruefen,
  type Projektlage,
  type Zuordnungsvorschlag,
} from "./zielerkennung.ts";

const LEER: Projektlage = { projekte: [] };
const MIT: Projektlage = {
  projekte: [
    { id: "p1", name: "Vertrieb · Remote · ab 70k", ziel: "Remote-Vertriebsrolle ab 70.000 Euro" },
    { id: "p2", name: "Quereinstieg · IT", ziel: "Wechsel in die IT ohne Vorerfahrung" },
  ],
  offenesProjekt: "p1",
};

const v = (x: Partial<Zuordnungsvorschlag>): Zuordnungsvorschlag =>
  ({ art: "gespraech", ...x }) as Zuordnungsvorschlag;

describe("zuordnungPruefen — die fünf Fälle", () => {
  it("legt für ein eigenständiges Ziel genau ein Vorhaben an", () => {
    const z = zuordnungPruefen(
      v({ art: "neues_projekt", name: "Vertrieb · Remote · ab 70k", ziel: "Remote-Vertrieb ab 70.000" }),
      LEER,
    );
    expect(z.art).toBe("neues_projekt");
    expect(z.name).toBe("Vertrieb · Remote · ab 70k");
  });

  it("ändert bei einer Präzisierung das offene Vorhaben", () => {
    const z = zuordnungPruefen(v({ art: "verfeinern", ziel: "höchstens 10 % Reise" }), MIT);
    expect(z.art).toBe("verfeinern");
    expect(z.projektId).toBe("p1");
  });

  it("legt für eine allgemeine Frage nichts an", () => {
    /* „Wie formuliere ich diesen Satz besser?" ist keine Karriere-
       entscheidung. Der Regelfall darf nichts erzeugen. */
    const z = zuordnungPruefen(v({ art: "gespraech" }), MIT);
    expect(z.art).toBe("gespraech");
    expect(z.projektId).toBeNull();
    expect(z.name).toBeNull();
  });

  it("ordnet einem anderen offenen Vorhaben zu", () => {
    const z = zuordnungPruefen(v({ art: "vorhandenes", projektId: "p2" }), MIT);
    expect(z.art).toBe("vorhandenes");
    expect(z.projektId).toBe("p2");
  });

  it("fragt nach, wenn die Absicht mehrdeutig ist", () => {
    const z = zuordnungPruefen(
      v({ art: "rueckfrage", frage: "Neues Vorhaben oder zur bisherigen Suche?" }),
      MIT,
    );
    expect(z.art).toBe("rueckfrage");
    expect(z.frage).toMatch(/bisherigen Suche/);
  });
});

describe("zuordnungPruefen — was die Prüfung abfängt", () => {
  it("macht aus einer unbekannten Kennung kein neues Vorhaben", () => {
    /*
     * Der bequeme Rückfall wäre „dann eben neu". Das Modell wollte
     * aber etwas Vorhandenes treffen und hat sich geirrt — daraus
     * einen Arbeitsbereich zu machen, verdoppelt den Irrtum.
     */
    const z = zuordnungPruefen(v({ art: "vorhandenes", projektId: "gibtesnicht" }), MIT);
    expect(z.art).toBe("gespraech");
    expect(z.grund).toMatch(/Unbekannte Projektkennung/);
  });

  it("verfeinert nichts, wenn nichts offen ist", () => {
    const z = zuordnungPruefen(v({ art: "verfeinern", ziel: "nur Teilzeit" }), LEER);
    expect(z.art).toBe("gespraech");
  });

  it("legt ohne brauchbaren Namen nichts an", () => {
    expect(zuordnungPruefen(v({ art: "neues_projekt", name: "ja" }), LEER).art).toBe("gespraech");
    expect(zuordnungPruefen(v({ art: "neues_projekt", name: "" }), LEER).art).toBe("gespraech");
  });

  it("macht aus einer Rückfrage ohne Frage ein Gespräch", () => {
    /* Sonst stünde Monday stumm da und täte nichts, ohne zu sagen
       warum. */
    const z = zuordnungPruefen(v({ art: "rueckfrage", frage: "  " }), MIT);
    expect(z.art).toBe("gespraech");
  });

  it("fragt nach statt ein Doppelprojekt anzulegen", () => {
    /*
     * Zwei Arbeitsbereiche für dieselbe Suche sind der Fehler, den
     * man erst nach Wochen bemerkt — und dann liegen die Bewerbungen
     * auf beiden.
     */
    const z = zuordnungPruefen(
      v({ art: "neues_projekt", name: "Vertrieb Remote 70000", ziel: "Remote-Vertrieb" }),
      MIT,
    );
    expect(z.art).toBe("rueckfrage");
    expect(z.frage).toMatch(/Vertrieb · Remote · ab 70k/);
  });

  it("erkennt eine Dublette auch am Ziel, nicht nur am Namen", () => {
    const z = zuordnungPruefen(
      v({
        art: "neues_projekt",
        name: "Aussendienst gesucht",
        ziel: "Remote-Vertriebsrolle ab 70.000 Euro",
      }),
      MIT,
    );
    expect(z.art).toBe("rueckfrage");
  });

  it("fragt nach, wenn zu viele Vorhaben offen sind", () => {
    const voll: Projektlage = {
      projekte: Array.from({ length: PROJEKTGRENZEN.maxProjekte }, (_, i) => ({
        id: `x${i}`,
        name: `Vorhaben ${i} mit eigenem Wortschatz ${i}`,
        ziel: null,
      })),
    };
    const z = zuordnungPruefen(
      v({ art: "neues_projekt", name: "Etwas ganz Anderes hier", ziel: "neu" }),
      voll,
    );
    expect(z.art).toBe("rueckfrage");
    expect(z.grund).toMatch(/Grenze/);
  });

  it("legt ein zweites, wirklich anderes Ziel an", () => {
    /* Ein paralleles Vorhaben darf das erste nicht überschreiben. */
    const z = zuordnungPruefen(
      v({ art: "neues_projekt", name: "Pflege · Teilzeit · Hamburg", ziel: "Teilzeit in der Pflege" }),
      MIT,
    );
    expect(z.art).toBe("neues_projekt");
  });
});

describe("aehnlichkeit", () => {
  it("hält Umformulierungen für dasselbe", () => {
    expect(aehnlichkeit("Vertrieb · Remote · ab 70k", "Vertrieb Remote 70k")).toBeGreaterThan(0.6);
  });

  it("hält verschiedene Orte für verschieden", () => {
    /* 0,50 — unter der Grenze von 0,6, mit Luft. */
    expect(aehnlichkeit("Vertrieb München", "Vertrieb Remote")).toBeLessThan(0.6);
  });

  it("kommt mit leeren Namen zurecht", () => {
    expect(aehnlichkeit("", "irgendwas")).toBe(0);
  });
});
