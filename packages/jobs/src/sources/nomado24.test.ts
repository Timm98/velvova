import { describe, expect, it, vi } from "vitest";
import {
  Nomado24Adapter,
  arbeitsmodell,
  gehalt,
  nomado24Adresse,
  zuRawListing,
} from "./nomado24.ts";

/*
 * Ein echter Datensatz, am 8. September 2026 von
 * https://api.nomado24.de/api/public/v1/jobs geholt. Ungekürzt und
 * ungeglättet — insbesondere fehlen `description`, `city`,
 * `countryCode`, `applyUrl`, `employmentType`, `seniority`,
 * `category` und `expiresAt`. Sie fehlen bei allen fünfzig Stellen
 * der Stichprobe.
 */
const ECHT = {
  slug: "sr-technical-program-manager-i-remote-eligible-in-bulgaria-0cd3604afd",
  title: "Sr. Technical Program Manager I (Remote Eligible in Bulgaria)",
  companyName: "Smartsheet",
  location: "EU/EMEA",
  remote: true,
  workArrangement: "remote",
  language: "en",
  tags: ["greenhouse", "Product", "en"],
  source: "greenhouse",
  publishedAt: "2026-09-07T22:58:26.000Z",
  url: "https://www.nomado24.de/en/remote-jobs/job/sr-technical-program-manager-i-remote-eligible-in-bulgaria-0cd3604afd",
};

function adapter(antworten: unknown[], status = 200, headers: Record<string, string> = {}) {
  const aufrufe: URL[] = [];
  let i = 0;
  const a = new Nomado24Adapter({
    aktiv: true,
    fetchImpl: (async (url: URL) => {
      aufrufe.push(url);
      const body = antworten[Math.min(i++, antworten.length - 1)];
      return {
        ok: status === 200,
        status,
        headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
        json: async () => {
          if (body === "kaputt") throw new SyntaxError("Unexpected token");
          return body;
        },
      } as unknown as Response;
    }) as unknown as typeof fetch,
  });
  return { a, aufrufe };
}

describe("der Schalter, nicht der Schlüssel", () => {
  it("ruft ohne ENABLE_NOMADO24 gar nicht erst ab", async () => {
    /*
     * Die API braucht keinen Schlüssel — technisch ginge es sofort.
     * Was fehlt, ist die schriftliche Klärung, was eine
     * kostenpflichtige Plattform mit den Daten darf.
     */
    const aus = new Nomado24Adapter({
      aktiv: false,
      fetchImpl: (async () => {
        throw new Error("darf gar nicht erst gefragt werden");
      }) as unknown as typeof fetch,
    });
    expect(aus.isConfigured()).toBe(false);
    await expect(aus.fetchListings()).rejects.toThrow(/ENABLE_NOMADO24/);
  });

  it("nennt die Attribution wörtlich so, wie die API sie vorgibt", () => {
    const a = new Nomado24Adapter({ aktiv: true });
    expect(a.attributionRequired).toBe(true);
    /*
     * Die Entwicklerseite macht sie zur Bedingung: „kostenlos, solange
     * du einen SICHTBAREN Link zurück auf nomado24.de setzt".
     */
    expect(a.attributionText).toContain("Nomado24");
    expect(a.attributionText).toContain("https://www.nomado24.de");
  });
});

describe("die Adresse", () => {
  it("nimmt eine Nomado24-Seite an", () => {
    expect(nomado24Adresse(ECHT.url)).toBe(ECHT.url);
  });

  it("weist alles zurück, was keine ist", () => {
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
      "http://www.nomado24.de/job/x",
      "https://localhost/job/x",
      "https://127.0.0.1/job/x",
      "https://nomado24.de.angreifer.example/job/x",
      "https://example.com/job/x",
      "kein-url",
      undefined,
    ]) {
      expect(nomado24Adresse(u as string | undefined)).toBeNull();
    }
  });
});

describe("das Arbeitsmodell", () => {
  it("liest das strukturierte Feld", () => {
    expect(arbeitsmodell({ workArrangement: "remote", remote: true })).toBe("remote");
    expect(arbeitsmodell({ workArrangement: "hybrid", remote: false })).toBe("hybrid");
    expect(arbeitsmodell({ workArrangement: "onsite", remote: false })).toBe("on_site");
  });

  it("bleibt bei Widerspruch unbekannt", () => {
    /*
     * Sagt der Text „remote" und der Bool `false`, weiss die Quelle es
     * selbst nicht. Einen von beiden still zu bevorzugen hiesse, eine
     * Entscheidung zu treffen, für die es keine Grundlage gibt.
     */
    const warnung = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(arbeitsmodell({ workArrangement: "remote", remote: false })).toBeUndefined();
    expect(arbeitsmodell({ workArrangement: "hybrid", remote: true })).toBeUndefined();
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });

  it("bleibt ohne Angabe unbekannt", () => {
    expect(arbeitsmodell({ workArrangement: null, remote: true })).toBeUndefined();
    expect(arbeitsmodell({ workArrangement: "vielleicht", remote: null })).toBeUndefined();
    expect(arbeitsmodell({})).toBeUndefined();
  });

  it("macht aus der Quelle kein Arbeitsmodell", () => {
    /* Niemals „remote", nur weil die Quelle Nomado24 heisst. */
    const l = zuRawListing({ ...ECHT, workArrangement: null, remote: null });
    expect(l!.workModel).toBeUndefined();
  });
});

describe("das Gehalt", () => {
  it("nimmt nur, was dasteht und Sinn ergibt", () => {
    expect(gehalt({ salaryMin: 60000, salaryMax: 80000, currency: "eur" })).toEqual({
      salaryMin: 60000,
      salaryMax: 80000,
      salaryCurrency: "EUR",
    });
    expect(gehalt({ salaryMin: 60000, currency: "EUR" })?.salaryMax).toBeNull();
    expect(gehalt({ salaryMax: 80000, currency: "EUR" })?.salaryMin).toBeNull();
  });

  it("verwirft Unsinn, statt ihn anzuzeigen", () => {
    expect(gehalt({})).toBeNull();
    expect(gehalt({ salaryMin: -5000, currency: "EUR" })).toBeNull();
    expect(gehalt({ salaryMin: 80000, salaryMax: 60000, currency: "EUR" })).toBeNull();
    /* Ohne Währung ist eine Zahl kein Gehalt. */
    expect(gehalt({ salaryMin: 60000 })).toBeNull();
    expect(gehalt({ salaryMin: 60000, currency: "Euro" })).toBeNull();
  });

  it("setzt keinen Zeitraum, weil die API keinen nennt", () => {
    /*
     * „Jahr" zu raten wäre bei einem Stundensatz um den Faktor 1760
     * falsch — und niemand sähe es der Zahl an.
     */
    const l = zuRawListing({ ...ECHT, salaryMin: 60000, currency: "EUR" });
    expect(l!.salaryPeriod).toBeUndefined();
    expect(l!.salaryProvenance).toBeUndefined();
  });
});

describe("die Umwandlung", () => {
  it("bildet den echten Datensatz ab", () => {
    const l = zuRawListing(ECHT)!;
    expect(l.externalId).toBe(ECHT.slug);
    expect(l.title).toBe(ECHT.title);
    expect(l.companyName).toBe("Smartsheet");
    expect(l.workModel).toBe("remote");
    expect(l.publishedAt?.getUTCFullYear()).toBe(2026);
  });

  it("erfindet keine Beschreibung", () => {
    /* Nicht aus Titel und Schlagworten zusammengesetzt. */
    const l = zuRawListing(ECHT)!;
    expect(l.description).toBe("");
    expect(l.description).not.toContain("Smartsheet");
    expect(l.description).not.toContain("Product");
  });

  it("erfindet weder Stadt noch Land", () => {
    /*
     * „EU/EMEA" ist ein Gebiet, kein Punkt. Daraus ein Land zu lesen
     * hiesse, dem Fahrzeitrechner eine Erfindung zu geben.
     */
    const l = zuRawListing(ECHT)!;
    expect(l.location).toBe("EU/EMEA");
    expect(l.country).toBeUndefined();
    const d = zuRawListing({ ...ECHT, location: "Germany only" })!;
    expect(d.country).toBeUndefined();
  });

  it("erfindet keine Bewerbungsadresse", () => {
    /*
     * Die API liefert keine. Beide Verweise zeigen deshalb auf
     * Nomado24 — das ist die Wahrheit, und ein falscher
     * Bewerbungslink kostet eine Bewerbung.
     */
    const l = zuRawListing(ECHT)!;
    expect(l.originalUrl).toBe(ECHT.url);
    expect(l.applyTarget).toBe(ECHT.url);
    expect(l.applyTarget).toContain("nomado24.de");
  });

  it("hebt das Ursprungs-ATS im Rohsatz auf", () => {
    /* `source` nennt die nähere Originalquelle — hier greenhouse. */
    expect((zuRawListing(ECHT)!.raw as Record<string, unknown>).source).toBe("greenhouse");
  });

  it("verwirft, was keine Stelle ergibt", () => {
    expect(zuRawListing({ ...ECHT, slug: "" })).toBeNull();
    expect(zuRawListing({ ...ECHT, title: "" })).toBeNull();
    expect(zuRawListing({ ...ECHT, url: "https://example.com/x" })).toBeNull();
    expect(zuRawListing({ ...ECHT, url: undefined })).toBeNull();
  });

  it("übersteht ein unbrauchbares Datum", () => {
    expect(zuRawListing({ ...ECHT, publishedAt: "gestern" })!.publishedAt).toBeNull();
    expect(zuRawListing({ ...ECHT, publishedAt: null })!.publishedAt).toBeNull();
  });

  it("stört sich nicht an unbekannten Feldern", () => {
    const l = zuRawListing({ ...ECHT, neuesFeldVonMorgen: { a: 1 } } as never);
    expect(l).not.toBeNull();
    expect(l!.title).toBe(ECHT.title);
  });
});

describe("der Abruf", () => {
  it("blättert mit per_page, nicht mit limit", async () => {
    /* Gemessen: `?limit=5` wird ignoriert und liefert fünfzig. */
    const { a, aufrufe } = adapter([{ data: [ECHT], meta: { page: 1 } }]);
    await a.fetchListings({ limit: 1 });
    expect(aufrufe[0]!.searchParams.get("per_page")).toBe("50");
    expect(aufrufe[0]!.searchParams.get("page")).toBe("1");
    expect(aufrufe[0]!.searchParams.get("limit")).toBeNull();
  });

  it("liefert bei leerem Ergebnis nichts, ohne zu scheitern", async () => {
    const { a } = adapter([{ data: [], meta: { page: 1 } }]);
    await expect(a.fetchListings({ limit: 10 })).resolves.toEqual([]);
  });

  it("lässt einen kaputten Datensatz den Stapel nicht mitnehmen", async () => {
    const warnung = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { a } = adapter([
      { data: [{ ...ECHT, slug: "" }, ECHT, { ...ECHT, url: "javascript:x" }], meta: {} },
    ]);
    const l = await a.fetchListings({ limit: 10 });
    expect(l).toHaveLength(1);
    expect(l[0]!.externalId).toBe(ECHT.slug);
    warnung.mockRestore();
  });

  it("weist eine Antwort ohne data zurück", async () => {
    const { a } = adapter([{ meta: { page: 1 } }]);
    await expect(a.fetchListings({ limit: 5 })).rejects.toThrow(/data/);
  });

  it("übersteht ungültiges JSON, ohne es für Erfolg zu halten", async () => {
    const { a } = adapter(["kaputt"]);
    await expect(a.fetchListings({ limit: 5 })).rejects.toThrow(/antwortete nicht/);
  });

  it("wiederholt nicht bei 404", async () => {
    /* Ein 404 wiederholt sich beliebig oft identisch. */
    const { a, aufrufe } = adapter([{}], 404);
    await expect(a.fetchListings({ limit: 5 })).rejects.toThrow(/404/);
    expect(aufrufe).toHaveLength(1);
  });

  it("wiederholt bei 429 und 5xx", async () => {
    for (const status of [429, 500, 502, 503]) {
      const { a, aufrufe } = adapter([{}], status);
      await expect(a.fetchListings({ limit: 5 })).rejects.toThrow();
      expect(aufrufe.length).toBeGreaterThan(1);
    }
  }, 30_000);

  it("hört nach begrenzten Versuchen auf", async () => {
    const { a, aufrufe } = adapter([{}], 503);
    await expect(a.fetchListings({ limit: 5 })).rejects.toThrow();
    expect(aufrufe.length).toBeLessThanOrEqual(3);
  }, 30_000);
});
