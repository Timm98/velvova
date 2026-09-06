import { describe, expect, it } from "vitest";
import { vorgabenampel, vorgabensatz } from "./vorgabenampel";

const euro = (n: number) => `${n.toLocaleString("de-DE")} €`;
const min = (n: number) => `${n} Minuten`;

describe("vorgabenampel", () => {
  it("färbt grün, wenn das Gehalt die Vorgabe erreicht", () => {
    expect(vorgabenampel(60000, 60000, "hoeher_besser")).toBe("gruen");
    expect(vorgabenampel(72000, 60000, "hoeher_besser")).toBe("gruen");
  });

  it("färbt gelb bei knapper Verfehlung", () => {
    /*
     * Wer 60.000 nennt, meint nicht, dass 57.000 unzumutbar sind. Eine
     * harte Grenze machte aus jeder knappen Verfehlung ein Rot.
     */
    expect(vorgabenampel(57000, 60000, "hoeher_besser")).toBe("gelb");
  });

  it("färbt rot bei deutlicher Verfehlung", () => {
    expect(vorgabenampel(40000, 60000, "hoeher_besser")).toBe("rot");
  });

  it("dreht die Richtung bei der Pendelzeit um", () => {
    // Weniger ist besser: 30 Minuten bei einer Grenze von 45 ist gut.
    expect(vorgabenampel(30, 45, "niedriger_besser")).toBe("gruen");
    expect(vorgabenampel(90, 45, "niedriger_besser")).toBe("rot");
  });

  it("misst den Abstand relativ, nicht absolut", () => {
    /*
     * Fünf Minuten über einer Wunschzeit von 20 sind ein Viertel mehr,
     * fünf über 60 ein Zwölftel. Absolut gerechnet wäre beides gleich.
     */
    expect(vorgabenampel(25, 20, "niedriger_besser")).toBe("rot");
    expect(vorgabenampel(65, 60, "niedriger_besser")).toBe("gelb");
  });

  it("gibt ohne Vorgabe keine Farbe", () => {
    // Eine Zahl einzufärben, für die niemand ein Ziel genannt hat,
    // wäre ein Urteil, das wir uns anmassen.
    expect(vorgabenampel(60000, null, "hoeher_besser")).toBeNull();
  });

  it("gibt ohne Wert keine Farbe", () => {
    expect(vorgabenampel(null, 60000, "hoeher_besser")).toBeNull();
  });

  it("hält eine Vorgabe von null für keine Vorgabe", () => {
    // Sonst wäre jede Zahl „über null" und damit grün.
    expect(vorgabenampel(1, 0, "hoeher_besser")).toBeNull();
  });
});

describe("vorgabensatz", () => {
  it("sagt bei Erfüllung, dass die Vorgabe erreicht ist", () => {
    expect(vorgabensatz(65000, 60000, "hoeher_besser", euro)).toContain("über deiner Vorgabe");
  });

  it("nennt bei Verfehlung den Abstand", () => {
    expect(vorgabensatz(52000, 60000, "hoeher_besser", euro)).toContain("8.000 €");
  });

  it("formuliert die Pendelzeit als Grenze, nicht als Vorgabe", () => {
    expect(vorgabensatz(30, 45, "niedriger_besser", min)).toContain("unter deiner Grenze");
    expect(vorgabensatz(60, 45, "niedriger_besser", min)).toContain("über deiner Grenze");
  });

  it("schweigt ohne Vorgabe", () => {
    // „Du hast dazu nichts festgelegt" wäre eine Zeile mehr, die
    // nichts über die Stelle sagt.
    expect(vorgabensatz(60000, null, "hoeher_besser", euro)).toBeNull();
  });
});
