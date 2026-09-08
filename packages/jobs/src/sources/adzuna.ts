import type { ProviderCapabilities } from "../adapter.ts";
import { envWert } from "../net.ts";
import { normaliseWorkModel, type FetchOptions, type JobSourceAdapter, type RawListing } from "../adapter.ts";

/**
 * Adzuna.
 *
 * Eine lizenzierte Schnittstelle mit Zugangsdaten. Sie liefert etwas,
 * das Arbeitnow nicht hat: Gehaltsangaben — teils gemeldet, teils
 * geschätzt. Der Unterschied wird mitgeführt und in der Oberfläche
 * ausgewiesen. Eine Schätzung, die wie eine Zusage aussieht, ist
 * schlimmer als keine Angabe.
 *
 * Ohne `ADZUNA_APP_ID` und `ADZUNA_APP_KEY` gilt die Quelle als nicht
 * eingerichtet und wird nicht abgefragt.
 */

interface AdzunaResult {
  id: string;
  title: string;
  description: string;
  created: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_time?: string;
  contract_type?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
}

export interface AdzunaOptions {
  appId?: string;
  appKey?: string;
  country?: string;
  /** Suchbegriffe. Ohne sie wird einmal ohne Begriff abgefragt. */
  abfragen?: string[];
  /**
   * Die Kategorienachse — dieselbe Technik wie bei der Jobbörse.
   *
   * ── Warum es sie braucht ──────────────────────────────────
   *
   * Je Abfrage sind höchstens 5.000 Anzeigen erreichbar (Seite 100 ×
   * 50, siehe `MAX_SEITE`). In den USA stehen 6,7 Millionen — ohne
   * weitere Achse bleiben 99,9 % davon unerreichbar, egal wie oft man
   * fragt.
   *
   * Eine Kategorie beginnt die Zählung von vorn. Gemessen für die USA:
   * `engineering-jobs` 509.232, `it-jobs` 471.708, `sales-jobs`
   * 326.799 — dreissig Kategorien je Land, jede mit eigenen 5.000.
   */
  kategorie?: string;
  /**
   * Die Ortsachse — die zweite Multiplikation.
   *
   * ── Warum es sie braucht ──────────────────────────────────
   *
   * Je Abfrage sind höchstens 5.000 Anzeigen erreichbar. Die
   * Kategorienachse bringt 30 × 5.000 je Land, also 150.000 von
   * beispielsweise 6,7 Millionen amerikanischen Anzeigen — 2 %.
   *
   * Ein Ort beginnt die Zählung erneut. Kategorie MAL Ort ergibt bei
   * zwanzig Städten das Zwanzigfache: 3 Millionen je Land, statt
   * 150.000.
   *
   * ── Was das kostet ────────────────────────────────────────
   *
   * Zwanzigmal so viele Anfragen. Adzuna drosselt bereits bei der
   * reinen Kategorienachse; mit der Ortsachse entscheidet nicht mehr
   * die Technik, sondern der Tarif.
   */
  wo?: string;
  /** Umkreis in Kilometern. Ohne ihn nimmt Adzuna seinen Standardwert. */
  umkreis?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Wie tief geblättert wird — und warum genau hundert.
 *
 * Gemessen am 2.9.2026: Adzuna beantwortet auch Seite 1.600 mit
 * fünfzig Treffern, aber es sind dieselben. Die Seiten 120, 200, 800
 * und 1.600 liefern identische Kennungen; neue Anzeigen kommen bis
 * Seite 100.
 *
 * Eine tiefe Seitenzahl ist also kein Beleg für Tiefe. Wer das nicht
 * misst, importiert zehntausendmal dieselben fünftausend Anzeigen und
 * hält den Bestand für gewachsen.
 *
 * Hier stand 20 — eine vorsichtige Zahl aus der Zeit, als das
 * Kontingent unbekannt war. Sie deckelte jeden Abruf bei tausend:
 * Österreich holte 1.000 statt der angeforderten 3.000, und es sah
 * nach einer Grenze des Anbieters aus.
 */
const MAX_SEITE = 100;

/**
 * Wie viele Seiten gleichzeitig geholt werden.
 *
 * ── Was gemessen wurde ────────────────────────────────────────
 *
 * Drei Importprozesse mit je vier gleichzeitigen Seiten sind zwölf
 * parallele Anfragen. Adzuna antwortete darauf mit 429 — nach 42, nach
 * 3, nach 41 Anzeigen. Ein Lauf über sieben Länder brachte 3.198
 * Stellen statt hunderttausend.
 *
 * Nachgemessen mit EINEM Prozess, sequenziell: zehn von zehn Anfragen
 * grün, auch ganz ohne Pause. Die Grenze ist also die
 * Gleichzeitigkeit, nicht das Tempo.
 *
 * Zwei statt vier, und über die Umgebung einstellbar — die richtige
 * Zahl hängt davon ab, wie viele Prozesse gerade laufen, und das
 * gehört nicht in den Code.
 */
const GLEICHZEITIG = Math.max(1, Math.min(8, Number(process.env.ADZUNA_GLEICHZEITIG ?? 1)));

/*
 * ══════════════════════════════════════════════════════════════
 * Jede Anfrage bekommt eine Frist — auch ohne Signal von aussen
 * ══════════════════════════════════════════════════════════════
 *
 * Hier stand `fetch(url, { signal: options.signal })`. Wer kein
 * Signal mitgab — und die Ernteskripte geben keines mit —, bekam
 * einen Abruf OHNE jede Zeitgrenze.
 *
 * Das ist nicht theoretisch. Am 8. September 2026 standen vier
 * Läufe (de, fr, it, nl) sechseinhalb Stunden still: schlafend, eine
 * offene Verbindung, null Prozent Last. Adzuna hatte die Verbindung
 * angenommen und dann nicht mehr geantwortet — und `fetch` wartet in
 * so einem Fall unbegrenzt.
 *
 * Ein hängender Lauf ist schlimmer als ein fehlgeschlagener: Der
 * fehlgeschlagene wird bemerkt und wiederholt, der hängende sieht
 * aus wie Arbeit.
 *
 * Die Frist umschliesst Anfrage UND Antwortkörper. Nur den
 * Verbindungsaufbau zu begrenzen liesse die zweite Hälfte desselben
 * Problems bestehen: Kopfzeilen da, Körper versiegt.
 */
const ANTWORT_FRIST_MS = Math.max(5_000, Number(process.env.ADZUNA_FRIST_MS ?? 45_000));

/**
 * Pause zwischen zwei Blöcken.
 *
 * ── Was die Messung ergab ─────────────────────────────────────
 *
 * Zehn sequenzielle Anfragen gehen auch ohne Pause durch — daraus
 * schloss ich zunächst, die Grenze sei die Gleichzeitigkeit. Ein Lauf
 * mit nur zwei gleichzeitigen Seiten sammelte über sieben Minuten
 * trotzdem zehn 429er ein.
 *
 * Es ist also keine Burst-Grenze, die eine kurze Probe zeigt, sondern
 * eine Lastgrenze über die Zeit. Eine einzelne Anfrage danach
 * antwortet wieder mit 200 — kein aufgebrauchtes Tageskontingent.
 *
 * Daraus folgt: langsam und dauerhaft statt schnell und gedrosselt.
 * Zwölf Millionen Anzeigen sind ohnehin kein Lauf von Stunden.
 */
const PAUSE_MS = Math.max(0, Number(process.env.ADZUNA_PAUSE_MS ?? 350));

/**
 * Die Länder, die dieser Anbieter für uns abdeckt.
 *
 * Gemessen am 2.9.2026 über die Zählung der Schnittstelle:
 * Deutschland 1.164.650, Schweiz 81.550, Österreich 33.078 Anzeigen.
 *
 * Angelegt war bisher nur Deutschland — nicht weil die anderen fehlten,
 * sondern weil `allAdapters()` genau eine Fassung ohne Land erzeugte.
 * Dieselbe stille Verengung wie bei den fünf Suchbegriffen der
 * Bundesagentur.
 */
export const ADZUNA_LAENDER = [
  // DACH zuerst — dort liegt der Schwerpunkt des Produkts.
  "de", "at", "ch",
  // Die übrigen, nach Bestandsgrösse (gemessen am 3.9.2026).
  "us", "fr", "br", "gb", "it", "in", "ca", "au",
  "nl", "mx", "es", "pl", "za", "be", "sg", "nz",
] as const;

const WAEHRUNG: Record<string, string | undefined> = {
  de: "EUR", at: "EUR", fr: "EUR", it: "EUR", nl: "EUR", es: "EUR", be: "EUR",
  ch: "CHF", us: "USD", br: "BRL", gb: "GBP", in: "INR", ca: "CAD",
  au: "AUD", mx: "MXN", pl: "PLN", za: "ZAR", sg: "SGD", nz: "NZD",
};

const LAND: Record<string, string> = {
  de: "Deutschland", at: "Österreich", ch: "Schweiz",
  us: "USA", fr: "Frankreich", br: "Brasilien", gb: "Grossbritannien",
  it: "Italien", in: "Indien", ca: "Kanada", au: "Australien",
  nl: "Niederlande", mx: "Mexiko", es: "Spanien", pl: "Polen",
  za: "Südafrika", be: "Belgien", sg: "Singapur", nz: "Neuseeland",
};

export class AdzunaAdapter implements JobSourceAdapter {
  /*
   * Die Kennung trägt das Land.
   *
   * Hier stand fest `adzuna_de`, während der Adapter das Land längst
   * im Konstruktor entgegennahm. Drei Länderfassungen hätten damit
   * dieselbe Kennung getragen und wären in `job_sources` zu einer
   * verschmolzen — die Herkunft einer Schweizer Anzeige stünde dann
   * als „Deutschland" da.
   */
  readonly key: string;
  readonly displayName: string;
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten von Adzuna. Bewerbung über die Originalanzeige.";
  readonly termsUrl = "https://developer.adzuna.com/";

  private readonly appId?: string;
  private readonly appKey?: string;
  private readonly country: string;
  private readonly fetchImpl: typeof fetch;
  /**
   * Suchbegriffe — der Weg über die 5.000er Grenze.
   *
   * Ohne Begriff liefert Adzuna den allgemeinen Bestand, und der endet
   * nach hundert Seiten. Mit Begriff beginnt die Zählung von vorn:
   * „Elektroniker" hat eigene hundert Seiten, „Erzieher" ebenfalls.
   * Dieselbe Mechanik wie bei der Bundesagentur — und derselbe
   * Wortschatz taugt dafür.
   */
  private readonly abfragen: string[];
  private readonly kategorie: string | null;
  private readonly wo: string | null;
  private readonly umkreis: number | null;

  constructor(options: AdzunaOptions = {}) {
    this.appId = options.appId ?? envWert("ADZUNA_APP_ID");
    this.appKey = options.appKey ?? envWert("ADZUNA_APP_KEY");
    this.country = (options.country ?? envWert("ADZUNA_COUNTRY") ?? "de").toLowerCase();
    this.abfragen = options.abfragen ?? [];
    this.kategorie = options.kategorie ?? null;
    this.wo = options.wo ?? null;
    this.umkreis = options.umkreis ?? null;
    this.key = `adzuna_${this.country}`;
    this.displayName = `Adzuna ${LAND[this.country] ?? this.country.toUpperCase()}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Adzuna kennt Suchbegriffe, Ort und Gehaltsfilter und liefert
   * Gehaltsspannen mit. Ein Ablaufdatum gibt es nicht; die API begrenzt
   * auf 50 Ergebnisse je Seite.
   */
  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: true,
    since: false,
    maxPerRequest: 50,
    rateLimitPerMinute: 25,
    salary: true,
    expiry: false,
    structuredRequirements: false,
  };

  isConfigured(): boolean {
    return Boolean(this.appId && this.appKey);
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "Adzuna ist nicht eingerichtet: ADZUNA_APP_ID oder ADZUNA_APP_KEY fehlt. " +
          "Es wird nichts abgerufen.",
      );
    }

    /*
     * ── Warum hier geblättert wird ────────────────────────────
     *
     * Die Adresse endete auf `/search/1` — fest verdrahtet Seite eins.
     * Ein Abruf mit Limit 400 holte deshalb 50 Anzeigen, und der
     * nächste dieselben 50. Die Quelle wirkte erschöpft; sie wurde nur
     * nie ein zweites Mal gefragt.
     *
     * ── Warum vorsichtiger als bei der Bundesagentur ──────────
     *
     * Adzuna ist ein kommerzieller Dienst mit einem Kontingent, dessen
     * Grösse wir nicht kennen. Deshalb: eine Seite nach der anderen,
     * Abbruch beim ersten unvollständigen Rückgabewert, und bei 429
     * kein Fehler, sondern Schluss mit dem, was schon da ist. Ein
     * halber Abruf ist besser als ein verbranntes Tageskontingent.
     */
    const ziel = options.limit ?? 50;
    const jeSeite = Math.min(50, this.capabilities.maxPerRequest);
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();

    /*
     * Ein Durchgang je Suchbegriff — und einer ohne, wenn keiner da ist.
     */
    const begriffe: (string | null)[] = this.abfragen.length > 0 ? [...this.abfragen] : [null];

    /*
     * ── Warum mehrere Seiten gleichzeitig ─────────────────────
     *
     * Eine Seite nach der anderen kostete gemessen 40 Anzeigen je
     * Sekunde — für den weltweiten Bestand von 12,3 Millionen wären
     * das 85 Stunden reiner Abruf.
     *
     * Adzuna beantwortet mehrere Anfragen nebeneinander. Vier
     * gleichzeitig ist kein Umgehen einer Taktgrenze: Bei 429 hört der
     * Lauf auf und behält, was da ist. Was fehlte, war der Mut, bei
     * grünen Antworten nicht zu bummeln.
     */
    begriffSchleife: for (const was of begriffe) {
      for (let block = 1; block <= MAX_SEITE && raus.length < ziel; block += GLEICHZEITIG) {
        const seiten = Array.from({ length: GLEICHZEITIG }, (_, k) => block + k).filter(
          (n) => n <= MAX_SEITE,
        );

        const antworten = await Promise.all(
          seiten.map(async (seite) => {
            const url = new URL(
              `https://api.adzuna.com/v1/api/jobs/${this.country}/search/${seite}`,
            );
            if (was) url.searchParams.set("what", was);
            url.searchParams.set("app_id", this.appId!);
            url.searchParams.set("app_key", this.appKey!);
            url.searchParams.set("results_per_page", String(jeSeite));
            url.searchParams.set("content-type", "application/json");
            if (this.kategorie) url.searchParams.set("category", this.kategorie);
            if (this.wo) {
              url.searchParams.set("where", this.wo);
              /* Ohne Umkreis liefert Adzuna nur den Ort selbst — die
                 Region ringsum fiele weg, und genau dort stehen die
                 meisten Anzeigen einer Stadt. */
              url.searchParams.set("distance", String(this.umkreis ?? 50));
            }
            if (options.since) {
              const days = Math.ceil((Date.now() - options.since.getTime()) / 86_400_000);
              url.searchParams.set("max_days_old", String(Math.max(1, days)));
            }
            /*
             * Die Frist des Aufrufers UND unsere eigene. `AbortSignal.any`
             * bricht ab, sobald eines von beiden auslöst — ein Lauf, den
             * jemand abbricht, hängt nicht noch 45 Sekunden nach.
             */
            const frist = AbortSignal.timeout(ANTWORT_FRIST_MS);
            const signal = options.signal
              ? AbortSignal.any([options.signal, frist])
              : frist;

            try {
              const antwort = await this.fetchImpl(url, { signal });
              if (!antwort.ok) return { ok: false as const, status: antwort.status, body: null };
              const koerper = (await antwort.json().catch(() => null)) as
                | { results?: AdzunaResult[] }
                | null;
              return { ok: true as const, status: antwort.status, body: koerper };
            } catch {
              /* Zeitablauf, Abbruch oder Netzfehler — hier alles dasselbe:
                 keine Antwort. Die Unterscheidung trifft der Aufrufer nicht,
                 er kann nur weitermachen oder aufhören. */
              return null;
            }
          }),
        );

        let neuImBlock = 0;
        let letzteVoll = true;

        for (const antwort of antworten) {
          if (!antwort || !antwort.ok) {
            /*
             * ── Was wir schon haben, wird nicht weggeworfen ────
             *
             * Ein Lauf für die Schweiz sammelte 553 Sekunden lang
             * Anzeigen, bekam dann einen vorübergehenden 503 und
             * lieferte null. Der Grund war eine Bedingung
             * `seite === 1`, die „ganz am Anfang" heissen sollte — mit
             * mehreren Suchbegriffen ist es aber der Anfang JEDES
             * Begriffs.
             *
             * Jetzt entscheidet, ob schon etwas geholt wurde. Ein
             * Fehler auf der allerersten Anfrage ist ein echter —
             * falscher Schlüssel, Dienst aus — und muss laut sein.
             */
            if (raus.length === 0) {
              throw new Error(
                `Adzuna antwortete mit ${antwort?.status ?? "keiner Antwort"}. ` +
                  "Es werden keine Stellen übernommen.",
              );
            }
            console.warn(
              `[adzuna] ${this.country}: ${antwort?.status ?? "keine Antwort"} nach ` +
                `${raus.length} Anzeigen — der Lauf endet mit dem, was da ist.`,
            );
            break begriffSchleife;
          }

          const treffer = antwort.body?.results ?? [];
          for (const r of treffer) {
            const l = this.toRawListing(r);
            if (gesehen.has(l.externalId)) continue;
            gesehen.add(l.externalId);
            raus.push(l);
            neuImBlock++;
          }
          if (treffer.length < jeSeite) letzteVoll = false;
        }

        // Eine nicht volle Seite im Block ist das Ende dieses Begriffs.
        if (!letzteVoll) break;
        /*
         * Ein ganzer Block ohne eine einzige neue Anzeige heisst:
         * Adzuna wiederholt sich. Gemessen kommen neue Anzeigen bis
         * Seite 100, danach dieselben.
         */
        if (neuImBlock === 0) break;
        if (raus.length >= ziel) break begriffSchleife;
        if (PAUSE_MS > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
    }

    return raus.slice(0, ziel);
  }

  private toRawListing(r: AdzunaResult): RawListing {
    const location = r.location?.display_name?.trim() || "Nicht angegeben";
    /*
     * Adzuna kennzeichnet geschätzte Gehälter mit "1".
     *
     * Hier stand: „eine Schätzung wandert in die Rohdaten und wird in
     * der Oberfläche als solche ausgewiesen" — und die Werte wurden auf
     * `null` gesetzt. Beides gab es nicht: keine Rohdatenspalte, kein
     * Anzeigepfad. Die Angabe war weg, und 83 Adzuna-Stellen standen
     * ohne Gehalt im Produkt.
     *
     * Jetzt bleibt der Betrag und trägt seine Herkunft:
     * `board_estimate`. Wegwerfen war die falsche Antwort,
     * ungekennzeichnet übernehmen wäre die schlimmere.
     */
    const predicted = r.salary_is_predicted === "1";

    return {
      externalId: String(r.id),
      title: r.title.replace(/<[^>]+>/g, "").trim(),
      companyName: r.company?.display_name?.trim() || "Nicht angegeben",
      location,
      country: this.country.toUpperCase(),
      workModel: normaliseWorkModel(`${r.title} ${location}`),
      salaryMin: r.salary_min ?? null,
      salaryMax: r.salary_max ?? null,
      salaryProvenance: predicted ? ("board_estimate" as const) : undefined,
      /*
       * Die Währung folgt dem Land, nicht der Ausnahme.
       *
       * Hier stand `country === "de" ? "EUR" : undefined` — richtig,
       * solange es nur Deutschland gab. Für Österreich wäre der Euro
       * damit unbekannt gewesen, und ein Schweizer Gehalt hätte als
       * Euro gelten können. `waehrungBestimmen()` prüft das später
       * gegen das Land der Stelle, aber eine falsche Angabe hier
       * heisst, ihm eine falsche Auskunft zu geben.
       */
      salaryCurrency: WAEHRUNG[this.country],
      salaryPeriod: "year",
      contractType:
        r.contract_type === "permanent"
          ? "permanent"
          : r.contract_type === "contract"
            ? "fixed_term"
            : null,
      industry: r.category?.label ?? null,
      description: r.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      applyMethod: "portal",
      applyTarget: r.redirect_url,
      originalUrl: r.redirect_url,
      publishedAt: r.created ? new Date(r.created) : null,
      raw: {
        /*
         * Die vollständige Antwort des Anbieters.
         *
         * Alles andere hier ist handverlesen: Felder, die jemand einmal
         * gesehen und für wichtig gehalten hat. Genau daran ist die
         * Gehaltsauswertung schon einmal gescheitert — die Bundesagentur
         * schickt `gehaltsspanneVon`, und im Adapter stand ein Kommentar,
         * sie sende „keinen Betrag". Der Kommentar war falsch, und
         * niemand konnte es merken: Im Schnappschuss stand das Feld
         * nicht.
         *
         * Ein Feld, das niemand kennt, findet man nur in der ganzen
         * Antwort. `scripts/gehalt-rohdaten.mjs` sucht darin rekursiv.
         */
        rohantwort: r as unknown as Record<string, unknown>,
        source: "adzuna",
        salaryIsPredicted: predicted,
        predictedSalaryMin: predicted ? (r.salary_min ?? null) : null,
        predictedSalaryMax: predicted ? (r.salary_max ?? null) : null,
        contractTime: r.contract_time ?? null,
      },
    };
  }
}
