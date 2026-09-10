import { sql } from "drizzle-orm";
import { withSystem, type Database } from "@paycheck/db";
import { lokalesDatum } from "../versandfenster.ts";
import { bilanzPruefen, type Nachtbilanz, type Phase } from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Den Nachtlauf festhalten
 * ══════════════════════════════════════════════════════════════════
 *
 * `auftragslaufRunde` rechnet bereits alles, was der Morgenbericht
 * braucht: wie viele Kandidaten in die Runde kamen, wie viele
 * empfohlen, zurückgestellt oder ausgeschlossen wurden und warum
 * nichts dabei war. Diese Zahlen gingen bisher als Rückgabewert an
 * den Zeitplan-Aufruf und starben dort.
 *
 * Hier werden sie abgelegt — und nur sie. Nichts wird nachgerechnet:
 * Zwei Rechnungen derselben Frage laufen auseinander, und dann steht
 * im Morgenbericht eine andere Zahl als in der Trefferliste, und
 * niemand kann mehr sagen, welche stimmt.
 *
 * ── Warum das nicht scheitern darf ──────────────────────────────
 *
 * Ein Fehler beim Festhalten darf keinen Lauf verlieren. Die Treffer
 * stehen bereits in `auftrag_treffer`; was hier fehlschlägt, kostet
 * den Bericht, nicht die Arbeit. Deshalb fängt jede Funktion ihre
 * Fehler selbst und meldet sie zurück, statt zu werfen.
 */

/**
 * Der Schlüssel einer Nacht.
 *
 * Dieselbe Überlegung wie beim Versandfenster: Der Zeitplan läuft
 * stündlich, weil „08:00" die Ortszeit der Person ist. Zweimal im
 * selben Fenster zu laufen darf keinen zweiten Lauf erzeugen — die
 * Eindeutigkeit steht in der Datenbank, nicht in der Hoffnung, dass
 * der Scheduler sich benimmt.
 */
export function nachtschluessel(zeitpunkt: Date, zone: string): string {
  return lokalesDatum(zeitpunkt, zone);
}

export interface Nachtlaufzeile {
  userId: string;
  auftragId: string;
  schluessel: string;
}

/**
 * Den Lauf eröffnen — oder den vorhandenen wiederfinden.
 *
 * Gibt die Kennung zurück, unter der die Phasen und die Bilanz
 * geschrieben werden. `null` heisst: liess sich nicht anlegen; der
 * Lauf geht trotzdem weiter, nur ohne Beleg.
 */
export async function nachtlaufEroeffnen(
  db: Database,
  zeile: Nachtlaufzeile,
  jetzt: Date,
): Promise<string | null> {
  try {
    const ergebnis = (await withSystem(db, (tx) =>
      tx.execute(sql`
        insert into nacht_laeufe (user_id, auftrag_id, nacht_schluessel, phase, begonnen_am)
        values (${zeile.userId}::uuid, ${zeile.auftragId}::uuid, ${zeile.schluessel}, 'verstehen', ${jetzt})
        on conflict (user_id, auftrag_id, nacht_schluessel)
          do update set phase = 'verstehen'
        returning id`),
    )) as unknown as { rows: { id: string }[] };
    return ergebnis.rows[0]?.id ?? null;
  } catch (fehler) {
    console.error("[nachtlauf] nicht eröffnet:", fehler instanceof Error ? fehler.message : fehler);
    return null;
  }
}

/**
 * Die Phase fortschreiben.
 *
 * Sie ist das, was der Ring anzeigt. Ein Zwischenstand, der nicht
 * geschrieben wird, ist ein Ring, der auf „denkt nach" stehenbleibt,
 * während längst gerechnet wird.
 */
export async function phaseSetzen(
  db: Database,
  laufId: string | null,
  phase: Phase,
): Promise<void> {
  if (!laufId) return;
  try {
    await withSystem(db, (tx) =>
      tx.execute(sql`update nacht_laeufe set phase = ${phase} where id = ${laufId}::uuid`),
    );
  } catch (fehler) {
    console.error("[nachtlauf] Phase nicht gesetzt:", fehler instanceof Error ? fehler.message : fehler);
  }
}

/**
 * Die Bilanz ablegen und den Lauf schliessen.
 *
 * ── Warum hier geprüft wird ─────────────────────────────────────
 *
 * `bilanzPruefen` fängt Zahlen ab, die einander widersprechen —
 * mehr empfohlen als geprüft, mehr nach Filtern als gefunden. Sie
 * werden trotzdem geschrieben, denn sie sind das, was gemessen wurde;
 * aber der Befund steht in `grund`, damit die Oberfläche daraus keine
 * Bilanz baut. Eine schöne Zahl, die falsch ist, wäre schlimmer als
 * gar keine.
 */
export async function nachtlaufSchliessen(
  db: Database,
  laufId: string | null,
  bilanz: Nachtbilanz,
  grund: string | null,
  jetzt: Date,
): Promise<void> {
  if (!laufId) return;
  const befunde = bilanzPruefen(bilanz);
  const vermerk = befunde.length > 0 ? `zahlen_unschluessig: ${befunde.join("; ")}` : grund;
  try {
    await withSystem(db, (tx) =>
      tx.execute(sql`
        update nacht_laeufe set
          phase = ${befunde.length > 0 ? "fehler" : "bereit"},
          gefunden = ${bilanz.gefunden},
          nach_filtern = ${bilanz.nachFiltern},
          geprueft = ${bilanz.geprueft},
          empfohlen = ${bilanz.empfohlen},
          zurueckgestellt = ${bilanz.zurueckgestellt},
          ausgeschlossen = ${bilanz.ausgeschlossen},
          stille_chancen = ${bilanz.stilleChancen},
          quellen_fehler = ${JSON.stringify(bilanz.quellenFehler)}::jsonb,
          grund = ${vermerk},
          beendet_am = ${jetzt}
        where id = ${laufId}::uuid`),
    );
  } catch (fehler) {
    console.error("[nachtlauf] nicht geschlossen:", fehler instanceof Error ? fehler.message : fehler);
  }
}

/**
 * Einen gescheiterten Lauf als gescheitert kennzeichnen.
 *
 * Ohne das stünde er morgens auf „verstehen" — und der Ring zeigte
 * eine Suche, die es nicht mehr gibt.
 */
export async function nachtlaufAbbrechen(
  db: Database,
  laufId: string | null,
  grund: string,
  jetzt: Date,
): Promise<void> {
  if (!laufId) return;
  try {
    await withSystem(db, (tx) =>
      tx.execute(sql`
        update nacht_laeufe
        set phase = 'fehler', grund = ${grund.slice(0, 500)}, beendet_am = ${jetzt}
        where id = ${laufId}::uuid`),
    );
  } catch (fehler) {
    console.error("[nachtlauf] Abbruch nicht vermerkt:", fehler instanceof Error ? fehler.message : fehler);
  }
}
