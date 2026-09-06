import { describe, expect, it } from "vitest";
import { umkreisAusText, zeitarbeitAusgeschlossen, UMKREIS_MAX_KM } from "./umkreistext.ts";

describe("Umkreis aus dem Satz", () => {
  const gefunden: [string, number, string][] = [
    [
      "Such für mich Lager- oder Logistikjobs bis 30 km um Karlsruhe, mindestens 36.000 € brutto",
      30,
      "Karlsruhe",
    ],
    ["im Umkreis von 25 km um Stuttgart", 25, "Stuttgart"],
    ["Umkreis von 40 Kilometer um Hamburg", 40, "Hamburg"],
    ["maximal 20 km von Berlin", 20, "Berlin"],
    ["max. 15 km um Köln", 15, "Köln"],
    ["höchstens 50 km von München", 50, "München"],
    ["nicht weiter als 35 km von Dresden", 35, "Dresden"],
    ["nicht mehr als 10 km um Leipzig", 10, "Leipzig"],
    ["bis zu 45 km um Bremen", 45, "Bremen"],
    ["60 km um Frankfurt am Main", 60, "Frankfurt am Main"],
    ["30 km rund um Nürnberg", 30, "Nürnberg"],
    ["Umkreis Karlsruhe 30 km", 30, "Karlsruhe"],
    ["bis 30 km um Karlsruhe entfernt", 30, "Karlsruhe"],
  ];

  for (const [satz, km, ort] of gefunden) {
    it(`liest „${satz.slice(0, 44)}“`, () => {
      const a = umkreisAusText(satz);
      expect(a).not.toBeNull();
      expect(a!.km).toBe(km);
      expect(a!.ort).toBe(ort);
    });
  }

  it("nimmt keine Zeitangabe für eine Entfernung", () => {
    /*
     * „Eine halbe Stunde" in Kilometer umzurechnen hiesse, eine
     * Annahme über Verkehrsmittel und Verkehrslage zu treffen und sie
     * als Angabe der Person auszugeben.
     */
    expect(umkreisAusText("höchstens eine halbe Stunde Fahrtzeit")).toBeNull();
    expect(umkreisAusText("maximal 30 Minuten von Karlsruhe")).toBeNull();
  });

  it("hält ein Gehalt nicht für einen Umkreis", () => {
    /*
     * Ein zu gieriges Muster liest aus „36.000 € brutto" einen
     * Umkreis von 36.000 km — und der prüft nichts mehr, sieht aber
     * aus wie eine Eingrenzung.
     */
    expect(umkreisAusText("mindestens 36.000 € brutto in Karlsruhe")).toBeNull();
  });

  it("weist einen unglaubhaft grossen Umkreis ab", () => {
    expect(umkreisAusText(`${UMKREIS_MAX_KM + 100} km um Karlsruhe`)).toBeNull();
  });

  it("findet in einem Satz ohne Umkreis nichts", () => {
    expect(umkreisAusText("Ich suche Lagerarbeit in Karlsruhe")).toBeNull();
    expect(umkreisAusText("")).toBeNull();
  });

  it("schneidet den Satz nach dem Ort ab", () => {
    const a = umkreisAusText("bis 30 km um Karlsruhe, keine Zeitarbeit");
    expect(a!.ort).toBe("Karlsruhe");
  });
});

describe("Zeitarbeit im Satz", () => {
  it("erkennt den Ausschluss in seinen Formen", () => {
    for (const satz of [
      "keine Zeitarbeit",
      "Keine Leiharbeit bitte",
      "ohne Arbeitnehmerüberlassung",
      "nicht über eine Zeitarbeitsfirma",
      "keine Stellen von Personalverleih",
    ]) {
      expect(zeitarbeitAusgeschlossen(satz), satz).toBe(true);
    }
  });

  it("erfindet keinen Ausschluss, wo keiner steht", () => {
    expect(zeitarbeitAusgeschlossen("Ich arbeite gerade in der Zeitarbeit")).toBe(false);
    expect(zeitarbeitAusgeschlossen("Lagerarbeit in Karlsruhe")).toBe(false);
  });
});
