import { describe, expect, it } from "vitest";
import {
  besteHerkunft,
  herkunftAusArt,
  herkunftText,
  HerkunftSchema,
  istArbeitgeberquelle,
  linkText,
  linkTextMitZiel,
  zielName,
  type Herkunft,
} from "./herkunft.ts";

/**
 * Der Link darf nie mehr versprechen, als die Herkunft hergibt.
 *
 * Das ist die eine Regel. Alles hier prüft sie aus verschiedenen
 * Richtungen — vor allem die unangenehme: dass kein Aggregator als
 * Original durchgeht.
 */

const ALLE = HerkunftSchema.options as Herkunft[];

describe("Beschriftung", () => {
  it("nennt kein Aggregatorziel „Original“ oder „Arbeitgeber“", () => {
    for (const h of ["aggregator", "external_api", "licensed_partner"] as const) {
      const t = linkText(h, "Arbeitnow");
      expect(t, h).not.toMatch(/original/i);
      expect(t, h).not.toMatch(/arbeitgeber/i);
    }
  });

  it("nennt beim Aggregator das Ziel beim Namen", () => {
    // „Zur Quelle" wäre nicht falsch, aber nutzlos: die Person soll
    // vorher wissen, auf welcher Seite sie gleich steht.
    expect(linkText("aggregator", "Arbeitnow")).toBe("Weiter zu Arbeitnow");
  });

  it("verspricht die Arbeitgeberseite nur, wo sie es ist", () => {
    for (const h of ALLE) {
      const verspricht = /arbeitgeber/i.test(linkText(h, "Irgendwer"));
      expect(verspricht, h).toBe(istArbeitgeberquelle(h));
    }
  });

  it("kommt ohne Quellennamen aus", () => {
    // Kennen wir den Namen nicht, darf da nicht „Weiter zu null" stehen.
    for (const h of ALLE) {
      const t = linkText(h, null);
      expect(t.length, h).toBeGreaterThan(0);
      expect(t, h).not.toMatch(/null|undefined/);
    }
  });
});

describe("Erklärtext", () => {
  it("sagt beim Aggregator ausdrücklich, dass er nicht der Arbeitgeber ist", () => {
    const t = herkunftText("aggregator", "Jooble");
    expect(t).toMatch(/nicht der Arbeitgeber/i);
  });

  it("behauptet nie, die ursprüngliche Quelle zu kennen, wenn wir sie nicht kennen", () => {
    expect(herkunftText("aggregator", "Jooble")).toMatch(/wissen wir nicht/i);
  });
});

describe("Rangfolge", () => {
  it("zieht den Arbeitgeber jeder Sammelstelle vor", () => {
    expect(besteHerkunft(["aggregator", "employer_direct"])).toBe("employer_direct");
    expect(besteHerkunft(["aggregator", "ats"])).toBe("ats");
    expect(besteHerkunft(["external_api", "licensed_partner"])).toBe("licensed_partner");
  });

  it("gibt bei leerer Liste nichts zurück, statt etwas anzunehmen", () => {
    expect(besteHerkunft([])).toBeNull();
  });
});

describe("Ableitung aus der Vertragsart", () => {
  it("stuft im Zweifel als Aggregator ein, nicht als Arbeitgeber", () => {
    /*
     * Die Richtung ist der Punkt. Eine lizenzierte API kann alles
     * Mögliche sein; sie als „direkt vom Arbeitgeber" zu führen wäre
     * genau die Behauptung, die hier abgeschafft wird.
     */
    expect(herkunftAusArt("licensed_api")).toBe("aggregator");
    expect(istArbeitgeberquelle(herkunftAusArt("licensed_api"))).toBe(false);
  });

  it("erkennt den Arbeitgeber-Feed als Arbeitgeberquelle", () => {
    expect(istArbeitgeberquelle(herkunftAusArt("employer_feed"))).toBe(true);
  });
});

describe("Das tatsächliche Ziel", () => {
  /**
   * Der Anlass steht in echten Daten: TheirStack lieferte eine Anzeige,
   * deren Link auf LinkedIn zeigt. „Weiter zu TheirStack" darüber wäre
   * dieselbe Falschaussage wie „Original ansehen" — nur eine Ebene
   * tiefer, und deshalb noch schwerer zu bemerken.
   */
  it("nennt das Ziel, nicht den Vermittler", () => {
    expect(
      linkTextMitZiel("aggregator", "TheirStack", "https://www.linkedin.com/jobs/view/4461062318/"),
    ).toBe("Weiter zu LinkedIn");
  });

  it("bleibt beim Quellennamen, wenn der Link dorthin führt", () => {
    expect(linkTextMitZiel("aggregator", "Arbeitnow", "https://arbeitnow.com/view/x")).toBe(
      "Weiter zu Arbeitnow",
    );
  });

  it("nimmt die nackte Domain, wenn wir den Namen nicht kennen", () => {
    // Unschön und wahr ist besser als schön und falsch.
    expect(linkTextMitZiel("aggregator", "TheirStack", "https://jobs.beispiel-firma.de/1")).toBe(
      "Weiter zu jobs.beispiel-firma.de",
    );
  });

  it("verspricht bei einer Arbeitgeberquelle weiterhin den Arbeitgeber", () => {
    /*
     * Hier darf das Ziel NICHT gewinnen: ein ATS läuft technisch über
     * greenhouse.io, ist aber die Anzeige des Arbeitgebers. „Weiter zu
     * Greenhouse" wäre technisch richtig und für die Person nutzlos.
     */
    expect(
      linkTextMitZiel("ats", "Greenhouse", "https://boards.greenhouse.io/firma/jobs/1"),
    ).toMatch(/Arbeitgeber/);
  });

  it("kommt ohne Adresse aus", () => {
    expect(linkTextMitZiel("aggregator", "TheirStack", null)).toBe("Weiter zu TheirStack");
  });

  it("erkennt Unterdomains", () => {
    expect(zielName("https://de.linkedin.com/jobs/view/1")).toBe("LinkedIn");
  });
});

describe("Hostnamen lesen", () => {
  // Ohne `URL`, weil dieses Paket an keiner Laufzeitumgebung hängt.
  // Die Fälle, an denen eine handgeschriebene Lesung scheitert:
  it("kommt mit Port, Anmeldedaten und Pfad zurecht", () => {
    expect(zielName("https://user:pw@de.linkedin.com:443/jobs/1?x=2#a")).toBe("LinkedIn");
  });

  it("hält Text für keine Adresse", () => {
    expect(zielName("keine adresse")).toBeNull();
    expect(zielName("")).toBeNull();
  });

  it("entfernt www, aber nicht mehr", () => {
    expect(zielName("https://www.beispiel.de/x")).toBe("beispiel.de");
    expect(zielName("https://wwwerk.de/x")).toBe("wwwerk.de");
  });
});
