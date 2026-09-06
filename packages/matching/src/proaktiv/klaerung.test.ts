import { describe, expect, it } from "vitest";
import { offeneFragen, vergleichBauen, type Stellenangabenkurz } from "./klaerung.ts";

function stelle(teil: Partial<Stellenangabenkurz> = {}): Stellenangabenkurz {
  return {
    jobId: "j1",
    titel: "Lagerhelfer (m/w/d)",
    arbeitgeber: "Testbetrieb",
    ort: "Karlsruhe",
    entfernungKm: null,
    gehaltMin: null,
    gehaltMax: null,
    gehaltGenannt: false,
    vertragsform: null,
    wochenstunden: null,
    arbeitsmodell: null,
    remoteAnteil: null,
    schichtarbeit: null,
    erfahrungsniveau: null,
    ...teil,
  };
}

describe("Offene Fragen", () => {
  it("fragt nach dem Gehalt, wenn keins dasteht", () => {
    const f = offeneFragen(stelle());
    expect(f.map((x) => x.schluessel)).toContain("gehalt");
  });

  it("fragt nicht nach dem Gehalt, wenn eins dasteht", () => {
    const f = offeneFragen(
      stelle({ gehaltGenannt: true, gehaltMin: 36_000, gehaltMax: 40_000 }),
    );
    expect(f.map((x) => x.schluessel)).not.toContain("gehalt");
  });

  it("fragt bei einer sehr weiten Spanne nach, wovon es abhängt", () => {
    /* Zwischen 40.000 und 70.000 liegt ein anderes Leben. */
    const f = offeneFragen(stelle({ gehaltGenannt: true, gehaltMin: 40_000, gehaltMax: 70_000 }));
    expect(f.map((x) => x.schluessel)).toContain("gehaltsspanne");
  });

  it("fragt bei hybrid nach den Bürotagen", () => {
    const f = offeneFragen(stelle({ arbeitsmodell: "hybrid", remoteAnteil: null }));
    expect(f.map((x) => x.schluessel)).toContain("buerotage");
  });

  it("fragt bei bekanntem Remote-Anteil nicht mehr danach", () => {
    const f = offeneFragen(stelle({ arbeitsmodell: "hybrid", remoteAnteil: 60 }));
    expect(f.map((x) => x.schluessel)).not.toContain("buerotage");
  });

  it("behauptet nie, dass etwas schlecht sei", () => {
    /*
     * „Diese Anzeige nennt kein Gehalt" ist eine Tatsache. „Das
     * Gehalt ist wahrscheinlich schlecht" wäre eine Unterstellung
     * gegenüber einem Arbeitgeber, den wir nicht kennen.
     */
    for (const f of offeneFragen(stelle())) {
      expect(f.frage).not.toMatch(/schlecht|niedrig|unseriös|Vorsicht|wahrscheinlich/i);
      expect(f.frage).toMatch(/\?$/);
    }
  });

  it("bleibt bei höchstens vier Fragen", () => {
    expect(offeneFragen(stelle()).length).toBeLessThanOrEqual(4);
  });

  it("lässt bei einer vollständigen Anzeige nichts offen", () => {
    const f = offeneFragen(
      stelle({
        gehaltGenannt: true,
        gehaltMin: 38_000,
        gehaltMax: 42_000,
        wochenstunden: 40,
        schichtarbeit: false,
        arbeitsmodell: "on_site",
        vertragsform: "permanent",
      }),
    );
    expect(f).toHaveLength(0);
  });
});

describe("Vergleich", () => {
  const a = stelle({
    jobId: "a",
    titel: "Lagerhelfer",
    gehaltGenannt: true,
    gehaltMin: 36_000,
    entfernungKm: 12,
    vertragsform: "permanent",
    arbeitsmodell: "on_site",
  });
  const b = stelle({
    jobId: "b",
    titel: "Kommissionierer",
    gehaltGenannt: true,
    gehaltMin: 42_000,
    entfernungKm: 38,
    vertragsform: "fixed_term",
    arbeitsmodell: "on_site",
  });

  it("braucht mindestens zwei Stellen", () => {
    expect(vergleichBauen([a])).toBeNull();
    expect(vergleichBauen([])).toBeNull();
  });

  it("findet die Merkmale, in denen sie sich unterscheiden", () => {
    const v = vergleichBauen([a, b])!;
    expect(v.unterschiede).toContain("Gehalt");
    expect(v.unterschiede).toContain("Entfernung");
    expect(v.unterschiede).toContain("Vertrag");
    /* Beide vor Ort — kein Unterschied. */
    expect(v.unterschiede).not.toContain("Arbeitsmodell");
  });

  it("schreibt Vertragsarten in der Sprache der Person", () => {
    const v = vergleichBauen([a, b])!;
    const zeile = v.zeilen.find((z) => z.merkmal === "Vertrag")!;
    expect(zeile.werte).toEqual(["unbefristet", "befristet"]);
  });

  it("zeigt fehlende Angaben als Lücke, statt sie zu füllen", () => {
    /*
     * „Diese Anzeige sagt nichts zum Gehalt" ist beim Vergleich die
     * wichtigste Auskunft überhaupt: Sie ist der Grund, warum man die
     * eine nicht mit der anderen vergleichen kann.
     */
    const ohne = stelle({ jobId: "c", titel: "Dritte", gehaltGenannt: false });
    const v = vergleichBauen([a, ohne])!;
    const zeile = v.zeilen.find((z) => z.merkmal === "Gehalt")!;
    expect(zeile.werte[1]).toBeNull();
    expect(v.offen).toContain("Gehalt");
  });

  it("hält einen bekannten Wert gegen eine Lücke nicht für einen Unterschied", () => {
    const ohne = stelle({ jobId: "c", titel: "Dritte", gehaltGenannt: false });
    const v = vergleichBauen([a, ohne])!;
    expect(v.unterschiede).not.toContain("Gehalt");
  });
});
