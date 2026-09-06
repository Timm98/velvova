import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `"use server"`-Dateien dürfen nur asynchrone Funktionen exportieren.
 *
 * ── Warum das eine eigene Prüfung braucht ─────────────────────
 *
 * Die Regel steht in keinem Typ. Der Typprüfer sieht nichts, die
 * Unit-Tests sehen nichts, der Entwicklungsserver läuft. Erst der
 * Produktionsbau bricht ab — mit
 *
 *     A "use server" file can only export async functions, found object.
 *
 * ohne zu sagen, WELCHE Datei und welcher Export gemeint ist. Man sucht
 * dann in dreissig Dateien nach einer Konstante.
 *
 * Genau das ist in diesem Projekt zweimal passiert: einmal mit
 * `payroll/einstellungen.ts` (daher `angaben.ts`), einmal mit
 * `arbeitgeber/bewerbungen.ts` (daher `stufen.ts`). Beim zweiten Mal
 * kostete es einen kompletten Bau, um die Ursache zu finden.
 *
 * ── Was hier geprüft wird ─────────────────────────────────────
 *
 * Jede Zeile, die mit `export` beginnt, muss entweder eine asynchrone
 * Funktion einleiten oder ein Typ sein — Typen werden übersetzt und
 * verschwinden. Alles andere ist ein Objekt, eine Konstante oder eine
 * synchrone Funktion und bricht den Bau.
 */

const WURZEL = new URL("../", import.meta.url).pathname;

function dateien(ordner: string): string[] {
  const raus: string[] = [];
  for (const name of readdirSync(ordner)) {
    if (name === "node_modules" || name.startsWith(".next")) continue;
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) raus.push(pfad);
  }
  return raus;
}

/** Exportzeilen, die im Bau scheitern würden. */
function verboteneExporte(inhalt: string): string[] {
  const schlecht: string[] = [];
  for (const zeile of inhalt.split("\n")) {
    const t = zeile.trim();
    /*
     * Wortgrenze, nicht Präfix.
     *
     * `t.startsWith("export")` traf `exportiertAm: new Date()...` mitten
     * in einem Objektliteral — die erste Fassung meldete einen Fehler,
     * den es nicht gab. Eine Prüfung, die falsch Alarm schlägt, wird
     * abgeschaltet, und dann schützt sie nichts mehr.
     */
    if (!/^export\b/.test(t)) continue;

    // Erlaubt: async function, Typen, Re-Export von Typen.
    if (/^export\s+async\s+function\s/.test(t)) continue;
    if (/^export\s+(type|interface)\s/.test(t)) continue;
    if (/^export\s+\{[^}]*\}\s*from\s/.test(t) && /\btype\b/.test(t)) continue;
    if (/^export\s+type\s*\{/.test(t)) continue;
    /*
     * Ein `export {` allein auf der Zeile ist der Beginn eines
     * mehrzeiligen Blocks. Ihn hier zu bewerten hiesse raten — die
     * Prüfung sagt dann lieber nichts, statt falsch Alarm zu schlagen.
     */
    if (/^export\s*\{\s*$/.test(t)) continue;
    if (/^export\s+default\s+async\s+function\s/.test(t)) continue;

    schlecht.push(t.slice(0, 90));
  }
  return schlecht;
}

describe("Serveraktionen", () => {
  const serverDateien = dateien(WURZEL).filter((p) => {
    const kopf = readFileSync(p, "utf8").slice(0, 200);
    return /^\s*["']use server["']/.test(kopf);
  });

  it("findet überhaupt Serveraktionsdateien", () => {
    // Ohne diese Zeile bliebe die Prüfung grün, wenn der Filter kaputt
    // geht — und dann prüft sie nichts mehr, ohne es zu sagen.
    expect(serverDateien.length).toBeGreaterThan(3);
  });

  it("exportiert aus jeder nur asynchrone Funktionen und Typen", () => {
    const fehler: string[] = [];
    for (const pfad of serverDateien) {
      for (const zeile of verboteneExporte(readFileSync(pfad, "utf8"))) {
        fehler.push(`${pfad.slice(WURZEL.length)}: ${zeile}`);
      }
    }
    expect(fehler).toEqual([]);
  });
});
