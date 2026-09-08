import { describe, expect, it } from "vitest";
import {
  AtsBoardAdapter,
  parseAshby,
  parseGreenhouse,
  parseLever,
  parseRecruitee,
  parseSmartRecruiters,
  recruiteeVollstaendig,
  smartRecruitersVollstaendig,
  type BoardRegistration,
} from "./board.ts";
import {
  ashbyResponse,
  recruiteeResponse,
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

describe("SmartRecruiters: Vollständigkeit und Arbeitsmodell", () => {
  const antwort = (content: unknown[], totalFound?: number) => ({
    offset: 0,
    limit: 100,
    ...(totalFound === undefined ? {} : { totalFound }),
    content,
  });
  const stelle = (extra: Record<string, unknown> = {}) => ({
    id: "744000137413079",
    name: "Data Operations Consultant",
    company: { name: "SmartRecruiters" },
    releasedDate: "2026-07-13T09:50:21.127Z",
    location: { city: "Poland", region: "Remote", country: "pl", remote: true, hybrid: false },
    ref: "https://api.smartrecruiters.com/v1/companies/x/postings/744000137413079",
    ...extra,
  });

  it("erkennt einen vollständigen Abruf an totalFound", () => {
    /*
     * Die Quelle nennt ihre Gesamtzahl. Das ist besser als jede
     * Schätzung: Es muss nichts gefolgert werden.
     */
    expect(smartRecruitersVollstaendig(antwort([stelle()], 1))).toBe(true);
  });

  it("erkennt einen abgeschnittenen Abruf", () => {
    /*
     * Ohne diese Prüfung gälte bei einem Arbeitgeber mit 300 Stellen
     * und einer Antwort von 100 der Rest als verschwunden.
     */
    expect(smartRecruitersVollstaendig(antwort([stelle()], 300))).toBe(false);
  });

  it("behauptet ohne totalFound nichts", () => {
    expect(smartRecruitersVollstaendig(antwort([stelle()]))).toBe(false);
    expect(smartRecruitersVollstaendig(null)).toBe(false);
    expect(smartRecruitersVollstaendig({ content: "kein Array" })).toBe(false);
  });

  it("nimmt remote und hybrid aus der Ortsangabe", () => {
    /* Zwei Felder des Arbeitgebers sind mehr wert als jede Ableitung
       aus einer Überschrift. */
    const [r] = parseSmartRecruiters(antwort([stelle()], 1), "SmartRecruiters");
    expect(r!.workModel).toBe("remote");
    expect(r!.country).toBe("PL");

    const [h] = parseSmartRecruiters(
      antwort([stelle({ location: { city: "Berlin", country: "de", remote: false, hybrid: true } })], 1),
      "X",
    );
    expect(h!.workModel).toBe("hybrid");
  });

  it("setzt bei Widerspruch kein Arbeitsmodell", () => {
    const [w] = parseSmartRecruiters(
      antwort([stelle({ location: { city: "Berlin", remote: true, hybrid: true } })], 1),
      "X",
    );
    expect(w!.workModel).toBeUndefined();
  });

  it("setzt ohne Angabe kein Arbeitsmodell", () => {
    const [o] = parseSmartRecruiters(
      antwort([stelle({ location: { city: "Berlin" } })], 1),
      "X",
    );
    expect(o!.workModel).toBeUndefined();
  });
});

// ── Recruitee ─────────────────────────────────────────────────────

describe("Recruitee", () => {
  const gelesen = parseRecruitee(recruiteeResponse, "Registrierter Name");
  const ersteAnzeige = gelesen[0]!;

  it("lässt Anzeigen ohne Weg zum Original weg", () => {
    /* Vier Angebote in der Antwort, drei mit Link. */
    expect(gelesen).toHaveLength(3);
    expect(gelesen.map((l) => l.title)).not.toContain("Ohne Link");
  });

  it("nimmt den Firmennamen aus der Antwort, nicht aus der Registrierung", () => {
    /*
     * Der Mandantenname ist bei Recruitee oft eine Marke.
     * `deintraumjobwartet.recruitee.com` gehört der ANGEHEUERT GmbH —
     * gemessen, kein konstruierter Fall.
     */
    expect(ersteAnzeige.companyName).toBe("Musterkälte GmbH");
    expect(gelesen.map((l) => l.companyName)).not.toContain("Registrierter Name");
  });

  it("fällt auf den registrierten Namen zurück, wenn das Feld fehlt", () => {
    const ohne = parseRecruitee(
      { offers: [{ ...recruiteeResponse.offers[0], company_name: null }] },
      "Registrierter Name",
    );
    expect(ohne[0]!.companyName).toBe("Registrierter Name");
  });

  describe("Gehalt", () => {
    it("macht aus den Zeichenketten Zahlen", () => {
      /*
       * Recruitee liefert `"46000"`, nicht `46000`. Ungeprüft
       * weitergereicht fände ein Vergleich später "9000" grösser als
       * "46000" — und niemand würde nach dem Grund suchen.
       */
      expect(ersteAnzeige.salaryMin).toBe(46_000);
      expect(typeof ersteAnzeige.salaryMin).toBe("number");
      expect(ersteAnzeige.salaryCurrency).toBe("EUR");
      expect(ersteAnzeige.salaryPeriod).toBe("year");
    });

    it("liest eine Spanne aus min und max", () => {
      const spanne = gelesen.find((l) => l.title.startsWith("Marketing"))!;
      expect(spanne.salaryMin).toBe(60_000);
      expect(spanne.salaryMax).toBe(72_000);
    });

    it("deutet ein leeres Gehaltsobjekt nicht als null Euro", () => {
      /* `{min: null, max: null}` heisst „nicht veröffentlicht". */
      const ohne = gelesen.find((l) => l.title.startsWith("Rezeption"))!;
      expect(ohne.salaryMin).toBeUndefined();
      expect(ohne.salaryMax).toBeUndefined();
      expect(ohne.salaryCurrency).toBeUndefined();
    });

    it("verwirft eine Periode, die unser Modell nicht kennt", () => {
      const fremd = parseRecruitee(
        { offers: [{ ...recruiteeResponse.offers[0], salary: { min: "10", max: null, period: "week", currency: "EUR" } }] },
        "X",
      );
      expect(fremd[0]!.salaryMin).toBe(10);
      expect(fremd[0]!.salaryPeriod).toBeUndefined();
    });
  });

  describe("Arbeitsmodell", () => {
    it("übernimmt einen einzeln gesetzten Schalter", () => {
      expect(ersteAnzeige.workModel).toBe("hybrid");
      expect(gelesen.find((l) => l.title.startsWith("Rezeption"))!.workModel).toBe("on_site");
    });

    it("lässt es leer, wenn mehrere Schalter gesetzt sind", () => {
      /*
       * 13 der 203 gemessenen Anzeigen tragen alle drei. Was das
       * heissen soll, sagt die Antwort nicht — und „vermutlich" ist
       * keine Grundlage für ein Feld, das genau einen Wert trägt.
       */
      const mehrdeutig = gelesen.find((l) => l.title.startsWith("Marketing"))!;
      expect(mehrdeutig.workModel).toBeUndefined();
    });

    it("bewahrt die drei Rohwerte, damit nichts verloren geht", () => {
      const mehrdeutig = gelesen.find((l) => l.title.startsWith("Marketing"))!;
      expect(mehrdeutig.raw).toMatchObject({ remote: true, hybrid: true, onSite: true });
    });
  });

  it("setzt Beschreibung und Anforderungen zusammen", () => {
    expect(ersteAnzeige.description).toContain("Wärmepumpen");
    expect(ersteAnzeige.description).toContain("Abgeschlossene Ausbildung");
    expect(ersteAnzeige.description).not.toContain("<");
  });

  it("liest Recruitees Datumsform", () => {
    /* `"2026-09-07 12:00:16 UTC"` — kein ISO-Format. */
    expect(ersteAnzeige.publishedAt?.toISOString()).toBe("2026-09-07T12:00:16.000Z");
  });

  it("übernimmt eine Frist, wo die Quelle eine nennt", () => {
    const mitFrist = gelesen.find((l) => l.title.startsWith("Marketing"))!;
    expect(mitFrist.expiresAt?.toISOString()).toBe("2026-10-31T23:59:59.000Z");
    /* Und erfindet keine, wo keine steht. */
    expect(ersteAnzeige.expiresAt).toBeNull();
  });

  it("hält den Bewerbungsweg vom Anzeigenlink getrennt", () => {
    expect(ersteAnzeige.originalUrl).toBe("https://musterkaelte.recruitee.com/o/kaeltetechniker-innendienst");
    expect(ersteAnzeige.applyTarget).toBe("https://musterkaelte.recruitee.com/o/kaeltetechniker-innendienst/c/new");
  });

  it("lässt eine Anzeige weg, die nicht veröffentlicht ist", () => {
    /*
     * Gemessen trägt `status` bei allen 203 Anzeigen `published` —
     * der Endpunkt liefert nur Veröffentlichtes. Die Wache steht für
     * den Tag, an dem das nicht mehr stimmt.
     */
    const entwurf = parseRecruitee(
      { offers: [{ ...recruiteeResponse.offers[0], status: "draft" }] },
      "X",
    );
    expect(entwurf).toHaveLength(0);
  });

  describe("Vollständigkeit", () => {
    it("erkennt eine Antwort mit offers-Feld", () => {
      expect(recruiteeVollstaendig(recruiteeResponse)).toBe(true);
      expect(recruiteeVollstaendig({ offers: [] })).toBe(true);
    });

    it("verweigert sie ohne offers-Feld", () => {
      /*
       * Ohne diese Wache würde ein Fehlerumschlag als vollständiger
       * Lauf durchgehen — und der ganze Bestand des Arbeitgebers als
       * verschwunden gelten.
       */
      expect(recruiteeVollstaendig({ error: "Not Found" })).toBe(false);
      expect(recruiteeVollstaendig(null)).toBe(false);
    });
  });

  it("überlebt Unbrauchbares in der Liste", () => {
    expect(parseRecruitee({ offers: [null, 42, "text"] }, "X")).toEqual([]);
    expect(parseRecruitee({ offers: "keine Liste" }, "X")).toEqual([]);
    expect(parseRecruitee(null, "X")).toEqual([]);
  });
});

describe("Recruitee: der Mandant darf keinen Host bilden", () => {
  /*
   * ── Warum das der gefährlichste Punkt des Adapters ist ────────
   *
   * Bei vier Anbietern steht der Bezeichner im PFAD, und
   * `encodeURIComponent` macht ihn harmlos. Bei Recruitee steht er in
   * der SUBDOMÄNE — und dort schützt Kodierung nicht: Ein Punkt bleibt
   * ein Punkt.
   *
   *     boardToken "evil.example.com"
   *     →  https://evil.example.com.recruitee.com/api/offers/
   *
   * Das ist noch der harmlose Fall. Mit einem Schrägstrich wird daraus
   * ein ganz anderer Host, und der Adapter schickt eine Anfrage, die
   * niemand autorisiert hat.
   *
   * Der Wurf passiert deshalb VOR dem Abruf. Diese Tests prüfen, dass
   * er passiert — und dass er den Lauf unvollständig macht, damit die
   * Verfügbarkeitslogik daraus nicht „verschwunden" schliesst.
   */
  const auth = { kind: "verified_domain" as const, reference: "Test", verifiedAt: new Date() };
  const mit = (boardToken: string) =>
    new AtsBoardAdapter("recruitee", () => [{ boardToken, employerName: "X", authorization: auth }]);

  it("weist einen Mandanten mit Punkt ab, ohne ihn abzurufen", async () => {
    const r = await mit("evil.example.com").fetchWithErrors({});
    expect(r.listings).toEqual([]);
    expect(r.errors[0]?.message).toMatch(/Unzulässiger Recruitee-Mandant/);
  });

  it("weist Pfadzeichen ab", async () => {
    const r = await mit("muster/../andere").fetchWithErrors({});
    expect(r.errors[0]?.message).toMatch(/Unzulässiger Recruitee-Mandant/);
  });

  it("macht den Lauf dabei unvollständig", async () => {
    /*
     * Sonst gälte ein Lauf, bei dem gar nichts abgerufen wurde, als
     * vollständige Momentaufnahme — und der ganze Bestand des
     * Arbeitgebers als verschwunden.
     */
    const r = await mit("evil.example.com").fetchWithErrors({});
    expect(r.vollstaendig).toBe(false);
  });
});
