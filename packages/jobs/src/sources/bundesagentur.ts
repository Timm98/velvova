import type { Herkunft } from "@paycheck/domain";
import {
  DEFAULT_CAPABILITIES,
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { holJson } from "../net.ts";

/**
 * Die Jobbörse der Bundesagentur für Arbeit.
 *
 * ── Warum diese Quelle anders ist als alle anderen ────────────
 *
 * Sie ist staatlich, öffentlich dokumentiert und braucht keinen
 * Vertrag. Der Zugangsschlüssel ist derselbe, den die Jobbörse der
 * Bundesagentur in ihrer eigenen Weboberfläche verwendet; er ist über
 * die bundesAPI-Initiative veröffentlicht. Es gibt hier nichts zu
 * umgehen und nichts abzugreifen — die Schnittstelle ist zur Nutzung
 * da.
 *
 * Im Quellenverzeichnis stand sie trotzdem gesperrt, mit der
 * Begründung „Keine dokumentierte Schnittstelle für Stellenangebote".
 * Das war einmal richtig und ist es nicht mehr.
 *
 * ── Was sie liefert, das sonst niemand liefert ────────────────
 *
 * Gemessen an 60 echten Anzeigen:
 *
 *   **Beschreibung: 15 von 15.** Vollständige Texte, 3000 Zeichen
 *   aufwärts. Bei anderen Quellen ist der Text oft gekürzt.
 *
 *   **Vertragsdauer als Feld.** `UNBEFRISTET` / `BEFRISTET` bei 40 von
 *   60 — sonst müsste das aus dem Fliesstext geraten werden.
 *
 *   **Homeoffice als Feld.** Nicht aus Wörtern wie „flexibel"
 *   erschlossen, sondern angegeben.
 *
 *   **Die Art der Vergütung.** `JAHRESGEHALT` oder `STUNDENLOHN` bei
 *   11 von 60. Kein Betrag — aber es sagt, WORAUF sich eine Zahl im
 *   Text bezieht. Genau diese Zuordnung muss der Textextraktor sonst
 *   raten, und Raten ist bei Geld der teure Teil.
 *
 * ── Zwei Abrufe je Stelle ─────────────────────────────────────
 *
 * Die Suche liefert alles ausser dem Beschreibungstext; den gibt es
 * nur einzeln. Das ist ein Abruf mehr je Stelle, und deshalb steht
 * unten eine Pause zwischen den Aufrufen: eine öffentliche Behörde im
 * Sekundentakt anzufragen wäre dieselbe Rücksichtslosigkeit wie bei
 * jedem anderen Anbieter, nur ohne Rechnung, die es bremst.
 */

interface Suchantwort {
  ergebnisliste?: Stelle[];
  maxErgebnisse?: number;
}

interface Stelle {
  referenznummer?: string;
  stellenangebotsTitel?: string;
  firma?: string;
  hauptberuf?: string;
  vertragsdauer?: string;
  /** ARBEIT, AUSBILDUNG, PRAKTIKUM_TRAINEE oder SELBSTAENDIGKEIT. */
  stellenangebotsart?: string;
  arbeitszeitSchichtNachtWochenende?: boolean;
  verguetungsangabe?: string;
  /*
   * Die Zahlen zur Vergütungsangabe.
   *
   * Sie standen in der Antwort der Jobbörse von Anfang an — und wurden
   * hier nie gelesen. Der Adapter nahm `verguetungsangabe` mit, also
   * die ART der Angabe („JAHRESGEHALT"), und liess die Beträge liegen.
   *
   * Ergebnis: 248 Stellen aus dieser Quelle, null davon mit Gehalt im
   * Produkt, obwohl die Anzeigen es mitliefern. Gefunden nicht im Code,
   * sondern beim rekursiven Durchsuchen einer echten Antwort
   * (`scripts/rohantwort-pruefen.mjs`).
   */
  gehaltsspanneVon?: number;
  gehaltsspanneBis?: number;
  /*
   * Der zweite Weg, ein Gehalt anzugeben — und der übersehene.
   *
   * Die Jobbörse kennt zwei Formen: `GEHALTSSPANNE` mit Von und Bis,
   * und `FESTGEHALT` mit genau einer Zahl in `festgehalt`. Gelesen
   * wurde nur die erste. Gemessen an 80 Anzeigen mit Betrag: 55 mit
   * Spanne, 25 mit Festbetrag — also fiel knapp ein Drittel aller
   * Gehaltsangaben dieser Quelle still weg.
   *
   * Ein Festgehalt ist keine unvollständige Spanne. Es ist eine Spanne
   * der Breite null: Von und Bis sind derselbe Betrag.
   */
  artDerVerguetung?: string;
  festgehalt?: number;
  homeofficemoeglich?: boolean;
  homeofficetyp?: string | null;
  arbeitszeitVollzeit?: boolean;
  datumErsteVeroeffentlichung?: string;
  eintrittszeitraum?: { von?: string };
  stellenlokationen?: { adresse?: { ort?: string; plz?: string; region?: string } }[];
  arbeitgeberKundennummerHash?: string;
}

interface Detail extends Stelle {
  stellenangebotsBeschreibung?: string;
  allianzpartnerUrl?: string | null;
}

const BASIS = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
/*
 * Der Schlüssel ist keine Zugangsbeschränkung, sondern eine Kennung.
 *
 * Die Bundesagentur verwendet ihn in ihrer eigenen Weboberfläche und
 * hat ihn über bundesAPI veröffentlicht. Er steht deshalb im Code und
 * nicht in `.env.local`: es gibt nichts geheimzuhalten, und ein
 * Platzhalter, den jeder erst nachschlagen müsste, hielte die Quelle
 * ohne Not abgeschaltet.
 */
const KENNUNG = "jobboerse-jobsuche";

/**
 * Wie tief geblättert werden darf.
 *
 * Gemessen: Seite 100 wird bedient, Seite 200 antwortet mit 400.
 * Hundert Seiten à hundert Treffer sind 10.000 Anzeigen je Suchwort —
 * mehr, als ein einzelner Beruf hergibt.
 */
const MAX_SEITE = 100;

export interface BundesagenturOptions {
  /** Suchbegriffe. Ohne sie fragt der Adapter nichts ab. */
  abfragen?: string[];
  /**
   * Zusätzliche Filter der Jobbörse — die dritte Suchachse.
   *
   * ── Warum es sie braucht ──────────────────────────────────
   *
   * Je Suchbegriff gibt die Jobbörse höchstens 10.000 Anzeigen heraus.
   * Mit 3.600 Begriffen wären das rechnerisch 36 Millionen Plätze —
   * und trotzdem blieben wir bei 52,7 % ihres Bestands stehen: Die
   * obersten 10.000 zu einem Begriff überschneiden sich stark mit
   * denen zu einem verwandten.
   *
   * Ein Filter beginnt die Zählung von vorn. Gemessen am 3.9.2026:
   *
   *   ohne Filter          1.012.401
   *   arbeitszeit=vz         840.072
   *   arbeitszeit=tz         225.369
   *   zeitarbeit=false       798.453
   *   befristung=1            33.309
   *
   * „Teilzeit" fördert Anzeigen zutage, die bei einer Suche ohne
   * Filter unterhalb von Platz 10.000 lagen — und damit unerreichbar
   * waren.
   */
  zusatz?: Record<string, string>;
  /**
   * Detailabrufe je Bündel. Höchstens acht, voreingestellt vier.
   *
   * Die Obergrenze steht hier und nicht im Aufrufer: Eine Zahl, die
   * jemand versehentlich auf 200 setzt, wäre kein Tempogewinn,
   * sondern ein Angriff.
   */
  gleichzeitig?: number;
  /** Orte. Leer heisst bundesweit. */
  orte?: string[];
  fetchImpl?: typeof fetch;
  /** Millisekunden zwischen zwei Detailabrufen. */
  pauseMs?: number;
}

/**
 * Standardsuchen für den Bestandsabruf.
 *
 * Breit und deutschsprachig. Die Suche einer einzelnen Person läuft
 * über `abfragen` und über die Suchrichtungen aus ihrem Profil.
 */
/**
 * Die Grundausstattung.
 *
 * Sie wird nicht ersetzt, sondern ergänzt — siehe `registry.ts`. Der
 * Grund steht in einer Messung: Über 63 Konten mit Belegen überschritten
 * nur drei aus Profilen abgeleitete Richtungen die Schwelle. Hätte man
 * die Liste hier durch sie ersetzt, wäre der Bestand von fünf auf drei
 * Richtungen geschrumpft — das Gegenteil des Ziels.
 */
/**
 * Suchwörter, wenn keine übergeben werden.
 *
 * ── Warum diese Liste so klein ist und wer sie ersetzt ────────
 *
 * Fünf Wörter. Genau deshalb standen 327 Anzeigen dieser Quelle im
 * Bestand, obwohl die Jobbörse 999.398 führt: Der Adapter fand nur,
 * wonach er fragte, und gefragt hat er nach fünf Dingen.
 *
 * Ersetzt wird sie von den **amtlichen Berufsbezeichnungen**, die in
 * `beruf_zuordnung` stehen — dem eigenen Wortschatz der Jobbörse.
 * `berufsabfragen()` in `berufsabfragen.ts` liest sie; dieser Wert
 * hier ist nur noch der Rückfall für den Fall, dass die Tabelle leer
 * ist (frische Datenbank, erster Lauf).
 */
export const STANDARDSUCHEN = [
  "Sachbearbeitung",
  "Kundenbetreuung",
  "Disposition",
  "Büromanagement",
  "Vertriebsinnendienst",
];

export class BundesagenturAdapter implements JobSourceAdapter {
  readonly key = "bundesagentur";
  readonly displayName = "Bundesagentur für Arbeit";
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  /*
   * `licensed_partner`, nicht `aggregator`.
   *
   * Die Jobbörse sammelt zwar auch, aber Arbeitgeber stellen ihre
   * Anzeigen dort selbst ein — sie ist die Stelle, an der die Anzeige
   * veröffentlicht wurde, nicht eine Kopie davon.
   */
  readonly herkunft: Herkunft = "licensed_partner";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten aus der Jobbörse der Bundesagentur für Arbeit.";
  readonly termsUrl = "https://www.arbeitsagentur.de/datenschutz-arbeitsagentur";

  private readonly abfragen: string[];
  private readonly orte: string[];
  /** Wie viele Detailabrufe gleichzeitig laufen dürfen. */
  private readonly gleichzeitig: number;
  /** Zusätzliche Filter der Jobbörse — die dritte Suchachse. */
  private readonly zusatz: Record<string, string>;
  private readonly fetchImpl?: typeof fetch;
  private readonly pauseMs: number;

  constructor(o: BundesagenturOptions = {}) {
    this.abfragen = o.abfragen ?? STANDARDSUCHEN;
    this.orte = o.orte ?? [];
    this.fetchImpl = o.fetchImpl;
    this.pauseMs = o.pauseMs ?? 120;
    this.gleichzeitig = Math.max(1, Math.min(8, o.gleichzeitig ?? 4));
    this.zusatz = o.zusatz ?? {};
  }

  readonly capabilities: ProviderCapabilities = {
    ...DEFAULT_CAPABILITIES,
    search: true,
    details: true,
    /*
     * Es gibt `veroeffentlichtseit` in Tagen, aber keinen Zeitpunkt.
     * Ein Filter, der so tut, als könnte er mehr, holt bei jedem Lauf
     * zu viel oder zu wenig — und niemand merkt es.
     */
    since: false,
    /*
     * Gemessen, nicht geschätzt: `size=100` wird bedient. Hier stand
     * 50 — die Hälfte jeder Anfrage blieb ungenutzt.
     */
    maxPerRequest: 100,
    rateLimitPerMinute: null,
    /*
     * Die Quelle liefert Gehalt — `gehaltsspanneVon`/`-Bis`. Hier stand
     * `false`, weil niemand nachgesehen hatte.
     */
    salary: true,
    expiry: false,
    structuredRequirements: false,
  };

  /** Kein Schlüssel nötig — die Quelle ist immer einsatzbereit. */
  isConfigured(): boolean {
    return true;
  }

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    /*
     * ── Warum hier geblättert wird ────────────────────────────
     *
     * Die erste Fassung holte je Suchwort genau eine Seite. Bei fünf
     * Suchwörtern und höchstens 50 Treffern je Seite waren das 250
     * Anzeigen — aus einem Bestand von **999.398**. Der Engpass war
     * nie die Schnittstelle, sondern diese Schleife.
     *
     * Gemessen: `size=100` wird bedient, und `page` trägt bis 100.
     * Ab 200 antwortet die Jobbörse mit 400. Je Suchwort sind also
     * rund 10.000 Anzeigen erreichbar — mehr als genug, denn kein
     * einzelner Beruf hat so viele.
     */
    const gefunden: Stelle[] = [];
    const gesehen = new Set<string>();
    const ziel = options.limit ?? 50;

    const suchen: { was: string; wo: string | null }[] = [];
    for (const was of this.abfragen) {
      for (const wo of this.orte.length > 0 ? this.orte : [null]) suchen.push({ was, wo });
    }

    /*
     * Erst eine Seite je Suchwort, dann die zweite, dann die dritte.
     *
     * Nicht ein Suchwort bis zum Anschlag: Wer „Elektroniker" zehntausend
     * Mal blättert, bevor „Erzieher" ein einziges Mal drankommt, hat bei
     * einem Abbruch einen Bestand aus einem einzigen Beruf. Reihum
     * bleibt jeder Zwischenstand brauchbar.
     */
    for (let seite = 1; seite <= MAX_SEITE && gefunden.length < ziel; seite++) {
      let neueAufDieserRunde = 0;

      for (const { was, wo } of suchen) {
        if (gefunden.length >= ziel) break;

        const url = new URL(`${BASIS}/pc/v6/jobs`);
        /*
         * Ein leerer Suchbegriff heisst: gar keiner.
         *
         * ── Wozu das gut ist ──────────────────────────────────
         *
         * Über einem Ort ist ein Suchbegriff eine Verengung. Gemessen
         * für die Postleitzahl 17291: ohne Begriff 480 Anzeigen, mit
         * „Sachbearbeitung" eine Handvoll. Wo der Ort schon eng genug
         * ist, kostet der Begriff Treffer, statt welche zu erschliessen.
         *
         * `was=` mitzuschicken ist etwas anderes als es wegzulassen —
         * deshalb die Auslassung und keine leere Zuweisung.
         */
        if (was) url.searchParams.set("was", was);
        if (wo) {
          url.searchParams.set("wo", wo);
          /*
           * Fünfzig Kilometer um den Ort.
           *
           * Ohne Umkreis trifft `wo` nur den Ort selbst, und alles
           * dazwischen fällt heraus. Mit fünfzig überschneiden sich
           * benachbarte Städte — das kostet Anfragen und bringt
           * Dubletten, und beides ist billiger als eine Lücke: Eine
           * doppelt geholte Anzeige führt der Import zusammen, eine
           * nie geholte fehlt für immer.
           */
          url.searchParams.set("umkreis", "50");
        }
        url.searchParams.set("size", String(this.capabilities.maxPerRequest));
        url.searchParams.set("page", String(seite));
        /* Die dritte Achse: Arbeitszeit, Zeitarbeit, Befristung. */
        for (const [k, v] of Object.entries(this.zusatz)) url.searchParams.set(k, v);

        const antwort = await holJson<Suchantwort>({
          provider: "Bundesagentur",
          url: url.toString(),
          headers: { "X-API-Key": KENNUNG },
          signal: options.signal,
          fetchImpl: this.fetchImpl,
        }).catch(() => null);

        for (const s of antwort?.ergebnisliste ?? []) {
          if (!s.referenznummer || gesehen.has(s.referenznummer)) continue;
          gesehen.add(s.referenznummer);
          gefunden.push(s);
          neueAufDieserRunde++;
        }

        if (this.pauseMs > 0) await warte(this.pauseMs);
      }

      /*
       * Nichts Neues auf einer ganzen Runde heisst: die Suchwörter
       * sind erschöpft. Weiterzublättern kostet nur Anfragen.
       */
      if (neueAufDieserRunde === 0) break;
    }

    const auswahl = options.limit ? gefunden.slice(0, options.limit) : gefunden;
    /*
     * ── Detailabrufe in kleinen Bündeln ───────────────────────
     *
     * Jede Anzeige braucht ihren Volltext — ohne Beschreibung ist sie
     * für uns wertlos (siehe `zuRawListing`). Das ist eine Anfrage je
     * Stelle, und einzeln nacheinander waren das gemessen 0,43
     * Sekunden pro Anzeige. Für einen Bestand in fünfstelliger
     * Grössenordnung sind das Tage.
     *
     * Vier gleichzeitig, dann eine Pause. Das ist keine Umgehung
     * einer Taktgrenze: `holJson` staffelt bei 429 und 5xx von selbst
     * zurück und wiederholt gebremst. Wer zu schnell ist, wird
     * dadurch automatisch langsamer — was fehlte, war der Mut, bei
     * grünen Antworten nicht künstlich zu bummeln.
     *
     * Vier und nicht vierzig: Der Gewinn ist bei kleinen Bündeln fast
     * derselbe, das Risiko, einer öffentlichen Schnittstelle zur Last
     * zu fallen, ist es nicht.
     */
    const raus: RawListing[] = [];

    for (let i = 0; i < auswahl.length; i += this.gleichzeitig) {
      const buendel = auswahl.slice(i, i + this.gleichzeitig);
      const details = await Promise.all(
        buendel.map((s) => this.detail(s.referenznummer!, options.signal).catch(() => null)),
      );
      for (const [j, s] of buendel.entries()) {
        const roh = zuRawListing(s, details[j] ?? null);
        if (roh) raus.push(roh);
      }
      // Rücksicht statt Tempo. Siehe Kopfkommentar.
      if (this.pauseMs > 0) await warte(this.pauseMs);
    }

    return raus;
  }

  private async detail(referenznummer: string, signal?: AbortSignal): Promise<Detail> {
    // Der Detailpfad erwartet die Referenznummer base64-kodiert.
    const kodiert = Buffer.from(referenznummer, "utf8").toString("base64");
    return holJson<Detail>({
      provider: "Bundesagentur",
      url: `${BASIS}/pc/v4/jobdetails/${kodiert}`,
      headers: { "X-API-Key": KENNUNG },
      signal,
      versuche: 2,
      fetchImpl: this.fetchImpl,
    });
  }
}

export function zuRawListing(s: Stelle, detail: Detail | null): RawListing | null {
  const titel = (detail?.stellenangebotsTitel ?? s.stellenangebotsTitel ?? "").trim();
  const firma = (detail?.firma ?? s.firma ?? "").trim();
  const text = (detail?.stellenangebotsBeschreibung ?? "").trim();
  const ref = s.referenznummer;

  /*
   * Ohne Beschreibung ist die Stelle für uns wertlos.
   *
   * Die gesamte Einschätzung hängt am Text: Aufgaben, Anforderungen,
   * Mondays Begründung, die Gehaltslesung. Eine Zeile mit Titel und Firma
   * stünde in der Liste und gäbe beim Öffnen nichts her.
   */
  if (!ref || !titel || !firma || text.length < 40) return null;

  const adresse = (detail?.stellenlokationen ?? s.stellenlokationen ?? [])[0]?.adresse;
  const ort = [adresse?.ort, region(adresse?.region)].filter(Boolean).join(", ") || "Deutschland";

  const art = detail?.verguetungsangabe ?? s.verguetungsangabe ?? null;

  return {
    externalId: ref,
    title: titel,
    companyName: firma,
    location: ort,
    country: "DE",
    workModel: arbeitsmodell(detail?.homeofficetyp ?? s.homeofficetyp, detail?.homeofficemoeglich ?? s.homeofficemoeglich),
    contractType: vertragsart(
      detail?.stellenangebotsart ?? s.stellenangebotsart,
      detail?.vertragsdauer ?? s.vertragsdauer,
      titel,
    ),
    /* Die Spalte gibt es längst; gefüllt hat sie bisher niemand. */
    shiftWork: (detail?.arbeitszeitSchichtNachtWochenende ?? s.arbeitszeitSchichtNachtWochenende) ?? null,
    /*
     * Der Beschreibungstext bekommt die Vergütungsart vorangestellt.
     *
     * Hier stand: „Die Schnittstelle nennt JAHRESGEHALT oder
     * STUNDENLOHN, aber keinen Betrag." Das war falsch, und der Irrtum
     * kostete 248 Stellen ihre Gehaltsangabe: Die Antwort enthält sehr
     * wohl `gehaltsspanneVon` und `gehaltsspanneBis` — sie wurden nur
     * nie gelesen.
     *
     * Gefunden hat es kein Testlauf, sondern das rekursive Durchsuchen
     * einer echten Antwort. Nach der Dokumentation zu programmieren
     * heisst, ihre Lücken zu übernehmen.
     *
     * Der Zusatz bleibt trotzdem: Für Anzeigen ohne Spanne trägt er die
     * Art in den Text, damit die Textlesung nicht raten muss, ob
     * „3.200 €" monatlich oder jährlich gemeint ist.
     */
    description: art && art !== "KEINE_ANGABEN" ? `${verguetungsSatz(art)}\n\n${text}` : text,

    /*
     * Betrag und Zeitraum gehören zusammen.
     *
     * Ohne `verguetungsangabe` bleibt die Spanne ungenutzt: „1700–2000"
     * ist als Monatsgehalt plausibel und als Jahresgehalt unmöglich.
     * Eine Zahl ohne Zeitraum ist keine Auskunft, und raten wäre hier
     * teuer — der Betrag landet sonst um den Faktor zwölf daneben.
     */
    ...(() => {
      const fest = detail?.festgehalt ?? s.festgehalt ?? null;
      /*
       * Spanne zuerst, Festbetrag als zweiter Weg.
       *
       * Nicht umgekehrt: liefert eine Anzeige beides, ist die Spanne
       * die reichere Auskunft.
       */
      const spanneVon = detail?.gehaltsspanneVon ?? s.gehaltsspanneVon ?? null;
      const spanneBis = detail?.gehaltsspanneBis ?? s.gehaltsspanneBis ?? null;
      const hatSpanne = spanneVon !== null || spanneBis !== null;
      const von = hatSpanne ? spanneVon : fest;
      const bis = hatSpanne ? spanneBis : fest;
      const zeitraum = zeitraumAus(art);
      if ((von === null && bis === null) || zeitraum === null) return {};
      // Widerspricht der Betrag dem Zeitraum, gilt die Angabe als nicht
      // vorhanden — siehe `plausibel()`.
      if (!plausibel(von, bis, zeitraum)) return {};
      return {
        salaryMin: von,
        salaryMax: bis,
        salaryCurrency: "EUR",
        salaryPeriod: zeitraum,
      };
    })(),
    weeklyHours: (detail?.arbeitszeitVollzeit ?? s.arbeitszeitVollzeit) ? 40 : null,
    applyMethod: "portal",
    applyTarget: stellenUrl(ref),
    originalUrl: stellenUrl(ref),
    publishedAt: datum(detail?.datumErsteVeroeffentlichung ?? s.datumErsteVeroeffentlichung),
    raw: {
      hauptberuf: detail?.hauptberuf ?? s.hauptberuf ?? null,
      verguetungsangabe: art,
      arbeitgeberHash: s.arbeitgeberKundennummerHash ?? null,
      allianzpartnerUrl: detail?.allianzpartnerUrl ?? null,
    },
  };
}

/** Die öffentliche Seite der Anzeige — das, was ein Mensch aufruft. */
export function stellenUrl(referenznummer: string): string {
  return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(referenznummer)}`;
}

/**
 * Aus der Vergütungsart den Zeitraum lesen.
 *
 * Die Jobbörse nennt beides getrennt: die Zahlen in
 * `gehaltsspanneVon`/`-Bis`, die Art in `verguetungsangabe`. Ohne die
 * Art wäre „1700–2000" nicht deutbar — als Jahresgehalt wäre es
 * unmöglich, als Monatsgehalt plausibel.
 *
 * Fehlt die Art, wird NICHT geraten: Ohne Zeitraum ist ein Betrag
 * keine Auskunft, sondern eine Zahl.
 */
function zeitraumAus(art: string | null | undefined): "year" | "month" | "hour" | null {
  if (art === "JAHRESGEHALT") return "year";
  if (art === "MONATSGEHALT") return "month";
  if (art === "STUNDENLOHN") return "hour";
  return null;
}

/*
 * Passt der Betrag zum genannten Zeitraum?
 *
 * Die Quelle widerspricht sich gelegentlich selbst. Aus einer echten
 * Antwort:
 *
 *   STUNDENLOHN   60000–85000   „Buchhaltung (m/w/d)"
 *   STUNDENLOHN   25–27         „Sachbearbeiter Buchhaltung (m/w/d)"
 *
 * Der zweite Eintrag stimmt, der erste ist ein Eingabefehler des
 * Arbeitgebers — 60.000 € Stundenlohn gibt es nicht.
 *
 * Was hier NICHT passiert: den Zeitraum „korrigieren". Aus 60.000 pro
 * Stunde 60.000 pro Jahr zu machen wäre naheliegend und trotzdem
 * geraten — und bei „1700" wäre schon unklar, ob Monat oder Jahr
 * gemeint ist.
 *
 * Stattdessen wird das Paar verworfen. Eine fehlende Angabe ist ehrlich;
 * eine sichtbar absurde Zahl beschädigt das Vertrauen in alle anderen.
 */
const GRENZEN: Record<"year" | "month" | "hour", [number, number]> = {
  hour: [5, 500],
  month: [400, 50_000],
  year: [8_000, 1_000_000],
};

function plausibel(von: number | null, bis: number | null, zeitraum: "year" | "month" | "hour"): boolean {
  const [min, max] = GRENZEN[zeitraum];
  for (const w of [von, bis]) {
    if (w === null) continue;
    if (!Number.isFinite(w) || w < min || w > max) return false;
  }
  return true;
}

function verguetungsSatz(art: string): string {
  if (art === "JAHRESGEHALT") return "Vergütungsangabe laut Jobbörse: Jahresgehalt.";
  if (art === "STUNDENLOHN") return "Vergütungsangabe laut Jobbörse: Stundenlohn.";
  if (art === "MONATSGEHALT") return "Vergütungsangabe laut Jobbörse: Monatsgehalt.";
  return `Vergütungsangabe laut Jobbörse: ${art.toLowerCase()}.`;
}

function arbeitsmodell(typ: string | null | undefined, moeglich: boolean | undefined): RawListing["workModel"] {
  /*
   * Vorsichtig in Richtung „vor Ort".
   *
   * „Homeoffice nach Vereinbarung" ist hybrid, nicht remote. Wer aus
   * einer Möglichkeit ein Versprechen macht, erzeugt genau die
   * Enttäuschung, die im ersten Gespräch auffliegt.
   */
  if (!moeglich) return "on_site";
  if (typ === "VOLLSTAENDIG" || typ === "AUSSCHLIESSLICH") return "remote";
  return "hybrid";
}

/**
 * Die Region in lesbarer Form.
 *
 * Die Schnittstelle liefert sie uneinheitlich: mal „Baden-Württemberg",
 * mal `BADEN_WUERTTEMBERG`. Beides nebeneinander sieht nach zwei
 * verschiedenen Orten aus — für den Menschen in der Liste und für die
 * Zusammenführung, die den Ort als Schlüssel benutzt.
 */
const LAENDER: Record<string, string> = {
  BADEN_WUERTTEMBERG: "Baden-Württemberg",
  BAYERN: "Bayern",
  BERLIN: "Berlin",
  BRANDENBURG: "Brandenburg",
  BREMEN: "Bremen",
  HAMBURG: "Hamburg",
  HESSEN: "Hessen",
  MECKLENBURG_VORPOMMERN: "Mecklenburg-Vorpommern",
  NIEDERSACHSEN: "Niedersachsen",
  NORDRHEIN_WESTFALEN: "Nordrhein-Westfalen",
  RHEINLAND_PFALZ: "Rheinland-Pfalz",
  SAARLAND: "Saarland",
  SACHSEN: "Sachsen",
  SACHSEN_ANHALT: "Sachsen-Anhalt",
  SCHLESWIG_HOLSTEIN: "Schleswig-Holstein",
  THUERINGEN: "Thüringen",
};

function region(v: string | null | undefined): string | null {
  if (!v) return null;
  return LAENDER[v.toUpperCase()] ?? v;
}

function vertrag(v: string | null | undefined): string | null {
  if (v === "UNBEFRISTET") return "permanent";
  if (v === "BEFRISTET") return "fixed_term";
  // `KEINE_ANGABE` heisst nicht „unbefristet", sondern nichts.
  return null;
}

/**
 * Die Vertragsart aus der Stellenart — sie geht der Vertragsdauer vor.
 *
 * Die Spalte `contract_type` kennt `apprenticeship` und `internship`
 * seit dem ersten Entwurf. Gefüllt wurden sie nie: abgeleitet wurde
 * allein aus `vertragsdauer`, und die kennt nur befristet/unbefristet.
 * Ergebnis nach 570.000 Anzeigen: fünf Ausbildungsstellen im Bestand.
 *
 * `stellenangebotsart` steht in jeder Trefferliste und sagt es direkt.
 * Beobachtete Werte: ARBEIT, AUSBILDUNG, PRAKTIKUM_TRAINEE,
 * SELBSTAENDIGKEIT.
 *
 * Bei PRAKTIKUM_TRAINEE entscheidet der Titel zwischen Praktikum und
 * Werkstudent — die Jobbörse wirft beide in einen Topf, für die
 * Rangfolge sind es verschiedene Dinge.
 */
function vertragsart(
  stellenart: string | null | undefined,
  dauer: string | null | undefined,
  titel: string,
): string | null {
  switch (stellenart) {
    case "AUSBILDUNG":
      return "apprenticeship";
    case "SELBSTAENDIGKEIT":
      return "freelance";
    case "PRAKTIKUM_TRAINEE":
      return /werkstudent|working student/i.test(titel) ? "working_student" : "internship";
    default:
      return vertrag(dauer);
  }
}

function datum(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function warte(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
