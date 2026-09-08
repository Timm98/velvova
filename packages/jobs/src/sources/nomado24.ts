import type { Herkunft } from "@paycheck/domain";
import {
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { envWert } from "../net.ts";

/**
 * Nomado24 — Remote- und Hybridstellen aus europäischen ATS.
 *
 * ══════════════════════════════════════════════════════════════
 * Was die API am 8. September 2026 tatsächlich liefert
 * ══════════════════════════════════════════════════════════════
 *
 * Live geprüft gegen `GET /api/public/v1/jobs`, HTTP 200, ohne
 * Schlüssel. Die Antwort ist `{ data: Job[], meta }`, fünfzig Stellen
 * je Seite.
 *
 * Je Stelle IMMER vorhanden (50 von 50):
 *
 *   slug · title · companyName · location · remote · workArrangement
 *   language · tags · source · publishedAt · url
 *
 * Gelegentlich vorhanden:
 *
 *   currency (5 von 50) · salaryMin (4) · salaryMax (3)
 *
 * NICHT vorhanden — und deshalb hier durchgehend leer:
 *
 *   description · city · countryCode · applyUrl · employmentType
 *   seniority · category · expiresAt
 *
 * Die Vorgabe warnte ausdrücklich davor, diese Felder anzunehmen.
 * Sie existieren nicht, und keines davon wird hier hergeleitet.
 *
 * ══════════════════════════════════════════════════════════════
 * Keine Beschreibung — und was daraus folgt
 * ══════════════════════════════════════════════════════════════
 *
 * Die öffentliche API liefert keinen Anzeigentext. Er wird deshalb
 * NICHT erfunden: nicht aus Titel und Schlagworten zusammengesetzt,
 * nicht von der Nomado24-Seite geholt, nicht von der Zielseite.
 *
 * Das hat eine Folge, die man kennen muss: Die Dublettenerkennung
 * über Textähnlichkeit greift bei diesen Stellen nicht. Sie muss auch
 * nicht — `aehnlicherText` in `zusammenfuehren.ts` bricht bei unter
 * zwanzig Wörtern ab und führt zwei leere Texte nie zusammen. Genau
 * diese Regel verlangt die Vorgabe, und sie steht schon da.
 *
 * ══════════════════════════════════════════════════════════════
 * `url` zeigt auf Nomado24, nicht auf den Arbeitgeber
 * ══════════════════════════════════════════════════════════════
 *
 * Beispiel aus der Antwort:
 *
 *   https://www.nomado24.de/en/remote-jobs/job/sr-technical-program-…
 *
 * Das ist die Nomado24-Stellenseite. Eine Bewerbungsadresse beim
 * Arbeitgeber liefert die API nicht. Sie wird deshalb weder geraten
 * noch durch Verfolgen der Weiterleitung ermittelt — `applyTarget`
 * bleibt leer, und der Verweis führt dorthin, wo die Anzeige steht.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Lizenz steht in der Antwort selbst
 * ══════════════════════════════════════════════════════════════
 *
 *   "license": "Free to use with an attribution link to nomado24.de"
 *   "attribution": "Data: Nomado24 (https://www.nomado24.de)"
 *
 * Das ist die technische Erlaubnis. Was daraus für eine
 * kostenpflichtige Plattform folgt — Speicherung, KI-Verarbeitung,
 * Aufbewahrungsdauer —, steht dort nicht, und deshalb bleibt die
 * Quelle abgeschaltet, bis das schriftlich geklärt ist.
 */

const STANDARD_BASIS = "https://api.nomado24.de/api/public/v1";

/**
 * Seitengrösse.
 *
 * Gemessen: `?per_page=5` liefert fünf, `?limit=5` wird ignoriert und
 * liefert fünfzig. Der Parameter heisst `per_page`, und wer `limit`
 * schreibt, bekommt wortlos den Standardwert.
 */
const JE_SEITE = 50;

/**
 * Das dokumentierte Limit: 240 Anfragen in 15 Minuten je IP.
 *
 * Das sind sechzehn je Minute. Hier stehen zwölf — ein Drittel Abstand,
 * weil sich eine Sperre bei einem nächtlichen Lauf erst am Morgen
 * zeigt. Rate-Limit-Kopfzeilen liefert die API nicht; es gibt also
 * nichts, woran ein Lauf merken könnte, dass er zu nah kommt.
 */
const ABSTAND_MS = 5_000;

interface Nomado24Job {
  slug?: string;
  title?: string;
  companyName?: string | null;
  location?: string | null;
  remote?: boolean | null;
  workArrangement?: string | null;
  language?: string | null;
  tags?: string[] | null;
  /** Das ATS, aus dem Nomado24 die Stelle bezogen hat. */
  source?: string | null;
  publishedAt?: string | null;
  url?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  [weitere: string]: unknown;
}

interface Nomado24Antwort {
  data?: Nomado24Job[];
  meta?: { page?: number; perPage?: number; count?: number; attribution?: string; license?: string };
}

export class Nomado24Adapter implements JobSourceAdapter {
  readonly key = "nomado24";
  readonly displayName = "Nomado24";
  readonly kind = "licensed_api" as const;
  /*
   * Freigegeben — auf Betreiberentscheidung, nicht auf schriftliche
   * Zusage von Nomado24. Der Unterschied steht ausfuehrlich im
   * Quellenverzeichnis und ist dort nachlesbar.
   */
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "aggregator";
  readonly attributionRequired = true;
  /**
   * Die Attribution — und sie ist eine Bedingung, kein Hinweis.
   *
   * Die Entwicklerseite formuliert sie als Gegenleistung: „Die Nutzung
   * ist kostenlos, solange du einen SICHTBAREN Link zurück auf
   * nomado24.de setzt." Vorgeschlagen wird dort wörtlich:
   *
   *   Powered by <a href="https://www.nomado24.de">Nomado24</a>
   *
   * Die API nennt daneben in `meta.attribution` eine zweite Fassung
   * („Data: Nomado24 (…)"). Beide stammen von Nomado24; die
   * verbindliche ist die von der Entwicklerseite, denn dort steht die
   * Bedingung.
   *
   * Entscheidend ist das Wort SICHTBAR: Eine Quellenangabe, die nur im
   * Rohsatz der Datenbank steht, erfüllt sie nicht. Sobald diese
   * Quelle freigeschaltet wird, muss der Link in der Oberfläche
   * stehen.
   */
  readonly attributionText = "Powered by Nomado24 (https://www.nomado24.de)";
  readonly termsUrl = "https://www.nomado24.de/de/developers";

  private readonly basis: string;
  private readonly fetchImpl: typeof fetch;
  private readonly aktiv: boolean;

  constructor(o: { basisUrl?: string; fetchImpl?: typeof fetch; aktiv?: boolean } = {}) {
    this.basis = o.basisUrl ?? envWert("NOMADO24_API_BASE_URL") ?? STANDARD_BASIS;
    this.fetchImpl = o.fetchImpl ?? fetch;
    /*
     * Der Schalter ist die Freigabe, nicht ein Zugangsdatum.
     *
     * Diese API braucht keinen Schlüssel — technisch könnte sofort
     * abgerufen werden. Was fehlt, ist die schriftliche Klärung, was
     * eine kostenpflichtige Plattform mit den Daten tun darf.
     *
     * Deshalb steht hier ein ausdrücklicher Schalter und kein
     * erfundener `NOMADO24_API_KEY`. Ein Schlüssel, den es nicht gibt,
     * als Sperre zu missbrauchen hiesse: Wer ihn eines Tages
     * versehentlich setzt, schaltet eine Rechtsfrage frei.
     *
     * Serverseitig und ohne `NEXT_PUBLIC_`: Der Browser hat hier
     * nichts zu entscheiden.
     */
    this.aktiv = o.aktiv ?? envWert("ENABLE_NOMADO24") === "true";
  }

  isConfigured(): boolean {
    return this.aktiv;
  }

  readonly capabilities: ProviderCapabilities = {
    search: false,
    details: false,
    since: false,
    maxPerRequest: JE_SEITE,
    /* 240 je 15 Minuten je IP, dokumentiert. */
    rateLimitPerMinute: 16,
    /* Beträge kommen vor, aber selten — 4 von 50 in der Stichprobe. */
    salary: true,
    expiry: false,
    structuredRequirements: false,
  };

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "Nomado24 ist nicht freigegeben: ENABLE_NOMADO24 steht nicht auf true. " +
          "Die API wäre erreichbar; die kommerzielle Freigabe fehlt.",
      );
    }

    const ziel = options.limit ?? 200;
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();
    let ungueltig = 0;

    for (let seite = 1; raus.length < ziel; seite++) {
      if (seite > 1) await warte(ABSTAND_MS, options.signal);

      const url = new URL(`${this.basis.replace(/\/$/, "")}/jobs`);
      url.searchParams.set("page", String(seite));
      url.searchParams.set("per_page", String(JE_SEITE));

      const antwort = await this.hole(url, options.signal);
      if (antwort === null) {
        if (raus.length === 0) throw new Error("Nomado24 antwortete nicht. Es wird nichts übernommen.");
        console.warn(`[nomado24] Abbruch nach ${raus.length} Anzeigen.`);
        break;
      }

      const daten = antwort.data;
      if (!Array.isArray(daten)) {
        throw new Error("Nomado24 lieferte kein `data`-Feld. Die Antwort passt nicht zum Modell.");
      }
      if (daten.length === 0) break;

      let neu = 0;
      for (const j of daten) {
        const l = zuRawListing(j);
        if (l === null) {
          /*
           * Ein kaputter Datensatz nimmt den Stapel nicht mit.
           *
           * Gezählt wird er trotzdem — eine Quelle, bei der plötzlich
           * die Hälfte durchfällt, hat ihr Modell geändert, und das
           * muss auffallen.
           */
          ungueltig++;
          continue;
        }
        if (gesehen.has(l.externalId)) continue;
        gesehen.add(l.externalId);
        raus.push(l);
        neu++;
        if (raus.length >= ziel) break;
      }

      if (daten.length < JE_SEITE || neu === 0) break;
    }

    if (ungueltig > 0) {
      console.warn(`[nomado24] ${ungueltig} Datensätze übersprungen, ${raus.length} übernommen.`);
    }
    return raus.slice(0, ziel);
  }

  /**
   * Ein Abruf mit Frist und begrenzten Wiederholungen.
   *
   * Wiederholt wird nur, was sich durch Warten bessern kann: 429 und
   * 5xx sowie Netzfehler. Ein 400 oder 404 wiederholt sich beliebig
   * oft identisch — dort zu warten kostet nur Zeit und verdeckt den
   * eigentlichen Fehler.
   */
  private async hole(url: URL, signal?: AbortSignal): Promise<Nomado24Antwort | null> {
    const RETRYBAR = new Set([429, 500, 502, 503, 504]);

    for (let versuch = 0; versuch <= 2; versuch++) {
      if (versuch > 0) await warte(1_000 * 2 ** (versuch - 1), signal);

      let antwort: Response | null = null;
      try {
        /*
         * Acht Sekunden, und ein eigener Abbruch dafür.
         *
         * Ohne Frist hängt ein Lauf an einer Verbindung, die nie
         * antwortet — und das Zeitbudget der ganzen Ernte mit ihm.
         */
        const frist = AbortSignal.timeout(8_000);
        antwort = await this.fetchImpl(url, {
          headers: { Accept: "application/json" },
          signal: signal ? AbortSignal.any([signal, frist]) : frist,
        });
      } catch {
        continue;
      }

      if (antwort.ok) {
        try {
          return (await antwort.json()) as Nomado24Antwort;
        } catch {
          /* Ungültiges JSON ist kein Wartefall. */
          return null;
        }
      }

      if (!RETRYBAR.has(antwort.status)) {
        throw new Error(`Nomado24 antwortete mit ${antwort.status}. Es wird nichts übernommen.`);
      }

      /* `Retry-After` gilt, wenn er dasteht. */
      const warten = Number.parseInt(antwort.headers.get("retry-after") ?? "", 10);
      if (Number.isFinite(warten) && warten > 0 && warten <= 60) {
        await warte(warten * 1_000, signal);
      }
    }
    return null;
  }
}

/** Warten, aber abbrechbar. */
function warte(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((fertig) => {
    const uhr = setTimeout(fertig, ms);
    signal?.addEventListener("abort", () => { clearTimeout(uhr); fertig(); }, { once: true });
  });
}

/**
 * Eine Nomado24-Adresse — oder nichts.
 *
 * Geprüft wird das Schema und der Host. Eine Stellen-URL, die auf
 * `javascript:`, `data:` oder einen Rechner im eigenen Netz zeigt,
 * gehört nicht in eine Datenbank, aus der später Verweise gerendert
 * werden.
 *
 * Rekonstruiert wird nichts: Was nicht als brauchbare Adresse
 * ankommt, ergibt keine Stelle.
 */
export function nomado24Adresse(roh: string | undefined): string | null {
  if (!roh) return null;
  let u: URL;
  try {
    u = new URL(roh);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host !== "nomado24.de" && !host.endsWith(".nomado24.de")) return null;
  return u.toString();
}

/**
 * Das Arbeitsmodell — aus dem strukturierten Feld, nicht aus dem Namen
 * der Quelle.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum `workArrangement` vorgeht und der Bool nur prüft
 * ══════════════════════════════════════════════════════════════
 *
 * Nomado24 liefert beides: `workArrangement` als Text und `remote` als
 * Wahrheitswert. In der Stichprobe vom 8. September 2026 stimmten sie
 * bei allen fünfzig überein — 23 mal remote/true, 27 mal hybrid/false.
 *
 * Verlassen wird sich trotzdem auf den Text: Er kennt drei Zustände,
 * der Bool nur zwei. „hybrid" und „onsite" sind für ihn dasselbe
 * `false`, und aus einem `false` liesse sich nicht sagen, welches
 * gemeint ist.
 *
 * ── Bei Widerspruch: unbekannt ──────────────────────────────
 *
 * Sagt der Text „remote" und der Bool `false`, wird nicht still einer
 * von beiden bevorzugt. Dann weiss die Quelle es selbst nicht, und das
 * ist genau der Zustand, den `undefined` beschreibt.
 *
 * Und niemals „remote", nur weil die Quelle Nomado24 heisst.
 */
export function arbeitsmodell(
  j: Pick<Nomado24Job, "workArrangement" | "remote">,
): "remote" | "hybrid" | "on_site" | undefined {
  const text = (j.workArrangement ?? "").trim().toLowerCase();
  const aus: Record<string, "remote" | "hybrid" | "on_site"> = {
    remote: "remote",
    hybrid: "hybrid",
    onsite: "on_site",
    "on-site": "on_site",
    on_site: "on_site",
    office: "on_site",
  };
  const gedeutet = aus[text];
  if (!gedeutet) return undefined;

  if (typeof j.remote === "boolean") {
    const passtZusammen = j.remote === (gedeutet === "remote");
    if (!passtZusammen) {
      console.warn(
        `[nomado24] Widerspruch: workArrangement="${text}" gegen remote=${j.remote}. Arbeitsmodell bleibt unbekannt.`,
      );
      return undefined;
    }
  }
  return gedeutet;
}

/**
 * Das Gehalt — nur wenn es dasteht und Sinn ergibt.
 *
 * Der Zeitraum wird NICHT gesetzt. Die API nennt keinen, und die
 * Dokumentation legt keinen fest. Ihn auf „Jahr" zu raten wäre bei
 * einem Stundensatz um den Faktor 1760 falsch — und niemand sähe es
 * der Zahl an.
 *
 * `salaryProvenance` bleibt ebenfalls weg: Ob der Betrag vom
 * Arbeitgeber stammt oder vom Portal geschätzt wurde, sagt die API
 * nicht.
 */
export function gehalt(j: Nomado24Job): Pick<RawListing, "salaryMin" | "salaryMax" | "salaryCurrency"> | null {
  const min = typeof j.salaryMin === "number" && Number.isFinite(j.salaryMin) ? j.salaryMin : null;
  const max = typeof j.salaryMax === "number" && Number.isFinite(j.salaryMax) ? j.salaryMax : null;
  if (min === null && max === null) return null;

  /* Negative oder verdrehte Spannen sind keine Angabe, sondern ein Fehler. */
  if ((min !== null && min <= 0) || (max !== null && max <= 0)) return null;
  if (min !== null && max !== null && max < min) return null;

  const waehrung = (j.currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(waehrung)) return null;

  return { salaryMin: min, salaryMax: max, salaryCurrency: waehrung };
}

/**
 * Ein Nomado24-Datensatz als Anzeige — oder `null`.
 *
 * Verworfen wird nur, was ohne Kennung, Titel oder brauchbare Adresse
 * ankommt. Eine fehlende Beschreibung ist KEIN Grund: Sie fehlt bei
 * allen, und diese Quelle deshalb ganz wegzulassen hiesse, wegen eines
 * Feldes auf mehrere tausend Remote-Stellen zu verzichten.
 */
export function zuRawListing(j: Nomado24Job): RawListing | null {
  const slug = (j.slug ?? "").trim();
  const titel = (j.title ?? "").trim();
  const adresse = nomado24Adresse(j.url);
  if (!slug || !titel || adresse === null) return null;

  const datum = j.publishedAt ? new Date(j.publishedAt) : null;
  const g = gehalt(j);
  const modell = arbeitsmodell(j);

  return {
    externalId: slug,
    title: titel,
    companyName: (j.companyName ?? "").trim(),
    /*
     * Der Ort bleibt Text.
     *
     * Die API liefert Angaben wie „EU/EMEA" oder „Germany only". Daraus
     * eine Stadt oder ein Land zu lesen hiesse, aus einem Gebiet einen
     * Punkt zu machen — und der Fahrzeitrechner nähme die Erfindung für
     * bare Münze.
     */
    location: (j.location ?? "").trim(),
    /* Kein `country`: Die API liefert keinen Ländercode, und aus
       „EU/EMEA" folgt keiner. */
    ...(modell ? { workModel: modell } : {}),
    /*
     * Leer, weil es leer ist.
     *
     * Nicht aus Titel und Schlagworten zusammengesetzt: Ein erfundener
     * Text liefe durch die Analyse, die Klassifizierung und den
     * Abgleich, und an keiner Stelle stünde, dass er erfunden ist.
     */
    description: "",
    ...(g ?? {}),
    applyMethod: "portal" as const,
    /*
     * Beides zeigt auf Nomado24, und das ist die Wahrheit.
     *
     * Eine Bewerbungsadresse beim Arbeitgeber liefert die API nicht.
     * Sie zu erraten oder die Weiterleitung zu verfolgen, um das Ziel
     * zu erfahren, verbietet die Vorgabe ausdrücklich — und zu Recht:
     * Ein falscher Bewerbungslink kostet eine Bewerbung.
     */
    applyTarget: adresse,
    originalUrl: adresse,
    publishedAt: datum && !Number.isNaN(datum.getTime()) ? datum : null,
    /*
     * Der Rohsatz kommt mit — er beantwortet später Fragen, die heute
     * niemand stellt. `source` ist die interessanteste Angabe darin:
     * Sie nennt das ATS, aus dem Nomado24 die Stelle hat, und damit
     * die nähere Originalquelle.
     */
    raw: {
      source: j.source ?? null,
      tags: j.tags ?? null,
      language: j.language ?? null,
      workArrangement: j.workArrangement ?? null,
      remote: j.remote ?? null,
    },
  } as RawListing;
}
