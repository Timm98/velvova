import type { Rolle } from "./aufstellung.ts";
import type { Agentenlauf } from "./lauf.ts";
import type { Prueflauf } from "./pruefung.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Das Lagebild — was nach zwei Runden tatsächlich feststeht
 * ══════════════════════════════════════════════════════════════════
 *
 * Hier wird gerechnet, nicht formuliert. Kein Modell ist beteiligt.
 *
 * ── Warum das keine Aufgabe für ein Modell ist ──────────────────
 *
 * Weil die Regel aus §8 — Belege schlagen Mehrheit — sonst als Bitte
 * in einem Prompt stünde. Eine Bitte wird an einem schlechten Tag
 * überlesen, und niemand merkt es: Das Ergebnis liest sich flüssig,
 * es ist nur nach Mehrheit gewichtet statt nach Belegen. Ein Fehler,
 * der wie ein Ergebnis aussieht.
 *
 * Als Funktion ist die Regel prüfbar. Der Test unten stellt genau den
 * Fall her, um den es geht: drei unbelegte Stimmen gegen eine
 * belegte.
 *
 * ── Die fünf Stände und warum es nicht drei sind ────────────────
 *
 * `gesichert` und `gestuetzt` auseinanderzuhalten ist der Punkt der
 * ganzen Übung: Das eine hat einen Beleg, das andere nur Zustimmung.
 * Zustimmung ist billig — Modelle stimmen einander gern zu.
 *
 * `ungeprueft` gibt es, weil eine Aussage, die niemand angesehen hat,
 * nicht dasselbe ist wie eine, der niemand widersprochen hat.
 * Schwiege dieser Unterschied, hiesse „drei Modelle haben geprüft"
 * auch dann, wenn Runde 2 ausgefallen ist. Das wäre der gefakte
 * Fortschritt, der ausgeschlossen ist.
 */

export type Stand =
  /** Belegt und unwidersprochen. Das Beste, was hier erreichbar ist. */
  | "gesichert"
  /** Unbelegt, aber geprüft und unwidersprochen. */
  | "gestuetzt"
  /** Niemand hat sie angesehen. Kein Urteil, weder gut noch schlecht. */
  | "ungeprueft"
  /** Widersprochen. Braucht eine Entscheidung. */
  | "strittig"
  /** Unbelegte Behauptung gegen belegten Widerspruch. */
  | "verworfen";

export interface Aussagenstand {
  aussage: string;
  stand: Stand;
  /** Wer sie in Runde 1 aufgestellt hat. */
  vertretenVon: Rolle[];
  /** Ob mindestens einer der Urheber Belege beibrachte. */
  belegt: boolean;
  gestuetztVon: Rolle[];
  widersprochenVon: Rolle[];
  /** Ob mindestens ein Widerspruch selbst belegt war. */
  widerspruchBelegt: boolean;
  /** Die Begründungen der Widersprüche — für den Richter und fürs Protokoll. */
  einwaende: string[];
}

export interface Lagebild {
  staende: Aussagenstand[];
  /** Nur die strittigen, in derselben Reihenfolge. Für den Richter. */
  strittig: Aussagenstand[];
  /**
   * Ob überhaupt gegengeprüft wurde.
   *
   * Steht hier und nicht nur im Prüfergebnis, weil jede Oberfläche,
   * die das Lagebild anzeigt, diese Frage beantworten können muss,
   * ohne den ganzen Lauf zu kennen.
   */
  gegengeprueft: boolean;
}

/**
 * Grobe Zuordnung zweier Formulierungen zur selben Aussage.
 *
 * Dieselbe Regel wie in `aussagenLage`: Kleinschreibung, keine
 * Satzzeichen. Sie erkennt Umformulierungen nicht, und das ist die
 * richtige Richtung des Fehlers — zwei echte Aussagen zu verschmelzen
 * wäre schlimmer, als eine doppelt zu führen.
 */
function schluessel(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}

/**
 * Runde 1 und Runde 2 zu einem Stand je Aussage verrechnen.
 *
 * `gegengeprueft: false` heisst: Runde 2 hat nicht stattgefunden.
 * Dann bekommt jede Aussage `ungeprueft` — auch die belegten. Ein
 * Beleg macht eine Aussage glaubwürdig, aber nicht geprüft.
 */
export function lagebild(
  runde1: readonly Agentenlauf[],
  runde2: readonly Prueflauf[],
  gegengeprueft: boolean,
): Lagebild {
  const staende = new Map<string, Aussagenstand>();

  for (const lauf of runde1) {
    const e = lauf.ergebnis;
    if (!e) continue;
    const belegt = e.belege.length > 0;

    for (const aussage of [...e.befunde, ...e.empfehlungen]) {
      const k = schluessel(aussage);
      if (!k) continue;
      const da = staende.get(k);
      if (da) {
        if (!da.vertretenVon.includes(lauf.rolle)) da.vertretenVon.push(lauf.rolle);
        da.belegt ||= belegt;
      } else {
        staende.set(k, {
          aussage,
          stand: "ungeprueft",
          vertretenVon: [lauf.rolle],
          belegt,
          gestuetztVon: [],
          widersprochenVon: [],
          widerspruchBelegt: false,
          einwaende: [],
        });
      }
    }
  }

  if (gegengeprueft) {
    for (const pruefer of runde2) {
      for (const u of pruefer.ergebnis?.urteile ?? []) {
        const stand = staende.get(schluessel(u.aussage));
        if (!stand) continue;
        /*
         * ── Selbstbestätigung nein, Selbstkorrektur ja ───────────
         *
         * Wer eine Aussage selbst aufgestellt hat, darf sie nicht
         * STÜTZEN. Das wäre ein Echo, und im Lagebild wäre es später
         * nicht mehr von einer echten Bestätigung zu unterscheiden.
         *
         * Ihr zu WIDERSPRECHEN ist das Gegenteil und sehr viel wert.
         * Der Prüfer sieht die Aussage anonym; dass er sie verwirft,
         * ohne zu wissen, dass sie von ihm stammt, ist ein
         * unabhängiges zweites Urteil — und ein Modell, das sich
         * unter Prüfung selbst korrigiert, ist das stärkste Signal,
         * das in diesem Verfahren überhaupt vorkommt.
         *
         * Der Unterschied fiel erst auf, als die ganze Kette einmal
         * am Stück lief: Stellen alle drei Modelle dieselbe Aussage
         * auf, ist jeder Prüfer zugleich Urheber — und eine Sperre
         * ohne diese Unterscheidung machte die Aussage
         * unwiderlegbar. Je einiger sich die Modelle waren, desto
         * weniger konnte ihnen widersprochen werden. Genau
         * verkehrt herum.
         */
        const eigene = stand.vertretenVon.includes(pruefer.rolle);
        if (eigene && u.urteil !== "widersprochen") continue;

        if (u.urteil === "gestuetzt") {
          if (!stand.gestuetztVon.includes(pruefer.rolle)) stand.gestuetztVon.push(pruefer.rolle);
        } else if (u.urteil === "widersprochen") {
          if (!stand.widersprochenVon.includes(pruefer.rolle))
            stand.widersprochenVon.push(pruefer.rolle);
          stand.widerspruchBelegt ||= u.beleg !== null;
          if (u.begruendung) stand.einwaende.push(u.begruendung);
        }
      }
    }
  }

  for (const stand of staende.values()) {
    stand.stand = standBestimmen(stand, gegengeprueft);
  }

  /*
   * Belegtes zuerst, dann das breiter Vertretene.
   *
   * Nicht umgekehrt: Wäre die Zahl der Stimmen das erste Kriterium,
   * wäre die Sortierung genau das Mehrheitsprinzip, das §8 verbietet
   * — nur eine Ebene tiefer versteckt.
   */
  const RANG: Record<Stand, number> = {
    gesichert: 0, gestuetzt: 1, strittig: 2, ungeprueft: 3, verworfen: 4,
  };
  const sortiert = [...staende.values()].sort(
    (a, b) =>
      RANG[a.stand] - RANG[b.stand] ||
      Number(b.belegt) - Number(a.belegt) ||
      b.vertretenVon.length - a.vertretenVon.length ||
      a.aussage.localeCompare(b.aussage),
  );

  return {
    staende: sortiert,
    strittig: sortiert.filter((s) => s.stand === "strittig"),
    gegengeprueft,
  };
}

/**
 * Der eine Ort, an dem entschieden wird — und die Regel steht.
 *
 * Die Reihenfolge der Prüfungen IST die Rangfolge:
 *
 *   1. Ohne Runde 2 ist nichts geprüft, egal wie gut belegt.
 *   2. Ein belegter Widerspruch gegen eine unbelegte Behauptung
 *      verwirft sie — auch wenn drei Modelle sie aufgestellt haben.
 *      Das ist §8 in einer Zeile.
 *   3. Steht Beleg gegen Beleg, entscheidet hier niemand. Das ist
 *      Sache des Richters, und dass er dafür da ist, ist der Grund,
 *      warum an dieser Stelle kein Gewicht erfunden wird.
 */
function standBestimmen(s: Aussagenstand, gegengeprueft: boolean): Stand {
  if (!gegengeprueft) return "ungeprueft";

  if (s.widersprochenVon.length > 0) {
    if (s.widerspruchBelegt && !s.belegt) return "verworfen";
    return "strittig";
  }

  if (s.gestuetztVon.length === 0) return "ungeprueft";
  return s.belegt ? "gesichert" : "gestuetzt";
}
