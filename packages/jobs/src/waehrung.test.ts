import { describe, expect, it } from "vitest";
import { waehrungAusText, waehrungBestimmen } from "./waehrung.ts";

/**
 * Der Fall, der diese Datei ausgelöst hat, steht zuerst.
 *
 * Eine Stelle in Frankfurt wurde mit „60.000–80.000 GBP" angezeigt.
 * TheirStack hatte GBP geliefert, der Adapter reichte es durch. Die Zahl
 * war plausibel, das Kürzel war plausibel — und zusammen ergaben sie
 * einen um rund fünfzehn Prozent falschen Betrag, in die Richtung, die
 * eine Stelle attraktiver aussehen lässt.
 */

describe("Der Frankfurt-Fall", () => {
  it("verwirft die Anbieterwährung, wenn sie dem Land widerspricht", () => {
    const b = waehrungBestimmen({ providerWaehrung: "GBP", land: "DE", rohtext: null });
    expect(b.waehrung).toBe("EUR");
    expect(b.herkunft).toBe("location_fallback");
  });

  it("nennt den Grund, damit die Reparatur nachvollziehbar bleibt", () => {
    const b = waehrungBestimmen({ providerWaehrung: "GBP", land: "DE" });
    expect(b.begruendung).toContain("GBP");
    expect(b.begruendung).toContain("DE");
  });
});

describe("Der Anbieter hat Vorrang, aber kein Vetorecht", () => {
  it("übernimmt die Anbieterwährung, wenn sie zum Land passt", () => {
    expect(waehrungBestimmen({ providerWaehrung: "CHF", land: "CH" }).herkunft).toBe("provider");
    expect(waehrungBestimmen({ providerWaehrung: "GBP", land: "GB" }).waehrung).toBe("GBP");
  });

  it("lässt den Gehaltstext die Anbieterangabe verteidigen", () => {
    /*
     * Eine Schweizer Firma darf in Euro ausschreiben. Sagt der Anbieter
     * EUR und steht im Gehaltstext ein Eurozeichen, ist das keine
     * Verwechslung, sondern eine Besonderheit — und das Land darf sie
     * nicht überstimmen.
     */
    const b = waehrungBestimmen({ providerWaehrung: "EUR", land: "CH", rohtext: "€ 95.000 pro Jahr" });
    expect(b.waehrung).toBe("EUR");
    expect(b.herkunft).toBe("provider");
  });

  it("übernimmt sie bei unbekanntem Land unverändert", () => {
    const b = waehrungBestimmen({ providerWaehrung: "SGD", land: "XX" });
    expect(b.waehrung).toBe("SGD");
  });
});

describe("Land als Rückfall", () => {
  it.each([
    ["DE", "EUR"], ["AT", "EUR"], ["CH", "CHF"], ["GB", "GBP"],
    ["US", "USD"], ["CA", "CAD"], ["AU", "AUD"], ["PL", "PLN"],
    ["SE", "SEK"], ["DK", "DKK"], ["CZ", "CZK"],
  ])("%s → %s", (land, erwartet) => {
    expect(waehrungBestimmen({ land }).waehrung).toBe(erwartet);
  });
});

describe("Nichts erfinden", () => {
  it("gibt null zurück, wenn nichts belastbar ist", () => {
    /*
     * Der wichtigste Test.
     *
     * Der ursprüngliche Adapter schrieb `?? "EUR"`. Das sieht harmlos
     * aus und macht aus fehlendem Wissen eine Behauptung — genau der
     * Mechanismus hinter dem Frankfurt-Fall, nur in die andere
     * Richtung.
     */
    const b = waehrungBestimmen({});
    expect(b.waehrung).toBeNull();
    expect(b.herkunft).toBeNull();
  });

  it("rät bei unbekanntem Land nicht auf Euro", () => {
    expect(waehrungBestimmen({ land: "ZZ" }).waehrung).toBeNull();
  });
});

describe("Währung aus dem Gehaltstext", () => {
  it("liest eindeutige Symbole und Kürzel", () => {
    expect(waehrungAusText("€60,000 - €80,000 per year")).toBe("EUR");
    expect(waehrungAusText("£45,000")).toBe("GBP");
    expect(waehrungAusText("CHF 90'000")).toBe("CHF");
    expect(waehrungAusText("60000 EUR")).toBe("EUR");
  });

  it("löst das Dollarzeichen nur mit Land auf", () => {
    /*
     * `$` steht für mindestens ein Dutzend Währungen. Ohne Land ist es
     * keine Auskunft, sondern eine Frage.
     */
    expect(waehrungAusText("$120,000")).toBeNull();
    expect(waehrungAusText("$120,000", "US")).toBe("USD");
    expect(waehrungAusText("$110,000", "AU")).toBe("AUD");
    expect(waehrungAusText("$100,000", "CA")).toBe("CAD");
  });

  it("bleibt bei leerem Text still", () => {
    expect(waehrungAusText(null)).toBeNull();
    expect(waehrungAusText("")).toBeNull();
    expect(waehrungAusText("competitive salary")).toBeNull();
  });
});
