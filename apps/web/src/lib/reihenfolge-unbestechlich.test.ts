import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Die Reihenfolge darf nicht käuflich sein.
 *
 * ── Warum ein Test und keine Funktion ─────────────────────────
 *
 * Es gibt heute kein Sponsoring, keine bezahlte Platzierung, kein
 * Werbebudget im Ranking — nachgeprüft über den ganzen Quelltext.
 * Die Vorgabe verlangt, dass ein gesponserter Job den organischen
 * Score nicht verbessert; sie ist damit erfüllt, weil es nichts zu
 * sponsern gibt.
 *
 * Genau deshalb ist ein Test das richtige Mittel: Er sichert keinen
 * Mechanismus ab, sondern dessen ABWESENHEIT. Wer eine bezahlte
 * Platzierung einbaut, soll hier stolpern und die Trennung
 * ausdrücklich bauen — sichtbar gekennzeichnet, ohne Einfluss auf die
 * Passung — statt sie beiläufig in die Sortierung zu mischen.
 *
 * Die Zusicherung steht auch in der Oberfläche: „Sortiert nach
 * begründeter Passung, nicht nach Werbebudget."
 */

/*
 * Vom Ort dieser Datei aus, nicht vom Arbeitsverzeichnis.
 *
 * Vitest läuft aus dem Wurzelverzeichnis des Arbeitsbereichs; ein
 * relativer Pfad „src" zeigte dort ins Leere. Der Test wäre nicht
 * fehlgeschlagen, sondern hätte gar nichts geprüft — die schlimmere
 * Sorte Fehler.
 */
/*
 * Der Test liegt in `apps/web`, nicht im Matching-Paket.
 *
 * Er liest Dateien, und nur dieses Paket hat die Node-Typen dafür
 * eingerichtet. Geprüft wird trotzdem beides: die Bewertung im
 * Matching-Paket und die Sortierung in der Anwendung.
 */
const HIER = dirname(fileURLToPath(import.meta.url));
const MATCHING = join(HIER, "..", "..", "..", "..", "packages", "matching", "src");

/*
 * Nur der Code, der tatsächlich bewertet und sortiert.
 *
 * Der ganze Anwendungsordner war zu weit: Getroffen wurde ein
 * Hilfetext, in dem das Versprechen selbst steht — „sortiert nach
 * begründeter Passung, nicht nach Werbebudget". Ein Test, der an der
 * Zusage scheitert, die er absichern soll, ist falsch geschnitten.
 */
const WURZELN = [MATCHING];
const EINZELDATEIEN = [join(HIER, "matching.ts"), join(HIER, "kandidaten.ts")];
const VERBOTEN =
  /\b(sponsored|sponsoring|gesponsert|promoted|promotedUntil|adBudget|werbebudget|bezahlteplatzierung|paidplacement|boostFactor|bidAmount)\b/i;

function dateien(d: string): string[] {
  const raus: string[] = [];
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === "dist") continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) raus.push(...dateien(p));
    else if (/\.ts$/.test(p)) raus.push(p);
  }
  return raus;
}

describe("Die Reihenfolge ist unbestechlich", () => {
  it("kennt kein Sponsoring im Matching", () => {
    const treffer: string[] = [];
    const zuPruefen = [...WURZELN.flatMap(dateien), ...EINZELDATEIEN];
    {
      for (const f of zuPruefen) {
        const text = readFileSync(f, "utf8");
        for (const [i, zeile] of text.split("\n").entries()) {
          /* Kommentare dürfen das Wort nennen — sie erklären ja gerade,
             dass es das nicht gibt. */
          if (/^\s*(\*|\/\/)/.test(zeile)) continue;
          if (VERBOTEN.test(zeile)) treffer.push(`${f}:${i + 1}  ${zeile.trim().slice(0, 70)}`);
        }
      }
    }
    expect(
      treffer,
      "Bezahlte Platzierung im Matching gefunden. Sie muss von der Passung getrennt " +
        "und in der Oberfläche gekennzeichnet sein — nicht in die Sortierung gemischt:\n" +
        treffer.join("\n"),
    ).toEqual([]);
  });
});
