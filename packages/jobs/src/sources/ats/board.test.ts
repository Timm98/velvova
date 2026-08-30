import { describe, expect, it } from "vitest";
import {
  AtsBoardAdapter,
  parseAshby,
  parseGreenhouse,
  parseLever,
  parseSmartRecruiters,
  type BoardRegistration,
} from "./board.ts";
import {
  ashbyResponse,
  greenhouseResponse,
  kaputt,
  leverResponse,
  smartRecruitersResponse,
} from "./fixtures/index.ts";

/**
 * Vertragstests gegen gespeicherte Antwortformen.
 *
 * Sie bestätigen nicht den Parser — sie halten den Tag fest, an dem ein
 * Anbieter sein Format ändert. Dann bricht der Test, und nicht die
 * Anzeigenliste eines Menschen.
 */

describe("Greenhouse", () => {
  const listings = parseGreenhouse(greenhouseResponse, "Musterlogistik GmbH");

  it("liest eine vollständige Anzeige", () => {
    const l = listings[0]!;
    expect(l.externalId).toBe("greenhouse:4001");
    expect(l.title).toBe("Fachkraft Lagerlogistik (m/w/d)");
    expect(l.companyName).toBe("Musterlogistik GmbH");
    expect(l.location).toBe("Hamburg, Germany");
    expect(l.originalUrl).toContain("boards.greenhouse.io");
  });

  it("entziffert doppelt kodiertes HTML", () => {
    // Greenhouse liefert `content` als HTML-escapte HTML-Zeichenkette.
    // Ohne die zweite Runde stünde "&lt;p&gt;" im Anzeigentext.
    expect(listings[0]!.description).toBe("Du nimmst Waren an und kommissionierst.");
  });

  it("lässt eine Anzeige ohne Link weg", () => {
    // Eine Stelle ohne Weg zum Original ist für die suchende Person
    // wertlos. Sie aufzunehmen füllt die Liste und hilft niemandem.
    expect(listings).toHaveLength(1);
  });
});

describe("Lever", () => {
  const listings = parseLever(leverResponse, "Mustertech GmbH");

  it("liest eine vollständige Anzeige", () => {
    const l = listings[0]!;
    expect(l.externalId).toContain("lever:");
    expect(l.title).toBe("Softwareentwickler Backend (m/w/d)");
    expect(l.location).toBe("Berlin");
    expect(l.publishedAt).toBeInstanceOf(Date);
  });

  it("fügt Beschreibung und Zusatztext zusammen", () => {
    expect(listings[0]!.description).toContain("Dienste");
    expect(listings[0]!.description).toContain("hybrid");
  });
});

describe("Ashby", () => {
  const listings = parseAshby(ashbyResponse, "Musterklinik");

  it("liest eine vollständige Anzeige", () => {
    expect(listings[0]!.title).toBe("Pflegefachkraft (m/w/d)");
    expect(listings[0]!.location).toBe("München");
  });

  it("führt Gehalt nur mit, wenn der Arbeitgeber es veröffentlicht hat", () => {
    expect((listings[0]!.raw as Record<string, unknown>).compensationSummary).toBe(
      "45.000 – 52.000 EUR",
    );
  });
});

describe("SmartRecruiters", () => {
  const listings = parseSmartRecruiters(smartRecruitersResponse, "Fallback GmbH");

  it("setzt Ort aus Stadt und Region zusammen", () => {
    expect(listings[0]!.location).toBe("Köln, Nordrhein-Westfalen");
  });

  it("nimmt den Firmennamen aus der Antwort, nicht aus der Registrierung", () => {
    expect(listings[0]!.companyName).toBe("Musterhandel AG");
  });

  it("lässt die Beschreibung leer statt sie zu erfinden", () => {
    // Die Listenantwort enthält keinen Volltext. Etwas hineinzuschreiben
    // wäre eine Behauptung über eine Stelle, die wir nicht kennen.
    expect(listings[0]!.description).toBe("");
  });
});

describe("Kaputte Antworten", () => {
  it("liefert eine leere Liste statt zu stürzen", () => {
    for (const [name, payload] of Object.entries(kaputt)) {
      expect(parseGreenhouse(payload, "X"), name).toEqual([]);
      expect(parseAshby(payload, "X"), name).toEqual([]);
      expect(parseSmartRecruiters(payload, "X"), name).toEqual([]);
    }
    expect(parseLever(kaputt.leerObjekt, "X")).toEqual([]);
    expect(parseLever(kaputt.nullEintraege, "X")).toEqual([]);
  });

  it("überspringt einzelne unbrauchbare Einträge, statt alles zu verwerfen", () => {
    const gemischt = {
      jobs: [null, { id: 1, title: "Gut", absolute_url: "https://x.invalid/1", location: { name: "Hamburg" } }],
    };
    expect(parseGreenhouse(gemischt, "X")).toHaveLength(1);
  });
});

describe("Registrierung", () => {
  const registrierung: BoardRegistration = {
    boardToken: "musterlogistik",
    employerName: "Musterlogistik GmbH",
    authorization: {
      kind: "verified_domain",
      reference: "musterlogistik.example",
      verifiedAt: new Date("2026-08-01"),
    },
  };

  it("gilt ohne registriertes Board als nicht eingerichtet", () => {
    // Keine leere Liste aus Versehen, sondern die richtige Antwort: wir
    // kennen keinen Arbeitgeber, dessen Stellen wir abrufen dürfen.
    const adapter = new AtsBoardAdapter("greenhouse", () => []);
    expect(adapter.isConfigured()).toBe(false);
  });

  it("gilt mit registriertem Board als eingerichtet", () => {
    const adapter = new AtsBoardAdapter("greenhouse", () => [registrierung]);
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.key).toBe("ats_greenhouse");
  });

  it("fragt ohne Registrierung niemanden", async () => {
    const adapter = new AtsBoardAdapter("lever", () => []);
    const { listings, errors } = await adapter.fetchWithErrors();
    expect(listings).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("beschreibt SmartRecruiters nicht als Volltextquelle", () => {
    // Ein leeres Feld später als "keine Beschreibung" statt als "hier
    // nicht enthalten" zu deuten, wäre eine falsche Aussage über die
    // Stelle.
    const adapter = new AtsBoardAdapter("smartrecruiters", () => [registrierung]);
    expect(adapter.capabilities.details).toBe(false);
  });
});
