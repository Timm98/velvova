import { getDb, schema, withUser } from "@paycheck/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  LEERE_BILANZ,
  bilanzSatz,
  magerkeitsgrund,
  phasentext,
  ringbild,
  stillerMarktSatz,
  type Nachtbilanz,
  type Phase,
  PHASEN,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was heute Nacht passiert ist
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Zahlen stehen seit Migration 0108 in `nacht_laeufe`, die
 * Stellen seit jeher in `auftrag_treffer`. Hier werden sie
 * zusammengeführt — und nirgends nachgerechnet.
 *
 * ── Warum die Empfehlungen aus `auftrag_treffer` kommen ─────────
 *
 * Weil dort die Rechnung steht, die auch die Mail und die
 * Trefferliste benutzen. Eine eigene Auswahl für den Morgenbericht
 * wäre eine zweite Rangfolge, und zwei Rangfolgen laufen auseinander:
 * Dann stünde morgens eine andere Stelle oben als in der Liste, zu
 * der sie führt.
 *
 * ── Warum `gesehenAm` erst beim Öffnen gesetzt wird ─────────────
 *
 * Ein Bericht, den niemand aufgeschlagen hat, ist kein zugestellter
 * Bericht. Ihn beim Schreiben als gesehen zu buchen hiesse, sich die
 * einzige Frage zu verstellen, an der das ganze Vorhaben hängt: ob
 * der Morgenmoment überhaupt stattfindet.
 */

/** Wie viele Stellen der Bericht zeigt. Der Rest steht in der Liste. */
export const TOP_N = 5;

export interface Vorschlag {
  trefferId: string;
  jobId: string;
  titel: string;
  firma: string;
  ort: string | null;
  fitScore: number | null;
  gruende: string[];
  offenePunkte: string[];
  caveat: string | null;
}

export interface Morgenlage {
  /** `null` heisst: In dieser Nacht lief keine Suche. */
  lauf: {
    id: string;
    phase: Phase;
    auftragsname: string;
    begonnenAm: Date;
    beendetAm: Date | null;
    schonGesehen: boolean;
  } | null;
  bilanz: Nachtbilanz;
  satz: string;
  grund: string | null;
  ringzustand: ReturnType<typeof ringbild>;
  zeile: string;
  vorschlaege: Vorschlag[];
  stilleChancen: number;
  stillerMarktText: string;
  /** true, wenn überhaupt ein Suchauftrag läuft. Sonst ist alles andere sinnlos. */
  auftragLaeuft: boolean;
}

/** Nur bekannte Phasen — was die Datenbank sonst enthält, ist ein Fehler, keine Phase. */
function phaseLesen(roh: string): Phase {
  return (PHASEN as readonly string[]).includes(roh) ? (roh as Phase) : "fehler";
}

export async function morgenlage(userId: string): Promise<Morgenlage> {
  const db = await getDb();

  const [lauf] = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.nachtLaeufe.id,
        phase: schema.nachtLaeufe.phase,
        auftragsname: schema.suchAuftraege.name,
        begonnenAm: schema.nachtLaeufe.begonnenAm,
        beendetAm: schema.nachtLaeufe.beendetAm,
        gesehenAm: schema.nachtLaeufe.gesehenAm,
        gefunden: schema.nachtLaeufe.gefunden,
        nachFiltern: schema.nachtLaeufe.nachFiltern,
        geprueft: schema.nachtLaeufe.geprueft,
        empfohlen: schema.nachtLaeufe.empfohlen,
        zurueckgestellt: schema.nachtLaeufe.zurueckgestellt,
        ausgeschlossen: schema.nachtLaeufe.ausgeschlossen,
        stilleChancen: schema.nachtLaeufe.stilleChancen,
        quellenFehler: schema.nachtLaeufe.quellenFehler,
      })
      .from(schema.nachtLaeufe)
      .innerJoin(schema.suchAuftraege, eq(schema.suchAuftraege.id, schema.nachtLaeufe.auftragId))
      .where(eq(schema.nachtLaeufe.userId, userId))
      .orderBy(desc(schema.nachtLaeufe.begonnenAm))
      .limit(1),
  ).catch(() => []);

  const auftraege = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.suchAuftraege.id })
      .from(schema.suchAuftraege)
      .where(
        and(eq(schema.suchAuftraege.userId, userId), eq(schema.suchAuftraege.status, "aktiv")),
      )
      .limit(1),
  ).catch(() => []);

  const bilanz: Nachtbilanz = lauf
    ? {
        gefunden: lauf.gefunden,
        nachFiltern: lauf.nachFiltern,
        geprueft: lauf.geprueft,
        empfohlen: lauf.empfohlen,
        zurueckgestellt: lauf.zurueckgestellt,
        ausgeschlossen: lauf.ausgeschlossen,
        stilleChancen: lauf.stilleChancen,
        quellenFehler: lauf.quellenFehler,
      }
    : LEERE_BILANZ;

  const phase = lauf ? phaseLesen(lauf.phase) : "ruhe";

  /*
   * Die Vorschläge — aus derselben Rechnung wie die Trefferliste.
   *
   * `empfohlen` und noch nicht verfallen: Was gestern empfohlen und
   * heute abgelaufen ist, gehört nicht in einen Bericht, der „diese
   * fünf würde ich mir zuerst ansehen" sagt.
   */
  const vorschlaege = await withUser(db, userId, (tx) =>
    tx
      .select({
        trefferId: schema.auftragTreffer.id,
        jobId: schema.auftragTreffer.jobId,
        titel: schema.jobs.title,
        firma: schema.companies.name,
        ort: schema.jobs.location,
        fitScore: schema.auftragTreffer.fitScore,
        gruende: schema.auftragTreffer.empfehlungsgruende,
        offenePunkte: schema.auftragTreffer.offenePunkte,
        caveat: schema.auftragTreffer.caveat,
      })
      .from(schema.auftragTreffer)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.auftragTreffer.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.auftragTreffer.userId, userId),
          eq(schema.auftragTreffer.empfehlungsstatus, "empfohlen"),
          inArray(schema.auftragTreffer.zustand, ["offen", "ausgewaehlt", "benachrichtigt"]),
        ),
      )
      .orderBy(desc(schema.auftragTreffer.fitScore))
      .limit(TOP_N),
  ).catch(() => []);

  /*
   * Arbeitgeber ohne passende Anzeige.
   *
   * Nur entdeckte, noch nicht verworfene. Die Zahl selbst wird über
   * `stillerMarktSatz` gefiltert: Unter der Mindestgrösse steht
   * „wenige" statt einer Zahl, aus der sich ableiten liesse, wer
   * gemeint ist.
   */
  const chancen = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.arbeitgeberChancen.id })
      .from(schema.arbeitgeberChancen)
      .where(
        and(
          eq(schema.arbeitgeberChancen.userId, userId),
          eq(schema.arbeitgeberChancen.art, "stille_chance"),
        ),
      )
      .limit(200),
  ).catch(() => []);

  return {
    lauf: lauf
      ? {
          id: lauf.id,
          phase,
          auftragsname: lauf.auftragsname,
          begonnenAm: lauf.begonnenAm,
          beendetAm: lauf.beendetAm,
          schonGesehen: lauf.gesehenAm !== null,
        }
      : null,
    bilanz,
    satz: lauf ? bilanzSatz(bilanz) : "",
    grund: lauf ? magerkeitsgrund(bilanz) : null,
    ringzustand: ringbild(phase),
    zeile: phasentext(phase, bilanz),
    vorschlaege: vorschlaege.map((v) => ({
      ...v,
      gruende: v.gruende ?? [],
      offenePunkte: v.offenePunkte ?? [],
    })),
    stilleChancen: chancen.length,
    stillerMarktText: stillerMarktSatz(chancen.length),
    auftragLaeuft: auftraege.length > 0,
  };
}

/**
 * Den Bericht als gesehen vermerken.
 *
 * Nur einmal: `gesehen_am is null` in der Bedingung, damit ein
 * zweiter Aufruf den ersten Zeitpunkt nicht überschreibt. Wann jemand
 * den Bericht zuerst geöffnet hat, ist die Zahl, die zählt.
 */
export async function berichtGesehen(userId: string, laufId: string): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.nachtLaeufe)
      .set({ gesehenAm: new Date() })
      .where(
        and(
          eq(schema.nachtLaeufe.id, laufId),
          eq(schema.nachtLaeufe.userId, userId),
          isNull(schema.nachtLaeufe.gesehenAm),
        ),
      ),
  ).catch((e) => console.error("[nachtlauf] nicht als gesehen vermerkt:", e));
}
