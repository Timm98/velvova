import { describe, expect, it } from "vitest";
import { BundesagenturAdapter, zuRawListing } from "./bundesagentur.ts";

/**
 * Gehalt aus der Jobbörse der Bundesagentur.
 *
 * Die Antwort enthält `gehaltsspanneVon` und `gehaltsspanneBis` — und
 * der Adapter las sie nicht. 248 Stellen aus dieser Quelle standen
 * deshalb ohne Gehalt im Produkt, obwohl die Anzeigen es mitliefern.
 *
 * Gefunden wurde es nicht im Code, sondern beim rekursiven Durchsuchen
 * einer echten Antwort. Im Adapter stand sogar ausdrücklich das
 * Gegenteil: „Die Schnittstelle nennt JAHRESGEHALT oder STUNDENLOHN,
 * aber keinen Betrag." Nach der eigenen Annahme zu programmieren heisst,
 * ihre Lücken zu übernehmen.
 */

const stelle = (over: Record<string, unknown>) => ({
  referenznummer: "X-1",
  stellenangebotsTitel: "Sachbearbeitung",
  firma: "Beispiel GmbH",
  stellenlokationen: [{ adresse: { ort: "Karlsruhe" } }],
  ...over,
});

/*
 * Zwei Aufrufe, zwei Antworten.
 *
 * Der Adapter holt erst die Trefferliste und danach je Treffer das
 * Detail — und verwirft jede Stelle ohne `stellenangebotsBeschreibung`
 * aus dem Detail. Der erste Mock beantwortete beide Aufrufe gleich;
 * damit fiel jede Anzeige durch, und die Gehaltsprüfung kam nie zum
 * Zug.
 */
async function hol(over: Record<string, unknown>) {
  const a = new BundesagenturAdapter({
    abfragen: ["test"],
    pauseMs: 0,
    fetchImpl: (async (eingabe: unknown) => {
      const url = String(eingabe);
      const koerper = url.includes("/jobdetails/")
        ? { ...stelle(over), stellenangebotsBeschreibung: "Eine Beschreibung mit genug Text, um als Anzeige zu zählen." }
        : { ergebnisliste: [stelle(over)] };
      return new Response(JSON.stringify(koerper), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch,
  });
  return (await a.fetchListings({ limit: 1 }))[0];
}

describe("Gehalt", () => {
  it("liest ein Jahresgehalt mit seinem Zeitraum", async () => {
    const l = await hol({
      verguetungsangabe: "JAHRESGEHALT",
      gehaltsspanneVon: 45000,
      gehaltsspanneBis: 50000,
    });
    expect(l?.salaryMin).toBe(45000);
    expect(l?.salaryMax).toBe(50000);
    expect(l?.salaryPeriod).toBe("year");
    expect(l?.salaryCurrency).toBe("EUR");
  });

  it("liest ein Festgehalt als Spanne der Breite null", async () => {
    /*
     * Der übersehene zweite Weg.
     *
     * Die Jobbörse gibt entweder eine Spanne oder einen Festbetrag an.
     * Gelesen wurde nur die Spanne; gemessen an 80 Anzeigen mit Betrag
     * waren 25 Festbeträge — knapp ein Drittel fiel still weg.
     */
    const l = await hol({
      verguetungsangabe: "JAHRESGEHALT",
      artDerVerguetung: "FESTGEHALT",
      festgehalt: 48000,
    });
    expect(l?.salaryMin).toBe(48000);
    expect(l?.salaryMax).toBe(48000);
    expect(l?.salaryPeriod).toBe("year");
  });

  it("liest einen festen Stundenlohn — mit Nachkommastellen", async () => {
    /*
     * Die Nachkommastellen sind der Punkt.
     *
     * Stundenlöhne sind fast immer krumm: der Mindestlohn ist 12,82 €,
     * Tariflöhne sind 17,65 € oder 19,30 €. Die Gehaltsspalten waren
     * Ganzzahlen, und deshalb scheiterte jede solche Anzeige beim
     * Schreiben mit „invalid input syntax for type integer" — still,
     * denn ein verworfenes Gehalt sieht aus wie ein nicht angegebenes.
     *
     * Gefunden wurde das nicht beim Lesen, sondern an zwei von 400
     * Anzeigen eines echten Importlaufs.
     */
    const l = await hol({
      verguetungsangabe: "STUNDENLOHN",
      artDerVerguetung: "FESTGEHALT",
      festgehalt: 17.65,
    });
    expect(l?.salaryMin).toBe(17.65);
    expect(l?.salaryPeriod).toBe("hour");
  });

  it("lässt die Spanne gewinnen, wenn beides dasteht", async () => {
    // Eine Spanne ist die reichere Auskunft. Ein danebenstehender
    // Festbetrag darf sie nicht überschreiben.
    const l = await hol({
      verguetungsangabe: "JAHRESGEHALT",
      gehaltsspanneVon: 45000,
      gehaltsspanneBis: 50000,
      festgehalt: 99000,
    });
    expect(l?.salaryMin).toBe(45000);
    expect(l?.salaryMax).toBe(50000);
  });

  it("verwirft ein unmögliches Festgehalt", async () => {
    /*
     * Echt vorgefunden: `{"verguetungsangabe":"JAHRESGEHALT",
     * "artDerVerguetung":"FESTGEHALT","festgehalt":15}`. Fünfzehn Euro
     * im Jahr ist keine Angabe, sondern ein Tippfehler in der Anzeige.
     */
    const l = await hol({
      verguetungsangabe: "JAHRESGEHALT",
      artDerVerguetung: "FESTGEHALT",
      festgehalt: 15,
    });
    expect(l?.salaryMin ?? null).toBeNull();
  });

  it("liest einen Stundenlohn als Stundenlohn", async () => {
    const l = await hol({
      verguetungsangabe: "STUNDENLOHN",
      gehaltsspanneVon: 25,
      gehaltsspanneBis: 27,
    });
    expect(l?.salaryPeriod).toBe("hour");
    expect(l?.salaryMin).toBe(25);
  });
});

describe("Was der Quelle nicht zu glauben ist", () => {
  it("verwirft einen Betrag, der dem Zeitraum widerspricht", async () => {
    /*
     * Aus einer echten Antwort: `STUNDENLOHN` mit `60000–85000`. Ein
     * Eingabefehler des Arbeitgebers — 60.000 € Stundenlohn gibt es
     * nicht.
     *
     * Der Zeitraum wird NICHT „korrigiert". Aus 60.000 pro Stunde
     * 60.000 pro Jahr zu machen wäre naheliegend und trotzdem geraten.
     * Eine fehlende Angabe ist ehrlich; eine sichtbar absurde Zahl
     * beschädigt das Vertrauen in alle anderen Zahlen daneben.
     */
    const l = await hol({
      verguetungsangabe: "STUNDENLOHN",
      gehaltsspanneVon: 60000,
      gehaltsspanneBis: 85000,
    });
    expect(l?.salaryMin ?? null).toBeNull();
  });

  it("nimmt einen Betrag ohne Zeitraum nicht", async () => {
    // „1700–2000" ist als Monatsgehalt plausibel und als Jahresgehalt
    // unmöglich. Ohne Zeitraum ist die Zahl keine Auskunft.
    const l = await hol({ gehaltsspanneVon: 1700, gehaltsspanneBis: 2000 });
    expect(l?.salaryMin ?? null).toBeNull();
  });

  it("lässt eine Anzeige ohne Gehaltsangabe unberührt", async () => {
    const l = await hol({ verguetungsangabe: "JAHRESGEHALT" });
    expect(l?.salaryMin ?? null).toBeNull();
  });
});

describe("Blättern", () => {
  /**
   * Der Grund, warum 327 Anzeigen im Bestand standen, während die
   * Jobbörse 999.398 führt: Der Adapter holte je Suchwort genau eine
   * Seite. Nicht die Schnittstelle war eng, sondern diese Schleife.
   */
  function adapterMit(seitenProSuchwort: number, abfragen: string[], gleichzeitig = 4) {
    const gesehen: string[] = [];
    const a = new BundesagenturAdapter({
      abfragen,
      pauseMs: 0,
      gleichzeitig,
      fetchImpl: (async (eingabe: unknown) => {
        const url = String(eingabe);
        gesehen.push(url);
        if (url.includes("/jobdetails/")) {
          return new Response(
            JSON.stringify({
              ...stelle({}),
              stellenangebotsBeschreibung: "Eine Beschreibung mit genug Text, um als Anzeige zu zählen.",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        const u = new URL(url);
        const seite = Number(u.searchParams.get("page") ?? "1");
        const was = u.searchParams.get("was") ?? "";
        if (seite > seitenProSuchwort) return new Response(JSON.stringify({ ergebnisliste: [] }), { status: 200 });
        // Je Suchwort und Seite eigene Referenznummern — sonst sähe
        // der Test Fortschritt, wo nur dieselbe Anzeige wiederkäme.
        const liste = Array.from({ length: 3 }, (_, i) => ({
          ...stelle({}),
          referenznummer: `${was}-${seite}-${i}`,
        }));
        return new Response(JSON.stringify({ ergebnisliste: liste }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    return { a, gesehen };
  }

  it("holt mehr als eine Seite je Suchwort", async () => {
    const { a } = adapterMit(4, ["disponent"]);
    const l = await a.fetchListings({ limit: 12 });
    expect(l).toHaveLength(12);
  });

  it("geht reihum, nicht ein Suchwort bis zum Anschlag", async () => {
    /*
     * Wird ein Lauf abgebrochen, soll der Zwischenstand alle Berufe
     * enthalten und nicht zehntausend Elektroniker. Deshalb erst Seite
     * 1 für jedes Suchwort, dann Seite 2 für jedes.
     */
    const { a, gesehen } = adapterMit(5, ["alpha", "beta", "gamma"]);
    await a.fetchListings({ limit: 9 });
    const suchen = gesehen
      .filter((u) => !u.includes("/jobdetails/"))
      .map((u) => {
        const p = new URL(u).searchParams;
        return `${p.get("was")}#${p.get("page")}`;
      });
    // Die ersten drei Anfragen sind Seite 1 aller drei Suchwörter.
    expect(suchen.slice(0, 3)).toEqual(["alpha#1", "beta#1", "gamma#1"]);
  });

  it("hört auf, wenn eine ganze Runde nichts Neues bringt", async () => {
    // Eine erschöpfte Suche weiterzublättern kostet nur Anfragen.
    const { a, gesehen } = adapterMit(1, ["disponent"]);
    await a.fetchListings({ limit: 1000 });
    const seiten = gesehen.filter((u) => !u.includes("/jobdetails/")).length;
    expect(seiten).toBe(2); // Seite 1 mit Treffern, Seite 2 leer — dann Schluss.
  });

  it("holt jede Anzeige genau einmal im Detail", async () => {
    // Bündelung darf keine Anzeige doppelt oder gar nicht abrufen.
    const { a, gesehen } = adapterMit(3, ["disponent"], 4);
    const l = await a.fetchListings({ limit: 9 });
    const details = gesehen.filter((u) => u.includes("/jobdetails/"));
    expect(details).toHaveLength(9);
    expect(new Set(details).size).toBe(9);
    expect(l).toHaveLength(9);
  });

  it("liefert bei Bündelgrösse 1 dasselbe wie bei 4", async () => {
    const einzeln = await adapterMit(3, ["disponent"], 1).a.fetchListings({ limit: 9 });
    const gebuendelt = await adapterMit(3, ["disponent"], 4).a.fetchListings({ limit: 9 });
    expect(gebuendelt.map((x) => x.externalId)).toEqual(einzeln.map((x) => x.externalId));
  });

  it("begrenzt die Bündelgrösse nach oben", async () => {
    // Eine Zahl, die jemand versehentlich auf 200 setzt, wäre kein
    // Tempogewinn, sondern ein Angriff auf eine öffentliche Quelle.
    const { a, gesehen } = adapterMit(3, ["disponent"], 200);
    await a.fetchListings({ limit: 9 });
    expect(gesehen.filter((u) => u.includes("/jobdetails/"))).toHaveLength(9);
  });
});

describe("Stellenart", () => {
  /*
   * Die Spalte `contract_type` kennt `apprenticeship` seit dem ersten
   * Entwurf. Nach 570.000 importierten Anzeigen standen fünf darin —
   * abgeleitet wurde allein aus `vertragsdauer`, die nur befristet und
   * unbefristet kennt. Diese Tests halten die Verdrahtung fest.
   */
  /* Die Beschreibung kommt erst aus dem Detailabruf — ohne sie fällt
     die Anzeige raus, unabhängig von der Stellenart. */
  const detail = { stellenangebotsBeschreibung: "Eine hinreichend lange Beschreibung der Stelle." };
  const stelle = (extra: Record<string, unknown>) => ({
    referenznummer: "10000-1234567890-S",
    stellenangebotsTitel: "Irgendwas",
    firma: "Beispiel GmbH",
    ...extra,
  });

  it("erkennt eine Ausbildung an der Stellenart, nicht an der Dauer", () => {
    const r = zuRawListing(stelle({ stellenangebotsart: "AUSBILDUNG", vertragsdauer: "BEFRISTET" }), detail);
    expect(r?.contractType).toBe("apprenticeship");
  });

  it("trennt Werkstudent vom Praktikum — die Jobbörse tut es nicht", () => {
    const praktikum = zuRawListing(
      stelle({ stellenangebotsart: "PRAKTIKUM_TRAINEE", stellenangebotsTitel: "Praktikum Marketing" }), detail);
    const werkstudent = zuRawListing(
      stelle({ stellenangebotsart: "PRAKTIKUM_TRAINEE", stellenangebotsTitel: "Werkstudent Rechnungswesen (m/w/d)" }), detail);
    expect(praktikum?.contractType).toBe("internship");
    expect(werkstudent?.contractType).toBe("working_student");
  });

  it("fällt bei ARBEIT auf die Vertragsdauer zurück", () => {
    expect(zuRawListing(stelle({ stellenangebotsart: "ARBEIT", vertragsdauer: "UNBEFRISTET" }), detail)?.contractType)
      .toBe("permanent");
    expect(zuRawListing(stelle({ stellenangebotsart: "ARBEIT", vertragsdauer: "KEINE_ANGABE" }), detail)?.contractType)
      .toBeNull();
  });

  it("übernimmt Schichtarbeit aus der Trefferliste", () => {
    expect(zuRawListing(stelle({ arbeitszeitSchichtNachtWochenende: true }), detail)?.shiftWork).toBe(true);
    expect(zuRawListing(stelle({}), detail)?.shiftWork).toBeNull();
  });
});

describe("Suche ohne Begriff", () => {
  /**
   * Über einem Ort ist ein Suchbegriff eine Verengung.
   *
   * Gemessen für die Postleitzahl 17291: ohne Begriff 480 Anzeigen,
   * mit „Sachbearbeitung" eine Handvoll. Wo der Ort schon eng genug
   * ist, kostet der Begriff Treffer.
   *
   * `was=` mitzuschicken ist etwas anderes als es wegzulassen —
   * deshalb wird der Parameter ausgelassen und nicht leer gesetzt.
   */
  function urlsFuer(abfragen: string[], orte: string[]) {
    const gesehen: string[] = [];
    const a = new BundesagenturAdapter({
      abfragen,
      orte,
      pauseMs: 0,
      fetchImpl: (async (eingabe: unknown) => {
        const url = String(eingabe);
        if (!url.includes("/jobdetails/")) gesehen.push(url);
        return new Response(JSON.stringify({ ergebnisliste: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    return { a, gesehen };
  }

  it("lässt `was` weg, wenn der Begriff leer ist", async () => {
    const { a, gesehen } = urlsFuer([""], ["Wittenberge"]);
    await a.fetchListings({ limit: 1 });
    expect(gesehen.length).toBeGreaterThan(0);
    for (const u of gesehen) {
      expect(new URL(u).searchParams.has("was"), u).toBe(false);
      expect(new URL(u).searchParams.get("wo")).toBe("Wittenberge");
    }
  });

  it("schickt `was` weiterhin mit, wenn ein Begriff da ist", async () => {
    const { a, gesehen } = urlsFuer(["Pflege"], ["Wittenberge"]);
    await a.fetchListings({ limit: 1 });
    expect(gesehen.length).toBeGreaterThan(0);
    expect(new URL(gesehen[0]!).searchParams.get("was")).toBe("Pflege");
  });
});
