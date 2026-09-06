import { describe, expect, it } from "vitest";
import { ausgewiesenerWert, berufsschluesselFuer, entgeltatlasVerfuegbar } from "./entgeltatlas.ts";

/**
 * Was am Atlas ohne Netzaufruf prüfbar ist — und das ist genau das,
 * was schiefgehen kann.
 *
 * Die Abfrage selbst braucht den Dienst. Die beiden Regeln davor und
 * danach brauchen ihn nicht, und dort sassen die Fehler:
 *
 *   • Negative Kennzahlen als Beträge zu lesen. Der Dienst schreibt
 *     „nicht ausgewiesen" als -1, -2, -3, -42 oder -100 in dieselben
 *     Felder, in denen sonst Euro stehen.
 *   • Einen Schlüssel nachzuschlagen, der schon einer ist.
 */

describe("Negative Kennzahlen sind keine Beträge", () => {
  it("verwirft jede der gemessenen Kennzahlen", () => {
    // Alle fünf sind in echten Antworten aufgetreten, siehe
    // scripts/_ea-negativ.mjs.
    for (const k of [-1, -2, -3, -42, -100]) {
      expect(ausgewiesenerWert(k), `Kennzahl ${k}`).toBeNull();
    }
  });

  it("verwirft die Null", () => {
    /*
     * Ein Median von 0 € ist kein Median, sondern eine leere Zelle.
     * Er würde sonst als „dieser Beruf zahlt nichts" durchgehen.
     */
    expect(ausgewiesenerWert(0)).toBeNull();
  });

  it("lässt echte Beträge durch", () => {
    expect(ausgewiesenerWert(3896)).toBe(3896);
    expect(ausgewiesenerWert(1)).toBe(1);
  });

  it("verwirft, was gar keine Zahl ist", () => {
    // `undefined` kommt vor, wenn der Dienst das Feld weglässt —
    // und NaN entstünde aus Number(null) bei einer Umrechnung.
    for (const v of [undefined, null, "3896", NaN, Infinity, {}]) {
      expect(ausgewiesenerWert(v), String(v)).toBeNull();
    }
  });
});

describe("Der Atlas ist ohne Zugangsdaten benutzbar", () => {
  it("meldet sich als verfügbar", () => {
    /*
     * Hier stand einmal `toBe(false)` — mit der Begründung, ohne
     * Registrierung sei der Dienst zu. Das war der Irrtum: Die Kennung
     * `infosysbub-ega` ist öffentlich und steht im Code. Es gibt keine
     * Umgebung, in der sie fehlt.
     */
    expect(entgeltatlasVerfuegbar()).toBe(true);
  });
});

describe("Eine Kennung ist schon eine Kennung", () => {
  it("reicht eine Berufsgattung unverändert durch", async () => {
    /*
     * Der Kurzschluss vor allem anderen — und ohne Datenbank.
     *
     * Ohne ihn schlüge der Client eine „43414" im Namensverzeichnis
     * nach und verwürfe am Ende einen Schlüssel, den er schon hatte.
     */
    expect(await berufsschluesselFuer("43414")).toBe("43414");
    expect(await berufsschluesselFuer(" 71304 ")).toBe("71304");
  });
});
