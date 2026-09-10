/**
 * ══════════════════════════════════════════════════════════════════
 * Das Arbeitsweise-Profil — was jemand über seine Arbeit sagt
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Passungswert rechnet aus sieben Faktoren. Drei davon lesen
 * genau das, was hier entsteht:
 *
 *   preferred_tasks   was Energie gibt und was sie kostet
 *   work_style        wie jemand am besten arbeitet
 *   values            was ihn hält und was ihn gehen lässt
 *
 * Am 10.09.2026 gemessen: 561 berechnete Treffer, davon 38 mit einer
 * Zahl, höchster Wert 13 von 100, mittlere Abdeckung 0,12. Das ist
 * kein niedriger Wert, sondern ein fast leerer — von sieben Faktoren
 * trug im Schnitt weniger als einer. Nicht, weil die Rechnung
 * schlecht wäre, sondern weil ihr die Hälfte der Eingaben fehlt.
 *
 * ── Was das hier ausdrücklich NICHT ist ─────────────────────────
 *
 * Keine Messung, kein Test, keine Diagnose, kein Typ, kein Score.
 * Niemand wird ausgelesen. Es ist eine Selbstbeschreibung: Der Mensch
 * sagt, wie er arbeitet, Nina fasst zusammen, er bestätigt oder
 * korrigiert. Was daraus in den Markt geht, entscheidet er einzeln.
 *
 * Der Grund ist nicht nur rechtlich. Verdeckt aus Verhalten
 * abgeleitete „Werte" sind Rauschen — die Vorhersagekraft von
 * Persönlichkeitsmessungen für Arbeitsleistung ist nach der aktuellen
 * Meta-Analyse (Sackett et al. 2022) gering. Was jemand über seine
 * eigene Arbeit sagt, ist die bessere Auskunft und die billigere.
 *
 * ── Warum die Schutzgrenze in Code steht ────────────────────────
 *
 * Menschen erzählen im Gespräch über ihre Arbeit von ihrer
 * Gesundheit, ihren Kindern, ihrem Alter. Das ist normal und ehrlich
 * gemeint. Es darf trotzdem nicht ins Profil, weil aus dem Profil
 * Suchkriterien werden — und ein Kriterium aus einem geschützten
 * Merkmal ist eine Diskriminierung, auch wenn der Betroffene sie
 * selbst eingebaut hat.
 *
 * Ein Prompt, der das verhindern soll, verhindert es meistens. Diese
 * Datei prüft danach.
 */

/**
 * Die fünf Dimensionen des Gesprächs.
 *
 * Eine sechste — die Belege — steht bewusst nicht hier: Sie entsteht
 * aus dem Fähigkeitsnachweis und nicht aus einer Selbstauskunft. Sie
 * hier zu führen hiesse, beides in einen Topf zu werfen.
 */
export const DIMENSIONEN = [
  "energie",
  "arbeitsstil",
  "haltegruende",
  "schwerpunkte",
  "lernrichtung",
] as const;
export type Dimension = (typeof DIMENSIONEN)[number];

/**
 * Wohin eine Dimension im Bestand geschrieben wird.
 *
 * ── Warum diese Zeichenketten wörtlich stimmen müssen ───────────
 *
 * `profilkontext.ts` sucht Belege über `source_ref like '%…%'`. Ein
 * Tippfehler hier erzeugt Belege, die niemand liest — und der
 * Passungswert bliebe leer, während die Oberfläche ein volles Profil
 * zeigt. Ein Test hält beide Seiten aneinander.
 */
export const KENNUNG: Record<Dimension, string> = {
  energie: "tasks_and_energy",
  arbeitsstil: "work_style_and_environment",
  haltegruende: "values_and_motives",
  schwerpunkte: "tasks_and_energy",
  lernrichtung: "learning_goals",
};

/** Die Belegart je Dimension — dieselbe Reihe wie `evidence_type`. */
export const BELEGART: Record<Dimension, "preference" | "motive" | "work_environment"> = {
  energie: "preference",
  arbeitsstil: "work_environment",
  haltegruende: "motive",
  schwerpunkte: "preference",
  lernrichtung: "motive",
};

/**
 * Die Vorsätze, an denen der Leser die Richtung erkennt.
 *
 * ── Warum das nötig ist ─────────────────────────────────────────
 *
 * `profilkontext.ts` trennt Energiegebendes von Kraftkostendem nicht
 * über ein Feld, sondern über Wörter im Satz:
 *
 *   energisch  /energie gibt|geben energie|leicht/i
 *   zehrend    /kostet|laugt|vermeide|falsch an/i
 *
 * Trifft keine der beiden Reihen, fällt der Leser auf „alles unter
 * `tasks_and_energy` gibt Energie" zurück — und dann zählt genau das,
 * was jemanden auslaugt, als das, was ihm Kraft gibt. Der
 * Passungswert würde ihm Stellen empfehlen, die er gerade beschrieben
 * hat, um sie zu vermeiden.
 *
 * Ein Test unten hält diese Vorsätze an den Mustern des Lesers fest.
 */
export const VORSATZ = {
  gibt: "Fällt mir leicht: ",
  kostet: "Kostet mich Kraft: ",
} as const;

export interface Dimensionstext {
  frage: string;
  /** Die Nachfrage nach einem Beispiel. Ohne sie bleiben es Adjektive. */
  nachfrage: string;
  ueberschrift: string;
}

/**
 * Die Fragen.
 *
 * Jede fragt nach Tätigkeiten, nicht nach Eigenschaften. „Bist du
 * teamfähig?" beantwortet jeder mit ja; „Erzähl mir von einem Tag, an
 * dem du abends dachtest: so sollte es immer sein" beantwortet
 * niemand mit einer Floskel.
 */
export const TEXTE: Record<Dimension, Dimensionstext> = {
  energie: {
    ueberschrift: "Was dir leichtfällt und was dich Kraft kostet",
    frage:
      "Erzähl mir von einem Tag im letzten Monat, an dem du abends dachtest: So sollte es immer sein. Was hast du an dem Tag gemacht?",
    nachfrage: "Und was war zuletzt das Gegenteil — ein Tag, nach dem du leer warst? Woran lag es?",
  },
  arbeitsstil: {
    ueberschrift: "Wie du am besten arbeitest",
    frage:
      "Wenn du an deine beste Arbeit denkst: Warst du allein oder mit anderen, nach Plan oder aus der Lage heraus, in Ruhe oder im Takt?",
    nachfrage: "Woran hast du gemerkt, dass es so besser läuft?",
  },
  haltegruende: {
    ueberschrift: "Was dich hält und was dich gehen lässt",
    frage:
      "Warum bist du bei deiner letzten Stelle so lange geblieben — oder warum bist du gegangen?",
    nachfrage: "Was hätte anders sein müssen, damit du geblieben wärst?",
  },
  schwerpunkte: {
    ueberschrift: "Womit du schlecht umgehst",
    frage:
      "Was gibt es an Arbeit, von der du weisst, dass sie dir nicht liegt — auch wenn du sie kannst?",
    nachfrage: "Ist das etwas, das du vermeiden willst, oder etwas, das du in Kauf nimmst?",
  },
  lernrichtung: {
    ueberschrift: "Was du lernen willst",
    frage: "In welche Richtung willst du in den nächsten Jahren besser werden?",
    nachfrage: "Gibt es etwas, das du dafür heute schon tust?",
  },
};

/* ── Die Schutzgrenze ── */

/**
 * Merkmale, die nicht ins Profil gehören.
 *
 * Nicht, weil sie unwichtig wären — sondern weil aus dem Profil
 * Suchkriterien werden. Ein Kriterium, das an Gesundheit, Alter,
 * Herkunft, Religion oder Familie hängt, ist eine Diskriminierung,
 * auch wenn der Betroffene es selbst formuliert hat.
 *
 * Die Stämme sind hinten offen: Deutsch beugt, und `\\bkrank\\b`
 * trifft „kranken" nicht. Derselbe Fehler wie in `wunschprofil.ts`,
 * dort einmal gemacht.
 */
export const SCHUTZMERKMALE: readonly { muster: RegExp; merkmal: string }[] = [
  { muster: /\b(krank|gesundheit|rücken|bandscheib|depress|burnout|therapie|medikament|behinder|schwanger|reha\b)/i, merkmal: "Gesundheit" },
  { muster: /\b(kind(er)?\b|kita|schulkind|alleinerziehend|pflege\s+meiner|ehemann|ehefrau|partner\b)/i, merkmal: "Familie" },
  { muster: /\b(bin\s+\d{2}\b|mit\s+\d{2}\s+jahren|jahrgang\s+\d{4}|kurz\s+vor\s+der\s+rente|zu\s+alt|zu\s+jung)/i, merkmal: "Alter" },
  { muster: /\b(herkunft|migrations|geflüchtet|staatsangehörig|meine\s+heimat|nicht\s+aus\s+deutschland)/i, merkmal: "Herkunft" },
  { muster: /\b(religion|kirche|moschee|muslim|christ|jüdisch|glaube\b)/i, merkmal: "Religion" },
  { muster: /\b(schwul|lesbisch|queer|transgeschlecht|sexuelle\s+orientierung)/i, merkmal: "Sexuelle Identität" },
];

export interface Ausgeschlossen {
  aussage: string;
  merkmal: string;
  erklaerung: string;
}

/**
 * Was aus einer Aussagenliste herausfällt.
 *
 * ── Warum erklärt wird, statt still zu löschen ──────────────────
 *
 * Weil der Mensch es erzählt hat und wissen soll, warum es nicht
 * gespeichert wird. Ein Feld, das Gesagtes verschluckt, sieht aus wie
 * ein Fehler — und beim nächsten Mal erzählt er es wieder.
 */
export function aussagenPruefen(aussagen: readonly string[]): {
  bleiben: string[];
  ausgeschlossen: Ausgeschlossen[];
} {
  const bleiben: string[] = [];
  const ausgeschlossen: Ausgeschlossen[] = [];
  for (const a of aussagen) {
    const treffer = SCHUTZMERKMALE.find((s) => s.muster.test(a));
    if (treffer) {
      ausgeschlossen.push({
        aussage: a,
        merkmal: treffer.merkmal,
        erklaerung:
          `Das gehört dir und nicht in dein Profil. Aus dem Profil werden Suchkriterien, ` +
          `und ein Kriterium, das an ${treffer.merkmal.toLowerCase()} hängt, würde dich aussortieren ` +
          `statt dir zu helfen. Wenn sich daraus eine Bedingung ergibt — etwa keine Nachtschicht —, ` +
          `sag mir die Bedingung, nicht den Grund.`,
      });
    } else {
      bleiben.push(a);
    }
  }
  return { bleiben, ausgeschlossen };
}

/**
 * Wörter, die nichts aussagen.
 *
 * „Teamfähig", „belastbar", „flexibel" beschreiben niemanden — sie
 * sind das, was in Stellenanzeigen steht, und wer sie über sich
 * selbst sagt, hat die Frage nicht beantwortet. Sie zu speichern
 * hiesse, den Passungswert mit Rauschen zu füllen und ihm damit
 * genau die Abdeckung vorzutäuschen, die ihm fehlt.
 */
export const LEERFORMELN: readonly RegExp[] = [
  /^\s*(sehr\s+)?(teamfähig|belastbar|flexibel|motiviert|engagiert|zuverlässig|kommunikativ|strukturiert|lernbereit|dynamisch)\s*\.?\s*$/i,
];

export function istLeerformel(aussage: string): boolean {
  return LEERFORMELN.some((m) => m.test(aussage.trim()));
}

export interface Profileintrag {
  dimension: Dimension;
  aussagen: readonly string[];
  /** Darf daraus ein Suchkriterium werden? Standard: nein. */
  freigegeben: boolean;
}

export type Eintragslage =
  | { art: "uebernommen"; aussagen: string[]; ausgeschlossen: Ausgeschlossen[] }
  | { art: "zu_duenn"; hinweis: string; ausgeschlossen: Ausgeschlossen[] };

/** Kürzer als das ist keine Aussage über die eigene Arbeit. */
export const MINDESTLAENGE = 12;

/**
 * Eine Dimension prüfen, bevor sie gespeichert wird.
 *
 * Drei Filter, in dieser Reihenfolge: geschützte Merkmale raus,
 * Leerformeln raus, zu Kurzes raus. Bleibt nichts übrig, wird nichts
 * gespeichert — ein leerer Eintrag wäre schlimmer als keiner, weil er
 * die Frage als beantwortet markiert.
 */
export function eintragPruefen(aussagen: readonly string[]): Eintragslage {
  const { bleiben, ausgeschlossen } = aussagenPruefen(aussagen);
  const brauchbar = bleiben
    .map((a) => a.trim())
    .filter((a) => a.length >= MINDESTLAENGE && !istLeerformel(a));

  if (brauchbar.length === 0) {
    return {
      art: "zu_duenn",
      hinweis:
        "Daraus kann ich nichts machen. Sag es an einem Beispiel aus deinem Arbeitsalltag — was hast du getan, und was war daran gut oder schlecht?",
      ausgeschlossen,
    };
  }
  return { art: "uebernommen", aussagen: brauchbar, ausgeschlossen };
}

/**
 * Wie weit das Profil ist.
 *
 * Heisst `profilfortschritt` und nicht `fortschritt`: Der kürzere Name
 * gehört im Domänenpaket dem Nachtlauf. Zwei gleichnamige Funktionen
 * für zwei verschiedene Fortschritte wären die Art Mehrdeutigkeit, die
 * man beim Lesen nicht bemerkt.
 *
 * Als Anteil der Dimensionen mit mindestens einer Aussage — nicht als
 * Prozentzahl einer Vollständigkeit, die niemand definieren kann.
 */
export function profilfortschritt(eintraege: readonly Profileintrag[]): {
  gefuellt: number;
  gesamt: number;
  offen: Dimension[];
} {
  const gefuellt = new Set(
    eintraege.filter((e) => e.aussagen.length > 0).map((e) => e.dimension),
  );
  return {
    gefuellt: gefuellt.size,
    gesamt: DIMENSIONEN.length,
    offen: DIMENSIONEN.filter((d) => !gefuellt.has(d)),
  };
}

/**
 * Der Satz, den Nina zurückspiegelt.
 *
 * ── Warum gespiegelt wird ───────────────────────────────────────
 *
 * Weil ein Profil, das jemand nicht wiedererkennt, ihm nicht gehört —
 * und weil das Zurückgeben die einzige Stelle ist, an der ein
 * Missverständnis auffällt, bevor es zu einem Suchkriterium wird.
 */
export function spiegel(dimension: Dimension, aussagen: readonly string[]): string {
  const liste = aussagen.slice(0, 3).join("; ");
  switch (dimension) {
    case "energie":
      return `Also: ${liste}. Stimmt das so?`;
    case "arbeitsstil":
      return `Du arbeitest am besten so: ${liste}. Trifft das zu?`;
    case "haltegruende":
      return `Was dich hält, ist ${liste}. Habe ich das richtig verstanden?`;
    case "schwerpunkte":
      return `Nicht liegt dir: ${liste}. Soll das eine Bedingung werden oder nur ein Hinweis?`;
    case "lernrichtung":
      return `Du willst in Richtung ${liste}. Passt das?`;
  }
}
