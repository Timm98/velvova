/**
 * ══════════════════════════════════════════════════════════════════
 * Der Fähigkeitskatalog — Startbestand für ein Berufsfeld
 * ══════════════════════════════════════════════════════════════════
 *
 * `profile_skills.skill_key` verweist auf `skills.key`, und `skills`
 * hatte am 10.09.2026 null Zeilen. Ohne Katalog lässt sich keine
 * einzige Fähigkeit ablegen — er ist die Voraussetzung der ganzen
 * Kette aus `faehigkeiten.ts`, nicht ihr Feinschliff.
 *
 * ── Warum er nicht aus dem Bestand fallen kann ──────────────────
 *
 * Drei Quellen lagen nahe, keine trägt:
 *
 *   `job_requirements`   529.225 Zeilen, aber die häufigsten sind
 *                        „Bereitschaft zur Schichtarbeit" (10.696) —
 *                        Arbeitsbedingungen, keine Fähigkeiten.
 *   `beruf_wortschatz`   12.304 Zeilen, aber es sind
 *                        Berufsbezeichnungen, keine Fähigkeiten.
 *   `occupations`        leer.
 *
 * ── Warum ein Berufsfeld und nicht alle ─────────────────────────
 *
 * Ein Katalog, der alles abdeckt, deckt nichts genau ab. Die
 * Marktmessung vom 10.09.2026 nennt die dichteste Zelle: Pflege in
 * Berlin, 207 Arbeitgeber, 1.163 Anzeigen. Dort trägt ein enger
 * Katalog, und dort lässt sich prüfen, ob die Zuordnung stimmt.
 *
 * Was hier steht, ist ausdrücklich ein Startbestand und keine
 * Behauptung von Vollständigkeit. `feld` trägt das mit, damit ein
 * Abgleich in einem anderen Beruf nicht so aussieht, als sei er
 * geprüft worden.
 *
 * ── Der Weg danach ──────────────────────────────────────────────
 *
 * ESCO liefert Kompetenzen, Berufe und ihre Beziehungen über eine
 * Schnittstelle. Das ist der richtige zweite Schritt — mit zwei
 * Vorbehalten, die vorher zu klären sind: die Nutzungsbedingungen der
 * Schnittstelle, und dass eine ESCO-Zuordnung ein Begriff ist und
 * kein Nachweis. `escoUri` in `skills` steht dafür bereit und bleibt
 * bis dahin leer.
 */

export interface Katalogeintrag {
  /** Stabiler Schlüssel. Ändert sich nie, auch wenn die Bezeichnung wechselt. */
  schluessel: string;
  bezeichnung: string;
  /**
   * Wie es in Anzeigen und Gesprächen tatsächlich heisst.
   *
   * Deutsch bildet Komposita, und eine Wortgrenzensuche geht an ihnen
   * vorbei: „Dienstplangestaltung" enthält „Dienstplan", aber
   * `\bdienstplanung\b` trifft es nicht. Deshalb wird gesucht, ob ein
   * Synonym IM Text vorkommt — und die Synonyme sind entsprechend
   * kurz gehalten.
   *
   * Umlaute werden bei der Suche zu `ae`, `oe`, `ue` gefaltet — hier
   * stehen sie deshalb schon in dieser Form, damit beim Lesen
   * sichtbar ist, wonach wirklich gesucht wird.
   */
  synonyme: readonly string[];
  /** Für welches Berufsfeld dieser Eintrag geprüft ist. */
  feld: "pflege";
}

/**
 * Startbestand Pflege.
 *
 * Gewählt nach dem, was in Stellenanzeigen dieser Zelle tatsächlich
 * verlangt wird — nicht nach dem, was ein Lehrbuch aufzählt.
 */
export const KATALOG: readonly Katalogeintrag[] = [
  { schluessel: "grundpflege", bezeichnung: "Grundpflege", feld: "pflege", synonyme: ["grundpflege", "koerperpflege"] },
  { schluessel: "behandlungspflege", bezeichnung: "Behandlungspflege", feld: "pflege", synonyme: ["behandlungspflege", "medizinische pflege"] },
  { schluessel: "medikamentengabe", bezeichnung: "Medikamentengabe", feld: "pflege", synonyme: ["medikamentengabe", "medikamentenmanagement", "medikation stellen", "arzneimittelgabe"] },
  { schluessel: "injektionen", bezeichnung: "Injektionen und Infusionen", feld: "pflege", synonyme: ["injektion", "infusion"] },
  { schluessel: "wundversorgung", bezeichnung: "Wundversorgung", feld: "pflege", synonyme: ["wundversorgung", "wundmanagement", "verbandwechsel", "verbandswechsel", "dekubitus"] },
  { schluessel: "pflegedokumentation", bezeichnung: "Pflegedokumentation", feld: "pflege", synonyme: ["pflegedokumentation", "dokumentation", "sis ", "strukturierte informationssammlung"] },
  { schluessel: "pflegeplanung", bezeichnung: "Pflegeplanung", feld: "pflege", synonyme: ["pflegeplanung", "pflegeprozess", "pflegeanamnese"] },
  { schluessel: "dienstplanung", bezeichnung: "Dienstplanung", feld: "pflege", synonyme: ["dienstplan", "dienstplaen", "dienstplanung", "personaleinsatzplanung"] },
  { schluessel: "praxisanleitung", bezeichnung: "Praxisanleitung", feld: "pflege", synonyme: ["praxisanleit", "praxisanleiter", "anleitung von auszubildenden"] },
  { schluessel: "einarbeitung", bezeichnung: "Einarbeitung neuer Kollegen", feld: "pflege", synonyme: ["einarbeitung neuer", "mentoring", "einarbeiten von"] },
  { schluessel: "beatmung", bezeichnung: "Beatmung", feld: "pflege", synonyme: ["beatmung", "beatmungspflege", "tracheostoma", "trachealkanuele"] },
  { schluessel: "intensivpflege", bezeichnung: "Intensivpflege", feld: "pflege", synonyme: ["intensivpflege", "intensivstation", "its ", "anaesthesie"] },
  { schluessel: "notfallversorgung", bezeichnung: "Notfallversorgung", feld: "pflege", synonyme: ["notfall", "reanimation", "notaufnahme", "erste hilfe"] },
  { schluessel: "op_assistenz", bezeichnung: "OP-Assistenz", feld: "pflege", synonyme: ["op-assistenz", "instrumentier", "operationsdienst", "springertaetigkeit"] },
  { schluessel: "palliativpflege", bezeichnung: "Palliativpflege", feld: "pflege", synonyme: ["palliativ", "sterbebegleitung", "hospiz"] },
  { schluessel: "geriatrie", bezeichnung: "Geriatrische Pflege", feld: "pflege", synonyme: ["geriatr", "altenpflege", "seniorenpflege"] },
  { schluessel: "demenzbetreuung", bezeichnung: "Betreuung von Menschen mit Demenz", feld: "pflege", synonyme: ["demenz", "gerontopsychiatr", "validation"] },
  { schluessel: "psychiatrische_pflege", bezeichnung: "Psychiatrische Pflege", feld: "pflege", synonyme: ["psychiatr", "sozialpsychiatr"] },
  { schluessel: "paediatrie", bezeichnung: "Pflege von Kindern", feld: "pflege", synonyme: ["paediatr", "kinderkrankenpflege", "neonatolog"] },
  { schluessel: "onkologie", bezeichnung: "Onkologische Pflege", feld: "pflege", synonyme: ["onkolog", "chemotherapie", "zytostatik"] },
  { schluessel: "dialyse", bezeichnung: "Dialyse", feld: "pflege", synonyme: ["dialyse", "nephrolog", "shunt"] },
  { schluessel: "hygiene", bezeichnung: "Hygiene", feld: "pflege", synonyme: ["hygiene", "infektionsschutz", "desinfektion", "mre "] },
  { schluessel: "qualitaetsmanagement", bezeichnung: "Qualitätsmanagement", feld: "pflege", synonyme: ["qualitaetsmanagement", "qm-", "audit", "mdk"] },
  { schluessel: "expertenstandards", bezeichnung: "Expertenstandards", feld: "pflege", synonyme: ["expertenstandard", "sturzprophylaxe", "dekubitusprophylaxe"] },
  { schluessel: "beratung", bezeichnung: "Beratung von Angehörigen", feld: "pflege", synonyme: ["angehoerigenberatung", "beratungsgespraech", "pflegeberatung"] },
  { schluessel: "wohnbereichsleitung", bezeichnung: "Wohnbereichsleitung", feld: "pflege", synonyme: ["wohnbereichsleitung", "wbl", "stationsleitung"] },
  { schluessel: "pflegedienstleitung", bezeichnung: "Pflegedienstleitung", feld: "pflege", synonyme: ["pflegedienstleitung", "pdl", "einrichtungsleitung"] },
  { schluessel: "abrechnung", bezeichnung: "Leistungsabrechnung", feld: "pflege", synonyme: ["leistungsabrechnung", "sgb xi", "sgb v", "pflegegrad"] },
  { schluessel: "tourenplanung", bezeichnung: "Tourenplanung", feld: "pflege", synonyme: ["tourenplanung", "tourenbegleitung", "ambulante tour"] },
  { schluessel: "mobilisation", bezeichnung: "Mobilisation und Transfer", feld: "pflege", synonyme: ["mobilisation", "transfer", "kinaesthetik", "bobath"] },
  { schluessel: "ernaehrungsmanagement", bezeichnung: "Ernährungsmanagement", feld: "pflege", synonyme: ["ernaehrungsmanagement", "peg", "sondenkost"] },
  { schluessel: "schmerzmanagement", bezeichnung: "Schmerzmanagement", feld: "pflege", synonyme: ["schmerzmanagement", "schmerzerfassung"] },
  { schluessel: "pflegesoftware", bezeichnung: "Pflegesoftware", feld: "pflege", synonyme: ["vivendi", "dan produkte", "medifox", "snap ", "orbis", "pflegesoftware"] },
];

/** Ein Schlüssel je Eintrag — doppelte wären ein stiller Datenfehler. */
export const SCHLUESSEL: readonly string[] = KATALOG.map((k) => k.schluessel);

/**
 * Kleinschreiben, Umlaute falten, Satzzeichen zu Leerraum.
 *
 * ── Warum die Umlaute gefaltet werden ───────────────────────────
 *
 * Der deutsche Plural ändert den Stamm: „Dienstplan" wird zu
 * „Dienstpläne", und `"dienstpläne".includes("dienstplan")` ist
 * falsch. Beim ersten Versuch scheiterte genau daran die Zeile
 * „Erstellung der Dienstpläne" — die häufigste Formulierung
 * überhaupt.
 *
 * Gefaltet wird auf `ae`, `oe`, `ue`, damit dieselbe Faltung auch
 * die zweite Schreibweise trifft: „Qualitätsmanagement" und
 * „Qualitaetsmanagement" werden beide zu „qualitaetsmanagement".
 * Das ist der Grund für `ae` statt `a` — sonst fielen die beiden
 * Schreibweisen auseinander.
 */
function normalisieren(text: string): string {
  const gefaltet = text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue");
  return ` ${gefaltet.replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ")} `;
}

/**
 * Welcher Katalogeintrag in einem Text steckt.
 *
 * ── Warum das längste Synonym gewinnt ───────────────────────────
 *
 * „Praxisanleitung" enthält „anleitung". Gewönne das kürzere, landete
 * eine Praxisanleiterin unter „Einarbeitung" — und die Anforderung
 * „Praxisanleitung erwünscht" bliebe unbelegt, obwohl sie belegt ist.
 *
 * `null` heisst: kein Eintrag. Nicht „keine Fähigkeit" — nur, dass
 * der Katalog dazu nichts kennt. Der Unterschied steht in
 * `faehigkeiten.ts` und entscheidet dort über den Stand
 * `nicht_zustaendig` statt `nicht_belegt`.
 */
export function schluesselFinden(text: string): string | null {
  const t = normalisieren(text);
  let bester: { schluessel: string; laenge: number } | null = null;

  for (const eintrag of KATALOG) {
    for (const s of eintrag.synonyme) {
      const n = normalisieren(s).trim();
      if (n.length === 0 || !t.includes(n)) continue;
      if (bester === null || n.length > bester.laenge) {
        bester = { schluessel: eintrag.schluessel, laenge: n.length };
      }
    }
  }
  return bester?.schluessel ?? null;
}

/** Der Eintrag zu einem Schlüssel — für Beschriftungen in der Oberfläche. */
export function eintrag(schluessel: string): Katalogeintrag | null {
  return KATALOG.find((k) => k.schluessel === schluessel) ?? null;
}
