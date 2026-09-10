/**
 * ══════════════════════════════════════════════════════════════════
 * Aus einem gesprochenen Satz wird ein Angebot — oder eben nicht
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein kleiner Betrieb sagt in neunzig Sekunden, wen er sofort nehmen
 * würde. Daraus soll ein Angebot werden: Rolle, Konditionen, Frist —
 * etwas, gegen das der Nachtlauf rechnen kann.
 *
 * Der Satz, an dem sich alles entscheidet, klingt harmlos:
 *
 *   „…aber bitte keinen, der ständig krank ist, und nicht über
 *    fünfzig."
 *
 * Er fällt in fast jedem echten Gespräch. Er ist nach § 1 AGG
 * unzulässig, und er ist gleichzeitig ehrlich gemeint — der Betrieb
 * will niemanden benachteiligen, er redet, wie man redet.
 *
 * ── Warum diese Regel nicht im Prompt stehen darf ───────────────
 *
 * „Streiche unzulässige Wünsche" ist eine Bitte. Ein Modell, das ein
 * Transkript in ein Angebot verwandeln soll, wird gehorchen — meistens.
 * Bei Dialekt, bei Nebengeräuschen, bei einer Formulierung, die es so
 * noch nicht gesehen hat, wird es einmal nicht gehorchen, und dann
 * steht ein Altersfilter in einem Angebot, das Velvova gespeichert hat.
 *
 * Deshalb prüft diese Datei das Ergebnis, nachdem das Modell fertig
 * ist. Sie kennt kein Transkript und keine Überredung, nur Muster.
 *
 * ── Warum das Gestrichene sichtbar bleibt ───────────────────────
 *
 * Zwei Gründe. Es ist der Nachweis, dass es entfernt wurde — und es
 * ist die einzige Gelegenheit, dass der Betrieb erfährt, warum. Wer
 * es stillschweigend löscht, bekommt denselben Satz beim nächsten Mal
 * wieder.
 */

/** Höchstens so viele Rückfragen auf einmal. Bei vier bricht jemand ab. */
export const MAX_RUECKFRAGEN = 3;

/**
 * Merkmale, nach denen niemand ausgewählt werden darf (§ 1 AGG).
 *
 * Die Muster sind bewusst weit: Lieber einen zulässigen Wunsch
 * streichen und nachfragen, als einen unzulässigen speichern.
 *
 * ── Warum die Stämme hinten offen sind ──────────────────────────
 *
 * `\bmännlich\b` trifft „männlich" und nicht „männliche". Deutsch
 * beugt, und ein Muster mit Wortgrenze am Ende geht an genau den
 * Formen vorbei, in denen so ein Wunsch tatsächlich vorkommt — „nur
 * männliche Bewerber", „möglichst junge Leute", „keine kranken
 * Mitarbeiter". Die Grenze steht deshalb nur vorn.
 *
 * Ein Test unten prüft die gebeugten Formen einzeln, weil dieser
 * Fehler beim Lesen unsichtbar ist: Das Muster sieht richtig aus.
 */
export const UNZULAESSIG: readonly { muster: RegExp; merkmal: string }[] = [
  { muster: /\b(nicht|kein[en]?|max\.?|höchstens|unter|über)\s*(älter|jünger)?\s*(als\s*)?\d{2}\s*(jahre|jährig)/i, merkmal: "Alter" },
  { muster: /\b(nicht|kein[en]?)\s+(über|unter)\s+\d{2}\b/i, merkmal: "Alter" },
  { muster: /\b(jung|jugendlich|altersgruppe|generation\s+[xyz])/i, merkmal: "Alter" },
  { muster: /\b(männlich|weiblich|geschlecht|kein[e]?\s+(männer|frauen)|nur\s+(männer|frauen))/i, merkmal: "Geschlecht" },
  /*
   * `mutter` ohne die Ausnahme träfe „Muttersprachler" — und meldete
   * dann Familienstand, wo es um Herkunft geht. Gestrichen würde beides,
   * aber mit der falschen Begründung, und die liest der Betrieb.
   */
  { muster: /\b(mutter(?!sprach)|mütter|vater(?!land)|väter|kinderlos|familienplanung|schwanger|elternzeit|familienstand)/i, merkmal: "Familienstand oder Schwangerschaft" },
  { muster: /\b(muttersprachler|kein[e]?\s+ausländer|migrationshintergrund|nationalität|herkunftsland|staatsangehörig)/i, merkmal: "Herkunft" },
  { muster: /\b(kopftuch|religion|konfession|muslim|christlich)/i, merkmal: "Religion" },
  { muster: /\b(gesund|krank|fehlzeiten|behinder|handicap)/i, merkmal: "Gesundheit oder Behinderung" },
  { muster: /\b(gepflegt|attraktiv|schlank|tätowier|piercing)/i, merkmal: "Aussehen" },
];

export interface Streichung {
  wunsch: string;
  grund: string;
}

/**
 * Was aus einer Anforderungsliste heraus muss.
 *
 * Gibt beides zurück: was bleibt, und was gestrichen wurde. Die
 * Aufrufstelle darf das Zweite nicht wegwerfen.
 */
export function anforderungenPruefen(anforderungen: readonly string[]): {
  bleiben: string[];
  gestrichen: Streichung[];
} {
  const bleiben: string[] = [];
  const gestrichen: Streichung[] = [];
  for (const a of anforderungen) {
    const treffer = UNZULAESSIG.find((u) => u.muster.test(a));
    if (treffer) {
      gestrichen.push({
        wunsch: a,
        grund: `${treffer.merkmal} ist nach dem Allgemeinen Gleichbehandlungsgesetz kein zulässiges Auswahlkriterium.`,
      });
    } else {
      bleiben.push(a);
    }
  }
  return { bleiben, gestrichen };
}

/**
 * Die Angaben, ohne die ein Angebot keines ist.
 *
 * ── Warum das Gehalt dabei ist und die Frist auch ───────────────
 *
 * Ein Angebot ist eine Zahl, für die jemand geradesteht. Ohne Betrag
 * ist es eine Absichtserklärung, und ohne Frist eine, die nie endet —
 * beides wäre am Aufdecken wertlos, weil es nichts gibt, woran sich
 * der Arbeitgeber halten müsste.
 */
export const PFLICHTFELDER = [
  "rolle",
  "gehalt",
  "arbeitszeit",
  "ort",
  "befristung",
  "gueltigkeit",
] as const;
export type Pflichtfeld = (typeof PFLICHTFELDER)[number];

/**
 * Die Rückfrage je fehlendem Feld — in einem Satz beantwortbar.
 *
 * Fest formuliert, weil sie an jemanden geht, der gerade neunzig
 * Sekunden gesprochen hat und keine Lust auf ein Formular hat.
 */
export const RUECKFRAGE: Record<Pflichtfeld, string> = {
  rolle: "Welche Rolle genau suchen Sie — wie würden Sie die Stelle nennen?",
  gehalt: "Was zahlen Sie dafür mindestens brutto im Monat?",
  arbeitszeit: "Vollzeit oder Teilzeit — und wie viele Stunden?",
  ort: "An welchem Ort wird gearbeitet, und ginge etwas davon von zu Hause?",
  befristung: "Unbefristet oder befristet?",
  gueltigkeit: "Wie lange soll dieses Angebot gelten — 30 oder 60 Tage?",
};

/**
 * Die Reihenfolge der Wichtigkeit.
 *
 * Die Rolle zuerst, weil ohne sie nichts zugeordnet werden kann. Dann
 * das Geld, weil es die häufigste Lücke ist und die einzige, an der
 * ein Angebot am Aufdecken scheitert.
 */
const RANG: Pflichtfeld[] = ["rolle", "gehalt", "arbeitszeit", "ort", "befristung", "gueltigkeit"];

export interface Entwurf {
  rolle: string | null;
  anforderungen: readonly string[];
  gehaltVon: number | null;
  gehaltBis: number | null;
  arbeitszeit: string | null;
  ort: string | null;
  befristung: string | null;
  gueltigTage: number | null;
}

export type Wunschlage =
  | { art: "vollstaendig"; gestrichen: Streichung[] }
  | { art: "unvollstaendig"; fehlend: Pflichtfeld[]; fragen: string[]; gestrichen: Streichung[] }
  | { art: "leer" };

/**
 * Was noch fehlt — und was gefragt wird.
 *
 * ── Warum nie mehr als drei Fragen ──────────────────────────────
 *
 * Weil danach niemand mehr antwortet. Fehlen fünf Angaben, kommen
 * die drei wichtigsten; der Rest kommt in der nächsten Runde. Ein
 * Angebot in zwei Runden ist besser als keines nach einem Formular.
 */
export function lagePruefen(e: Entwurf): Wunschlage {
  const { gestrichen } = anforderungenPruefen(e.anforderungen);

  /*
   * Ohne Rolle und ohne jede Bedingung ist nichts angekommen. Dann
   * eine Rückfragenliste zu erzeugen hiesse, ein Formular zu stellen,
   * wo ein Gespräch gescheitert ist.
   */
  if (
    !e.rolle &&
    e.gehaltVon === null &&
    !e.arbeitszeit &&
    !e.ort &&
    e.anforderungen.length === 0
  ) {
    return { art: "leer" };
  }

  const fehlend: Pflichtfeld[] = [];
  if (!e.rolle) fehlend.push("rolle");
  if (e.gehaltVon === null) fehlend.push("gehalt");
  if (!e.arbeitszeit) fehlend.push("arbeitszeit");
  if (!e.ort) fehlend.push("ort");
  if (!e.befristung) fehlend.push("befristung");
  if (e.gueltigTage === null) fehlend.push("gueltigkeit");

  if (fehlend.length === 0) return { art: "vollstaendig", gestrichen };

  const sortiert = RANG.filter((f) => fehlend.includes(f));
  return {
    art: "unvollstaendig",
    fehlend: sortiert,
    fragen: sortiert.slice(0, MAX_RUECKFRAGEN).map((f) => RUECKFRAGE[f]),
    gestrichen,
  };
}

/**
 * Liegt das genannte Gehalt deutlich unter dem, was üblich ist?
 *
 * ── Warum das gesagt wird, obwohl es unangenehm ist ─────────────
 *
 * Weil ein Angebot unter Markt am Aufdecken scheitert und der Betrieb
 * dann glaubt, das Verfahren tauge nichts. Ihm vorher die Zahl zu
 * nennen, ist die einzige Gelegenheit, an der er es noch ändern kann.
 *
 * `null` heisst: kein Vergleich möglich. Dann wird nichts behauptet.
 */
export const DEUTLICH_DARUNTER = 0.85;

export function unterMarkt(gehaltVon: number | null, medianMarkt: number | null): boolean | null {
  if (gehaltVon === null || medianMarkt === null || medianMarkt <= 0) return null;
  return gehaltVon < medianMarkt * DEUTLICH_DARUNTER;
}

/**
 * Der Satz zur Verbindlichkeit — vor der Bestätigung, nicht danach.
 *
 * Er steht hier und nicht im Modelltext, weil er die eine Zusage ist,
 * auf die sich später jemand berufen wird.
 */
export function verbindlichkeitshinweis(gueltigTage: number): string {
  return (
    `Was Sie hier bestätigen, gilt ${gueltigTage} Tage lang. Findet sich jemand, ` +
    `der zu diesen Bedingungen passt, und decken Sie beide auf, dann sind das die ` +
    `Bedingungen — nicht ein Ausgangspunkt für Verhandlungen.`
  );
}
