import { describe, expect, it } from "vitest";
import { AMPELTON, ampelstufe, zeilenampel } from "./befundton";

describe("ampelstufe", () => {
  it("färbt unter 50 rot", () => {
    expect(ampelstufe(0)).toBe("rot");
    expect(ampelstufe(49)).toBe("rot");
  });

  it("färbt 50 bis 74 gelb", () => {
    expect(ampelstufe(50)).toBe("gelb");
    expect(ampelstufe(74)).toBe("gelb");
  });

  it("färbt ab 75 grün", () => {
    expect(ampelstufe(75)).toBe("gruen");
    expect(ampelstufe(100)).toBe("gruen");
  });

  it("hat für jede Stufe einen Ton", () => {
    // Eine Stufe ohne Farbe wäre unsichtbar statt neutral.
    for (const s of ["rot", "gelb", "gruen"] as const) {
      expect(AMPELTON[s].text).toBeTruthy();
      expect(AMPELTON[s].fuellung).toBeTruthy();
    }
  });

  it("nutzt dieselben Schwellen für jeden Wert", () => {
    /*
     * Passung und Anzeigenqualität sind verschiedene Skalen. Sie
     * bekommen dieselbe Ampel, weil man vergleicht, was nebeneinander
     * gleich aussieht — verschiedene Schwellen wären der sichere Weg
     * zu einer Fehldeutung.
     */
    expect(ampelstufe(60)).toBe(ampelstufe(60));
    expect(ampelstufe(74)).not.toBe(ampelstufe(75));
  });
});

describe("zeilenampel", () => {
  it("färbt grün, wenn beides hoch ist", () => {
    expect(zeilenampel(85, 80).stufe).toBe("gruen");
  });

  it("färbt gelb, wenn die Anzeige schlecht ist, die Passung aber gut", () => {
    /*
     * Der Fall aus dem Auftrag: Passung gut, Anzeigenqualität mies.
     * Das ist eine gute Stelle mit offenen Fragen — und offene Fragen
     * kann man stellen. Also gelb, nicht rot und nicht grün.
     */
    expect(zeilenampel(90, 30).stufe).toBe("gelb");
  });

  it("färbt rot, wenn beides schwach ist", () => {
    expect(zeilenampel(30, 35).stufe).toBe("rot");
  });

  it("lässt die Passung schwerer wiegen als die Anzeige", () => {
    // Gleiche Zahlen, vertauscht: Die Variante mit besserer Passung
    // muss höher liegen.
    const a = zeilenampel(80, 40).gesamt!;
    const b = zeilenampel(40, 80).gesamt!;
    expect(a).toBeGreaterThan(b);
  });

  it("folgt der Zahl, die danebensteht — auch bei einem schwachen Teilwert", () => {
    /*
     * Hier stand eine Sperre: Grün nur, wenn kein Einzelwert unter 50
     * liegt. 95 Passung und 49 Anzeigenqualität ergaben 78 und blieben
     * trotzdem gelb.
     *
     * In der Liste war das ein Widerspruch: 78 mit gelbem Rand,
     * darunter 76 mit grünem. Wer überfliegt, sieht die Bestandteile
     * nicht — er sieht zwei Zahlen und zwei Farben, die einander
     * widersprechen.
     *
     * Die Bestandteile erklären die Zahl weiterhin im Kopf der
     * Anzeige. Die Farbe erklärt nur noch die Zahl.
     */
    expect(zeilenampel(95, 49).gesamt).toBe(78);
    expect(zeilenampel(95, 49).stufe).toBe("gruen");
    /* Und unterhalb der Schwelle bleibt es gelb — aus derselben Zahl. */
    expect(zeilenampel(90, 30).gesamt).toBe(68);
    expect(zeilenampel(90, 30).stufe).toBe("gelb");
  });

  it("rechnet weiter, wenn ein Wert fehlt", () => {
    /*
     * Früher gab es ohne Passung gar keinen Wert. Das machte aus einer
     * teilweise bekannten Lage eine unbekannte: Über die Anzeige und
     * ihre Vollständigkeit ist sehr wohl etwas bekannt.
     *
     * Das Gewicht des fehlenden Werts verteilt sich auf die übrigen.
     */
    expect(zeilenampel(null, 90).gesamt).toBe(90);
    expect(zeilenampel(90, null).gesamt).toBe(90);
  });

  it("gibt erst ohne jede Zahl keine Farbe", () => {
    expect(zeilenampel(null, null, null).stufe).toBeNull();
    expect(zeilenampel(null, null, null).gesamt).toBeNull();
  });

  it("wendet die Sperre nur auf vorhandene Werte an", () => {
    // Eine fehlende Angabe ist kein schlechter Wert — sie hat ihr
    // Gewicht bereits abgegeben.
    expect(zeilenampel(null, 90, 85).stufe).toBe("gruen");
    expect(zeilenampel(null, 90, 40).stufe).toBe("gelb");
  });
});

describe("zeilenampel mit Sicherheit", () => {
  it("ergibt 100 und grün, wenn alle drei 100 sind", () => {
    const r = zeilenampel(100, 100, 100);
    expect(r.gesamt).toBe(100);
    expect(r.stufe).toBe("gruen");
  });

  it("ergibt 50 und nicht grün, wenn alle drei 50 sind", () => {
    /*
     * Der Fall aus dem Auftrag: dreimal 50 ist nicht dasselbe wie
     * dreimal 100. Der Mittelwert allein sagt das schon; die Sperre
     * hält es zusätzlich fest.
     */
    const r = zeilenampel(50, 50, 50);
    expect(r.gesamt).toBe(50);
    expect(r.stufe).not.toBe("gruen");
  });

  it("lässt die Sicherheit am leichtesten wiegen", () => {
    // Eine dünne Datenlage darf eine gute Stelle nicht rot färben.
    const wenigSicher = zeilenampel(90, 90, 20).gesamt!;
    const wenigPassend = zeilenampel(20, 90, 90).gesamt!;
    expect(wenigSicher).toBeGreaterThan(wenigPassend);
  });

  it("rechnet ohne Sicherheit, wenn sie fehlt", () => {
    // Ihr Gewicht wird auf die anderen beiden verteilt, statt sie
    // als null einzurechnen und alles nach unten zu ziehen.
    expect(zeilenampel(80, 80, null).gesamt).toBe(80);
  });

  it("rechnet auch ohne Matching, wenn die anderen beiden vorliegen", () => {
    // Der Fall aus dem Auftrag: Fehlt das Matching, wird der Rest
    // gewertet statt gar nichts.
    expect(zeilenampel(null, 80, 60).gesamt).toBe(72);
  });
});
