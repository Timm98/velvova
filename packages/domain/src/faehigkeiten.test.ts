import { describe, expect, it } from "vitest";
import {
  STUFEN,
  abgleichbar,
  anforderungAbgleichen,
  ausBeleg,
  deckung,
  istBedingung,
  istLeerformel,
  stufeGrenze,
  stufenrang,
  type Beleg,
  type Faehigkeitsaussage,
} from "./faehigkeiten.ts";

const KATALOG: Record<string, string> = {
  "erfahrung in der dienstplanung": "dienstplanung",
  "sicher im umgang mit sap": "sap",
  "praxisanleitung": "praxisanleitung",
};
const schluesselFuer = (t: string) => KATALOG[t.toLowerCase().trim()] ?? null;

const F = (teil: Partial<Faehigkeitsaussage> = {}): Faehigkeitsaussage => ({
  schluessel: "dienstplanung",
  stufe: "sicher",
  belegtDurch: ["b1"],
  herkunft: "nutzer_aussage",
  ...teil,
});

describe("Was keine Fähigkeit ist", () => {
  it("erkennt Arbeitsbedingungen", () => {
    /*
     * Die häufigste Anforderungszeile im Bestand ist „Bereitschaft zur
     * Schichtarbeit" — 10.696 Mal. Sie beantwortet „will ich das",
     * nicht „kann ich das", und dafür gibt es ein Muss-Kriterium.
     */
    for (const t of [
      "Bereitschaft zur Schichtarbeit",
      "Bereitschaft zum Schichtdienst",
      "Wochenendarbeit",
      "Reisebereitschaft",
      "hohe Flexibilität",
    ]) {
      expect(istBedingung(t), t).toBe(true);
      expect(abgleichbar(t), t).toBe(false);
    }
  });

  it("erkennt Leerformeln", () => {
    for (const t of ["teamfähig", "sehr zuverlässige Arbeitsweise", "eigenverantwortliches Handeln"]) {
      expect(istLeerformel(t), t).toBe(true);
    }
  });

  it("lässt echte Anforderungen durch", () => {
    for (const t of ["Erfahrung in der Dienstplanung", "Sicher im Umgang mit SAP", "Praxisanleitung"]) {
      expect(abgleichbar(t), t).toBe(true);
    }
  });
});

describe("Was eine Belegart tragen kann", () => {
  it("lässt ein Zertifikat nicht bis „anleitend“ reichen", () => {
    /*
     * Es belegt eine bestandene Prüfung, nicht dass jemand die Sache
     * im Alltag anleitet. Genau das will ein Arbeitgeber im Gespräch
     * herausfinden.
     */
    expect(stufeGrenze("zertifikat")).toBe("sicher");
    expect(stufenrang(stufeGrenze("zertifikat"))).toBeLessThan(stufenrang("anleitend"));
  });

  it("lässt eine Arbeitsprobe weiter tragen als eine Aussage", () => {
    expect(stufenrang(stufeGrenze("arbeitsprobe"))).toBeGreaterThan(
      stufenrang(stufeGrenze("nutzer_aussage")),
    );
  });

  it("lässt auch eine Arbeitsprobe nicht bis „anleitend“", () => {
    /* Andere anzuleiten ist eine andere Tätigkeit als es selbst zu können. */
    expect(stufeGrenze("arbeitsprobe")).not.toBe("anleitend");
  });
});

describe("ausBeleg", () => {
  const B = (teil: Partial<Beleg> = {}): Beleg => ({
    id: "b1",
    aussage: "Ich habe zwei Jahre die Dienstpläne der Station geschrieben",
    herkunft: "nutzer_aussage",
    bestaetigt: true,
    ...teil,
  });

  it("erzeugt keine Fähigkeit aus einem unbestätigten Beleg", () => {
    expect(ausBeleg(B({ bestaetigt: false }), "dienstplanung", "sicher")).toBeNull();
  });

  it("erzeugt keine Fähigkeit aus einer Bedingung", () => {
    expect(ausBeleg(B({ aussage: "Bereitschaft zur Schichtarbeit" }), "x", "sicher")).toBeNull();
  });

  it("deckelt die Stufe auf das, was die Belegart trägt", () => {
    const f = ausBeleg(B(), "dienstplanung", "anleitend");
    expect(f?.stufe).toBe("sicher");
  });

  it("trägt den Beleg immer mit", () => {
    /* Eine Fähigkeit ohne Beleg entsteht nicht. */
    const f = ausBeleg(B(), "dienstplanung", "sicher");
    expect(f?.belegtDurch).toEqual(["b1"]);
    expect(f?.belegtDurch.length).toBeGreaterThan(0);
  });
});

describe("anforderungAbgleichen", () => {
  it("erfüllt, wenn die belegte Stufe reicht", () => {
    const e = anforderungAbgleichen(
      "Erfahrung in der Dienstplanung",
      "sicher",
      [F({ stufe: "routiniert" })],
      schluesselFuer,
    );
    expect(e.stand).toBe("erfuellt");
    expect(e.belege).toEqual(["b1"]);
  });

  it("ist teilweise, wenn die Stufe nicht reicht", () => {
    const e = anforderungAbgleichen(
      "Erfahrung in der Dienstplanung",
      "anleitend",
      [F({ stufe: "sicher" })],
      schluesselFuer,
    );
    expect(e.stand).toBe("teilweise");
  });

  it("sagt „nicht belegt“, nicht „kann er nicht“", () => {
    /*
     * Ein fehlender Beleg ist keine fehlende Fähigkeit. Das Wort
     * entscheidet darüber, ob jemand eine Stelle überspringt, die er
     * könnte — und in dieser Richtung ist der Fehler teurer.
     */
    const e = anforderungAbgleichen("Sicher im Umgang mit SAP", "sicher", [F()], schluesselFuer);
    expect(e.stand).toBe("nicht_belegt");
    expect(e.satz).toContain("nicht, dass du es nicht kannst");
  });

  it("hält sich bei Bedingungen für nicht zuständig", () => {
    const e = anforderungAbgleichen("Bereitschaft zur Schichtarbeit", "sicher", [F()], schluesselFuer);
    expect(e.stand).toBe("nicht_zustaendig");
    expect(e.satz).toContain("Arbeitsbedingung");
  });

  it("erfindet keinen Katalogeintrag", () => {
    const e = anforderungAbgleichen("Erfahrung mit Quantenkryptografie", "sicher", [F()], schluesselFuer);
    expect(e.stand).toBe("nicht_zustaendig");
    expect(e.schluessel).toBeNull();
  });

  it("nimmt die weiteste belegte Stufe", () => {
    const e = anforderungAbgleichen(
      "Erfahrung in der Dienstplanung",
      "routiniert",
      [F({ stufe: "grundkenntnisse" }), F({ stufe: "routiniert", belegtDurch: ["b2"] })],
      schluesselFuer,
    );
    expect(e.stand).toBe("erfuellt");
  });
});

describe("deckung", () => {
  it("zählt Bedingungen weder oben noch unten mit", () => {
    /*
     * Sonst sähe eine Anzeige, die zehnmal „Bereitschaft zur
     * Schichtarbeit" schreibt, aus wie eine, für die man nichts kann.
     */
    const ergebnisse = [
      anforderungAbgleichen("Erfahrung in der Dienstplanung", "sicher", [F()], schluesselFuer),
      anforderungAbgleichen("Bereitschaft zur Schichtarbeit", "sicher", [F()], schluesselFuer),
      anforderungAbgleichen("Bereitschaft zum Schichtdienst", "sicher", [F()], schluesselFuer),
    ];
    const d = deckung(ergebnisse);
    expect(d.gerechnet).toBe(1);
    expect(d.erfuellt).toBe(1);
  });

  it("bleibt bei null gerechneten Zeilen ohne Aussage", () => {
    const d = deckung([
      anforderungAbgleichen("Bereitschaft zur Schichtarbeit", "sicher", [], schluesselFuer),
    ]);
    expect(d.gerechnet).toBe(0);
  });
});

describe("Die Stufen", () => {
  it("sind vier und ohne Zahl", () => {
    expect(STUFEN).toHaveLength(4);
    for (const s of STUFEN) expect(s).not.toMatch(/\d/);
  });
});
