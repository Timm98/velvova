import { describe, expect, it } from "vitest";
import { ecbLesen, umrechnen } from "./umrechnen.ts";

/*
 * Ein Ausschnitt der echten EZB-Datei vom 8. September 2026.
 *
 * Nicht geglättet: einfache Anführungszeichen, die Namensräume und die
 * Reihenfolge stehen so in der Antwort.
 */
const ECB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01">
  <Cube>
    <Cube time='2026-09-07'>
      <Cube currency='USD' rate='1.1622'/>
      <Cube currency='JPY' rate='179.85'/>
      <Cube currency='CZK' rate='24.197'/>
      <Cube currency='GBP' rate='0.85894'/>
      <Cube currency='CHF' rate='0.9312'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe("die EZB-Datei lesen", () => {
  it("liest Stand und Kurse", () => {
    const { stand, kurse } = ecbLesen(ECB_XML);
    expect(stand).toBe("2026-09-07");
    expect(kurse.USD).toBe(1.1622);
    expect(kurse.CHF).toBe(0.9312);
    expect(kurse.JPY).toBe(179.85);
  });

  it("setzt den Euro selbst auf eins", () => {
    /* Er steht nicht in der Datei — er IST die Basis. Ohne diese Zeile
       müsste jede Umrechnung den Sonderfall kennen. */
    expect(ecbLesen(ECB_XML).kurse.EUR).toBe(1);
  });

  it("überlebt eine kaputte Zeile", () => {
    const kaputt = ECB_XML.replace("rate='179.85'", "rate='nicht-zahl'");
    const { kurse } = ecbLesen(kaputt);
    expect(kurse.JPY).toBeUndefined();
    /* Die übrigen bleiben — eine kaputte Zeile darf nicht den ganzen
       Abruf verlieren. */
    expect(kurse.USD).toBe(1.1622);
    expect(kurse.CHF).toBe(0.9312);
  });

  it("gibt bei Unsinn nichts zurück, statt zu raten", () => {
    const { stand, kurse } = ecbLesen("<html>Wartungsarbeiten</html>");
    expect(stand).toBeNull();
    expect(Object.keys(kurse)).toHaveLength(0);
  });
});

describe("umrechnen", () => {
  const kurse = { EUR: 1, USD: 1.1622, CHF: 0.9312, JPY: 179.85 };

  it("rechnet ein Zürcher Gehalt in Euro", () => {
    /* 95.000 CHF bei 0,9312 CHF je Euro sind rund 102.020 €. */
    const eur = umrechnen(95_000, "CHF", "EUR", kurse);
    expect(Math.round(eur!)).toBe(102_019);
  });

  it("rechnet in beide Richtungen dasselbe", () => {
    const hin = umrechnen(50_000, "EUR", "USD", kurse)!;
    const zurueck = umrechnen(hin, "USD", "EUR", kurse)!;
    expect(Math.round(zurueck)).toBe(50_000);
  });

  it("rechnet über den Euro, auch wenn keiner der beiden Euro ist", () => {
    /* CHF → USD: 0,9312 CHF sind ein Euro, ein Euro sind 1,1622 USD. */
    const usd = umrechnen(9_312, "CHF", "USD", kurse)!;
    expect(Math.round(usd)).toBe(11_622);
  });

  it("lässt dieselbe Währung unangetastet", () => {
    expect(umrechnen(1234.56, "EUR", "eur", kurse)).toBe(1234.56);
  });

  it("gibt null zurück, wenn ein Kurs fehlt", () => {
    /*
     * ARS und UAH veröffentlicht die EZB nicht. Den Betrag dann
     * unverändert zurückzugeben und als umgerechnet auszugeben wäre
     * die schlimmste Antwort: Sie sieht aus wie ein Ergebnis.
     */
    expect(umrechnen(1_000_000, "ARS", "EUR", kurse)).toBeNull();
    expect(umrechnen(1_000, "EUR", "UAH", kurse)).toBeNull();
  });

  it("gibt null zurück bei einer unbrauchbaren Zahl", () => {
    expect(umrechnen(Number.NaN, "CHF", "EUR", kurse)).toBeNull();
  });
});
