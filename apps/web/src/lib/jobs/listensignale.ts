import type { ScoredJob } from "@/lib/matching";

/**
 * Zwei kurze Signale für eine Zeile in der Liste.
 *
 * Vorher standen dort Ninas ganze Sätze, auf eine Zeile gekürzt:
 *
 *   „Deine belegte Erfahrung im Kundenkontakt deckt die genannten …"
 *   „Die Anzeige nennt keine Angabe zum Gehalt, und ohne diese …"
 *
 * Beide brachen mitten im Wort ab. Für eine Liste, die man überfliegt,
 * ist das die schlechteste aller Formen: zu lang zum Erfassen, zu kurz
 * zum Verstehen, und der abgeschnittene Rest sieht aus wie ein Fehler.
 *
 * Hier entstehen stattdessen Etiketten — zwei, drei Wörter, vollständig
 * lesbar:
 *
 *   Starker Aufgaben-Fit
 *   Gehalt nicht angegeben
 *
 * Sie werden ABGELEITET, nicht gekürzt. Jedes Signal hat eine Bedingung,
 * die im Datensatz nachprüfbar ist; keines ist eine Zusammenfassung von
 * Ninas Prosa. Der ganze Satz steht rechts im Detail, wo Platz dafür
 * ist.
 *
 * Höchstens zwei, und die Reihenfolge ist nicht beliebig: was jemanden
 * von einer Bewerbung abhält, steht vor dem, was dafür spricht. Wer eine
 * Liste überfliegt, sucht zuerst nach Gründen auszuschliessen.
 */

export interface Listensignal {
  text: string;
  art: "gut" | "achtung" | "neutral";
}

/** Die Achsen, die als „Aufgaben-Fit" gelten. */
const AUFGABEN_ACHSEN = new Set(["provenSkills", "preferredTasks"]);

export function listensignale(j: ScoredJob): Listensignal[] {
  const achtung: Listensignal[] = [];
  const gut: Listensignal[] = [];

  // ── Was abhält ────────────────────────────────────────────
  if (j.constraints.overall === "blocked") {
    // Der Grund steht als eigene Auszeichnung an der Zeile; hier genügt
    // die Tatsache.
    achtung.push({ text: "Harte Bedingung verletzt", art: "achtung" });
  }

  /*
   * Das Gehalt steht nicht mehr als Marke hier.
   *
   * Es hat in der Karte eine eigene Zeile — „Hamburg · Vor Ort ·
   * Werkstudium · Gehalt nicht angegeben". Als Marke darunter stand
   * derselbe Satz ein zweites Mal, und daneben oft noch „Dünne
   * Datenlage": drei Zeilen Warnung für eine Stelle, die vielleicht
   * passt.
   *
   * Eine Aussage, die zweimal untereinander steht, wirkt nicht doppelt
   * so wichtig. Sie wirkt wie ein Fehler.
   */

  if (j.listingConfidence.possiblyStale) {
    achtung.push({ text: "Anzeige womöglich veraltet", art: "achtung" });
  }

  /*
   * „Dünne Datenlage" stand hier — und zwar bei JEDER Stelle.
   *
   * Gemessen am 01.09.2026: 25 von 25 sichtbaren Karten trugen dieses
   * Signal, alle dasselbe. Ein Hinweis, der bei jeder Zeile steht,
   * unterscheidet keine Zeile von einer anderen; er wird zur Textur und
   * liest sich dabei wie ein Vorwurf gegen jede einzelne Anzeige.
   *
   * Die Ursache lag nicht bei den Anzeigen. `computeConfidence` mischt
   * `profile_coverage` (Gewicht 0,35 — eine Eigenschaft des NUTZERS)
   * mit `listing_completeness` (0,30 — eine Eigenschaft der STELLE).
   * Bei leerem Profil fällt die Sicherheit für jede Stelle unter die
   * Schwelle, ganz gleich wie vollständig die Anzeige ist.
   *
   * Die Karte meldete damit das leere Profil, als wäre es ein Mangel
   * der Anzeige. Dass das Profil noch fehlt, steht bereits einmal oben
   * auf der Seite — an der richtigen Stelle, in der richtigen
   * Zuordnung, und dort genügt es.
   *
   * Was die Anzeige selbst betrifft, steht weiterhin hier: eine
   * verletzte Bedingung, ein womöglich veralteter Eintrag. Das sind
   * Aussagen über DIESE Stelle.
   */

  // ── Was dafür spricht ─────────────────────────────────────
  const stärkste = [...j.fit.factors]
    .filter((f) => f.raw !== null)
    .sort((a, b) => (b.raw ?? 0) - (a.raw ?? 0))[0];

  if (stärkste && (stärkste.raw ?? 0) >= 0.7) {
    gut.push({
      text: AUFGABEN_ACHSEN.has(stärkste.key)
        ? "Starker Aufgaben-Fit"
        : `Starke Passung: ${stärkste.label}`,
      art: "gut",
    });
  }

  if (j.job.workModel === "remote") {
    gut.push({ text: "Vollständig remote", art: "gut" });
  }

  /*
   * Höchstens zwei — aber nie zwei desselben Vorzeichens.
   *
   * Ursprünglich waren es bis zu zwei beliebige, und in der Praxis
   * standen fast immer zwei Warnungen da: „Gehalt nicht angegeben"
   * und „Dünne Datenlage", untereinander, bei fast jeder Stelle. Was
   * bei jeder Zeile steht, unterscheidet keine Zeile von einer
   * anderen — es wird zur Textur. Deshalb wurde daraus genau eines.
   *
   * Eines ist aber zu wenig, sobald die Zeile Platz hat: Eine Stelle,
   * die vollständig remote ist UND deren Gehalt fehlt, sagt mit nur
   * einem Signal die halbe Wahrheit — und welche Hälfte, entscheidet
   * eine Reihenfolge im Code.
   *
   * Jetzt höchstens eines je Art. Das schliesst den alten Fehler aus
   * (zwei Warnungen untereinander sind unmöglich) und gibt trotzdem
   * beide Seiten: was dagegen spricht und was dafür.
   */
  const signale = [achtung[0], gut[0]].filter(
    (s): s is NonNullable<typeof s> => s !== undefined,
  );
  return signale;
}
