import type { Gruppenergebnis, Kriterienstatus } from "./suchkriterien.ts";

/**
 * Darf diese Stelle empfohlen werden?
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Fragen, die gern eine werden
 * ══════════════════════════════════════════════════════════════
 *
 *   Zulässigkeit   Verletzt die Stelle eine Muss-Bedingung?
 *   Empfehlung     Ist sie gut genug, um jemanden dafür zu wecken?
 *
 * Die erste ist eine Ausschlussfrage und kennt kein „ein bisschen".
 * Die zweite ist eine Produktentscheidung mit einer Schwelle.
 *
 * Sie zu vermischen wäre der Fehler, den der Auftrag ausdrücklich
 * verbietet: Ein hoher Teilscore hebt keine Ausschlussbedingung auf.
 * Wer 92 Punkte hat und die geforderte Fahrerlaubnis nicht, kann die
 * Stelle nicht annehmen.
 */

export type Zulaessigkeit = "eligible" | "ineligible" | "needs_clarification";

export interface Zulaessigkeitsbefund {
  zulaessigkeit: Zulaessigkeit;
  /** Maschinenlesbar, damit die Oberfläche nicht Text parsen muss. */
  gruende: string[];
  /** Welche Muss-Bedingungen offen sind — das sind die Rückfragen. */
  offeneMuss: string[];
  /** Welche Muss-Bedingungen verletzt sind. */
  verletzteMuss: string[];
}

/**
 * Nur Muss-Gruppen entscheiden.
 *
 * ── Warum `teilweise` bei einem Muss nicht durchgeht ──────────
 *
 * „Die Spanne reicht von 40.000 bis 55.000, deine Grenze liegt darin"
 * ist bei einem Wunsch eine gute Nachricht. Bei einem Muss ist es eine
 * offene Frage — und offen heisst hier: nachfragen, nicht empfehlen.
 */
export function zulaessigkeitBestimmen(gruppen: Gruppenergebnis[]): Zulaessigkeitsbefund {
  const muss = gruppen.filter((g) => g.staerke === "muss");

  const verletzt = muss.filter((g) => g.status === "nicht_erfuellt");
  const offen = muss.filter(
    (g) => g.status === "unbekannt" || g.status === "widerspruechlich" || g.status === "teilweise",
  );

  const bezeichnen = (g: Gruppenergebnis) =>
    g.mitglieder.map((m) => m.kriterium).join(" oder ");

  if (verletzt.length > 0) {
    return {
      zulaessigkeit: "ineligible",
      gruende: verletzt.map((g) => `muss_verletzt:${bezeichnen(g)}`),
      offeneMuss: offen.map(bezeichnen),
      verletzteMuss: verletzt.map(bezeichnen),
    };
  }

  if (offen.length > 0) {
    return {
      zulaessigkeit: "needs_clarification",
      gruende: offen.map((g) => `muss_offen:${bezeichnen(g)}`),
      offeneMuss: offen.map(bezeichnen),
      verletzteMuss: [],
    };
  }

  return { zulaessigkeit: "eligible", gruende: [], offeneMuss: [], verletzteMuss: [] };
}

export type Empfehlungsstatus = "empfohlen" | "zurueckgestellt" | "ausgeschlossen";

export interface Empfehlungsbefund {
  status: Empfehlungsstatus;
  gruende: string[];
}

export interface Empfehlungsregeln {
  /**
   * Ab wie vielen Punkten empfohlen wird.
   *
   * Eine Produktentscheidung, keine gemessene Erfolgswahrscheinlichkeit.
   * 70 von 100 heisst nicht „70 Prozent Chance" — es heisst, dass wir
   * diese Grenze gewählt haben und sie ändern können.
   */
  schwelle: number;
  /** Wie viel des Fits belegt sein muss, damit die Zahl etwas aussagt. */
  mindestAbdeckung: number;
}

export const EMPFEHLUNG_V1: Empfehlungsregeln = { schwelle: 70, mindestAbdeckung: 0.55 };

export interface Empfehlungseingabe {
  zulaessigkeit: Zulaessigkeit;
  /** `null`, wenn das Profil zu dünn für eine Zahl ist. */
  fitScore: number | null;
  fitAbdeckung: number | null;
  /**
   * Was aus der allgemeinen Jobanalyse gegen eine Empfehlung spricht —
   * etwa ein Betrugsverdacht.
   *
   * Eine unbekannte Jobqualität steht hier NICHT. Unbekannt ist kein
   * Einwand, und sie durch einen Ersatzwert zu ergänzen hiesse, eine
   * Zahl zu erfinden, damit die Liste voller wird.
   */
  blockierendeHinweise: string[];
  /** Ob die Anzeige noch offen ist. */
  veraltet: boolean;
}

export function empfehlungBestimmen(
  e: Empfehlungseingabe,
  regeln: Empfehlungsregeln = EMPFEHLUNG_V1,
): Empfehlungsbefund {
  if (e.zulaessigkeit === "ineligible")
    return { status: "ausgeschlossen", gruende: ["muss_verletzt"] };

  if (e.veraltet) return { status: "ausgeschlossen", gruende: ["anzeige_veraltet"] };

  if (e.blockierendeHinweise.length > 0)
    return { status: "ausgeschlossen", gruende: e.blockierendeHinweise.map((h) => `hinweis:${h}`) };

  if (e.zulaessigkeit === "needs_clarification")
    return { status: "zurueckgestellt", gruende: ["muss_offen"] };

  /*
   * Ohne Zahl keine Empfehlung — aber auch kein Ausschluss.
   *
   * Ein zu dünnes Profil ist kein Mangel der Stelle. Sie bleibt im
   * Bestand, taucht in „Noch zu klären" auf, und sobald das Profil
   * trägt, wird sie neu bewertet.
   */
  if (e.fitScore === null) return { status: "zurueckgestellt", gruende: ["profil_zu_duenn"] };

  if (e.fitAbdeckung !== null && e.fitAbdeckung < regeln.mindestAbdeckung)
    return { status: "zurueckgestellt", gruende: ["abdeckung_zu_gering"] };

  if (e.fitScore < regeln.schwelle)
    return { status: "zurueckgestellt", gruende: [`unter_schwelle:${regeln.schwelle}`] };

  return { status: "empfohlen", gruende: [] };
}

/**
 * Die Zusammenfassung eines Kriterienstatus für Menschen.
 *
 * Steht hier und nicht in der Oberfläche, damit Mail, Chat und Karte
 * dieselben Wörter benutzen. Zwei Formulierungen für denselben Zustand
 * lesen sich wie zwei verschiedene Aussagen.
 */
export const STATUS_WORT: Record<Kriterienstatus, string> = {
  erfuellt: "erfüllt",
  teilweise: "teilweise erfüllt",
  nicht_erfuellt: "nicht erfüllt",
  unbekannt: "steht nicht in der Anzeige",
  widerspruechlich: "widersprüchlich",
};
