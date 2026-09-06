import { describe, expect, it } from "vitest";
import type { JobSourceAdapter, RawListing } from "./adapter.ts";
import { abrufSatz, rufeAlleAb } from "./orchestrierung.ts";

/**
 * Der Ausfall eines Anbieters darf die Suche nicht mitnehmen.
 *
 * Das ist die einzige Regel, die hier wirklich zählt. Alles andere —
 * Reihenfolge, Fristen, Zusammenführung — ist Feinschliff; ein
 * Anbieter, der die ganze Jobseite zum Absturz bringt, ist ein Ausfall
 * des Produkts.
 */

function adapter(
  key: string,
  ergebnis: RawListing[] | Error,
  verzoegerung = 0,
): JobSourceAdapter {
  return {
    key,
    displayName: key,
    kind: "licensed_api",
    licenseStatus: "licensed",
    attributionRequired: false,
    attributionText: null,
    termsUrl: null,
    isConfigured: () => true,
    async fetchListings() {
      if (verzoegerung) await new Promise((r) => setTimeout(r, verzoegerung));
      if (ergebnis instanceof Error) throw ergebnis;
      return ergebnis;
    },
  };
}

function anzeige(id: string, p: Partial<RawListing> = {}): RawListing {
  return {
    externalId: id,
    title: "Sachbearbeiter Kundenbetreuung",
    companyName: `Firma ${id}`,
    location: "Karlsruhe",
    description: "Eine hinreichend lange Beschreibung mit genug Text für die Prüfung hier.",
    ...p,
  };
}

describe("Fehlerisolierung", () => {
  it("liefert die Ergebnisse der übrigen, wenn einer scheitert", async () => {
    const e = await rufeAlleAb({
      adapter: [
        adapter("theirstack", [anzeige("a"), anzeige("b")]),
        adapter("jsearch", new Error("HTTP 429 — Kontingent erschöpft")),
      ],
    });
    expect(e.stellen).toHaveLength(2);
    expect(e.berichte.find((b) => b.provider === "jsearch")?.ok).toBe(false);
  });

  it("scheitert nicht, wenn ALLE scheitern", async () => {
    /*
     * Auch das darf keine Ausnahme werfen. Eine Jobseite ohne Stellen
     * ist eine leere Liste mit einer Erklärung — keine Fehlerseite.
     */
    const e = await rufeAlleAb({
      adapter: [adapter("a", new Error("aus")), adapter("b", new Error("auch aus"))],
    });
    expect(e.stellen).toHaveLength(0);
    expect(e.berichte.every((b) => !b.ok)).toBe(true);
  });

  it("hält den Fehlertext fest, statt ihn zu verschlucken", async () => {
    // Ohne den Text steht in der Betriebsansicht „nicht geantwortet",
    // und niemand weiss, ob es der Schlüssel, der Plan oder das Netz war.
    const e = await rufeAlleAb({ adapter: [adapter("x", new Error("HTTP 403 — Plan zu klein"))] });
    expect(e.berichte[0]!.fehler).toMatch(/403/);
  });
});

describe("Reihenfolge", () => {
  it("fragt die zweite Reihe nicht, wenn die erste genug liefert", async () => {
    let teuerGefragt = false;
    const teuer = adapter("apify", []);
    const original = teuer.fetchListings.bind(teuer);
    teuer.fetchListings = async (...args) => {
      teuerGefragt = true;
      return original(...args);
    };

    await rufeAlleAb({
      genugAb: 2,
      adapter: [adapter("theirstack", [anzeige("a"), anzeige("b"), anzeige("c")]), teuer],
    });
    expect(teuerGefragt).toBe(false);
  });

  it("fragt die zweite Reihe, wenn die erste zu wenig liefert", async () => {
    const e = await rufeAlleAb({
      genugAb: 5,
      adapter: [adapter("theirstack", [anzeige("a")]), adapter("apify", [anzeige("b")])],
    });
    expect(e.berichte.map((b) => b.provider).sort()).toEqual(["apify", "theirstack"]);
  });
});

describe("Der Satz für die Oberfläche", () => {
  it("verschweigt einen Ausfall nicht", async () => {
    /*
     * „2 Stellen" allein liesse die Person glauben, das sei alles, was
     * es gibt. Die Zahl ist richtig und der Eindruck falsch.
     */
    const e = await rufeAlleAb({
      adapter: [adapter("theirstack", [anzeige("a"), anzeige("b")]), adapter("jsearch", new Error("aus"))],
    });
    expect(abrufSatz(e)).toMatch(/jsearch.*nicht geantwortet/i);
  });

  it("nennt die Zahl der zusammengeführten Dubletten", async () => {
    const e = await rufeAlleAb({
      adapter: [
        adapter("theirstack", [anzeige("a", { originalUrl: "https://f.de/1" })]),
        adapter("jsearch", [anzeige("b", { companyName: "Firma a", originalUrl: "https://f.de/1" })]),
      ],
    });
    expect(e.stellen).toHaveLength(1);
    expect(abrufSatz(e)).toMatch(/1 Dublette/);
  });
});
