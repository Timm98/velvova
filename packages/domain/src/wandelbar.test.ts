import { describe, expect, it } from "vitest";
import {
  MAX_FRAGEN,
  WANDELBARKEIT,
  frageText,
  fragenZusammenstellen,
  hindernisse,
  lageText,
  lohntAnfrage,
  wandelbarkeit,
  type Kriterienbefund,
} from "./wandelbar.ts";

const BEFUND = (teil: Partial<Kriterienbefund> & { kriterium: string }): Kriterienbefund => ({
  staerke: "muss",
  status: "nicht_erfuellt",
  begruendung: "",
  beleg: null,
  ...teil,
});

describe("wandelbarkeit", () => {
  it("hält eine Berufszulassung für unantastbar", () => {
    /*
     * Eine Zulassung erteilt der Staat. Einen Arbeitgeber danach zu
     * fragen wäre eine Aufforderung zum Rechtsbruch.
     */
    expect(wandelbarkeit("lizenz")).toBe("unantastbar");
  });

  it("gibt dem Menschen seine eigenen Bedingungen zurück", () => {
    /* Einen Arbeitgeber zu fragen, ob er den Arbeitsweg verkürzt, ist Unsinn. */
    for (const k of ["arbeitsort", "umkreis", "pendelzeit", "arbeitgeber_ausschluss"]) {
      expect(wandelbarkeit(k)).toBe("eigene_bedingung");
    }
  });

  it("erkennt, was der Arbeitgeber selbst gesetzt hat", () => {
    for (const k of ["wochenstunden", "arbeitsmodell", "schichtarbeit", "befristung"]) {
      expect(wandelbarkeit(k)).toBe("arbeitgeberfrage");
    }
  });

  it("hält ein unbekanntes Kriterium für unantastbar", () => {
    /*
     * Lieber eine Möglichkeit übersehen als eine Frage stellen, deren
     * Wirkung niemand bedacht hat.
     */
    expect(wandelbarkeit("irgendetwas_neues")).toBe("unantastbar");
  });

  it("ordnet jedes bekannte Kriterium einer der drei Arten zu", () => {
    const arten = new Set(Object.values(WANDELBARKEIT));
    expect(arten).toEqual(new Set(["arbeitgeberfrage", "eigene_bedingung", "unantastbar"]));
  });
});

describe("hindernisse", () => {
  it("zählt nur verletzte Muss-Kriterien", () => {
    const h = hindernisse([
      BEFUND({ kriterium: "wochenstunden" }),
      BEFUND({ kriterium: "arbeitsmodell", staerke: "wunsch" }),
      BEFUND({ kriterium: "befristung", status: "erfuellt" }),
    ]);
    expect(h.map((x) => x.kriterium)).toEqual(["wochenstunden"]);
  });

  it("macht aus einer unbekannten Angabe kein Hindernis", () => {
    /*
     * Eine unbekannte Muss-Angabe ist weder erfüllt noch verletzt. Sie
     * zu einer Frage zu machen hiesse, den Arbeitgeber nach etwas zu
     * fragen, das vielleicht längst in seiner Anzeige steht.
     */
    expect(hindernisse([BEFUND({ kriterium: "wochenstunden", status: "unbekannt" })])).toEqual([]);
  });
});

describe("lohntAnfrage", () => {
  it("nennt zuerst das Unantastbare", () => {
    const lage = lohntAnfrage(
      hindernisse([BEFUND({ kriterium: "wochenstunden" }), BEFUND({ kriterium: "lizenz" })]),
    );
    expect(lage.art).toBe("unantastbar");
  });

  it("gibt eigene Bedingungen zurück, statt eine Anfrage anzubieten", () => {
    const lage = lohntAnfrage(
      hindernisse([BEFUND({ kriterium: "wochenstunden" }), BEFUND({ kriterium: "pendelzeit" })]),
    );
    expect(lage.art).toBe("eigene_sache");
  });

  it("stellt höchstens drei Fragen", () => {
    const lage = lohntAnfrage(
      hindernisse([
        BEFUND({ kriterium: "wochenstunden" }),
        BEFUND({ kriterium: "arbeitsmodell" }),
        BEFUND({ kriterium: "schichtarbeit" }),
        BEFUND({ kriterium: "befristung" }),
      ]),
    );
    expect(lage.art).toBe("zu_viele");
  });

  it("lohnt bei einer einzelnen Bedingung des Arbeitgebers", () => {
    const lage = lohntAnfrage(hindernisse([BEFUND({ kriterium: "wochenstunden" })]));
    expect(lage.art).toBe("lohnt");
    if (lage.art === "lohnt") expect(lage.fragen).toHaveLength(1);
  });

  it("sagt bei freier Bahn, dass es nichts zu verhandeln gibt", () => {
    expect(lohntAnfrage([]).art).toBe("keine_hindernisse");
  });
});

describe("frageText", () => {
  it("fragt nicht nach dem Gehalt", () => {
    /*
     * „Ginge auch mehr?" vor dem ersten Gespräch ist keine Bedingung,
     * sondern eine Verhandlung — und eine, die man verliert, bevor
     * jemand weiss, mit wem er es zu tun hat.
     */
    expect(frageText("mindestgehalt")).toBeNull();
  });

  it("erfindet zu unbekannten Kriterien keine Frage", () => {
    expect(frageText("lizenz")).toBeNull();
    expect(frageText("irgendetwas")).toBeNull();
  });

  it("stellt jede Frage als Möglichkeit, nicht als Forderung", () => {
    for (const k of ["wochenstunden", "arbeitsmodell", "schichtarbeit", "befristung"]) {
      const t = frageText(k);
      expect(t).not.toBeNull();
      expect(t).toMatch(/\?$/);
      /* Keine Person darin — die Anfrage geht anonymisiert hinaus. */
      expect(t!.toLowerCase()).not.toMatch(/\b(ich|mein|meine|bewerber)\b/);
    }
  });
});

describe("fragenZusammenstellen", () => {
  it("lässt Hindernisse ohne Fragetext weg, statt etwas zu erfinden", () => {
    const lage = lohntAnfrage(
      hindernisse([BEFUND({ kriterium: "wochenstunden" }), BEFUND({ kriterium: "mindestgehalt" })]),
    );
    expect(fragenZusammenstellen(lage)).toEqual([
      "Wäre diese Stelle grundsätzlich auch in Teilzeit denkbar?",
    ]);
  });

  it("gibt nichts zurück, wenn keine Anfrage lohnt", () => {
    expect(fragenZusammenstellen({ art: "keine_hindernisse" })).toEqual([]);
    expect(fragenZusammenstellen({ art: "unantastbar", kriterium: "lizenz" })).toEqual([]);
  });

  it("überschreitet die Höchstzahl nie", () => {
    const lage = lohntAnfrage(
      hindernisse([
        BEFUND({ kriterium: "wochenstunden" }),
        BEFUND({ kriterium: "arbeitsmodell" }),
        BEFUND({ kriterium: "schichtarbeit" }),
      ]),
    );
    expect(fragenZusammenstellen(lage).length).toBeLessThanOrEqual(MAX_FRAGEN);
  });
});

describe("lageText", () => {
  it("erklärt bei einer Zulassung, warum niemand helfen kann", () => {
    const text = lageText({ art: "unantastbar", kriterium: "lizenz" });
    expect(text).toContain("Zulassung");
  });

  it("gibt bei eigenen Bedingungen die Entscheidung zurück", () => {
    const text = lageText({ art: "eigene_sache", kriterien: ["pendelzeit"] });
    expect(text).toContain("Nur du");
  });

  it("sagt bei zu vielen Bedingungen die Zahl", () => {
    expect(lageText({ art: "zu_viele", anzahl: 5 })).toContain("5");
  });
});
