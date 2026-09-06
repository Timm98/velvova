import { taetigkeitStamm, type Staerke } from "@paycheck/matching";

/**
 * Aus den Filtern der Stellenseite Suchkriterien machen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein übernommener Filter nicht dasselbe ist wie eine Aussage
 * ══════════════════════════════════════════════════════════════
 *
 * Wer im Filter „Teilzeit" anklickt, hat etwas getan — aber er hat
 * nichts gesagt. Der Klick kann eine Erkundung sein: „mal sehen, was
 * es da gibt."
 *
 * Deshalb kommen diese Kriterien mit `herkunft: uebernommener_filter`
 * und `bestaetigungsstatus: offen` herein. Sie wirken erst, wenn
 * jemand den Auftrag bestätigt — und dann steht in der Mail
 * „Übernommene Filter vom 6. September" und nicht „Bestätigter
 * Suchauftrag", weil das zwei verschiedene Dinge sind.
 *
 * ══════════════════════════════════════════════════════════════
 * Was ein Muss werden darf und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Nur, was in der Anzeige entscheidbar ist und was die Person
 * ausdrücklich eingegrenzt hat: Suchbegriff, Arbeitsmodell, Vertrag,
 * Mindestgehalt, Ort, Ausschlüsse.
 *
 * Nicht: Sortierung, Seitenzahl, Zeitfenster. Das sind Angaben über
 * die Ansicht, nicht über die Suche — und ein „nur von heute"-Filter
 * als Dauerkriterium hiesse, dass der Auftrag ab morgen nichts mehr
 * findet.
 */

export interface Filterkriterium {
  kriterium: string;
  wert: unknown;
  einheit?: string | null;
  operator?: string;
  staerke: Staerke;
  gruppe?: string | null;
  herkunft: string;
  bestaetigungsstatus: "offen";
}

/** Die Filter, die die Ansicht betreffen und keine Suche beschreiben. */
const NUR_ANSICHT = new Set(["sort", "anzahl", "seite", "job", "blocked", "since", "salary"]);

function worte(roh: string): string[] {
  return roh
    .toLowerCase()
    .split(/[\s,]+/)
    .map((w) => w.trim())
    /*
     * Auf den Stamm: Wer „Lagerstellen" eintippt, meint „Lager".
     * Die Prüfung vergleicht am Wortanfang, und „lagerstellen" ist
     * kein Präfix von „Lagerhelfer".
     */
    .map(taetigkeitStamm)
    .filter((w) => w.length >= 3)
    .slice(0, 6);
}

export function filterZuKriterien(params: Record<string, string | undefined>): Filterkriterium[] {
  const raus: Filterkriterium[] = [];
  const nimm = (k: Omit<Filterkriterium, "herkunft" | "bestaetigungsstatus">) =>
    raus.push({ ...k, herkunft: "uebernommener_filter", bestaetigungsstatus: "offen" });

  const suche = params.q?.trim();
  if (suche && suche.length >= 3) {
    nimm({ kriterium: "taetigkeit", wert: worte(suche), staerke: "muss", operator: "enthaelt" });
  }

  const nicht = params.nicht?.trim();
  if (nicht && nicht.length >= 3) {
    nimm({
      kriterium: "taetigkeit_ausschluss",
      wert: worte(nicht),
      staerke: "muss",
      operator: "nicht",
    });
  }

  const ort = params.ort?.trim();
  if (ort && ort.length >= 3) {
    /*
     * Der Ort ist ein Wunsch, kein Muss — es sei denn, jemand hat
     * „genau dieser Ort" gesetzt.
     *
     * Ein Ortsfilter ohne diesen Zusatz ist in der Stellenliste eine
     * Umkreissuche. Ihn als hartes Kriterium zu übernehmen hiesse,
     * die Nachbarstadt auszuschliessen, ohne dass das jemand gesagt
     * hätte.
     */
    nimm({
      kriterium: "arbeitsort",
      wert: [ort.toLowerCase()],
      staerke: params.ortGenau === "1" ? "muss" : "wunsch",
      gruppe: "ort",
    });
  }

  if (params.remote === "on_site" || params.remote === "hybrid" || params.remote === "remote") {
    nimm({
      kriterium: "arbeitsmodell",
      wert: [params.remote],
      operator: "einer_von",
      staerke: "muss",
      /* Dieselbe Gruppe wie der Ort: „Karlsruhe ODER vollständig
         remote" ist eine Bedingung, nicht zwei. */
      gruppe: params.remote === "remote" ? "ort" : null,
    });
  }

  if (params.contract) {
    nimm({
      kriterium: "vertragsform",
      wert: [params.contract],
      operator: "einer_von",
      staerke: "muss",
    });
  }

  if (params.arbeitszeit === "teilzeit") {
    nimm({ kriterium: "wochenstunden", wert: 34, einheit: "stunden", operator: "hoechstens", staerke: "wunsch" });
  }
  if (params.arbeitszeit === "vollzeit") {
    nimm({ kriterium: "wochenstunden", wert: 35, einheit: "stunden", operator: "mindestens", staerke: "wunsch" });
  }

  if (params.schicht === "0") {
    /*
     * Nur ein Wunsch.
     *
     * 94 Prozent der Anzeigen sagen nichts zu Schichtarbeit. Als Muss
     * bliebe fast alles ungeklärt, und die Person bekäme eine Liste
     * offener Fragen statt Stellen.
     */
    nimm({ kriterium: "schichtarbeit", wert: false, staerke: "wunsch" });
  }

  const gehaltAb = Number(params.gehaltAb);
  if (Number.isFinite(gehaltAb) && gehaltAb > 0) {
    nimm({
      kriterium: "mindestgehalt",
      wert: gehaltAb,
      einheit: "year",
      operator: "mindestens",
      staerke: "muss",
    });
  }

  return raus;
}

/** Welche übergebenen Filter bewusst nicht übernommen wurden. */
export function nichtUebernommen(params: Record<string, string | undefined>): string[] {
  return Object.keys(params).filter((k) => NUR_ANSICHT.has(k) && params[k]);
}

/**
 * Ein Name für den Auftrag, aus der Suche abgeleitet.
 *
 * Nicht abgefragt: Wer nichts verpassen will, interessiert sich nicht
 * dafür, wie die Suche heisst.
 */
export function auftragsname(params: Record<string, string | undefined>): string {
  const teile: string[] = [];
  if (params.q?.trim()) teile.push(params.q.trim());
  if (params.ort?.trim()) teile.push(`in ${params.ort.trim()}`);
  if (teile.length === 0 && params.remote === "remote") teile.push("Remote-Stellen");
  return teile.join(" ").slice(0, 120) || "Meine Suche";
}
