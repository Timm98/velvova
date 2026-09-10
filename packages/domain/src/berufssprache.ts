/**
 * ══════════════════════════════════════════════════════════════════
 * Dasselbe Leben, zwei Sprachen
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine Pflegefachkraft kann „Fachleitung Sicherheit und Ordnung" für
 * 61.653 € — gemessen, nicht behauptet. Sie bewirbt sich nie darauf.
 * Nicht weil sie es nicht könnte, sondern weil in ihrem Lebenslauf
 * „Hygienebeauftragte der Station" steht und niemand in einer
 * Verwaltung dieses Wort liest. Gemeint ist Ordnungsverantwortung mit
 * gesetzlicher Prüfpflicht, jährlich extern auditiert.
 *
 * Beide Sätze beschreiben dieselbe Arbeit. Der eine bekommt eine
 * Absage, der andere ein Gespräch.
 *
 * ── Warum `analyseClaims` hier nicht reicht ─────────────────────
 *
 * Die vorhandene Belegprüfung in `packages/documents/src/claims.ts`
 * sucht zu jedem Satz einen Beleg über WORTÜBERLAPPUNG. Genau das
 * kann eine Übersetzung nicht bestehen: Sie benutzt absichtlich
 * andere Wörter. „Hygienebeauftragte" und „Ordnungsverantwortung"
 * haben kein gemeinsames Wort, und die Prüfung würde die richtige
 * Übersetzung als Erfindung blockieren.
 *
 * Diese Datei prüft deshalb etwas anderes. Der Beleg wird nicht
 * gesucht, sondern mitgeliefert: Jede übersetzte Zeile trägt die
 * Erfahrung, aus der sie stammt. Geprüft wird nur noch die eine
 * Frage, auf die es dann ankommt —
 *
 *     Behauptet die Übersetzung MEHR als das Original?
 *
 * ── Warum das die ganze Grenze ist ──────────────────────────────
 *
 * Übersetzung und Schönfärberei unterscheiden sich nicht im Ton,
 * sondern im Inhalt. „Ordnungsverantwortung mit Prüfpflicht" für
 * „Hygienebeauftragte" ist eine Übersetzung. „Leitung des
 * Qualitätsmanagements" für dieselbe Zeile ist eine Lüge — sie fügt
 * eine Leitungsfunktion hinzu, die nirgends stand.
 *
 * Wer beides vermischt, verliert nicht ein Bewerbungsgespräch,
 * sondern die Grundlage des Produkts: Ein Arbeitgeber, der einmal
 * eine übersetzte Bewerbung als Schönfärberei erlebt, liest die
 * nächste nicht mehr.
 */

/* ── Was eine Übersetzung nie hinzufügen darf ────────────────── */

/**
 * Wörter, die eine Qualifikation behaupten.
 *
 * Steht eines davon in der Übersetzung und nicht im Original, ist eine
 * Prüfung, ein Abschluss oder eine Anerkennung erfunden worden — und
 * das ist der Unterschied zwischen einer anderen Formulierung und
 * einer anderen Person.
 */
const QUALIFIKATION =
  /\b(zertifizier\w*|zertifikat|geprüfte?r?\b|staatlich anerkannt\w*|approbiert\w*|examiniert\w*|abschluss|diplom|bachelor|master|meisterbrief|lizenz\w*|akkreditiert\w*|befähigungsnachweis)\b/i;

/**
 * Wörter, die eine Führungsrolle behaupten.
 *
 * „Vertretung der Leitung" ist etwas anderes als „Leitung". Der
 * Unterschied ist im Lebenslauf zwei Wörter und im Gespräch die
 * ganze Frage.
 */
const FUEHRUNG =
  /\b(leitung|leiter\w*|geleitet|führungsverantwortung|disziplinarisch\w*|vorgesetzt\w*|weisungsbefugt\w*|budgetverantwortung|personalverantwortung)\b/i;

/**
 * Wertungen. Sie behaupten nichts Prüfbares und tragen deshalb
 * nichts — aber sie machen aus einer Beschreibung eine Anpreisung,
 * und genau daran erkennt ein Personaler geschönten Text.
 */
const WERTUNG =
  /\b(hervorragend\w*|exzellent\w*|ausgezeichnet\w*|herausragend\w*|erstklassig\w*|umfassend\w*|langjährig\w*|profund\w*|tiefgreifend\w*|maßgeblich\w*|federführend\w*)\b/i;

export type Verstoss =
  | { art: "qualifikation"; wort: string }
  | { art: "fuehrung"; wort: string }
  | { art: "wertung"; wort: string }
  | { art: "zahl"; wert: string };

export interface Uebersetzung {
  /** Wie es im Lebenslauf steht. */
  original: string;
  /** Wie die Zielbranche es liest. */
  fassung: string;
  /** Woher die Erfahrung stammt — die Kennung der Station im Verlauf. */
  belegId: string;
}

export type Uebersetzungsbefund =
  | { art: "gueltig" }
  | { art: "erfunden"; verstoesse: Verstoss[] }
  | { art: "unbrauchbar"; grund: "kein_original" | "keine_fassung" | "kein_beleg" | "unveraendert" };

/* Grobe Wortform für den Vergleich: Umlaute und Endungen sollen nicht
   darüber entscheiden, ob ein Wort als „schon im Original" gilt. */
function stamm(w: string): string {
  return w
    .toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/(en|er|es|em|e|n|s)$/, "");
}

/**
 * Steht dieses Wort schon im Original — auch als Teil eines Kompositums?
 *
 * ── Warum das nötig ist ─────────────────────────────────────────
 *
 * „Vertretung der Stationsleitung" enthält das Wort „Leitung", nur
 * angewachsen. Ein Vergleich am Wortanfang findet es nicht, und dann
 * gilt „Stellvertretende Leitung" als erfundene Führungsrolle, obwohl
 * sie wörtlich im Original steht. Das ist dieselbe Falle wie bei
 * `\bteamleit\b`, das „Teamleiter" nicht findet.
 *
 * Der Preis ist ein seltener Fehlschluss in die laxe Richtung:
 * „Begleiter" im Original liesse „Leiter" in der Fassung durch. Das
 * ist hinnehmbar, weil das Wort dann tatsächlich dort steht — anders
 * als beim umgekehrten Fehler, der eine korrekte Übersetzung
 * verwirft und damit die Brücke verschweigt, um die es geht.
 */
function enthaeltStamm(text: string, wort: string): boolean {
  const gesucht = stamm(wort);
  if (gesucht.length === 0) return false;
  return text
    .split(/[^\wäöüßÄÖÜ]+/)
    .filter(Boolean)
    .map(stamm)
    .some((w) => w === gesucht || (gesucht.length >= 5 && w.endsWith(gesucht)));
}

function trefferAusserhalb(fassung: string, original: string, muster: RegExp): string[] {
  const global = new RegExp(muster.source, "gi");
  const gefunden = fassung.match(global) ?? [];
  return [...new Set(gefunden)].filter((w) => !enthaeltStamm(original, w));
}

/** Zahlen im Text, ohne Jahreszahlen und ohne Prozentzeichen-Rauschen. */
function zahlen(text: string): string[] {
  return [...new Set((text.match(/\b\d{1,6}(?:[.,]\d+)?\b/g) ?? []))];
}

/**
 * Ist diese Übersetzung noch eine Übersetzung?
 *
 * Sie darf umformulieren, einordnen und den Fachbegriff der
 * Zielbranche einsetzen. Sie darf nichts hinzufügen, was der Mensch
 * nicht getan hat.
 */
export function uebersetzungPruefen(u: Uebersetzung): Uebersetzungsbefund {
  const original = (u.original ?? "").trim();
  const fassung = (u.fassung ?? "").trim();

  if (original.length === 0) return { art: "unbrauchbar", grund: "kein_original" };
  if (fassung.length === 0) return { art: "unbrauchbar", grund: "keine_fassung" };
  if (!u.belegId?.trim()) return { art: "unbrauchbar", grund: "kein_beleg" };

  /*
   * Eine Übersetzung, die nichts ändert, ist keine. Sie sieht wie
   * Arbeit aus und ist keine — und sie verstellt den Blick darauf,
   * dass für diese Zeile keine Brücke gefunden wurde.
   */
  if (stamm(original) === stamm(fassung) || original.toLowerCase() === fassung.toLowerCase()) {
    return { art: "unbrauchbar", grund: "unveraendert" };
  }

  const verstoesse: Verstoss[] = [
    ...trefferAusserhalb(fassung, original, QUALIFIKATION).map(
      (wort): Verstoss => ({ art: "qualifikation", wort }),
    ),
    ...trefferAusserhalb(fassung, original, FUEHRUNG).map(
      (wort): Verstoss => ({ art: "fuehrung", wort }),
    ),
    ...trefferAusserhalb(fassung, original, WERTUNG).map(
      (wort): Verstoss => ({ art: "wertung", wort }),
    ),
    /*
     * Zahlen sind der härteste Fall und der einfachste Test. Aus
     * „Dienstplanung für 14 Personen" darf keine für 40 werden — und
     * anders als bei Wörtern gibt es hier kein Ermessen.
     */
    ...zahlen(fassung)
      .filter((z) => !zahlen(original).includes(z))
      .map((wert): Verstoss => ({ art: "zahl", wert })),
  ];

  return verstoesse.length === 0 ? { art: "gueltig" } : { art: "erfunden", verstoesse };
}

/**
 * Was ein Mensch über einen abgelehnten Satz erfahren soll.
 *
 * Nicht „konnte nicht übersetzt werden". Wer liest, dass eine Zeile
 * fehlt, soll wissen, warum — sonst hält er das Produkt für kaputt,
 * wo es vorsichtig war.
 */
export function verstossErklaeren(v: Verstoss): string {
  switch (v.art) {
    case "qualifikation":
      return `„${v.wort}" behauptet eine Prüfung oder einen Abschluss, der in deinem Verlauf nicht steht.`;
    case "fuehrung":
      return `„${v.wort}" behauptet eine Führungsrolle. In deinem Verlauf steht sie so nicht.`;
    case "wertung":
      return `„${v.wort}" ist eine Wertung. Sie ist nicht belegbar und fällt jedem Personaler auf.`;
    case "zahl":
      return `Die Zahl ${v.wert} kommt in deiner ursprünglichen Angabe nicht vor.`;
  }
}
