import { describe, expect, it } from "vitest";
import { STANDARDSUCHEN } from "./sources/bundesagentur.ts";
import { activeAdapters } from "./registry.ts";
import { loadRuntimeConfig } from "@paycheck/config";

/**
 * Ergänzen, nicht ersetzen.
 *
 * Die Entscheidung kommt aus einer Messung, nicht aus einer Vermutung:
 * Über 63 Konten mit Belegen überschritten nur DREI aus Profilen
 * abgeleitete Suchrichtungen die Schwelle. Hätte die Registrierung die
 * fünf Standardbegriffe durch sie ersetzt, wäre der Bestand von fünf
 * auf drei Richtungen geschrumpft — und Sachbearbeitung, Büromanagement
 * und Vertriebsinnendienst wären ganz weggefallen.
 *
 * Das Gegenteil des Ziels, und ohne diesen Test leicht wieder
 * einzubauen: „die Begriffe kommen jetzt aus den Profilen" klingt nach
 * Fortschritt, auch wenn es verengt.
 */

const cfg = loadRuntimeConfig();
const ba = (abfragen?: string[]) =>
  activeAdapters(cfg, abfragen ? { abfragen } : {}).find((a) => a.key === "bundesagentur");

describe("Suchbegriffe der Bundesagentur", () => {
  it("behält die Grundausstattung, wenn keine Profile etwas hergeben", () => {
    const a = ba() as unknown as { abfragen: string[] } | undefined;
    if (!a) return; // Quelle in dieser Umgebung nicht aktiv
    for (const s of STANDARDSUCHEN) expect(a.abfragen).toContain(s);
  });

  it("ergänzt Profilbegriffe, statt die Grundausstattung zu ersetzen", () => {
    const a = ba(["Personalsachbearbeitung", "Auftragsabwicklung"]) as unknown as
      | { abfragen: string[] }
      | undefined;
    if (!a) return;
    for (const s of STANDARDSUCHEN) expect(a.abfragen, "Grundausstattung fehlt").toContain(s);
    expect(a.abfragen).toContain("Personalsachbearbeitung");
    expect(a.abfragen).toContain("Auftragsabwicklung");
  });

  it("nimmt einen Begriff nicht doppelt auf", () => {
    // „Disposition" steht schon in der Grundausstattung.
    const a = ba(["Disposition", "disposition"]) as unknown as { abfragen: string[] } | undefined;
    if (!a) return;
    const wieOft = a.abfragen.filter((x) => x.toLowerCase() === "disposition").length;
    expect(wieOft).toBe(1);
  });

  it("begrenzt die Zahl der Begriffe — aber nicht mehr auf zwölf", () => {
    /*
     * ── Warum die Grenze bei zwölf lag ────────────────────────
     *
     * Der Adapter holte je Begriff eine Seite und teilte sein Limit
     * durch die Anzahl der Begriffe. Mehr Begriffe hiessen weniger
     * Treffer je Begriff, und die hinteren verhungerten ganz.
     *
     * ── Warum sie das nicht mehr tut ──────────────────────────
     *
     * Seit der Adapter reihum blättert — erst Seite 1 für alle
     * Begriffe, dann Seite 2 für alle —, kommt jeder Begriff in jeder
     * Runde dran. Der Grund für die enge Grenze ist weg, und mit ihm
     * der Deckel, der den Bestand bei 327 Anzeigen aus einer Quelle
     * mit 999.398 hielt.
     *
     * Eine Grenze bleibt trotzdem: 400 Begriffe sind 400 Anfragen je
     * Seite. Das ist ein Schutz gegen Unfälle, kein fachliches Limit.
     */
    const viele = Array.from({ length: 500 }, (_, i) => `Richtung ${i}`);
    const a = ba(viele) as unknown as { abfragen: string[] } | undefined;
    if (!a) return;
    expect(a.abfragen.length).toBeLessThanOrEqual(400);
  });

  it("lässt vierzig Begriffe vollständig durch", () => {
    // Genau der Fall, den die alte Grenze auf zwölf zusammenstrich.
    const viele = Array.from({ length: 40 }, (_, i) => `Richtung ${i}`);
    const a = ba(viele) as unknown as { abfragen: string[] } | undefined;
    if (!a) return;
    for (const r of viele) expect(a.abfragen, r).toContain(r);
  });
});
