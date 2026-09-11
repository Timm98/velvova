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

/** Die Felder, für die ein Startbestand geprüft ist. */
export type Berufsfeld = "pflege" | "lager";

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
   *
   * Kein Synonym trägt ein Leerzeichen als Abgrenzung. Die Grenze
   * kommt aus der Suche selbst (siehe `schluesselFinden`) — ein
   * Leerzeichen in den Daten hielt genau so lange, bis jemand
   * `.trim()` schrieb.
   */
  synonyme: readonly string[];
  /** Für welches Berufsfeld dieser Eintrag geprüft ist. */
  feld: Berufsfeld;
}

/**
 * Startbestand.
 *
 * ── Warum zwei Felder und warum dieses zweite ───────────────────
 *
 * Zuerst stand hier nur Pflege — gewählt nach der dichtesten Zelle
 * der Marktmessung (207 Arbeitgeber in Berlin). Der erste Lauf gegen
 * die 142 bestätigten Belege ergab dann null Fähigkeiten, und der
 * Grund war nicht der Katalog, sondern die Wahl: Kein einziger Beleg
 * hatte Pflegebezug. Die Belege lauten „Ladungssicherung nach VDI
 * 2700", „Kommissionierung nach Pickliste", „Warenannahme".
 *
 * Der Katalog folgt den Nutzern, nicht dem Markt. Der dichteste Markt
 * sagt, wo sich ein Pilot lohnt; die vorhandenen Belege sagen, wofür
 * heute gerechnet werden kann.
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
  { schluessel: "intensivpflege", bezeichnung: "Intensivpflege", feld: "pflege", synonyme: ["intensivpflege", "intensivstation", "anaesthesie"] },
  { schluessel: "notfallversorgung", bezeichnung: "Notfallversorgung", feld: "pflege", synonyme: ["notfall", "reanimation", "notaufnahme", "erste hilfe"] },
  { schluessel: "op_assistenz", bezeichnung: "OP-Assistenz", feld: "pflege", synonyme: ["op-assistenz", "instrumentier", "operationsdienst", "springertaetigkeit"] },
  { schluessel: "palliativpflege", bezeichnung: "Palliativpflege", feld: "pflege", synonyme: ["palliativ", "sterbebegleitung", "hospiz"] },
  { schluessel: "geriatrie", bezeichnung: "Geriatrische Pflege", feld: "pflege", synonyme: ["geriatr", "altenpflege", "seniorenpflege"] },
  { schluessel: "demenzbetreuung", bezeichnung: "Betreuung von Menschen mit Demenz", feld: "pflege", synonyme: ["demenz", "gerontopsychiatr", "validation"] },
  { schluessel: "psychiatrische_pflege", bezeichnung: "Psychiatrische Pflege", feld: "pflege", synonyme: ["psychiatr", "sozialpsychiatr"] },
  { schluessel: "paediatrie", bezeichnung: "Pflege von Kindern", feld: "pflege", synonyme: ["paediatr", "kinderkrankenpflege", "neonatolog"] },
  { schluessel: "onkologie", bezeichnung: "Onkologische Pflege", feld: "pflege", synonyme: ["onkolog", "chemotherapie", "zytostatik"] },
  { schluessel: "dialyse", bezeichnung: "Dialyse", feld: "pflege", synonyme: ["dialyse", "nephrolog", "shunt"] },
  { schluessel: "hygiene", bezeichnung: "Hygiene", feld: "pflege", synonyme: ["hygiene", "infektionsschutz", "desinfektion"] },
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
  { schluessel: "pflegesoftware", bezeichnung: "Pflegesoftware", feld: "pflege", synonyme: ["vivendi", "medifox", "orbis", "pflegesoftware"] },

  /* ── Lager und Logistik ── */
  { schluessel: "kommissionierung", bezeichnung: "Kommissionierung", feld: "lager", synonyme: ["kommissionier", "pickliste", "auftragszusammenstellung"] },
  { schluessel: "warenannahme", bezeichnung: "Warenannahme", feld: "lager", synonyme: ["warenannahme", "wareneingang", "wareneingangskontrolle", "warenausgang"] },
  { schluessel: "ladungssicherung", bezeichnung: "Ladungssicherung", feld: "lager", synonyme: ["ladungssicherung", "vdi 2700", "ladungssicherheit"] },
  { schluessel: "staplerfahren", bezeichnung: "Flurförderzeuge fahren", feld: "lager", synonyme: ["stapler", "gabelstapler", "flurfoerderzeug", "hubwagen", "schubmaststapler"] },
  { schluessel: "lagerverwaltung", bezeichnung: "Lagerverwaltungssystem", feld: "lager", synonyme: ["lagerverwaltung", "lvs", "wms", "sap ewm", "sap wm"] },
  { schluessel: "inventur", bezeichnung: "Inventur", feld: "lager", synonyme: ["inventur", "bestandskontrolle", "bestandsfuehrung"] },
  { schluessel: "verpackung", bezeichnung: "Verpackung und Versand", feld: "lager", synonyme: ["verpackung", "versandvorbereitung", "packen von", "kartonage"] },
  { schluessel: "gefahrgut", bezeichnung: "Gefahrgut", feld: "lager", synonyme: ["gefahrgut", "adr", "gefahrstoff"] },
  { schluessel: "zoll", bezeichnung: "Zoll und Ausfuhr", feld: "lager", synonyme: ["zollabwicklung", "ausfuhranmeldung", "atlas", "praeferenz"] },
  { schluessel: "disposition", bezeichnung: "Disposition", feld: "lager", synonyme: ["disposition", "tourenplanung", "frachtplanung", "speditionsauftrag"] },
  { schluessel: "qualitaetskontrolle", bezeichnung: "Qualitätskontrolle", feld: "lager", synonyme: ["qualitaetskontrolle", "wareneingangspruefung", "reklamationsbearbeitung"] },
  { schluessel: "arbeitssicherheit", bezeichnung: "Arbeitssicherheit", feld: "lager", synonyme: ["arbeitssicherheit", "unfallverhuetung", "sicherheitsunterweisung"] },
  { schluessel: "schichtfuehrung", bezeichnung: "Schichtführung", feld: "lager", synonyme: ["schichtleitung", "schichtfuehrung", "teamleitung lager", "vorarbeiter"] },
  /*
   * ── Aus dem Bestand ergänzt, 11.09.2026 ────────────────────────
   *
   * Gemessen an 12.000 Anforderungen aus Anzeigen der KldB-Gruppe 51:
   * 5.963 waren fachlich abgleichbar und hatten keinen Katalogeintrag.
   * Aufgenommen wurde, was darin mindestens fünfzehnmal wiederkehrt,
   * fachlich eindeutig ist und sich mit einer Nutzerangabe vergleichen
   * lässt. Die Zahl in Klammern ist das gemessene Vorkommen.
   *
   * ── Was ausdrücklich NICHT aufgenommen wurde ──────────────────
   *
   * Berufsbezeichnungen. „Fachkraft für Lagerlogistik" kam 90-mal vor,
   * „Lagerarbeiter" 95-mal, „Lagerhelfer" 81-mal — häufig genug, und
   * trotzdem falsch: Ein Beruf ist kein Nachweis. Wer Disponent war,
   * hat damit nicht LKW-Disposition belegt.
   *
   * SAP EWM, SAP WM, SAP MM und S/4HANA einzeln: jeweils unter
   * fünfzehn Vorkommen in diesem Cluster. Sie stehen als Synonym bei
   * `lagerverwaltung` beziehungsweise `sap`, nicht als eigener
   * Eintrag — ein Katalogeintrag für etwas, das zwölfmal vorkommt,
   * verspricht eine Unterscheidung, die die Daten nicht tragen.
   */
  { schluessel: "erp", bezeichnung: "ERP-System", feld: "lager", synonyme: ["erp-system", "erp system", "erp-kenntnis", "erp "] },
  { schluessel: "sap", bezeichnung: "SAP", feld: "lager", synonyme: ["sap"] },
  { schluessel: "warenwirtschaft", bezeichnung: "Warenwirtschaftssystem", feld: "lager", synonyme: ["warenwirtschaft", "wawi"] },
  { schluessel: "bueroanwendungen", bezeichnung: "Büroanwendungen", feld: "lager", synonyme: ["ms-office", "ms office", "microsoft office", "excel", "outlook"] },
  { schluessel: "spedition", bezeichnung: "Speditionsabwicklung", feld: "lager", synonyme: ["spedition", "speditionsabwicklung", "speditionskaufmann", "frachtabrechnung"] },
  { schluessel: "scannergebrauch", bezeichnung: "Scanner und MDE-Geräte", feld: "lager", synonyme: ["mde-geraet", "mde geraet", "handscanner", "scannergestuetzt", "barcodescanner"] },
  { schluessel: "teamfuehrung", bezeichnung: "Team führen", feld: "lager", synonyme: ["teamfuehrung", "mitarbeiterfuehrung", "fuehrung eines teams", "fuehrung von mitarbeit"] },
  { schluessel: "projektsteuerung", bezeichnung: "Projekte steuern", feld: "lager", synonyme: ["projektleitung", "projektsteuerung", "projektmanagement"] },
  { schluessel: "einkauf", bezeichnung: "Einkauf und Beschaffung", feld: "lager", synonyme: ["einkauf", "beschaffung", "bestellwesen"] },
  { schluessel: "hochregallager", bezeichnung: "Hochregallager", feld: "lager", synonyme: ["hochregal", "schmalgang"] },
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
      /*
       * Am Wortanfang, nicht irgendwo im Wort.
       *
       * Der Fehler, der das erzwungen hat, stand am 10.09.2026 mit 19
       * Zeilen in der Produktion: Das Synonym „its " (für
       * Intensivstation) trug bewusst ein Leerzeichen am Ende, und ein
       * `.trim()` hier hat es entfernt. Danach traf „its" das Wort
       * „Arbe-its-probe", und neunzehn Menschen bekamen die Fähigkeit
       * Intensivpflege aus einem Satz über eine Arbeitsprobe.
       *
       * Ein Leerzeichen davor löst das allgemein, statt es je Synonym
       * von Hand zu regeln: Deutsche Komposita tragen den gesuchten
       * Stamm vorn („Dienstplan-gestaltung"), nie mitten im Wort.
       */
      if (n.length === 0 || !t.includes(` ${n}`)) continue;
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
