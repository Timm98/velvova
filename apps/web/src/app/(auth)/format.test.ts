import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Das Format der Anmeldekarten steht fest.
 *
 * ── Warum das ein Test ist und keine Absprache ────────────────
 *
 * 480 × 760 ist mehrfach gemessen, mehrfach nachgebessert und
 * mehrfach wieder verrutscht — zuletzt durch eine Ausnahme für die
 * Code-Eingabe, die für sich genommen gut begründet war.
 *
 * Genau daran krankt eine Absprache: Jede einzelne Abweichung hat
 * einen guten Grund, und in Summe ist das Format weg. Ein Test hat
 * keine guten Gründe. Wer das Mass ändern will, ändert es hier — und
 * sieht dabei, dass er eine Zusage anfasst.
 *
 * ── Warum über den Quelltext ──────────────────────────────────
 *
 * Gemessen wird im Browser, und das braucht einen laufenden Server.
 * Was hier geprüft wird, ist die Ursache dahinter: dass alle Seiten
 * dieselbe Karte benutzen und dass die Karte ihr Mass behält.
 */

const AUTH = import.meta.dirname;

function seiten(pfad: string, treffer: string[] = []): string[] {
  for (const eintrag of readdirSync(pfad)) {
    const voll = join(pfad, eintrag);
    if (statSync(voll).isDirectory()) seiten(voll, treffer);
    else if (eintrag === "page.tsx") treffer.push(voll);
  }
  return treffer;
}

const karte = readFileSync(join(AUTH, "Karte.tsx"), "utf8");
const rahmen = readFileSync(join(AUTH, "layout.tsx"), "utf8");

/*
 * Nur die Klassenzeile, nicht die ganze Datei.
 *
 * Der Test hier prüfte erst den gesamten Dateiinhalt — und schlug
 * fehl, sobald ein Kommentar `content-between` erwähnte, um zu
 * erklären, warum genau das ausgeschlossen ist. Ein Test, den eine
 * Begründung bricht, erzieht dazu, Begründungen wegzulassen.
 */
const klassen = /className="([^"]*rounded-\[12px\][^"]*)"/.exec(karte)?.[1] ?? "";

describe("Anmeldekarte", () => {
  it("findet ihre Klassenzeile überhaupt", () => {
    expect(klassen.length).toBeGreaterThan(0);
  });

  it("ist 780 Pixel hoch — mindestens", () => {
    expect(klassen).toContain("min-h-[780px]");
  });

  it("ist 440 Pixel breit", () => {
    expect(rahmen).toContain("max-w-[440px]");
  });

  it("hat keine Ausnahme für einzelne Seiten", () => {
    /* Ein Schalter, der die Höhe wegnimmt, ist der Weg, auf dem das
       Format schon einmal verloren ging. */
    expect(karte).not.toMatch(/kompakt\??\s*[:=]/);
  });

  it("verteilt den Inhalt nicht, sondern rückt ihn als Block in die Mitte", () => {
    /* `content-center` rückt den ganzen Block; `content-between`
       würde die Abstände darin auseinanderziehen. Der Unterschied ist
       genau die Beschwerde, die zu dieser Zeile geführt hat. */
    expect(klassen).toContain("content-center");
    expect(klassen).not.toContain("content-between");
  });
});

describe("Anmeldeseiten", () => {
  const alle = seiten(AUTH);

  it("gibt es überhaupt", () => {
    expect(alle.length).toBeGreaterThan(2);
  });

  it("bauen ihre Karte nicht selbst", () => {
    /* 12 statt 14 Pixel, seit die Karte der Vorlage folgt — der
       Wert ist hier nur das Erkennungsmerkmal der einen Karte.

       Wer `rounded-[12px]` direkt schreibt, hat eine zweite Karte
       gebaut — und die folgt dem Mass hier nicht mehr. */
    const eigenbau = alle.filter((d) => readFileSync(d, "utf8").includes("rounded-[12px]"));
    expect(eigenbau.map((d) => d.slice(AUTH.length + 1))).toEqual([]);
  });
});
