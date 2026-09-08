/**
 * Vergleichen, was vergleichbar ist — und den Rest offen lassen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine fehlende Zahl nicht den ganzen Vergleich stoppt
 * ══════════════════════════════════════════════════════════════
 *
 * Wer sein heutiges Netto nicht kennt, kann trotzdem wissen wollen, ob
 * der Weg kürzer wird. Ein Vergleich, der auf die fehlende Zahl wartet,
 * hilft ihm nicht — und einer, der sie schätzt, hilft ihm noch weniger.
 *
 * Das ist der Prüffall B09: Ohne heutiges Einkommen bleiben die
 * anderen Achsen prüfbar, und beim Geld steht „offen", nicht „gleich".
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Modus mitgeführt wird
 * ══════════════════════════════════════════════════════════════
 *
 * Drei Modi aus dem Konzept v0.9, und sie beantworten verschiedene
 * Fragen:
 *
 *   einzelcheck    Was steht in dieser Anzeige?
 *   b_gegen_a      Wie unterscheiden sich zwei Stellen?
 *   a_gegen_heute  Was ändert sich gegenüber jetzt?
 *
 * Ein Einzelcheck darf keine Verbesserung behaupten: Ohne Bezugspunkt
 * gibt es keine. Genau das passiert, wenn die drei Modi im Code
 * denselben Weg nehmen und sich nur in der Überschrift unterscheiden.
 */

export const VERGLEICHSMODI = ["einzelcheck", "b_gegen_a", "a_gegen_heute"] as const;
export type Vergleichsmodus = (typeof VERGLEICHSMODI)[number];

export const VERGLEICHSACHSEN = ["arbeitsweg", "geld", "arbeitszeit", "vertrag", "aufgabe"] as const;
export type Vergleichsachse = (typeof VERGLEICHSACHSEN)[number];

export const ACHSENTEXT: Record<Vergleichsachse, string> = {
  arbeitsweg: "Arbeitsweg",
  geld: "Geld",
  arbeitszeit: "Arbeitszeiten",
  vertrag: "Vertrag",
  aufgabe: "Aufgabe",
};

export interface Achsenangabe {
  achse: Vergleichsachse;
  /** Die Seite, mit der verglichen wird — leer, wenn unbekannt. */
  bezug: string | null;
  /** Die Seite, um die es geht — leer, wenn unbekannt. */
  kandidat: string | null;
  /**
   * Beide Werte stehen auf derselben Grundlage.
   *
   * Zwei bekannte Zahlen genügen nicht: Ein Jahresbrutto gegen ein
   * Monatsnetto sind zwei Zahlen und kein Vergleich.
   */
  gleicheGrundlage: boolean;
}

export type Achsenstand = "vergleichbar" | "offen" | "nicht_gefragt";

export interface Achsenbefund {
  achse: Vergleichsachse;
  stand: Achsenstand;
  satz: string;
}

export interface Vergleichsergebnis {
  modus: Vergleichsmodus;
  befunde: readonly Achsenbefund[];
  vergleichbare: readonly Vergleichsachse[];
  offene: readonly Vergleichsachse[];
  /**
   * Darf überhaupt von einer Verbesserung gesprochen werden?
   *
   * Im Einzelcheck nie: Es gibt nichts, wogegen. Sonst nur, wenn
   * mindestens eine Achse wirklich vergleichbar ist.
   */
  verbesserungAussagbar: boolean;
  satz: string;
}

export function vergleichen(
  modus: Vergleichsmodus,
  angaben: readonly Achsenangabe[],
): Vergleichsergebnis {
  const befunde: Achsenbefund[] = angaben.map((a) => {
    if (modus === "einzelcheck") {
      return {
        achse: a.achse,
        stand: "nicht_gefragt" as const,
        satz: `${ACHSENTEXT[a.achse]}: im Einzelcheck ohne Vergleich.`,
      };
    }
    if (a.bezug === null || a.kandidat === null) {
      const fehlt = a.bezug === null ? "auf der Vergleichsseite" : "bei dieser Stelle";
      return {
        achse: a.achse,
        stand: "offen" as const,
        satz: `${ACHSENTEXT[a.achse]}: noch offen — ${fehlt} fehlt die Angabe.`,
      };
    }
    if (!a.gleicheGrundlage) {
      return {
        achse: a.achse,
        stand: "offen" as const,
        satz: `${ACHSENTEXT[a.achse]}: die beiden Angaben stehen nicht auf derselben Grundlage.`,
      };
    }
    return {
      achse: a.achse,
      stand: "vergleichbar" as const,
      satz: `${ACHSENTEXT[a.achse]}: vergleichbar.`,
    };
  });

  const vergleichbare = befunde.filter((b) => b.stand === "vergleichbar").map((b) => b.achse);
  const offene = befunde.filter((b) => b.stand === "offen").map((b) => b.achse);

  const satz =
    modus === "einzelcheck"
      ? "Das ist eine Einzelprüfung. Ob es besser wird als heute, sagt sie nicht."
      : vergleichbare.length === 0
        ? "Für keinen Punkt liegen beide Seiten vergleichbar vor."
        : offene.length === 0
          ? "Alle betrachteten Punkte lassen sich vergleichen."
          : `${vergleichbare.length} von ${befunde.length} Punkten lassen sich vergleichen; ` +
            `${offene.map((d) => ACHSENTEXT[d]).join(", ")} ${offene.length === 1 ? "bleibt" : "bleiben"} offen.`;

  return {
    modus,
    befunde,
    vergleichbare,
    offene,
    verbesserungAussagbar: modus !== "einzelcheck" && vergleichbare.length > 0,
    satz,
  };
}
