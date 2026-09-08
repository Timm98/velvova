import { createHash } from "node:crypto";
import type { Herkunft } from "@paycheck/domain";
import {
  normaliseWorkModel,
  type FetchOptions,
  type JobSourceAdapter,
  type ProviderCapabilities,
  type RawListing,
} from "../adapter.ts";
import { envWert, mitFrist } from "../net.ts";

/**
 * Careerjet — Stellensuchmaschine mit eigenem Index.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Quelle
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen am 8. September 2026 gegen die eigene Schnittstelle:
 * 726.896 Treffer für Deutschland, 14.538 Seiten. Das ist die
 * grösste einzelne Zahl, die bisher eine Quelle genannt hat — und
 * sie kommt zu einem Zeitpunkt, an dem die Ausbeute der bestehenden
 * 28 Quellen einbricht (am 7. September wurden 5,7 Mio. Anzeigen
 * geholt und daraus 546.000 neue; neun Prozent).
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Eigenarten, die je einen halben Tag kosten können
 * ══════════════════════════════════════════════════════════════
 *
 * ── 1. Der Referer ist Pflicht ──────────────────────────────
 *
 * Ohne ihn: `403 Undeclared referrer. Please add a Referer header.`
 * Das steht in keiner Kurzanleitung, und der Fehlertext klingt nach
 * einem Problem mit dem Schlüssel. Er ist keines.
 *
 * ── 2. `pagesize` über 50 liefert WENIGER ───────────────────
 *
 * Gemessen: `pagesize=50` → 50 Anzeigen. `pagesize=100` → 20.
 * `pagesize=200` → 20. Es gibt keine Fehlermeldung; die Antwort ist
 * gültig und einfach kürzer. Wer auf 100 stellt, um schneller zu
 * sein, halbiert seinen Durchsatz und sieht nicht, warum.
 *
 * ── 3. Die URL ist NICHT stabil ─────────────────────────────
 *
 * `url` zeigt auf `jobviewtrack.com` und trägt ein Sitzungstoken.
 * Gemessen über zwei Aufrufe im Abstand einer Sekunde: dieselben
 * drei Stellen, dieselben Titel — drei andere URLs.
 *
 * Sie als `externalId` zu nehmen hiesse, bei jedem Lauf jede Anzeige
 * für neu zu halten. Der Bestand wüchse, und keine einzige Zeile
 * darin wäre eine neue Stelle.
 */

const ENDPUNKT = "https://search.api.careerjet.net/v4/query";

/**
 * Die grösste Seite, die wirklich eine grosse Seite ist.
 *
 * Siehe oben: Alles darüber liefert 20. Diese Zahl ist gemessen,
 * nicht dokumentiert — wer sie ändert, misst vorher nach.
 */
const JE_SEITE = 50;

/**
 * Adressen, die Careerjet mit `403 Invalid user_ip` zurückweist.
 *
 * Gemessen, nicht dokumentiert. Es sind die bekannten Platzhalter und
 * öffentlichen Auflöser — genau die Werte, die jemand einträgt, der
 * keinen echten Besucher hat.
 */
/**
 * Der Abstand zwischen zwei Abfragen.
 *
 * Sechzig je Minute, also eine Sekunde. Siehe `capabilities` — die
 * Sperre kam bei etwa zehn Abfragen je Sekunde.
 */
const ABSTAND_MS = 1_000;

/** Warten, aber abbrechbar: Ein Lauf mit Zeitbudget muss enden können. */
function warte(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((fertig) => {
    const uhr = setTimeout(fertig, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(uhr);
      fertig();
    }, { once: true });
  });
}

const GESPERRTE_IP = new Set(["0.0.0.0", "127.0.0.1", "8.8.8.8", "1.1.1.1", "1.2.3.4", "::1"]);

interface CareerjetStelle {
  title?: string;
  company?: string;
  locations?: string;
  description?: string;
  date?: string;
  url?: string;
  site?: string;
  /*
   * ══════════════════════════════════════════════════════════════
   * Das Gehalt kommt zweimal — einmal als Text, einmal als Zahl
   * ══════════════════════════════════════════════════════════════
   *
   * Zuerst stand hier nur `salary`, weil die deutschen Antworten nur
   * das zeigten: „€45000 per year". Am 8. September 2026 fiel beim
   * Nachsehen in einer japanischen Antwort auf, dass daneben noch
   * `salary_min`, `salary_max`, `salary_currency_code` und
   * `salary_type` stehen.
   *
   * Sie erscheinen nur, wenn es einen Betrag gibt — bei den deutschen
   * Stichproben war `salary` leer, und deshalb fehlten sie ganz. Der
   * Fliesstext war also nie die einzige Quelle; er war nur die
   * einzige, die ich gesehen hatte.
   *
   * Die Zahlen sind besser: Sie tragen eine Spanne (min UND max), die
   * Währung als Code und die Periode als Kennbuchstabe. Aus dem Text
   * liess sich nur ein einzelner Betrag lesen.
   */
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency_code?: string;
  /** `H` Stunde · `M` Monat · `Y` Jahr · `D` Tag · `W` Woche. */
  salary_type?: string;
}

interface CareerjetAntwort {
  type?: string;
  hits?: number;
  pages?: number;
  jobs?: CareerjetStelle[];
  error?: string;
}

/**
 * Die Länder, die Careerjet für uns abdeckt.
 *
 * Je Land ein eigener Adapter — wie bei Adzuna und Jooble. Ein
 * Adapter, der alle Länder in einem Lauf abfragt, hätte ein
 * gemeinsames Zeitbudget: Bricht Deutschland ein, holt die Schweiz
 * nichts mehr, und im Protokoll steht eine einzige Zeile für sechs
 * Märkte.
 */
/*
 * ══════════════════════════════════════════════════════════════
 * Der Bestand je Land, gemessen am 8. September 2026
 * ══════════════════════════════════════════════════════════════
 *
 * Careerjet betreibt Portale in rund neunzig Ländern. Verdrahtet
 * waren zuerst nur DE/AT/CH — das war die vorsichtige Fassung, und
 * sie hat den grössten Teil der Quelle liegen lassen.
 *
 * Die Zahl hinter jedem Land ist die gemeldete Trefferzahl, einzeln
 * abgefragt. Sie steht hier, weil sie die einzige Begründung dafür
 * ist, warum diese Liste so lang ist — und weil sie beim nächsten
 * Mal nachprüfbar sein soll.
 *
 * ── Was daran auffällt ──────────────────────────────────────
 *
 * Japan trägt allein 5,8 Mio. — mehr als der gesamte bisherige
 * Bestand. Es gibt dafür keine zweite Quelle im Verzeichnis, also
 * ist praktisch alles davon neu. Die USA kommen mit 2,0 Mio. dazu,
 * und `adzuna_us` hat bisher nur 140.000 beigetragen.
 *
 * Bei den europäischen Ländern ist die Überschneidung gross: Für DE
 * lag die Dublettenquote im ersten Lauf bei 19 Prozent, für AT und
 * CH bei 41. Ihre Zahlen sind hier deshalb nicht als Zuwachs zu
 * lesen.
 *
 * ── Griechenland fehlt ──────────────────────────────────────
 *
 * `el_GR` antwortete bei der Messung mit einem Fehler. Ein Land
 * aufzunehmen, das nicht geantwortet hat, hiesse eine Quelle zu
 * führen, die bei jedem Lauf fehlschlägt. Es kommt dazu, wenn
 * jemand die richtige Ortsbezeichnung gefunden hat.
 */
export const CAREERJET_LAENDER = [
  /* Deutschsprachig — zuerst verdrahtet, hohe Überschneidung. */
  { code: "DE", locale: "de_DE", ort: "Deutschland", bestand: 570_182 },
  { code: "AT", locale: "de_AT", ort: "Österreich", bestand: 0 },
  { code: "CH", locale: "de_CH", ort: "Schweiz", bestand: 0 },

  /* Die grossen Märkte ohne eigene Quelle im Verzeichnis. */
  { code: "JP", locale: "ja_JP", ort: "Japan", bestand: 5_823_925 },
  { code: "US", locale: "en_US", ort: "United States", bestand: 1_995_956 },

  /* Der Rest, nach Bestand geordnet. */
  { code: "FR", locale: "fr_FR", ort: "France", bestand: 459_912 },
  { code: "BR", locale: "pt_BR", ort: "Brasil", bestand: 380_149 },
  { code: "GB", locale: "en_GB", ort: "United Kingdom", bestand: 274_093 },
  { code: "IT", locale: "it_IT", ort: "Italia", bestand: 177_051 },
  { code: "MX", locale: "es_MX", ort: "Mexico", bestand: 154_749 },
  { code: "IN", locale: "en_IN", ort: "India", bestand: 131_425 },
  { code: "PL", locale: "pl_PL", ort: "Polska", bestand: 109_922 },
  { code: "CA", locale: "en_CA", ort: "Canada", bestand: 108_849 },
  { code: "AR", locale: "es_AR", ort: "Argentina", bestand: 99_908 },
  { code: "NL", locale: "nl_NL", ort: "Nederland", bestand: 82_519 },
  { code: "CZ", locale: "cs_CZ", ort: "Ceska republika", bestand: 67_319 },
  { code: "ZA", locale: "en_ZA", ort: "South Africa", bestand: 66_046 },
  { code: "BE", locale: "fr_BE", ort: "Belgique", bestand: 62_932 },
  { code: "AU", locale: "en_AU", ort: "Australia", bestand: 59_104 },
  { code: "SE", locale: "sv_SE", ort: "Sverige", bestand: 56_542 },
  { code: "ES", locale: "es_ES", ort: "España", bestand: 54_458 },
  { code: "SG", locale: "en_SG", ort: "Singapore", bestand: 38_040 },
  { code: "PT", locale: "pt_PT", ort: "Portugal", bestand: 36_813 },
  { code: "TR", locale: "tr_TR", ort: "Turkiye", bestand: 30_241 },
  { code: "IE", locale: "en_IE", ort: "Ireland", bestand: 27_493 },
  { code: "FI", locale: "fi_FI", ort: "Suomi", bestand: 25_036 },
  { code: "DK", locale: "da_DK", ort: "Danmark", bestand: 21_751 },
  { code: "HU", locale: "hu_HU", ort: "Magyarorszag", bestand: 16_591 },
  { code: "RO", locale: "ro_RO", ort: "Romania", bestand: 14_696 },
  { code: "NO", locale: "no_NO", ort: "Norge", bestand: 12_321 },
  { code: "UA", locale: "uk_UA", ort: "Ukraina", bestand: 12_001 },
  { code: "NZ", locale: "en_NZ", ort: "New Zealand", bestand: 9_297 },
] as const;

export class CareerjetAdapter implements JobSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly kind = "licensed_api" as const;
  readonly licenseStatus = "licensed" as const;
  readonly herkunft: Herkunft = "aggregator";
  readonly attributionRequired = true;
  readonly attributionText = "Stellendaten von Careerjet. Bewerbung über die Originalanzeige.";
  readonly termsUrl = "https://www.careerjet.de/partners/api/";

  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly land: (typeof CAREERJET_LAENDER)[number];
  private readonly abfragen: string[];
  private readonly ort: string | null;
  private readonly referer: string;
  private readonly userIp: string;
  private readonly userAgent: string;

  constructor(
    o: {
      country?: (typeof CAREERJET_LAENDER)[number]["code"];
      apiKey?: string;
      fetchImpl?: typeof fetch;
      abfragen?: string[];
      /**
       * Ein Ort STATT des Landes.
       *
       * Careerjet begrenzt jede Abfrage auf rund zehn Seiten. Gemessen
       * am 8. September 2026: `location=Deutschland` ohne Begriff
       * lieferte 491 Anzeigen — bei einem Bestand von 570.182. Ohne
       * eine zweite Achse sind 99,9 % des Landes unerreichbar.
       *
       * Ein Ort beginnt die Zählung neu, genauso wie bei Adzuna. Aus
       * einer Decke von 491 je Land werden 491 je Ort und Begriff.
       */
      ort?: string;
      referer?: string;
      userIp?: string;
      userAgent?: string;
    } = {},
  ) {
    this.land =
      CAREERJET_LAENDER.find((l) => l.code === (o.country ?? "DE")) ?? CAREERJET_LAENDER[0];
    this.key = `careerjet_${this.land.code.toLowerCase()}`;
    this.displayName = `Careerjet (${this.land.ort})`;
    this.apiKey = o.apiKey ?? envWert("CAREERJET_API_KEY");
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.abfragen = o.abfragen ?? [];
    this.ort = o.ort ?? null;
    this.referer = o.referer ?? envWert("CAREERJET_REFERER") ?? "https://velvova.com/";

    /*
     * ══════════════════════════════════════════════════════════
     * `user_ip` und `user_agent` sind Pflichtangaben
     * ══════════════════════════════════════════════════════════
     *
     * Careerjet verlangt sie bei JEDER Anfrage. Sie beschreiben den
     * Menschen, für den gesucht wird — bei einer Ernte im Hintergrund
     * gibt es den nicht, und das ist der ehrliche Zustand.
     *
     * Deshalb steht hier nicht die IP eines Besuchers. Eine fremde
     * IP an einen Dritten zu schicken, nur weil ein Feld ausgefüllt
     * sein muss, wäre eine Datenweitergabe ohne Anlass — und die
     * Ernte läuft nachts, wenn niemand da ist, dessen IP es sein
     * könnte.
     *
     * ── Was Careerjet annimmt und was nicht ─────────────────
     *
     * Gemessen am 8. September 2026 gegen die Schnittstelle:
     *
     *   0.0.0.0         403 Invalid user_ip
     *   8.8.8.8         403 Invalid user_ip
     *   1.2.3.4         403 Invalid user_ip
     *   192.168.1.10    200
     *   203.0.113.5     200
     *   (echte eigene)  200
     *
     * Es wird also nicht gegen die Absenderadresse geprüft, sondern
     * gegen eine Liste bekannter Platzhalter. `0.0.0.0` — der erste
     * Einfall — steht darauf, und der Fehlertext nennt nur das Feld,
     * nicht den Grund.
     *
     * ── Warum 203.0.113.1 ───────────────────────────────────
     *
     * Es ist TEST-NET-3 aus RFC 5737: ein Bereich, der ausdrücklich
     * für Beispiele reserviert ist und keinem Anschluss gehört. Damit
     * sagt das Feld genau das Richtige — hier steht kein Mensch — und
     * wird trotzdem angenommen.
     *
     * Wer die Ernte lieber unter der eigenen Serveradresse fahren
     * will, setzt `CAREERJET_USER_IP`. Careerjet sieht sie ohnehin an
     * der Verbindung; neu preisgegeben wird dadurch nichts.
     */
    this.userIp = o.userIp ?? envWert("CAREERJET_USER_IP") ?? "203.0.113.1";
    this.userAgent =
      o.userAgent ?? envWert("CAREERJET_USER_AGENT") ?? "Velvova-Jobimport/1.0 (+https://velvova.com)";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Careerjet kennt Suchbegriffe und blättert tief. Was fehlt, ist
   * ein strukturiertes Gehalt — es kommt als Fliesstext („€45000 per
   * year") und wird hier gelesen, nicht geraten.
   */
  readonly capabilities: ProviderCapabilities = {
    search: true,
    details: false,
    since: false,
    maxPerRequest: JE_SEITE,
    /*
     * ══════════════════════════════════════════════════════════
     * Careerjet sperrt bei zu schnellen Bursts
     * ══════════════════════════════════════════════════════════
     *
     * Am 8. September 2026 gemessen — versehentlich: Zwanzig
     * Abfragen in etwa zwei Sekunden, und die Antwort lautete
     *
     *   403 Unauthorized access from IP 188.104.178.142
     *
     * Der Text nennt die IP und klingt damit nach einem gesperrten
     * Anschluss oder einem Schlüssel, der an eine Adresse gebunden
     * ist. Beides ist er nicht: Nach fünfundvierzig Sekunden
     * antwortete dieselbe Adresse wieder normal.
     *
     * Das ist die gefährlichste Sorte Fehlermeldung — sie schickt
     * die Fehlersuche in die falsche Richtung, und ein Lauf, der
     * mitten in der Nacht darauf stösst, meldet am Morgen einen
     * gesperrten Zugang, den es nie gab.
     *
     * Sechzig je Minute ist bewusst weit unter dem, was ausgelöst
     * hat. Bei fünfzig Anzeigen je Abfrage sind das dreitausend in
     * der Minute — der Engpass ist ohnehin das Schreiben in die
     * Datenbank (gemessen neun bis dreizehn je Sekunde), nicht der
     * Abruf.
     */
    rateLimitPerMinute: 60,
    salary: true,
    expiry: false,
    structuredRequirements: false,
  };

  async fetchListings(options: FetchOptions = {}): Promise<RawListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "Careerjet ist nicht eingerichtet: CAREERJET_API_KEY fehlt. Es wird nichts abgerufen.",
      );
    }

    /*
     * Den bekannten Fehlgriff abfangen, bevor er als 403 zurückkommt.
     *
     * `Invalid user_ip` nennt das Feld, aber nicht den Grund — und
     * wer `0.0.0.0` eingetragen hat, sucht den Fehler beim Schlüssel.
     * Eine Meldung, die den Grund nennt, spart genau diese Stunde.
     */
    if (GESPERRTE_IP.has(this.userIp)) {
      throw new Error(
        `Careerjet lehnt \`user_ip=${this.userIp}\` ab (bekannter Platzhalter). ` +
          "CAREERJET_USER_IP auf eine echte oder reservierte Adresse setzen — 203.0.113.1 wird angenommen.",
      );
    }

    const ziel = options.limit ?? 200;
    const raus: RawListing[] = [];
    const gesehen = new Set<string>();

    /*
     * Ohne Begriff blättert Careerjet durch den Gesamtbestand des
     * Landes — 726.896 Anzeigen für Deutschland. Das ist der
     * Normalfall dieser Quelle; Begriffe verengen nur.
     */
    const begriffe: (string | null)[] = this.abfragen.length > 0 ? [...this.abfragen] : [null];

    for (const was of begriffe) {
      for (let seite = 1; raus.length < ziel; seite++) {
        /*
         * Zwischen zwei Abfragen wird gewartet.
         *
         * `rateLimitPerMinute` ist eine Angabe ÜBER den Anbieter —
         * sie bremst von sich aus nichts. Genau daran ist es
         * gescheitert: Der Wert stand auf `null`, die Schleife lief
         * so schnell sie konnte, und die Sperre kam.
         *
         * Vor der ersten Abfrage wird nicht gewartet: Ein Lauf, der
         * mit einer Sekunde Nichtstun beginnt, verschenkt sie bei
         * jeder der einunddreissig Quellen.
         */
        if (seite > 1) await warte(ABSTAND_MS, options.signal);

        const url = new URL(ENDPUNKT);
        if (was) url.searchParams.set("keywords", was);
        /* Der Ort verengt, das Land ist der Rückfall. */
        url.searchParams.set("location", this.ort ?? this.land.ort);
        url.searchParams.set("locale_code", this.land.locale);
        url.searchParams.set("pagesize", String(JE_SEITE));
        url.searchParams.set("page", String(seite));
        /* Das Neueste zuerst — der Bestand ist zu gross, um ihn ganz
           zu holen, und was zählt, ist das, was dazugekommen ist. */
        url.searchParams.set("sort", "date");
        url.searchParams.set("user_ip", this.userIp);
        url.searchParams.set("user_agent", this.userAgent);

        const antwort = await this.fetchImpl(url, {
          headers: {
            /*
             * Schlüssel als Benutzername, Passwort leer — wie bei
             * Reed. `Authorization: <key>` antwortet mit 401, und die
             * Suche geht dann nach dem Schlüssel statt nach der
             * Kodierung.
             */
            Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
            Accept: "application/json",
            /* Pflicht. Ohne ihn: 403 „Undeclared referrer". */
            Referer: this.referer,
          },
          signal: mitFrist(options.signal),
        }).catch(() => null);

        if (!antwort?.ok) {
          if (raus.length === 0) {
            throw new Error(
              `Careerjet (${this.land.code}) antwortete mit ${antwort?.status ?? "keiner Antwort"}. Es werden keine Stellen übernommen.`,
            );
          }
          console.warn(
            `[careerjet] ${antwort?.status} nach ${raus.length} Anzeigen — Lauf endet hier.`,
          );
          return raus.slice(0, ziel);
        }

        const daten = (await antwort.json().catch(() => null)) as CareerjetAntwort | null;

        /*
         * Eine 200er Antwort ist noch kein Ergebnis.
         *
         * Careerjet meldet Fehler mit HTTP 200 und `type: "ERROR"` im
         * Rumpf. Ohne diese Prüfung liefe der Lauf durch, fände
         * nichts und meldete Erfolg.
         */
        if (daten?.type === "ERROR") {
          if (raus.length === 0) {
            throw new Error(
              `Careerjet (${this.land.code}) meldet: ${daten.error ?? "unbekannter Fehler"}.`,
            );
          }
          return raus.slice(0, ziel);
        }

        const treffer = daten?.jobs ?? [];
        let neu = 0;
        for (const s of treffer) {
          const l = zuRawListing(s, this.land.code);
          if (!l || gesehen.has(l.externalId)) continue;
          gesehen.add(l.externalId);
          raus.push(l);
          neu++;
          if (raus.length >= ziel) break;
        }

        /*
         * Schluss, wenn die Seite nicht voll war oder nichts Neues
         * brachte. Das zweite ist wichtiger als es aussieht: Careerjet
         * liefert bei zu tiefen Seiten dieselben Anzeigen noch einmal,
         * und ohne diese Bedingung liefe die Schleife bis zum
         * Zeitbudget, ohne eine einzige neue Zeile zu holen.
         */
        if (treffer.length < JE_SEITE || neu === 0) break;
        if (daten?.pages !== undefined && seite >= daten.pages) break;
      }
    }

    return raus.slice(0, ziel);
  }
}

/**
 * Eine Kennung, die zwei Aufrufe übersteht.
 *
 * Careerjets `url` trägt ein Sitzungstoken und ist bei jedem Aufruf
 * eine andere (gemessen am 8.9.2026). Als Kennung genommen wäre jede
 * Anzeige bei jedem Lauf neu.
 *
 * Stabil sind Titel, Firma, Ort und Datum — dieselbe Anzeige liefert
 * dieselben vier Werte. Ihr Abdruck ist die Kennung.
 *
 * ── Warum das Datum mit hineingehört ────────────────────────
 *
 * Ohne es wären zwei gleichlautende Ausschreibungen desselben
 * Arbeitgebers am selben Ort EINE Anzeige — und grosse Arbeitgeber
 * schreiben dieselbe Stelle mehrfach aus. Mit dem Datum bleiben sie
 * getrennt, solange sie an verschiedenen Tagen erschienen sind.
 */
export function careerjetKennung(s: CareerjetStelle): string {
  const teile = [s.title ?? "", s.company ?? "", s.locations ?? "", s.date ?? ""]
    .map((t) => t.trim().toLowerCase())
    .join("|");
  return createHash("sha1").update(teile).digest("hex").slice(0, 24);
}

/**
 * Careerjets Gehaltstext in Zahlen.
 *
 * Er kommt als Fliesstext und in wenigen Formen: „€45000 per year",
 * „€28.33 per hour", „€16.8 per hour". Gemessen an fünfzig deutschen
 * Anzeigen trugen drei überhaupt einen Betrag.
 *
 * Was nicht sicher zu lesen ist, wird NICHT geraten. Ein falscher
 * Betrag ist schlimmer als keiner: Er läuft in den Gehaltsfilter, in
 * den Vergleich und in die Zeile — und niemand sieht ihm an, dass er
 * aus einem Text stammt, den ein Muster nicht verstanden hat.
 */
export interface CareerjetGehalt {
  min: number;
  max?: number;
  period: "year" | "month" | "hour";
  currency: string;
  herkunft: "provider" | "text";
}

/**
 * Das Gehalt aus den eigenen Feldern — der bessere Weg.
 *
 * Sie stehen nur da, wenn es einen Betrag gibt. Ist eines davon
 * unbrauchbar, wird NICHT halb geraten: Dann fällt die Funktion aus,
 * und der Fliesstext bekommt seine Gelegenheit.
 *
 * `salary_type` ist ein Kennbuchstabe. `D` (Tag) und `W` (Woche)
 * kennt unser Modell nicht — statt sie umzurechnen und dabei eine
 * Wochenarbeitszeit zu erfinden, die niemand genannt hat, bleiben
 * sie unbeachtet.
 */
export function careerjetGehaltStrukturiert(s: {
  salary_min?: number;
  salary_max?: number;
  salary_currency_code?: string;
  salary_type?: string;
}): CareerjetGehalt | null {
  const min = typeof s.salary_min === "number" ? s.salary_min : null;
  const max = typeof s.salary_max === "number" ? s.salary_max : null;
  const betrag = min ?? max;
  if (betrag === null || !Number.isFinite(betrag) || betrag <= 0) return null;

  const periode = { H: "hour", M: "month", Y: "year" } as const;
  const period = periode[(s.salary_type ?? "").toUpperCase() as keyof typeof periode];
  if (!period) return null;

  const currency = (s.salary_currency_code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;

  return {
    min: betrag,
    /* Eine Spanne nur, wenn sie eine ist. Min = Max ist keine. */
    ...(max !== null && min !== null && max > min ? { max } : {}),
    period,
    currency,
    herkunft: "provider",
  };
}

export function careerjetGehalt(text: string | undefined): CareerjetGehalt | null {
  const roh = (text ?? "").trim();
  if (roh.length === 0) return null;

  const treffer =
    /([€$£])\s*([\d.,]+)(?:\s*-\s*[\d.,]+)?\s*per\s*(year|month|hour|annum)/i.exec(roh);
  if (!treffer) return null;

  /*
   * Careerjet schreibt englisch: der Punkt ist das Dezimalzeichen,
   * das Komma trennt Tausender. „16.8" sind sechzehn Euro achtzig,
   * nicht sechzehnachtzig.
   */
  const betrag = Number.parseFloat((treffer[2] ?? "").replace(/,/g, ""));
  if (!Number.isFinite(betrag) || betrag <= 0) return null;

  const einheit = (treffer[3] ?? "").toLowerCase();
  const period = einheit === "hour" ? "hour" : einheit === "month" ? "month" : "year";
  const currency = treffer[1] === "$" ? "USD" : treffer[1] === "£" ? "GBP" : "EUR";
  return { min: betrag, period, currency, herkunft: "text" };
}

export function zuRawListing(s: CareerjetStelle, land: string): RawListing | null {
  const beschreibung = (s.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /*
   * ══════════════════════════════════════════════════════════════
   * Ohne Arbeitgeber keine Anzeige — und was das in Japan kostet
   * ══════════════════════════════════════════════════════════════
   *
   * Gemessen am 8. September 2026 an je fünfzig Anzeigen:
   *
   *   ja_JP   45 von 50 ohne `company`   (90 %)
   *   pt_BR    8 von 50                  (16 %)
   *   en_US    6 von 50                  (12 %)
   *   fr_FR    0 von 50
   *   en_GB    0 von 50
   *
   * Japan ist mit 5,8 Mio. gemeldeten Anzeigen der grösste Markt der
   * Quelle — und neun Zehntel davon fallen hier heraus. Das ist ein
   * bitterer Preis, und er ist trotzdem der richtige.
   *
   * ── Warum kein Platzhalter ──────────────────────────────────
   *
   * „Nicht genannt" als Firmenname hiesse: eine erfundene Firma mit
   * Millionen Stellen. Sie stünde in der Arbeitgebersuche, die es
   * seit heute gibt, sie stünde in jeder Zeile, und die
   * Dublettenerkennung würde Anzeigen zusammenführen, die nichts
   * miteinander zu tun haben.
   *
   * ── Warum nicht aus dem Text lesen ──────────────────────────
   *
   * Bei einer der 45 stand der Name vorn („コンパスグループ・ジャパン
   * 株式会社"). Gemessen über alle 45: vier Prozent liessen sich so
   * lesen. Der Rest beginnt mit 【仕事内容】 — „Tätigkeit" — und
   * nennt den Arbeitgeber gar nicht.
   *
   * Vier Prozent sind keine Regel, sondern ein Zufall. Eine Regel
   * darauf zu bauen hiesse, in sechsundneunzig von hundert Fällen
   * irgendein Wort als Firmennamen zu führen.
   *
   * ── Was stattdessen zu tun wäre ─────────────────────────────
   *
   * Careerjets Weiterleitung führt zur Originalanzeige, und dort
   * steht der Arbeitgeber. Ihn nachzuladen ist ein eigener Abruf je
   * Stelle — machbar, aber eine andere Grössenordnung als dieser
   * Adapter. Das gehört in eine Anreicherung, nicht hierher.
   *
   * Die vierzig Zeichen Mindesttext sind dieselbe Grenze wie bei
   * Reed: Careerjet liefert einen Anriss, und darunter bleibt nichts,
   * woraus sich Anforderungen lesen liessen.
   */
  if (!s.title || !s.company || beschreibung.length < 40) return null;

  const gehalt = careerjetGehaltStrukturiert(s) ?? careerjetGehalt(s.salary);
  const datum = s.date ? new Date(s.date) : null;

  return {
    externalId: careerjetKennung(s),
    title: s.title.trim(),
    companyName: s.company.trim(),
    location: (s.locations ?? "").trim() || land,
    country: land,
    workModel: normaliseWorkModel(`${s.title} ${s.locations ?? ""} ${beschreibung}`),
    description: beschreibung,
    ...(gehalt
      ? {
          salaryMin: gehalt.min,
          salaryMax: gehalt.max ?? null,
          salaryCurrency: gehalt.currency,
          salaryPeriod: gehalt.period,
          /*
           * Woher die Zahl kommt, entscheidet, wie fest sie behauptet
           * werden darf — und das steht später an der Stelle.
           *
           * `provider`, wenn sie aus `salary_min`/`salary_max` kommt:
           * Das sind eigene Felder, kein gelesener Satz.
           *
           * `text`, wenn sie aus „€45000 per year" stammt. Dann hat
           * ein Muster sie gelesen, und ein Muster kann sich irren.
           */
          salaryProvenance: gehalt.herkunft,
        }
      : {}),
    applyMethod: "portal" as const,
    applyTarget: s.url ?? "",
    originalUrl: s.url ?? "",
    publishedAt: datum && !Number.isNaN(datum.getTime()) ? datum : null,
    raw: { site: s.site ?? null },
  } as RawListing;
}
