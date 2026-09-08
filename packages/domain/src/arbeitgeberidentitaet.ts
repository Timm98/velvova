/**
 * Wer schreibt die Anzeige — und wer stellt ein?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Fachgebiet kein Arbeitgeber ist
 * ══════════════════════════════════════════════════════════════
 *
 * In der Wettbewerbsprüfung standen mehrere Anzeigen im
 * Unternehmensbereich unter einer Fachgebietsbezeichnung — „Augenheil­-
 * kunde", „Kardiologie". Aus solchen Einträgen lässt sich die
 * beschäftigende Einrichtung nicht bestimmen.
 *
 * Vertrauliche Vermittlung ist daran nichts Schlechtes; sie ist in
 * manchen Berufen der Normalfall. Der Fehler entsteht erst danach: Ein
 * Fachgebietslabel wie einen geprüften Arbeitgeber zu behandeln und
 * daran Bewertungen, Registerdaten oder ein „direkt vom Arbeitgeber"
 * zu hängen.
 *
 * Was dabei herauskommt, ist eine Aussage über eine gleichnamige
 * Einrichtung, die mit dieser Stelle nichts zu tun hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Rollen, drei Felder
 * ══════════════════════════════════════════════════════════════
 *
 *   veroeffentlicher  wer die Anzeige eingestellt hat
 *   vermittler        wer zwischen Person und Arbeitgeber steht
 *   arbeitgeber       wer beschäftigt
 *
 * Sie können dieselbe Firma sein. Dass sie es sind, ist eine Angabe —
 * keine Voreinstellung.
 */

export const ANBIETERROLLEN = ["veroeffentlicher", "vermittler", "arbeitgeber"] as const;
export type Anbieterrolle = (typeof ANBIETERROLLEN)[number];

export interface Anbieterangabe {
  rolle: Anbieterrolle;
  /** Der Name, wie die Quelle ihn nennt. */
  name: string;
  belege: readonly string[];
}

export interface Identitaetsbefund {
  /** Ist bekannt, wer beschäftigt? */
  arbeitgeberBekannt: boolean;
  /** Der Name des Arbeitgebers — oder `null`. */
  arbeitgeber: string | null;
  /**
   * Was über der Anzeige stehen darf.
   *
   * Nie ein geratener Name: Wo keiner belegt ist, steht der
   * Veröffentlicher oder ein ehrlicher Platzhalter.
   */
  anzeigename: string;
  /**
   * Der Arbeitgeber wird ausdrücklich vertraulich behandelt.
   *
   * Nur wenn die Quelle das sagt. „Vertraulich" klingt nach einer
   * Entscheidung des Arbeitgebers; wo in Wahrheit nur eine Angabe
   * fehlt, ist das eine erfundene Begründung.
   */
  vertraulich: boolean;
  /**
   * Darf diese Stelle einer Arbeitgeberbewertung zugeordnet werden?
   *
   * Nur bei belegter Identität. Ohne sie träfe die Bewertung eine
   * gleichnamige Einrichtung.
   */
  bewertungErlaubt: boolean;
  /**
   * Darf „direkt vom Arbeitgeber" behauptet werden?
   */
  direktVomArbeitgeber: boolean;
  satz: string;
}

export interface Identitaetsoptionen {
  /**
   * Die Quelle sagt ausdrücklich, dass der Arbeitgeber vertraulich
   * bleibt.
   */
  quelleSagtVertraulich?: boolean;
}

/**
 * Aus den Angaben einer Anzeige die Identitätslage bestimmen.
 *
 * Eine Anzeige ohne benannten Arbeitgeber ist damit ausdrücklich nicht
 * unecht — sie ist eine Anzeige, bei der eine Frage offen ist. Der
 * Prüfbestand hat dafür einen eigenen Fall (B11), weil der bequeme
 * Kurzschluss „kein Name, also unseriös" genauso falsch ist wie
 * „Name im Kopf, also geprüft".
 */
export function identitaet(
  angaben: readonly Anbieterangabe[],
  optionen: Identitaetsoptionen = {},
): Identitaetsbefund {
  const mitBeleg = angaben.filter((a) => a.belege.length > 0 && a.name.trim().length > 0);
  const arbeitgeber = mitBeleg.find((a) => a.rolle === "arbeitgeber") ?? null;
  const vermittler = mitBeleg.find((a) => a.rolle === "vermittler") ?? null;
  const veroeffentlicher = mitBeleg.find((a) => a.rolle === "veroeffentlicher") ?? null;

  if (arbeitgeber) {
    /* Ein Vermittler daneben ändert nichts daran, dass der Arbeitgeber
       bekannt ist — er ändert nur, wer die Anzeige geschrieben hat. */
    return {
      arbeitgeberBekannt: true,
      arbeitgeber: arbeitgeber.name,
      anzeigename: arbeitgeber.name,
      vertraulich: false,
      bewertungErlaubt: true,
      direktVomArbeitgeber: vermittler === null,
      satz: vermittler
        ? `${arbeitgeber.name}, ausgeschrieben über ${vermittler.name}.`
        : `${arbeitgeber.name}.`,
    };
  }

  const traeger = vermittler ?? veroeffentlicher;
  const vertraulich = optionen.quelleSagtVertraulich === true;

  return {
    arbeitgeberBekannt: false,
    arbeitgeber: null,
    anzeigename: traeger?.name ?? "Arbeitgeber nicht genannt",
    vertraulich,
    bewertungErlaubt: false,
    direktVomArbeitgeber: false,
    satz: vertraulich
      ? traeger
        ? `Der Arbeitgeber wird vertraulich behandelt; ausgeschrieben über ${traeger.name}.`
        : "Der Arbeitgeber wird vertraulich behandelt."
      : traeger
        ? `Wer einstellt, steht nicht in der Anzeige. Ausgeschrieben über ${traeger.name}.`
        : "Wer einstellt, steht nicht in der Anzeige.",
  };
}
