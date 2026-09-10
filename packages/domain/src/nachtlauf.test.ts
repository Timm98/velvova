import { describe, expect, it } from "vitest";
import {
  LEERE_BILANZ,
  MINDESTZAHL_STILL,
  NACHTFOLGE,
  PHASEN,
  bilanzPruefen,
  bilanzSatz,
  fortschritt,
  magerkeitsgrund,
  phasentext,
  ringbild,
  stillerMarktSatz,
  type Nachtbilanz,
} from "./nachtlauf.ts";

const BILANZ = (teil: Partial<Nachtbilanz> = {}): Nachtbilanz => ({ ...LEERE_BILANZ, ...teil });

describe("Phasen", () => {
  it("bildet jede Phase auf eine vorhandene Animation ab", () => {
    /*
     * Es gibt sechs Animationen. Eine Phase, die auf etwas anderes
     * zeigt, wäre ein Ring, der stehenbleibt — oder einer, der etwas
     * zeigt, das das Modell nicht kann.
     */
    const erlaubt = ["idle", "thinking", "speaking", "listening", "success", "error"];
    for (const p of PHASEN) expect(erlaubt).toContain(ringbild(p));
  });

  it("gibt jeder Phase eine eigene Zeile", () => {
    const texte = PHASEN.map((p) => phasentext(p));
    expect(new Set(texte).size).toBe(PHASEN.length);
    for (const t of texte) expect(t.length).toBeGreaterThan(0);
  });

  it("nennt eine Zahl nur, wenn eine gemessen wurde", () => {
    /* Ohne Bilanz beschreibt die Zeile, sie behauptet nicht. */
    expect(phasentext("sammeln")).not.toMatch(/\d/);
    expect(phasentext("pruefen")).not.toMatch(/\d/);
    expect(phasentext("bewerten")).not.toMatch(/\d/);
    expect(phasentext("sammeln", { gefunden: 43 })).toContain("43");
  });

  it("zählt den Fortschritt nur innerhalb der Nacht", () => {
    expect(fortschritt("verstehen")).toBeCloseTo(1 / NACHTFOLGE.length);
    expect(fortschritt("bereit")).toBe(1);
    /* „wartet auf den Arbeitgeber" ist keine Stufe einer Nacht. */
    expect(fortschritt("wartet_auf_unternehmen")).toBeNull();
    expect(fortschritt("ruhe")).toBeNull();
  });
});

describe("bilanzPruefen", () => {
  it("lässt schlüssige Zahlen durch", () => {
    expect(bilanzPruefen(BILANZ({ gefunden: 143, nachFiltern: 61, geprueft: 61, empfohlen: 5 }))).toEqual(
      [],
    );
  });

  it("erkennt mehr Empfehlungen als Prüfungen", () => {
    const befunde = bilanzPruefen(BILANZ({ gefunden: 10, nachFiltern: 5, geprueft: 5, empfohlen: 7 }));
    expect(befunde.join(" ")).toContain("empfohlen");
  });

  it("erkennt mehr Treffer nach Filtern als gefunden", () => {
    expect(bilanzPruefen(BILANZ({ gefunden: 3, nachFiltern: 9 })).length).toBeGreaterThan(0);
  });

  it("erkennt Ausgänge, die die geprüfte Menge übersteigen", () => {
    const b = BILANZ({ gefunden: 20, nachFiltern: 10, geprueft: 10, empfohlen: 5, zurueckgestellt: 4, ausgeschlossen: 4 });
    expect(bilanzPruefen(b).join(" ")).toContain("Ausgänge");
  });

  it("nimmt keine gebrochenen Mengen an", () => {
    expect(bilanzPruefen(BILANZ({ gefunden: 12.5 })).length).toBeGreaterThan(0);
  });
});

describe("bilanzSatz", () => {
  it("nennt die gemessenen Zahlen", () => {
    const satz = bilanzSatz(BILANZ({ gefunden: 143, nachFiltern: 61, geprueft: 61, empfohlen: 5 }));
    expect(satz).toContain("61");
    expect(satz).toContain("5");
  });

  it("baut aus widersprüchlichen Zahlen keinen schönen Satz", () => {
    /*
     * Der Kern der Sache. Lieber „nicht schlüssig" als eine Bilanz,
     * die sich gut liest und falsch ist.
     */
    const satz = bilanzSatz(BILANZ({ gefunden: 10, nachFiltern: 5, geprueft: 5, empfohlen: 9 }));
    expect(satz).toContain("nicht schlüssig");
    expect(satz).not.toContain("9");
  });

  it("verschweigt ausgefallene Quellen nicht", () => {
    const satz = bilanzSatz(
      BILANZ({ gefunden: 40, nachFiltern: 10, geprueft: 40, empfohlen: 2, quellenFehler: ["Adzuna", "Arbeitnow"] }),
    );
    expect(satz).toContain("2 Quellen");
    expect(satz).toContain("Adzuna");
  });

  it("sagt bei leerer Nacht, dass nichts kam", () => {
    expect(bilanzSatz(LEERE_BILANZ)).toContain("keine neue Anzeige");
  });

  it("unterscheidet leere Nacht von ausgefallenen Quellen", () => {
    const satz = bilanzSatz(BILANZ({ quellenFehler: ["Adzuna"] }));
    expect(satz).toContain("nicht erreichbar");
  });

  it("nennt zurückgestellte Stellen, statt sie zu verschweigen", () => {
    const satz = bilanzSatz(
      BILANZ({ gefunden: 50, nachFiltern: 20, geprueft: 50, empfohlen: 3, zurueckgestellt: 12 }),
    );
    expect(satz).toContain("12");
    expect(satz).toContain("Muss-Angabe");
  });
});

describe("magerkeitsgrund", () => {
  it("schweigt, wenn genug empfohlen wurde", () => {
    expect(magerkeitsgrund(BILANZ({ gefunden: 90, nachFiltern: 40, geprueft: 90, empfohlen: 5 }))).toBeNull();
  });

  it("nennt die Muss-Kriterien, wenn sie alles ausschliessen", () => {
    const grund = magerkeitsgrund(BILANZ({ gefunden: 91, nachFiltern: 0, geprueft: 91, ausgeschlossen: 91 }));
    expect(grund).toContain("Muss-Kriterien");
  });

  it("nennt ausgefallene Quellen vor der mageren Ausbeute", () => {
    const grund = magerkeitsgrund(
      BILANZ({ gefunden: 20, nachFiltern: 6, geprueft: 20, empfohlen: 1, quellenFehler: ["Adzuna"] }),
    );
    expect(grund).toContain("nicht erreichbar");
  });

  it("erklärt zurückgestellte Stellen, wenn sie überwiegen", () => {
    const grund = magerkeitsgrund(
      BILANZ({ gefunden: 40, nachFiltern: 20, geprueft: 40, empfohlen: 1, zurueckgestellt: 15 }),
    );
    expect(grund).toContain("15");
  });

  it("erfindet keinen Grund bei widersprüchlichen Zahlen", () => {
    expect(magerkeitsgrund(BILANZ({ gefunden: 2, nachFiltern: 9 }))).toBeNull();
  });
});

describe("stillerMarktSatz", () => {
  it("nennt keine Zahl unterhalb der Mindestgrösse", () => {
    /*
     * Bei zwei versiegelten Angeboten in einer Region und einem Beruf
     * ist die Zahl selbst ein Hinweis darauf, wer sie hinterlegt hat.
     */
    for (let n = 1; n < MINDESTZAHL_STILL; n++) {
      expect(stillerMarktSatz(n)).not.toMatch(/\d/);
      expect(stillerMarktSatz(n)).toContain("wenige");
    }
  });

  it("nennt die Zahl ab der Mindestgrösse", () => {
    expect(stillerMarktSatz(MINDESTZAHL_STILL)).toContain(String(MINDESTZAHL_STILL));
  });

  it("sagt bei null, dass nichts da ist", () => {
    expect(stillerMarktSatz(0)).toContain("kein Angebot");
  });
});
