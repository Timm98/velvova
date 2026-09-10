import { describe, expect, it } from "vitest";
import {
  DEUTLICH_AB,
  MINDESTZAHL,
  einordnen,
  gehaltZaehlt,
  marktwert,
  stufeAusTitel,
} from "./marktwert.ts";

/**
 * Diese Zahl wird beim ersten Blick geprüft. Wer 68.000 verdient und
 * „dein Marktwert liegt bei 52.000" liest, glaubt dem Produkt nie
 * wieder etwas — auch die richtigen Sachen nicht. Deshalb prüfen die
 * meisten dieser Tests, wann geschwiegen wird.
 */

const zeilen = (...werte: number[]) => werte.map((w) => ({ von: w, bis: w }));

describe("gehaltZaehlt", () => {
  it("lässt die Schätzung eines Portals nicht durch", () => {
    /* Die wichtigste Zeile: 280.283 Angaben im Bestand sind
       `board_estimate`. Sie zu verwenden hiesse, eine fremde Vermutung
       als Messung auszugeben. */
    expect(gehaltZaehlt("board_estimate")).toBe(false);
  });

  it("nimmt an, was aus der Anzeige selbst stammt", () => {
    expect(gehaltZaehlt("employer")).toBe(true);
    expect(gehaltZaehlt("provider")).toBe(true);
    expect(gehaltZaehlt("text")).toBe(true);
  });

  it("lehnt Unbekanntes ab statt es durchzulassen", () => {
    expect(gehaltZaehlt(null)).toBe(false);
    expect(gehaltZaehlt(undefined)).toBe(false);
    expect(gehaltZaehlt("irgendwas_neues")).toBe(false);
  });
});

describe("stufeAusTitel", () => {
  it("erkennt die vier Stufen", () => {
    expect(stufeAusTitel("Senior Software Engineer")).toBe("senior");
    expect(stufeAusTitel("Junior Controller (m/w/d)")).toBe("einstieg");
    expect(stufeAusTitel("Teamleiter Logistik")).toBe("leitung");
    expect(stufeAusTitel("Werkstudent Marketing")).toBe("einstieg");
  });

  it("liest Leitung vor Senior", () => {
    /* „Senior Team Lead" ist eine Leitungsstelle. Die andere Lesart
       legte Führungsgehälter in die Seniorgruppe und hübe deren
       Median an — sichtbar als „Senior verdient plötzlich wie ein
       Abteilungsleiter". */
    expect(stufeAusTitel("Senior Team Lead Data")).toBe("leitung");
  });

  it("rät nicht, wenn der Titel nichts sagt", () => {
    /*
     * Der eigentliche Punkt dieser Funktion. In der Datenbank stehen
     * heute 63.209 „senior" und 360 „mid" — das beschreibt keinen
     * Arbeitsmarkt, sondern eine Erkennung, die alles Unklare einer
     * Stufe zuschlägt.
     */
    expect(stufeAusTitel("Software Engineer")).toBe("unbekannt");
    expect(stufeAusTitel("Sachbearbeiter Buchhaltung")).toBe("unbekannt");
    expect(stufeAusTitel("")).toBe("unbekannt");
    expect(stufeAusTitel(null)).toBe("unbekannt");
  });
});

describe("marktwert", () => {
  it("schweigt unter der Mindeststichprobe", () => {
    const w = marktwert(zeilen(50000, 60000, 70000));
    expect(w.art).toBe("zu_wenig");
    if (w.art === "zu_wenig") {
      expect(w.stellen).toBe(3);
      expect(w.benoetigt).toBe(MINDESTZAHL);
    }
  });

  it("nennt auch beim Schweigen, was da war", () => {
    /* „Zu wenig Daten" ohne Zahl ist keine Auskunft, sondern eine
       Ausrede. Wer 12 von 30 sieht, weiss, wie weit es fehlt. */
    const w = marktwert(zeilen(...Array.from({ length: 12 }, () => 50000)));
    expect(w.art === "zu_wenig" && w.stellen).toBe(12);
  });

  it("rechnet Median und Viertel aus genug Anzeigen", () => {
    const werte = Array.from({ length: 100 }, (_, i) => 40000 + i * 500);
    const w = marktwert(zeilen(...werte));
    expect(w.art).toBe("bekannt");
    if (w.art === "bekannt") {
      expect(w.median).toBe(64750);
      expect(w.p25).toBeLessThan(w.median);
      expect(w.p75).toBeGreaterThan(w.median);
      expect(w.stellen).toBe(100);
    }
  });

  it("nimmt die Mitte der Spanne, nicht die Untergrenze", () => {
    /* Die Untergrenze allein unterschätzt den Markt systematisch —
       sie ist der Betrag, den der Arbeitgeber nennt, nicht der, den
       er zahlt. */
    const w = marktwert(Array.from({ length: 40 }, () => ({ von: 60000, bis: 80000 })));
    expect(w.art === "bekannt" && w.median).toBe(70000);
  });

  it("lässt sich von einem Ausreisser nicht verschieben", () => {
    const normal = Array.from({ length: 49 }, () => 60000);
    const mit = marktwert(zeilen(...normal, 900000));
    expect(mit.art === "bekannt" && mit.median).toBe(60000);
  });

  it("wirft unbrauchbare Zeilen weg, statt sie als Null zu zählen", () => {
    const w = marktwert([...zeilen(...Array.from({ length: 40 }, () => 60000)), { von: 0, bis: 0 }]);
    expect(w.art === "bekannt" && w.stellen).toBe(40);
  });
});

describe("einordnen", () => {
  const gruppe = Array.from({ length: 100 }, (_, i) => 40000 + i * 500);
  const wert = marktwert(zeilen(...gruppe));

  it("schweigt ohne eigenes Gehalt", () => {
    expect(einordnen(null, wert).art).toBe("unbekannt");
    expect(einordnen(0, wert).art).toBe("unbekannt");
  });

  it("schweigt, wenn die Gruppe zu klein war", () => {
    expect(einordnen(60000, marktwert(zeilen(50000))).art).toBe("unbekannt");
  });

  it("ordnet ein und nennt den Abstand zum Median", () => {
    const l = einordnen(50000, wert, gruppe);
    expect(l.art).toBe("eingeordnet");
    if (l.art === "eingeordnet") {
      expect(l.perzentil).toBeGreaterThan(0);
      expect(l.perzentil).toBeLessThan(50);
      expect(l.zumMedian).toBeLessThan(0);
    }
  });

  it("nennt einen kleinen Abstand NICHT deutlich", () => {
    /*
     * Drei Prozent liegen innerhalb der Genauigkeit dieser Rechnung.
     * Sie als „du bist unterbezahlt" auszugeben, wäre eine Aussage
     * über Rauschen — mit der jemand in ein Gehaltsgespräch geht.
     */
    const knapp = Math.round(64750 * (1 - DEUTLICH_AB / 3));
    const l = einordnen(knapp, wert, gruppe);
    expect(l.art === "eingeordnet" && l.deutlich).toBe(false);
  });

  it("nennt einen grossen Abstand deutlich", () => {
    const klar = Math.round(64750 * (1 - DEUTLICH_AB * 2));
    const l = einordnen(klar, wert, gruppe);
    expect(l.art === "eingeordnet" && l.deutlich).toBe(true);
  });
});
