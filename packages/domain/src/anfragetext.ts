import type { Anfrageart, Arbeitgeberart } from "./stillechancen.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Nachricht — gebaut aus Belegen, nicht aus Wörtern
 * ══════════════════════════════════════════════════════════════════
 *
 * Hier entscheidet sich, ob das System jemandem nützt oder schadet.
 * Eine Anfrage, die etwas behauptet, was nicht stimmt, ist schlimmer
 * als keine: Sie steht unter dem Namen eines Menschen, und sie steht
 * dort dauerhaft.
 *
 * ── Warum das kein Prompt ist ───────────────────────────────────
 *
 * „Erfinde keine Qualifikationen" ist eine Bitte. Ein Modell, das
 * einen schwachen Lebenslauf vor sich hat und einen überzeugenden
 * Brief schreiben soll, überliest sie an einem schlechten Tag — und
 * niemand merkt es, weil der Brief gut klingt.
 *
 * Deshalb baut diese Datei den Text aus EINGABEN, die alle einen
 * Beleg tragen. Was keinen Beleg hat, kann nicht in den Text kommen,
 * weil es keinen Weg dorthin gibt. Ein Modell darf danach umformulieren
 * — aber es bekommt nur, was hier steht.
 *
 * ── Warum die Anfrage kurz ist ──────────────────────────────────
 *
 * Sie geht an jemanden, der nicht danach gefragt hat. Zwei Absätze
 * liest er, fünf löscht er. Und was er nicht liest, nützt dem
 * Absender nichts — die Länge ist kein Beweis von Mühe.
 */

/**
 * Ein Satz über die Person, der stimmt.
 *
 * Jede Angabe trägt ihre Herkunft. Das ist nicht Buchführung: Es ist
 * der Grund, warum diese Datei nichts erfinden KANN — sie bekommt nur
 * belegte Aussagen und kann keine anderen bilden.
 */
export interface Belegtesache {
  /** Wie es im Text erscheint. In der Sprache des Menschen. */
  aussage: string;
  /** Woher es stammt: Dokumentkennung, Gesprächszug, Profilfeld. */
  herkunft: string;
}

export interface Anfrageeingaben {
  art: Anfrageart;
  arbeitgeberart: Arbeitgeberart;
  arbeitgebername: string;

  /** Wie die Person heisst. Ohne Namen keine Nachricht. */
  absender: string;

  /**
   * Was sie fachlich tut — ein bis zwei Wörter.
   *
   * Nicht „Ich bin ein motivierter Teamplayer". Das Fachgebiet ist
   * die einzige Angabe, die der Empfänger braucht, um in zwei
   * Sekunden zu entscheiden, ob er weiterliest.
   */
  fachgebiet: Belegtesache;

  /** Belegte Erfahrung. Höchstens drei — der Rest wird nicht gelesen. */
  erfahrung: readonly Belegtesache[];

  /**
   * Warum GENAU dieser Arbeitgeber.
   *
   * Fehlt der Beleg, fehlt der Satz. Ein erfundener Grund ist
   * durchsichtig und richtet mehr Schaden an als sein Fehlen: Wer
   * „Ihre innovative Unternehmenskultur hat mich überzeugt" schreibt,
   * sagt damit, dass er nichts über den Arbeitgeber weiss.
   */
  bezug: Belegtesache | null;

  /** Was gesucht wird. Eine Art Tätigkeit, kein Wunschzettel. */
  gesucht: Belegtesache;
}

export interface Anfrageentwurf {
  betreff: string;
  text: string;
  /**
   * Jede Aussage im Text mit ihrer Herkunft.
   *
   * Steht neben dem Entwurf, wenn der Mensch ihn freigibt. Er soll
   * nicht nur lesen, WAS über ihn gesagt wird, sondern WORAUF es sich
   * stützt — sonst gibt er etwas frei, das er nicht prüfen kann.
   */
  belege: Belegtesache[];
}

/** Reicht das Bekannte für eine Nachricht? */
export type Entwurfsergebnis =
  | { moeglich: true; entwurf: Anfrageentwurf }
  | { moeglich: false; fehlt: string[] };

const MAX_ERFAHRUNG = 3;

/**
 * Den Entwurf bauen.
 *
 * Gibt `moeglich: false` zurück, wenn zu wenig belegt ist — mit der
 * Liste dessen, was fehlt. Das ist eine brauchbare Antwort: Sie sagt
 * dem Menschen, was er ergänzen müsste, statt ihm einen Text zu geben,
 * den er nicht verantworten kann.
 */
export function anfrageEntwerfen(e: Anfrageeingaben): Entwurfsergebnis {
  const fehlt: string[] = [];
  if (!e.absender.trim()) fehlt.push("dein Name");
  if (!e.fachgebiet.aussage.trim()) fehlt.push("dein Fachgebiet");
  if (!e.gesucht.aussage.trim()) fehlt.push("was du suchst");
  if (e.erfahrung.length === 0) fehlt.push("mindestens eine belegte Erfahrung");
  if (fehlt.length > 0) return { moeglich: false, fehlt };

  const erfahrung = e.erfahrung.slice(0, MAX_ERFAHRUNG);
  const oeffentlich = e.arbeitgeberart === "oeffentlich";

  /*
   * Der Betreff sagt, was es ist.
   *
   * Kein „Bewerbung" bei einer Anfrage — der Empfänger sortiert danach,
   * und eine falsch beschriftete Nachricht landet im falschen Stapel
   * oder wird als Bewerbung abgelehnt, die keine war.
   */
  const betreff =
    e.art === "initiativbewerbung"
      ? `Initiativbewerbung – ${e.fachgebiet.aussage}`
      : `Anfrage: Möglichkeiten im Bereich ${e.fachgebiet.aussage}`;

  const zeilen: string[] = [
    "Sehr geehrte Damen und Herren,",
    "",
    /*
     * Der erste Satz sagt, wer schreibt und warum — in dieser
     * Reihenfolge. Wer mit „ich verfolge Ihr Haus seit Langem"
     * beginnt, hat den Empfänger im zweiten Satz verloren.
     */
    `ich bin ${e.absender} und arbeite im Bereich ${e.fachgebiet.aussage}.`,
    "",
    erfahrung.length === 1
      ? `Mitgebracht habe ich: ${erfahrung[0]!.aussage}.`
      : `Mitgebracht habe ich unter anderem:\n${erfahrung.map((s) => `– ${s.aussage}`).join("\n")}`,
    "",
  ];

  if (e.bezug?.aussage.trim()) {
    zeilen.push(`Auf ${e.arbeitgebername} bin ich gekommen, weil ${e.bezug.aussage}.`, "");
  }

  if (e.art === "stellenanfrage") {
    /*
     * Die Frage, nicht die Bewerbung.
     *
     * Beim öffentlichen Dienst ausdrücklich nach dem VERFAHREN — dort
     * werden Stellen ausgeschrieben, und so zu tun, als ginge es
     * daran vorbei, hilft der Person nicht und stellt den Empfänger
     * vor eine Frage, die er nicht beantworten darf.
     */
    zeilen.push(
      oeffentlich
        ? `Ich suche ${e.gesucht.aussage}. Ist bei Ihnen in absehbarer Zeit eine entsprechende Ausschreibung geplant, und wo werden Ihre Stellen veröffentlicht? Falls Sie Vormerkungen führen, würde ich mich gerne eintragen lassen.`
        : `Ich suche ${e.gesucht.aussage}. Gibt es bei Ihnen aktuell oder in absehbarer Zeit eine passende Möglichkeit? Falls ja, sende ich Ihnen gerne meine Unterlagen.`,
    );
  } else {
    zeilen.push(
      `Ich suche ${e.gesucht.aussage} und bewerbe mich deshalb initiativ bei Ihnen. Meine vollständigen Unterlagen sende ich Ihnen gerne zu oder finden Sie im Anhang.`,
    );
  }

  zeilen.push(
    "",
    "Über eine kurze Rückmeldung würde ich mich freuen.",
    "",
    "Mit freundlichen Grüßen",
    e.absender,
  );

  return {
    moeglich: true,
    entwurf: {
      betreff,
      text: zeilen.join("\n"),
      belege: [e.fachgebiet, ...erfahrung, ...(e.bezug ? [e.bezug] : []), e.gesucht],
    },
  };
}

/**
 * Kommt im Text etwas vor, das nicht belegt ist?
 *
 * ── Wozu das gut ist, wenn der Text doch aus Belegen gebaut wird ─
 *
 * Weil ein Modell ihn danach umformulieren darf, und weil ein Mensch
 * ihn bearbeiten darf. Beide können etwas hinzufügen. Diese Prüfung
 * läuft VOR der Freigabe noch einmal über das Ergebnis.
 *
 * Sie kann nicht alles finden — eine Umformulierung ändert Wörter,
 * und ein wörtlicher Vergleich fände sie nicht mehr. Sie findet die
 * Sorte Zusatz, die tatsächlich vorkommt: Zahlen und Jahresangaben,
 * die vorher nirgends standen. „Über 8 Jahre Erfahrung" ist die
 * häufigste erfundene Angabe in einem generierten Anschreiben.
 */
export function unbelegteZahlen(text: string, belege: readonly Belegtesache[]): string[] {
  const belegt = belege.map((b) => b.aussage).join(" ");
  const zahlenIn = (s: string) => new Set(s.match(/\d+/g) ?? []);
  const erlaubt = zahlenIn(belegt);

  return [...zahlenIn(text)].filter((z) => !erlaubt.has(z));
}
