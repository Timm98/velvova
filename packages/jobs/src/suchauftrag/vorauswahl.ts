import { and, eq, gt, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@paycheck/db";
import { arbeitsmodellNormal, type Suchkriterium } from "@paycheck/matching";

/**
 * Die grobe Vorauswahl in der Datenbank.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie zurückhaltender filtert als die Prüfung
 * ══════════════════════════════════════════════════════════════
 *
 * Die feine Prüfung kennt fünf Ausgänge und darf `unbekannt` sagen.
 * SQL kann das nicht — eine Zeile ist drin oder nicht.
 *
 * Filterte die Vorauswahl so scharf wie die Prüfung, verschwänden
 * genau die Stellen, die die Prüfung als „offen" gemeldet hätte. Und
 * das fiele niemandem auf: Eine kürzere Liste sieht aus wie eine
 * vollständige.
 *
 * Deshalb kommt hier nur weg, was in der Anzeige IMMER entscheidbar
 * ist und nachweislich widerspricht.
 *
 * ══════════════════════════════════════════════════════════════
 * Die drei Fallen, die der Auftrag ausdrücklich nennt
 * ══════════════════════════════════════════════════════════════
 *
 *   Leerer Filter heisst „keine Einschränkung", nicht „nichts passt".
 *   NULL darf über die SQL-Dreierlogik keine Treffer verschlucken.
 *   Ein Wunsch wird hier nicht heimlich zur harten Bedingung.
 *
 * Die zweite ist die tückische: `salary_max >= 45000` ist für eine
 * Anzeige ohne Gehaltsangabe weder wahr noch falsch, und `WHERE`
 * behandelt „nicht wahr" wie „falsch". Eine einzige solche Zeile
 * hätte alle Anzeigen ohne Gehaltsangabe entfernt — in diesem Bestand
 * die Mehrheit.
 */

/** Wie viele Kandidaten je Auftrag und Runde vertieft geprüft werden. */
export const KANDIDATEN_JE_RUNDE = 30;

export interface Vorauswahlrahmen {
  /** Die Länder, in denen gearbeitet werden darf. Leer heisst: keine Einschränkung. */
  laender: string[];
  /** Nur Stellen, deren Analyse nach diesem Zeitpunkt fertig wurde. */
  analyseSeit: Date | null;
  /** Mindestfassung der Analyse. */
  analyseFassung: number;
}

/** Nur `muss`-Kriterien dürfen die Vorauswahl einschränken. */
function nurMuss(kriterien: readonly Suchkriterium[]): Suchkriterium[] {
  return kriterien.filter((k) => k.staerke === "muss");
}

/**
 * Alternativen einer Gruppe dürfen nicht einzeln filtern.
 *
 * „Stuttgart oder remote" als zwei UND-Bedingungen fände nichts. Eine
 * Gruppe kommt deshalb nur in die Vorauswahl, wenn sie aus einem
 * einzigen Kriterium besteht — sonst entscheidet die feine Prüfung.
 */
function alleinstehend(kriterien: readonly Suchkriterium[]): Suchkriterium[] {
  const proGruppe = new Map<string, number>();
  for (const k of kriterien) {
    if (k.gruppe === null) continue;
    proGruppe.set(k.gruppe, (proGruppe.get(k.gruppe) ?? 0) + 1);
  }
  return kriterien.filter((k) => k.gruppe === null || (proGruppe.get(k.gruppe) ?? 0) === 1);
}

function alsListe(wert: unknown): string[] {
  if (Array.isArray(wert)) return wert.map((w) => String(w).toLowerCase().trim()).filter(Boolean);
  if (wert === null || wert === undefined) return [];
  const s = String(wert).toLowerCase().trim();
  return s ? [s] : [];
}

/** Wie `aufJahr` in der Prüfung — nur in SQL. */
const JAHRESGEHALT = sql<number>`
  case ${schema.jobs.salaryPeriod}
    when 'month' then coalesce(${schema.jobs.salaryMax}, ${schema.jobs.salaryMin}) * 12
    when 'hour'  then coalesce(${schema.jobs.salaryMax}, ${schema.jobs.salaryMin}) * 40 * 52
    else coalesce(${schema.jobs.salaryMax}, ${schema.jobs.salaryMin})
  end`;

export interface Vorauswahloptionen {
  /**
   * Die Stichwörter weglassen.
   *
   * Für den semantischen Recall-Schritt: Er soll gerade das finden,
   * was über Titel und Stichwort nicht auftaucht — „Kommissionierer"
   * für jemanden, der „Lagerhelfer" gesagt hat. Mit dem Stichwort im
   * Filter fände er nur, was die Stichwortsuche ohnehin schon hat.
   *
   * Die harten Strukturbedingungen bleiben: Land, Gehalt,
   * Arbeitsmodell. Semantik hebt keine Bedingung auf.
   */
  ohneBegriffe?: boolean;
}

export function vorauswahlBedingung(
  kriterien: readonly Suchkriterium[],
  rahmen: Vorauswahlrahmen,
  optionen: Vorauswahloptionen = {},
): SQL | undefined {
  const teile: SQL[] = [eq(schema.jobs.isDemo, false)];

  if (rahmen.laender.length > 0) {
    teile.push(inArray(schema.jobs.country, rahmen.laender));
  }

  const harte = alleinstehend(nurMuss(kriterien));

  for (const k of harte) {
    switch (k.kriterium) {
      case "arbeitsmodell": {
        /*
         * `work_model` ist nie leer — die Spalte hat kein NULL. Damit
         * ist die Bedingung immer entscheidbar und sicher zu filtern.
         */
        const werte = alsListe(k.wert)
          .map(arbeitsmodellNormal)
          .filter((w) => w === "on_site" || w === "hybrid" || w === "remote");
        if (werte.length === 0 || werte.length === 3) break;
        if (k.operator === "nicht") {
          teile.push(sql`${schema.jobs.workModel}::text <> all(${sql.raw(`array[${werte.map((w) => `'${w}'`).join(",")}]`)})`);
        } else {
          teile.push(sql`${schema.jobs.workModel}::text = any(${sql.raw(`array[${werte.map((w) => `'${w}'`).join(",")}]`)})`);
        }
        break;
      }

      case "mindestgehalt": {
        const grenze = Number(k.wert);
        if (!Number.isFinite(grenze)) break;
        /*
         * Nur nachgewiesene Unterschreitungen.
         *
         * Das `or(...)` liest sich umständlich und ist genau richtig:
         * Eine Stelle bleibt drin, wenn der Arbeitgeber nichts
         * angegeben hat, wenn kein Betrag dasteht, oder wenn er
         * reicht. Nur die vierte Möglichkeit — angegeben, vorhanden,
         * zu niedrig — fliegt raus.
         */
        teile.push(
          or(
            eq(schema.jobs.salaryDisclosed, false),
            and(isNull(schema.jobs.salaryMin), isNull(schema.jobs.salaryMax)),
            gte(JAHRESGEHALT, grenze),
          )!,
        );
        break;
      }

      case "taetigkeit":
      case "berufsfeld": {
        if (optionen.ohneBegriffe) break;
        /*
         * Der Suchbegriff gehört in die Auswahl, nicht dahinter.
         *
         * Stünde er dahinter, würden erst die neuesten Stellen geholt
         * und dann in ihnen gesucht — bei einer Million Anzeigen
         * findet das für die meisten Berufe null Treffer bei tausenden
         * vorhandenen.
         */
        const worte = alsListe(k.wert).filter((w) => w.length >= 3);
        if (worte.length === 0) break;
        /*
         * Am Wortanfang, nicht irgendwo im Wort.
         *
         * `like '%lager%'` fand in einem Probelauf eine Küchenstelle,
         * deren Beschreibung „Lagerung" enthielt. Die Vorauswahl gab
         * sie weiter, die Prüfung nannte sie einen Treffer, und in der
         * Mail hätte gestanden: „Die Anzeige nennt lager."
         *
         * Ein führendes Leerzeichen davor bindet das Muster an einen
         * Wortanfang. Die Wortmenge ist leerzeichengetrennt, deshalb
         * wird sie vorn ergänzt — sonst fiele das erste Wort heraus.
         */
        const alternativen = worte.map(
          (w) =>
            or(
              sql`' ' || lower(${schema.jobs.title}) like ${`% ${w}%`}`,
              sql`' ' || ${schema.jobs.descriptionTokens} like ${`% ${w}%`}`,
            )!,
        );
        teile.push(or(...alternativen)!);
        break;
      }

      case "arbeitsland": {
        /*
         * Immer entscheidbar: `jobs.country` ist nie leer. Damit ist
         * die Bedingung sicher zu filtern — anders als der Umkreis.
         */
        const laender = alsListe(k.wert).map((l) => l.toUpperCase());
        if (laender.length === 0) break;
        teile.push(inArray(schema.jobs.country, laender));
        break;
      }

      /*
       * ══════════════════════════════════════════════════════════
       * Der Umkreis als grobe Vorauswahl — seit die Daten es hergeben
       * ══════════════════════════════════════════════════════════
       *
       * Die erste Fassung liess ihn bewusst weg. Damals trugen 11 von
       * 1215 analysierten Anzeigen Koordinaten — 0,9 Prozent. Ein
       * Filter darauf hätte 99 Prozent des Bestands entfernt, und
       * zwar genau die, für die die feine Prüfung „unbekannt" gesagt
       * hätte. Eine kürzere Liste sieht aus wie eine vollständige.
       *
       * Nach dem Nachziehen der Geodaten sind es 1092 von 1209 —
       * 90,3 Prozent. Jetzt kehrt sich die Rechnung um: Ohne Filter
       * geht die Vorauswahl durch den ganzen Bestand, und die teure
       * Prüfung samt Modellaufruf trifft Stellen in 488 km
       * Entfernung.
       *
       * ── Warum ein Rechteck und kein Kreis ────────────────────
       *
       * Weil ein Rechteck einen Index benutzen kann und ein Kreis
       * nicht. Es ist absichtlich zu grosszügig: Es lässt die Ecken
       * durch, die ausserhalb des Kreises liegen. Die genaue
       * Entfernung rechnet danach `kriteriumPruefen` — dort, wo auch
       * die Begründung entsteht.
       *
       * Ein Filter, der zu viel durchlässt, kostet Rechenzeit. Einer,
       * der zu wenig durchlässt, verliert Stellen. Nur der zweite
       * Fehler ist unsichtbar.
       *
       * ── Warum Stellen ohne Koordinate drinbleiben ────────────
       *
       * Weil „keine Koordinate" nicht „zu weit weg" heisst. Die
       * restlichen 9,7 Prozent gehen weiter an die feine Prüfung und
       * bekommen dort `unbekannt` — eine offene Frage statt eines
       * stillen Ausschlusses.
       */
      case "umkreis": {
        const u = k.wert as { breite?: number; laenge?: number; km?: number } | null;
        if (
          !u ||
          typeof u.breite !== "number" ||
          typeof u.laenge !== "number" ||
          typeof u.km !== "number" ||
          u.km <= 0
        )
          break;

        /*
         * Ein Breitengrad sind überall rund 111 km. Ein Längengrad
         * schrumpft zu den Polen hin mit dem Kosinus der Breite —
         * in Deutschland auf etwa 71 km.
         *
         * Der Aufschlag von zehn Prozent ist Absicht: Er deckt die
         * Ungenauigkeit eines Stadtmittelpunkts ab, der aus mehreren
         * Postleitzahlen gemittelt wurde.
         */
        const gradBreite = (u.km * 1.1) / 111;
        const gradLaenge = (u.km * 1.1) / (111 * Math.max(0.2, Math.cos((u.breite * Math.PI) / 180)));
        teile.push(
          or(
            isNull(schema.jobs.latitude),
            isNull(schema.jobs.longitude),
            and(
              gte(schema.jobs.latitude, u.breite - gradBreite),
              lte(schema.jobs.latitude, u.breite + gradBreite),
              gte(schema.jobs.longitude, u.laenge - gradLaenge),
              lte(schema.jobs.longitude, u.laenge + gradLaenge),
            ),
          )!,
        );
        break;
      }

      case "arbeitgeber_ausschluss": {
        const raus = alsListe(k.wert).filter((w) => w.length >= 3);
        if (raus.length === 0) break;
        /*
         * Der Name steht in `companies`, nicht in `jobs`. Der Ausschluss
         * bleibt deshalb der feinen Prüfung überlassen — ein Join
         * hierher machte die Vorauswahl teurer, als sie einbringt.
         */
        break;
      }

      /*
       * Vertragsform, Wochenstunden, Schicht, Reiseanteil, Erfahrung:
       * alle in der Anzeige regelmässig leer. Sie hier zu filtern
       * hiesse, `unbekannt` wie `verletzt` zu behandeln — genau das,
       * was der Auftrag verbietet.
       */
      default:
        break;
    }
  }

  /*
   * Nur fertig analysierte Stellen.
   *
   * Ohne Analyse fehlen Gehaltsbefund und Transparenz; die Prüfung
   * hätte dann für fast jedes Kriterium `unbekannt` und die Person
   * bekäme eine Liste voller offener Fragen.
   */
  teile.push(gte(schema.jobAnalysen.fassung, rahmen.analyseFassung));
  teile.push(eq(schema.jobAnalysen.status, "fertig"));

  /*
   * Der Fortschrittsstand, nicht „die letzten 24 Stunden".
   *
   * Eine Stelle wird gestern importiert und heute analysiert. Jedes
   * Zeitfenster am Importdatum verliert sie. Gerechnet wird deshalb ab
   * dem Zeitpunkt, bis zu dem dieser Auftrag zuletzt gearbeitet hat.
   */
  if (rahmen.analyseSeit !== null) {
    teile.push(gt(schema.jobAnalysen.beendetAm, rahmen.analyseSeit));
  }

  return and(...teile);
}
