import { describe, expect, it } from "vitest";
import { freigabenstand, NIEMALS, STUFEN } from "./freigaben";

const a = (feld: string, wert: unknown) => ({ bereich: "freigaben", feld, wert });

describe("freigabenstand", () => {
  it("nimmt ohne Auswahl die vorsichtigste Stufe", () => {
    const s = freigabenstand([]);
    expect(s.stufe).toBe("nur_vorschlagen");
    expect(s.kontakt).toBe("immer_einzeln");
  });

  it("hält eine Vorbelegung nicht für eine Entscheidung", () => {
    expect(freigabenstand([]).vollstaendig).toBe(false);
    expect(freigabenstand([a("stufe", "nach_freigabe")]).vollstaendig).toBe(false);
    expect(
      freigabenstand([a("stufe", "nach_freigabe"), a("kontaktFreigabe", "immer_einzeln")])
        .vollstaendig,
    ).toBe(true);
  });

  it("fällt bei einem unbekannten Wert auf die vorsichtige Stufe zurück", () => {
    expect(freigabenstand([a("stufe", "alles_erlaubt")]).stufe).toBe("nur_vorschlagen");
  });

  it("erlaubt beim Vorschlagen kein Ansprechen", () => {
    const s = freigabenstand([a("stufe", "nur_vorschlagen")]);
    expect(s.darf.some((d) => d.includes("Anfrage") || d.includes("bitten"))).toBe(false);
  });

  it("nennt das Ansprechen erst ab der passenden Stufe", () => {
    expect(freigabenstand([a("stufe", "selbst_ansprechen")]).darf.some((d) => d.includes("bitten")))
      .toBe(true);
  });

  it("nennt das Öffnen des Kontakts nur bei der passenden Regel", () => {
    expect(
      freigabenstand([a("kontaktFreigabe", "immer_einzeln")]).darf.some((d) => d.includes("Kontakt öffnen")),
    ).toBe(false);
    expect(
      freigabenstand([a("kontaktFreigabe", "ab_gegenseitig")]).darf.some((d) => d.includes("Kontakt öffnen")),
    ).toBe(true);
  });

  it("lässt die Sperren von keiner Einstellung berühren", () => {
    for (const s of STUFEN) {
      for (const k of ["immer_einzeln", "ab_gegenseitig"]) {
        const stand = freigabenstand([a("stufe", s.wert), a("kontaktFreigabe", k)]);
        expect(stand.niemals).toEqual(NIEMALS);
      }
    }
  });
});
