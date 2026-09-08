/**
 * Wem gehört ein Check — und was passiert nach dem Löschen?
 *
 * ══════════════════════════════════════════════════════════════
 * „Eine schwer erratbare ID ersetzt keine Zugriffsprüfung"
 * ══════════════════════════════════════════════════════════════
 *
 * Der Satz steht so in der Wettbewerbsanalyse, und er beschreibt den
 * bequemsten Fehler beim Bauen: Ein Check bekommt eine zufällige ID,
 * die Adresse ist praktisch nicht zu raten, und damit gilt die Sache
 * als geschützt.
 *
 * Sie ist es nicht. Eine solche Adresse steht im Verlauf, in der
 * Zwischenablage, im Verweis der nächsten Seite und in jedem
 * weitergeleiteten Link. Sie ist ein Name, kein Schloss.
 *
 * Deshalb trägt jeder Check hier einen Eigentümer, und es gibt genau
 * eine Funktion, die entscheidet, ob jemand ihn sehen darf.
 *
 * ══════════════════════════════════════════════════════════════
 * Gastzugriff ist ein Eigentümer, kein Freibrief
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Check ohne Anmeldung gehört der Sitzung, in der er entstanden
 * ist. Das ist ein schwächerer Eigentümer als ein Konto — er endet mit
 * der Sitzung —, aber er ist einer. „Niemand angemeldet" heisst nicht
 * „für alle".
 *
 * Beim Anmelden kann ein Gast-Check übernommen werden. Das ist eine
 * ausdrückliche Handlung mit einem eigenen Namen, kein Nebeneffekt des
 * Anmeldens.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Löschen mehr ist als ein Häkchen
 * ══════════════════════════════════════════════════════════════
 *
 * Zwischen „prüfe das" und der fertigen Antwort liegen Sekunden bis
 * Minuten. Wer in dieser Zeit löscht, hat gelöscht — und die Antwort,
 * die danach eintrifft, darf den Check nicht wieder anlegen.
 *
 * Das ist kein theoretischer Fall. Es ist die übliche Bauweise: Ein
 * Auftrag läuft, sein Ergebnis wird geschrieben, und geschrieben wird
 * dorthin, wo der Auftrag herkam. Ohne diese Prüfung ist „gelöscht"
 * eine Aussage über die Vergangenheit statt über den Bestand.
 */

/** Wer fragt. Eine Person oder eine Gastsitzung — nie beides. */
export type Anfrager =
  | { art: "person"; id: string }
  | { art: "gast"; sitzung: string };

export interface Checkbesitz {
  checkId: string;
  /** Der Eigentümer zum Zeitpunkt der Erstellung. */
  eigentuemer: Anfrager;
  erstelltAm: Date;
  /** Gesetzt, sobald gelöscht wurde. Danach gibt es nichts mehr. */
  geloeschtAm: Date | null;
}

export const ZUGRIFFSGRUENDE = [
  "erlaubt",
  "fremder_check",
  "gastsitzung_abgelaufen",
  "geloescht",
] as const;
export type Zugriffsgrund = (typeof ZUGRIFFSGRUENDE)[number];

export interface Zugriffsurteil {
  erlaubt: boolean;
  grund: Zugriffsgrund;
  /**
   * Was der Anfragende zu sehen bekommt.
   *
   * Bei einem fremden Check bewusst dasselbe wie bei einem nicht
   * vorhandenen: Wer erfährt, dass es diesen Check gibt, weiss schon
   * etwas über eine fremde Person.
   */
  satz: string;
}

function derselbe(a: Anfrager, b: Anfrager): boolean {
  if (a.art === "person" && b.art === "person") return a.id === b.id;
  if (a.art === "gast" && b.art === "gast") return a.sitzung === b.sitzung;
  return false;
}

/**
 * Darf dieser Anfragende diesen Check sehen?
 *
 * Die Reihenfolge ist bewusst: Erst der Eigentümer, dann der
 * Löschstand. Ein Fremder erfährt bei einem gelöschten Check nicht
 * einmal, dass es ihn gab.
 */
export function zugriff(besitz: Checkbesitz, anfrager: Anfrager): Zugriffsurteil {
  if (!derselbe(besitz.eigentuemer, anfrager)) {
    return {
      erlaubt: false,
      grund: "fremder_check",
      satz: "Diesen Check gibt es hier nicht.",
    };
  }
  if (besitz.geloeschtAm !== null) {
    return {
      erlaubt: false,
      grund: "geloescht",
      satz: "Diesen Check hast du gelöscht.",
    };
  }
  return { erlaubt: true, grund: "erlaubt", satz: "" };
}

/**
 * Darf eine verspätet eintreffende Antwort noch geschrieben werden?
 *
 * `erzeugtAm` ist der Zeitpunkt, zu dem der Auftrag losgeschickt
 * wurde — nicht der, zu dem die Antwort ankommt. Beide Vergleiche sind
 * nötig:
 *
 *   Wurde nach dem Start gelöscht, ist die Antwort verwaist.
 *   Wurde vor dem Start gelöscht, hätte der Auftrag nie laufen dürfen.
 *
 * In beiden Fällen wird nichts geschrieben. Ein gelöschter Check, der
 * durch eine späte Antwort wieder auftaucht, ist für die Person
 * dasselbe wie eine nicht ausgeführte Löschung.
 */
export function spaeteAntwortAnnehmen(
  besitz: Checkbesitz,
  erzeugtAm: Date,
): { annehmen: boolean; grund: string } {
  if (besitz.geloeschtAm !== null) {
    return {
      annehmen: false,
      grund:
        erzeugtAm < besitz.geloeschtAm
          ? "Der Check wurde gelöscht, während diese Antwort berechnet wurde."
          : "Der Check war beim Start dieser Berechnung bereits gelöscht.",
    };
  }
  return { annehmen: true, grund: "" };
}

/**
 * Einen Gast-Check beim Anmelden übernehmen.
 *
 * Ausdrücklich und mit eigenem Namen, damit es nie als Nebeneffekt
 * einer Anmeldung passiert. Übernommen wird nur, was der Sitzung
 * gehört, die gerade fragt — sonst würde eine Anmeldung fremde Checks
 * einsammeln.
 *
 * Ein gelöschter Check wird nicht übernommen: Er käme sonst über den
 * Umweg der Anmeldung zurück.
 */
export function uebernehmen(
  besitz: Checkbesitz,
  sitzung: string,
  personId: string,
): { besitz: Checkbesitz; uebernommen: boolean; grund: string } {
  if (besitz.eigentuemer.art !== "gast") {
    return { besitz, uebernommen: false, grund: "Dieser Check gehört bereits einem Konto." };
  }
  if (besitz.eigentuemer.sitzung !== sitzung) {
    return { besitz, uebernommen: false, grund: "Diesen Check gibt es hier nicht." };
  }
  if (besitz.geloeschtAm !== null) {
    return { besitz, uebernommen: false, grund: "Dieser Check wurde gelöscht." };
  }
  return {
    besitz: { ...besitz, eigentuemer: { art: "person", id: personId } },
    uebernommen: true,
    grund: "",
  };
}
