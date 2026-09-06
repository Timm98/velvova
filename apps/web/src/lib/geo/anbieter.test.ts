import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fehlendeModiGrund, verfuegbareModi, wegBerechnen } from "./anbieter.ts";

/**
 * Welche Verkehrsmittel wir wirklich beantworten können.
 *
 * ── Der Fehler, um den es geht ────────────────────────────────
 *
 * Der frei zugängliche OSRM-Dienst nimmt jedes Profil entgegen und
 * antwortet immer mit derselben AUTOROUTE. Karlsruhe → Stuttgart ergab
 * dreimal „64 Minuten, 81 km" — für Auto, Rad und zu Fuss. Achtzig
 * Kilometer in 64 Minuten mit dem Fahrrad.
 *
 * Das ist die gefährlichste Sorte Fehler: wohlgeformte Antwort,
 * plausible Zahl, niemand prüft nach. Und sie stünde an genau der
 * Stelle, an der jemand entscheidet, ob er den Weg täglich fährt.
 *
 * Deshalb: lieber ein Verkehrsmittel weniger als eine erfundene Zeit.
 */

const UMGEBUNG = { ...process.env };

beforeEach(() => {
  delete process.env.ORS_API_KEY;
  delete process.env.ROUTING_URL;
});

afterEach(() => {
  process.env = { ...UMGEBUNG };
  vi.unstubAllGlobals();
});

describe("Was ohne Zugangsdaten geht", () => {
  it("bietet nur das Auto an", () => {
    expect(verfuegbareModi()).toEqual(["auto"]);
  });

  it("nennt den Grund, statt Rad und Fuss stillschweigend wegzulassen", () => {
    // Ein fehlendes Fahrrad sieht sonst aus wie ein Produkt, das an
    // Radfahrer nicht gedacht hat. Es ist eine fehlende Zugangsdatei.
    expect(fehlendeModiGrund()).toMatch(/Routendienst/);
  });
});

describe("Mit einem Dienst, der Profile unterscheidet", () => {
  beforeEach(() => {
    process.env.ORS_API_KEY = "probe";
  });

  it("bietet Auto, Rad, Roller und Fussweg an", () => {
    expect(verfuegbareModi()).toEqual(["auto", "rad", "roller", "fuss"]);
  });

  it("nennt keinen Grund mehr", () => {
    expect(fehlendeModiGrund()).toBeNull();
  });

  it("fragt je Verkehrsmittel ein eigenes Profil ab", async () => {
    /*
     * Der Kern der Sache. Die alte Fassung schickte das Profil mit und
     * bekam dieselbe Antwort — geprüft wird deshalb, dass überhaupt
     * verschiedene Profile angefragt werden.
     */
    const gefragt: string[] = [];
    vi.stubGlobal("fetch", async (eingabe: unknown) => {
      const url = String(eingabe);
      gefragt.push(url.split("/directions/")[1]?.split("?")[0] ?? "");
      const dauer = url.includes("foot") ? 60_000 : url.includes("cycling-regular") ? 18_000 : 3_600;
      return new Response(
        JSON.stringify({ features: [{ properties: { summary: { duration: dauer, distance: 81_000 } } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const von = { lat: 49.0094, lon: 8.4017 };
    const nach = { lat: 48.7841, lon: 9.1829 };
    const auto = await wegBerechnen(von, nach, "auto");
    const rad = await wegBerechnen(von, nach, "rad");
    const fuss = await wegBerechnen(von, nach, "fuss");

    expect(gefragt).toEqual(["driving-car", "cycling-regular", "foot-walking"]);
    // Und die Zeiten müssen sich unterscheiden — das war der Fehler.
    expect(auto!.minuten).toBeLessThan(rad!.minuten);
    expect(rad!.minuten).toBeLessThan(fuss!.minuten);
  });

  it("gibt bei einer Fehlantwort nichts zurück statt irgendetwas", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 429 }));
    expect(await wegBerechnen({ lat: 49, lon: 8 }, { lat: 48, lon: 9 }, "rad")).toBeNull();
  });

  it("beantwortet den öffentlichen Verkehr weiterhin nicht", async () => {
    /*
     * Auch ORS kann keine Fahrpläne. Eine ÖPNV-Zeit aus einer
     * Autoroute mal Faktor wäre eine erfundene Zahl.
     */
    expect(verfuegbareModi()).not.toContain("oepnv");
    expect(await wegBerechnen({ lat: 49, lon: 8 }, { lat: 48, lon: 9 }, "oepnv")).toBeNull();
  });
});

describe("Der Ort wird im Land der Stelle gesucht", () => {
  /*
   * „Hamburg, Hamburg" löste Nominatim zu „Village of Hamburg, Erie
   * County, New York" auf. Von Karlsruhe dorthin gibt es keine
   * Autoroute — auf der Stellenseite stand deshalb kein Arbeitsweg,
   * für eine Stelle in Hamburg.
   *
   * Solange nur deutsche Anzeigen im Bestand standen, traf der erste
   * Treffer meistens. Bei 50.785 britischen und 37.284 amerikanischen
   * Stellen trifft er es nicht mehr.
   */
  function abgefangeneUrl(): { url: () => string } {
    let zuletzt = "";
    vi.stubGlobal("fetch", async (u: string | URL) => {
      zuletzt = String(u);
      return new Response(JSON.stringify([{ lat: "53.55", lon: "9.99", display_name: "Hamburg" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    return { url: () => zuletzt };
  }

  it("schränkt die Suche auf das Land ein", async () => {
    const { geokodieren } = await import("./anbieter.ts");
    const abgefangen = abgefangeneUrl();
    await geokodieren("Hamburg, Hamburg", "DE");
    expect(abgefangen.url()).toContain("countrycodes=de");
  });

  it("kommt ohne Land aus", async () => {
    // Der Wohnort trägt keines — dann wird eben nicht eingeschränkt,
    // statt eine Einschränkung zu erfinden.
    const { geokodieren } = await import("./anbieter.ts");
    const abgefangen = abgefangeneUrl();
    await geokodieren("Karlsruhe");
    expect(abgefangen.url()).not.toContain("countrycodes");
  });

  it("übernimmt keinen Unsinn als Länderkürzel", async () => {
    /*
     * `country` ist ein Textfeld. Stünde dort „Deutschland" statt
     * „DE", ergäbe `countrycodes=deutschland` eine Anfrage, die
     * Nominatim mit null Treffern beantwortet — und der Arbeitsweg
     * verschwände stillschweigend für alle betroffenen Stellen.
     */
    const { geokodieren } = await import("./anbieter.ts");
    for (const unsinn of ["Deutschland", "DEU", "d", "", "  "]) {
      const abgefangen = abgefangeneUrl();
      await geokodieren("Hamburg", unsinn);
      expect(abgefangen.url(), unsinn).not.toContain("countrycodes");
    }
  });
});

describe("Koordinaten an der Stelle sparen den Umweg", () => {
  /*
   * `scripts/koordinaten-nachtragen.mjs` schreibt Breite und Länge an
   * die Stellen. Ohne diesen Weg wäre das eine gefüllte Spalte, die
   * niemand liest — der Fehler, der in diesem Projekt schon mehrfach
   * Wochen gekostet hat.
   */
  it("fragt den Geokodierer nicht, wenn die Stelle die Koordinaten trägt", async () => {
    const { arbeitswegBerechnen } = await import("./arbeitsweg.ts");
    let gefragt = 0;
    vi.stubGlobal("fetch", async (u: string | URL) => {
      const url = String(u);
      if (url.includes("nominatim") || url.includes("search?")) gefragt++;
      /* Die Route darf gefragt werden — nur die Auflösung des Jobortes nicht. */
      return new Response(JSON.stringify([{ lat: "49.0", lon: "8.4", display_name: "Karlsruhe" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    await arbeitswegBerechnen("Karlsruhe", "Hamburg, Hamburg", "DE", { lat: 53.55, lon: 9.99 });
    /*
     * Genau eine Auflösung: der Wohnort. Der Jobort kam fertig mit.
     * Ohne die Durchreichung wären es zwei.
     */
    expect(gefragt).toBeLessThanOrEqual(1);
  });
});
