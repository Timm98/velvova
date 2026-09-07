/**
 * Die Fragen, die man zu einem Beruf stellt, bevor man sich bewirbt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Fragen und keine Antworten
 * ══════════════════════════════════════════════════════════════
 *
 * Hier stand einmal ein Block, der zu jeder Stelle vier Auskünfte
 * ausklappte — Arbeitsalltag, fehlende Anforderungen, Warnsignale,
 * Gesprächsfragen. Vier Modellaufrufe je Stelle, deren Ergebnis in
 * einer Ziehharmonika verschwand.
 *
 * Jetzt stehen dort nur die Fragen. Beantwortet werden sie von Monday
 * in der Blase unten rechts — dort, wo alle anderen Antworten auch
 * stehen. Eine Frage, die man anklickt, ist dieselbe Frage, die man
 * hätte tippen können; sie soll nicht an einem anderen Ort landen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie aus dem Titel gebaut werden
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Frage kann nichts erfinden. „Wie sieht ein Arbeitstag als
 * Fachkraft für Lagerlogistik aus?" behauptet nichts über die Stelle
 * — sie setzt nur den Beruf in einen Satz. Genau deshalb dürfen sie
 * hier entstehen, ohne dass ein Modell mitliest.
 */

export type Berufsfrage = { key: string; text: string };

/**
 * Den Titel auf den Beruf eindampfen.
 *
 * Anzeigentitel tragen Anhängsel, die in einer Frage albern klingen:
 * „(m/w/d)", „in Vollzeit", „ab sofort", Standorte, Kennziffern. Sie
 * stehen zwischen Klammern, hinter Bindestrichen oder nach Kommata —
 * und wer sie stehen lässt, fragt „Wie sieht ein Arbeitstag als
 * LKW-Fahrer (m/w/d) in Eitting, Eching aus?".
 */
export function berufAusTitel(titel: string): string {
  return (
    titel
      /* Klammerinhalte fliegen ganz heraus — sie sind nie der Beruf. */
      .replace(/\([^)]*\)/g, " ")
      /* Alles ab dem ersten Komma oder Bindestrich mit Leerzeichen
         drumherum: Dort beginnt in aller Regel der Ort oder der
         Zusatz, nicht mehr die Tätigkeit. */
      .split(/\s[–—-]\s|,/)[0]!
      .replace(/\b(m\/w\/d|w\/m\/d|d\/m\/w|gn|all genders)\b/gi, " ")
      .replace(/\b(in )?(Voll|Teil)zeit\b/gi, " ")
      .replace(/\bab sofort\b/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * Was diese Anzeige über sich preisgibt.
 *
 * Aus echten Feldern, nicht geraten: Ob Aufgaben dastehen, ob ein
 * Gehalt genannt ist, ob Schichtarbeit oder Reisen erwähnt werden.
 */
export type Stellenlage = {
  hatAufgaben: boolean;
  hatGehalt: boolean;
  hatAnforderungen: boolean;
  schichtarbeit: boolean;
  reiseanteil: number | null;
  arbeitsmodell: string;
  unternehmen: string;
};

/**
 * Vier Fragen — zu diesem Beruf UND zu dieser Anzeige.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie sich je Stelle unterscheiden müssen
 * ══════════════════════════════════════════════════════════════
 *
 * Vier immer gleiche Fragen unter jeder Anzeige sind ein Menü. Sie
 * stehen auch dann da, wenn die Anzeige die Antwort schon gibt — „Was
 * verdient man üblicherweise?" unter einer Anzeige mit Gehaltsangabe
 * ist eine Frage nach etwas, das zwei Zentimeter höher steht.
 *
 * Deshalb entscheidet die Lage mit: Was die Anzeige verschweigt, wird
 * gefragt; was sie nennt, nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie trotzdem ohne Modell entstehen
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Frage kann nichts erfinden. Sie setzt den Beruf und eine
 * Beobachtung über die Anzeige in einen Satz — beides steht fest.
 * Beantwortet wird sie von Monday, und dort liest das Modell mit.
 *
 * Vier, nicht acht: Eine Liste, die man überfliegt, ist keine Auswahl
 * mehr.
 */
export function berufsfragen(titel: string, lage: Stellenlage): Berufsfrage[] {
  const beruf = berufAusTitel(titel);

  /*
   * Ohne brauchbaren Titel keine Fragen.
   *
   * „Wie sieht ein Arbeitstag als aus?" ist schlimmer als gar nichts.
   * Ein leeres Ergebnis lässt den Aufrufer den Block weglassen.
   */
  if (beruf.length < 3) return [];

  const kandidaten: (Berufsfrage & { rang: number })[] = [];

  /* Der Arbeitsalltag steht fast nie in der Anzeige — und wenn doch,
     ist die Frage danach, wie er WIRKLICH aussieht, immer noch eine
     andere. */
  kandidaten.push({
    key: "alltag",
    text: lage.hatAufgaben
      ? `Die Anzeige listet Aufgaben auf — wie sieht der Alltag als ${beruf} wirklich aus?`
      : `Wie sieht ein typischer Arbeitstag als ${beruf} aus?`,
    rang: 1,
  });

  /* Nach dem Gehalt nur fragen, wenn keines dasteht. Sonst fragt man
     nach etwas, das zwei Zentimeter höher steht. */
  kandidaten.push({
    key: "gehalt",
    text: lage.hatGehalt
      ? `Ist das genannte Gehalt für ${beruf} angemessen?`
      : `Die Anzeige nennt kein Gehalt — was verdient man als ${beruf} üblicherweise?`,
    rang: 2,
  });

  kandidaten.push({
    key: "voraussetzungen",
    text: lage.hatAnforderungen
      ? `Welche der genannten Anforderungen sind wirklich nötig?`
      : `Was braucht man, um als ${beruf} zu arbeiten?`,
    rang: 3,
  });

  /* Schichtarbeit und Reisen ändern ein Leben mehr als das Gehalt.
     Stehen sie in der Anzeige, gehört die Frage nach oben. */
  if (lage.schichtarbeit) {
    kandidaten.push({
      key: "schicht",
      text: `Wie belastend ist Schichtarbeit als ${beruf} auf Dauer?`,
      rang: 0.5,
    });
  }
  if (lage.reiseanteil !== null && lage.reiseanteil >= 25) {
    kandidaten.push({
      key: "reisen",
      text: `${lage.reiseanteil} % Reiseanteil — was heisst das im Alltag?`,
      rang: 0.6,
    });
  }
  if (lage.arbeitsmodell === "remote") {
    kandidaten.push({
      key: "remote",
      text: `Was ist beim Arbeiten aus der Ferne als ${beruf} anders?`,
      rang: 3.5,
    });
  }

  kandidaten.push({
    key: "schattenseiten",
    text: `Was ist an dem Beruf ${beruf} anstrengend?`,
    rang: 4,
  });

  return kandidaten
    .sort((a, b) => a.rang - b.rang)
    .slice(0, 4)
    .map(({ key, text }) => ({ key, text }));
}
