/**
 * Gilt das ab jetzt — oder nur für diese eine Suche?
 *
 * ── Warum es diese Datei gibt ─────────────────────────────────
 *
 * Zwei Sätze, die fast gleich aussehen und das Gegenteil bedeuten:
 *
 *   „Zeig mir heute mal Stellen in Berlin.“
 *   „Ich möchte zukünftig eigentlich nur noch in Berlin arbeiten.“
 *
 * Der erste ist eine Suche. Der zweite ist eine Lebensentscheidung.
 *
 * Bis hierher behandelte Velvova beide gleich: was im Gespräch fiel,
 * wurde zur Präferenz. Wer einmal aus Neugier nach Berlin schaute, bekam
 * Berlin ins Profil — und Wochen später eine Jobliste, die Stellen vor
 * der eigenen Haustür nicht mehr zeigte. Niemand konnte das
 * zurückverfolgen, weil im Profil nur „Berlin“ stand und nicht, dass es
 * aus einem beiläufigen Satz stammte.
 *
 * Das ist die teuerste Sorte Fehler in einem Profilprodukt: Er
 * verschlechtert die Ergebnisse still und begründet sich selbst. Die
 * Person sieht schlechtere Treffer, hält das für den Arbeitsmarkt und
 * korrigiert nichts — weil sie gar nicht weiß, dass etwas zu korrigieren
 * wäre.
 *
 * ── Die Asymmetrie ───────────────────────────────────────────
 *
 * Die beiden Fehlerrichtungen wiegen nicht gleich schwer.
 *
 *   Eine Sitzungssuche fälschlich als dauerhaft zu speichern, verändert
 *   das Profil ungefragt und wirkt fort, bis jemand es bemerkt.
 *
 *   Eine dauerhafte Absicht fälschlich als Sitzung zu behandeln, kostet
 *   eine Nachfrage. Mehr nicht — der Wunsch kommt wieder, weil er echt
 *   ist.
 *
 * Deshalb ist die Voreinstellung bei Unklarheit NICHT „dauerhaft“.
 * `unklar` ist ein eigener Zustand, den die Oberfläche als Frage stellt,
 * statt ihn zu raten.
 *
 * ── Was hier bewusst NICHT passiert ──────────────────────────
 *
 * Kein Modellaufruf. Die Unterscheidung hängt an Signalwörtern, die im
 * Deutschen erfreulich klar sind, und eine Grammatikregel ist
 * reproduzierbar, testbar und kostenlos. Ein Modell, das bei jedem Satz
 * dieselbe Frage neu beantwortet, ist an dieser Stelle teurer und
 * schwankender — und der Fehlerfall wäre nicht nachvollziehbar.
 */

export type Geltung =
  /** Nur für diese Suche. Verändert das Profil nicht. */
  | "sitzung"
  /** Ab jetzt. Wandert ins Profil und wirkt auf die Rangfolge. */
  | "dauerhaft"
  /** Der Satz sagt es nicht. Die Oberfläche fragt nach. */
  | "unklar";

export interface Geltungsbefund {
  geltung: Geltung;
  /** 0..1 — wie deutlich der Satz ist. Bei `unklar` immer 0. */
  sicherheit: number;
  /** Die Wörter, aus denen es abgelesen wurde. Für die Rückfrage. */
  beleg: string;
}

/*
 * Starke Zeitmarker.
 *
 * Diese Wendungen binden die Aussage an einen Moment. Wer „heute“ oder
 * „für diese Suche“ sagt, sagt damit auch: nicht darüber hinaus.
 */
const SITZUNG_STARK = [
  /\bheute\b/i,
  /\bf[üu]r heute\b/i,
  /\bf[üu]r (?:diese|die aktuelle) suche\b/i,
  /\bf[üu]r (?:jetzt|den moment)\b/i,
  /\bdies(?:es)? mal\b/i,
  /\bdiesmal\b/i,
  /\bnur (?:dieses|das eine) mal\b/i,
  /\beinmalig\b/i,
  /\b(?:test|probe|interesse|spa[ßs]?es)halber\b/i,
  /\btestweise\b/i,
  /\bprobeweise\b/i,
  /\bnur (?:mal |kurz )?(?:schauen|gucken|sehen|reinschauen)\b/i,
  /\bversuchsweise\b/i,
];

/*
 * Schwache Zeitmarker.
 *
 * „mal“ ist im Deutschen eine Abtönungspartikel und steht in fast jedem
 * gesprochenen Satz — „zeig mir mal“, „ich würde mal sagen“. Allein
 * beweist sie gar nichts. Zusammen mit einem zweiten schwachen Marker
 * („kurz mal“, „gerade mal“) wird daraus ein brauchbares Signal.
 *
 * Das ist der Grund, warum es zwei Listen gibt und nicht eine: Ein
 * einzelnes „mal“ als Sitzungssignal zu werten hiesse, praktisch jede
 * Äusserung zur Sitzung zu erklären — und damit wäre die dauerhafte
 * Präferenz nicht mehr erreichbar.
 */
const SITZUNG_SCHWACH = [
  /\bmal\b/i,
  /\bgerade\b/i,
  /\bkurz\b/i,
  /\bjetzt\b/i,
  /\bspontan\b/i,
];

/*
 * Dauermarker.
 *
 * Diese Wendungen richten die Aussage in die Zukunft und heben sie über
 * den Moment. „zukünftig“, „ab jetzt“, „nur noch“ — das ist die Sprache
 * von Entscheidungen, nicht von Suchen.
 */
const DAUER_STARK = [
  /\bzuk[üu]nftig\b/i,
  /\bk[üu]nftig\b/i,
  /\bin zukunft\b/i,
  /\bab (?:jetzt|sofort|nun)\b/i,
  /\bvon (?:jetzt|nun) an\b/i,
  /\bnur noch\b/i,
  /\bgrunds[äa]tzlich\b/i,
  /\bgenerell\b/i,
  /\bdauerhaft\b/i,
  /\bauf dauer\b/i,
  /\blangfristig\b/i,
  /\bnie wieder\b/i,
  /\bimmer nur\b/i,
  /\bab sofort\b/i,
  /\bf[üu]r die zukunft\b/i,
  /\bmerk(?:e)? dir\b/i,
  /\bspeicher(?:e)? (?:das|dir)\b/i,
];

function treffer(satz: string, muster: RegExp[]): string[] {
  const gefunden: string[] = [];
  for (const m of muster) {
    const t = m.exec(satz);
    if (t?.[0]) gefunden.push(t[0].toLowerCase());
  }
  return gefunden;
}

/**
 * Aus einem Satz ablesen, wie lange das Gesagte gelten soll.
 *
 * Reihenfolge der Prüfung ist Absicht: Dauer schlägt Sitzung. Der Satz
 * „Ab jetzt möchte ich mal nur noch Remote“ enthält beides — „mal“ ist
 * hier Füllwort, „ab jetzt … nur noch“ ist die Aussage. Wer zuerst auf
 * die schwachen Zeitmarker prüfte, käme zum falschen Ergebnis.
 */
export function geltungAusSatz(satz: string): Geltungsbefund {
  const s = satz.trim();
  if (s.length === 0) return { geltung: "unklar", sicherheit: 0, beleg: "" };

  const dauer = treffer(s, DAUER_STARK);
  if (dauer.length > 0) {
    return {
      geltung: "dauerhaft",
      // Zwei unabhängige Dauermarker sind deutlicher als einer.
      sicherheit: dauer.length > 1 ? 0.95 : 0.85,
      beleg: dauer.join(", "),
    };
  }

  const stark = treffer(s, SITZUNG_STARK);
  if (stark.length > 0) {
    return {
      geltung: "sitzung",
      sicherheit: stark.length > 1 ? 0.95 : 0.85,
      beleg: stark.join(", "),
    };
  }

  const schwach = treffer(s, SITZUNG_SCHWACH);
  if (schwach.length >= 2) {
    return {
      geltung: "sitzung",
      // Bewusst niedriger: zwei Füllwörter sind ein Hinweis, kein Beweis.
      sicherheit: 0.6,
      beleg: schwach.join(", "),
    };
  }

  /*
   * Nichts Eindeutiges.
   *
   * Das ist der häufigste Fall und der wichtigste. Er endet NICHT in
   * einer Voreinstellung, sondern in einer Frage — siehe den
   * Kopfkommentar zur Asymmetrie.
   */
  return { geltung: "unklar", sicherheit: 0, beleg: "" };
}

/**
 * Wie die Oberfläche danach fragt.
 *
 * Eine Frage, zwei Antworten, keine Rückfrage auf die Rückfrage. Der
 * Text nennt die konkrete Bedingung, weil „Soll das dauerhaft gelten?“
 * ohne Bezug nicht beantwortbar ist, wenn im Gespräch drei Dinge fielen.
 */
export function geltungsfrage(anzeige: string): string {
  return `Gilt „${anzeige}“ ab jetzt allgemein — oder nur für diese Suche?`;
}
