import { describe, expect, it } from "vitest";
import { deuteSuchintention } from "./suchintention.ts";
import { zweigeLesen, zweigeSchreiben } from "./zweige.ts";
import { suchwoerter, trifftSuche, wortstamm } from "./textsuche.ts";

/*
 * Der gemeldete Satz vom 8. September 2026.
 *
 * Er stand so in der Meldung und ist absichtlich nicht geglättet:
 * kleingeschrieben, ohne Satzzeichen, mit „min 40k" statt „ab
 * 40.000 €". So tippen Menschen, und daran ist die Suche gescheitert.
 */
const GEMELDET =
  "such mir ein job als bürokaufmann will min 40k im jahr verdienen und find mir " +
  "auch noch ein elektriker mit min 50k beides nicht länger als 30 min weg von mir " +
  "zuhause und nette arbeitskollegen";

describe("zwei Berufe in einem Satz", () => {
  it("trennt Beruf und Gehalt in eigene Zweige", () => {
    const { zweige } = deuteSuchintention(GEMELDET);
    expect(zweige).toEqual([
      { q: "bürokaufmann", gehaltAb: 40_000 },
      { q: "elektriker", gehaltAb: 50_000 },
    ]);
  });

  it("legt hinter „beides“ die gemeinsamen Bedingungen ab", () => {
    const { filter } = deuteSuchintention(GEMELDET);
    expect(filter.pendelzeit).toBe(30);
    expect(filter.sort).toBe("best_job_quality");
  });

  it("lässt keinen Volltext stehen, der beide Berufe verlangt", () => {
    /*
     * Der eigentliche Fehler. Vorher stand hier
     *
     *   q = "bürokaufmann jahr verdienen elektriker 50k beides …"
     *
     * und weil der Volltext mit UND verbindet, hätte das alles in
     * EINEM Stellentitel stehen müssen.
     */
    const { filter } = deuteSuchintention(GEMELDET);
    expect(filter.q).toBeUndefined();
  });

  it("nennt beide Berufe mit ihrem Gehalt in der Quittung", () => {
    const { erkannt } = deuteSuchintention(GEMELDET);
    expect(erkannt).toContain("bürokaufmann ab 40.000 €");
    expect(erkannt).toContain("elektriker ab 50.000 €");
    expect(erkannt).toContain("höchstens 30 Minuten Fahrt");
  });
});

describe("was KEIN zweiter Beruf ist", () => {
  /*
   * Die Trennung ist streng, und das ist ihr Sinn: „und" steht viel
   * häufiger innerhalb eines Berufs als zwischen zweien. Aus einem
   * Beruf zwei halbe zu machen fände nichts.
   */
  it.each([
    "kaufmann für büromanagement und verwaltung",
    "erzieher oder kinderpfleger in Karlsruhe",
    "pflegefachkraft und altenpflege",
  ])("bleibt eine Suche: %s", (satz) => {
    expect(deuteSuchintention(satz).zweige).toBeUndefined();
  });

  it("erfindet keinen Beruf, wo keiner steht", () => {
    /* Zwei Satzteile, aber nur Bedingungen — kein Beruf, keine Zweige. */
    const { zweige, filter } = deuteSuchintention("zeig mir stellen ab 45000 und such auch remote");
    expect(zweige).toBeUndefined();
    expect(filter.gehaltAb).toBe(45_000);
    expect(filter.remote).toBe("remote");
  });
});

describe("Orte werden auch klein geschrieben erkannt", () => {
  it.each(["job in Karlsruhe", "job in karlsruhe"])("%s", (satz) => {
    expect(deuteSuchintention(satz).filter.ort?.toLowerCase()).toBe("karlsruhe");
  });

  it("verschluckt den Satzteil hinter dem Ort nicht", () => {
    /*
     * Der `i`-Schalter hätte auch das zweite Wort kleingeschrieben
     * zugelassen — aus „in karlsruhe und elektriker" wäre der Ort
     * „karlsruhe und" geworden.
     */
    const { filter } = deuteSuchintention("bürokaufmann in karlsruhe und elektriker");
    expect(filter.ort?.toLowerCase()).toBe("karlsruhe");
  });

  it("hält Wörter fern, die keine Orte sind", () => {
    expect(deuteSuchintention("stelle bei mir in der nähe").filter.ort).toBeUndefined();
  });
});

describe("die Adresse trägt die Zweige", () => {
  it("schreibt und liest dasselbe zurück", () => {
    const zweige = [
      { q: "bürokaufmann", gehaltAb: 40_000 },
      { q: "elektriker", gehaltAb: 50_000 },
    ];
    const adresse = zweigeSchreiben(zweige);
    expect(adresse).toBe("bürokaufmann~40000;elektriker~50000");
    expect(zweigeLesen(adresse)).toEqual(zweige);
  });

  it("führt einen einzelnen Zweig nicht als Zweig", () => {
    /* Er ist eine gewöhnliche Suche und steht als `q` in der Adresse. */
    expect(zweigeSchreiben([{ q: "bürokaufmann", gehaltAb: 40_000 }])).toBeNull();
  });

  it("überlebt einen abgeschnittenen Link", () => {
    expect(zweigeLesen("bürokaufmann~40000;;elektriker~")).toEqual([
      { q: "bürokaufmann", gehaltAb: 40_000 },
      { q: "elektriker" },
    ]);
    expect(zweigeLesen(undefined)).toEqual([]);
  });

  it("trägt einen Beruf ohne Gehalt ohne Trennzeichen", () => {
    expect(zweigeSchreiben([{ q: "erzieher" }, { q: "elektriker", gehaltAb: 50_000 }])).toBe(
      "erzieher;elektriker~50000",
    );
  });
});

describe("der Nachfilter meint dasselbe wie die Datenbank", () => {
  it("kürzt deutsche Beugungen auf den Stamm", () => {
    expect(wortstamm("sozialen")).toBe("sozial");
    expect(wortstamm("elektriker")).toBe("elektrik");
    expect(wortstamm("landratsamt")).toBe("landratsamt");
  });

  it("lässt kurze Wörter in Ruhe", () => {
    /* „IT" ist ein Suchwort, kein Beugungsfall. */
    expect(wortstamm("it")).toBe("it");
    expect(wortstamm("büro")).toBe("büro");
  });

  it("wirft Füllwörter weg, die keine Anzeige trägt", () => {
    expect(suchwoerter("job im sozialen bereich")).toEqual(["sozial"]);
  });

  it("findet die Stelle, an der die Meldung scheiterte", () => {
    const anzeige = "Sozialarbeiter/in Jugendhilfe · Landratsamt Karlsruhe · Karlsruhe";
    expect(trifftSuche(anzeige, "landratsamt karlsruhe sozialen bereich")).toBe(true);
  });

  it("filtert weiterhin wirklich", () => {
    const anzeige = "Zerspanungsmechaniker · Maschinenbau GmbH · Pforzheim";
    expect(trifftSuche(anzeige, "landratsamt karlsruhe")).toBe(false);
  });

  it("greift nicht, wenn nur Füllwörter dastehen", () => {
    /* Ein Filter ohne Inhalt, der trotzdem greift, leert die Liste. */
    expect(trifftSuche("Zerspanungsmechaniker", "job stelle bereich")).toBe(true);
  });
});
