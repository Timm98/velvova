import { describe, expect, it } from "vitest";
import { LightcastAdapter, parseLightcast } from "./lightcast.ts";

/**
 * Ein Adapter, der ohne Vertrag nicht läuft — und trotzdem geprüft ist.
 *
 * Ein Adapter, dessen Auslegung des Antwortformats erst am Tag der
 * Vertragsunterschrift zum ersten Mal läuft, ist ein Adapter ohne
 * Aussage. Deshalb ist das Parsen ausgelagert und wird gegen eine
 * Fixture geprüft.
 */

const antwort = {
  data: [
    {
      id: "abc123",
      title: "Fachkraft Lagerlogistik",
      company_name: "Muster GmbH",
      city_name: "Hamburg",
      body: "Du nimmst Waren an.",
      url: "https://example.invalid/jobs/abc123",
      posted: "2026-08-20",
      salary_from: 38000,
      salary_to: 44000,
    },
    // Ohne URL: eine Anzeige ohne Weg zum Original ist wertlos.
    { id: "def456", title: "Ohne Link", company_name: "X" },
    null,
  ],
};

describe("Lightcast-Antwort", () => {
  const listings = parseLightcast(antwort);

  it("liest eine vollständige Anzeige", () => {
    expect(listings).toHaveLength(1);
    expect(listings[0]!.externalId).toBe("lightcast:abc123");
    expect(listings[0]!.title).toBe("Fachkraft Lagerlogistik");
    expect(listings[0]!.location).toBe("Hamburg");
  });

  it("führt Gehalt als Zahl mit, fehlende Werte als null", () => {
    const raw = listings[0]!.raw as Record<string, unknown>;
    expect(raw.salaryMin).toBe(38000);
    expect(parseLightcast({ data: [{ id: "x", title: "T", url: "https://x.invalid" }] })[0]!.raw)
      .toMatchObject({ salaryMin: null, salaryMax: null });
  });

  it("stürzt nicht über kaputte Antworten", () => {
    for (const payload of [{}, { data: "keine Liste" }, { data: [null] }, null]) {
      expect(parseLightcast(payload)).toEqual([]);
    }
  });
});

describe("Zwei Riegel", () => {
  it("gilt ohne Zugangsdaten als nicht eingerichtet", () => {
    const a = new LightcastAdapter({ enabled: true, clientId: undefined, clientSecret: undefined });
    expect(a.isConfigured()).toBe(false);
    expect(a.missingRequirement()).toMatch(/Zugangsdaten fehlen/);
  });

  it("gilt mit Zugangsdaten, aber ohne Schalter, weiterhin als nicht eingerichtet", () => {
    // Der wichtige Fall. Wer einen Schlüssel zum Ausprobieren einträgt,
    // soll damit keinen kostenpflichtigen Abruf auslösen — und keinen,
    // dessen Anzeigerechte niemand geprüft hat.
    const a = new LightcastAdapter({ enabled: false, clientId: "id", clientSecret: "geheim" });
    expect(a.isConfigured()).toBe(false);
    expect(a.missingRequirement()).toMatch(/LIGHTCAST_ENABLED/);
  });

  it("gilt erst mit beidem als eingerichtet", () => {
    const a = new LightcastAdapter({ enabled: true, clientId: "id", clientSecret: "geheim" });
    expect(a.isConfigured()).toBe(true);
    expect(a.missingRequirement()).toBeNull();
  });

  it("wirft beim Abrufversuch ohne Freigabe, statt leer zu liefern", async () => {
    const a = new LightcastAdapter({ enabled: false, clientId: "id", clientSecret: "geheim" });
    await expect(a.fetchListings()).rejects.toThrow(/wird nicht abgerufen/);
  });

  it("nennt in einem Anmeldefehler nur den Statuscode", async () => {
    // Der Antworttext eines Auth-Endpunkts kann die Zugangsdaten
    // enthalten. Er gehört nicht in eine Fehlermeldung, die geloggt wird.
    const a = new LightcastAdapter({
      enabled: true,
      clientId: "id",
      clientSecret: "sehr-geheim",
      fetchImpl: (async () =>
        new Response('{"error":"invalid_client sehr-geheim"}', { status: 401 })) as typeof fetch,
    });

    await expect(a.fetchListings()).rejects.toThrow(/401/);
    await expect(a.fetchListings()).rejects.not.toThrow(/sehr-geheim/);
  });
});
