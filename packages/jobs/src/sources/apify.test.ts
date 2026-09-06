import { describe, expect, it } from "vitest";
import { ApifyAdapter, gesperrterActor } from "./apify.ts";

/**
 * Die Sperre muss halten, auch wenn jemand sie umgehen will.
 *
 * Nicht weil böse Absicht zu erwarten wäre, sondern weil ein
 * Actor-Name Konfiguration ist: er wird eingetragen, kopiert, aus einem
 * Beispiel übernommen. Genau so kam `curious_coder~linkedin-jobs-scraper`
 * in die Einstellungen — und der Adapter startete ihn anstandslos.
 */

describe("Gesperrte Ziele", () => {
  it("erkennt die untersagten Portale", () => {
    for (const a of [
      "curious_coder~linkedin-jobs-scraper",
      "apify/indeed-scraper",
      "jemand~StepStone-Jobs",
      "x~glassdoor-reviews",
      "y~kununu-crawler",
      "z~XING-jobs",
    ]) {
      expect(gesperrterActor(a), a).not.toBeNull();
    }
  });

  it("lässt erlaubte Actors durch", () => {
    for (const a of ["meinkonto~eigene-stellen", "apify~web-scraper", "firma~karriereseite-feed"]) {
      expect(gesperrterActor(a), a).toBeNull();
    }
  });

  it("gilt unabhängig von der Schreibweise", () => {
    // Ein Grossbuchstabe darf keine Sperre aufheben.
    expect(gesperrterActor("Konto~LinkedIn-Jobs")).toBe("linkedin");
  });
});

describe("Adapter", () => {
  it("gilt als nicht eingerichtet, wenn nur gesperrte Actors eingetragen sind", () => {
    /*
     * Die wichtigste Richtung. Sonst zählte der Anbieter als aktiv,
     * die Betriebsansicht zeigte „verbunden", und der einzige Actor
     * würde bei jedem Lauf übersprungen — ein Anbieter, der nichts
     * tut und dabei gesund aussieht.
     */
    const a = new ApifyAdapter({ token: "t", actors: ["x~linkedin-jobs-scraper"] });
    expect(a.isConfigured()).toBe(false);
    expect(a.gesperrteActors()).toHaveLength(1);
  });

  it("ist eingerichtet, sobald ein erlaubter Actor dabei ist", () => {
    const a = new ApifyAdapter({ token: "t", actors: ["x~linkedin-jobs", "ich~eigener-feed"] });
    expect(a.isConfigured()).toBe(true);
    expect(a.erlaubteActors()).toEqual(["ich~eigener-feed"]);
  });

  it("fragt ohne freigegebenen Actor nichts ab", async () => {
    /*
     * Ein Token ist keine Erlaubnis. Ohne ausdrückliche Freigabe darf
     * kein Netzzugriff stattfinden — auch kein versuchsweiser.
     */
    let gerufen = false;
    const a = new ApifyAdapter({
      token: "t",
      actors: [],
      fetchImpl: (async () => {
        gerufen = true;
        return new Response("{}");
      }) as unknown as typeof fetch,
    });
    await expect(a.fetchListings()).rejects.toThrow(/kein.*Actor|APIFY_ACTORS/i);
    expect(gerufen).toBe(false);
  });
});
