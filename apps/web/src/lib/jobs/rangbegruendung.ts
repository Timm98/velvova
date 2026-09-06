import { ampelstufe, zeilenampel, type Ampelstufe } from "./befundton";

/**
 * Warum diese Stelle so eingestuft ist, wie sie eingestuft ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier vorher stand
 * ══════════════════════════════════════════════════════════════
 *
 * „Einiges passt zu dem, was ich bisher über dich weiss" — ein Satz
 * über den Stand des Profils, gefolgt von drei Listen, von denen zwei
 * „Nichts gefunden" meldeten.
 *
 * Über der Analyse stehen drei Leisten mit Zahlen. Die Analyse
 * erwähnte sie mit keinem Wort. Wer eine Zahl sieht und darunter einen
 * Text, erwartet, dass der Text die Zahl erklärt.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Sätze dürfen und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Sie benennen, welcher der drei Werte die Einstufung trägt und
 * welcher sie drückt. Das ist eine Aussage über die Rechnung, nicht
 * über die Stelle — und deshalb ohne Modell zu haben.
 *
 * Was sie nicht dürfen: aus einer niedrigen Zahl eine Eigenschaft der
 * Stelle machen. „Die Anzeige ist lückenhaft" ist zulässig; „der
 * Arbeitgeber verschweigt etwas" wäre eine Unterstellung.
 */

export type Zukunftsdaten = {
  /** 1 bis 5, gemittelt über die Berufsgruppe. */
  sicherheit: number;
  berufsgruppen: number;
  nachfrage: string;
  automatisierung: string;
  konfidenz: "mittel" | "gering";
  herkunft: string;
};

export type Werte = {
  /** 0 bis 100, oder null wenn nicht berechenbar. */
  matching: number | null;
  /** Was die ANZEIGE preisgibt. */
  qualitaet: number | null;
  /** Wie belastbar UNSERE Einschätzung ist. */
  sicherheit: number | null;
  /** Was die STELLE bietet. Optional, weil oft nicht beurteilbar. */
  bedingungen?: number | null;
};

export type Begruendung = {
  /** Der Satz zur Gesamteinstufung. */
  gesamt: string;
  /** Je Leiste ein Satz, in der Reihenfolge der Anzeige. */
  zeilen: { titel: string; satz: string }[];
  /**
   * Was über den Beruf bekannt ist — unabhängig von der Person.
   *
   * Steht vor allem anderen: Es ist das Einzige, was auch ohne Profil
   * gilt, und für jemanden, der eine Anzeige öffnet, die erste Frage.
   */
  beruf: string | null;
  /**
   * Ein Satz am Ende, der die Lage zusammenzieht.
   *
   * Nicht dieselbe Aussage wie `gesamt`: Der nennt die Zahl und den
   * schwächsten Wert, dieser sagt, was daraus folgt.
   */
  fazit: string;
};

const WORT: Record<"rot" | "gelb" | "gruen", string> = {
  rot: "niedrig",
  gelb: "mittel",
  gruen: "hoch",
};

export function rangbegruendung(w: Werte, z: Zukunftsdaten | null = null): Begruendung {
  const { stufe, gesamt } = zeilenampel(w.matching, w.qualitaet, w.sicherheit);

  const zeilen = [
    { titel: "Fit Score", satz: fitSatz(gesamt, stufe) },
    { titel: "Matching", satz: matchingSatz(w.matching) },
    { titel: "Transparenz der Anzeige", satz: qualitaetSatz(w.qualitaet) },
    { titel: "Datenlage", satz: sicherheitSatz(w.sicherheit) },
    /* Die Arbeitsbedingungen nur, wenn sie beurteilbar sind. Eine
       Zeile „nicht beurteilbar" sagt dasselbe wie die leere Leiste
       darüber und verlängert die Tabelle um nichts. */
    ...(w.bedingungen !== null && w.bedingungen !== undefined
      ? [{ titel: "Arbeitsbedingungen", satz: bedingungenSatz(w.bedingungen) }]
      : []),
  ];

  return {
    gesamt: gesamtSatz(w, stufe, gesamt),
    zeilen,
    beruf: berufssatz(z),
    fazit: fazitSatz(w, stufe, z),
  };
}

/**
 * Der Beruf, unabhängig von der Person.
 *
 * Er steht ganz oben, weil er als Einziges auch ohne Profil gilt —
 * und weil er die Frage beantwortet, mit der man eine Anzeige öffnet:
 * Ist das überhaupt ein Beruf mit Zukunft?
 */
function berufssatz(z: Zukunftsdaten | null): string | null {
  if (!z) return null;
  const wort =
    z.sicherheit >= 4.2
      ? "sehr gefragt"
      : z.sicherheit >= 3.4
        ? "stabil"
        : z.sicherheit >= 2.6
          ? "im Wandel"
          : "unter Druck";
  return `Die Berufsgruppe gilt als ${wort}. ${z.nachfrage} ${z.automatisierung}`;
}

function fitSatz(gesamt: number | null, stufe: Ampelstufe | null): string {
  if (gesamt === null || stufe === null) {
    return "Noch nicht berechenbar — mir liegt zu dieser Stelle nichts vor.";
  }
  const teil = "Er fasst Matching, Anzeigenqualität und Sicherheit zusammen.";
  if (stufe === "gruen") return `${gesamt} — ${teil} Alles, was ich weiss, spricht dafür.`;
  if (stufe === "gelb") return `${gesamt} — ${teil} Einiges trägt, einiges nicht.`;
  return `${gesamt} — ${teil} Die Zahl kommt nicht zusammen.`;
}

/**
 * Was aus allem folgt.
 *
 * Bewusst eine Handlungsempfehlung und keine Wiederholung der Zahl:
 * Wer bis hierher gelesen hat, kennt sie. Was er nicht weiss, ist, was
 * er als Nächstes tun soll.
 */
function fazitSatz(w: Werte, stufe: Ampelstufe | null, z: Zukunftsdaten | null): string {
  if (w.matching === null) {
    return z
      ? "Ob die Stelle zu DIR passt, kann ich noch nicht sagen — dafür fehlt mir dein Profil. Was über den Beruf bekannt ist, steht oben."
      : "Ob die Stelle zu dir passt, kann ich noch nicht sagen. Erzähl mir, was du kannst, dann rechne ich es aus.";
  }
  if (w.sicherheit !== null && w.sicherheit < 50) {
    return "Die Einschätzung steht auf schmaler Grundlage. Ein Gespräch mit mir macht sie belastbarer — das ist der wirksamste nächste Schritt.";
  }
  if (stufe === "gruen") {
    return "Nichts spricht dagegen, sich das genauer anzusehen. Die offenen Punkte oben sind Fragen fürs Gespräch, keine Ausschlussgründe.";
  }
  if (stufe === "gelb") {
    return "Es hängt daran, wie wichtig dir die Punkte unter „Darauf solltest du achten“ sind. Das kann ich dir nicht abnehmen.";
  }
  return "Ich würde eher weitersuchen — es sei denn, an dieser Stelle zieht dich etwas an, das ich nicht kenne.";
}

/**
 * Der Satz zur Gesamteinstufung.
 *
 * Er nennt den schwächsten der drei Werte beim Namen. Das ist die
 * Auskunft, die weiterhilft: Eine Zahl sagt, WIE gut es steht, der
 * schwächste Wert sagt, WORAN es liegt.
 */
function gesamtSatz(
  w: Werte,
  stufe: "rot" | "gelb" | "gruen" | null,
  gesamt: number | null,
): string {
  if (stufe === null || gesamt === null) {
    return "Für eine Einstufung liegt mir zu dieser Stelle noch gar nichts vor.";
  }

  const teile: [string, number | null][] = [
    ["die Passung", w.matching],
    ["die Transparenz der Anzeige", w.qualitaet],
    ["meine Datengrundlage", w.sicherheit],
  ];
  const bekannt = teile.filter((t): t is [string, number] => t[1] !== null);
  const fehlend = teile.filter((t) => t[1] === null).map((t) => t[0]);

  /*
   * Was fehlt, gehört in denselben Satz.
   *
   * Der Wert wird aus dem gerechnet, was da ist — das ist richtig, aber
   * ohne Hinweis liest sich „74 von 100" wie eine vollständige
   * Einstufung. Der Nachsatz sagt, worauf sie NICHT beruht.
   */
  const nachsatz =
    fehlend.length > 0 ? ` Ohne ${fehlend.join(" und ")} gerechnet.` : "";
  const schwaechster = bekannt.reduce((a, b) => (b[1] < a[1] ? b : a));
  const staerkster = bekannt.reduce((a, b) => (b[1] > a[1] ? b : a));

  if (stufe === "gruen") {
    return `${gesamt} von 100 — die vorhandenen Werte tragen. Am stärksten ${staerkster[0]} mit ${staerkster[1]}.${nachsatz}`;
  }

  /*
   * Bei gelb und rot steht der schwächste Wert im Satz.
   *
   * Ohne ihn liest man „62 von 100" und weiss nicht, ob die Stelle
   * nicht passt oder ob wir zu wenig wissen — zwei völlig verschiedene
   * Lagen, die dieselbe Zahl ergeben können.
   */
  /*
   * „zieht nach unten", nicht „deckelt".
   *
   * Hier stand „deckelt das Ergebnis" — das beschrieb die Sperre, die
   * Grün verhinderte, solange ein Einzelwert unter 50 lag. Die Sperre
   * ist weg: Die Farbe folgt jetzt allein der Zahl, damit Zahl und
   * Rand in der Liste nicht auseinanderlaufen.
   *
   * Der Satz musste mit. Ein niedriger Teilwert deckelt nichts mehr —
   * er senkt den Durchschnitt. Wer die alte Formulierung stehen lässt,
   * erklärt eine Mechanik, die es nicht mehr gibt.
   */
  const grund =
    schwaechster[1] < 50
      ? `${schwaechster[0]} liegt mit ${schwaechster[1]} unter der Hälfte und zieht das Ergebnis nach unten`
      : `${schwaechster[0]} ist mit ${schwaechster[1]} der schwächste der drei Werte`;

  return `${gesamt} von 100 — ${grund}.${nachsatz}`;
}

function matchingSatz(wert: number | null): string {
  if (wert === null) {
    return "Noch nicht berechenbar. Dafür fehlen mir Angaben über dich — vor allem zu deinen Fähigkeiten und deiner Arbeitsweise.";
  }
  const s = ampelstufe(wert);
  if (s === "gruen") return `${wert} — die Stelle deckt sich weitgehend mit dem, was du gesucht und angegeben hast.`;
  if (s === "gelb") return `${wert} — vieles passt, einiges nicht. Die Aufschlüsselung darunter zeigt, welche Achse zieht und welche bremst.`;
  return `${wert} — die Stelle liegt spürbar neben dem, was du gesucht hast. Das kann trotzdem richtig sein, wenn du etwas Neues willst.`;
}

function qualitaetSatz(wert: number | null): string {
  if (wert === null) {
    return "Nicht beurteilbar — die Anzeige gibt zu wenig her, um überhaupt eine Aussage zu treffen.";
  }
  const s = ampelstufe(wert);
  if (s === "gruen") return `${wert} — die Anzeige nennt fast alles, was man zum Vergleichen braucht.`;
  if (s === "gelb") return `${wert} — die Anzeige nennt einen Teil. Was fehlt, steht unter den offenen Punkten.`;
  /* Kein Urteil über den Arbeitgeber. Eine dünne Anzeige ist eine
     dünne Anzeige — warum sie dünn ist, wissen wir nicht. */
  /* Ausdrücklich: fehlende Transparenz ist keine schlechte Stelle. */
  return `${wert} — die Anzeige lässt vieles offen. Das sagt nichts über die Bedingungen, macht sie aber schwer zu beurteilen.`;
}

/**
 * Was die Stelle bietet — nicht, was die Anzeige darüber schreibt.
 *
 * Der Unterschied ist der Grund, aus dem diese Grösse eigenständig
 * geworden ist: Eine ausführliche Anzeige mit schlechten Bedingungen
 * und eine knappe mit guten ergaben vorher denselben Wert.
 */
function bedingungenSatz(wert: number): string {
  const s = ampelstufe(wert);
  if (s === "gruen") return `${wert} — Vertrag, Arbeitszeit und Umfeld sprechen für die Stelle.`;
  if (s === "gelb") return `${wert} — die Bedingungen sind durchschnittlich, mit Licht und Schatten.`;
  return `${wert} — an den Bedingungen gibt es belegbare Schwachstellen.`;
}

function sicherheitSatz(wert: number | null): string {
  if (wert === null) return "Unbekannt.";
  const s = ampelstufe(wert);
  /* Diese Zahl sagt nichts über den Arbeitsplatz, sondern darüber, wie
     belastbar UNSERE Einschätzung ist. Die Formulierungen halten das
     durch — „Grundlage", nicht „sicher". */
  if (s === "gruen") return `${wert} — Profil und Anzeige tragen diese Einschätzung.`;
  if (s === "gelb") return `${wert} — die Einschätzung steht, aber auf schmaler Grundlage.`;
  /*
   * Die einzige der drei Zahlen, die man selbst ändern kann.
   *
   * Deshalb steht hier, wie — und nicht nur, dass sie niedrig ist.
   */
  return `${wert} — dafür weiss ich zu wenig über dich. Ein Gespräch mit mir hebt diesen Wert am schnellsten.`;
}

/** Nur zur Anzeige: das Wort zur Stufe eines Werts. */
export function stufenwort(wert: number | null): string {
  return wert === null ? "unbekannt" : WORT[ampelstufe(wert)];
}

/**
 * Hier stand `berufsbegruendung` — ein zweiter Weg für den Fall, dass
 * keine Passung vorliegt.
 *
 * `rangbegruendung` deckt das jetzt selbst ab: Der Beruf steht IMMER
 * oben, unabhängig davon, wie viel über die Person bekannt ist, und
 * das Fazit sagt in diesem Fall, was fehlt. Zwei Funktionen für
 * denselben Block hiessen zwei Fassungen derselben Sätze — und die
 * eine wäre irgendwann veraltet.
 */
