import { describe, expect, it } from "vitest";
import {
  VERWERTUNG,
  darfSkillTragen,
  eigenerBeitragErkennbar,
  fehlerquote,
  istOrientierungsprobe,
  type Kategoriezaehlung,
} from "./belegarten.ts";

describe("Welche Belegart eine Fähigkeit tragen darf", () => {
  it("lässt Fähigkeit, Wissen, Werkzeug und Qualifikation durch", () => {
    for (const a of ["skill", "knowledge", "tool", "qualification"] as const) {
      expect(darfSkillTragen(a)).toBe(true);
    }
  });

  it("lässt Vorliebe, Motiv und Arbeitsumgebung nicht durch", () => {
    for (const a of ["preference", "motive", "work_environment", "constraint"] as const) {
      expect(darfSkillTragen(a)).toBe(false);
    }
  });

  it("macht aus einer Rollenbezeichnung keine Fähigkeit", () => {
    /*
     * „Disponent" heisst nicht, dass jemand LKW-Disposition belegt hat.
     * Der Beruf ist Kontext, kein Nachweis.
     */
    expect(darfSkillTragen("role")).toBe(false);
    expect(darfSkillTragen("occupation")).toBe(false);
    expect(VERWERTUNG.role).toBe("kontext");
  });

  it("macht aus einer Erfahrungsepisode keinen Beleg für sich", () => {
    expect(darfSkillTragen("experience_episode")).toBe(false);
    expect(VERWERTUNG.experience_episode).toBe("quelle_fuer_extraktion");
  });

  it("lässt ein Ergebnis nur bedingt durch", () => {
    expect(darfSkillTragen("result")).toBe(true);
    expect(VERWERTUNG.result).toBe("nur_mit_beitrag");
  });
});

describe("Der eigene Anteil an einem Ergebnis", () => {
  it("erkennt die erste Person", () => {
    expect(eigenerBeitragErkennbar("Ich habe die Tourenplanung umgestellt.")).toBe(true);
    expect(eigenerBeitragErkennbar("Eigenverantwortlich die Inventur geleitet.")).toBe(true);
  });

  it("weist die Wir-Form ab", () => {
    expect(eigenerBeitragErkennbar("Wir haben die Durchlaufzeit halbiert.")).toBe(false);
    expect(eigenerBeitragErkennbar("Unser Team hat die Quote verbessert.")).toBe(false);
  });

  it("weist eine Aussage ohne Zuschreibung ab", () => {
    expect(eigenerBeitragErkennbar("Die Durchlaufzeit sank um 20 Prozent.")).toBe(false);
  });
});

describe("Die Fehlerquote steht über dem richtigen Nenner", () => {
  const z = (teil: Partial<Kategoriezaehlung> & { art: Kategoriezaehlung["art"] }): Kategoriezaehlung => ({
    weg: VERWERTUNG[teil.art],
    gesamt: 0,
    uebernommen: 0,
    bewusstNicht: 0,
    nichtZugeordnet: 0,
    ...teil,
  });

  it("zählt bewusst nicht Überführte nicht mit", () => {
    /*
     * Der gemessene Fall: 142 Belege, 29 durften, 28 kamen durch. Über
     * allen 142 gerechnet wären das 20 Prozent — eine Zahl, die die
     * Zusammensetzung des Bestands beschreibt und Fehlerquote heisst.
     */
    const q = fehlerquote([
      z({ art: "skill", gesamt: 22, uebernommen: 21, nichtZugeordnet: 1 }),
      z({ art: "qualification", gesamt: 7, uebernommen: 7 }),
      z({ art: "preference", gesamt: 45, bewusstNicht: 45 }),
      z({ art: "motive", gesamt: 18, bewusstNicht: 18 }),
    ]);
    expect(q.nenner).toBe(29);
    expect(q.uebernommen).toBe(28);
    expect(q.quote).toBeCloseTo(0.9655, 3);
  });

  it("sagt nichts, wenn nichts durfte", () => {
    expect(fehlerquote([z({ art: "preference", gesamt: 45, bewusstNicht: 45 })]).quote).toBeNull();
  });
});

describe("Die Orientierungsprobe tritt nicht an", () => {
  it("erkennt sie am Herkunftsverweis", () => {
    expect(istOrientierungsprobe("probe:1f0a-…")).toBe(true);
    expect(istOrientierungsprobe("abnahme:7c2")).toBe(false);
    expect(istOrientierungsprobe(null)).toBe(false);
  });
});
