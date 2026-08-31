import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Die Schriftgrößen müssen in ihren Spannen bleiben.
 *
 * V7 §4.1 gibt für jede Rolle eine Spanne vor — Fließtext 16,5–18 px,
 * Seitentitel 38–48, Metadaten nicht unter 14. Das ist keine Stilfrage:
 * die Oberfläche wirkte „billig und klein", und der Grund war messbar.
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
  ["UI-Standard und Buttons", "text-sm", 15, 17],
  ["Fließtext", "text-base", 16.5, 18],
  ["Jobtitel in der Liste", "text-lg", 18, 20],
  ["Abschnittsüberschrift", "text-xl", 22, 28],
  ["Abschnittsüberschrift groß", "text-2xl", 22, 28],
  ["Jobtitel im Detail", "text-3xl", 34, 44],
  ["Seitentitel", "text-4xl", 38, 48],
  ["Seitentitel groß", "text-5xl", 38, 48],
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

  it("steigt monoton", () => {
    // Eine Skala, in der eine Stufe kleiner ist als ihre Vorgängerin,
    // ist keine Skala mehr, sondern eine Sammlung von Ausnahmen.
    const reihe = ["text-2xs", "text-xs", "text-sm", "text-base", "text-lg", "text-xl",
      "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl"];
    const werte: number[] = reihe.map(stufe);
    for (let i = 1; i < werte.length; i++) {
      const [vorher, jetzt] = [werte[i - 1]!, werte[i]!];
      expect(
        jetzt,
        `--${reihe[i]} (${jetzt}px) ist nicht größer als --${reihe[i - 1]} (${vorher}px)`,
      ).toBeGreaterThan(vorher);
    }
  });
});
