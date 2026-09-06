import { describe, expect, it } from "vitest";
import { iscoAusKldb, ISCO_HAUPTGRUPPEN, KLDB_FELDER } from "./kldb-isco.ts";

describe("iscoAusKldb", () => {
  it("trennt Niveau und Feld", () => {
    /*
     * Dasselbe Berufsfeld, vier Niveaus, vier ISCO-Hauptgruppen:
     * Metallhelfer ist Hilfstätigkeit, die Fachkraft handwerklich,
     * der Spezialist Techniker, der Experte akademisch.
     */
    expect(iscoAusKldb("24101")!.hauptgruppe).toBe(9);
    expect(iscoAusKldb("24102")!.hauptgruppe).toBe(7);
    expect(iscoAusKldb("24103")!.hauptgruppe).toBe(3);
    expect(iscoAusKldb("24104")!.hauptgruppe).toBe(2);
  });

  it("ordnet Informatik anders zu als Metall", () => {
    /* Eine IT-Fachkraft ist kein Handwerker. */
    expect(iscoAusKldb("43112")!.hauptgruppe).toBe(3);
    expect(iscoAusKldb("43114")!.hauptgruppe).toBe(2);
  });

  it("führt Fahrzeugführung zu den Maschinenbedienern", () => {
    expect(iscoAusKldb("52012")!.hauptgruppe).toBe(8);
  });

  it("schweigt bei einem unbrauchbaren Code", () => {
    /*
     * Lieber keine Berufsgruppe als eine geratene: Alles, was darauf
     * aufbaut — Gehaltsvergleich, Zukunftseinschätzung — erbt sonst
     * den Fehler und sieht dabei sicher aus.
     */
    expect(iscoAusKldb(null)).toBeNull();
    expect(iscoAusKldb("")).toBeNull();
    expect(iscoAusKldb("241")).toBeNull();
    expect(iscoAusKldb("99999")).toBeNull();
  });

  it("liest die 9 an fünfter Stelle nicht als Niveau", () => {
    /*
     * Die 9 heisst „nicht zuzuordnen" und steht an 27 der 45.244
     * amtlichen Bezeichnungen. Sie als höchstes Niveau zu lesen, weil
     * 9 die grösste Ziffer ist, wäre ein stiller Fehler.
     */
    expect(iscoAusKldb("24109")).toBeNull();
  });

  it("nennt Konfidenz und Herkunft mit", () => {
    /* Eine Zuordnung ohne Herkunft ist eine Behauptung. */
    const z = iscoAusKldb("81102")!;
    expect(z.konfidenz).toBe("grob");
    expect(z.herkunft).toContain("nicht der amtliche Umsteigeschlüssel");
  });

  it("kennt jedes Berufsfeld der KldB", () => {
    /*
     * 36 Berufshauptgruppen gibt es in der KldB 2010. Fehlt eine,
     * bekommen ihre Stellen still keine Berufsgruppe.
     */
    expect(KLDB_FELDER).toBe(36);
  });

  it("zeigt nur bekannte ISCO-Hauptgruppen", () => {
    for (const feld of ["11", "24", "43", "52", "62", "71", "81", "84", "92", "94"]) {
      for (const n of [1, 2, 3, 4]) {
        const z = iscoAusKldb(`${feld}00${n}`)!;
        expect(ISCO_HAUPTGRUPPEN[z.hauptgruppe], `${feld}/${n}`).toBeTruthy();
      }
    }
  });
});
