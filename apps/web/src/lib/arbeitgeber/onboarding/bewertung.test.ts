import { describe, expect, it } from "vitest";
import { bewerte, etappen, zusammenfassung, type Angabe } from "./bewertung.ts";
import { felderFuer } from "./felder.ts";

/**
 * Die Bewertung der Onboarding-Angaben.
 *
 * Geprüft wird vor allem, wo eine Prozentzahl lügen würde — das ist
 * der Fall, für den die Rechnung überhaupt kompliziert ist.
 */

function angabe(
  bereich: string,
  feld: string,
  wert: unknown,
  status: Angabe["status"] = "bestaetigt",
  quelle: Angabe["quelle"] = "gespraech",
): Angabe {
  return { bereich, feld, wert, quelle, quelleDetail: null, konfidenz: 100, status };
}

/** Alle zwingenden Felder eines Ergebnisses, bestätigt. */
function alleZwingend(ergebnis: Parameters<typeof felderFuer>[0]): Angabe[] {
  return felderFuer(ergebnis)
    .filter((f) => f.zwingend)
    .map((f) => angabe(f.bereich, f.feld, f.art === "liste" ? ["x"] : "x"));
}

describe("Vollständigkeit", () => {
  it("ist null ohne Angaben", () => {
    expect(bewerte("anzeige", []).prozent).toBe(0);
  });

  it("bleibt unter 100, solange eine zwingende Angabe fehlt", () => {
    /*
     * Der Fall, für den der Deckel existiert: Alles ausgefüllt bis auf
     * die Gehaltsspanne. Ohne Deckel stünde dort 97 % — und 97 liest
     * sich als „fast fertig", nicht als „geht so nicht online".
     */
    const felder = felderFuer("anzeige");
    const ohneGehalt = felder
      .filter((f) => !(f.bereich === "gehalt" && f.feld === "spanne"))
      .map((f) => angabe(f.bereich, f.feld, "x"));

    const stand = bewerte("anzeige", ohneGehalt);
    expect(stand.prozent).toBeLessThanOrEqual(95);
    expect(stand.bereit).toBe(false);
    expect(stand.fehlendZwingend.map((f) => f.feld)).toContain("spanne");
  });

  it("erreicht 100 nur mit allen Feldern bestätigt", () => {
    const alle = felderFuer("bewerbung").map((f) => angabe(f.bereich, f.feld, "x"));
    const stand = bewerte("bewerbung", alle);
    expect(stand.prozent).toBe(100);
    expect(stand.bereit).toBe(true);
  });

  it("zählt gefundene Angaben nur halb", () => {
    /*
     * Was Monday auf einer Website gefunden hat, ist eine Vermutung mit
     * Fundstelle. Voll gezählt sähe ein Profil vollständig aus, das
     * niemand gelesen hat.
     */
    const felder = felderFuer("bewerbung");
    const bestaetigt = felder.map((f) => angabe(f.bereich, f.feld, "x", "bestaetigt"));
    const gefunden = felder.map((f) => angabe(f.bereich, f.feld, "x", "gefunden", "website"));

    expect(bewerte("bewerbung", bestaetigt).prozent).toBe(100);
    expect(bewerte("bewerbung", gefunden).prozent).toBe(50);
  });

  it("zählt „unklar“ gar nicht", () => {
    const felder = felderFuer("bewerbung");
    const unklar = felder.map((f) => angabe(f.bereich, f.feld, "x", "unklar"));
    expect(bewerte("bewerbung", unklar).prozent).toBe(0);
  });

  it("behandelt „nicht angegeben“ als fehlend", () => {
    /* Es ist eine Aussage — „danach wurde gefragt" —, aber keine
       Angabe. Für die Vollständigkeit zählt sie wie eine Lücke. */
    const stand = bewerte("anzeige", [angabe("gehalt", "spanne", null, "nicht_angegeben")]);
    expect(stand.fehlendZwingend.map((f) => f.feld)).toContain("spanne");
  });

  it("behandelt leere Listen als fehlend", () => {
    const stand = bewerte("anzeige", [angabe("aufgaben", "haupt", [])]);
    expect(stand.fehlendZwingend.map((f) => f.feld)).toContain("haupt");
  });
});

describe("Warnungen", () => {
  it("erkennt Leerformeln im Text", () => {
    const stand = bewerte("anzeige", [
      angabe("stelle", "ziel", "Wir bieten ein attraktives Gehalt und flache Hierarchien."),
    ]);
    const texte = stand.warnungen.filter((w) => w.art === "leerformel").map((w) => w.text);
    expect(texte.join(" ")).toContain("attraktives Gehalt");
    expect(texte.join(" ")).toContain("flache Hierarchien");
  });

  it("nennt unbestätigte Fundstellen gesammelt, nicht einzeln", () => {
    const felder = felderFuer("bewerbung");
    const gefunden = felder.map((f) => angabe(f.bereich, f.feld, "x", "gefunden", "website"));
    const w = bewerte("bewerbung", gefunden).warnungen.filter((x) => x.art === "unbestaetigt");
    expect(w).toHaveLength(1);
    expect(w[0]!.text).toContain("von eurer Website");
  });

  it("meldet nichts Unbestätigtes, wenn alles bestätigt ist", () => {
    const alle = felderFuer("bewerbung").map((f) => angabe(f.bereich, f.feld, "x"));
    expect(bewerte("bewerbung", alle).warnungen.filter((w) => w.art === "unbestaetigt")).toHaveLength(0);
  });
});

describe("Zusammenfassung", () => {
  it("nennt Zahlen statt Adjektiven", () => {
    const s = zusammenfassung([
      angabe("unternehmen", "name", "Nordwind"),
      angabe("unternehmen", "branche", "Beratung", "gefunden", "website"),
      angabe("gehalt", "spanne", "unklar", "unklar"),
    ]);
    expect(s).toContain("3 Angaben übernommen");
    expect(s).toContain("1 Information von eurer Website");
    expect(s).toContain("1 offene Frage");
  });

  it("zählt „nicht angegeben“ nicht als übernommen", () => {
    const s = zusammenfassung([
      angabe("unternehmen", "name", "Nordwind"),
      angabe("gehalt", "spanne", null, "nicht_angegeben"),
    ]);
    expect(s).toContain("1 Angabe übernommen");
  });
});

describe("Etappen", () => {
  it("beginnt mit keiner erreichten Etappe", () => {
    expect(etappen([]).every((e) => !e.erreicht)).toBe(true);
  });

  it("erkennt „Unternehmen verstanden“", () => {
    const e = etappen([
      angabe("unternehmen", "beschreibung", "Wir beraten Mittelständler."),
      angabe("unternehmen", "branche", "Beratung"),
      angabe("unternehmen", "hauptsitz", "Karlsruhe"),
    ]);
    expect(e.find((x) => x.id === "unternehmen")?.erreicht).toBe(true);
    expect(e.find((x) => x.id === "stelle")?.erreicht).toBe(false);
  });

  it("ist erst bereit, wenn Anzeige und Matching es sind", () => {
    const alle = [...alleZwingend("anzeige"), ...alleZwingend("matching")];
    /* Dubletten sind hier egal: `bewerte` schlägt über eine Map nach. */
    expect(etappen(alle).find((x) => x.id === "bereit")?.erreicht).toBe(true);
  });
});
