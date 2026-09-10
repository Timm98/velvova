import { describe, expect, it } from "vitest";
import {
  type Befundentwurf,
  type Quellenbezug,
  befundPruefen,
  doppelzaehlungen,
  istWahrscheinlichkeitsangabe,
  unabhaengigeQuellen,
  zeitschaetzung,
} from "./befundlage.ts";

const quelle = (id: string, eigentuemer: string, art: string): Quellenbezug => ({
  id,
  eigentuemer,
  art,
  zeitraum: "Januar bis März",
  abdeckung: null,
});

const voll: Befundentwurf = {
  beobachtung: "Bei den geprüften Vorgängen fehlt die Zuständigkeit.",
  quellen: [quelle("1", "Leitung Service", "vorgangsliste"), quelle("2", "IT", "crm_export")],
  alternativen: ["Die Fälle waren komplexer als üblich."],
  gegenbelege: [],
  gegenbelegeGeprueft: true,
  vomUnternehmenBestaetigt: true,
};

describe("Unabhängigkeit der Quellen", () => {
  it("zählt drei Kopien derselben Unterlage als eine Quelle", () => {
    expect(
      unabhaengigeQuellen([
        quelle("a", "Leitung Service", "prozesshandbuch"),
        quelle("b", "Leitung Service", "Prozesshandbuch"),
        quelle("c", "leitung service", "prozesshandbuch "),
      ]),
    ).toBe(1);
  });

  it("zählt verschiedene Eigentümer getrennt", () => {
    expect(
      unabhaengigeQuellen([
        quelle("a", "Leitung Service", "prozesshandbuch"),
        quelle("b", "IT", "prozesshandbuch"),
      ]),
    ).toBe(2);
  });
});

describe("Wann ein Befund ein Befund ist", () => {
  it("bestätigt, wenn alles vorliegt", () => {
    const l = befundPruefen(voll);
    expect(l.stand).toBe("bestaetigt");
  });

  it("meldet „kein Befund“ ohne Quelle", () => {
    expect(befundPruefen({ ...voll, quellen: [] }).stand).toBe("kein_befund");
  });

  it("bleibt Hypothese ohne alternative Erklärung", () => {
    const l = befundPruefen({ ...voll, alternativen: [] });
    expect(l.stand).toBe("hypothese");
  });

  it("bleibt Hypothese bei nur einer unabhängigen Quelle", () => {
    const l = befundPruefen({
      ...voll,
      quellen: [quelle("1", "IT", "crm_export"), quelle("2", "IT", "crm_export")],
    });
    expect(l.stand).toBe("hypothese");
  });

  it("verwirft, sobald ein Gegenbeleg dasteht — auch wenn der Betrieb zustimmt", () => {
    const l = befundPruefen({ ...voll, gegenbelege: ["Die Zeitstempel werden nachgetragen."] });
    expect(l.stand).toBe("verworfen");
  });
});

describe("Keine Prozentangabe für eine Ursache", () => {
  it("erkennt die Behauptung in beiden Richtungen", () => {
    expect(istWahrscheinlichkeitsangabe("Mit 70 % Wahrscheinlichkeit liegt es an der Übergabe.")).toBe(true);
    expect(istWahrscheinlichkeitsangabe("Wahrscheinlich zu 80 Prozent die Ursache.")).toBe(true);
    expect(istWahrscheinlichkeitsangabe("Eine 90-prozentige Sicherheit besteht nicht.")).toBe(true);
  });

  it("lässt gewöhnliche Zahlen durch", () => {
    expect(istWahrscheinlichkeitsangabe("80 Vorgänge im Monat, sechs Minuten je Vorgang.")).toBe(false);
    expect(istWahrscheinlichkeitsangabe("Die Abdeckung liegt bei 40 Prozent der Vorgänge.")).toBe(false);
  });
});

describe("Zeit bleibt Zeit", () => {
  it("rechnet 80 Vorgänge zu sechs Minuten in acht Stunden", () => {
    const z = zeitschaetzung(80, 6);
    expect(z?.stunden).toBe(8);
    expect(z?.art).toBe("geschaetzt");
  });

  it("nennt im Satz keinen Geldbetrag und markiert die Schätzung", () => {
    const z = zeitschaetzung(80, 6);
    expect(z?.satz).toMatch(/geschätzt/i);
    expect(z?.satz).not.toMatch(/€|euro|ersparnis|eingespart/i);
  });

  it("gibt null bei unbrauchbaren Eingaben", () => {
    expect(zeitschaetzung(0, 6)).toBeNull();
    expect(zeitschaetzung(80, -1)).toBeNull();
    expect(zeitschaetzung(Number.NaN, 6)).toBeNull();
  });
});

describe("Dieselbe Zeit nicht zweimal", () => {
  it("findet die Quelle, die in zwei Befunden steckt", () => {
    const d = doppelzaehlungen([{ quellen: [quelle("1", "IT", "crm")] }, { quellen: [quelle("1", "IT", "crm")] }]);
    expect(d).toHaveLength(1);
  });

  it("zählt eine Quelle, die zweimal im selben Befund steht, nicht doppelt", () => {
    const d = doppelzaehlungen([{ quellen: [quelle("1", "IT", "crm"), quelle("1", "IT", "crm")] }]);
    expect(d).toHaveLength(0);
  });
});
