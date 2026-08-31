import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Jede Textfarbe gegen jede Fläche, auf der sie vorkommen kann.
 *
 * V7 §3.3 gibt die Palette in Hexwerten vor. Die meisten davon sind
 * übernommen — zwei Sorten aber nicht wörtlich, und der Grund steht
 * hier, damit ihn niemand für ein Versehen hält und „korrigiert":
 *
 *   **Markentöne tragen Flächen, nicht Schrift.** `--primary`
 *   (#655DFF) erreicht auf der weichen Lavendelfläche 4,03:1. Als
 *   Füllung ist er exakt richtig, als Schrift fällt er durch. Deshalb
 *   gibt es zu jedem Markenton eine `-text`-Fassung: gleicher Ton,
 *   dunkler gesetzt. Geprüft wird hier nur, was wirklich Schrift ist.
 *
 *   **`--text-muted: #8A93A4` aus der Vorgabe ist nicht übernommen.**
 *   Er erreicht 2,71:1 — auf keiner einzigen Fläche lesbar. Und dieser
 *   Ton trägt gerade die kleine Schrift, bei der ein zu heller Wert am
 *   wenigsten auffällt und am meisten schadet. `--text-tertiary` bleibt
 *   deshalb bei einem dunkleren Wert. Das ist die einzige bewusste
 *   Abweichung von §3.3.
 *
 * Warum das ein Test ist und kein Kommentar: eine Farbe zu ändern
 * kostet einen Handgriff, und ob sie danach noch lesbar ist, sieht man
 * ihr nicht an. Die axe-Prüfung im E2E-Lauf findet es auch — aber nur
 * auf Seiten, die jemand besucht, und erst nach einem vollen Build.
 */

/*
 * `import.meta.dirname` statt `__dirname`.
 *
 * Dieses Paket wird als ES-Modul gebaut; `__dirname` gibt es dort
 * nicht, und der Lint hat das zu Recht gemeldet.
 */
const CSS = readFileSync(path.join(import.meta.dirname, "tokens.css"), "utf8");

/** Nur der helle Block: `:root, [data-theme="light"]`. */
const HELL = CSS.slice(0, CSS.indexOf('[data-theme="dark"]'));

function token(name: string): string {
  const treffer = HELL.match(new RegExp(`\\s--${name}:\\s*(#[0-9a-fA-F]{6})`));
  const wert = treffer?.[1];
  expect(wert, `--${name} ist im hellen Block nicht als Hexwert definiert`).toBeDefined();
  return wert ?? "#000000";
}

function leuchtdichte(hex: string): number {
  const kanäle = (hex.replace("#", "").match(/../g) ?? ["0", "0", "0"])
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (kanäle[0] ?? 0) + 0.7152 * (kanäle[1] ?? 0) + 0.0722 * (kanäle[2] ?? 0);
}

function kontrast(a: string, b: string): number {
  const werte = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x);
  return ((werte[0] ?? 0) + 0.05) / ((werte[1] ?? 0) + 0.05);
}

/* Jede Fläche, auf der Text stehen kann — auch die farbigen. Genau
   dort wird es knapp, und genau dort steht die kleine Schrift. */
const FLÄCHEN = [
  "surface-1",
  "background",
  "surface-soft",
  "surface-lavender",
  "surface-ice",
  "primary-soft",
];

/* Alles, was als Schrift gesetzt wird. Markentöne ohne `-text` stehen
   bewusst NICHT in dieser Liste: sie tragen Flächen. */
const SCHRIFTEN = [
  "text-primary",
  "text-secondary",
  "text-tertiary",
  "primary-text",
  "signal-violet-text",
  "signal-cyan-text",
  "success-text",
  "warning-text",
  "danger-text",
];

describe("Kontrast im hellen Modus", () => {
  for (const schrift of SCHRIFTEN) {
    it(`--${schrift} erreicht 4,5:1 auf jeder Fläche`, () => {
      const vordergrund = token(schrift);

      const durchgefallen = FLÄCHEN.map((f) => ({
        fläche: f,
        wert: kontrast(vordergrund, token(f)),
      })).filter((e) => e.wert < 4.5);

      expect(
        durchgefallen,
        `--${schrift} (${vordergrund}) ist zu hell auf: ` +
          durchgefallen.map((e) => `--${e.fläche} ${e.wert.toFixed(2)}:1`).join(", "),
      ).toEqual([]);
    });
  }

  it("hält die Markentöne aus der Schriftliste heraus", () => {
    /*
     * Die Trennung ist die ganze Idee. Geriete `--primary` als Schrift
     * in Gebrauch, wäre er mit 4,03:1 unlesbar — und niemand würde es
     * bemerken, weil er als Fläche daneben völlig richtig aussieht.
     */
    for (const ton of ["primary", "success", "warning", "danger", "signal-violet"]) {
      expect(
        HELL.includes(`--${ton}-text:`),
        `--${ton} hat keine --${ton}-text-Fassung. Ohne sie landet der Flächenton in der Schrift.`,
      ).toBe(true);
    }
  });

  it("gibt jedem festen Farbwert eine dunkle Fassung", () => {
    /*
     * Der Unterschied zwischen einem Alias und einem festen Wert.
     *
     * `--accent: var(--primary-fill)` steht nur im hellen Block und ist
     * trotzdem im dunklen Modus richtig: die Ersetzung passiert pro
     * Element, und `--primary-fill` ist dort dunkel. Ein Alias kippt
     * von allein mit.
     *
     * `--surface-lavender: #f0eeff` tut das nicht. Der Wert steht fest,
     * und ohne dunkle Fassung bleibt die Fläche hell — während die
     * Schrift darauf dem Thema folgt und hell wird. axe hat dort
     * 1,07:1 gemessen: Text, den man nicht sehen kann.
     *
     * Genau zwei Tokens hatten diesen Fehler, und er ist niemandem
     * aufgefallen, weil der helle Modus der Standard ist. Deshalb
     * prüft das hier eine Maschine und kein Blick.
     */
    /*
     * Ausdrücklich NUR der `[data-theme="dark"]`-Block, nicht auch die
     * `prefers-color-scheme`-Abfrage. Die beiden sehen gleich aus und
     * sind es nicht: die Medienabfrage greift für Menschen, deren
     * System dunkel steht, der Attributblock für die, die im Konto
     * ausdrücklich dunkel gewählt haben. Ein Token nur in der
     * Medienabfrage wäre für genau die zweite Gruppe kaputt — und das
     * ist die Gruppe, die dunkel wirklich will.
     */
    const start = CSS.indexOf('[data-theme="dark"] {');
    const dunkel = CSS.slice(start, CSS.indexOf("\n}", start));
    const dunkleNamen = new Set(
      [...dunkel.matchAll(/^\s*--([a-z0-9-]+):/gm)].map((m) => m[1]),
    );

    const fehlend = [...HELL.matchAll(/^\s*--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*;/gm)]
      .map((m) => m[1]!)
      .filter((name) => !dunkleNamen.has(name));

    expect(
      fehlend,
      `Diese Tokens haben einen festen hellen Farbwert und keine dunkle Fassung: ` +
        `${fehlend.map((n) => `--${n}`).join(", ")}. ` +
        `Im dunklen Modus bleiben sie hell, während die Schrift darauf hell wird.`,
    ).toEqual([]);
  });
});
