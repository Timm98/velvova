import { describe, expect, it } from "vitest";
import { aufJahresbetrag, gehaltsanzeige } from "./gehaltsanzeige.ts";
import type { Job } from "@paycheck/domain";

/**
 * Woher eine Zahl stammt, entscheidet, was sie wert ist.
 *
 * „75.000 €" und „75.000 €" sehen gleich aus. Das eine hat ein
 * Arbeitgeber in seine Anzeige geschrieben, das andere hat ein Portal
 * aus Stellentitel und Region geschätzt. Wer mit der zweiten Zahl in
 * eine Verhandlung geht, verhandelt gegen etwas, das niemand zugesagt
 * hat.
 */

function gehalt(teil: Partial<Job["salary"]>): Job["salary"] {
  return {
    min: 60000,
    max: 80000,
    currency: "EUR",
    period: "year",
    disclosed: false,
    provenance: null,
    evidence: null,
    ...teil,
  } as Job["salary"];
}

describe("Die fünf Herkünfte", () => {
  it("nennt eine Arbeitgeberangabe beim Namen", () => {
    const a = gehaltsanzeige(gehalt({ provenance: "employer", disclosed: true }))!;
    expect(a.herkunft).toBe("arbeitgeber");
    expect(a.herkunftText).toMatch(/vom Arbeitgeber/);
    expect(a.zugesagt).toBe(true);
    expect(a.hervorheben).toBe(true);
  });

  it("behandelt eine Zahl aus dem Anzeigentext als Angabe, nicht als Schätzung", () => {
    /*
     * Den Text hat der Arbeitgeber geschrieben. Das ist etwas anderes
     * als eine Portalschätzung — und soll auch anders klingen.
     */
    const a = gehaltsanzeige(gehalt({ provenance: "text" }))!;
    expect(a.herkunft).toBe("anzeige");
    expect(a.zugesagt).toBe(true);
    // Aber nicht hervorgehoben: gelesen ist nicht dasselbe wie zugesagt.
    expect(a.hervorheben).toBe(false);
  });

  it("nennt eine Portalschätzung eine Schätzung", () => {
    const a = gehaltsanzeige(gehalt({ provenance: "board_estimate" }))!;
    expect(a.herkunft).toBe("schaetzung");
    expect(a.herkunftText).toMatch(/geschätzt/);
    expect(a.herkunftText).toMatch(/keine Zusage/);
    expect(a.zugesagt).toBe(false);
  });

  it("macht aus einer Portalangabe KEINE Arbeitgeberangabe", () => {
    /*
     * Der Fehler, den diese Prüfung festhält.
     *
     * Hier stand `salary.disclosed ? "arbeitgeber" : …`, und `disclosed`
     * wird gesetzt, sobald ein Anbieter ein Gehaltsfeld liefert. Damit
     * bekam jede Portalangabe das Etikett „vom Arbeitgeber angegeben" —
     * die stärkste Aussage über eine Zahl, vergeben an eine Zahl aus
     * zweiter Hand. Betroffen waren 27 von 190 Gehältern.
     */
    const a = gehaltsanzeige(gehalt({ provenance: "provider", disclosed: true }))!;
    expect(a.herkunft).toBe("portal");
    expect(a.herkunftText).not.toMatch(/Arbeitgeber/);
    expect(a.zugesagt).toBe(false);
    expect(a.hervorheben).toBe(false);
  });

  it("sagt bei unbekannter Herkunft, dass sie unbekannt ist", () => {
    const a = gehaltsanzeige(gehalt({ provenance: null }))!;
    expect(a.herkunft).toBe("unbekannt");
    expect(a.zugesagt).toBe(false);
  });
});

describe("Was in der Liste steht", () => {
  it("gibt zu jeder Herkunft eine Kurzform", () => {
    // Auf der Karte ist kein Platz für „vom Stellenportal geschätzt —
    // keine Zusage". Zwei Wörter müssen reichen.
    for (const p of ["employer", "text", "board_estimate", "provider", null] as const) {
      const a = gehaltsanzeige(gehalt({ provenance: p }))!;
      expect(a.herkunftKurz.length, String(p)).toBeGreaterThan(3);
      expect(a.herkunftKurz.length, String(p)).toBeLessThan(20);
    }
  });

  it("unterscheidet die Kurzformen voneinander", () => {
    const kurz = (["employer", "text", "board_estimate", "provider"] as const).map(
      (p) => gehaltsanzeige(gehalt({ provenance: p }))!.herkunftKurz,
    );
    expect(new Set(kurz).size).toBe(4);
  });
});

describe("Ohne Betrag keine Anzeige", () => {
  it("gibt null zurück, wenn nichts dasteht", () => {
    expect(gehaltsanzeige(gehalt({ min: null, max: null }))).toBeNull();
  });
});

describe("Umrechnung auf ein Jahr", () => {
  const lohn = (min: number | null, max: number | null, period: string) =>
    gehaltsanzeige({
      min,
      max,
      currency: "EUR",
      period,
      disclosed: true,
      provenance: "employer",
    } as never);

  it("lässt eine Jahresangabe unangetastet", () => {
    const a = lohn(68000, 82000, "year");
    expect(a?.betrag).toContain("68.000");
    expect(a?.umgerechnet).toBe(false);
    expect(a?.zeitraum).toBe("pro Jahr");
  });

  it("rechnet Monate mal zwölf", () => {
    const a = lohn(4200, null, "month");
    expect(a?.betrag).toContain("50.400");
    expect(a?.umgerechnet).toBe(true);
    expect(a?.urspruenglich).toBe("pro Monat");
  });

  it("rechnet Wochen mal zweiundfünfzig", () => {
    expect(lohn(1000, null, "week")?.betrag).toContain("52.000");
  });

  it("rechnet Stunden mit der dokumentierten Annahme", () => {
    /* 24 € × 1760 = 42.240 — 40 Stunden auf 44 Arbeitswochen. */
    expect(lohn(24, null, "hour")?.betrag).toContain("42.240");
  });

  it("rechnet Tage mit der dokumentierten Annahme", () => {
    /* 200 € × 220 Arbeitstage = 44.000. */
    expect(lohn(200, null, "day")?.betrag).toContain("44.000");
  });

  it("rechnet beide Enden einer Spanne", () => {
    const a = lohn(4000, 5000, "month");
    expect(a?.betrag).toContain("48.000");
    expect(a?.betrag).toContain("60.000");
  });

  it("sagt immer „pro Jahr“, egal was in der Anzeige stand", () => {
    for (const p of ["year", "month", "week", "day", "hour"]) {
      expect(lohn(1000, null, p)?.zeitraum).toBe("pro Jahr");
    }
  });

  it("markiert jede Umrechnung — sonst hielte man sie für die Angabe", () => {
    for (const p of ["month", "week", "day", "hour"]) {
      expect(lohn(1000, null, p)?.umgerechnet).toBe(true);
    }
  });
});

describe("aufJahresbetrag", () => {
  it("rechnet einen Stundenlohn hoch", () => {
    /*
     * Der Fall aus der Praxis: Eine Anzeige nennt 22 € pro Stunde, und
     * die Nettorechnung meldete „kein Jahresgehalt" — sie hatte eine
     * eigene Tabelle mit nur Jahr und Monat.
     */
    expect(aufJahresbetrag(22, "hour")).toBe(38_720);
  });

  it("rechnet Monat, Woche und Tag hoch", () => {
    expect(aufJahresbetrag(4000, "month")).toBe(48_000);
    expect(aufJahresbetrag(1000, "week")).toBe(52_000);
    expect(aufJahresbetrag(200, "day")).toBe(44_000);
  });

  it("lässt ein Jahresgehalt unverändert", () => {
    expect(aufJahresbetrag(55_000, "year")).toBe(55_000);
  });

  it("behandelt einen unbekannten Zeitraum als Jahr", () => {
    // Die Alternative wäre, die Angabe wegzuwerfen.
    expect(aufJahresbetrag(55_000, "quartal")).toBe(55_000);
  });

  it("gibt ohne Betrag nichts zurück", () => {
    expect(aufJahresbetrag(null, "hour")).toBeNull();
  });
});
