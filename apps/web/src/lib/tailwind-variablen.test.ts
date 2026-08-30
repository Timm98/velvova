import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Custom Properties in Tailwind-Klassen.
 *
 * In Tailwind 3 wurde `rounded-[--radius-md]` automatisch zu
 * `border-radius: var(--radius-md)`. In Tailwind 4 nicht mehr: dort
 * entsteht daraus
 *
 *     border-radius: --radius-md;
 *
 * also eine ungültige Deklaration. Der Browser verwirft sie
 * stillschweigend — keine Warnung, kein Fehler in der Konsole, kein
 * fehlgeschlagener Test. Nur eckige Ecken, wo runde stehen sollten.
 *
 * Genau so ist es passiert: 137 Vorkommen in 47 Dateien, jede einzelne
 * wirkungslos, und die Oberfläche sah aus, als hätte nie jemand einen
 * Radius gesetzt.
 *
 * Die richtige Form ist die runde Klammer: `rounded-(--radius-md)`.
 *
 * Dieser Test prüft die Quelle, nicht das Ergebnis. Das ist Absicht:
 * das Ergebnis zu prüfen hieße, den Erzeugungslauf abzuwarten — und
 * dann fällt es wieder erst auf, wenn jemand hinschaut.
 */

const WURZELN = ["src"];
const ENDUNGEN = new Set([".ts", ".tsx"]);

function dateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    if (eintrag === "node_modules" || eintrag.startsWith(".")) continue;
    const voll = path.join(verzeichnis, eintrag);
    if (statSync(voll).isDirectory()) gefunden.push(...dateien(voll));
    else if (ENDUNGEN.has(path.extname(voll))) gefunden.push(voll);
  }
  return gefunden;
}

/*
 * Die eckige Klammer direkt hinter einem Utility-Namen, mit einer
 * blossen Custom Property darin. `shadow-[0_0_0_2px_var(--primary)]`
 * ist in Ordnung — dort steht `var()` und ein vollständiger Wert.
 */
const KAPUTT = /[a-z0-9\]]-\[--[a-z0-9-]+\]/g;

describe("Tailwind-Klassen mit Custom Properties", () => {
  it("benutzt nirgends die eckige Klammer für eine blosse Variable", () => {
    const basis = path.resolve(import.meta.dirname, "..", "..");
    const treffer: string[] = [];

    for (const wurzel of WURZELN) {
      for (const datei of dateien(path.join(basis, wurzel))) {
        if (datei.endsWith("tailwind-variablen.test.ts")) continue;
        const inhalt = readFileSync(datei, "utf8");
        for (const fund of inhalt.match(KAPUTT) ?? []) {
          treffer.push(`${path.relative(basis, datei)}: ${fund}`);
        }
      }
    }

    expect(
      treffer,
      "Diese Klassen erzeugen ungültiges CSS und werden stillschweigend " +
        "verworfen. Schreibweise: rounded-(--radius-md) statt rounded-[--radius-md].\n" +
        treffer.slice(0, 20).join("\n"),
    ).toEqual([]);
  });
});
