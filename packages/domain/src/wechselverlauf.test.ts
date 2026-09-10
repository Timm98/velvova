import { describe, expect, it } from "vitest";
import {
  ANGENOMMENE_MARKEN,
  MARKEN,
  ereignisFuerMarke,
  checkInLabel,
  kontextFehlt,
  kontextFortschreiben,
  kontextLesen,
  markeAngenommen,
  markeText,
  zufriedenheitsSpalte,
  LEER,
} from "./wechselverlauf.ts";

describe("Marken", () => {
  it("misst über das erste Jahr hinaus", () => {
    /*
     * Der eigentliche Befund. Wer nur bis 180 misst, misst den Anstieg
     * der Zufriedenheit nach einem Wechsel — nicht den Abfall danach.
     */
    expect(MARKEN).toContain(365);
    expect(MARKEN).toContain(1095);
  });

  it("lässt keine Marke im Flitterwochen-Hoch als späteste stehen", () => {
    expect(Math.max(...MARKEN)).toBeGreaterThan(365);
  });

  it("nimmt früher geplante Marken weiter an", () => {
    /*
     * 60 und 180 werden nicht mehr geplant. Erinnerungen dazu liegen in
     * der Datenbank, und wer eine davon beantwortet, darf seine Antwort
     * nicht auf eine andere Marke gebucht bekommen.
     */
    expect(markeAngenommen(180)).toBe(true);
    expect(markeAngenommen(60)).toBe(true);
    for (const m of MARKEN) expect(markeAngenommen(m)).toBe(true);
    expect(markeAngenommen(45)).toBe(false);
  });

  it("hält angenommene und geplante Marken deckungsgleich", () => {
    for (const m of MARKEN) expect(ANGENOMMENE_MARKEN).toContain(m);
  });
});

describe("markeText", () => {
  it("rechnet lange Marken in Jahre um", () => {
    /* „nach 1095 Tagen" rechnet niemand um. */
    expect(markeText(1095)).toBe("drei Jahren");
    expect(markeText(365)).toBe("einem Jahr");
  });

  it("nennt kurze Marken in Tagen und mittlere in Monaten", () => {
    expect(markeText(30)).toBe("30 Tagen");
    expect(markeText(90)).toBe("3 Monaten");
    expect(markeText(180)).toBe("6 Monaten");
  });

  it("baut aus jeder Marke einen lesbaren Satz", () => {
    for (const m of ANGENOMMENE_MARKEN) {
      expect(checkInLabel(m)).not.toMatch(/\d{3,} Tagen/);
    }
  });
});

describe("ereignisFuerMarke", () => {
  it("benennt die neuen Marken eigenständig", () => {
    expect(ereignisFuerMarke(365)).toBe("fit_check_365");
    expect(ereignisFuerMarke(1095)).toBe("fit_check_1095");
  });

  it("rundet nach unten auf die erreichte Stufe", () => {
    /*
     * Eine Antwort auf die 60-Tage-Erinnerung ist ein
     * Dreissig-Tage-Befund, kein Neunzig-Tage-Befund. Nach oben zu
     * runden hiesse, eine Aussage weiter zu tragen, als sie reicht.
     */
    expect(ereignisFuerMarke(30)).toBe("fit_check_30");
    expect(ereignisFuerMarke(60)).toBe("fit_check_60");
    expect(ereignisFuerMarke(89)).toBe("fit_check_60");
    expect(ereignisFuerMarke(364)).toBe("fit_check_180");
    expect(ereignisFuerMarke(1094)).toBe("fit_check_365");
  });
});

describe("zufriedenheitsSpalte", () => {
  it("trifft für jede Marke genau eine Spalte", () => {
    expect(zufriedenheitsSpalte(30)).toBe("zufriedenheit30");
    expect(zufriedenheitsSpalte(90)).toBe("zufriedenheit90");
    expect(zufriedenheitsSpalte(180)).toBe("zufriedenheit180");
    expect(zufriedenheitsSpalte(365)).toBe("zufriedenheit365");
    expect(zufriedenheitsSpalte(1095)).toBe("zufriedenheit1095");
  });

  it("schreibt einen Drei-Jahres-Wert nicht in die 180-Tage-Spalte", () => {
    expect(zufriedenheitsSpalte(1095)).not.toBe("zufriedenheit180");
  });
});

describe("kontextLesen", () => {
  it("nimmt an, was gültig ist", () => {
    const k = kontextLesen({
      wechselgrund: "betrieblich",
      berufsnaehe: "neuer_beruf",
      ausbildungspassung: "ueberqualifiziert",
    });
    expect(k.wechselgrund).toBe("betrieblich");
    expect(k.berufsnaehe).toBe("neuer_beruf");
    expect(k.ausbildungspassung).toBe("ueberqualifiziert");
  });

  it("verwirft still, was es nicht ist", () => {
    /*
     * Die Zahl ist das Wichtige, der Kontext das Zusätzliche. Ein
     * unbekannter Wert aus einem Formular darf keinen Check-in
     * verhindern.
     */
    const k = kontextLesen({ wechselgrund: "irgendwas", berufsnaehe: "" });
    expect(k.wechselgrund).toBeNull();
    expect(k.berufsnaehe).toBeNull();
    expect(k.ausbildungspassung).toBeNull();
  });

  it("macht aus einer fehlenden Angabe keinen Ersatzwert", () => {
    /* `null` heisst „nicht gesagt" — nicht „passend", nicht „freiwillig". */
    expect(kontextLesen({})).toEqual(LEER);
    expect(kontextFehlt(kontextLesen({}))).toBe(true);
  });
});

describe("kontextFortschreiben", () => {
  it("behält, was schon bekannt war", () => {
    const alt = kontextLesen({ wechselgrund: "freiwillig", berufsnaehe: "gleicher_beruf" });
    const neu = kontextFortschreiben(alt, kontextLesen({}));
    expect(neu.wechselgrund).toBe("freiwillig");
    expect(neu.berufsnaehe).toBe("gleicher_beruf");
  });

  it("lässt eine spätere Angabe die frühere ersetzen", () => {
    const alt = kontextLesen({ berufsnaehe: "gleicher_beruf" });
    const neu = kontextFortschreiben(alt, kontextLesen({ berufsnaehe: "neuer_beruf" }));
    expect(neu.berufsnaehe).toBe("neuer_beruf");
  });

  it("ist nicht mehr leer, sobald eine Angabe steht", () => {
    expect(kontextFehlt(kontextFortschreiben(LEER, kontextLesen({ berufsnaehe: "nachbarberuf" })))).toBe(
      false,
    );
  });
});
