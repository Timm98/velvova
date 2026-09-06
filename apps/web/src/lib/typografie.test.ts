import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Die Schriftgrößen müssen in ihren Spannen bleiben.
 *
 * Die Spannen stammen aus der aktuellen Gestaltungsvorgabe:
 * Fließtext 15–16 px, Jobtitel in Karten 17–18, Seitentitel höchstens
 * 32–36, Metadaten nicht unter 14.
 *
 * ── Warum sie sich geändert haben ─────────────────────────────
 *
 * Vorher galt V7 §4.1 mit Fließtext 16,5–18 und Seitentiteln bis 48.
 * Diese Werte kamen aus einer Zeit, in der die Oberfläche „billig und
 * klein" wirkte — die Gegenmassnahme war richtig und hat gewirkt.
 *
 * Die neue Vorgabe geht in die andere Richtung: Ein Jobportal wird
 * gelesen und verglichen, nicht betrachtet. Grosse Titel und grosser
 * Fließtext kosten dabei Zeilen, und Zeilen kosten Übersicht.
 *
 * Was NICHT geändert wurde, ist der Zweck dieses Tests: Er verhindert
 * weiterhin, dass die Skala beim nächsten Aufräumen leise
 * zusammenschrumpft — nur die Spannen sind andere. Die Untergrenze
 * von 14 Pixeln für alles, was eine Information trägt, steht
 * unverändert.
 *
 * Der eigentliche Fehler war subtiler als eine zu kleine Skala. Der
 * Fließtext lief nicht auf `--text-base`, sondern 373 Mal auf
 * `--text-sm` mit 14 px. Wer nur `--text-base` angehoben hätte, hätte
 * nichts verändert und es für erledigt gehalten.
 *
 * Deshalb prüft dieser Test die Stufen nach ihrer AUFGABE, nicht nach
 * ihrem Namen: `--text-sm` ist der UI-Standard und muss Buttongröße
 * erreichen, egal wie die Stufe heißt.
 *
 * Ohne diesen Test verschwindet die Vergrößerung beim nächsten
 * „aufräumen" wieder — leise, weil eine kleinere Schrift nirgends einen
 * Fehler auslöst. Sie sieht nur wieder billig aus.
 */

const CSS = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");

/** Eine Stufe in Pixeln. rem wird mit 16 gerechnet, wie im Browser. */
function stufe(name: string): number {
  const treffer = CSS.match(new RegExp(`--${name}:\\s*([0-9.]+)rem`));
  expect(treffer, `--${name} ist nicht als rem-Wert definiert`).not.toBeNull();
  return Number(treffer![1]) * 16;
}

/** Rolle → [Stufe, min, max] aus V7 §4.1. */
const SPANNEN: [string, string, number, number][] = [
  ["Eyebrow / Label", "text-2xs", 14, 16],
  ["Metadaten", "text-xs", 14, 17],
  ["UI-Standard und Buttons", "text-sm", 15, 16],
  ["Fließtext", "text-base", 15, 16],
  ["Jobtitel in der Liste", "text-lg", 17, 18],
  ["Abschnittsüberschrift", "text-xl", 20, 24],
  ["Abschnittsüberschrift groß", "text-2xl", 24, 28],
  ["Jobtitel im Detail", "text-3xl", 30, 34],
  ["Seitentitel", "text-4xl", 32, 36],
  ["Seitentitel groß", "text-5xl", 44, 52],
  ["Headline Landingpage", "text-6xl", 64, 76],
];

describe("Typografie", () => {
  for (const [rolle, name, min, max] of SPANNEN) {
    it(`${rolle} (--${name}) liegt zwischen ${min} und ${max} px`, () => {
      const px = stufe(name);
      expect(px, `--${name} steht bei ${px}px, die Vorgabe ist ${min}–${max}px`).toBeGreaterThanOrEqual(min);
      expect(px, `--${name} steht bei ${px}px, die Vorgabe ist ${min}–${max}px`).toBeLessThanOrEqual(max);
    });
  }

  it("hat keine Stufe unter 14 px", () => {
    /*
     * Die harte Untergrenze. Sie gilt für JEDE Stufe, nicht nur die
     * geprüften — eine neue `--text-3xs` mit 11 px wäre genau der Weg
     * zurück, den dieser Test verhindern soll.
     */
    const alle = [...CSS.matchAll(/--text-([a-z0-9]+):\s*([0-9.]+)rem/g)].map(
      (m) => [m[1], Number(m[2]) * 16] as const,
    );
    expect(alle.length, "keine Schriftstufen gefunden — Regex passt nicht mehr").toBeGreaterThan(8);

    const zuKlein = alle.filter(([, px]) => px < 14);
    expect(
      zuKlein,
      `Diese Stufen liegen unter der Untergrenze von 14px: ${zuKlein.map(([n, px]) => `--text-${n} (${px}px)`).join(", ")}`,
    ).toEqual([]);
  });

  it("fällt nie", () => {
    /*
     * Eine Skala, in der eine Stufe KLEINER ist als ihre Vorgängerin,
     * ist keine Skala mehr, sondern eine Sammlung von Ausnahmen.
     *
     * Gleichauf ist erlaubt, streng grösser nicht mehr gefordert:
     * `--text-2xs` und `--text-xs` liegen beide auf der Untergrenze
     * von 14 Pixeln. Mit Fließtext bei 16 bleibt darunter kein Platz
     * für zwei getrennte Stufen — und eine davon unter 14 zu drücken,
     * nur damit die Skala streng steigt, wäre die falsche
     * Reihenfolge: Lesbarkeit vor Ebenmass.
     */
    const reihe = ["text-2xs", "text-xs", "text-sm", "text-base", "text-lg", "text-xl",
      "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl"];
    const werte: number[] = reihe.map(stufe);
    for (let i = 1; i < werte.length; i++) {
      const [vorher, jetzt] = [werte[i - 1]!, werte[i]!];
      expect(
        jetzt,
        `--${reihe[i]} (${jetzt}px) ist kleiner als --${reihe[i - 1]} (${vorher}px)`,
      ).toBeGreaterThanOrEqual(vorher);
    }
  });
});
