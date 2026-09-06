import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import { alleModelle, modellFuer, werkzeugeNurUeberResponses, type Modellstufe } from "./modelle.ts";

/**
 * Welches eingerichtete Modell antwortet gerade?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht bei jeder Anfrage
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Aufruf gegen `/v1/models` vor jeder Nutzeranfrage wäre eine
 * zusätzliche Netzrunde für eine Auskunft, die sich in Stunden nicht
 * ändert — und er würde die Antwortzeit genau dort verlängern, wo
 * jemand wartet.
 *
 * Diese Prüfung läuft beim Start, von Hand oder auf einem Zeitplan.
 * Ihr Ergebnis hält eine Viertelstunde.
 *
 * ══════════════════════════════════════════════════════════════
 * Was sie NICHT tut
 * ══════════════════════════════════════════════════════════════
 *
 * Sie schaltet nichts um. Ein Modell, das hier fehlt, wird nicht
 * stillschweigend ersetzt — dafür ist die Ersatzkette im Anbieter da,
 * und die greift im Moment des Fehlers.
 *
 * Eine Gesundheitsprüfung, die Konfiguration ändert, ist eine
 * Konfigurationsquelle. Dann gäbe es zwei, und die Frage „warum
 * antwortet Nina mit einem anderen Modell" wäre nicht mehr
 * beantwortbar.
 */

export interface Modellbefund {
  stufe: Modellstufe;
  modell: string;
  ersatz: string | null;
  /** Ob das Projekt es überhaupt kennt. */
  gelistet: boolean;
  /**
   * Ob es Werkzeuge nur über `/v1/responses` annimmt.
   *
   * Für uns folgenlos — unser Anbieter ruft ohnehin nur dort an.
   * Steht als Hinweis für den Fall, dass jemand einen zweiten
   * Aufrufweg baut.
   */
  nurResponses: boolean;
}

export interface Gesundheitsbefund {
  geprueftAm: Date;
  /** `false`, wenn die Liste selbst nicht abrufbar war. */
  erreichbar: boolean;
  grund: string | null;
  modelle: Modellbefund[];
}

/** Wie lange ein Befund gilt. */
export const HALTBAR_MS = 15 * 60 * 1000;

let zwischenspeicher: { befund: Gesundheitsbefund; bis: number } | null = null;

/**
 * Die Modell-Liste des Projekts.
 *
 * Nur die Liste, kein Probeaufruf: Ein Aufruf je Modell kostet Geld
 * und Zeit, und die Frage lautet hier „kennt unser Projekt das
 * Modell", nicht „wie gut antwortet es". Ob es wirklich läuft, zeigt
 * `scripts/modell-diagnose.mjs` — dort, wo jemand hinsieht.
 */
async function gelisteteModelle(
  apiKey: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const antwort = await fetchImpl("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!antwort.ok) throw new Error(`GET /v1/models: ${antwort.status}`);
  const daten = (await antwort.json()) as { data?: { id?: string }[] };
  return new Set((daten.data ?? []).map((m) => String(m.id)));
}

export async function modellgesundheit(
  optionen: {
    cfg?: RuntimeConfig;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    /** Den Zwischenspeicher übergehen. */
    frisch?: boolean;
    jetzt?: Date;
  } = {},
): Promise<Gesundheitsbefund> {
  const jetzt = optionen.jetzt ?? new Date();
  if (!optionen.frisch && zwischenspeicher && zwischenspeicher.bis > jetzt.getTime()) {
    return zwischenspeicher.befund;
  }

  const cfg = optionen.cfg ?? loadRuntimeConfig();
  const stufen: Modellstufe[] = ["FAST", "DEFAULT", "DEEP", "ULTRA", "REALTIME", "EMBEDDING"];
  const namen = alleModelle(cfg);

  const grundgeruest = (gelistet: (m: string) => boolean): Modellbefund[] =>
    stufen.map((stufe) => {
      const wahl = modellFuer(cfg, stufe);
      return {
        stufe,
        modell: wahl.modell,
        ersatz: wahl.ersatz,
        gelistet: gelistet(wahl.modell),
        nurResponses: werkzeugeNurUeberResponses(wahl.modell),
      };
    });

  const apiKey = cfg.ai.apiKey;
  if (!apiKey || cfg.ai.provider !== "openai") {
    /*
     * Ohne Schlüssel ist die Frage nicht beantwortbar — und das ist
     * etwas anderes als „nicht verfügbar". Ein Befund, der beides
     * gleich aussehen lässt, schickt jemanden auf die falsche Suche.
     */
    const befund: Gesundheitsbefund = {
      geprueftAm: jetzt,
      erreichbar: false,
      grund: apiKey ? `Anbieter ist ${cfg.ai.provider}, nicht openai.` : "Kein API-Schlüssel gesetzt.",
      modelle: grundgeruest(() => false),
    };
    zwischenspeicher = { befund, bis: jetzt.getTime() + HALTBAR_MS };
    return befund;
  }

  try {
    const bekannt = await gelisteteModelle(apiKey, optionen.fetchImpl ?? fetch, optionen.signal);
    const befund: Gesundheitsbefund = {
      geprueftAm: jetzt,
      erreichbar: true,
      grund: null,
      modelle: grundgeruest((m) => bekannt.has(m)),
    };
    zwischenspeicher = { befund, bis: jetzt.getTime() + HALTBAR_MS };
    return befund;
  } catch (fehler) {
    /*
     * Ein Fehlschlag wird NICHT zwischengespeichert.
     *
     * Sonst gälte eine einzelne Störung eine Viertelstunde lang als
     * Befund — dieselbe Falle wie bei der Berufskennung, wo ein
     * fehlgeschlagener Ladeversuch eine Stunde behalten wurde.
     */
    return {
      geprueftAm: jetzt,
      erreichbar: false,
      grund: fehler instanceof Error ? fehler.message.slice(0, 200) : "unbekannt",
      modelle: grundgeruest(() => false),
    };
  }
}

/** Nur für Tests: den Zwischenspeicher leeren. */
export function gesundheitVergessen(): void {
  zwischenspeicher = null;
}

/** Der Befund als Text — für Start und Terminal. */
export function gesundheitAlsText(b: Gesundheitsbefund): string {
  if (!b.erreichbar) return `Modelle nicht prüfbar: ${b.grund}`;
  return b.modelle
    .map(
      (m) =>
        `  ${m.stufe.padEnd(9)} ${m.modell.padEnd(24)} ${m.gelistet ? "gelistet" : "NICHT GELISTET"}` +
        `${m.ersatz ? ` · Ersatz ${m.ersatz}` : ""}${m.nurResponses ? " · Werkzeuge nur über /v1/responses" : ""}`,
    )
    .join("\n");
}
