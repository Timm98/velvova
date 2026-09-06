import { ARBEITSDIMENSIONEN, type Arbeitsdimension, type Job } from "@paycheck/domain";

/**
 * Die Arbeitsdimensionen einer Stelle schätzen — und sagen, wie sicher.
 *
 * ── Warum das überhaupt geschätzt wird ────────────────────────
 *
 * Keine Anzeige schreibt „Autonomie: 0,7". Sie schreibt „eigenverant-
 * wortliches Arbeiten in einem dynamischen Umfeld", und daraus lässt
 * sich etwas ableiten — aber nicht viel, und nicht zuverlässig.
 *
 * ── Warum jede Schätzung eine Sicherheit trägt ────────────────
 *
 * Die Alternative wäre, für jede Stelle zehn Zahlen auszugeben und so
 * zu tun, als stünden sie in der Anzeige. Eine Stelle, deren Text
 * nichts über Kundenkontakt sagt, bekäme dann einen Mittelwert — und
 * der sähe aus wie eine Auskunft.
 *
 * Deshalb: keine Belegstelle, keine Zahl. `sicherheit: 0` heisst, dass
 * die Dimension gar nicht erst angezeigt wird.
 *
 * ── Warum harte Felder vor dem Text kommen ────────────────────
 *
 * `contractType`, `shiftWork`, `workModel` und `weeklyHours` sind
 * Angaben, keine Formulierungen. Wo sie etwas sagen, schlagen sie jede
 * Textstelle: „unbefristet" im Vertragsfeld ist belastbarer als
 * „langfristige Perspektive" im Fliesstext.
 */

interface Signal {
  /** Was gefunden wurde. Steht später als Beleg da. */
  muster: RegExp;
  /** Wohin es zeigt: 0 oder 1 auf der Achse. */
  richtung: 0 | 1;
  /** Wie stark dieses eine Wort trägt. */
  staerke: number;
}

const SIGNALE: Record<Arbeitsdimension, Signal[]> = {
  autonomie: [
    { muster: /eigenverantwortlich|eigenst[äa]ndig|selbstst[äa]ndig(?!e[nr]? T[äa]tigkeit als)|freiraum|gestaltungsspielraum/i, richtung: 1, staerke: 0.7 },
    { muster: /nach vorgabe|weisungsgebunden|klare vorgaben|standardisierte abl[äa]ufe/i, richtung: 0, staerke: 0.7 },
  ],
  teamarbeit: [
    { muster: /\bteam\b|teamf[äa]hig|gemeinsam|kollegial|zusammenarbeit/i, richtung: 1, staerke: 0.6 },
    { muster: /eigenst[äa]ndige einzelarbeit|allein(?:arbeit|verantwortlich)/i, richtung: 0, staerke: 0.6 },
  ],
  kundenkontakt: [
    { muster: /kundenkontakt|kundenbetreuung|beratung von kunden|verkauf|patient|gast\b|g[äa]ste|mandant/i, richtung: 1, staerke: 0.8 },
    { muster: /ohne kundenkontakt|im hintergrund|backoffice/i, richtung: 0, staerke: 0.7 },
  ],
  belastung: [
    { muster: /belastbar|stressresistent|hohem druck|hektisch|termindruck|notfall/i, richtung: 1, staerke: 0.7 },
    { muster: /ruhige[sn]? (?:arbeits)?umfeld|planbar|geregelte/i, richtung: 0, staerke: 0.6 },
  ],
  struktur: [
    { muster: /strukturiert|geregelte abl[äa]ufe|feste prozesse|checkliste|vorgegebene/i, richtung: 1, staerke: 0.6 },
    { muster: /wechselnde aufgaben|kein tag wie der andere|offene aufgabenstellung/i, richtung: 0, staerke: 0.6 },
  ],
  tempo: [
    { muster: /schnelllebig|dynamisch|hohe schlagzahl|z[üu]gig|taktzeit/i, richtung: 1, staerke: 0.6 },
    { muster: /sorgf[äa]ltig|gr[üu]ndlich|pr[äa]zise|mit ruhe/i, richtung: 0, staerke: 0.5 },
  ],
  sicherheit: [
    { muster: /unbefristet|krisensicher|sicherer arbeitsplatz|tarifvertrag|[öo]ffentlicher dienst/i, richtung: 1, staerke: 0.7 },
    { muster: /befristet|projektbezogen|start-?up|zeitarbeit/i, richtung: 0, staerke: 0.7 },
  ],
  lernen: [
    { muster: /weiterbildung|fortbildung|schulung|entwicklungsm[öo]glichkeit|lernen/i, richtung: 1, staerke: 0.6 },
    { muster: /eingearbeitete|routiniert|erfahren im/i, richtung: 0, staerke: 0.4 },
  ],
  verantwortung: [
    { muster: /f[üu]hrung|leitung|verantwortung f[üu]r|personalverantwortung|budgetverantwortung/i, richtung: 1, staerke: 0.8 },
    { muster: /unterst[üu]tzung|zuarbeit|assistenz|helfer/i, richtung: 0, staerke: 0.6 },
  ],
  wiederholung: [
    { muster: /serienfertigung|fliessband|flie(?:ss|ß)band|gleichbleibend|routinet[äa]tigkeit|nach schema/i, richtung: 1, staerke: 0.7 },
    { muster: /abwechslungsreich|vielf[äa]ltig|kein tag wie der andere/i, richtung: 0, staerke: 0.6 },
  ],
};

export interface Dimensionsschaetzung {
  dimension: Arbeitsdimension;
  wert: number;
  /** 0 bis 1. Bei 0 gibt es keine Aussage. */
  sicherheit: number;
  /** Die Textstelle, an der es erkannt wurde. */
  beleg: string;
}

/**
 * Harte Felder zuerst — sie sind Angaben, keine Formulierungen.
 *
 * Gibt `null` zurück, wo das Feld nichts sagt; dann entscheidet der
 * Text.
 */
function ausFeldern(job: Job, d: Arbeitsdimension): Dimensionsschaetzung | null {
  if (d === "sicherheit") {
    if (job.contractType === "permanent")
      return { dimension: d, wert: 0.85, sicherheit: 0.9, beleg: "unbefristeter Vertrag" };
    if (job.contractType === "fixed_term" || job.contractType === "temp_agency")
      return { dimension: d, wert: 0.2, sicherheit: 0.9, beleg: "befristet oder Zeitarbeit" };
  }
  if (d === "belastung" && job.shiftWork === true) {
    return { dimension: d, wert: 0.75, sicherheit: 0.8, beleg: "Schicht-, Nacht- oder Wochenendarbeit" };
  }
  if (d === "verantwortung") {
    if (job.experienceLevel === "lead")
      return { dimension: d, wert: 0.9, sicherheit: 0.85, beleg: "Führungsebene" };
    if (job.experienceLevel === "entry")
      return { dimension: d, wert: 0.2, sicherheit: 0.7, beleg: "Einstiegsposition" };
  }
  return null;
}

/**
 * Die Dimensionen einer Stelle.
 *
 * Nur, was belegt ist. Eine Dimension ohne Fund fehlt in der Liste —
 * sie steht nicht mit einem Mittelwert darin.
 */
export function stellenDimensionen(job: Job): Dimensionsschaetzung[] {
  const text = [job.title, job.descriptionTokens, ...job.coreTasks, ...job.benefits]
    .filter(Boolean)
    .join(" ");

  const raus: Dimensionsschaetzung[] = [];
  for (const d of ARBEITSDIMENSIONEN) {
    const hart = ausFeldern(job, d);
    if (hart) {
      raus.push(hart);
      continue;
    }
    const treffer = SIGNALE[d]
      .map((s) => ({ s, m: text.match(s.muster) }))
      .filter((x): x is { s: Signal; m: RegExpMatchArray } => x.m !== null);
    if (treffer.length === 0) continue;

    /*
     * Widersprüche schwächen, statt zu gewinnen.
     *
     * Eine Anzeige, die „strukturierte Abläufe" UND „kein Tag wie der
     * andere" verspricht, sagt über die Struktur nichts Verlässliches.
     * Der Mittelwert landet in der Mitte und die Sicherheit sinkt —
     * statt dass das zuletzt gefundene Wort entscheidet.
     */
    let summe = 0;
    let gewicht = 0;
    for (const { s } of treffer) {
      summe += s.richtung * s.staerke;
      gewicht += s.staerke;
    }
    const wert = summe / gewicht;
    const widerspruch = new Set(treffer.map((t) => t.s.richtung)).size > 1;
    raus.push({
      dimension: d,
      wert,
      sicherheit: Math.min(0.7, gewicht) * (widerspruch ? 0.4 : 1),
      beleg: treffer.map((t) => `„${t.m[0]}"`).join(", "),
    });
  }
  return raus;
}

export interface Dimensionsvergleich {
  dimension: Arbeitsdimension;
  /** Wert des Menschen und der Stelle. */
  mensch: number;
  stelle: number;
  /** 0 bis 1: wie weit sie auseinanderliegen. */
  abstand: number;
  /** Wie belastbar der Vergleich ist — das Minimum beider Seiten. */
  sicherheit: number;
  beleg: string;
}

/**
 * Mensch gegen Stelle, Achse für Achse.
 *
 * Verglichen wird nur, wo BEIDE Seiten etwas hergeben. Eine Dimension,
 * zu der die Person nichts gesagt hat, ist kein Abstand von null — sie
 * ist keine Aussage, und sie fehlt deshalb in der Liste.
 */
export function dimensionenVergleichen(
  mensch: Map<Arbeitsdimension, { wert: number; gewicht: number }>,
  stelle: Dimensionsschaetzung[],
): Dimensionsvergleich[] {
  const raus: Dimensionsvergleich[] = [];
  for (const s of stelle) {
    if (s.sicherheit <= 0) continue;
    const m = mensch.get(s.dimension);
    if (!m) continue;
    raus.push({
      dimension: s.dimension,
      mensch: m.wert,
      stelle: s.wert,
      abstand: Math.abs(m.wert - s.wert),
      sicherheit: Math.min(m.gewicht, s.sicherheit),
      beleg: s.beleg,
    });
  }
  return raus.sort((a, b) => b.abstand * b.sicherheit - a.abstand * a.sicherheit);
}

/**
 * Ein Wert für die Passung des Arbeitsalltags — oder `null`.
 *
 * `null`, wenn sich keine einzige Achse vergleichen lässt. Das ist der
 * ehrliche Normalfall bei einem frischen Profil und besser als eine
 * Zahl, die auf nichts beruht.
 */
export function alltagsPassung(vergleiche: Dimensionsvergleich[]): { wert: number; abdeckung: number } | null {
  const brauchbar = vergleiche.filter((v) => v.sicherheit > 0.2);
  if (brauchbar.length === 0) return null;
  let summe = 0;
  let gewicht = 0;
  for (const v of brauchbar) {
    summe += (1 - v.abstand) * v.sicherheit;
    gewicht += v.sicherheit;
  }
  return {
    wert: summe / gewicht,
    /* Wie viele der zehn Achsen überhaupt getragen haben. */
    abdeckung: brauchbar.length / ARBEITSDIMENSIONEN.length,
  };
}
