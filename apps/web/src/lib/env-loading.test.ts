import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Die Umgebungsdateien liegen in der Wurzel des Monorepos, nicht neben
 * der App. Next.js sucht sie neben der App — deshalb liest
 * `next.config.ts` sie selbst.
 *
 * Die erste Fassung las **nur** `.env`. Damit lief die eigene
 * Setup-Anleitung ins Leere: wer wie in `docs/LOCAL_SETUP.md`
 * beschrieben eine `.env.local` anlegte, änderte nichts. Und nichts
 * schlug fehl — es blieb einfach beim alten Wert.
 *
 * Der Test liest die Konfigurationsdatei als Text. Sie ausführen hiesse,
 * die echte Umgebung zu verändern.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const config = readFileSync(path.join(here, "..", "..", "next.config.ts"), "utf8");

describe("Laden der Umgebungsdateien", () => {
  it("liest beide Dateien", () => {
    expect(config).toContain('loadEnvFile(".env"');
    expect(config).toContain('loadEnvFile(".env.local"');
  });

  it("liest .env.local nach .env", () => {
    // Die Reihenfolge ist die Aussage: die persönliche Datei muss die
    // gemeinsame überstimmen können, sonst ist sie wirkungslos.
    expect(config.indexOf('loadEnvFile(".env"')).toBeLessThan(
      config.indexOf('loadEnvFile(".env.local"'),
    );
  });

  it("lässt echte Umgebungsvariablen gewinnen", () => {
    // Ein Deployment setzt Werte über die Umgebung. Würde eine
    // eingecheckte Datei sie überschreiben, liefe Produktion mit
    // Entwicklungswerten.
    expect(config).toMatch(/process\.env\[name!?\] !== undefined/);
  });

  it("überspringt Kommentarzeilen", () => {
    expect(config).toContain('trimmed.startsWith("#")');
  });

  it("behandelt eine fehlende Datei als gültigen Zustand", () => {
    expect(config).toMatch(/gültiger Zustand, kein Fehler/);
  });
});

describe("Setup-Anleitung", () => {
  it("beschreibt denselben Weg, den der Code umsetzt", () => {
    // Der eigentliche Fehler war die Lücke zwischen beiden. Ein Test,
    // der nur den Code prüft, hätte ihn nicht gefunden.
    const setup = readFileSync(
      path.join(here, "..", "..", "..", "..", "docs", "LOCAL_SETUP.md"),
      "utf8",
    );
    expect(setup).toContain(".env.local");
    expect(config).toContain(".env.local");
  });
});
