import type { Job } from "@paycheck/domain";

/**
 * Was in dieser Anzeige nicht steht — und was man deshalb fragen sollte.
 *
 * ── Warum eine Lücke keine Kritik ist ─────────────────────────
 *
 * Eine Stellenanzeige ohne Urlaubsangabe ist keine schlechte Anzeige.
 * Sie ist eine Anzeige, in der etwas fehlt, das für eine Entscheidung
 * zählt — und der Unterschied ist wichtig genug, um ihn im Ton
 * durchzuhalten.
 *
 * Deshalb steht hier kein Qualitätsurteil über den Arbeitgeber,
 * sondern eine Frage, die man im Gespräch stellen kann. Aus „fehlt:
 * Homeoffice-Regel" wird „Wie viele Tage pro Woche ist Homeoffice
 * tatsächlich möglich?" — dasselbe Wissen, aber handlungsfähig.
 *
 * ── Warum kein Sprachmodell ───────────────────────────────────
 *
 * Ob ein Feld gefüllt ist, ist eine Tatsache und keine Einschätzung.
 * Ein Modell würde hier gelegentlich Fragen erfinden, die die Anzeige
 * längst beantwortet — und nichts untergräbt Vertrauen schneller als
 * eine Frage nach etwas, das zwei Absätze weiter oben steht.
 */

export type Luecke =
  | "gehalt"
  | "arbeitsmodell"
  | "arbeitszeit"
  | "vertragsart"
  | "aufgaben"
  | "anforderungen";

export interface Luckenbefund {
  luecke: Luecke;
  /** Was fehlt, in einem Wort. Für die Liste. */
  label: string;
  /** Die Frage fürs Gespräch. */
  frage: string;
  /**
   * Wie sehr das eine Entscheidung blockiert.
   *
   * „hoch" heisst: Ohne diese Angabe lässt sich nicht beurteilen, ob
   * die Stelle passt. Nicht: Die Anzeige ist schlecht.
   */
  gewicht: "hoch" | "mittel";
}

export interface Anzeigenqualitaet {
  luecken: Luckenbefund[];
  /** Wie viele der geprüften Angaben vorhanden sind. */
  vollstaendigkeit: { von: number; moeglich: number };
  /**
   * Ein Wort für die Übersicht — keine Zahl.
   *
   * Eine Prozentzahl über eine Stellenanzeige lädt zum Vergleichen ein
   * („73 % gegen 68 %"), und dafür ist die Grundlage zu dünn: Sieben
   * geprüfte Felder ergeben keine Rangfolge zwischen Arbeitgebern.
   */
  einordnung: "gut" | "mittel" | "dünn";
}

const PRUEFUNGEN: {
  luecke: Luecke;
  label: string;
  frage: string;
  gewicht: "hoch" | "mittel";
  fehlt: (j: Job, anforderungen: number) => boolean;
}[] = [
  {
    luecke: "gehalt",
    label: "Gehalt",
    frage: "Welche Gehaltsspanne ist für die Stelle vorgesehen?",
    gewicht: "hoch",
    fehlt: (j) => j.salary.min === null && j.salary.max === null,
  },
  {
    luecke: "arbeitsmodell",
    label: "Arbeitsmodell",
    frage: "Ist die Stelle vor Ort, hybrid oder remote?",
    gewicht: "hoch",
    fehlt: (j) => !j.workModel,
  },
  /*
   * Bürotage werden hier NICHT geprüft — es gibt kein Feld dafür.
   *
   * Das ist selbst ein Befund: Bei einer Hybridstelle ist die Zahl der
   * Bürotage die wichtigste einzelne Angabe, denn sie entscheidet über
   * Pendelzeit und -kosten. Unser Datenmodell kennt sie nicht, also
   * können wir weder danach fragen noch damit rechnen.
   *
   * Eine Prüfung wäre hier eine Lüge: Sie fände bei jeder Hybridstelle
   * dieselbe Lücke, unabhängig davon, was in der Anzeige steht.
   */
  {
    luecke: "arbeitszeit",
    label: "Arbeitszeit",
    frage: "Wie viele Wochenstunden umfasst die Stelle, und wie wird mit Überstunden umgegangen?",
    gewicht: "mittel",
    fehlt: (j) => (j.weeklyHours ?? null) === null,
  },
  {
    luecke: "vertragsart",
    label: "Vertragsart",
    frage: "Ist die Stelle unbefristet?",
    gewicht: "mittel",
    fehlt: (j) => !j.contractType,
  },
  {
    luecke: "aufgaben",
    label: "Aufgaben",
    frage: "Wie sieht ein typischer Arbeitstag in dieser Rolle aus?",
    gewicht: "hoch",
    fehlt: (j) => (j.coreTasks ?? []).length === 0,
  },
  {
    luecke: "anforderungen",
    label: "Anforderungen",
    frage: "Welche Kenntnisse sind wirklich Voraussetzung, und welche wären nur wünschenswert?",
    gewicht: "mittel",
    fehlt: (_j, anforderungen) => anforderungen === 0,
  },
];

/**
 * Die Lücken einer Anzeige, nach Gewicht sortiert.
 *
 * Höchstens fünf Fragen: Wer mit zehn ins Gespräch geht, stellt keine.
 */
export function anzeigenqualitaet(
  job: Job,
  /*
   * Die Zahl der Anforderungen kommt von aussen.
   *
   * Sie liegt in einer eigenen Tabelle und nicht am Job-Objekt. Sie
   * hier nachzuladen hiesse, eine reine Funktion an die Datenbank zu
   * binden — und damit wäre sie nicht mehr ohne sie prüfbar.
   */
  anforderungen = 0,
  hoechstens = 5,
): Anzeigenqualitaet {
  const anwendbar = PRUEFUNGEN;
  const offen = anwendbar.filter((p) => p.fehlt(job, anforderungen));
  const sortiert = [...offen].sort((a, b) =>
    a.gewicht === b.gewicht ? 0 : a.gewicht === "hoch" ? -1 : 1,
  );

  const vorhanden = anwendbar.length - offen.length;
  const anteil = anwendbar.length === 0 ? 1 : vorhanden / anwendbar.length;

  return {
    luecken: sortiert.slice(0, hoechstens).map(({ luecke, label, frage, gewicht }) => ({
      luecke,
      label,
      frage,
      gewicht,
    })),
    vollstaendigkeit: { von: vorhanden, moeglich: anwendbar.length },
    einordnung: anteil >= 0.8 ? "gut" : anteil >= 0.5 ? "mittel" : "dünn",
  };
}
