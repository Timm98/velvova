import { beforeEach, describe, expect, it } from "vitest";
import {
  kennungAusRohdaten,
  kennungFuerBerufMit,
  schluesselstand,
  schluesseltabelleVergessen,
} from "./berufskennung.ts";

/**
 * Die amtliche Kennung beim Import.
 *
 * ── Was hier geschützt wird ───────────────────────────────────
 *
 * Eine erfundene Kennung wäre schlimmer als keine: Sie wählt
 * Titelbild, Arbeitsprobe und Gehaltsreferenz. Ein falsches Motiv und
 * eine falsche Gehaltsspanne sind für den Lesenden nicht als falsch zu
 * erkennen.
 */
describe("Was nicht dasteht, wird nicht geraten", () => {
  it("gibt nichts zurück, wenn die Rohdaten fehlen", async () => {
    expect(await kennungAusRohdaten(undefined)).toBeNull();
    expect(await kennungAusRohdaten({})).toBeNull();
  });

  it("gibt nichts zurück, wenn `hauptberuf` leer oder keine Zeichenkette ist", async () => {
    expect(await kennungAusRohdaten({ hauptberuf: null })).toBeNull();
    expect(await kennungAusRohdaten({ hauptberuf: "" })).toBeNull();
    expect(await kennungAusRohdaten({ hauptberuf: 42 })).toBeNull();
    /* Zwei Zeichen sind kein Berufsname. */
    expect(await kennungAusRohdaten({ hauptberuf: "IT" })).toBeNull();
  });

  it("gibt nichts zurück für einen unbekannten Beruf", async () => {
    expect(await kennungAusRohdaten({ hauptberuf: "Erfundener Beruf ohne Eintrag" })).toBeNull();
  });
});

describe("Wenn die Nachschlagetabelle nicht zu haben ist", () => {
  beforeEach(() => schluesseltabelleVergessen());

  it("ergibt keine Kennung, statt den Import abzubrechen", async () => {
    /*
     * Eine erfundene Kennung wäre schlimmer als keine — sie wählt
     * Titelbild, Arbeitsprobe und Gehaltsreferenz. Ein Import, der
     * wegen einer fehlenden Nachschlagetabelle abbricht, wäre auch
     * keine Verbesserung.
     */
    const kaputt = () => Promise.reject(new Error("Datenbank belegt"));
    expect(await kennungFuerBerufMit("Fachlagerist/in", kaputt)).toBeNull();
  });

  it("behält den Fehlschlag NICHT im Zwischenspeicher", async () => {
    /*
     * Der teurere der beiden Fehler, die hier standen: Eine einzige
     * Störung, und für die nächste Stunde bekam keine Anzeige eine
     * Berufskennung — lautlos, denn eine leere Tabelle sieht aus wie
     * „dieser Beruf steht nicht drin".
     */
    const kaputt = () => Promise.reject(new Error("Datenbank belegt"));
    await kennungFuerBerufMit("Fachlagerist/in", kaputt);
    expect(schluesselstand().geladen).toBe(false);

    const heil = async () => [{ beruf: "Fachlagerist/in", schluessel: "51302" }];
    expect(await kennungFuerBerufMit("Fachlagerist/in", heil)).toBe("51302");
    expect(schluesselstand().geladen).toBe(true);
  });

  it("unterscheidet „nicht gefunden“ von „nicht ladbar“", async () => {
    /*
     * Ohne diese Auskunft wäre beides derselbe leere Rückgabewert,
     * und ein Ausfall sähe aus wie eine normale Anzeige.
     */
    const kaputt = () => Promise.reject(new Error("Datenbank belegt"));
    await kennungFuerBerufMit("Irgendwas", kaputt);
    expect(schluesselstand().letzterFehler).toMatch(/belegt/);

    const heil = async () => [{ beruf: "Koch/Köchin", schluessel: "29302" }];
    expect(await kennungFuerBerufMit("Erfundener Beruf", heil)).toBeNull();
    expect(schluesselstand().letzterFehler).toBeNull();
    expect(schluesselstand().eintraege).toBe(1);
  });
});
