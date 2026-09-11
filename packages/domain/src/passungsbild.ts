/**
 * ══════════════════════════════════════════════════════════════════
 * Vier Aussagen statt einer Zahl
 * ══════════════════════════════════════════════════════════════════
 *
 * „87 % Match" ist keine Auskunft. Es ist eine Zahl, der man glauben
 * muss, und sie verschmilzt zwei Fragen, die nichts miteinander zu
 * tun haben:
 *
 *   Kann die Person die Arbeit?
 *   Passt die Arbeit zum Leben der Person?
 *
 * Wer sie zusammenrechnet, macht aus „fachlich stark, aber
 * Nachtschicht" und „fachlich schwach, aber perfekte Zeiten" dieselbe
 * Zahl — und beide Menschen bekommen dieselbe Empfehlung.
 *
 * ── Die vier ───────────────────────────────────────────────────
 *
 *   fachlich      Muss- und Kann-Anforderungen gegen belegte Fähigkeiten
 *   bedingungen   harte Bedingungen: erfüllt, verletzt, unbekannt
 *   nachweise     wie viel davon überhaupt belegt ist
 *   wuensche      Vorlieben, Arbeitsweise, Werte
 *
 * Ein Gesamtwert darf daneben stehen — für die Sortierung. In der
 * Oberfläche muss ablesbar bleiben, warum eine Stelle oben steht.
 */

import type { Abgleichbefund } from "./scoring.ts";

export interface Fachlage {
  /** Muss-Anforderungen, die auf einer belegten Fähigkeit stehen. */
  erfuellt: number;
  /** Schlüssel stimmt, Stufe reicht nicht — oder nur Wortähnlichkeit. */
  teilweise: number;
  /** Der Katalog kennt die Anforderung, es liegt nichts vor. */
  nichtBelegt: number;
  /** Alle geprüften Muss-Anforderungen. */
  geprueft: number;
  /** Was konkret offen ist — die Anforderungstexte, gekürzt. */
  offen: string[];
}

export interface Bedingungslageview {
  erfuellt: number;
  verletzt: number;
  unbekannt: number;
  /** Die verletzten Bedingungen im Klartext. Sie entscheiden zuerst. */
  verletzte: string[];
}

export interface Passungsbild {
  fachlich: Fachlage;
  bedingungen: Bedingungslageview;
  /** Anteil der geprüften Anforderungen mit mindestens einem Beleg, 0–1. */
  nachweisdeckung: number | null;
  /** Der vorhandene Gesamtwert. Für die Sortierung, nicht für die Auskunft. */
  gesamt: number | null;
  /** Wie viel der Stelle überhaupt beurteilt werden konnte, 0–1. */
  abdeckung: number;
}

/**
 * Aus den Befunden und der Bedingungsprüfung ein Bild.
 *
 * Rechnet nichts neu — sortiert nur, was schon dasteht. Genau
 * deshalb kann es nichts erfinden.
 */
export function passungsbild(
  befunde: readonly Abgleichbefund[],
  bedingungen: readonly { label: string; verdict: "eligible" | "uncertain" | "blocked" }[],
  gesamt: number | null,
  abdeckung: number,
): Passungsbild {
  const muss = befunde.filter((b) => b.art === "must");

  const fachlich: Fachlage = {
    erfuellt: muss.filter((b) => b.stand === "erfuellt").length,
    teilweise: muss.filter((b) => b.stand === "teilweise").length,
    nichtBelegt: muss.filter((b) => b.stand === "nicht_belegt").length,
    geprueft: muss.length,
    offen: muss
      .filter((b) => b.stand === "nicht_belegt" || b.stand === "teilweise")
      .map((b) => b.anforderung.trim().slice(0, 70)),
  };

  const mitBeleg = befunde.filter((b) => b.belege.length > 0).length;

  return {
    fachlich,
    bedingungen: {
      erfuellt: bedingungen.filter((b) => b.verdict === "eligible").length,
      verletzt: bedingungen.filter((b) => b.verdict === "blocked").length,
      unbekannt: bedingungen.filter((b) => b.verdict === "uncertain").length,
      verletzte: bedingungen.filter((b) => b.verdict === "blocked").map((b) => b.label),
    },
    nachweisdeckung: befunde.length === 0 ? null : mitBeleg / befunde.length,
    gesamt,
    abdeckung,
  };
}

/**
 * Die vier Zeilen, wie sie danebenstehen.
 *
 * Jede sagt etwas anderes, und keine ersetzt eine andere. Sie sind
 * bewusst nicht gewichtet: Wer sie zu einer Reihenfolge zusammenzieht,
 * ist wieder bei der einen Zahl.
 */
export function passungszeilen(p: Passungsbild): string[] {
  const zeilen: string[] = [];

  zeilen.push(
    p.fachlich.geprueft === 0
      ? "Fachlich: Die Anzeige nennt keine prüfbare Anforderung."
      : `Fachlich: ${p.fachlich.erfuellt} von ${p.fachlich.geprueft} Muss-Anforderungen belegt` +
        (p.fachlich.teilweise > 0 ? `, ${p.fachlich.teilweise} teilweise` : "") +
        ".",
  );

  zeilen.push(
    p.bedingungen.verletzt > 0
      ? `Arbeitsbedingungen: ${p.bedingungen.verletzte.join(", ")} — das passt nicht zu dem, was du gesagt hast.`
      : p.bedingungen.unbekannt > 0
        ? `Arbeitsbedingungen: ${p.bedingungen.erfuellt} geprüft und in Ordnung, ${p.bedingungen.unbekannt} sagt die Anzeige nicht.`
        : `Arbeitsbedingungen: alle ${p.bedingungen.erfuellt} geprüften passen.`,
  );

  zeilen.push(
    p.nachweisdeckung === null
      ? "Nachweise: nichts zu prüfen."
      : `Nachweise: ${Math.round(p.nachweisdeckung * 100)} Prozent der geprüften Anforderungen stehen auf einem Beleg.`,
  );

  if (p.fachlich.offen.length > 0) {
    zeilen.push(`Offen: ${p.fachlich.offen.slice(0, 3).join(" · ")}`);
  }

  return zeilen;
}

/**
 * Warum diese Stelle vor der nächsten steht.
 *
 * ── Warum das nicht das Modell formuliert ───────────────────────
 *
 * Weil ein Modell, das eine Reihenfolge erklären soll, eine
 * Begründung findet — auch dann, wenn die Reihenfolge an etwas
 * anderem lag. Dieser Satz nennt den ersten Unterschied, der
 * tatsächlich entschieden hat, in derselben Reihenfolge, in der die
 * Sortierung ihn geprüft hat.
 */
export function vorsprungssatz(a: Passungsbild, b: Passungsbild): string {
  if (a.bedingungen.verletzt !== b.bedingungen.verletzt) {
    return a.bedingungen.verletzt < b.bedingungen.verletzt
      ? "Sie verletzt weniger deiner Bedingungen."
      : "Sie verletzt mehr deiner Bedingungen.";
  }
  if (a.fachlich.erfuellt !== b.fachlich.erfuellt) {
    return `Mehr belegte Muss-Anforderungen: ${a.fachlich.erfuellt} gegen ${b.fachlich.erfuellt}.`;
  }
  if (a.fachlich.teilweise !== b.fachlich.teilweise) {
    return `Weniger nur teilweise Belegtes: ${a.fachlich.teilweise} gegen ${b.fachlich.teilweise}.`;
  }
  if ((a.nachweisdeckung ?? 0) !== (b.nachweisdeckung ?? 0)) {
    return "Mehr davon steht auf einem Beleg.";
  }
  if (a.abdeckung !== b.abdeckung) {
    return "Über sie ist mehr bekannt — die Einschätzung trägt weiter.";
  }
  /*
   * Zuletzt der interne Gesamtwert. Er steht am Ende, weil er das
   * Undurchsichtigste ist: Er fasst auch Aufgaben, Arbeitsweise und
   * Werte zusammen, und keine dieser Achsen lässt sich in einem Satz
   * belegen. Wo er entscheidet, steht das ausdrücklich da.
   */
  if (a.gesamt !== null && b.gesamt !== null && a.gesamt !== b.gesamt) {
    return `Nur der interne Gesamtwert unterscheidet sie (${a.gesamt} gegen ${b.gesamt}). Er fasst auch Aufgaben, Arbeitsweise und Werte zusammen — an den belegten Anforderungen liegt es nicht.`;
  }
  return "Kein Unterschied, den die Daten hergeben. Die Reihenfolge ist an dieser Stelle willkürlich.";
}
