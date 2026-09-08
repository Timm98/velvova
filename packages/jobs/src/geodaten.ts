import { sql } from "drizzle-orm";
import type { Database } from "@paycheck/db";
import {
  ortAufloesen,
  ortNormalisieren,
  ortZerlegen,
  type Aufloesung,
  type Referenzort,
} from "@paycheck/matching";

/**
 * Koordinaten für den Bestand nachtragen.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Lücke, die dieses Modul schliesst
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen am 6. September 2026 auf dem analysierten Bestand:
 *
 *   1209 Stellen mit gültiger Ortsangabe
 *     11 davon mit Koordinaten            0,9 %
 *
 * Ein Suchauftrag „bis 30 km um Karlsruhe" konnte damit bei 99 von
 * 100 Stellen nicht sagen, ob sie im Umkreis liegen. Das Kriterium
 * stand im Auftrag, die Prüfung lief, und ihr Ergebnis war fast
 * immer `unbekannt`.
 *
 * Das ist nicht falsch — `unbekannt` ist die ehrliche Antwort ohne
 * Koordinate — aber es ist nutzlos. Ein Umkreis, der nichts
 * eingrenzt, ist kein Umkreis.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das ein Nachziehen ist und kein Geocoding-Dienst
 * ══════════════════════════════════════════════════════════════
 *
 * Es wird nichts gefragt. Die Auflösung geschieht gegen `geo_referenz`
 * — eine lokale Tabelle aus den GeoNames-Postleitzahlen — und gegen
 * `geo_orte`, den bereits bezahlten Zwischenspeicher früherer
 * Nominatim-Anfragen.
 *
 * Kein fremder Dienst wird für diesen Lauf angefasst. Zweitausend
 * Stellen sind zweitausend Anfragen, Nominatim erlaubt eine je
 * Sekunde, und niemand darf eine öffentliche Karte für einen
 * Massenabgleich benutzen, den er lokal erledigen kann.
 */

/**
 * Die Fassung des Auflösungsverfahrens.
 *
 * ── Wozu die Zahl da ist ──────────────────────────────────────
 *
 * Sie beantwortet die Frage „muss diese Stelle noch einmal?" ohne
 * Rätselraten. Ein Lauf überspringt jede Stelle, die schon mit dieser
 * Fassung und derselben Rohangabe aufgelöst wurde.
 *
 * Wird das Verfahren besser — eine neue Referenzquelle, eine
 * korrigierte Zerlegung — steigt die Zahl, und der nächste Lauf holt
 * den Bestand nach. Ohne sie müsste man entweder alles neu rechnen
 * oder den alten Stand für immer behalten.
 */
export const GEO_FASSUNG = 3;

/**
 * Welcher Stand der Ortsreferenz gilt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Referenz versioniert ist statt ersetzt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein neuer Stand wird danebengelegt, nicht darübergeschrieben. Der
 * eindeutige Index von `geo_referenz` führt `quelle_fassung` genau
 * dafür.
 *
 * Der Grund ist nüchtern: Wer den alten Stand löscht, kann eine
 * verschobene Koordinate nicht mehr erklären. “Karlsruhe lag gestern
 * woanders” ist ohne den alten Stand keine beantwortbare Frage — und
 * eine verschobene Koordinate entfernt lautlos Stellen aus jedem
 * Suchauftrag, der einen Umkreis nennt.
 *
 * Der Preis ist Platz: Jeder Stand kostet gut vierzigtausend Zeilen.
 * Das ist billiger als die Frage, die man sonst nicht beantworten
 * kann.
 */
export const GEO_REFERENZ_FASSUNG = "geonames-zip-de-2026-09-06-kreis";

export interface Stellenort {
  id: string;
  location: string;
  country: string;
  workModel: string | null;
  remotePercent: number | null;
}

export interface Ortsbefund extends Aufloesung {
  id: string;
  rohangabe: string;
}

/* ═══════════════════════════════════════════════════════════════
   Eine einzelne Stelle
   ═══════════════════════════════════════════════════════════════ */

/**
 * Eine Stelle auflösen — ohne Datenbank, gegen mitgegebene Referenz.
 *
 * ── Warum vollständig remote kein „nicht gefunden" ist ────────
 *
 * Eine Stelle ohne Ort, weil sie ortsunabhängig ist, hat keine Lücke
 * in den Daten. Sie als `not_found` zu führen hiesse, sie in einer
 * Statistik über fehlende Geodaten mitzuzählen und einen Lauf nach
 * dem anderen erfolglos an ihr zu arbeiten.
 *
 * `not_applicable_remote` sagt: hier ist nichts zu holen, und das ist
 * in Ordnung.
 */
export function stellenortAufloesen(
  stelle: Stellenort,
  referenz: readonly Referenzort[],
): Ortsbefund {
  const teile = ortZerlegen(stelle.location);

  if (!teile.brauchbar && (stelle.workModel === "remote" || stelle.remotePercent === 100)) {
    return {
      id: stelle.id,
      rohangabe: stelle.location,
      status: "not_applicable_remote",
      latitude: null,
      longitude: null,
      stadt: null,
      plz: null,
      region: null,
      genauigkeit: null,
      quelle: null,
      kandidaten: 0,
    };
  }

  return { id: stelle.id, rohangabe: stelle.location, ...ortAufloesen(teile, referenz) };
}

/* ═══════════════════════════════════════════════════════════════
   Referenz für einen Stapel holen
   ═══════════════════════════════════════════════════════════════ */

/**
 * Nur die Referenzzeilen laden, die dieser Stapel überhaupt braucht.
 *
 * ── Warum nicht die ganze Tabelle ─────────────────────────────
 *
 * `geo_referenz` hat vierzigtausend Zeilen. Sie für jeden Stapel von
 * fünfhundert Stellen zu laden wäre verschwendet; sie einmal zu laden
 * und im Speicher zu halten wäre ein Zustand, der bei jedem Import
 * veraltet.
 *
 * Stattdessen: aus dem Stapel die gebrauchten Namen und
 * Postleitzahlen sammeln und genau die holen. Bei fünfhundert Stellen
 * sind das selten mehr als hundert verschiedene Orte — die Ortsangaben
 * wiederholen sich massiv.
 *
 * ── Warum Grosskundenzeilen nur über die Postleitzahl zählen ──
 *
 * Ihr „Ortsname" ist ein Firmenname. Eine Anzeige der Berliner
 * Verkehrsbetriebe würde sonst über den Firmennamen aufgelöst statt
 * über Berlin.
 */
type Zeilen = { rows: Record<string, unknown>[] };

export async function referenzHolen(
  db: Database,
  stellen: readonly Stellenort[],
): Promise<Referenzort[]> {
  const namen = new Set<string>();
  const plzs = new Set<string>();
  const laender = new Set<string>();

  for (const s of stellen) {
    const teile = ortZerlegen(s.location);
    if (!teile.brauchbar) continue;
    laender.add((s.country || "DE").toLowerCase());
    if (teile.plz) plzs.add(teile.plz);
    for (const v of teile.varianten) {
      const norm = ortNormalisieren(v);
      if (norm.length >= 2) namen.add(norm);
    }
    if (teile.region) {
      const norm = ortNormalisieren(teile.region);
      if (norm.length >= 2) namen.add(norm);
    }
  }

  if (namen.size === 0 && plzs.size === 0) return [];
  const namenListe = [...namen];
  const plzListe = [...plzs];
  const laenderListe = laender.size > 0 ? [...laender] : ["de"];

  /*
   * Alle Listen als ein einziger JSON-Parameter je Liste.
   *
   * ── Warum nicht zusammengesetztes SQL ─────────────────────
   *
   * Die Namen in diesen Listen stammen aus `jobs.location` — also aus
   * Text, den eine fremde Stellenbörse geliefert hat. Ihn in eine
   * SQL-Zeichenkette zu setzen und die Anführungszeichen zu verdoppeln
   * ist eine Abwehr, die genau so lange hält, wie niemand sie
   * genauer ansieht. Ein gebundener Parameter ist keine Abwehr, er
   * ist die Abwesenheit des Angriffs.
   *
   * `starts_with` statt `like`: Der Präfix ist ein Ortsname und kann
   * ein Prozentzeichen oder einen Unterstrich enthalten. Bei `like`
   * wären das Platzhalter, und aus einer Suche nach einem Ort würde
   * eine nach vielen.
   */
  const namenJson = JSON.stringify(namenListe);
  const plzJson = JSON.stringify(plzListe);
  const laenderJson = JSON.stringify(laenderListe);

  const ergebnis = (await db.execute(sql`
    with gesucht as (
      select value as name_norm from jsonb_array_elements_text(${namenJson}::jsonb)
    )
    select r.name, r.name_norm, r.region, r.kreis, r.plz, r.latitude, r.longitude, r.plz_anzahl
    from geo_referenz r
    where r.land in (select value from jsonb_array_elements_text(${laenderJson}::jsonb))
      and r.quelle_fassung = ${GEO_REFERENZ_FASSUNG}
      and (
        (r.plz is not null
         and r.plz in (select value from jsonb_array_elements_text(${plzJson}::jsonb)))
        or (
          r.quelle = 'geonames_zip'
          /*
           * ══════════════════════════════════════════════════════
           * Grosskunden-Postleitzahlen sind keine Orte
           * ══════════════════════════════════════════════════════
           *
           * Der GeoNames-PLZ-Bestand für Deutschland enthält neben
           * Städten und Gemeinden auch Postleitzahlen, die EINEM
           * Unternehmen gehören. Der Ortsname ist dann der
           * Firmenname: „Zurich Gruppe Deutschland", „HUK-Coburg",
           * „LBS Süd Landesbausparkasse".
           *
           * Gemeldet am 8. September 2026: Jemand trug „zurich" als
           * Wohnort ein und suchte Stellen in Zürich. Der Rechner
           * meldete 170 Minuten Autofahrt. Er hatte recht — nur
           * nicht mit dem Ort: „zurich" traf die Zurich Gruppe in
           * Bonn (50,728 / 7,0955), und von dort ist es tatsächlich
           * weit.
           *
           * Das ist die schlimmere Sorte Fehler. Ein nicht gefundener
           * Ort sagt, dass er nicht gefunden wurde. Ein falsch
           * gefundener liefert eine Zahl, die aussieht wie eine
           * Auskunft.
           *
           * ── Warum ein Namensmuster und keine Spalte ─────────
           *
           * Weil es keine gibt. 6.816 Zeilen sind als
           * 'geonames_zip_grosskunde' gekennzeichnet, aber die
           * genannten Beispiele stehen alle unter 'geonames_zip' —
           * die Kennzeichnung ist unvollständig, und GeoNames selbst
           * markiert diese Einträge nicht.
           *
           * Ein Ortsname trägt keine Rechtsform. Wer eine Gemeinde
           * ausschliesst, weil „GmbH" darin steht, hat keine
           * ausgeschlossen.
           */
          /*
           * Ohne Backslash geschrieben, mit Absicht.
           *
           * Postgres kennt '\y' als Wortgrenze — nur ist diese Datei
           * TypeScript, und ein '\y' in einem Template-Literal ist
           * dort eine ungültige Escape-Folge. Node bricht das Modul
           * mit 'ERR_INVALID_TYPESCRIPT_SYNTAX' ab, bevor eine einzige
           * Zeile läuft.
           *
           * Stattdessen wird der Name links und rechts mit einem
           * Leerzeichen umschlossen. Dann trifft ' ag ' das Kürzel und
           * nicht die Silbe in „Hagen" oder „Wagenfeld".
           */
          /*
           * Geprüft gegen die 74.677 Zeilen der Quelle: Von den
           * Ausgeschlossenen haben genau zehn mehr als drei
           * Postleitzahlen — und die heissen alle 'Stadtverwaltung'.
           * Es ist also keine einzige Gemeinde dabei.
           */
          and (' ' || r.name_norm || ' ') !~*
            ' (gmbh|mbh|ag|kg|ohg|se|eg|ug|co|v|versicherung|versicherungen|lebensversicherung|bausparkasse|sparkasse|volksbank|bank|konzern|gruppe|holding|service|servicecenter|verwaltung|stadtverwaltung|zentrale|niederlassung|vertrieb|management|universitaet|hochschule|kammer|postfach|grosskunde|deutschland) '
          and (
            r.name_norm in (select name_norm from gesucht)
            or exists (
              select 1 from gesucht g
              where starts_with(r.name_norm, g.name_norm || ' ')
            )
          )
        )
      )
  `)) as unknown as Zeilen;

  return ergebnis.rows.map((r) => ({
    name: String(r.name),
    nameNorm: String(r.name_norm),
    region: r.region === null ? null : String(r.region),
    kreis: r.kreis === null ? null : String(r.kreis),
    plz: r.plz === null ? null : String(r.plz),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    plzAnzahl: Number(r.plz_anzahl ?? 1),
  }));
}

/* ═══════════════════════════════════════════════════════════════
   Der Lauf
   ═══════════════════════════════════════════════════════════════ */

export interface Nachziehbefund {
  gelesen: number;
  geschrieben: number;
  nachStatus: Record<string, number>;
}

/**
 * Einen Stapel offener Stellen auflösen und schreiben.
 *
 * ── Warum begrenzt und wiederaufnehmbar ───────────────────────
 *
 * Der Bestand hat Millionen Zeilen. Ein Lauf, der alles auf einmal
 * will, hält eine Transaktion minutenlang offen, blockiert den Import
 * und lässt bei einem Abbruch nichts zurück ausser verlorener Zeit.
 *
 * Ein Stapel liest, rechnet ohne offene Transaktion und schreibt
 * einmal. Bricht er ab, ist der vorige Stapel geschrieben, und der
 * nächste Aufruf macht dort weiter — die `geo_fassung` sagt ihm, wo
 * „dort" ist.
 */
export async function geodatenNachziehen(
  db: Database,
  optionen: { stapel?: number; nurAnalysierte?: boolean } = {},
): Promise<Nachziehbefund> {
  const stapel = Math.max(1, Math.min(optionen.stapel ?? 500, 5000));

  /*
   * Die Auswahl läuft über `job_analysen`, wenn danach gefragt wird.
   *
   * Der Grund ist gemessen: Eine Abfrage über die volle `jobs`-Tabelle
   * läuft in das Anweisungszeitlimit (57014). Der analysierte Bestand
   * ist der, für den ein Suchauftrag überhaupt Kriterien prüfen kann —
   * ohne Aufgaben und Anforderungen gibt es nichts zu vergleichen.
   */
  const auswahl = optionen.nurAnalysierte
    ? sql`
        select j.id, j.location, j.country, j.work_model, j.remote_percent
        from job_analysen a
        join jobs j on j.id = a.job_id
        where a.status = 'fertig'
          and (j.geo_fassung is distinct from ${GEO_FASSUNG}
               or j.geo_rohangabe is distinct from j.location)
        limit ${stapel}
      `
    : sql`
        select j.id, j.location, j.country, j.work_model, j.remote_percent
        from jobs j
        where j.geo_fassung is null
        limit ${stapel}
      `;

  const roh = (await db.execute(auswahl)) as unknown as Zeilen;
  const stellen: Stellenort[] = roh.rows.map((r) => ({
    id: String(r.id),
    location: String(r.location ?? ""),
    country: String(r.country ?? "DE"),
    workModel: r.work_model === null || r.work_model === undefined ? null : String(r.work_model),
    remotePercent: r.remote_percent === null || r.remote_percent === undefined
      ? null
      : Number(r.remote_percent),
  }));

  if (stellen.length === 0) return { gelesen: 0, geschrieben: 0, nachStatus: {} };

  const referenz = await referenzHolen(db, stellen);
  const befunde = stellen.map((s) => stellenortAufloesen(s, referenz));

  const nachStatus: Record<string, number> = {};
  for (const b of befunde) nachStatus[b.status] = (nachStatus[b.status] ?? 0) + 1;

  /*
   * Ein Schreibvorgang für den ganzen Stapel.
   *
   * `latitude`/`longitude` werden nur gesetzt, wenn die Auflösung
   * welche hat. Eine gescheiterte Auflösung darf eine früher von Hand
   * oder über Nominatim eingetragene Koordinate nicht löschen — sie
   * weiss nichts Besseres, sie weiss nur nichts.
   */
  const werte = befunde.map(
    (b) => sql`(
      ${b.id}::uuid, ${b.stadt}, ${b.plz}, ${b.region}, ${b.status}, ${b.quelle},
      ${b.genauigkeit}, ${b.latitude}::double precision, ${b.longitude}::double precision,
      ${b.rohangabe}
    )`,
  );

  const geschrieben = (await db.execute(sql`
    update jobs j set
      geo_stadt = v.stadt,
      geo_plz = v.plz,
      geo_region = v.region,
      geo_status = v.status,
      geo_quelle = v.quelle,
      geo_genauigkeit = v.genauigkeit,
      geo_aufgeloest_am = now(),
      geo_fassung = ${GEO_FASSUNG},
      geo_rohangabe = v.rohangabe,
      latitude = coalesce(v.lat, j.latitude),
      longitude = coalesce(v.lon, j.longitude)
    from (values ${sql.join(werte, sql`, `)})
      as v(id, stadt, plz, region, status, quelle, genauigkeit, lat, lon, rohangabe)
    where j.id = v.id
    returning j.id
  `)) as unknown as Zeilen;

  return { gelesen: stellen.length, geschrieben: geschrieben.rows.length, nachStatus };
}

/* ═══════════════════════════════════════════════════════════════
   Abdeckung
   ═══════════════════════════════════════════════════════════════ */

export interface Geoabdeckung {
  bestand: number;
  aufgeloest: number;
  mehrdeutig: number;
  nichtGefunden: number;
  remote: number;
  offen: number;
  anteilAufgeloest: number;
}

/**
 * Wie weit der Bestand geokodiert ist.
 *
 * ── Warum `offen` und `nicht gefunden` getrennt stehen ────────
 *
 * Das eine heisst „noch nicht versucht", das andere „versucht und
 * nichts gefunden". Zusammengezählt sähe ein Lauf, der nichts findet,
 * genauso aus wie einer, der nie lief.
 */
export async function geoAbdeckung(
  db: Database,
  optionen: { nurAnalysierte?: boolean } = {},
): Promise<Geoabdeckung> {
  const quelle = optionen.nurAnalysierte
    ? sql`from job_analysen a join jobs j on j.id = a.job_id where a.status = 'fertig'`
    : sql`from jobs j where true`;

  const r = (await db.execute(sql`
    select
      count(*)::int as bestand,
      count(*) filter (where j.geo_status in ('resolved_exact','resolved_city'))::int as aufgeloest,
      count(*) filter (where j.geo_status = 'ambiguous')::int as mehrdeutig,
      count(*) filter (where j.geo_status in ('not_found','invalid_input'))::int as nicht_gefunden,
      count(*) filter (where j.geo_status = 'not_applicable_remote')::int as remote,
      count(*) filter (where j.geo_status is null)::int as offen
    ${quelle}
  `)) as unknown as Zeilen;

  const z = r.rows[0] ?? {};
  const bestand = Number(z.bestand ?? 0);
  const aufgeloest = Number(z.aufgeloest ?? 0);
  return {
    bestand,
    aufgeloest,
    mehrdeutig: Number(z.mehrdeutig ?? 0),
    nichtGefunden: Number(z.nicht_gefunden ?? 0),
    remote: Number(z.remote ?? 0),
    offen: Number(z.offen ?? 0),
    anteilAufgeloest: bestand === 0 ? 0 : aufgeloest / bestand,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Einen einzelnen Ort nachschlagen
   ═══════════════════════════════════════════════════════════════ */

/**
 * Die Koordinaten zu einem Ortsnamen — für den Mittelpunkt eines
 * Umkreises.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das dieselbe Auflösung ist wie für die Stellen
 * ══════════════════════════════════════════════════════════════
 *
 * Weil sonst zwei Verfahren dieselbe Frage verschieden beantworten.
 * Läge „Karlsruhe" für die Stelle bei 49.008 und für den Suchmittel-
 * punkt bei 49.014, wäre jede Entfernung um den Unterschied daneben —
 * und an der Umkreisgrenze entscheidet das über Aufnahme oder
 * Ausschluss.
 *
 * ── Was bei Mehrdeutigkeit passiert ───────────────────────────
 *
 * Nichts. `ambiguous` kommt als `ambiguous` zurück, und der Aufrufer
 * muss nachfragen. Für den Mittelpunkt einer Suche wiegt das schwerer
 * als für eine einzelne Stelle: Ein falscher Mittelpunkt verschiebt
 * nicht eine Anzeige, sondern die ganze Suche.
 */
export async function ortNachschlagen(
  db: Database,
  ort: string,
  land = "DE",
): Promise<Aufloesung> {
  const stelle: Stellenort = {
    id: "nachschlag",
    location: ort,
    country: land,
    workModel: null,
    remotePercent: null,
  };
  const referenz = await referenzHolen(db, [stelle]);
  return ortAufloesen(ortZerlegen(ort), referenz);
}
