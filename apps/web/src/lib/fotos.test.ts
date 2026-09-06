import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOTOS, foto, fotosDerGruppe } from "./fotos.ts";

/**
 * Der Katalog und die Dateien müssen zusammenpassen.
 *
 * Beides wird erzeugt, aber aus verschiedenen Läufen: Ein Eintrag
 * ohne Datei bleibt in der Oberfläche ein leerer Rahmen, und das
 * fällt beim Programmieren nicht auf — nur dem, der die Seite ansieht.
 */
const OEFFENTLICH = path.join(import.meta.dirname, "..", "..", "public");

describe("Katalog und Dateien", () => {
  it("hat zu jedem Eintrag beide Grössen", () => {
    const fehlend = FOTOS.flatMap((f) =>
      [f.pfad, f.klein].filter((p) => !existsSync(path.join(OEFFENTLICH, p))),
    );
    expect(fehlend).toEqual([]);
  });

  it("vergibt jeden Kurznamen nur einmal", () => {
    // Zwei Einträge mit demselben Slug hiessen: eine Datei überschreibt
    // die andere, und `foto()` liefert stillschweigend das falsche Bild.
    const slugs = FOTOS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gibt jedem Motiv einen Alternativtext", () => {
    for (const f of FOTOS) expect(f.alt.length, f.slug).toBeGreaterThan(10);
  });
});

describe("Nachschlagen", () => {
  it("findet Motive einer Gruppe", () => {
    const handwerk = fotosDerGruppe("skilled_trades");
    expect(handwerk.length).toBeGreaterThan(5);
    expect(handwerk.every((f) => f.art === "beruf")).toBe(true);
  });

  it("trennt Krisenmotive von Berufsbildern", () => {
    /*
     * Ein Beitrag über Belastung in der Pflege darf kein lächelndes
     * Berufsbild bekommen, und eine Berufsübersicht kein Burnout-Motiv.
     */
    const krisePflege = fotosDerGruppe("healthcare", "krise");
    expect(krisePflege.length).toBeGreaterThan(0);
    expect(krisePflege.every((f) => f.art === "krise")).toBe(true);
    expect(fotosDerGruppe("healthcare").every((f) => f.art === "beruf")).toBe(true);
  });

  it("erfindet kein Ersatzbild", () => {
    // Lieber der Verlauf aus JobBild.tsx als das nächstbeste Foto.
    expect(foto("gibt-es-nicht")).toBeNull();
  });
});
