import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Begleitung heisst Monday — in jedem Satz, den jemand liest
 * ══════════════════════════════════════════════════════════════════
 *
 * Entschieden am 11.09.2026. Der Code heisst weiter Nina: Komponenten,
 * Tabellen, `data-nina-target`, die Ordner unter `lib/nina`. Das ist
 * kein Versehen und wird auch nicht nachgezogen — eine Umbenennung von
 * Datenbanken, Domains und Integrationsschlüsseln kostet Ausfälle und
 * bringt niemandem etwas, der die Anwendung benutzt.
 *
 * ── Was dieser Test hält ────────────────────────────────────────
 *
 * Die Trennlinie dazwischen. Sichtbarer Text kommt aus
 * `brand.assistantName`; ein hart geschriebenes „Nina" in einem Satz
 * ist der Fehler, der beim schnellen Hinzufügen einer Seite entsteht
 * und den niemand bemerkt, weil er richtig aussieht.
 *
 * Gemessen am selben Tag: null sichtbare Vorkommen auf vierzehn
 * öffentlichen Seiten. Dieser Test hält diesen Stand, statt ihn zu
 * behaupten.
 */

const WURZEL = join(import.meta.dirname, "..");

function alleDateien(pfad: string, treffer: string[] = []): string[] {
  for (const eintrag of readdirSync(pfad)) {
    const voll = join(pfad, eintrag);
    if (statSync(voll).isDirectory()) alleDateien(voll, treffer);
    else if (eintrag.endsWith(".tsx")) treffer.push(voll);
  }
  return treffer;
}

/** Kommentare heraus — dort darf der alte Name die Geschichte erzählen. */
function ohneKommentare(inhalt: string): string {
  return inhalt
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

/**
 * Bezeichner heraus.
 *
 * `NinaProvider`, `useNinaSteuerung`, `letzteVonNina`, `nina.busy`,
 * `data-nina-target`: alles Code. Übrig bleibt der Name, wie er in
 * einem Satz stünde.
 */
function ohneBezeichner(inhalt: string): string {
  return inhalt
    .replace(/[A-Za-z_$]Nina/g, " ")
    .replace(/Nina[A-Za-z_$]/g, " ")
    .replace(/nina/g, " ");
}

describe("Der sichtbare Name", () => {
  const dateien = alleDateien(join(WURZEL, "app")).concat(
    alleDateien(join(WURZEL, "components")),
  );

  it("prüft überhaupt Dateien", () => {
    expect(dateien.length).toBeGreaterThan(100);
  });

  it("steht in keiner Oberfläche hart geschrieben", () => {
    const treffer: string[] = [];
    for (const d of dateien) {
      const rest = ohneBezeichner(ohneKommentare(readFileSync(d, "utf8")));
      if (/\bNina\b/.test(rest)) treffer.push(d.slice(WURZEL.length + 1));
    }
    expect(treffer).toEqual([]);
  });

  /*
   * Gegenprobe. Ein Filter, der alles wegwirft, macht den Test darüber
   * grün und wertlos — er muss den Namen in einem echten Satz finden.
   */
  it("würde ihn finden, wenn er dastünde", () => {
    const satz = ohneBezeichner(ohneKommentare('<p>Frag Nina nach der Stelle.</p>'));
    expect(/\bNina\b/.test(satz)).toBe(true);
  });
});
