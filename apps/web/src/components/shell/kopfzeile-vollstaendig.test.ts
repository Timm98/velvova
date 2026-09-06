import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Jede Kopfzeile zeigt angemeldeten Menschen ihr Konto.
 *
 * ── Warum ein Test über Dateien und nicht über Verhalten ──────
 *
 * Der Fehler war keiner in der Logik: `TopNav` rendert an einer
 * Stelle `accountMenu`, und der öffentliche Rahmen hat es schlicht
 * nie übergeben. Angemeldet stand rechts neben der Glocke nichts.
 *
 * So etwas fällt in keinem Verhaltenstest auf, weil nichts kaputt
 * ist — es fehlt nur. Und es fällt beim Ansehen nicht auf, weil man
 * die eine Seite prüft, auf der es funktioniert.
 *
 * Der Test prüft deshalb die Vollständigkeit der Verkabelung: Wer
 * `TopNav` benutzt, muss auch sagen, was im Kontobereich steht.
 */

const WURZEL = join(import.meta.dirname, "..", "..");

function alleDateien(pfad: string, treffer: string[] = []): string[] {
  for (const eintrag of readdirSync(pfad)) {
    const voll = join(pfad, eintrag);
    if (statSync(voll).isDirectory()) alleDateien(voll, treffer);
    else if (eintrag.endsWith(".tsx")) treffer.push(voll);
  }
  return treffer;
}

describe("Kopfzeile", () => {
  const nutzer = alleDateien(WURZEL).filter((d) => readFileSync(d, "utf8").includes("<TopNav"));

  it("wird überhaupt irgendwo benutzt", () => {
    expect(nutzer.length).toBeGreaterThan(0);
  });

  it("übergibt an jeder Stelle einen Kontobereich", () => {
    const ohne = nutzer.filter((d) => !readFileSync(d, "utf8").includes("accountMenu="));
    expect(ohne.map((d) => d.slice(WURZEL.length + 1))).toEqual([]);
  });
});
