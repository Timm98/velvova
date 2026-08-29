import { describe, expect, it } from "vitest";
import { ArbeitnowAdapter, htmlToText, readContractType, readLanguages } from "./sources/arbeitnow.ts";
import { AdzunaAdapter } from "./sources/adzuna.ts";
import { JoobleAdapter, parseSalary } from "./sources/jooble.ts";
import { normalise } from "./adapter.ts";

/**
 * Der echte Konnektor.
 *
 * Geprüft wird vor allem, was NICHT passieren darf: geratene Gehälter,
 * geratene Vertragsarten, Sprachanforderungen aus dem Nichts. Ein
 * geratener Wert wäre schlimmer als ein fehlender, weil er später wie
 * eine gesicherte Angabe aussieht.
 */

describe("htmlToText", () => {
  it("macht aus Listen und Absätzen lesbaren Text", () => {
    const html = "<p>Deine Aufgaben:</p><ul><li>Kunden betreuen</li><li>Berichte schreiben</li></ul>";
    const text = htmlToText(html);
    expect(text).toContain("Deine Aufgaben:");
    expect(text).toContain("• Kunden betreuen");
    expect(text).toContain("• Berichte schreiben");
    expect(text).not.toContain("<");
  });

  it("löst benannte und numerische Entities auf", () => {
    expect(htmlToText("Preis &amp; Leistung&nbsp;f&#252;r alle")).toBe("Preis & Leistung für alle");
  });
});

describe("readContractType", () => {
  it("erkennt einen Werkstudentenvertrag trotz Teilzeit-Nennung", () => {
    // "Werkstudent (Teilzeit)" ist ein Werkstudentenvertrag, keine
    // Teilzeitstelle. Die Reihenfolge der Prüfungen ist hier die
    // eigentliche Aussage.
    expect(readContractType(["Werkstudent", "Teilzeit"])).toBe("working_student");
  });

  it("gibt für reine Teilzeit nichts zurück", () => {
    // Teilzeit ist eine Arbeitszeit, keine Vertragsart. Sie hierher zu
    // übersetzen hiesse raten.
    expect(readContractType(["Teilzeit"])).toBeNull();
  });

  it("gibt ohne Angabe nichts zurück", () => {
    expect(readContractType([])).toBeNull();
  });

  it("erkennt Vollzeit als unbefristet", () => {
    expect(readContractType(["Vollzeit"])).toBe("permanent");
  });
});

describe("readLanguages", () => {
  it("erkennt geforderte Sprachen nur, wenn sie genannt werden", () => {
    expect(readLanguages("Verhandlungssicheres Deutsch erforderlich")).toEqual({ de: "C1" });
    expect(readLanguages("Wir suchen Verstärkung im Vertrieb")).toEqual({});
  });
});

describe("ArbeitnowAdapter", () => {
  const listing = {
    slug: "kundenbetreuung-hamburg-1",
    company_name: "Beispiel GmbH",
    title: "Kundenbetreuung",
    description: "<p>Du betreust Kunden. Verhandlungssicheres Deutsch erforderlich.</p>",
    remote: true,
    url: "https://www.arbeitnow.com/jobs/companies/beispiel/kundenbetreuung-1",
    tags: ["support"],
    job_types: ["Vollzeit"],
    location: "Hamburg",
    created_at: 1_756_000_000,
  };

  function adapterWith(body: unknown, status = 200): ArbeitnowAdapter {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    return new ArbeitnowAdapter({ fetchImpl });
  }

  it("normalisiert eine Anzeige ohne etwas zu erfinden", async () => {
    const [raw] = await adapterWith({ data: [listing] }).fetchListings();
    expect(raw).toBeDefined();

    const n = normalise(raw!);
    expect(n.job.title).toBe("Kundenbetreuung");
    expect(n.job.workModel).toBe("remote");
    expect(n.job.contractType).toBe("permanent");
    expect(n.job.originalUrl).toBe(listing.url);
    expect(n.job.isDemo).toBe(false);

    // Arbeitnow überträgt keine Gehälter. Kein geschätzter Wert, und
    // ausdrücklich nicht als "0 Euro" offengelegt.
    expect(n.job.salary.disclosed).toBe(false);
    expect(n.job.salary.min).toBeNull();
    expect(n.job.salary.max).toBeNull();
  });

  it("übernimmt bei einem Fehler der Quelle nichts", async () => {
    await expect(adapterWith({}, 503).fetchListings()).rejects.toThrow(/503/);
  });

  it("gilt immer als eingerichtet, weil kein Schlüssel nötig ist", () => {
    expect(new ArbeitnowAdapter().isConfigured()).toBe(true);
  });

  it("verlangt eine Herkunftsangabe", () => {
    const adapter = new ArbeitnowAdapter();
    expect(adapter.attributionRequired).toBe(true);
    expect(adapter.attributionText).toBeTruthy();
    expect(adapter.licenseStatus).not.toBe("unclear");
  });
});

describe("AdzunaAdapter", () => {
  it("gilt ohne Zugangsdaten als nicht eingerichtet", () => {
    expect(new AdzunaAdapter({ appId: undefined, appKey: undefined }).isConfigured()).toBe(false);
  });

  it("ruft ohne Zugangsdaten nichts ab", async () => {
    await expect(
      new AdzunaAdapter({ appId: undefined, appKey: undefined }).fetchListings(),
    ).rejects.toThrow(/nicht eingerichtet/);
  });

  it("übernimmt ein geschätztes Gehalt nicht als offengelegt", async () => {
    // Der entscheidende Punkt: Adzuna kennzeichnet Schaetzungen. Eine
    // Schaetzung, die wie eine Zusage aussieht, ist schlimmer als keine
    // Angabe.
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: "1",
              title: "Kundenbetreuung",
              description: "Beschreibung",
              created: "2026-08-20T10:00:00Z",
              redirect_url: "https://www.adzuna.de/land/ad/1",
              salary_min: 42000,
              salary_max: 52000,
              salary_is_predicted: "1",
              company: { display_name: "Beispiel GmbH" },
              location: { display_name: "Hamburg" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const [raw] = await new AdzunaAdapter({
      appId: "id",
      appKey: "key",
      fetchImpl,
    }).fetchListings();

    expect(raw?.salaryMin).toBeNull();
    expect(raw?.salaryMax).toBeNull();
    expect(raw?.raw?.salaryIsPredicted).toBe(true);

    const n = normalise(raw!);
    expect(n.job.salary.disclosed).toBe(false);
  });
});

describe("Jooble: Gehalt aus Freitext", () => {
  it("erkennt eine klare Spanne", () => {
    expect(parseSalary("45.000 - 55.000 EUR pro Jahr")).toEqual({
      min: 45000,
      max: 55000,
      period: "year",
    });
  });

  it("erkennt einen Stundensatz", () => {
    expect(parseSalary("18,50 EUR pro Stunde").period).toBe("hour");
  });

  it("gibt bei Floskeln nichts zurück", () => {
    // "Attraktives Gehalt" ist keine Angabe. Daraus eine Zahl zu machen
    // waere eine Erfindung mit Zahlenformat.
    expect(parseSalary("Attraktives Gehalt nach Vereinbarung")).toEqual({
      min: null,
      max: null,
      period: "year",
    });
    expect(parseSalary(undefined).min).toBeNull();
  });
});

describe("JoobleAdapter", () => {
  it("gilt ohne Schlüssel als nicht eingerichtet", () => {
    expect(new JoobleAdapter({ apiKey: undefined }).isConfigured()).toBe(false);
  });
});

describe("Jooble: Gehalt, weitere Fälle", () => {
  it("liest deutsche Tausenderpunkte und Nachkommastellen richtig", () => {
    expect(parseSalary("45.000 EUR").min).toBe(45000);
    expect(parseSalary("18,50 EUR/Std.").min).toBe(18.5);
  });

  it("hält Jahreszahlen aus dem Gehaltsfeld heraus", () => {
    // "seit 2019" enthaelt eine Zahl, aber kein Gehalt. Die Untergrenze
    // je Bezugsgroesse faengt genau das ab.
    expect(parseSalary("Einstieg seit 2019 möglich").min).toBeNull();
  });

  it("erkennt eine Monatsangabe", () => {
    const result = parseSalary("3.200 EUR monatlich");
    expect(result.period).toBe("month");
    expect(result.min).toBe(3200);
  });
});
