/**
 * Die Warteschlangen des Suchauftrags.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum drei und nicht eine
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die drei Schritte verschieden teuer sind und verschieden oft
 * fällig werden:
 *
 *   profil   selten, nur nach neuen Signalen — ein Modellaufruf
 *   suche    oft, nach jeder fertigen Analyse — Datenbankarbeit
 *   versand  einmal je Fenster — Modellaufruf plus Anbieter
 *
 * In einer Schlange stünde die Profilkompilierung eines Menschen
 * hinter zehntausend Suchaufträgen. Getrennt kann jede in ihrem
 * eigenen Tempo laufen, und ein Rückstau in der Suche hält den Versand
 * nicht auf.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Fälligkeit trotzdem in der Datenbank steht
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Warteschlange ist ein Transportweg, kein Gedächtnis. Geht eine
 * Nachricht verloren — ein Worker stirbt zwischen Lesen und Löschen,
 * ein Neustart verwirft die Lease —, muss der Auftrag trotzdem
 * wiederkommen. Deshalb ist `such_auftraege.naechste_faelligkeit` die
 * Wahrheit, und der Cron reiht ein, was fällig ist.
 */

export const W_PROFIL = "suchauftrag_profil";
export const W_SUCHE = "suchauftrag_suche";
export const W_VERSAND = "suchauftrag_versand";

export const WARTESCHLANGEN = [W_PROFIL, W_SUCHE, W_VERSAND] as const;
export type Warteschlange = (typeof WARTESCHLANGEN)[number];

/**
 * Wie lange ein gelesener Auftrag unsichtbar bleibt.
 *
 * Grosszügiger als bei der Stellenanalyse: Hier stecken Modellaufrufe
 * drin, und eine zu kurze Lease heisst, dass ein zweiter Worker
 * dieselbe Arbeit noch einmal bezahlt.
 */
export const AUFTRAG_SICHTBARKEIT: Record<Warteschlange, number> = {
  [W_PROFIL]: 300,
  [W_SUCHE]: 600,
  [W_VERSAND]: 300,
};

export const AUFTRAG_MAX_VERSUCHE = 5;

export function auftragDarfVersuchen(versuche: number): boolean {
  return versuche <= AUFTRAG_MAX_VERSUCHE;
}

/**
 * Wie lange bis zum nächsten Versuch.
 *
 * Exponentiell mit Streuung nach unten. Ohne Streuung versuchen alle
 * fehlgeschlagenen Aufträge gleichzeitig erneut und erzeugen genau die
 * Last, an der sie gescheitert sind.
 */
export function auftragWartezeit(versuche: number, zufall: number): number {
  const basis = Math.min(2 ** versuche * 30, 1800);
  return Math.round(basis * (1 - 0.25 * zufall));
}

type Ausfuehrbar = { execute: (q: never) => Promise<unknown> };

/**
 * Aufträge einreihen.
 *
 * Scheitert still, aus demselben Grund wie beim Stellenimport: Die
 * Fälligkeit steht in der Datenbank, der nächste Cronlauf holt nach.
 * Ein Fehler hier darf keine Geschäftsänderung zurückrollen.
 */
export async function einreihen(
  db: Ausfuehrbar,
  schlange: Warteschlange,
  nutzlasten: readonly Record<string, unknown>[],
): Promise<number> {
  if (nutzlasten.length === 0) return 0;
  try {
    const { sql } = await import("drizzle-orm");
    const daten = JSON.stringify(nutzlasten);
    await db.execute(
      sql`select pgmq.send_batch(${schlange}, array(select jsonb_array_elements(${daten}::jsonb)))` as never,
    );
    return nutzlasten.length;
  } catch (fehler) {
    console.warn(
      `[suchauftrag] ${nutzlasten.length} Aufträge nicht in ${schlange} eingereiht:`,
      String(fehler).slice(0, 160),
    );
    return 0;
  }
}
