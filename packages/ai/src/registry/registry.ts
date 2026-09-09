import type { AiTask } from "../router.ts";
import { anbieterGestoert } from "./anbieterbreaker.ts";
import {
  KATALOG,
  eignungFuer,
  type Anbieter,
  type Faehigkeit,
  type Modelldefinition,
} from "./katalog.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was ein Modell vom Kandidaten zum angebotenen Modell macht
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Katalog sagt, welche Modelle es gibt. Diese Datei sagt, welche
 * davon ein Mensch heute auswählen darf. Zwischen beidem liegen vier
 * Fragen, und keine davon beantwortet der Katalog:
 *
 *   1. Haben wir einen Schlüssel für diesen Anbieter?
 *   2. Gibt es überhaupt einen Adapter, der ihn ansprechen kann?
 *   3. Hat jemand dieses Modell für den Betrieb freigegeben?
 *   4. Hat ein echter Aufruf jemals funktioniert?
 *
 * ── Fail-closed, und warum das hier nicht verhandelbar ist ──────
 *
 * Alle vier Antworten sind standardmässig „nein“. Ein Modell, das in
 * der Auswahl steht und beim Anklicken einen Fehler wirft, ist
 * schlimmer als ein Modell, das gar nicht dasteht: Der Mensch hat
 * gewählt, gewartet und nichts bekommen, und er weiss nicht, ob es an
 * ihm lag.
 *
 * Deshalb ist „dokumentiert“ nicht „erreichbar“, „erreichbar“ nicht
 * „freigegeben“, und keins davon ist „funktioniert“. Diese vier
 * Zustände fallen erfahrungsgemäss zusammen, sobald man sie in einem
 * Feld führt.
 *
 * ── Was hier NICHT passiert ─────────────────────────────────────
 *
 * Kein Netzaufruf. Diese Datei liest Umgebungsvariablen und
 * entscheidet; sie prüft nicht selbst, ob eine API antwortet. Ein
 * Modul, das beim Import telefoniert, ist in einem Test nicht mehr
 * beherrschbar — und die Modellauswahl wird auf jeder Seite gelesen.
 */

/**
 * Anbieter, für die es tatsächlich einen Adapter gibt.
 *
 * Seit dem 9. September 2026 alle drei: `providers/` enthält
 * `openai.ts`, `anthropic.ts` und `gemini.ts`.
 *
 * ── Was ein Eintrag hier heisst und was nicht ───────────────────
 *
 * Er heisst: Es gibt Code, der diesen Anbieter ansprechen kann. Er
 * heisst NICHT, dass je ein Aufruf funktioniert hat. `gemini.ts` ist
 * gegen die dokumentierte Form der Schnittstelle geschrieben und von
 * hier aus gegen keine laufende API geprüft worden.
 *
 * Diese Trennung trägt die Freigabe: MONDAY_GOOGLE_PRODUCTION_APPROVED
 * bleibt `false`, bis jemand einen echten Aufruf gemacht hat. Adapter
 * und Freigabe sind zwei Türen, und beide müssen auf sein.
 */
export const ANBIETER_MIT_ADAPTER: ReadonlySet<Anbieter> = new Set<Anbieter>([
  "openai",
  "anthropic",
  "google",
]);

/** Wie sicher wir sind, dass dieses Modell antwortet. */
export type Verfuegbarkeit =
  /** Niemand hat es je aufgerufen. Der Ausgangszustand. */
  | "ungeprueft"
  /** Ein echter Aufruf hat funktioniert. */
  | "erreichbar"
  /** Ein Aufruf ist gescheitert, oder jemand hat es gesperrt. */
  | "gesperrt";

export interface Modellzustand {
  definition: Modelldefinition;
  schluesselVorhanden: boolean;
  adapterVorhanden: boolean;
  produktionsfreigabe: boolean;
  verfuegbarkeit: Verfuegbarkeit;
  /** Darf dieses Modell einem Menschen angeboten werden? */
  anbietbar: boolean;
  /**
   * Warum nicht — in einem Satz, für Betreiber, nicht für Nutzer.
   *
   * `null`, wenn es anbietbar ist. Ein Grund, der auch im
   * Erfolgsfall gesetzt wäre, wird beim Lesen zur Rätselarbeit.
   */
  grund: string | null;
}

/** Nur die Variablen, die diese Datei liest. Damit ist sie prüfbar. */
export interface Umgebung {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;

  MONDAY_OPENAI_PRODUCTION_APPROVED?: string;
  MONDAY_ANTHROPIC_PRODUCTION_APPROVED?: string;
  MONDAY_GOOGLE_PRODUCTION_APPROVED?: string;

  MONDAY_PREVIEW_MODELS_ENABLED?: string;
  /** Kommaliste interner Kennungen, die trotz allem gesperrt bleiben. */
  MONDAY_MODELLE_GESPERRT?: string;
}

const SCHLUESSEL: Record<Anbieter, keyof Umgebung> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
};

const FREIGABE: Record<Anbieter, keyof Umgebung> = {
  openai: "MONDAY_OPENAI_PRODUCTION_APPROVED",
  anthropic: "MONDAY_ANTHROPIC_PRODUCTION_APPROVED",
  google: "MONDAY_GOOGLE_PRODUCTION_APPROVED",
};

/**
 * `"true"` und sonst nichts.
 *
 * Nicht `Boolean(wert)`: Damit wäre `"false"` wahr, weil eine nicht
 * leere Zeichenkette wahr ist. Das ist der klassische Weg, eine
 * ausgeschaltete Freigabe einzuschalten.
 */
function jaGesetzt(wert: string | undefined): boolean {
  return wert?.trim().toLowerCase() === "true";
}

function gesperrteKennungen(env: Umgebung): ReadonlySet<string> {
  return new Set(
    (env.MONDAY_MODELLE_GESPERRT ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Der Zustand aller Modelle.
 *
 * Gibt bewusst auch die nicht anbietbaren zurück, mit Begründung.
 * Eine Funktion, die nur die brauchbaren liefert, beantwortet die
 * häufigste Frage nicht: „Warum steht mein Modell nicht in der
 * Liste?“
 */
export function modellzustaende(
  env: Umgebung = process.env as Umgebung,
  katalog: readonly Modelldefinition[] = KATALOG,
): Modellzustand[] {
  const gesperrt = gesperrteKennungen(env);
  const vorschauErlaubt = jaGesetzt(env.MONDAY_PREVIEW_MODELS_ENABLED);

  return katalog.map((definition) => {
    const schluesselVorhanden = Boolean(env[SCHLUESSEL[definition.anbieter]]?.trim());
    const adapterVorhanden = ANBIETER_MIT_ADAPTER.has(definition.anbieter);
    const produktionsfreigabe = jaGesetzt(env[FREIGABE[definition.anbieter]]);

    /*
     * Die Reihenfolge der Prüfungen ist die Reihenfolge der Antwort.
     *
     * Wer keinen Adapter hat, braucht keinen Schlüssel — und die
     * Meldung „Schlüssel fehlt“ würde jemanden dazu bringen, einen
     * zu besorgen, der nichts nützt.
     */
    const grund: string | null =
      gesperrt.has(definition.internId)
        ? "Ausdrücklich gesperrt über MONDAY_MODELLE_GESPERRT."
        : !adapterVorhanden
          ? `Für ${definition.anbieter} gibt es in packages/ai/src/providers/ keinen Adapter.`
          : !schluesselVorhanden
            ? `Kein Schlüssel gesetzt (${SCHLUESSEL[definition.anbieter]}).`
            : definition.lebenszyklus === "abgekuendigt"
              ? "Abgekündigt. Für neue Anfragen nicht mehr vorgesehen."
              : definition.lebenszyklus === "vorschau" && !vorschauErlaubt
                ? "Vorschaumodell. MONDAY_PREVIEW_MODELS_ENABLED steht nicht auf true."
                : !produktionsfreigabe
                  ? `Nicht freigegeben (${FREIGABE[definition.anbieter]} steht nicht auf true).`
                  : null;

    return {
      definition,
      schluesselVorhanden,
      adapterVorhanden,
      produktionsfreigabe,
      /*
       * Immer `ungeprueft`.
       *
       * Diese Funktion telefoniert nicht, also kann sie nichts
       * anderes behaupten. `erreichbar` darf nur jemand setzen, der
       * einen echten Aufruf gemacht hat — sonst steht in der
       * Registry eine Zusage, die niemand geprüft hat.
       */
      verfuegbarkeit: "ungeprueft",
      anbietbar: grund === null,
      grund,
    };
  });
}

/** Was einem Menschen in der Auswahl gezeigt werden darf. */
export function anbietbareModelle(
  env: Umgebung = process.env as Umgebung,
  katalog: readonly Modelldefinition[] = KATALOG,
): Modelldefinition[] {
  return modellzustaende(env, katalog)
    .filter((z) => z.anbietbar)
    .map((z) => z.definition);
}

/**
 * Ein Modell anhand der Nutzerauswahl finden — aber nur ein erlaubtes.
 *
 * Der Rückgabewert `null` deckt zwei Fälle ab, die absichtlich nicht
 * unterschieden werden: „gibt es nicht“ und „darfst du nicht“. Wer
 * eine Kennung rät, soll aus der Antwort nicht schliessen können,
 * welche Modelle intern existieren.
 */
export function modellAuswaehlen(
  internId: string,
  env: Umgebung = process.env as Umgebung,
  katalog: readonly Modelldefinition[] = KATALOG,
): Modelldefinition | null {
  return anbietbareModelle(env, katalog).find((m) => m.internId === internId) ?? null;
}

/* ══════════════════════════════════════════════════════════════════
   Die Rangfolge
   ══════════════════════════════════════════════════════════════════ */

export interface Anforderung {
  task: AiTask;
  /** Ohne diese Fähigkeiten fällt ein Modell raus — es wird nicht abgewertet. */
  benoetigt?: readonly Faehigkeit[];
  /** Was hereinkommt. Ein PDF ohne PDF-Fähigkeit ist ein Ausschluss. */
  eingaben?: readonly ("text" | "bild" | "pdf" | "audio")[];
  /**
   * Wie sehr Qualität vor Kosten geht, 0 bis 1.
   *
   * Bei einer Karriereentscheidung nahe 1, beim Einsortieren einer
   * Stellenanzeige nahe 0. Der Wert kommt vom Aufrufer, weil nur er
   * weiss, was auf dem Spiel steht.
   */
  qualitaetVorKosten?: number;
  /**
   * Anbieter, die diese Daten sehen dürfen.
   *
   * Leer oder fehlend heisst „alle freigegebenen“. Die Liste kommt aus
   * der Datenschutzentscheidung des Kontos, nicht aus dem Router —
   * hier wird sie nur angewandt.
   */
  erlaubteAnbieter?: readonly Anbieter[];
}

export interface Rangeintrag {
  modell: Modelldefinition;
  punkte: number;
  /** Warum dieses Modell so weit oben steht. Wird mitprotokolliert. */
  begruendung: string;
}

const KOSTENPUNKTE: Record<Modelldefinition["kostenklasse"], number> = {
  guenstig: 1, mittel: 0.6, teuer: 0.25,
};
const TEMPOPUNKTE: Record<Modelldefinition["tempoklasse"], number> = {
  schnell: 1, mittel: 0.6, langsam: 0.3,
};

/**
 * Die Modelle für eine Aufgabe sortieren.
 *
 * ── Warum hier kein `if (aufgabe === "cv") nimm Claude` steht ───
 *
 * Weil ein solcher Satz genau so lange stimmt, bis ein Anbieter ein
 * neues Modell herausbringt — und dann steht er trotzdem noch da, an
 * einer Stelle, an der niemand nach Modellwissen sucht.
 *
 * Stattdessen: Der Katalog trägt die Vermutung, die Anforderung trägt
 * die Gewichtung, und diese Funktion rechnet. Ein neues Modell braucht
 * einen Katalogeintrag und keine Zeile Router-Code.
 *
 * Gibt eine leere Liste zurück, wenn nichts passt. Das ist ein
 * gültiges Ergebnis und muss beim Aufrufer zu einer ehrlichen Meldung
 * führen — nicht zu einem beliebigen Modell.
 */
export function rangfolge(
  anforderung: Anforderung,
  env: Umgebung = process.env as Umgebung,
  katalog: readonly Modelldefinition[] = KATALOG,
  /*
   * Der Schutzschalter, vorbelegt mit dem echten.
   *
   * Vorbelegt und nicht als Pflichtangabe: Ein Aufrufer, der ihn
   * vergisst, bekäme sonst stillschweigend den alten Zustand — der
   * Schalter zählte weiter, ohne dass ihn jemand liest. Genau das ist
   * die Sorte Bauteil, die vorhanden aussieht und nichts tut.
   *
   * Als Angabe überschreibbar, damit Tests die Lage herstellen
   * können, ohne einen Anbieter tatsächlich ausfallen zu lassen.
   */
  istGestoert: (anbieter: Anbieter) => boolean = anbieterGestoert,
): Rangeintrag[] {
  const gewicht = Math.min(1, Math.max(0, anforderung.qualitaetVorKosten ?? 0.6));
  const erlaubt = anforderung.erlaubteAnbieter;

  return anbietbareModelle(env, katalog)
    .filter((m) => !erlaubt?.length || erlaubt.includes(m.anbieter))
    /*
     * Gestörte Anbieter fallen aus der automatischen Auswahl.
     *
     * Nicht aus der ausdrücklichen: `modellAuswaehlen` fragt hier
     * nicht. Wer ein Modell selbst wählt, bekommt seinen Versuch —
     * siehe anbieterbreaker.ts.
     */
    .filter((m) => !istGestoert(m.anbieter))
    .filter((m) => (anforderung.benoetigt ?? []).every((f) => m.faehigkeiten[f]))
    .filter((m) => (anforderung.eingaben ?? []).every((e) => m.eingaben.includes(e)))
    .map((modell) => {
      const eignung = eignungFuer(modell, anforderung.task);
      const betrieb = 0.6 * KOSTENPUNKTE[modell.kostenklasse] + 0.4 * TEMPOPUNKTE[modell.tempoklasse];
      const punkte = gewicht * eignung + (1 - gewicht) * betrieb;
      return {
        modell,
        punkte,
        begruendung:
          `Eignung ${eignung.toFixed(2)} für ${anforderung.task}, ` +
          `Betrieb ${betrieb.toFixed(2)} (${modell.kostenklasse}/${modell.tempoklasse}), ` +
          `Gewichtung Qualität ${gewicht.toFixed(2)}.`,
      };
    })
    /*
     * Bei Gleichstand entscheidet die interne Kennung.
     *
     * Nicht aus Ästhetik: Ohne festen zweiten Schlüssel hängt die
     * Auswahl von der Reihenfolge im Katalog ab, und dann ändert das
     * Umsortieren einer Liste stillschweigend, welches Modell die
     * Menschen bekommen.
     */
    .sort((a, b) => b.punkte - a.punkte || a.modell.internId.localeCompare(b.modell.internId));
}

/** Das beste zulässige Modell — oder `null`, wenn es keines gibt. */
export function bestesModell(
  anforderung: Anforderung,
  env: Umgebung = process.env as Umgebung,
  katalog: readonly Modelldefinition[] = KATALOG,
  istGestoert: (anbieter: Anbieter) => boolean = anbieterGestoert,
): Rangeintrag | null {
  return rangfolge(anforderung, env, katalog, istGestoert)[0] ?? null;
}
