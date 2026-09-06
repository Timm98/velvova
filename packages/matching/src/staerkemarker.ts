import type { Staerke } from "./suchkriterien.ts";

/**
 * Muss oder Wunsch — aus dem Satz, nicht aus dem Modell.
 *
 * ══════════════════════════════════════════════════════════════
 * Das Problem, das dieses Modul löst
 * ══════════════════════════════════════════════════════════════
 *
 * Bis hierher entschied Systemprompt 1, ob ein Kriterium ein Muss ist
 * oder ein Wunsch. Bei jedem Lauf neu. Derselbe Satz ergab montags
 * einen Wunsch und dienstags ein Muss.
 *
 * Das ist nicht bloss unschön. Ein Kriterium, das ohne Zutun der
 * Person zum Muss wird, entfernt lautlos jede Stelle, die es nicht
 * erfüllt — und niemand erfährt davon. Der Suchauftrag wird enger,
 * die Liste kürzer, und die Erklärung dafür steht nirgends.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Rangfolge
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Ausdrücklicher Marker im Satz      „mindestens", „möglichst"
 *   2. Bereits bestätigte Stärke          was im Auftrag steht
 *   3. Bestätigung in der Oberfläche      eine Handlung der Person
 *   4. Entwurf des Modells                nur wo 1–3 schweigen
 *
 * Das Modell steht unten. Es darf vorschlagen, wo die Person sich
 * nicht festgelegt hat — es darf nicht überschreiben, wo sie es tat.
 *
 * ══════════════════════════════════════════════════════════════
 * Der gefährlichste Fall zuerst
 * ══════════════════════════════════════════════════════════════
 *
 *   „Ich muss nicht unbedingt remote arbeiten."
 *
 * Der Satz enthält „muss" und „unbedingt" — beides Muss-Marker — und
 * sagt das Gegenteil. Wer ihn wörtlich nimmt, macht Remote zur harten
 * Bedingung und löscht damit jede Stelle vor Ort aus der Suche. Die
 * Person hat gerade gesagt, dass ihr das egal ist.
 *
 * Deshalb wird die Entkräftung VOR allem anderen geprüft.
 */

export interface Staerkebefund {
  /** `null`, wenn der Satz sich nicht festlegt. */
  staerke: Staerke | null;
  /** Die Wendung, die entschieden hat — für die Begründung. */
  marker: string | null;
  quelle: "entkraeftung" | "muss" | "wunsch" | "interesse" | "kein_marker";
}

const OHNE_BEFUND: Staerkebefund = { staerke: null, marker: null, quelle: "kein_marker" };

/**
 * Wendungen, die ein Muss zurücknehmen.
 *
 * ── Warum sie sich auf die Modalität beziehen, nicht auf Inhalt ─
 *
 * „Ich will nicht in die Zeitarbeit" ist keine Entkräftung, sondern
 * ein Ausschluss — ein besonders hartes Muss. „Ich muss nicht
 * unbedingt remote" ist eine Entkräftung.
 *
 * Der Unterschied liegt daran, worauf sich das „nicht" bezieht: auf
 * das Müssen oder auf die Sache. Diese Muster fassen nur das Müssen.
 */
/*
 * `[\wäöüÄÖÜß]` statt `\w`.
 *
 * `\w` ist in JavaScript `[A-Za-z0-9_]` — Umlaute gehören nicht dazu.
 * „nicht über eine Zeitarbeitsfirma" fiel deshalb durch: Das „über"
 * war für das Muster kein Wort.
 */
const ENTKRAEFTUNG: readonly [RegExp, string][] = [
  [/\bmuss(?:t|te|)\s+(?:[\wäöüÄÖÜß]+\s+){0,2}?nicht\b/i, "muss nicht"],
  [/\bmüssen\s+(?:[\wäöüÄÖÜß]+\s+){0,2}?nicht\b/i, "müssen nicht"],
  [/\bnicht\s+(?:unbedingt|zwingend|zwangsläufig|zwingend erforderlich)\b/i, "nicht unbedingt"],
  [/\bkein\s+muss\b/i, "kein Muss"],
  [/\bnicht\s+so\s+wichtig\b/i, "nicht so wichtig"],
  [/\bist\s+mir\s+nicht\s+(?:so\s+)?wichtig\b/i, "nicht wichtig"],
  [/\bwäre\s+(?:nur\s+)?(?:nett|schön)\b/i, "wäre nett"],
  [/\bnicht\s+(?:der\s+)?entscheidend\w*\b/i, "nicht entscheidend"],
  [/\bkann\s+(?:ich|man)\s+verzichten\b/i, "kann verzichten"],
];

/**
 * Wendungen, die den ganzen Satzteil weich machen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie vor den Muss-Markern stehen
 * ══════════════════════════════════════════════════════════════
 *
 *   „wenn möglich ohne Schicht"
 *
 * „ohne" ist ein Ausschluss und damit ein Muss-Marker. „wenn
 * möglich" sagt aber, wie ernst der Ausschluss gemeint ist — er
 * bezieht sich auf den ganzen Satzteil, nicht auf ein Wort darin.
 *
 * Dasselbe Prinzip wie bei der Entkräftung: Die Modalität schlägt den
 * Inhalt. Wer das umdreht, macht aus „wenn möglich ohne Schicht" eine
 * harte Bedingung und streicht jede Schichtstelle aus der Liste —
 * obwohl die Person gerade gesagt hat, dass sie damit leben kann.
 */
const WEICHE_MODALITAET: readonly [RegExp, string][] = [
  [/\bmöglichst\b/i, "möglichst"],
  [/\bwenn möglich\b/i, "wenn möglich"],
  [/\bidealerweise\b/i, "idealerweise"],
  [/\bim idealfall\b/i, "im Idealfall"],
  [/\bam liebsten\b/i, "am liebsten"],
  [/\bbevorzugt\b/i, "bevorzugt"],
  [/\bvorzugsweise\b/i, "vorzugsweise"],
  [/\bgerne\b/i, "gerne"],
];

/**
 * Wendungen, die etwas zur Bedingung machen.
 *
 * ── Warum Ausschlüsse hier stehen ─────────────────────────────
 *
 * „Keine Zeitarbeit" nennt keine Bedingung, es nennt einen
 * Ausschluss — und ein Ausschluss ist die härteste Form eines Muss.
 * Wer ihn als Wunsch führt, schickt genau die Anzeigen, die die
 * Person ausdrücklich nicht wollte.
 */
const MUSS: readonly [RegExp, string][] = [
  [/\bmuss\b/i, "muss"],
  [/\bmüssen\b/i, "müssen"],
  [/\bzwingend\b/i, "zwingend"],
  [/\bunbedingt\b/i, "unbedingt"],
  [/\bauf jeden fall\b/i, "auf jeden Fall"],
  [/\bmindestens\b/i, "mindestens"],
  [/\bnicht unter\b/i, "nicht unter"],
  [/\bnicht weniger als\b/i, "nicht weniger als"],
  [/\bhöchstens\b/i, "höchstens"],
  [/\bnicht mehr als\b/i, "nicht mehr als"],
  [/\bmaximal\b/i, "maximal"],
  [/\bvoraussetzung\b/i, "Voraussetzung"],
  [/\bbedingung\b/i, "Bedingung"],
  [/\bdarf nicht\b/i, "darf nicht"],
  [/\bausschliesslich\b|\bausschließlich\b/i, "ausschliesslich"],
  [/\bnur\b/i, "nur"],
  [/\bkeine?\b/i, "keine"],
  [/\bohne\b/i, "ohne"],
  [/\bauf keinen fall\b/i, "auf keinen Fall"],
  [/\bkommt nicht in frage\b/i, "kommt nicht in Frage"],
  [/\bgeht gar nicht\b/i, "geht gar nicht"],
  [/\bbrauche ich\b/i, "brauche ich"],
];

/** Wendungen, die etwas wünschenswert machen, ohne es zu fordern. */
const WUNSCH: readonly [RegExp, string][] = [
  [/\bmöglichst\b/i, "möglichst"],
  [/\bgerne\b/i, "gerne"],
  [/\bam liebsten\b/i, "am liebsten"],
  [/\bbevorzugt\b/i, "bevorzugt"],
  [/\bvorzugsweise\b/i, "vorzugsweise"],
  [/\bidealerweise\b/i, "idealerweise"],
  [/\bim idealfall\b/i, "im Idealfall"],
  [/\bwenn möglich\b/i, "wenn möglich"],
  [/\bwäre schön\b|\bwäre gut\b/i, "wäre schön"],
  [/\bwürde ich bevorzugen\b/i, "würde bevorzugen"],
  [/\beher\b/i, "eher"],
  [/\btendenziell\b/i, "tendenziell"],
];

/** Wendungen, die etwas gerade eben noch erwähnen. */
const INTERESSE: readonly [RegExp, string][] = [
  [/\bvielleicht\b/i, "vielleicht"],
  [/\beventuell\b/i, "eventuell"],
  [/\bnotfalls\b/i, "notfalls"],
  [/\bzur not\b/i, "zur Not"],
  [/\bauch offen für\b/i, "auch offen für"],
  [/\bgrundsätzlich offen\b/i, "grundsätzlich offen"],
  [/\bkönnte ich mir vorstellen\b/i, "könnte ich mir vorstellen"],
  [/\bwäre auch ok\b|\bwäre auch okay\b/i, "wäre auch ok"],
];

function ersterTreffer(text: string, muster: readonly [RegExp, string][]): string | null {
  for (const [regex, name] of muster) {
    if (regex.test(text)) return name;
  }
  return null;
}

/**
 * Die Stärke aus einem einzelnen Satzteil lesen.
 *
 * `null` heisst: Der Satzteil legt sich nicht fest. Das ist ein
 * gültiges Ergebnis und kein Fehler — dann darf das Modell einen
 * Entwurf machen.
 */
export function staerkeAusSatzteil(satzteil: string): Staerkebefund {
  const text = satzteil.trim();
  if (text.length === 0) return OHNE_BEFUND;

  /*
   * Die Entkräftung zuerst, sonst gewinnt das „muss" in „muss nicht".
   *
   * Ergebnis ist `wunsch`, nicht `interesse`: Wer sagt „muss nicht
   * unbedingt remote", hat Remote erwähnt, weil es ihm etwas bedeutet.
   * Es fallenzulassen wäre genauso falsch wie es zu erzwingen.
   */
  const entkraeftet = ersterTreffer(text, ENTKRAEFTUNG);
  if (entkraeftet) return { staerke: "wunsch", marker: entkraeftet, quelle: "entkraeftung" };

  /* Die weiche Modalität bezieht sich auf den ganzen Satzteil und
     schlägt deshalb einen Muss-Marker darin. */
  const weich = ersterTreffer(text, WEICHE_MODALITAET);
  if (weich) return { staerke: "wunsch", marker: weich, quelle: "wunsch" };

  const muss = ersterTreffer(text, MUSS);
  if (muss) return { staerke: "muss", marker: muss, quelle: "muss" };

  const wunsch = ersterTreffer(text, WUNSCH);
  if (wunsch) return { staerke: "wunsch", marker: wunsch, quelle: "wunsch" };

  const interesse = ersterTreffer(text, INTERESSE);
  if (interesse) return { staerke: "interesse", marker: interesse, quelle: "interesse" };

  return OHNE_BEFUND;
}

/**
 * Einen Satz in Teile zerlegen, die je eine Aussage tragen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nötig ist
 * ══════════════════════════════════════════════════════════════
 *
 *   „Lager- oder Logistikjobs bis 30 km um Karlsruhe, mindestens
 *    36.000 € brutto, keine Zeitarbeit und möglichst geregelte
 *    Arbeitszeiten."
 *
 * Ein Satz, vier Aussagen, drei verschiedene Stärken. Wer den ganzen
 * Satz nach Markern durchsucht, findet „mindestens" und macht alles
 * zum Muss — auch die geregelten Arbeitszeiten, die ausdrücklich nur
 * „möglichst" waren.
 */
export function satzteile(satz: string): string[] {
  return satz
    /*
     * Punkt und Komma trennen nur, wenn keine Ziffern daran hängen.
     *
     * „mindestens 36.000 € brutto" zerfiel sonst in „mindestens 36"
     * und „000 € brutto" — und der Marker verlor den Betrag, zu dem
     * er gehört. Deutsche Zahlen schreiben beides: den Punkt als
     * Tausender-, das Komma als Dezimaltrennzeichen.
     *
     * „oder" trennt bewusst nicht: „Lager- oder Logistikjobs" ist
     * eine Aussage mit zwei Werten, keine zwei Aussagen.
     */
    .split(/[;!?]|(?<!\d)[,.](?!\d)|\bund\b|\bsowie\b|\baber\b|\bwobei\b/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Die Stärke für ein Kriterium aus dem Satz der Person.
 *
 * ══════════════════════════════════════════════════════════════
 * Wie der richtige Satzteil gefunden wird
 * ══════════════════════════════════════════════════════════════
 *
 * Über den Wert, den das Kriterium trägt. Steht „Zeitarbeit" im
 * Kriterium, zählt der Satzteil, in dem „Zeitarbeit" vorkommt — und
 * nur dessen Marker.
 *
 * Findet sich kein Satzteil, der den Wert nennt, gibt es kein
 * Ergebnis. Nicht „vermutlich Wunsch", nicht „vermutlich Muss":
 * `null`, und das Modell darf entwerfen.
 *
 * ── Warum nicht der nächstgelegene Satzteil ───────────────────
 *
 * Weil Nähe keine Zugehörigkeit ist. „Mindestens 36.000 € und
 * möglichst geregelte Arbeitszeiten" — der Marker im ersten Teil
 * steht direkt neben dem zweiten und gehört nicht dazu.
 */
export function staerkeFuerKriterium(
  satz: string,
  werte: readonly (string | number)[],
): Staerkebefund {
  const gesuchte = werte
    .map((w) => String(w).toLowerCase().trim().replace(/^(\d[\d.\s']*\d)$/, (z) => z.replace(/[.\s']/g, "")))
    .filter((w) => w.length >= 3);
  if (gesuchte.length === 0) return OHNE_BEFUND;

  for (const teil of satzteile(satz)) {
    /*
     * Zahlen ohne Tausenderpunkt vergleichen.
     *
     * Das Kriterium trägt 36000, der Satz schreibt „36.000 €". Ohne
     * diesen Schritt findet der Marker seinen Betrag nicht — und
     * „mindestens" ginge verloren, also genau die Angabe, die aus dem
     * Gehalt eine Bedingung macht.
     */
    const klein = teil
      .toLowerCase()
      .replace(/\d[\d.\s']*\d/g, (z) => z.replace(/[.\s']/g, ""));
    /*
     * Wortanfang statt Teilzeichenkette.
     *
     * „Lager" darf „Lagerlogistik" finden und nicht „Verlagerung" —
     * derselbe Fehler, der schon einmal einen Koch in eine Lagersuche
     * gebracht hat.
     */
    const passt = gesuchte.some((g) =>
      new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(klein),
    );
    if (!passt) continue;
    const befund = staerkeAusSatzteil(teil);
    if (befund.staerke !== null) return befund;
  }
  return OHNE_BEFUND;
}

/**
 * Was am Ende gilt — die Rangfolge angewandt.
 *
 * ── Warum das eine eigene Funktion ist ────────────────────────
 *
 * Damit die Regel an genau einer Stelle steht. Sie an drei Stellen
 * einzeln zu schreiben heisst, sie an zwei davon irgendwann anders zu
 * schreiben.
 */
export function staerkeEntscheiden(eingabe: {
  /** Was der Satz der Person hergibt. */
  ausText: Staerkebefund;
  /** Was im bestätigten Auftrag steht. */
  bestaetigt?: Staerke | null;
  /** Was das Modell vorschlägt. */
  modell?: Staerke | null;
}): { staerke: Staerke; herkunft: "text" | "bestaetigt" | "modell" | "grundwert"; marker: string | null } {
  if (eingabe.ausText.staerke !== null) {
    return { staerke: eingabe.ausText.staerke, herkunft: "text", marker: eingabe.ausText.marker };
  }
  if (eingabe.bestaetigt) {
    return { staerke: eingabe.bestaetigt, herkunft: "bestaetigt", marker: null };
  }
  if (eingabe.modell) {
    return { staerke: eingabe.modell, herkunft: "modell", marker: null };
  }
  /*
   * Der Grundwert ist „wunsch", nicht „muss".
   *
   * Ein Muss, das niemand gefordert hat, entfernt Stellen aus der
   * Suche. Ein Wunsch, den niemand geäussert hat, sortiert sie nur
   * weiter nach hinten. Von zwei Fehlern der kleinere.
   */
  return { staerke: "wunsch", herkunft: "grundwert", marker: null };
}
