import { describe, expect, it } from "vitest";
import { type Bedingung, bedingungBewerten } from "./bedingungen.ts";
import { bezugStimmt, entscheidungsaenderung, type Pruefstand } from "./pruefstand.ts";

const stelleA: Pruefstand = {
  id: "check-1",
  stelleId: "stelle-a",
  fassung: "fassung-1",
  erstelltAm: new Date("2026-09-07T10:00:00Z"),
};

const wochenende: Bedingung = {
  schluessel: "freie-wochenenden",
  text: "Freie Wochenenden",
  rang: "muss",
  herkunft: "gesagt",
  bestaetigt: true,
};
const weg: Bedingung = {
  schluessel: "weg",
  text: "Kurzer Arbeitsweg",
  rang: "wunsch",
  herkunft: "gesagt",
  bestaetigt: true,
};

describe("Stellenbezug (Prüffall B08)", () => {
  it("erkennt eine Antwort zu A unter B", () => {
    /*
     * Der gefährlichste Fehler dieses Produkts: Die Antwort ist
     * inhaltlich richtig und steht am falschen Ort. Niemand merkt es,
     * weil beide Stellen plausibel klingen.
     */
    const stelleB: Pruefstand = { ...stelleA, id: "check-2", stelleId: "stelle-b" };
    expect(bezugStimmt(stelleA, stelleB)).toBe(false);
  });

  it("erkennt eine geänderte Anzeigenfassung", () => {
    const neuerText: Pruefstand = { ...stelleA, fassung: "fassung-2" };
    expect(bezugStimmt(stelleA, neuerText)).toBe(false);
  });

  it("lässt Stelle und Fassung zusammen gelten", () => {
    expect(bezugStimmt(stelleA, { ...stelleA, id: "andere-id" })).toBe(true);
  });
});

describe("Neue Auskunft ändert den Check (Prüffall B07)", () => {
  const vorher = [bedingungBewerten(wochenende, "unbekannt"), bedingungBewerten(weg, "erfuellt")];
  const nachher = [bedingungBewerten(wochenende, "verletzt"), bedingungBewerten(weg, "erfuellt")];
  const nachfolger: Pruefstand = { ...stelleA, id: "check-2" };

  const aenderung = entscheidungsaenderung(stelleA, nachfolger, vorher, nachher, {
    inhalt: "Zwei Samstagsdienste monatlich gehören zur Stelle.",
    herkunft: "telefonat",
    am: new Date("2026-09-07T14:00:00Z"),
    betrifftSchluessel: ["freie-wochenenden"],
  });

  it("ändert genau den betroffenen Punkt", () => {
    expect(aenderung.geaenderteSchluessel).toEqual(["freie-wochenenden"]);
    expect(aenderung.neueAusschluesse).toEqual(["freie-wochenenden"]);
  });

  it("löscht den Vorteil nicht", () => {
    /*
     * Der kürzere Arbeitsweg bleibt bestehen. Ihn wegen des Ausschlusses
     * aus dem Ergebnis zu nehmen, wäre dieselbe Verrechnung wie
     * umgekehrt, nur in die andere Richtung.
     */
    expect(aenderung.unveraendert).toEqual(["weg"]);
    expect(aenderung.satz).toContain("bleibt bestehen");
    expect(aenderung.satz).toContain("gleicht diesen Punkt aber nicht aus");
  });

  it("führt Herkunft und Zeitpunkt der Auskunft mit", () => {
    expect(aenderung.herkunft).toBe("telefonat");
    expect(aenderung.am.toISOString()).toBe("2026-09-07T14:00:00.000Z");
  });

  it("behauptet keine Änderung, wenn sich nichts ändert", () => {
    const gleich = entscheidungsaenderung(stelleA, nachfolger, vorher, vorher, {
      inhalt: "Der Parkplatz ist kostenlos.",
      herkunft: "mail",
      am: new Date("2026-09-07T15:00:00Z"),
      betrifftSchluessel: [],
    });
    expect(gleich.geaenderteSchluessel).toEqual([]);
    expect(gleich.satz).toContain("ändert an der Einschätzung nichts");
  });
});
