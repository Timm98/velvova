/**
 * Analyseaufträge einreihen und abarbeiten.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Warteschlange und kein Aufruf beim Import
 * ══════════════════════════════════════════════════════════════
 *
 * Der Import schreibt tausende Anzeigen in einem Lauf. Die Analyse
 * direkt darin auszuführen hiesse: Ein Fehler beim tausendsten Job
 * rollt den ganzen Import zurück, und ein Modellaufruf läge in einer
 * Datenbanktransaktion — der sicherste Weg, eine Verbindung stunden-
 * lang zu blockieren.
 *
 * Deshalb schreibt der Import nur den Auftrag, und ein Prozess
 * daneben arbeitet ihn ab. Fällt der aus, bleibt der Auftrag liegen
 * statt verloren zu gehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Fassung NICHT tut
 * ══════════════════════════════════════════════════════════════
 *
 * Kein Modellaufruf. Berechnet werden nur die deterministischen
 * Teile — Transparenz der Anzeige, Gehaltsbefund, Erfahrungsniveau.
 *
 * Das ist Absicht: Die Mechanik — Idempotenz, Lease, Wiederholung,
 * Dead-Letter — muss nachweislich stehen, bevor jeder Fehlversuch Geld
 * kostet. Ein Worker, der beim ersten Lasttest Aufträge verliert,
 * verliert sie mit Modellaufruf genauso, nur teurer.
 */

export const WARTESCHLANGE = "job_analyse";

/**
 * Wie lange ein gelesener Auftrag unsichtbar bleibt.
 *
 * Er ist die Lease: Solange sie läuft, sieht kein zweiter Worker den
 * Auftrag. Zu kurz heisst Doppelarbeit, zu lang heisst, dass ein
 * abgestürzter Worker den Auftrag lange blockiert.
 *
 * 120 Sekunden sind grosszügig für die deterministische Fassung und
 * werden zu knapp, sobald Modellaufrufe dazukommen — dann muss der
 * Worker die Lease verlängern, statt diesen Wert zu erhöhen.
 */
export const SICHTBARKEIT_SEKUNDEN = 120;

/**
 * Nach wie vielen Versuchen ein Auftrag aufgegeben wird.
 *
 * `read_ct` zählt in pgmq mit. Ohne Grenze läuft ein Auftrag, der an
 * einem kaputten Datensatz scheitert, für immer im Kreis und
 * verbraucht bei jedem Durchlauf einen Platz.
 */
export const MAX_VERSUCHE = 5;

export type Auftrag = {
  msgId: number;
  versuche: number;
  jobId: string;
};

/**
 * Ob ein Auftrag noch versucht werden darf.
 *
 * Getrennt von der Ausführung, damit die Entscheidung prüfbar ist —
 * sie ist der Unterschied zwischen „arbeitet ab" und „läuft im Kreis".
 */
export function darfVersuchen(versuche: number): boolean {
  return versuche <= MAX_VERSUCHE;
}

/**
 * Wie lange bis zum nächsten Versuch.
 *
 * Exponentiell mit Streuung: Ohne Streuung versuchen alle
 * fehlgeschlagenen Aufträge gleichzeitig erneut und erzeugen genau die
 * Last, an der sie gescheitert sind.
 *
 * `zufall` wird hereingereicht statt gewürfelt, damit die Funktion
 * prüfbar bleibt.
 */
export function wartezeitSekunden(versuche: number, zufall: number): number {
  const basis = Math.min(2 ** versuche * 10, 900);
  /* Bis zu 25 Prozent Streuung nach unten. Nach oben nicht, sonst
     wächst die Wartezeit über die Obergrenze hinaus. */
  return Math.round(basis * (1 - 0.25 * zufall));
}

/**
 * Aufträge einreihen — nach dem Schreiben, nicht davor.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das scheitern darf
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Import, der wegen einer nicht erreichbaren Warteschlange
 * zurückrollt, hat tausende Anzeigen verworfen, um einen Auftrag zu
 * retten. Die Anzeige ist das Wertvolle; der Auftrag lässt sich
 * nachholen — der Worker holt sich beim nächsten Lauf, was fehlt,
 * sobald ein Nachtragslauf existiert.
 *
 * Deshalb: Fehler protokollieren, nicht werfen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum `pgmq` fehlen darf
 * ══════════════════════════════════════════════════════════════
 *
 * Die Erweiterung ist in Produktion installiert und in der
 * Testumgebung nicht — dort läuft PGlite im Speicher. Ein harter
 * Aufruf liesse jeden Import-Test an einer Zeile scheitern, die mit
 * dem Getesteten nichts zu tun hat.
 */
export async function analyseEinreihen(
  db: { execute: (q: never) => Promise<unknown> },
  jobIds: readonly string[],
): Promise<number> {
  if (jobIds.length === 0) return 0;

  try {
    /* Der Import steht hier drin und nicht oben in der Datei: `pgmq`
       ist nur in Produktion vorhanden, und ein Modul, das ihn beim
       Laden erwartet, bricht die Testumgebung. */
    const { sql } = await import("drizzle-orm");

    /*
     * Ein Aufruf für alle statt einer je Stelle.
     *
     * Bei einem Import mit zweitausend geänderten Anzeigen wären das
     * sonst zweitausend Rundläufe — mehr Zeit als das Schreiben der
     * Anzeigen selbst.
     */
    const nutzlast = JSON.stringify(jobIds.map((id) => ({ jobId: id })));
    await db.execute(
      sql`select pgmq.send_batch(${WARTESCHLANGE}, array(select jsonb_array_elements(${nutzlast}::jsonb)))` as never,
    );
    return jobIds.length;
  } catch (fehler) {
    console.warn(
      `[analyse] ${jobIds.length} Aufträge nicht eingereiht:`,
      String(fehler).slice(0, 160),
    );
    return 0;
  }
}
