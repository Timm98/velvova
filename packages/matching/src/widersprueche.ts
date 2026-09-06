import { erkenntnisart, staerkerer, wirksameKonfidenz, type Beleg } from "./erkenntnis.ts";

/**
 * Wenn das Gesagte und das Getane auseinandergehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT passieren darf
 * ══════════════════════════════════════════════════════════════
 *
 * Jemand sagt „ich möchte wenig Stress" und speichert acht
 * Vertriebsleitungen. Die bequeme Deutung: Er will Stress und weiss
 * es nur nicht.
 *
 * Das ist eine Anmassung. Vielleicht zahlen diese Stellen gut.
 * Vielleicht ist der Titel irreführend. Vielleicht hat er sie
 * angesehen, weil er wissen wollte, was er NICHT will. Vielleicht
 * hat er sich verklickt.
 *
 * Ein Widerspruch ist eine Beobachtung über zwei Angaben, nicht über
 * einen Menschen. Er wird benannt und der Person zur Auflösung
 * vorgelegt — nicht aufgelöst.
 *
 * ══════════════════════════════════════════════════════════════
 * Und was er nie tun darf
 * ══════════════════════════════════════════════════════════════
 *
 * Die ausgesprochene Angabe stillschweigend ersetzen. Wer „wenig
 * Stress" durch Verhaltensdaten überschreibt, hat aus einer
 * Beobachtung eine Entscheidung gemacht — und zwar über den Kopf der
 * Person hinweg.
 */

export interface Widerspruchsbeleg extends Beleg {
  id: string;
  text: string;
}

export interface Widerspruch {
  /** Was die Person gesagt hat. */
  gesagt: Widerspruchsbeleg;
  /** Was dem entgegensteht. */
  entgegen: Widerspruchsbeleg[];
  /** Wie stark der Widerspruch ist, 0 bis 1. */
  staerke: number;
  /** Die Frage an die Person — sie löst ihn auf, nicht wir. */
  frage: string;
  /** Was gilt, solange sie nicht geantwortet hat. */
  gilt: "gesagt" | "offen";
}

/**
 * Die Gegensatzpaare, auf die geprüft wird.
 *
 * ── Warum eine feste Liste ────────────────────────────────────
 *
 * Weil ein Modell, das Widersprüche „erkennt", auch welche findet,
 * wo keine sind — und ein Widerspruch ist ein Vorwurf, wenn er
 * falsch ist. Diese Paare sind die, die im Beschäftigungskontext
 * tatsächlich vorkommen und tatsächlich etwas bedeuten.
 */
const GEGENSAETZE: readonly {
  name: string;
  gesagt: RegExp;
  entgegen: RegExp;
  frage: string;
}[] = [
  {
    name: "Belastung",
    gesagt: /\b(wenig stress|kein(en)? stress|ruhig|entspannt|work.?life|nicht (so )?viel druck)\b/i,
    entgegen: /\b(sales|vertrieb|account executive|director|leitung|head of|manager)\b/i,
    frage:
      "Einige Stellen, die dich interessieren, sind stark vertriebs- und leistungsorientiert — " +
      "gleichzeitig ist dir wenig Druck wichtig. Was davon wiegt für dich schwerer?",
  },
  {
    name: "Führung",
    gesagt: /\bkein(e|en|em)?\s+(führung|führungsverantwortung|team|verantwortung)\b|\bnicht führen\b/i,
    entgegen: /\b(teamleit|führungskraft|head of|leiter|leitung|manager|director)\b/i,
    frage:
      "Du hast gesagt, du willst keine Führungsverantwortung — mehrere Stellen, die du dir " +
      "angesehen hast, sind aber Leitungsrollen. Wäre Führung doch eine Option?",
  },
  {
    name: "Arbeitsort",
    gesagt: /\b(remote|homeoffice|von zuhause|ortsunabhängig)\b/i,
    entgegen: /\b(vor ort|präsenz|büro|on.?site)\b/i,
    frage:
      "Du hast Remote als wichtig genannt, dir aber vor allem Stellen vor Ort angesehen. " +
      "Ist Remote noch entscheidend, oder eher ein Wunsch?",
  },
  {
    name: "Gehalt",
    gesagt: /\b(geld ist (mir )?nicht|gehalt ist nicht so wichtig|nicht wegen dem geld)\b/i,
    entgegen: /\b(zu wenig|unterbezahlt|gehalt zu niedrig|verdienst)\b/i,
    frage:
      "Du hast gesagt, Geld sei dir nicht so wichtig — bei mehreren Stellen war das Gehalt " +
      "aber der Grund, sie wegzulegen. Wie wichtig ist es dir wirklich?",
  },
  {
    name: "Vertrieb",
    /*
     * `kein(en|e)` statt `kein`.
     *
     * „Ich möchte keinen Vertrieb machen" fiel durch die erste
     * Fassung — die kannte nur „kein vertrieb". Deutsche Beugung ist
     * der häufigste Grund, warum ein Muster lautlos nicht greift.
     */
    gesagt: /\bkein(en|e|em)?\s+(vertrieb|verkauf|sales)\b|\bnicht(s)?\s+(in den vertrieb|mit (vertrieb|verkauf|verkaufen))\b/i,
    entgegen: /\b(sales|vertrieb|verkauf|account manager|business development)\b/i,
    frage:
      "Du wolltest nichts mit Vertrieb zu tun haben — mehrere gemerkte Stellen gehen aber in " +
      "diese Richtung. Hat sich das geändert?",
  },
];

/**
 * Ab wie vielen Gegenbelegen ein Widerspruch als solcher gilt.
 *
 * ── Warum drei und nicht einer ────────────────────────────────
 *
 * Ein einzelner Klick ist ein Klick. Jemand sieht sich eine
 * Vertriebsstelle an, weil der Titel neugierig machte — daraus einen
 * Widerspruch zu bauen hiesse, aus einer Sekunde eine Aussage über
 * einen Menschen zu machen.
 *
 * Drei unabhängige Gegenbelege sind schwerer zufällig. Nicht
 * unmöglich, aber schwerer — und deshalb steht am Ende eine Frage
 * und keine Feststellung.
 */
export const GEGENBELEGE_AB = 3;

export function widersprueche(belege: readonly Widerspruchsbeleg[]): Widerspruch[] {
  const raus: Widerspruch[] = [];

  for (const paar of GEGENSAETZE) {
    /*
     * Die Seite „gesagt" muss von der Person kommen. Eine Vermutung
     * gegen eine Beobachtung ist kein Widerspruch, sondern zwei
     * schwache Signale.
     */
    const gesagte = belege.filter(
      (b) =>
        paar.gesagt.test(b.text) &&
        !b.abgelehnt &&
        (erkenntnisart(b) === "preference" || erkenntnisart(b) === "fact"),
    );
    if (gesagte.length === 0) continue;

    const entgegen = belege.filter((b) => paar.entgegen.test(b.text) && !b.abgelehnt);
    if (entgegen.length < GEGENBELEGE_AB) continue;

    const gesagt = gesagte.sort((a, b) => wirksameKonfidenz(b) - wirksameKonfidenz(a))[0]!;

    /*
     * Die Stärke wächst mit der Zahl der Gegenbelege und bleibt unter
     * der Konfidenz der Aussage. Ein Widerspruch kann eine Aussage in
     * Frage stellen; er kann sie nicht widerlegen.
     */
    const staerke = Math.min(
      wirksameKonfidenz(gesagt) - 0.05,
      0.3 + entgegen.length * 0.1,
    );

    raus.push({
      gesagt,
      entgegen,
      staerke: Math.max(0, staerke),
      frage: paar.frage,
      /*
       * Bis die Person antwortet, gilt, was sie gesagt hat.
       *
       * Das ist die ganze Regel. Verhaltensdaten sind schwächere
       * Evidenz als eine Aussage — sie dürfen sie nicht ersetzen,
       * auch nicht vorübergehend, auch nicht „vorläufig".
       */
      gilt: "gesagt",
    });
  }

  return raus.sort((a, b) => b.staerke - a.staerke);
}

/**
 * Ob ein Widerspruch stark genug ist, um ihn anzusprechen.
 *
 * Ihn zu erkennen und zu schweigen wäre nutzlos. Ihn bei jedem
 * schwachen Hinweis anzusprechen wäre eine Unterstellung im
 * Wochentakt.
 */
export const ANSPRECHEN_AB = 0.55;

export function ansprechen(w: Widerspruch): boolean {
  return w.staerke >= ANSPRECHEN_AB;
}

/**
 * Was gilt, wenn eine Aussage einer Vermutung widerspricht.
 *
 * Der Fall aus dem Auftrag, Punkt G: Der Nutzer sagt etwas, das einer
 * bisherigen Inferenz widerspricht. Die Aussage gewinnt — und die
 * Vermutung wird nicht gelöscht, sondern herabgestuft.
 */
export function aussageSchlaegtVermutung(
  aussage: Widerspruchsbeleg,
  vermutung: Widerspruchsbeleg,
): { gilt: Widerspruchsbeleg; herabgestuft: Widerspruchsbeleg | null } {
  const ausgang = staerkerer(aussage, vermutung);
  if (ausgang === "a") return { gilt: aussage, herabgestuft: vermutung };
  if (ausgang === "b") return { gilt: vermutung, herabgestuft: null };
  return { gilt: aussage, herabgestuft: null };
}
