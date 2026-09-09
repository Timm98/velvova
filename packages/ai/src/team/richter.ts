import type { Rolle, Teamplatz } from "./aufstellung.ts";
import type { Aussagenstand, Lagebild } from "./lagebild.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Richter — nur dort, wo das Lagebild nicht entscheiden kann
 * ══════════════════════════════════════════════════════════════════
 *
 * Das Lagebild entscheidet alles, was sich nach einer Regel
 * entscheiden lässt. Übrig bleibt genau ein Fall: Beleg steht gegen
 * Beleg. Dafür gibt es keine Regel, denn welcher Beleg trägt, hängt
 * am Inhalt — und Inhalt zu beurteilen ist das Einzige, wofür hier
 * ein Modell gebraucht wird.
 *
 * ── Warum er nur die strittigen Punkte sieht ────────────────────
 *
 * Ein Richter, dem man alles vorlegt, urteilt über alles — auch über
 * das, was bereits nach Regel feststeht. Damit könnte eine Meinung
 * ein Ergebnis kippen, das aus Belegen folgt. Die Auswahl ist
 * deshalb nicht Sparsamkeit, sondern die Grenze seiner Zuständigkeit.
 *
 * ── Warum „unentschieden" eine gültige Antwort ist ──────────────
 *
 * Weil ein Richter, der entscheiden MUSS, immer entscheidet — auch
 * wenn die Lage es nicht hergibt. Heraus kommt dann eine Sicherheit,
 * die es nicht gibt, und niemand sieht ihr an, dass sie erzwungen
 * war. Ein offener Punkt, der als offen dasteht, ist ein besseres
 * Ergebnis als eine gewürfelte Entscheidung.
 *
 * ── Warum er möglichst nicht mitgespielt haben soll ─────────────
 *
 * Wer über die eigene Behauptung urteilt, ist kein Richter. Steht
 * kein unbeteiligtes Modell zur Verfügung, findet die Verhandlung
 * trotzdem statt — aber `befangen` steht im Ergebnis, damit die
 * Oberfläche es sagen kann, statt es zu verschweigen.
 */

export interface Streitvorlage {
  kennung: string;
  aussage: string;
  /** Ob die Behauptung selbst belegt war. */
  belegt: boolean;
  /** Die Einwände gegen sie, ohne Urheber. */
  einwaende: string[];
  /** Ob mindestens ein Einwand belegt war. */
  einwandBelegt: boolean;
}

export interface Richterspruch {
  aussage: string;
  entscheidung: "haltbar" | "nicht_haltbar" | "unentschieden";
  begruendung: string;
}

export type RichterAusfuehren = (
  vorlagen: readonly Streitvorlage[],
  signal: AbortSignal,
) => Promise<{ sprueche: Richterspruch[] }>;

export interface Richtergrenzen {
  fristMs: number;
  /**
   * Wie viele Streitpunkte verhandelt werden.
   *
   * Was darüber hinausgeht, bleibt strittig und steht als strittig
   * da. Das ist ehrlicher, als es in einem überlangen Prompt
   * mitlaufen zu lassen, wo es überflogen wird.
   */
  maxPunkte: number;
}

export const RICHTERGRENZEN: Richtergrenzen = { fristMs: 40_000, maxPunkte: 8 };

export interface Richterergebnis {
  sprueche: Richterspruch[];
  /** Der Richter hat in Runde 1 selbst mitgearbeitet. */
  befangen: boolean;
  ausgefallen: boolean;
  grund: string | null;
  dauerMs: number;
}

/**
 * Wer richtet.
 *
 * Bevorzugt jemand, der in Runde 1 nicht dabei war. Gibt es den
 * nicht, richtet der erste Platz — und der Aufrufer erfährt es.
 */
export function richterWaehlen(
  team: readonly Teamplatz[],
  beteiligt: readonly Rolle[],
): { platz: Teamplatz; befangen: boolean } | null {
  const unbeteiligt = team.find((p) => !beteiligt.includes(p.rolle));
  if (unbeteiligt) return { platz: unbeteiligt, befangen: false };
  const erster = team[0];
  return erster ? { platz: erster, befangen: true } : null;
}

const KENNUNGEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function streitvorlagen(
  bild: Lagebild,
  grenzen: Richtergrenzen = RICHTERGRENZEN,
): Streitvorlage[] {
  return bild.strittig.slice(0, grenzen.maxPunkte).map((s, i) => ({
    kennung: KENNUNGEN[i % 26]!.repeat(Math.floor(i / 26) + 1),
    aussage: s.aussage,
    belegt: s.belegt,
    einwaende: s.einwaende,
    einwandBelegt: s.widerspruchBelegt,
  }));
}

function mitFrist(ms: number, aussen?: AbortSignal): AbortSignal {
  const eigen = AbortSignal.timeout(ms);
  return aussen ? AbortSignal.any([aussen, eigen]) : eigen;
}

/**
 * Verhandeln — oder gar nicht erst antreten.
 *
 * Ohne Streitpunkt findet nichts statt. Ein Richter, der bestätigt,
 * dass es nichts zu entscheiden gab, kostet Geld und erzeugt einen
 * Absatz, der so klingt, als wäre etwas entschieden worden.
 */
export async function richterlauf(
  bild: Lagebild,
  team: readonly Teamplatz[],
  beteiligt: readonly Rolle[],
  ausfuehren: RichterAusfuehren,
  grenzen: Richtergrenzen = RICHTERGRENZEN,
  aussen?: AbortSignal,
): Promise<Richterergebnis> {
  const beginn = Date.now();
  const vorlagen = streitvorlagen(bild, grenzen);

  if (vorlagen.length === 0) {
    return { sprueche: [], befangen: false, ausgefallen: true,
      grund: "Kein strittiger Punkt.", dauerMs: Date.now() - beginn };
  }

  const gewaehlt = richterWaehlen(team, beteiligt);
  if (!gewaehlt) {
    return { sprueche: [], befangen: false, ausgefallen: true,
      grund: "Kein Modell für die Entscheidung verfügbar.", dauerMs: Date.now() - beginn };
  }

  try {
    const roh = await ausfuehren(vorlagen, mitFrist(grenzen.fristMs, aussen));
    const erlaubt = new Map(vorlagen.map((v) => [v.aussage.toLowerCase().trim(), v.aussage]));
    const gesehen = new Set<string>();
    const sprueche: Richterspruch[] = [];

    for (const s of roh.sprueche) {
      const k = s.aussage?.toLowerCase().trim() ?? "";
      const wortlaut = erlaubt.get(k);
      if (!wortlaut || gesehen.has(k)) continue;
      gesehen.add(k);
      /*
       * Ein Spruch ohne Begründung ist kein Spruch.
       *
       * Er wird nicht verworfen, sondern zu „unentschieden": Dass der
       * Richter hingesehen und nichts Tragfähiges gefunden hat, ist
       * das Ergebnis — nur eben keines, das etwas kippt.
       */
      const begruendet = s.begruendung?.trim().length > 0;
      sprueche.push({
        aussage: wortlaut,
        entscheidung: begruendet ? s.entscheidung : "unentschieden",
        begruendung: s.begruendung?.trim() ?? "",
      });
    }

    return { sprueche, befangen: gewaehlt.befangen, ausgefallen: false, grund: null,
      dauerMs: Date.now() - beginn };
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    /*
     * Scheitert der Richter, bleibt strittig strittig.
     *
     * Der naheliegende Griff wäre, dann nach Mehrheit zu entscheiden
     * — und genau das ist der Fehler, den zwei Runden lang vermieden
     * wurde. Ein Ausfall ist ein Ausfall.
     */
    return { sprueche: [], befangen: gewaehlt.befangen, ausgefallen: true,
      grund: text.slice(0, 300), dauerMs: Date.now() - beginn };
  }
}

/**
 * Den Spruch auf das Lagebild anwenden.
 *
 * `haltbar` macht aus einer unbelegten Aussage `gestuetzt` und nur
 * aus einer belegten `gesichert`. Der Richter kann eine Behauptung
 * retten; einen fehlenden Beleg ersetzen kann er nicht.
 */
export function spruchAnwenden(bild: Lagebild, ergebnis: Richterergebnis): Lagebild {
  if (ergebnis.sprueche.length === 0) return bild;
  const nach = new Map(ergebnis.sprueche.map((s) => [s.aussage.toLowerCase().trim(), s]));

  const staende: Aussagenstand[] = bild.staende.map((s) => {
    if (s.stand !== "strittig") return s;
    const spruch = nach.get(s.aussage.toLowerCase().trim());
    if (!spruch || spruch.entscheidung === "unentschieden") return s;
    return {
      ...s,
      stand: spruch.entscheidung === "nicht_haltbar" ? "verworfen" : s.belegt ? "gesichert" : "gestuetzt",
    };
  });

  return { ...bild, staende, strittig: staende.filter((s) => s.stand === "strittig") };
}
