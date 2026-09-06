import type { Zusagenherkunft, Zusagepunkt } from "./zusagen.ts";
import { HERKUNFTSGEWICHT, PUNKTTEXT } from "./zusagen.ts";

/**
 * Der vierte Kasten: widersprüchlich.
 *
 * ── Warum er der wertvollste ist ──────────────────────────────
 *
 * „Passt" und „passt nicht" kann jede Plattform. „Ungeklärt" können
 * wenige. Widersprüchlich kann keine — weil es zwei Quellen braucht,
 * die gegeneinander gehalten werden.
 *
 * Der Fall, um den es geht: In der Anzeige steht Homeoffice. Im
 * Gespräch heisst es, das gehe erst nach der Probezeit und hänge vom
 * Vorgesetzten ab. Beides steht irgendwo, beides klingt für sich
 * plausibel — und der Widerspruch fällt erst im vierten Monat auf.
 *
 * ── Warum keine Textanalyse ───────────────────────────────────
 *
 * Ein Sprachmodell über Vertrag und Gesprächsnotiz laufen zu lassen
 * fände mehr Widersprüche und wäre nicht überprüfbar. Hier steht, was
 * der Mensch selbst als Zusage festgehalten hat — mit Herkunft und
 * Fundstelle. Zwei Einträge zum selben Punkt aus verschiedenen Quellen
 * sind ein Widerspruch, den man nachlesen kann.
 */

export interface Zusagenangabe {
  punkt: Zusagepunkt;
  zusage: string;
  herkunft: Zusagenherkunft;
  beleg: string;
}

export interface Widerspruch {
  punkt: Zusagepunkt;
  titel: string;
  /** Die belastbarere Aussage — sie steht vorn. */
  staerker: Zusagenangabe;
  schwaecher: Zusagenangabe;
  /** In ganzen Sätzen, so wie es in der Oberfläche steht. */
  erklaerung: string;
}

/** Wortpaare, die sich ausschliessen. */
const GEGENSAETZE: [RegExp, RegExp][] = [
  [/\bab\s+tag\s*(?:eins|1)\b|sofort|von anfang an/i, /nach der probezeit|ab dem (?:zweiten|dritten)|erst (?:nach|ab)/i],
  [/unbefristet/i, /befristet/i],
  [/\bkeine? [üu]berstunden|selten [üu]berstunden/i, /[üu]berstunden (?:sind|werden|geh[öo]ren)|regelm[äa][sß]ig mehr/i],
  [/\bkein(?:e)? (?:schicht|wochenend|reise)/i, /schicht|wochenend|reise/i],
  [/fest zugesagt|garantiert|schriftlich/i, /nach absprache|abh[äa]ngig von|wenn es passt|in aussicht/i],
];

/** Eine Zahl aus dem Text — „zwei Tage", „2 Tage", „60 %". */
function zahlen(text: string): number[] {
  const woerter: Record<string, number> = {
    null: 0, ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
  };
  const raus: number[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) raus.push(Number(m[0]!.replace(",", ".")));
  for (const [w, n] of Object.entries(woerter)) {
    if (new RegExp(`\\b${w}\\b`, "i").test(text)) raus.push(n);
  }
  return raus;
}

/**
 * Widersprüche zwischen zwei Aussagen zum selben Punkt.
 *
 * Drei Wege, einen zu erkennen — vom sichersten zum weichsten:
 *
 *   1. Ein Gegensatzpaar: „ab Tag eins" gegen „nach der Probezeit".
 *   2. Verschiedene Zahlen: „zwei Tage" gegen „ein Tag".
 *   3. Nichts davon → kein Widerspruch. Zwei Formulierungen desselben
 *      Inhalts sind keiner, und ihn zu behaupten wäre schlimmer als
 *      ihn zu übersehen.
 */
function widersprechen(a: string, b: string): boolean {
  for (const [x, y] of GEGENSAETZE) {
    if ((x.test(a) && y.test(b)) || (y.test(a) && x.test(b))) return true;
  }
  const za = zahlen(a);
  const zb = zahlen(b);
  if (za.length > 0 && zb.length > 0) {
    /* Nur wenn KEINE Zahl übereinstimmt — „2 Tage, 60 %" gegen
       „2 Tage" ist kein Widerspruch. */
    return !za.some((n) => zb.includes(n));
  }
  return false;
}

/**
 * Alle Widersprüche in den festgehaltenen Zusagen.
 *
 * Nur zwischen VERSCHIEDENEN Herkünften: Zwei Notizen aus demselben
 * Gespräch, die unterschiedlich klingen, sind meistens zwei
 * Formulierungen — kein Widerspruch zwischen Anzeige und Zusage.
 */
export function widersprueche(angaben: readonly Zusagenangabe[]): Widerspruch[] {
  const nachPunkt = new Map<Zusagepunkt, Zusagenangabe[]>();
  for (const a of angaben) {
    nachPunkt.set(a.punkt, [...(nachPunkt.get(a.punkt) ?? []), a]);
  }

  const raus: Widerspruch[] = [];
  for (const [punkt, liste] of nachPunkt) {
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const a = liste[i]!;
        const b = liste[j]!;
        if (a.herkunft === b.herkunft) continue;
        if (!widersprechen(a.zusage, b.zusage)) continue;

        const [staerker, schwaecher] =
          HERKUNFTSGEWICHT[a.herkunft] >= HERKUNFTSGEWICHT[b.herkunft] ? [a, b] : [b, a];

        raus.push({
          punkt,
          titel: PUNKTTEXT[punkt].titel,
          staerker,
          schwaecher,
          erklaerung:
            `Zu „${PUNKTTEXT[punkt].titel}" liegen zwei verschiedene Aussagen vor: ` +
            `„${schwaecher.zusage}" (${quelle(schwaecher.herkunft)}) und ` +
            `„${staerker.zusage}" (${quelle(staerker.herkunft)}). ` +
            `Kläre vor der Unterschrift, welche gilt.`,
        });
      }
    }
  }
  return raus;
}

function quelle(h: Zusagenherkunft): string {
  return h === "anzeige"
    ? "stand in der Anzeige"
    : h === "gespraech"
      ? "im Gespräch gesagt"
      : h === "vertrag"
        ? "steht im Vertrag"
        : "auf Nachfrage bestätigt";
}
