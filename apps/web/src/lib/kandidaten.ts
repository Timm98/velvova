import { and, desc, eq, inArray, or, sql, isNull, gte } from "drizzle-orm";
import { schema } from "@paycheck/db";
import type { UserConstraints } from "@paycheck/domain";
import type { Suchzweig } from "@/lib/jobs/zweige";

/**
 * Welche Stellen überhaupt in die Bewertung kommen.
 *
 * ── Warum es diese Vorauswahl gibt ────────────────────────────
 *
 * Bisher wurde der ganze Bestand für jede Person bewertet und im
 * Speicher gehalten. Gemessen wiegt ein bewerteter Datensatz rund
 * 11 KB — bei 58.351 Stellen also 640 MB je gleichzeitiger Person.
 * Der Webserver ist daran mehrfach gestorben, und keine Obergrenze hat
 * das gelöst; sie hat es nur verschoben.
 *
 * Der Ansatz war zu teuer, nicht die Zahl zu hoch. Also wählt jetzt
 * die Datenbank aus, und bewertet wird nur, was ausgewählt wurde.
 *
 * ── Die Regel, an der alles hängt ─────────────────────────────
 *
 * Ausgeschlossen wird nur, was **nachweislich** widerspricht. Die
 * Bedingungsprüfung kennt drei Ausgänge — `eligible`, `uncertain`,
 * `blocked` — und stuft `uncertain` bewusst nie zu `blocked` hoch:
 * Eine Anzeige, die nichts zum Gehalt sagt, verletzt keine
 * Gehaltsuntergrenze.
 *
 * Diese Vorauswahl muss dieselbe Zurückhaltung haben. Filterte sie
 * schärfer, verschwänden Stellen aus der Liste, die die Prüfung
 * durchgelassen hätte — und niemand könnte den Unterschied sehen, weil
 * eine kürzere Liste wie eine vollständige aussieht.
 *
 * Deshalb hier nur zwei Bedingungen, und beide sind in der Anzeige
 * immer entscheidbar:
 *
 *   **Arbeitsmodell.** `work_model` ist nie leer. Steht es nicht in
 *   der Liste der akzeptierten, ist die Stelle blockiert — genau so
 *   urteilt auch `checkConstraints`.
 *
 *   **Gehalt.** Nur wenn der Arbeitgeber es selbst angegeben hat
 *   (`salary_disclosed`) UND der Betrag aufs Jahr gerechnet unter der
 *   Untergrenze liegt. Fehlt die Angabe oder stammt sie aus dem Text,
 *   bleibt die Stelle drin.
 *
 * Pendelzeit, Sprache und Lizenzen bleiben draussen: Sie hängen an
 * Daten, die in der Anzeige oft fehlen, und wären damit genau die
 * schärfere Filterung, die hier nicht sein darf.
 */

/** Wie `normaliseSalaryToYear` in `constraints.ts` — nur in SQL. */
/**
 * Stellen, deren ARBEITGEBER auf den Suchbegriff passt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Untermenge und kein Verbund
 * ══════════════════════════════════════════════════════════════
 *
 * Der erste Anlauf schrieb `companies.name` direkt in die
 * Bedingung. Das lief in der Stellenliste, die `companies` ohnehin
 * verbindet — und brach überall sonst:
 *
 *   42P01  missing FROM-clause entry for table "companies"
 *
 * `kandidatenBedingung` wird nämlich auch für Abfragen benutzt, die
 * nur `jobs` lesen. Eine Bedingung, die stillschweigend voraussetzt,
 * wie der Aufrufer seine Tabellen verbindet, ist keine Bedingung,
 * sondern eine Falle.
 *
 * Als Untermenge trägt sie sich selbst. Und sie ist nicht langsamer:
 * Der Index auf `companies.name` (Migration 0098) liefert die
 * Kennungen in einem Durchgang, und `jobs_company_idx` schlägt sie
 * auf der Stellenseite nach. 416.198 Firmen gegen 3,46 Mio. Stellen
 * — gesucht wird auf der kleinen Seite.
 */
function firmennameTrifft(begriff: string) {
  return sql`${schema.jobs.companyId} in (
    select ${schema.companies.id} from ${schema.companies}
    where to_tsvector('simple', ${schema.companies.name}) @@ plainto_tsquery('simple', ${begriff})
  )`;
}

const JAHRESGEHALT = sql<number>`
  case ${schema.jobs.salaryPeriod}
    when 'month' then coalesce(${schema.jobs.salaryMax}, ${schema.jobs.salaryMin}) * 12
    when 'hour'  then coalesce(${schema.jobs.salaryMax}, ${schema.jobs.salaryMin}) * 40 * 52
    else coalesce(${schema.jobs.salaryMax}, ${schema.jobs.salaryMin})
  end`;

/**
 * Die Bedingungen als SQL — oder `undefined`, wenn nichts einschränkt.
 *
 * Getrennt und exportiert, damit die Regel prüfbar ist, ohne eine
 * Bewertung zu durchlaufen.
 */
export interface Vorauswahl {
  /** Der freie Suchbegriff aus dem Feld oben. */
  suche?: string | null;
  /**
   * Der Ort — als eigener Filter, nicht als Suchwort.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum das hier steht und nicht mehr erst im Browser
   * ══════════════════════════════════════════════════════════════
   *
   * Der Ort wurde bisher NACH der Auswahl gefiltert: Die Datenbank
   * lieferte die neuesten 2.000 Anzeigen aus ganz Deutschland, und
   * erst danach behielt JavaScript die aus Karlsruhe.
   *
   * Bei 2,6 Mio. Anzeigen ist das eine Lotterie. „Bayern" hätte in
   * den neuesten 2.000 bundesweit vielleicht hundert Treffer — und
   * die Liste sähe aus, als gäbe es dort kaum Stellen.
   *
   * Mit `jobs_ort_idx` kostet es nichts, das richtig zu machen:
   * `to_tsvector('simple', location)` ist indiziert, und die
   * Wortsuche trifft „Wedding, Berlin" ebenso wie „Berlin" — ohne
   * „Überlingen" mitzunehmen, was ein `%berlin%` täte.
   */
  ort?: string | null;
  /**
   * Mehrere Berufe mit eigenem Mindestgehalt.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum sie nicht in `suche` passen
   * ══════════════════════════════════════════════════════════════
   *
   * `suche` wird mit `plainto_tsquery` gelesen, und das verbindet die
   * Wörter mit UND. „bürokaufmann elektriker" verlangt also beides in
   * EINEM Titel — eine Bedingung, die nie erfüllt ist.
   *
   * Zweige werden stattdessen mit ODER verbunden, und jeder trägt
   * sein eigenes Gehalt: „Bürokaufmann ab 40.000 ODER Elektriker ab
   * 50.000". Das Gehalt gehört in den Zweig, weil es sich zwischen
   * den Berufen unterscheidet — ein gemeinsames `gehaltAb` hätte den
   * einen zu hoch und den anderen zu niedrig angesetzt.
   *
   * Steht hier etwas, wird `suche` nicht mehr gelesen: Zwei
   * Textbedingungen nebeneinander wären zwei Wahrheiten über
   * dieselbe Frage.
   */
  zweige?: Suchzweig[];
  /**
   * Wie viele Kandidaten geladen werden sollen.
   *
   * Steht hier und nicht als eigenes Argument, weil es zur Auswahl
   * gehört: Was gesucht wird und wie tief gesucht wird, sind zwei
   * Seiten derselben Frage.
   */
  bedarf?: number;
}

export function kandidatenBedingung(
  c: UserConstraints,
  vorauswahl?: Vorauswahl | string | null,
) {
  /* Der alte Aufruf mit einem blossen Suchbegriff bleibt gültig. */
  const v: Vorauswahl =
    typeof vorauswahl === "string" || vorauswahl === null || vorauswahl === undefined
      ? { suche: vorauswahl ?? null }
      : vorauswahl;
  const suche = v.suche;

  const teile = [
    eq(schema.jobs.isDemo, false),
    /*
     * ══════════════════════════════════════════════════════════════
     * Was die Quelle nicht mehr führt, wird nicht mehr empfohlen
     * ══════════════════════════════════════════════════════════════
     *
     * `jobs.availability_state` entsteht am Ende jedes vollständigen
     * Ernte-Laufs aus den Fundstellen (siehe `standAusFundstellen`).
     * Hier wird er zum ersten Mal gelesen.
     *
     * Ausgeschlossen wird, was die Quelle nicht mehr als offene
     * Ausschreibung führt:
     *
     *   no_longer_published      aus zwei vollständigen Läufen weg
     *   source_reported_closed   die Quelle sagt es ausdrücklich
     *   deadline_expired         die Frist ist verstrichen
     *   application_unavailable  die Bewerbungsseite ist weg
     *
     * Drin bleiben `active`, `verification_pending` und `unknown` —
     * und die beiden letzten mit Absicht: `verification_pending`
     * heisst „einmal vermisst, noch nicht bestätigt", und wer das
     * ausblendet, verliert bei jedem Sonderfall einer Quelle für
     * einen halben Tag Stellen, die es noch gibt. `unknown` betrifft
     * alles, was vor dieser Logik in den Bestand kam.
     *
     * ── Warum hier und nicht im Nachfilter ──────────────────────
     *
     * Weil die Auswahl vorher greift. Wer erst sechshundert
     * Kandidaten holt und danach die geschlossenen entfernt, hat
     * sechshundert minus die geschlossenen — und keinen Ersatz
     * dafür. Der Teilindex `jobs_availability_idx` macht diese
     * Bedingung billig.
     */
    sql`${schema.jobs.availabilityState} in ('active', 'verification_pending', 'unknown')`,
  ];

  /*
   * ══════════════════════════════════════════════════════════════
   * Bei einer Textsuche zählt nur, was frisch ist
   * ══════════════════════════════════════════════════════════════
   *
   * Ohne Suchbegriff liefert die Abfrage die neuesten 2.000 Anzeigen —
   * geordnet über `jobs_kandidaten_land_idx`, in knapp drei Sekunden.
   *
   * Mit einer Textbedingung geht das nicht mehr: Der Wortindex kennt
   * keine Reihenfolge, also muss die Datenbank ALLE Treffer holen und
   * sortieren. Gemessen am 6. September 2026 an 2,6 Mio. Zeilen:
   *
   *   ort=karlsruhe    2.338 ms       ort=berlin     37.701 ms
   *   ort=bayern      37.371 ms
   *
   * Das Fenster löst beides zugleich. Es schneidet die Treffermenge
   * so weit zusammen, dass die Sortierung entfallen kann — und es
   * ersetzt genau das, wofür die Sortierung da war: dass in der
   * Auswahl Frisches steht und nicht Beliebiges.
   *
   *   ort=karlsruhe       85 ms       ort=berlin        131 ms
   *   ort=bayern       2.601 ms
   *
   * ── Warum einundzwanzig Tage ────────────────────────────────
   *
   * Es ist eine Produktentscheidung, kein Messwert. Drei Wochen sind
   * lang genug, dass auch ein seltener Beruf genug Treffer hat, und
   * kurz genug, dass niemand eine Anzeige aufschlägt, die es nicht
   * mehr gibt. Wer weiter zurück will, sucht ohne Begriff.
   */
  const textsuche =
    (v.suche?.trim().length ?? 0) >= 2 ||
    (v.ort?.trim().length ?? 0) >= 2 ||
    (v.zweige ?? []).some((z) => z.q.trim().length >= 2);
  if (textsuche) {
    teile.push(
      sql`coalesce(${schema.jobs.publishedAt}, ${schema.jobs.fetchedAt}) > now() - (${SUCHFENSTER_TAGE} || ' days')::interval`,
    );
  }

  /*
   * Der Ort zuerst — er schränkt am stärksten ein.
   *
   * `simple` und nicht `german`: Ortsnamen werden nicht gestemmt.
   * Der deutsche Stemmer führte sonst Orte zusammen, die nichts
   * miteinander zu tun haben.
   */
  const ort = v.ort?.trim();
  if (ort && ort.length >= 2) {
    teile.push(
      sql`to_tsvector('simple', ${schema.jobs.location}) @@ plainto_tsquery('simple', ${ort})`,
    );
  }

  /*
   * ── Der Suchbegriff gehört in die Auswahl ─────────────────
   *
   * Er stand bisher dahinter: Erst wurden die neuesten 2.000 Stellen
   * bewertet, dann wurde in ihnen gesucht. Gemessen am Bestand von
   * 823.429 Stellen war das verheerend —
   *
   *   Zerspanungsmechaniker  2.907 vorhanden ·  14 in der Auswahl
   *   Erzieher               2.739 vorhanden ·   4
   *   Data Engineer            996 vorhanden ·   0
   *
   * Wer „Data Engineer" eintippte, bekam null Treffer bei 996
   * vorhandenen Stellen. Und zwar wortlos — eine leere Liste sieht aus
   * wie ein leerer Arbeitsmarkt.
   *
   * Gesucht wird in Titel und Wortmenge. Die Wortmenge ist die beim
   * Import gebildete Menge eindeutiger Wörter der Beschreibung; sie zu
   * durchsuchen findet auch, was nur im Text steht.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Wortsuche über die Indizes — nicht `like '%…%'`
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand `lower(title) like '%wort%' or description_tokens like
   * '%wort%'`, je Wort. Ein führendes Prozentzeichen ist von keinem
   * Index bedienbar: Postgres liest die ganze Tabelle.
   *
   * Gemessen am 6. September 2026 an 2.599.863 Zeilen: Die Seite
   * brauchte 97 Sekunden ohne Suchbegriff und lief mit `?q=bayern` in
   * den Statement-Timeout — HTTP 500. Für die Person sah das aus wie
   * eine kaputte Seite, und der Grund stand nirgends: Ein fehlender
   * Index erzeugt keine Fehlermeldung, nur Zeit.
   *
   * Die Indizes gibt es seit Migration 0061, und die öffentliche
   * Suche nutzt sie seither. Die angemeldete Suche hat den Schritt
   * nie mitgemacht.
   *
   *   jobs_volltext_idx   gin (to_tsvector('german', title))
   *   jobs_ort_idx        gin (to_tsvector('simple', location))
   *
   * ══════════════════════════════════════════════════════════════
   * Titel ODER Ort — und was das ändert
   * ══════════════════════════════════════════════════════════════
   *
   * „bayern" steht in keinem Stellentitel. Es ist ein Ort, und dafür
   * gibt es den zweiten Index. Ohne ihn wäre die schnelle Suche zwar
   * schnell, fände aber genau das nicht, wonach Menschen zuerst
   * suchen.
   *
   * `german` beim Titel, `simple` beim Ort: Der deutsche Stemmer
   * führt „Pflegekräfte" und „Pflegekraft" zusammen — bei Ortsnamen
   * täte er dasselbe mit Orten, die nichts miteinander zu tun haben.
   *
   * ══════════════════════════════════════════════════════════════
   * Was dabei wegfällt
   * ══════════════════════════════════════════════════════════════
   *
   * Die Suche im Beschreibungstext (`description_tokens`) und die
   * Teilwortsuche. „eng" findet „Engineer" nicht mehr; gesucht wird
   * in ganzen Wörtern.
   *
   * Ein Index auf den Beschreibungstext wäre die Alternative, und
   * Migration 0061 hat sich ausdrücklich dagegen entschieden: Der
   * Text ist bei vielen Quellen lizenzrechtlich nicht frei
   * wiedergebbar, und der Index würde den Bestand um ein Vielfaches
   * aufblähen — für Treffer, die wir nicht anzeigen dürfen.
   *
   * ── Warum der ganze Satz und nicht Wort für Wort ────────────
   *
   * `plainto_tsquery` verbindet die Wörter selbst mit UND und wirft
   * Füllwörter weg: Aus „jobs in bayern" wird `job & bayern`, das
   * „in" verschwindet. Wort für Wort geprüft, hätte „in" eine leere
   * Anfrage ergeben — und eine leere Anfrage passt auf nichts.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Mehrere Berufe: ODER dazwischen, das Gehalt im Zweig
   * ══════════════════════════════════════════════════════════════
   *
   * „Bürokaufmann ab 40k und auch Elektriker ab 50k" ist keine
   * schwierige Bedingung — sie ist nur keine EINZELNE. Als ein
   * Suchbegriff geschrieben wurde daraus `'bürokaufmann' &
   * 'elektriker'`, und kein Stellentitel trägt beide Berufe.
   *
   * Jeder Zweig steht deshalb für sich: sein Beruf im Titel, sein
   * Gehalt daneben. Verbunden werden sie mit ODER — wer zwei Berufe
   * nennt, will Stellen aus beiden, nicht Stellen, die beides sind.
   *
   * ── Warum das Gehalt hier steht und nicht im Nachfilter ─────
   *
   * Weil der Nachfilter erst nach der Auswahl greift. Bei zwei
   * Berufen mit verschiedenen Ansprüchen hiesse das: Die Datenbank
   * liefert 1.200 Zeilen ohne Rücksicht auf das Gehalt, und danach
   * fällt der halbe Elektrikerzweig weg. Übrig bliebe eine Liste, in
   * der ein Beruf gut vertreten ist und der andere kaum — aus einem
   * Grund, den niemand sehen kann.
   */
  const zweige = (v.zweige ?? []).filter((z) => z.q.trim().length >= 2);
  if (zweige.length > 0) {
    const zweigBedingungen = zweige.map((z) => {
      const wort = z.q.trim();
      const text = or(
        sql`to_tsvector('german', ${schema.jobs.title}) @@ plainto_tsquery('german', ${wort})`,
        sql`to_tsvector('simple', ${schema.jobs.location}) @@ plainto_tsquery('simple', ${wort})`,
        firmennameTrifft(wort),
      )!;
      if (z.gehaltAb === undefined) return text;
      /*
       * Dieselbe Nachsicht wie beim Gehalt aus dem Profil: Wer nichts
       * angegeben hat, fliegt nicht raus. Nur die nachgewiesene
       * Unterschreitung fliegt raus — sonst verschwänden mit dem
       * Filter auch alle schweigsamen Anzeigen, und das sind bis
       * heute knapp achtzehn Prozent.
       */
      return and(
        text,
        or(
          eq(schema.jobs.salaryDisclosed, false),
          and(isNull(schema.jobs.salaryMin), isNull(schema.jobs.salaryMax)),
          gte(JAHRESGEHALT, z.gehaltAb),
        )!,
      )!;
    });
    teile.push(zweigBedingungen.length === 1 ? zweigBedingungen[0]! : or(...zweigBedingungen)!);
  } else {
    const begriff = suche?.trim();
    if (begriff && begriff.length >= 2) {
      teile.push(
        or(
          sql`to_tsvector('german', ${schema.jobs.title}) @@ plainto_tsquery('german', ${begriff})`,
          sql`to_tsvector('simple', ${schema.jobs.location}) @@ plainto_tsquery('simple', ${begriff})`,
          /*
           * ══════════════════════════════════════════════════════
           * Der Arbeitgeber ist die zweite Art zu suchen
           * ══════════════════════════════════════════════════════
           *
           * Gemeldet am 8. September 2026: „ein job im landratsamt
           * karlsruhe im sozialen bereich" fand nichts. „Landratsamt
           * Karlsruhe" steht weder im Stellentitel noch im Ortsfeld
           * — es ist der Name des Arbeitgebers, und danach wurde
           * nirgends gesucht.
           *
           * Migration 0061 hatte das schon vorgesehen: „Die Suche
           * nach Arbeitgebern läuft deshalb getrennt über
           * `companies.name`." Den Index dafür gab es nie; er kommt
           * mit 0098.
           *
           * `simple` wie beim Ort: Firmennamen werden nicht gebeugt,
           * und der deutsche Stemmer führte sonst Namen zusammen,
           * die nichts miteinander zu tun haben.
           *
           * Der Verbund auf `companies` steht ohnehin in der Abfrage
           * — die Zeile kostet also keine zusätzliche Tabelle,
           * sondern nur die Bedingung. 416.198 Firmen gegen 3,46
           * Mio. Stellen: die kleinere Seite des Verbunds.
           */
          firmennameTrifft(begriff),
        )!,
      );
    }
  }

  /*
   * Arbeitsmodell: immer entscheidbar, also sicher zu filtern.
   *
   * Sind alle drei erlaubt — die Voreinstellung —, schränkt das nichts
   * ein, und die Bedingung entfällt. Eine Liste mit allen möglichen
   * Werten wäre nur langsamer.
   */
  if (c.acceptedWorkModels.length > 0 && c.acceptedWorkModels.length < 3) {
    teile.push(inArray(schema.jobs.workModel, c.acceptedWorkModels));
  }

  /*
   * Gehalt: nur nachgewiesene Unterschreitungen.
   *
   * `or(...)` liest sich umständlich und ist genau richtig: Eine
   * Stelle bleibt drin, wenn der Arbeitgeber nichts angegeben hat,
   * wenn kein Betrag dasteht, oder wenn der Betrag reicht. Nur die
   * vierte Möglichkeit — angegeben, vorhanden, zu niedrig — fliegt
   * raus.
   */
  if (c.minSalaryPerYear !== null) {
    teile.push(
      or(
        eq(schema.jobs.salaryDisclosed, false),
        and(isNull(schema.jobs.salaryMin), isNull(schema.jobs.salaryMax)),
        gte(JAHRESGEHALT, c.minSalaryPerYear),
      )!,
    );
  }

  /*
   * ── Das Land ist eine harte Bedingung ─────────────────────
   *
   * Es fehlte. `UserConstraints` führt `country` seit dem ersten
   * Entwurf, mit „DE" als Vorgabe, und `targetCountries` daneben —
   * benutzt hat sie hier nie jemand.
   *
   * Die Folge war im Produkt sichtbar: Wer in Karlsruhe suchte, bekam
   * Stellen aus Christchurch. Nicht weil die Ortssuche falsch rechnete,
   * sondern weil die 2.000 Kandidaten aus dem gesamten Weltbestand
   * gezogen wurden — 1,7 Millionen Anzeigen aus 19 Ländern, ohne eine
   * einzige Zeile, die das einschränkt.
   *
   * ── Warum nicht „umziehbereit heisst überall" ─────────────
   *
   * Umzugsbereitschaft ohne genanntes Zielland ist keine Erlaubnis für
   * neunzehn Länder. Wer nach Österreich will, trägt Österreich ein;
   * bis dahin ist eine Stelle in Neuseeland für jemanden mit
   * deutschem Wohnsitz keine Stelle, sondern Rauschen.
   *
   * Auch Remote-Stellen fallen darunter: `jobs.country` ist das Land,
   * in dem beschäftigt wird, nicht der Ort des Schreibtischs. Eine
   * Remote-Stelle in den USA kann jemand ohne Arbeitserlaubnis dort
   * nicht annehmen.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Kein Land gesagt heisst überall — nicht heisst Deutschland
   * ══════════════════════════════════════════════════════════════
   *
   * `country` hatte `"DE"` als Vorgabe. Damit bekam jeder, der nie
   * etwas eingetragen hat, ausschliesslich deutsche Stellen: 998 von
   * 1.024 Konten, gemessen am 6. September 2026. Wer in Wien oder
   * Zürich sitzt, sah einen leeren Arbeitsmarkt und keine Erklärung.
   *
   * Ohne Angabe wird deshalb nicht eingeschränkt. Der Bestand ist
   * global — 1,05 Mio. deutsche, 285.000 britische, 226.000
   * französische Anzeigen —, und die Auswahl nimmt die neuesten
   * daraus.
   *
   * ── Und warum das nichts kostet ─────────────────────────────
   *
   * Gemessen an 600 Kandidaten:
   *
   *   nur DE                     381 ms
   *   global, ohne Landfilter    491 ms
   *
   * Für den Fall ohne Filter gibt es `jobs_kandidaten_idx
   * (is_demo, datum)`. Er ist genau dafür da.
   */
  const laender = [
    ...new Set(
      [c.country, ...c.targetCountries].filter(
        (l): l is string => typeof l === "string" && l.length > 0,
      ),
    ),
  ];
  if (laender.length > 0) {
    teile.push(inArray(schema.jobs.country, laender));
  }

  return and(...teile);
}

/** Die Reihenfolge, in der Kandidaten genommen werden: die neuesten zuerst. */
/**
 * Wie weit eine Textsuche zurückreicht, in Tagen.
 *
 * Siehe die Begründung in `kandidatenBedingung`: Das Fenster ersetzt
 * die Sortierung, die bei einer Textbedingung nicht mehr bezahlbar ist.
 */
export const SUCHFENSTER_TAGE = 21;

/**
 * Ob die Auswahl sortiert werden muss.
 *
 * ── Warum das eine eigene Frage ist ───────────────────────────
 *
 * Ohne Textbedingung ist die Sortierung der Weg zum Ergebnis: Der
 * Index liefert die neuesten, die Abfrage hört nach 2.000 auf.
 *
 * Mit Textbedingung ist sie das Gegenteil — sie zwingt die Datenbank,
 * erst alle Treffer zu holen. Das Fenster übernimmt dann ihre
 * Aufgabe, und die Reihenfolge der Liste entsteht ohnehin später aus
 * dem Fit Score.
 */
export function brauchtReihenfolge(vorauswahl?: Vorauswahl | string | null): boolean {
  const v: Vorauswahl =
    typeof vorauswahl === "string" || vorauswahl === null || vorauswahl === undefined
      ? { suche: vorauswahl ?? null }
      : vorauswahl;
  return !(
    (v.suche?.trim().length ?? 0) >= 2 ||
    (v.ort?.trim().length ?? 0) >= 2 ||
    (v.zweige ?? []).some((z) => z.q.trim().length >= 2)
  );
}

export const KANDIDATEN_REIHENFOLGE = desc(
  sql`coalesce(${schema.jobs.publishedAt}, ${schema.jobs.fetchedAt})`,
);
