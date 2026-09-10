import { describe, expect, it } from "vitest";
import {
  AEHNLICH_AB,
  firmennameNormalisieren,
  nameIstEindeutig,
  titelAehnlichkeit,
  waechterPruefen,
  type Anzeige,
  type Arbeitsplatz,
} from "./waechter.ts";

/**
 * Ein falscher Alarm wiegt hier schwerer als anderswo. Wer wegen einer
 * falsch zugeordneten Anzeige eine Nacht wachliegt, schaltet den
 * Wächter ab und erzählt es weiter.
 *
 * Deshalb prüfen die meisten dieser Tests, wann NICHT gewarnt wird.
 */

const anzeige = (p: Partial<Anzeige> = {}): Anzeige => ({
  jobId: "j1",
  titel: "Bilanzbuchhalter (m/w/d)",
  firma: "Meier Logistik GmbH",
  gesehenAm: new Date("2026-09-10T08:00:00Z"),
  ...p,
});

const platz = (p: Partial<Arbeitsplatz> = {}): Arbeitsplatz => ({
  firma: "Meier Logistik GmbH",
  position: "Bilanzbuchhalter",
  ...p,
});

describe("firmennameNormalisieren", () => {
  it("zieht Rechtsformen ab, aber keine Namensteile", () => {
    expect(firmennameNormalisieren("Meier Logistik GmbH")).toBe("meier logistik");
    expect(firmennameNormalisieren("MEIER LOGISTIK G.m.b.H.")).toContain("meier logistik");
  });

  it("hält verschiedene Firmen verschieden", () => {
    /* „Schmidt Logistik" und „Schmidt Bau" zusammenzuziehen wäre
       genau der Fehler, der einen falschen Alarm auslöst. */
    expect(firmennameNormalisieren("Schmidt Logistik GmbH")).not.toBe(
      firmennameNormalisieren("Schmidt Bau GmbH"),
    );
  });
});

describe("nameIstEindeutig", () => {
  it("hält einen kurzen Einzelnamen für zu unspezifisch", () => {
    /* „Müller GmbH" gibt es hundertmal. */
    expect(nameIstEindeutig(firmennameNormalisieren("Müller GmbH"))).toBe(false);
    expect(nameIstEindeutig(firmennameNormalisieren("Bauer AG"))).toBe(false);
  });

  it("nimmt zwei Wörter an", () => {
    expect(nameIstEindeutig(firmennameNormalisieren("Meier Logistik GmbH"))).toBe(true);
  });

  it("nimmt einen langen oder ziffernhaltigen Einzelnamen an", () => {
    expect(nameIstEindeutig(firmennameNormalisieren("Continental AG"))).toBe(true);
    expect(nameIstEindeutig(firmennameNormalisieren("Web24 GmbH"))).toBe(true);
  });
});

describe("titelAehnlichkeit", () => {
  it("erkennt dieselbe Position trotz Zusätzen", () => {
    expect(titelAehnlichkeit("Bilanzbuchhalter", "Bilanzbuchhalter (m/w/d) Vollzeit")).toBe(1);
  });

  it("trennt verwandte, aber andere Positionen", () => {
    /* Zeichenweise liegen die nah beieinander — inhaltlich nicht. */
    expect(titelAehnlichkeit("Bilanzbuchhalter", "Lohnbuchhalter")).toBeLessThan(AEHNLICH_AB);
    expect(titelAehnlichkeit("Vertriebsleiter Nord", "Vertriebsmitarbeiter Innendienst")).toBeLessThan(AEHNLICH_AB);
  });

  it("liest den genaueren Titel als dieselbe Stelle", () => {
    expect(titelAehnlichkeit("Buchhalter", "Buchhalter Kreditoren")).toBeGreaterThanOrEqual(AEHNLICH_AB);
  });

  it("gibt ohne Inhalt keine Ähnlichkeit", () => {
    expect(titelAehnlichkeit("", "Buchhalter")).toBe(0);
    expect(titelAehnlichkeit(null, null)).toBe(0);
    /* Nur Füllwörter sind kein Titel. */
    expect(titelAehnlichkeit("(m/w/d) Vollzeit", "Buchhalter")).toBe(0);
  });
});

describe("waechterPruefen", () => {
  it("warnt bei der eigenen Position beim eigenen Arbeitgeber", () => {
    const b = waechterPruefen(platz(), anzeige());
    expect(b.art).toBe("warnung");
    if (b.art === "warnung") {
      expect(b.jobId).toBe("j1");
      expect(b.aehnlichkeit).toBeGreaterThanOrEqual(AEHNLICH_AB);
    }
  });

  it("schweigt bei einer anderen Firma", () => {
    const b = waechterPruefen(platz(), anzeige({ firma: "Schmidt Logistik GmbH" }));
    expect(b).toEqual({ art: "still", grund: "andere_firma" });
  });

  it("schweigt bei einer Tochtergesellschaft", () => {
    /*
     * „Bosch" und „Bosch Rexroth" sind verschiedene Arbeitgeber. Ein
     * Wächter, der sie verwechselt, warnt jemanden vor der
     * Umstrukturierung einer Firma, für die er nicht arbeitet.
     */
    const b = waechterPruefen(platz({ firma: "Bosch GmbH" }), anzeige({ firma: "Bosch Rexroth GmbH" }));
    expect(b.art).toBe("still");
  });

  it("schweigt bei einer anderen Position derselben Firma", () => {
    const b = waechterPruefen(platz(), anzeige({ titel: "Lagerarbeiter (m/w/d)" }));
    expect(b).toEqual({ art: "still", grund: "andere_position" });
  });

  it("schweigt bei einem Allerweltsnamen", () => {
    const b = waechterPruefen(platz({ firma: "Müller GmbH" }), anzeige({ firma: "Müller GmbH" }));
    expect(b).toEqual({ art: "still", grund: "firmenname_zu_unspezifisch" });
  });

  it("schweigt, wenn das Profil den Arbeitgeber nicht kennt", () => {
    expect(waechterPruefen(platz({ firma: null }), anzeige())).toEqual({
      art: "still",
      grund: "kein_arbeitgeber_im_profil",
    });
    expect(waechterPruefen(platz({ firma: "   " }), anzeige())).toEqual({
      art: "still",
      grund: "kein_arbeitgeber_im_profil",
    });
  });

  it("schweigt, wenn das Profil die Position nicht kennt", () => {
    expect(waechterPruefen(platz({ position: null }), anzeige())).toEqual({
      art: "still",
      grund: "keine_position_im_profil",
    });
  });

  it("nennt bei jedem Schweigen einen Grund", () => {
    /* Ein Wächter, dessen Schweigen niemand erklären kann, ist nicht
       zu belegen — und dann glaubt ihm auch das Warnen niemand. */
    const faelle: [Arbeitsplatz, Anzeige][] = [
      [platz({ firma: null }), anzeige()],
      [platz({ position: null }), anzeige()],
      [platz({ firma: "Müller GmbH" }), anzeige({ firma: "Müller GmbH" })],
      [platz(), anzeige({ firma: "Andere Firma GmbH" })],
      [platz(), anzeige({ titel: "Pförtner" })],
    ];
    for (const [p, a] of faelle) {
      const b = waechterPruefen(p, a);
      expect(b.art).toBe("still");
      if (b.art === "still") expect(b.grund).toBeTruthy();
    }
  });
});
