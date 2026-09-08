import { describe, expect, it } from "vitest";
import {
  CareerjetAdapter,
  careerjetGehalt,
  careerjetGehaltStrukturiert,
  careerjetKennung,
  zuRawListing,
} from "./careerjet.ts";

/*
 * Eine echte Antwort, am 8. September 2026 abgerufen.
 *
 * Gekürzt, aber nicht geglättet: `salary` ist leer (so ist es bei 47
 * von 50 deutschen Anzeigen), `url` ist der Weiterleitungslink, und
 * `date` kommt im RFC-Format.
 */
const ECHT = {
  company: "Nowak & Partner",
  date: "Thu, 02 Jul 2026 07:53:07 GMT",
  description:
    "Bei uns entsteht Raum für Selbstständigkeit, Austausch und Fairness. Wir fördern den Zusammenhalt auf einer Ebene des respektvollen Miteinanders. Unsere Kanzlei nowak & partner ist ein mittelständisch",
  locations: "Karlsruhe, Baden-Württemberg",
  salary: "",
  site: "",
  title: "Industriekaufmann / Bürokauffrau / Sekretärin als Teamassistenz (m/w/d)",
  url: "https://jobviewtrack.com/v2/WAvuv05OpaEibOMQi2LQ1ElVzCWq1N4SFMoZiQ6pb4PH8p4t3B",
};

describe("die Kennung übersteht zwei Aufrufe", () => {
  it("hängt nicht an der URL", () => {
    /*
     * Gemessen am 8.9.2026: dieselben drei Stellen, dieselben Titel —
     * drei ANDERE URLs, eine Sekunde später. `url` zeigt auf
     * jobviewtrack.com und trägt ein Sitzungstoken.
     *
     * Als Kennung genommen wäre jede Anzeige bei jedem Lauf neu. Der
     * Bestand wüchse, und keine Zeile darin wäre eine neue Stelle.
     */
    const a = careerjetKennung(ECHT);
    const b = careerjetKennung({ ...ECHT, url: "https://jobviewtrack.com/v2/voellig-anders" });
    expect(a).toBe(b);
  });

  it("trennt zwei Ausschreibungen von verschiedenen Tagen", () => {
    const spaeter = careerjetKennung({ ...ECHT, date: "Fri, 03 Jul 2026 07:53:07 GMT" });
    expect(spaeter).not.toBe(careerjetKennung(ECHT));
  });

  it("trennt gleiche Titel bei verschiedenen Arbeitgebern", () => {
    expect(careerjetKennung({ ...ECHT, company: "Andere GmbH" })).not.toBe(careerjetKennung(ECHT));
  });
});

describe("der Gehaltstext", () => {
  it("liest die Formen, die wirklich vorkommen", () => {
    /* `herkunft: "text"` — die Zahl ist gelesen, nicht geliefert. */
    expect(careerjetGehalt("€45000 per year")).toEqual({
      min: 45_000,
      period: "year",
      currency: "EUR",
      herkunft: "text",
    });
    expect(careerjetGehalt("€28.33 per hour")).toEqual({
      min: 28.33,
      period: "hour",
      currency: "EUR",
      herkunft: "text",
    });
    expect(careerjetGehalt("€16.8 per hour")).toEqual({
      min: 16.8,
      period: "hour",
      currency: "EUR",
      herkunft: "text",
    });
  });

  it("liest englisch: Punkt ist das Komma", () => {
    /* „16.8" sind sechzehn Euro achtzig, nicht sechzehnachtzig. */
    expect(careerjetGehalt("€16.8 per hour")?.min).toBe(16.8);
    expect(careerjetGehalt("€1,500 per month")?.min).toBe(1500);
  });

  it("rät nicht, was es nicht sicher lesen kann", () => {
    /*
     * Ein falscher Betrag ist schlimmer als keiner: Er läuft in den
     * Gehaltsfilter, in den Vergleich und in die Zeile — und niemand
     * sieht ihm an, dass ein Muster ihn missverstanden hat.
     */
    for (const t of ["", "nach Vereinbarung", "attraktives Gehalt", "€ per year", "45000"]) {
      expect(careerjetGehalt(t)).toBeNull();
    }
  });
});

describe("das Gehalt aus den eigenen Feldern", () => {
  it("nimmt die Zahlen und nicht den Text", () => {
    /*
     * Am 8.9.2026 in einer japanischen Antwort entdeckt: neben
     * `salary` stehen `salary_min`, `salary_max`,
     * `salary_currency_code` und `salary_type`. Sie erscheinen nur,
     * wenn es einen Betrag gibt — bei den deutschen Stichproben war
     * `salary` leer, und deshalb fehlten sie ganz.
     */
    const l = zuRawListing(
      {
        ...ECHT,
        salary: "JP¥1100 per hour",
        salary_min: 1100,
        salary_max: 1400,
        salary_currency_code: "JPY",
        salary_type: "H",
      },
      "JP",
    );
    expect(l!.salaryMin).toBe(1100);
    expect(l!.salaryMax).toBe(1400);
    expect(l!.salaryCurrency).toBe("JPY");
    expect(l!.salaryPeriod).toBe("hour");
    /* Eigene Felder sind keine gelesenen Sätze. */
    expect(l!.salaryProvenance).toBe("provider");
  });

  it("führt Min gleich Max nicht als Spanne", () => {
    const l = zuRawListing(
      { ...ECHT, salary_min: 1100, salary_max: 1100, salary_currency_code: "JPY", salary_type: "H" },
      "JP",
    );
    expect(l!.salaryMin).toBe(1100);
    expect(l!.salaryMax).toBeNull();
  });

  it("fällt auf den Text zurück, wenn die Felder unbrauchbar sind", () => {
    const l = zuRawListing(
      { ...ECHT, salary: "€45000 per year", salary_min: 45_000, salary_type: "Q" },
      "DE",
    );
    /* `Q` kennt das Modell nicht — also der Text, und der ist gelesen. */
    expect(l!.salaryMin).toBe(45_000);
    expect(l!.salaryProvenance).toBe("text");
  });

  it("rechnet Tage und Wochen nicht um", () => {
    /*
     * `D` und `W` kennt unser Modell nicht. Sie umzurechnen hiesse,
     * eine Wochenarbeitszeit zu erfinden, die niemand genannt hat.
     */
    expect(careerjetGehaltStrukturiert({ salary_min: 200, salary_currency_code: "EUR", salary_type: "D" })).toBeNull();
    expect(careerjetGehaltStrukturiert({ salary_min: 900, salary_currency_code: "EUR", salary_type: "W" })).toBeNull();
  });
});

describe("die Umwandlung in eine Anzeige", () => {
  it("wirft Anzeigen ohne Arbeitgeber weg, statt einen zu erfinden", () => {
    /*
     * Gemessen: 45 von 50 japanischen Anzeigen tragen kein
     * `company`. Ein Platzhalter wäre eine erfundene Firma mit
     * Millionen Stellen — in der Arbeitgebersuche, in jeder Zeile
     * und in der Dublettenerkennung.
     */
    expect(zuRawListing({ ...ECHT, company: "" }, "JP")).toBeNull();
  });

  it("übernimmt die echte Antwort", () => {
    const l = zuRawListing(ECHT, "DE");
    expect(l).not.toBeNull();
    expect(l!.companyName).toBe("Nowak & Partner");
    expect(l!.location).toBe("Karlsruhe, Baden-Württemberg");
    expect(l!.country).toBe("DE");
    expect(l!.publishedAt?.getUTCFullYear()).toBe(2026);
    /* Ohne Gehaltstext steht kein Betrag da — und keiner wird erfunden. */
    expect(l!.salaryMin).toBeUndefined();
  });

  it("markiert einen gelesenen Betrag als gelesen", () => {
    const l = zuRawListing({ ...ECHT, salary: "€45000 per year" }, "DE");
    expect(l!.salaryMin).toBe(45_000);
    /*
     * `text` und nicht `provider`: Die Zahl stammt aus einem Satz,
     * den wir gelesen haben — nicht aus einem Feld, das der
     * Arbeitgeber ausgefüllt hat.
     */
    expect(l!.salaryProvenance).toBe("text");
  });

  it("wirft weg, was zu wenig Text hat", () => {
    expect(zuRawListing({ ...ECHT, description: "Kurz." }, "DE")).toBeNull();
    expect(zuRawListing({ ...ECHT, company: undefined }, "DE")).toBeNull();
    expect(zuRawListing({ ...ECHT, title: undefined }, "DE")).toBeNull();
  });
});

describe("der Abruf", () => {
  function adapter(antwort: unknown, status = 200) {
    const gesehen: { url: URL; init?: RequestInit }[] = [];
    const a = new CareerjetAdapter({
      country: "DE",
      apiKey: "test",
      referer: "https://velvova.com/",
      userIp: "203.0.113.1",
      userAgent: "Velvova-Jobimport/1.0",
      fetchImpl: (async (url: URL, init?: RequestInit) => {
        gesehen.push({ url, init });
        return {
          ok: status === 200,
          status,
          json: async () => antwort,
        } as unknown as Response;
      }) as unknown as typeof fetch,
    });
    return { a, gesehen };
  }

  it("schickt user_ip, user_agent und den Referer mit", async () => {
    const { a, gesehen } = adapter({ type: "JOBS", jobs: [ECHT], pages: 1 });
    await a.fetchListings({ limit: 1 });

    const { url, init } = gesehen[0]!;
    expect(url.searchParams.get("user_ip")).toBe("203.0.113.1");
    expect(url.searchParams.get("user_agent")).toBe("Velvova-Jobimport/1.0");
    /* Ohne Referer: 403 „Undeclared referrer". */
    expect((init?.headers as Record<string, string>).Referer).toBe("https://velvova.com/");
  });

  it("schickt den Schlüssel als Benutzername mit leerem Passwort", async () => {
    const { a, gesehen } = adapter({ type: "JOBS", jobs: [ECHT], pages: 1 });
    await a.fetchListings({ limit: 1 });
    const auth = (gesehen[0]!.init?.headers as Record<string, string>).Authorization ?? "";
    expect(Buffer.from(auth.replace("Basic ", ""), "base64").toString()).toBe("test:");
  });

  it("fragt nie mehr als fünfzig je Seite", async () => {
    /*
     * Gemessen: pagesize=50 → 50 Anzeigen, pagesize=100 → 20.
     * Ohne Fehlermeldung. Wer auf 100 stellt, halbiert den Durchsatz
     * und sieht nicht, warum.
     */
    const { a, gesehen } = adapter({ type: "JOBS", jobs: [ECHT], pages: 1 });
    await a.fetchListings({ limit: 1 });
    expect(Number(gesehen[0]!.url.searchParams.get("pagesize"))).toBeLessThanOrEqual(50);
  });

  it("hält eine 200er Antwort mit type ERROR nicht für Erfolg", async () => {
    /* Careerjet meldet Fehler mit HTTP 200 und `type: "ERROR"`. */
    const { a } = adapter({ type: "ERROR", error: "Undeclared referrer." });
    await expect(a.fetchListings({ limit: 5 })).rejects.toThrow(/Undeclared referrer/);
  });

  it("lehnt bekannte Platzhalter-IPs ab, bevor Careerjet es tut", async () => {
    /*
     * Gemessen: `0.0.0.0` antwortet mit `403 Invalid user_ip`. Der
     * Fehlertext nennt das Feld, aber nicht den Grund — und wer ihn
     * liest, sucht zuerst beim Schlüssel. Diese Meldung nennt den
     * Grund und den Ausweg.
     */
    const a = new CareerjetAdapter({
      country: "DE",
      apiKey: "test",
      userIp: "0.0.0.0",
      fetchImpl: (async () => {
        throw new Error("darf gar nicht erst gefragt werden");
      }) as unknown as typeof fetch,
    });
    await expect(a.fetchListings({ limit: 1 })).rejects.toThrow(/bekannter Platzhalter/);
  });

  it("hält zwischen zwei Seiten Abstand", async () => {
    /*
     * Gemessen am 8.9.2026: Zwanzig Abfragen in zwei Sekunden →
     * `403 Unauthorized access from IP …`. Nach 45 Sekunden lief es
     * wieder. Es ist eine Burst-Sperre, keine IP-Bindung — aber der
     * Fehlertext sagt das nicht, und ein nächtlicher Lauf meldete am
     * Morgen einen gesperrten Zugang, den es nie gab.
     */
    const seiten = Array.from({ length: 3 }, (_, i) => ({
      ...ECHT,
      title: `Stelle ${i}`,
      date: `Thu, 0${i + 1} Jul 2026 07:53:07 GMT`,
    }));
    const { a, gesehen } = adapter({
      type: "JOBS",
      jobs: Array.from({ length: 50 }, (_, i) => ({ ...seiten[0]!, title: `S${i}` })),
      pages: 5,
    });

    const t0 = Date.now();
    await a.fetchListings({ limit: 120 });
    const gebraucht = Date.now() - t0;

    /* Mindestens zwei Seiten, also mindestens eine Wartezeit. */
    expect(gesehen.length).toBeGreaterThan(1);
    expect(gebraucht).toBeGreaterThanOrEqual(900 * (gesehen.length - 1));
  }, 20_000);

  it("sagt es, wenn der Schlüssel fehlt", async () => {
    const ohne = new CareerjetAdapter({ country: "DE", apiKey: undefined });
    if (!ohne.isConfigured()) {
      await expect(ohne.fetchListings()).rejects.toThrow(/CAREERJET_API_KEY/);
    }
  });

  it("nennt sich je Land verschieden", () => {
    expect(new CareerjetAdapter({ country: "DE", apiKey: "x" }).key).toBe("careerjet_de");
    expect(new CareerjetAdapter({ country: "AT", apiKey: "x" }).key).toBe("careerjet_at");
    expect(new CareerjetAdapter({ country: "CH", apiKey: "x" }).displayName).toContain("Schweiz");
  });
});
