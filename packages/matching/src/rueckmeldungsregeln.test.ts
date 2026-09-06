import { describe, expect, it } from "vitest";
import {
  klaerungsfrage,
  KLAERUNG_AB,
  KLAERUNG_FENSTER_TAGE,
  ruhestand,
  RUHEND_NACH_TAGEN,
  type Ablehnung,
} from "./rueckmeldungsregeln.ts";

const JETZT = new Date("2026-09-06T10:00:00Z");

function ablehnung(grund: string | null, vorTagen = 1): Ablehnung {
  return { grund, erstelltAm: new Date(JETZT.getTime() - vorTagen * 86_400_000) };
}

describe("Klärungsfrage", () => {
  it("fragt erst ab drei gleichartigen Ablehnungen", () => {
    const zwei = [ablehnung("aufgaben"), ablehnung("aufgaben")];
    expect(klaerungsfrage(zwei, JETZT)).toBeNull();
    expect(klaerungsfrage([...zwei, ablehnung("aufgaben")], JETZT)?.grund).toBe("aufgaben");
  });

  it("zählt Ablehnungen ohne Grund nicht mit", () => {
    /*
     * „Nicht relevant" ohne Angabe heisst: diese Stelle nicht. Daraus
     * einen Berufswunsch abzuleiten wäre geraten.
     */
    const ohne = Array.from({ length: 5 }, () => ablehnung(null));
    expect(klaerungsfrage(ohne, JETZT)).toBeNull();
    const unbestimmt = Array.from({ length: 5 }, () => ablehnung("kein_interesse"));
    expect(klaerungsfrage(unbestimmt, JETZT)).toBeNull();
  });

  it("vergisst alte Ablehnungen", () => {
    const alt = Array.from({ length: KLAERUNG_AB }, () =>
      ablehnung("gehalt", KLAERUNG_FENSTER_TAGE + 5),
    );
    expect(klaerungsfrage(alt, JETZT)).toBeNull();
  });

  it("fragt nicht zweimal dasselbe", () => {
    const drei = Array.from({ length: 3 }, () => ablehnung("standort"));
    expect(klaerungsfrage(drei, JETZT, ["standort"])).toBeNull();
  });

  it("stellt die Frage offen, nicht suggestiv", () => {
    const drei = Array.from({ length: 3 }, () => ablehnung("aufgaben"));
    const frage = klaerungsfrage(drei, JETZT)!.frage;
    /* Kein „soll ich solche Stellen weglassen" — das legt die Antwort nahe. */
    expect(frage).not.toMatch(/soll ich/i);
    expect(frage).toContain("oder war es bei diesen Stellen so?");
  });

  it("ist bei Gleichstand deterministisch", () => {
    const gemischt = [
      ...Array.from({ length: 3 }, () => ablehnung("standort")),
      ...Array.from({ length: 3 }, () => ablehnung("gehalt")),
    ];
    const a = klaerungsfrage(gemischt, JETZT)!.grund;
    const b = klaerungsfrage([...gemischt].reverse(), JETZT)!.grund;
    expect(a).toBe(b);
  });
});

describe("Ruhestand", () => {
  it("meldet nach der Frist Ruhe an", () => {
    const alt = new Date(JETZT.getTime() - (RUHEND_NACH_TAGEN + 1) * 86_400_000);
    expect(ruhestand(alt, JETZT).ruhend).toBe(true);
  });

  it("lässt eine gerade noch aktive Person in Ruhe", () => {
    const frisch = new Date(JETZT.getTime() - (RUHEND_NACH_TAGEN - 1) * 86_400_000);
    expect(ruhestand(frisch, JETZT).ruhend).toBe(false);
  });

  it("deutet fehlende Aktivität nicht als Inaktivität", () => {
    /* Wer noch nie gemessen wurde, ist nicht inaktiv — er ist ungemessen. */
    expect(ruhestand(null, JETZT)).toEqual({ ruhend: false, tage: null });
  });
});
