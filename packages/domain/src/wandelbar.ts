/**
 * ══════════════════════════════════════════════════════════════════
 * Was sich an einer Stelle ändern liesse — und wen man fragen müsste
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine Stelle passt fast. Die Aufgaben stimmen, die Erfahrung stimmt,
 * das Gehalt stimmt — und dann stehen dort 40 Stunden, wo jemand 32
 * arbeiten kann. Der Abgleich sagt „nicht zulässig", die Stelle
 * verschwindet aus der Liste, und beide Seiten erfahren nie
 * voneinander.
 *
 * Das ist kein Randfall. Es ist der häufigste Fall, in dem ein Markt
 * versagt, ohne dass jemand einen Fehler macht: Die Anzeige ist eine
 * Momentaufnahme dessen, was sich der Arbeitgeber vorgestellt hat,
 * und sie wird behandelt wie ein Gesetz.
 *
 * ── Die Unterscheidung, an der alles hängt ──────────────────────
 *
 * Nicht jedes Hindernis ist eine Frage an den Arbeitgeber. Es gibt
 * drei Arten, und sie zu vermischen wäre der Fehler, der dieses
 * Werkzeug lächerlich macht:
 *
 *   Arbeitgeberfrage   Er hat es festgelegt, er kann es ändern:
 *                      Wochenstunden, Bürotage, Befristung, ein
 *                      gefordertes Werkzeug, geforderte Jahre.
 *
 *   Eigene Bedingung   Sie gehört dem Menschen, nicht der Stelle.
 *                      Einen Arbeitgeber zu fragen, ob er den
 *                      Arbeitsweg verkürzen kann, ist Unsinn — hier
 *                      kann nur der Mensch selbst entscheiden, ob er
 *                      seine Grenze verschiebt.
 *
 *   Unantastbar        Niemand kann es geben. Eine Berufszulassung
 *                      erteilt der Staat, nicht die Personalabteilung.
 *                      Danach zu fragen, wäre eine Aufforderung zum
 *                      Rechtsbruch.
 *
 * ── Warum höchstens drei Fragen ─────────────────────────────────
 *
 * Ab der vierten ist es keine Anfrage mehr, sondern eine
 * Verhandlungsposition — und die kommt bei jemandem an, der die
 * Person nicht kennt. Wer fünf Bedingungen ändern muss, damit eine
 * Stelle passt, hat nicht diese Stelle gefunden, sondern eine andere
 * gesucht.
 */

/** Wer ein Hindernis aus dem Weg räumen könnte. */
export type Wandelbarkeit = "arbeitgeberfrage" | "eigene_bedingung" | "unantastbar";

/**
 * Zuordnung je Kriterium.
 *
 * Die Schlüssel sind die aus `@paycheck/matching`. Ein unbekannter
 * Schlüssel gilt als `unantastbar` — nicht als Frage: Lieber eine
 * Möglichkeit übersehen als eine Frage stellen, deren Wirkung niemand
 * bedacht hat.
 */
export const WANDELBARKEIT: Record<string, Wandelbarkeit> = {
  /* Der Arbeitgeber hat es festgelegt und kann es ändern. */
  wochenstunden: "arbeitgeberfrage",
  arbeitsmodell: "arbeitgeberfrage",
  schichtarbeit: "arbeitgeberfrage",
  befristung: "arbeitgeberfrage",
  vertragsform: "arbeitgeberfrage",
  reisebereitschaft: "arbeitgeberfrage",
  /*
   * Geforderte Jahre sind fast immer eine Schätzung dessen, was jemand
   * können soll — nicht eine Zahl, die geprüft wird. Deshalb eine
   * Frage: „Zählt auch, wer es nachweislich kann?"
   */
  erfahrungsniveau: "arbeitgeberfrage",

  /*
   * Das Gehalt ist eine Frage, aber eine andere.
   *
   * Es steht hier als Arbeitgeberfrage, weil die Spanne ihm gehört —
   * aber `lohntAnfrage()` behandelt es gesondert: Ein Gespräch über
   * Geld gehört nicht in eine Vorabfrage, es gehört ins Gespräch.
   */
  mindestgehalt: "arbeitgeberfrage",

  /* Die Bedingung gehört dem Menschen. Nur er kann sie verschieben. */
  arbeitsort: "eigene_bedingung",
  umkreis: "eigene_bedingung",
  pendelzeit: "eigene_bedingung",
  arbeitgeber_ausschluss: "eigene_bedingung",
  taetigkeit_ausschluss: "eigene_bedingung",

  /* Niemand kann es geben. */
  lizenz: "unantastbar",
  arbeitsland: "unantastbar",
  sprache: "unantastbar",
  berufsfeld: "unantastbar",
  taetigkeit: "unantastbar",
};

export function wandelbarkeit(kriterium: string): Wandelbarkeit {
  return WANDELBARKEIT[kriterium] ?? "unantastbar";
}

/** Was ein Abgleich zu einem Kriterium ergeben hat. */
export interface Kriterienbefund {
  kriterium: string;
  staerke: string;
  status: string;
  begruendung?: string;
  beleg?: string | null;
}

export interface Hindernis {
  kriterium: string;
  art: Wandelbarkeit;
  begruendung: string;
  beleg: string | null;
}

/** Höchstens so viele Fragen gehen an einen Arbeitgeber. */
export const MAX_FRAGEN = 3;

/**
 * Was diese Stelle blockiert.
 *
 * Nur verletzte Muss-Kriterien. Ein unerfüllter Wunsch ist kein
 * Hindernis, und eine unbekannte Angabe ist keines: Sie ist weder
 * erfüllt noch verletzt, und sie zu einer Frage an den Arbeitgeber zu
 * machen hiesse, ihn nach etwas zu fragen, das vielleicht längst in
 * seiner Anzeige steht.
 */
export function hindernisse(befunde: readonly Kriterienbefund[]): Hindernis[] {
  return befunde
    .filter((b) => b.staerke === "muss" && b.status === "nicht_erfuellt")
    .map((b) => ({
      kriterium: b.kriterium,
      art: wandelbarkeit(b.kriterium),
      begruendung: b.begruendung ?? "",
      beleg: b.beleg ?? null,
    }));
}

export type Anfragelage =
  | { art: "lohnt"; fragen: Hindernis[] }
  | { art: "keine_hindernisse" }
  | { art: "unantastbar"; kriterium: string }
  | { art: "eigene_sache"; kriterien: string[] }
  | { art: "zu_viele"; anzahl: number };

/**
 * Lohnt es sich, den Arbeitgeber zu fragen?
 *
 * ── Die Reihenfolge ist die Rangfolge der Ehrlichkeit ───────────
 *
 * Zuerst das Unantastbare: Wenn eine Berufszulassung fehlt, ist jede
 * weitere Überlegung müssig, und der Mensch soll das als Erstes
 * lesen — nicht nach zwei Fragen, die ohnehin nichts ändern.
 *
 * Dann die eigenen Bedingungen: Sie sind keine Anfrage, sondern eine
 * Entscheidung, die nur er treffen kann. Ihm stattdessen eine Anfrage
 * anzubieten wäre, ihm seine eigene Entscheidung als Bitte an einen
 * Fremden zu verkleiden.
 *
 * Erst dann die Fragen — und höchstens drei.
 */
export function lohntAnfrage(h: readonly Hindernis[]): Anfragelage {
  if (h.length === 0) return { art: "keine_hindernisse" };

  const unantastbar = h.find((x) => x.art === "unantastbar");
  if (unantastbar) return { art: "unantastbar", kriterium: unantastbar.kriterium };

  const eigene = h.filter((x) => x.art === "eigene_bedingung");
  if (eigene.length > 0) return { art: "eigene_sache", kriterien: eigene.map((x) => x.kriterium) };

  if (h.length > MAX_FRAGEN) return { art: "zu_viele", anzahl: h.length };
  return { art: "lohnt", fragen: [...h] };
}

/**
 * Die Frage an den Arbeitgeber.
 *
 * ── Warum sie fest formuliert ist ───────────────────────────────
 *
 * Weil sie an jemanden geht, der die Person nicht kennt, und weil ein
 * Modell hier nichts hinzuzufügen hat. Jede dieser Fragen ist neutral
 * gestellt: Sie fragt, ob etwas möglich WÄRE — sie behauptet nicht,
 * dass jemand es braucht, und sie nennt niemanden.
 *
 * ── Warum keine Frage nach dem Gehalt ───────────────────────────
 *
 * „Ginge auch mehr?" vor dem ersten Gespräch ist keine Bedingung,
 * sondern eine Verhandlung — und eine, die man verliert, bevor
 * irgendjemand weiss, mit wem er es zu tun hat.
 */
export function frageText(kriterium: string): string | null {
  switch (kriterium) {
    case "wochenstunden":
      return "Wäre diese Stelle grundsätzlich auch in Teilzeit denkbar?";
    case "arbeitsmodell":
      return "Wären mehr Tage im Homeoffice möglich, als in der Anzeige stehen?";
    case "schichtarbeit":
      return "Gibt es diese Rolle auch ohne Wechselschicht?";
    case "befristung":
      return "Ist eine unbefristete Anstellung denkbar?";
    case "vertragsform":
      return "Ist eine andere Vertragsform möglich als die genannte?";
    case "reisebereitschaft":
      return "Wie viel Reisetätigkeit ist tatsächlich vorgesehen — und wäre weniger möglich?";
    case "erfahrungsniveau":
      return "Zählen die geforderten Jahre auch dann, wenn jemand die Aufgaben nachweislich beherrscht?";
    case "mindestgehalt":
      /* Kein Gehaltsgespräch per Vorabfrage. Siehe oben. */
      return null;
    default:
      return null;
  }
}

/**
 * Was der Mensch liest, wenn keine Anfrage sinnvoll ist.
 *
 * Jede Antwort sagt, woran es liegt und was er tun könnte. „Passt
 * nicht" wäre die kürzeste und die unbrauchbarste.
 */
export function lageText(lage: Anfragelage): string {
  switch (lage.art) {
    case "keine_hindernisse":
      return "An dieser Stelle steht dir nichts im Weg — es gibt hier nichts zu verhandeln.";
    case "unantastbar":
      return lage.kriterium === "lizenz"
        ? "Für diese Stelle ist eine Zulassung vorgeschrieben, die kein Arbeitgeber erlassen kann. Danach zu fragen wäre eine Aufforderung zum Rechtsbruch."
        : "Was hier fehlt, kann ein Arbeitgeber nicht ändern — es ist keine Bedingung, die er gesetzt hat.";
    case "eigene_sache":
      return "Was hier im Weg steht, ist deine eigene Bedingung, nicht die des Arbeitgebers. Nur du kannst entscheiden, ob du sie für diese Stelle verschiebst.";
    case "zu_viele":
      return `An dieser Stelle müssten ${lage.anzahl} Bedingungen anders sein. Das ist keine Anfrage mehr, sondern eine andere Stelle.`;
    case "lohnt":
      return lage.fragen.length === 1
        ? "Eine einzige Bedingung steht im Weg — und sie hat der Arbeitgeber gesetzt."
        : `${lage.fragen.length} Bedingungen stehen im Weg, und beide hat der Arbeitgeber gesetzt.`;
  }
}

/**
 * Die Fragen, die tatsächlich gestellt werden können.
 *
 * Ein Hindernis ohne Fragetext erzeugt keine Frage — und keine
 * erfundene. Kommt dabei nichts heraus, ist die Anfrage keine.
 */
export function fragenZusammenstellen(lage: Anfragelage): string[] {
  if (lage.art !== "lohnt") return [];
  return lage.fragen
    .map((f) => frageText(f.kriterium))
    .filter((t): t is string => t !== null)
    .slice(0, MAX_FRAGEN);
}
