import type { AiTask } from "../router.ts";
import type { Modelldefinition } from "../registry/katalog.ts";
import { rangfolge, type Anforderung, type Umgebung } from "../registry/registry.ts";
import { KATALOG } from "../registry/katalog.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Wann sich ein Team lohnt — und wer darin sitzt
 * ══════════════════════════════════════════════════════════════════
 *
 * Team Mode heisst: mehrere Modelle bearbeiten dieselbe Aufgabe
 * unabhängig voneinander, und Monday führt die Ergebnisse zusammen.
 * Das kostet das Drei- bis Vierfache und dauert das Zwei- bis
 * Dreifache.
 *
 * Deshalb ist die erste Frage nicht „wer ist im Team", sondern „gibt
 * es überhaupt ein Team". Diese Datei beantwortet beide, und zwar
 * bevor irgendein Anbieter angerufen wird.
 *
 * ── Warum manche Aufgaben nie ein Team bekommen ─────────────────
 *
 * Bei „In welcher Sprache ist diese Anzeige" gibt es nichts zu
 * beraten. Drei Modelle liefern dieselbe Antwort, und die zweite und
 * dritte kosten Geld und Sekunden für nichts.
 *
 * Das steht unten als feste Liste und nicht als Schwellenwert. Ein
 * Schwellenwert lässt sich verstellen, und irgendwann läuft eine
 * Spracherkennung durch drei Modelle, weil jemand an einer Zahl
 * gedreht hat. Eine Liste muss man ändern, und dabei fällt auf, was
 * man tut.
 *
 * ── Warum nicht dreimal dasselbe Modell ─────────────────────────
 *
 * Drei Aufrufe an dasselbe Modell mit demselben Kontext ergeben drei
 * ähnliche Antworten. Man bekäme dieselbe Meinung dreimal und hielte
 * sie für Bestätigung — das ist schlechter als eine Meinung, weil es
 * Sicherheit vortäuscht, die nicht da ist.
 *
 * Die Aufstellung bevorzugt deshalb verschiedene Anbieter. Nicht,
 * weil Anbieter magisch verschieden wären, sondern weil verschiedene
 * Trainings verschiedene blinde Flecken haben.
 */

/** Die Rollen aus §16 — verschiedene Blickwinkel statt dreimal derselbe. */
export type Rolle =
  /** Erstellt die stärkste realistische Antwort. */
  | "hauptanalyse"
  /** Sucht gezielt nach Gründen, warum die Empfehlung scheitert. */
  | "gegenpruefung"
  /** Entwickelt Wege, die die anderen übersehen. */
  | "alternative";

export const ROLLENFOLGE: readonly Rolle[] = ["hauptanalyse", "gegenpruefung", "alternative"];

export interface Teamplatz {
  rolle: Rolle;
  modell: Modelldefinition;
  /** Warum dieses Modell auf diesem Platz. Wird mitprotokolliert. */
  grund: string;
}

/**
 * Aufgaben, die nie ein Team bekommen.
 *
 * Zu jeder gehört derselbe Satz: Es gibt nichts zu beraten. Die
 * Antwort steht in den Daten oder sie steht nicht darin; eine zweite
 * Meinung ändert daran nichts.
 */
export const NIE_IM_TEAM: ReadonlySet<AiTask> = new Set<AiTask>([
  "classification",
  "language_detection",
  "job_normalisation",
  "conversation_summary",
  "job_summary",
  "evidence_extraction",
  "document_extraction",
  "requirement_extraction",
]);

export type Stufe = "niedrig" | "mittel" | "hoch" | "kritisch";

const STUFENWERT: Record<Stufe, number> = {
  niedrig: 0, mittel: 0.34, hoch: 0.67, kritisch: 1,
};

/**
 * Die Lage, in der entschieden wird.
 *
 * Alle Angaben kommen vom Aufrufer und nicht aus einem Modell: Ein
 * Modell zu fragen, ob es sich selbst für unsicher hält, ist keine
 * Messung — die berichtete Sicherheit eines Sprachmodells ist
 * bekanntlich schlecht kalibriert.
 */
export interface Lage {
  task: AiTask;
  komplexitaet: Stufe;
  wichtigkeit: Stufe;
  unsicherheit: Stufe;
  /** Wie folgenreich die Entscheidung für den Menschen ist. */
  tragweite: Stufe;
  /** Wie viele Dokumente, Anzeigen oder Quellen im Spiel sind. */
  quellen?: number;
  /** Wie sehr Wartezeit hier stört, 0 bis 1. */
  eiligkeit?: number;
}

export interface Teamurteil {
  punkte: number;
  lohntSich: boolean;
  begruendung: string;
}

/** Ab hier lohnt sich ein Team. Bewusst hoch — im Zweifel ein Modell. */
export const SCHWELLE = 0.62;

/**
 * Lohnt sich ein Team?
 *
 * ── Warum die Gewichte so stehen ────────────────────────────────
 *
 * Tragweite und Unsicherheit wiegen am schwersten, Komplexität am
 * wenigsten. Eine komplizierte Aufgabe mit klarer Antwort braucht
 * kein Team, sondern ein gutes Modell. Eine einfache Frage mit
 * schweren Folgen und dünner Datenlage — „soll ich kündigen“ —
 * braucht die Gegenposition.
 *
 * Das ist eine Starthypothese wie die Eignungswerte im Katalog. Was
 * hier fehlt und später entscheiden muss, sind gemessene Ergebnisse:
 * ob Teamantworten bei diesem Aufgabentyp tatsächlich besser waren.
 */
export function teamWert(lage: Lage): Teamurteil {
  if (NIE_IM_TEAM.has(lage.task)) {
    return {
      punkte: 0,
      lohntSich: false,
      begruendung: `${lage.task} ist eine Aufgabe ohne Beratungsbedarf — eine zweite Meinung ändert die Antwort nicht.`,
    };
  }

  const w = STUFENWERT;

  /*
   * Die vier Achsen summieren sich auf genau 1.
   *
   * Hier stand einmal 0,32 + 0,26 + 0,22 + 0,12 = 0,92, und die
   * fehlenden 0,08 gingen an die Quellenmenge. Das sah nach einer
   * fuenften Achse aus und war in Wahrheit eine verrutschte Skala:
   * Ohne Quellen — also im haeufigsten Fall — war die volle Punktzahl
   * unerreichbar, und eine Lage, in der ALLE vier Achsen auf `hoch`
   * standen, kam auf 0,616 und blieb knapp unter der Schwelle.
   *
   * Nicht, weil die Lage das hergab. Weil 8 Prozent der Skala fuer
   * etwas reserviert waren, das es in diesem Fall nicht gab.
   *
   * Die Quellenmenge ist deshalb ein Zuschlag und keine Achse: Zwanzig
   * Stellenanzeigen machen eine Frage aufwendiger, aber sie machen sie
   * nicht folgenreicher.
   */
  const roh =
    0.35 * w[lage.tragweite] +
    0.28 * w[lage.unsicherheit] +
    0.24 * w[lage.wichtigkeit] +
    0.13 * w[lage.komplexitaet];

  const zuschlag = 0.08 * Math.min(1, (lage.quellen ?? 0) / 20);

  /*
   * Wartezeit zieht ab.
   *
   * Drei Modelle parallel sind so langsam wie das langsamste. Wer
   * mitten im Gespräch eine Rückfrage stellt, wartet dann zwanzig
   * Sekunden auf eine Antwort, die er in fünf gebraucht hätte.
   */
  const abzug = 0.25 * (lage.eiligkeit ?? 0);
  const punkte = Math.max(0, Math.min(1, roh + zuschlag) - abzug);

  return {
    punkte,
    lohntSich: punkte >= SCHWELLE,
    begruendung:
      `Tragweite ${lage.tragweite}, Unsicherheit ${lage.unsicherheit}, ` +
      `Wichtigkeit ${lage.wichtigkeit}, Komplexität ${lage.komplexitaet}` +
      (lage.quellen ? `, ${lage.quellen} Quellen` : "") +
      ` → ${punkte.toFixed(2)} (Schwelle ${SCHWELLE}).`,
  };
}

export interface Aufstellungsgrenzen {
  /** Nie mehr als das. §13: keine autonomen Endlosschleifen. */
  maxAgenten: number;
  /** Unter dieser Zahl ist es kein Team, sondern ein Modell mit Aufwand. */
  minAgenten: number;
}

export const GRENZEN: Aufstellungsgrenzen = { maxAgenten: 3, minAgenten: 2 };

/**
 * Das Team zusammenstellen.
 *
 * Gibt eine leere Liste zurück, wenn nicht genug verschiedene Modelle
 * freigegeben sind. Das ist ein gültiges Ergebnis: Der Aufrufer muss
 * dann mit einem Modell arbeiten und darf nicht behaupten, ein Team
 * habe getagt.
 */
export function teamAufstellen(
  anforderung: Anforderung,
  grenzen: Aufstellungsgrenzen = GRENZEN,
  env: Umgebung = process.env as Umgebung,
  katalog: readonly Modelldefinition[] = KATALOG,
): Teamplatz[] {
  const rang = rangfolge(anforderung, env, katalog);
  if (rang.length < grenzen.minAgenten) return [];

  const gewaehlt: Teamplatz[] = [];
  const anbieterImTeam = new Set<string>();
  const offen = [...rang];

  for (const rolle of ROLLENFOLGE) {
    if (gewaehlt.length >= grenzen.maxAgenten || offen.length === 0) break;

    /*
     * Erst jemanden von einem Anbieter suchen, der noch nicht dabei
     * ist. Nur wenn keiner übrig ist, den nächstbesten überhaupt.
     *
     * Der zweite Fall ist bewusst erlaubt: Zwei Modelle desselben
     * Anbieters sind schwächer als zwei verschiedener, aber immer
     * noch mehr als eine Stimme.
     */
    const neuerAnbieter = offen.findIndex((r) => !anbieterImTeam.has(r.modell.anbieter));
    const index = neuerAnbieter >= 0 ? neuerAnbieter : 0;
    const [eintrag] = offen.splice(index, 1);
    if (!eintrag) break;

    anbieterImTeam.add(eintrag.modell.anbieter);
    gewaehlt.push({
      rolle,
      modell: eintrag.modell,
      grund:
        neuerAnbieter >= 0
          ? `${eintrag.begruendung} Anderer Anbieter als die bereits gesetzten.`
          : `${eintrag.begruendung} Kein weiterer Anbieter freigegeben — zweite Stimme vom selben.`,
    });
  }

  /*
   * Ein Team aus einem Kopf ist kein Team.
   *
   * Es hier abzubrechen statt beim Aufrufer ist Absicht: Sonst
   * entsteht ein „Team Mode“-Lauf mit einem Agenten, der in der
   * Oberfläche als Team erscheint. Genau das verbietet §36.
   */
  return gewaehlt.length >= grenzen.minAgenten ? gewaehlt : [];
}
