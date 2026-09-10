/**
 * ══════════════════════════════════════════════════════════════════
 * Was aus welcher Belegart werden darf
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Der Fehler, den diese Datei behebt ──────────────────────────
 *
 * `belegeVerdichten` schickte jeden bestätigten Beleg durch die
 * Fähigkeitsprüfung und zählte alles, was nicht durchkam, als
 * `ohneKatalogeintrag`. Gemessen am 11.09.2026: 142 Belege, 28
 * verwertbar, 107 „ohne Eintrag" — der Lauf meldete damit 20 Prozent
 * und sah kaputt aus.
 *
 * Er war es nicht. Von den 142 beschreiben 29 überhaupt eine
 * Fähigkeit oder Qualifikation, und davon kamen 28 durch — 97 Prozent.
 * Die anderen 113 sind Vorlieben, Motive, Arbeitsumgebung,
 * Rollenbezeichnungen und Probenergebnisse. Dass daraus keine
 * Fähigkeit wird, ist keine Panne, sondern die Regel.
 *
 * Eine falsche Fehlerzahl ist teurer als gar keine: Sie schickt
 * jemanden los, etwas zu reparieren, das funktioniert.
 *
 * ── Warum die Regel hier steht und nicht im Lauf ────────────────
 *
 * Weil sie fachlich ist, nicht technisch. „Aus einer Rollenbezeichnung
 * folgen nicht die Fähigkeiten dieses Berufs" ist eine Aussage über
 * Menschen, nicht über Code — und sie muss auch dann gelten, wenn
 * jemand einen zweiten Verdichtungslauf schreibt.
 */

import type { EvidenceNodeType } from "./evidence.ts";

/** Wohin eine Belegart gehört. */
export const VERWERTUNGSWEGE = [
  /** Trägt unmittelbar eine strukturierte Fähigkeit. */
  "faehigkeit",
  /** Trägt eine formale Qualifikation — nicht alles, was daran hängt. */
  "qualifikation",
  /** Nur, wenn der eigene Beitrag erkennbar ist. */
  "nur_mit_beitrag",
  /** Ausgangspunkt für eine spätere Extraktion, selbst kein Beleg. */
  "quelle_fuer_extraktion",
  /** Erfahrungskontext. Nie automatisch eine Fähigkeit. */
  "kontext",
  /** Gehört in den Wunsch-Abgleich. */
  "wunsch",
  /** Gehört in den Abgleich der Arbeitsbedingungen. */
  "arbeitsbedingung",
] as const;
export type Verwertungsweg = (typeof VERWERTUNGSWEGE)[number];

/**
 * Die Zuordnung.
 *
 * Vollständig über `EvidenceNodeType` — eine neue Art fällt beim
 * Typcheck auf und nicht erst im Lauf.
 */
export const VERWERTUNG: Record<EvidenceNodeType, Verwertungsweg> = {
  skill: "faehigkeit",
  knowledge: "faehigkeit",
  tool: "faehigkeit",
  qualification: "qualifikation",
  result: "nur_mit_beitrag",
  action: "nur_mit_beitrag",
  experience_episode: "quelle_fuer_extraktion",
  role: "kontext",
  occupation: "kontext",
  evidence_source: "kontext",
  preference: "wunsch",
  motive: "wunsch",
  work_environment: "arbeitsbedingung",
  constraint: "arbeitsbedingung",
};

/** Ob aus dieser Art überhaupt eine Fähigkeitsaussage entstehen darf. */
export function darfSkillTragen(art: EvidenceNodeType): boolean {
  const weg = VERWERTUNG[art];
  return weg === "faehigkeit" || weg === "qualifikation" || weg === "nur_mit_beitrag";
}

/**
 * Warum eine Art nicht durch die Fähigkeitsprüfung geht.
 *
 * In der Sprache, in der es im Bericht steht — nicht „gefiltert",
 * sondern was stattdessen mit der Angabe passiert. Eine Vorliebe ist
 * nicht wertlos; sie gehört woandershin.
 */
export const VERWERTUNGSSATZ: Record<Verwertungsweg, string> = {
  faehigkeit: "trägt eine Fähigkeit",
  qualifikation: "trägt eine formale Qualifikation — nicht alles, was üblicherweise daran hängt",
  nur_mit_beitrag: "trägt eine Fähigkeit nur, wenn der eigene Beitrag erkennbar ist",
  quelle_fuer_extraktion: "ist ein Ausgangspunkt für eine spätere Nachfrage, kein Beleg für sich",
  kontext: "beschreibt Erfahrungskontext — daraus folgen nicht die Fähigkeiten des Berufs",
  wunsch: "gehört in den Abgleich der Wünsche",
  arbeitsbedingung: "gehört in den Abgleich der Arbeitsbedingungen",
};

/**
 * Ob in einem Ergebnissatz der eigene Beitrag erkennbar ist.
 *
 * ── Warum das eine Bedingung ist ────────────────────────────────
 *
 * „Der Bereich hat die Durchlaufzeit halbiert" sagt nichts darüber,
 * wer das getan hat. Eine Teamleistung einer Person zuzurechnen ist
 * der häufigste Fehler in jedem Portfolio — und der teuerste, weil er
 * erst im Gespräch auffliegt.
 *
 * Gesucht wird deshalb die erste Person oder eine ausdrückliche
 * Zuschreibung. Fehlt sie, bleibt das Ergebnis stehen; es trägt nur
 * keine Fähigkeit.
 */
export function eigenerBeitragErkennbar(satz: string): boolean {
  const t = ` ${satz.toLowerCase()} `;
  const ich = [
    " ich ",
    " meine aufgabe",
    " mein anteil",
    " ich habe",
    " von mir ",
    " selbst ",
    " eigenständig",
    " eigenverantwortlich",
    " verantwortete",
    " verantwortlich für",
  ];
  if (ich.some((m) => t.includes(m))) return true;

  /*
   * Wir-Formen schliessen aus. Sie sind das Gegenteil eines Belegs
   * für den eigenen Anteil — und sie stehen oft genau dort, wo jemand
   * sich eine Teamleistung ausleiht.
   */
  const wir = [" wir ", " unser team", " das team ", " gemeinsam "];
  return !wir.some((m) => t.includes(m)) && / (habe|hatte|führte|leitete|baute|erstellte)\b/.test(t);
}

export interface Kategoriezaehlung {
  art: EvidenceNodeType;
  weg: Verwertungsweg;
  gesamt: number;
  /** In eine Fähigkeit oder Qualifikation überführt. */
  uebernommen: number;
  /** Bewusst nicht überführt — die Art trägt keine Fähigkeit. */
  bewusstNicht: number;
  /** Durfte, ging aber nicht: kein Katalogeintrag, kein eigener Beitrag. */
  nichtZugeordnet: number;
}

/**
 * Die Fehlerquote — und zwar über dem richtigen Nenner.
 *
 * Gezählt wird nur, was überhaupt eine Fähigkeit tragen durfte. Wer
 * die bewusst nicht überführten mitzählt, misst die Zusammensetzung
 * seines Bestands und nennt sie Fehlerquote.
 */
export function fehlerquote(zaehlungen: readonly Kategoriezaehlung[]): {
  nenner: number;
  uebernommen: number;
  quote: number | null;
} {
  const nenner = zaehlungen.reduce((a, z) => a + z.uebernommen + z.nichtZugeordnet, 0);
  const uebernommen = zaehlungen.reduce((a, z) => a + z.uebernommen, 0);
  return { nenner, uebernommen, quote: nenner === 0 ? null : uebernommen / nenner };
}

/**
 * Ob ein Beleg aus einer Orientierungsprobe stammt.
 *
 * ── Warum das eine eigene Frage ist ─────────────────────────────
 *
 * `aufgabenproben` ist ein Breitensampler: 34 Aufgaben, je eine pro
 * KldB-Hauptgruppe, sechzig Sekunden, Mehrfachauswahl. Das Schema
 * trennt `richtig` und `energie` genau deshalb — die Probe sagt,
 * welches Feld sich für jemanden richtig anfühlt, nicht welche
 * Fähigkeit er hat.
 *
 * Ihr Ergebnis als Fähigkeitsbeleg zu behandeln wäre derselbe
 * Kategorienfehler wie bei einer Vorliebe, nur eine Ebene tiefer: Es
 * dürfte antreten, könnte aber nie durchkommen — und stünde deshalb
 * dauerhaft als Fehlschlag in der Bilanz.
 *
 * Gemessen am 11.09.2026: 19 solche Ergebnisse, aus genau zwei
 * verschiedenen Proben.
 */
export function istOrientierungsprobe(sourceRef: string | null): boolean {
  return (sourceRef ?? "").startsWith("probe:");
}
