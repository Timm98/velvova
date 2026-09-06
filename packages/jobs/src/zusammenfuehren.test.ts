import { describe, expect, it } from "vitest";
import type { RawListing } from "./adapter.ts";
import {
  fuehreZusammen,
  normFirma,
  normOrt,
  normTitel,
  normUrl,
  type QuellListing,
} from "./zusammenfuehren.ts";

/**
 * Eine Stelle, mehrere Anbieter — und zwei Fehlerrichtungen.
 *
 *   **Zu wenig zusammenführen.** Dieselbe Stelle steht dreimal in der
 *   Liste. Sichtbar, ärgerlich, und der Person entgeht, dass es
 *   dieselbe ist.
 *
 *   **Zu viel zusammenführen.** Zwei verschiedene Stellen verschmelzen
 *   zu einer. Eine davon verschwindet lautlos — und was niemand sieht,
 *   kann niemand vermissen. Das ist die teurere Richtung, und deshalb
 *   stehen hier mehr Prüfungen dafür.
 */

function anzeige(p: Partial<RawListing> = {}): RawListing {
  return {
    externalId: "1",
    title: "Sachbearbeiter Kundenbetreuung (m/w/d)",
    companyName: "Muster GmbH",
    location: "76133 Karlsruhe, Baden-Württemberg",
    description: "Eine hinreichend lange Beschreibung der Stelle mit genug Text für die Prüfung.",
    ...p,
  };
}

function quelle(provider: string, p: Partial<RawListing> = {}, extra: Partial<QuellListing> = {}): QuellListing {
  return { provider, herkunft: "aggregator", listing: anzeige(p), ...extra };
}

describe("Zusammenführen", () => {
  it("erkennt dieselbe Stelle am Bewerbungslink", () => {
    const ergebnis = fuehreZusammen([
      quelle("theirstack", { externalId: "a", originalUrl: "https://firma.de/jobs/42" }),
      quelle("jsearch", { externalId: "b", originalUrl: "https://www.firma.de/jobs/42?utm_source=x" }),
    ]);
    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0]!.quellen).toHaveLength(2);
    expect(ergebnis[0]!.erkanntUeber).toBe("bewerbungslink");
  });

  it("erkennt sie trotz verschiedener Geschlechtszusätze", () => {
    // Derselbe Titel, je Anbieter anders geschrieben. Ohne diese
    // Bereinigung führt praktisch nichts zusammen.
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", title: "Sachbearbeiter Kundenbetreuung (m/w/d)" }),
      quelle("b", { externalId: "2", title: "Sachbearbeiter Kundenbetreuung (all genders)" }),
      quelle("c", { externalId: "3", title: "Sachbearbeiter Kundenbetreuung w/m/x" }),
    ]);
    expect(ergebnis).toHaveLength(1);
  });

  it("erkennt sie trotz verschieden geschriebener Firmennamen", () => {
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", companyName: "Muster GmbH" }),
      quelle("b", { externalId: "2", companyName: "Muster Deutschland GmbH" }),
    ]);
    expect(ergebnis).toHaveLength(1);
  });

  it("erkennt sie trotz verschieden ausführlicher Ortsangaben", () => {
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", location: "76133 Karlsruhe, Baden-Württemberg, Deutschland" }),
      quelle("b", { externalId: "2", location: "Karlsruhe" }),
    ]);
    expect(ergebnis).toHaveLength(1);
  });
});

describe("Nicht zusammenführen", () => {
  it("hält dieselbe Rolle an zwei Orten auseinander", () => {
    /*
     * Der teure Fall. Zwei Sachbearbeitungsstellen desselben Konzerns
     * in Karlsruhe und Stuttgart haben fast denselben Text. Wer sie
     * verschmilzt, lässt eine echte Stelle verschwinden.
     */
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", location: "Karlsruhe" }),
      quelle("b", { externalId: "2", location: "Stuttgart" }),
    ]);
    expect(ergebnis).toHaveLength(2);
  });

  it("hält verschiedene Rollen am selben Ort auseinander", () => {
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", title: "Sachbearbeiter Kundenbetreuung" }),
      quelle("b", { externalId: "2", title: "Teamleitung Kundenbetreuung" }),
    ]);
    expect(ergebnis).toHaveLength(2);
  });

  it("hält verschiedene Arbeitgeber auseinander", () => {
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", companyName: "Muster GmbH" }),
      quelle("b", { externalId: "2", companyName: "Beispiel GmbH" }),
    ]);
    expect(ergebnis).toHaveLength(2);
  });
});

describe("Was beim Zusammenführen erhalten bleibt", () => {
  it("behält jede Quelle, statt sie wegzuwerfen", () => {
    const ergebnis = fuehreZusammen([
      quelle("theirstack", { externalId: "a", originalUrl: "https://firma.de/j/1" }),
      quelle("jsearch", { externalId: "b", originalUrl: "https://firma.de/j/1" }),
      quelle("adzuna", { externalId: "c", originalUrl: "https://firma.de/j/1" }),
    ]);
    expect(ergebnis[0]!.quellen.map((q) => q.provider)).toEqual(["theirstack", "jsearch", "adzuna"]);
  });

  it("nimmt die Herkunft, die dem Arbeitgeber am nächsten ist", () => {
    /*
     * Der praktische Gewinn der Zusammenführung: taucht dieselbe
     * Stelle bei einer Sammelstelle UND auf der Karriereseite auf,
     * verlinken wir die Karriereseite.
     */
    const ergebnis = fuehreZusammen([
      quelle("jsearch", { externalId: "a", originalUrl: "https://firma.de/j/1" }, { herkunft: "aggregator" }),
      quelle("greenhouse", { externalId: "b", originalUrl: "https://firma.de/j/1" }, { herkunft: "ats" }),
    ]);
    expect(ergebnis[0]!.herkunft).toBe("ats");
  });

  it("ergänzt ein fehlendes Gehalt aus der zweiten Quelle", () => {
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", originalUrl: "https://firma.de/j/1" }),
      quelle("b", { externalId: "2", originalUrl: "https://firma.de/j/1", salaryMin: 45000, salaryMax: 52000 }),
    ]);
    expect(ergebnis[0]!.listing.salaryMin).toBe(45000);
  });

  it("überschreibt ein vorhandenes Gehalt NICHT", () => {
    /*
     * Zwei Quellen mit verschiedenen Zahlen sind ein Widerspruch. Ihn
     * zugunsten der zuletzt eingetroffenen aufzulösen hiesse: das
     * Ergebnis hängt an der Netzlaufzeit. Eine harte Bedingung darf
     * nicht davon abhängen, welcher Anbieter schneller war.
     */
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", originalUrl: "https://firma.de/j/1", salaryMin: 45000 }),
      quelle("b", { externalId: "2", originalUrl: "https://firma.de/j/1", salaryMin: 60000 }),
    ]);
    expect(ergebnis[0]!.listing.salaryMin).toBe(45000);
  });

  it("nimmt die längere Beschreibung", () => {
    const lang = "x".repeat(500);
    const ergebnis = fuehreZusammen([
      quelle("a", { externalId: "1", originalUrl: "https://firma.de/j/1", description: "kurz aber lang genug für die Prüfung hier" }),
      quelle("b", { externalId: "2", originalUrl: "https://firma.de/j/1", description: lang }),
    ]);
    expect(ergebnis[0]!.listing.description).toBe(lang);
  });
});

describe("Normalisierung", () => {
  it("entfernt Kampagnenparameter, aber nicht den Pfad", () => {
    expect(normUrl("https://www.firma.de/jobs/42?utm_source=x&id=7")).toBe("firma.de/jobs/42?id=7");
  });

  it("gibt bei unbrauchbaren Adressen nichts zurück", () => {
    // Sonst würde „kaputt" zum Schlüssel, unter dem alles Kaputte
    // zusammenfällt.
    expect(normUrl("keine url")).toBeNull();
    expect(normUrl(null)).toBeNull();
  });

  it("lässt vom Firmennamen etwas übrig", () => {
    expect(normFirma("Muster Deutschland GmbH")).toBe("muster");
    expect(normTitel("Sachbearbeiter (m/w/d)")).toBe("sachbearbeiter");
    expect(normOrt("76133 Karlsruhe, Baden-Württemberg")).toBe("karlsruhe");
  });
});

describe("Mehrere Ausschreibungen desselben Arbeitgebers", () => {
  /**
   * Der Fall, den die synthetische Messung sichtbar gemacht hat.
   *
   * 500 Sätze fielen auf einen zusammen. Bei echten Daten fiel es nicht
   * auf, weil dort Titel und Orte genug streuen — aber ein Callcenter
   * mit fünf offenen Stellen „Kundenberater (m/w/d)" in Karlsruhe ist
   * kein konstruierter Fall.
   *
   * Vier verschwundene Stellen sieht niemand: eine kürzere Liste sieht
   * aus wie eine vollständige.
   */
  it("führt fünf verschiedene Ausschreibungen desselben Anbieters nicht zusammen", () => {
    /*
     * Verschiedene Texte — also verschiedene Stellen. Sie
     * zusammenzuführen liesse vier echte Ausschreibungen verschwinden,
     * und eine kürzere Liste sieht aus wie eine vollständige.
     */
    const eingang = [1, 2, 3, 4, 5].map((i) => ({
      provider: "theirstack",
      herkunft: "aggregator" as const,
      listing: anzeige({
        externalId: `t${i}`,
        originalUrl: `https://muster.de/jobs/${i}`,
        description:
          `Ausschreibung ${i}. ` +
          `Betreuung der Region ${i} mit eigenem Kundenstamm und Verantwortung für Gebiet ${i}. ` +
          `Schwerpunkt liegt auf ${["Neukunden", "Bestandskunden", "Grosskunden", "Handel", "Industrie"][i - 1]}. ` +
          `Erwartet werden Erfahrung, Sorgfalt und Freude an Zusammenarbeit im Team vor Ort.`,
      }),
    }));
    expect(fuehreZusammen(eingang)).toHaveLength(5);
  });

  it("führt eine Wiederholung desselben Anbieters zusammen", () => {
    /*
     * Der Gegenfall, an echten Daten beobachtet: Speechify stellt
     * dieselbe Stelle zweimal bei Arbeitnow ein — „Munich" und
     * „Munich, Bavaria, Germany", zwei Kennungen, fast gleicher Text.
     * Getrennt gelassen steht sie zweimal in der Liste.
     */
    const text =
      "Wir suchen eine erfahrene Person für die Entwicklung unserer Desktop-Anwendungen. " +
      "Du arbeitest eng mit Produkt und Design zusammen, verantwortest Architekturentscheidungen " +
      "und begleitest neue Kolleginnen und Kollegen bei der Einarbeitung in unsere Systeme.";
    const eingang = [
      { provider: "arbeitnow", herkunft: "aggregator" as const,
        listing: anzeige({ externalId: "a1", location: "Munich", originalUrl: "https://x.de/1", description: text }) },
      { provider: "arbeitnow", herkunft: "aggregator" as const,
        listing: anzeige({ externalId: "a2", location: "Munich, Bavaria, Germany", originalUrl: "https://x.de/2",
          description: text + " Zusätzlich bieten wir flexible Arbeitszeiten." }) },
    ];
    expect(fuehreZusammen(eingang)).toHaveLength(1);
  });

  it("urteilt bei sehr kurzen Texten nicht", () => {
    /*
     * Bei einer Handvoll Wörter schwankt die Überschneidung so stark,
     * dass jede Schwelle Zufall wäre. Dann lieber getrennt lassen:
     * eine doppelte Zeile ist sichtbar, eine verschwundene Stelle nicht.
     */
    const eingang = [1, 2].map((i) => ({
      provider: "arbeitnow",
      herkunft: "aggregator" as const,
      listing: anzeige({ externalId: `k${i}`, originalUrl: `https://x.de/${i}`, description: "Kurze Anzeige ohne viel Text." }),
    }));
    expect(fuehreZusammen(eingang)).toHaveLength(2);
  });

  it("führt dieselbe Stelle über Anbietergrenzen weiterhin zusammen", () => {
    /*
     * Die Gegenprobe. Wäre die Regel „gleicher Titel, gleicher
     * Arbeitgeber, gleicher Ort → nie zusammenführen", gäbe es
     * überhaupt keine anbieterübergreifende Entdopplung mehr — und
     * genau dafür ist sie da.
     */
    const eingang = [
      { provider: "theirstack", herkunft: "aggregator" as const, listing: anzeige({ externalId: "t1", originalUrl: "https://muster.de/jobs/7" }) },
      { provider: "jsearch", herkunft: "aggregator" as const, listing: anzeige({ externalId: "j1", originalUrl: "https://portal.de/anzeige/99" }) },
    ];
    expect(fuehreZusammen(eingang)).toHaveLength(1);
  });

  it("führt beim selben Anbieter zusammen, wenn der Bewerbungslink derselbe ist", () => {
    // Zweimal dieselbe Adresse ist zweimal dieselbe Stelle — auch
    // innerhalb eines Anbieters.
    const eingang = [1, 2].map((i) => ({
      provider: "theirstack",
      herkunft: "aggregator" as const,
      listing: anzeige({ externalId: `t${i}`, originalUrl: "https://muster.de/jobs/7" }),
    }));
    expect(fuehreZusammen(eingang)).toHaveLength(1);
  });
});
