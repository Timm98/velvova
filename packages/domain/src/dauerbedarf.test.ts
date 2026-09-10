import { describe, expect, it } from "vitest";
import {
  FILIALGRENZE,
  MINDESTBEOBACHTUNG_TAGE,
  einstufen,
  istZeitarbeit,
  ton,
  type Anzeigenreihe,
} from "./dauerbedarf.ts";

const B = (teil: Partial<Anzeigenreihe> = {}): Anzeigenreihe => ({
  arbeitgeber: "Kreisklinik Musterstadt",
  beobachtungTage: 180,
  tageMitAnzeige: 20,
  luecken: 0,
  orteDesArbeitgebers: 1,
  ueblichP90Tage: 90,
  ...teil,
});

describe("Die Zeitgrenze", () => {
  it("stuft unter der Mindestbeobachtung nichts ein", () => {
    /*
     * Die härteste Grenze. Am 10.09.2026 reichte die eigene
     * Beobachtung elf Tage zurück — daraus lässt sich nichts sagen,
     * und „unklar" wäre schon zu viel.
     */
    const f = einstufen(B({ beobachtungTage: 11, tageMitAnzeige: 11 }));
    expect(f.einstufung).toBe("zu_frueh");
    expect(f.ansprechbar).toBe(false);
  });

  it("nennt, wie weit die Beobachtung ist", () => {
    expect(einstufen(B({ beobachtungTage: 11 })).belege.join(" ")).toContain("11");
  });

  it("stellt die Zeit über alles andere", () => {
    /* Auch ein perfektes Signal zählt nicht, wenn zu kurz beobachtet wurde. */
    const f = einstufen(B({ beobachtungTage: 30, tageMitAnzeige: 30, luecken: 5 }));
    expect(f.einstufung).toBe("zu_frueh");
  });

  it("lässt ab der Grenze einstufen", () => {
    expect(einstufen(B({ beobachtungTage: MINDESTBEOBACHTUNG_TAGE })).einstufung).not.toBe(
      "zu_frueh",
    );
  });
});

describe("Zeitarbeit", () => {
  it("erkennt die grössten Fälle im Bestand", () => {
    for (const name of [
      "Randstad Deutschland",
      "TimePartner Personalmanagement GmbH",
      "Adecco Germany",
      "Musterstadt Zeitarbeit GmbH",
      "ABC Personaldienstleistungen",
    ]) {
      expect(istZeitarbeit(name)).toBe(true);
    }
  });

  it("hält einen normalen Arbeitgeber nicht für Zeitarbeit", () => {
    for (const name of ["Kreisklinik Musterstadt", "Bäckerei Schmidt", "Stadtwerke Musterstadt"]) {
      expect(istZeitarbeit(name)).toBe(false);
    }
  });

  it("spricht Zeitarbeit nicht an, auch bei starkem Signal", () => {
    /*
     * „Sie suchen oft Lagerkräfte" wäre bei einer Zeitarbeitsfirma
     * keine Beobachtung, sondern eine Beschreibung ihres Geschäfts.
     */
    const f = einstufen(B({ arbeitgeber: "Randstad Deutschland", luecken: 4 }));
    expect(f.einstufung).toBe("zeitarbeit");
    expect(f.ansprechbar).toBe(false);
  });
});

describe("Filialnetz", () => {
  it("erkennt dieselbe Rolle an vielen Orten", () => {
    /*
     * Der eigentliche Befund der Messung: Netto stand mit 9.140
     * Anzeigen an der Spitze — jede in einer anderen Filiale.
     */
    const f = einstufen(B({ orteDesArbeitgebers: 340, luecken: 6 }));
    expect(f.einstufung).toBe("filialnetz");
    expect(f.ansprechbar).toBe(false);
    expect(f.belege.join(" ")).toContain("340");
  });

  it("hält drei Standorte nicht für ein Filialnetz", () => {
    expect(einstufen(B({ orteDesArbeitgebers: 3, luecken: 2 })).einstufung).toBe("wiederkehrer");
  });

  it("zieht die Grenze bei zehn", () => {
    expect(einstufen(B({ orteDesArbeitgebers: FILIALGRENZE, luecken: 2 })).einstufung).toBe(
      "filialnetz",
    );
    expect(
      einstufen(B({ orteDesArbeitgebers: FILIALGRENZE - 1, luecken: 2 })).einstufung,
    ).toBe("wiederkehrer");
  });
});

describe("Wiederkehrer und Dauerläufer", () => {
  it("erkennt eine Stelle, die besetzt und wieder frei wurde", () => {
    const f = einstufen(B({ luecken: 3, tageMitAnzeige: 60 }));
    expect(f.einstufung).toBe("wiederkehrer");
    expect(f.ansprechbar).toBe(true);
    expect(f.belege.join(" ")).toContain("3×");
  });

  it("erkennt eine Stelle, die nie besetzt wird", () => {
    const f = einstufen(B({ tageMitAnzeige: 120, ueblichP90Tage: 90 }));
    expect(f.einstufung).toBe("dauerlaeufer");
    expect(f.belege.join(" ")).toContain("120");
  });

  it("misst gegen den Beruf, nicht gegen eine feste Zahl", () => {
    /*
     * 108 Tage sind im Hoch- und Tiefbau der Normalfall und in der
     * Informatik ein Alarm. Eine absolute Grenze würde jede Baustelle
     * melden und jede IT-Stelle durchlassen.
     */
    expect(einstufen(B({ tageMitAnzeige: 100, ueblichP90Tage: 130 })).einstufung).toBe("einmalig");
    expect(einstufen(B({ tageMitAnzeige: 100, ueblichP90Tage: 40 })).einstufung).toBe(
      "dauerlaeufer",
    );
  });

  it("behauptet ohne Referenz nichts", () => {
    expect(einstufen(B({ tageMitAnzeige: 300, ueblichP90Tage: null })).einstufung).toBe("einmalig");
  });

  it("hält eine normal besetzte Stelle für keinen Anlass", () => {
    const f = einstufen(B({ tageMitAnzeige: 20, luecken: 0 }));
    expect(f.einstufung).toBe("einmalig");
    expect(f.ansprechbar).toBe(false);
    expect(f.belege).toEqual([]);
  });
});

describe("ton", () => {
  it("unterscheidet Angebotsproblem von Bindungsproblem", () => {
    /*
     * Wer eine Stelle nicht besetzt bekommt, hat ein Angebotsproblem.
     * Wer sie dreimal besetzt und dreimal verloren hat, ein
     * Bindungsproblem — und dem „wir haben viele Kandidaten" zu
     * schreiben, geht an seiner Lage vorbei.
     */
    expect(ton("dauerlaeufer")).toBe("angebot");
    expect(ton("wiederkehrer")).toBe("bindung");
  });

  it("gibt für nicht ansprechbare Fälle keinen Ton vor", () => {
    for (const e of ["zu_frueh", "zeitarbeit", "filialnetz", "einmalig"] as const) {
      expect(ton(e)).toBeNull();
    }
  });
});
