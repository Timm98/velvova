/**
 * Filter, die einander widersprechen — und der Löschschutz.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Fehler, die dieselbe Ursache haben
 * ══════════════════════════════════════════════════════════════
 *
 * Beide entstehen, wenn ein Sprachmodell über Filter entscheidet:
 *
 *   1. Es nimmt einen Filter weg, den niemand weggenommen haben
 *      wollte. Der verschwindet lautlos, und die Liste wird
 *      unerklärlich grösser.
 *
 *   2. Es setzt einen Filter, der zu einem bestehenden nicht passt.
 *      „Nur remote" und „30 km um Karlsruhe" ergeben zusammen eine
 *      leere Liste — und die sieht aus wie ein leerer Arbeitsmarkt,
 *      nicht wie ein Widerspruch.
 *
 * Gegen den ersten hilft eine Regel, gegen den zweiten eine Frage.
 * Beides steht hier, weil beides ohne Modell auskommt.
 */

/* ═══════════════════════════════════════════════════════════════
   Löschschutz
   ═══════════════════════════════════════════════════════════════ */

/**
 * Wörter, mit denen Menschen etwas wegnehmen.
 *
 * ── Warum eine Liste und nicht das Urteil des Modells ─────────
 *
 * Weil Löschen die einzige Richtung ist, in der ein Fehler etwas
 * zerstört. Ein zu viel gesetzter Filter fällt sofort auf — die Liste
 * wird kürzer, und der Chip steht sichtbar da. Ein zu viel gelöschter
 * fällt niemandem auf: Die Liste wird länger, und der Chip ist weg.
 *
 * Deshalb entscheidet hier nicht, was das Modell für gemeint hält,
 * sondern ob die Person Wörter benutzt hat, mit denen man etwas
 * wegnimmt.
 */
/*
 * Zwei Fallstricke, beide schon einmal dagewesen.
 *
 * ── Beugung ─────────────────────────────────────────────────
 *
 * Die erste Fassung schrieb `\blösch\b`, und „den Umkreis bitte
 * löschen" fiel durch: Nach „lösch" steht noch „en". Stämme brauchen
 * deshalb keine abschliessende Grenze.
 *
 * ── Und `\b` kennt keine Umlaute ────────────────────────────
 *
 * `\büberall\b` trifft „überall" NICHT. `\b` ist über
 * `[A-Za-z0-9_]` definiert; vor einem „ü" am Wortanfang liegt für
 * die Maschine keine Wortgrenze. Derselbe Fehler hat in diesem
 * Projekt schon zweimal ein Muster lautlos ausgeschaltet.
 *
 * Deshalb eine eigene Zeichenklasse mit Umlauten und Umschauen statt
 * `\b`.
 */
const WORTZEICHEN = "[\\wäöüÄÖÜß]";
const WEGNAHME = new RegExp(
  `(?<!${WORTZEICHEN})(?:` +
    `(?:egal|überall|beliebig|ohne|weg|raus|aufheben|zurücksetzen|vergiss|jede[rsn]?)(?!${WORTZEICHEN})` +
    `|nicht(?:s)? mehr(?!${WORTZEICHEN})` +
    `|kein${WORTZEICHEN}*` +
    `|entfern${WORTZEICHEN}*` +
    `|lösch${WORTZEICHEN}*` +
    `)`,
  "i",
);

/**
 * Ob die Eingabe überhaupt nach Wegnehmen klingt.
 *
 * `false` heisst: Was das Modell an `entfernen` zurückgibt, wird
 * verworfen. Es hat sich geirrt — und der Irrtum kostet hier nichts,
 * weil die Person den Filter jederzeit über sein Kreuz wegnehmen kann.
 */
export function darfEntfernen(eingabe: string): boolean {
  return WEGNAHME.test(eingabe);
}

/**
 * Die Löschungen, die durchkommen.
 *
 * ── Warum die Regeln davon ausgenommen sind ───────────────────
 *
 * Der Regelabgleich löscht nur, wenn er ein Wegnahme-Muster gesehen
 * hat — das ist dieselbe Prüfung, nur früher. Ihn hier ein zweites
 * Mal zu prüfen hiesse, seinem eigenen Treffer zu misstrauen.
 */
export function gepruefteEntfernungen(
  eingabe: string,
  ausRegeln: readonly string[],
  ausModell: readonly string[],
): string[] {
  const erlaubt = darfEntfernen(eingabe) ? ausModell : [];
  return [...new Set([...ausRegeln, ...erlaubt])];
}

/* ═══════════════════════════════════════════════════════════════
   Widersprüche
   ═══════════════════════════════════════════════════════════════ */

export interface Filterkonflikt {
  /** Die beiden Filter, um die es geht. */
  felder: [string, string];
  /** Die Frage an die Person — sie entscheidet, nicht wir. */
  frage: string;
  /** Wie schwer der Widerspruch wiegt. Der schwerste wird gefragt. */
  gewicht: number;
}

const REGIONEN = new Set([
  "deutschland",
  "österreich",
  "schweiz",
  "baden-württemberg",
  "baden württemberg",
  "bayern",
  "brandenburg",
  "hessen",
  "mecklenburg-vorpommern",
  "niedersachsen",
  "nordrhein-westfalen",
  "nrw",
  "rheinland-pfalz",
  "saarland",
  "sachsen",
  "sachsen-anhalt",
  "schleswig-holstein",
  "thüringen",
  "ruhrgebiet",
  "rhein-main",
  "rhein-neckar",
  "bodensee",
  "allgäu",
]);

/**
 * Ab wann ein Teilzeitgehalt als unvereinbar gilt.
 *
 * Produktentscheidung, kein Messwert. 50.000 im Jahr sind bei zwanzig
 * Wochenstunden ein Vollzeitäquivalent von hunderttausend — möglich,
 * aber selten genug, dass eine Rückfrage besser ist als eine leere
 * Liste.
 */
export const TEILZEIT_GEHALT_AB = 50_000;

/**
 * Was sich widerspricht — ohne Modell.
 *
 * ── Warum eine feste Liste ────────────────────────────────────
 *
 * Weil ein Modell, das Widersprüche „erkennt", auch welche findet,
 * wo keine sind. Ein behaupteter Widerspruch ist eine Rückfrage zu
 * etwas, das die Person bewusst so wollte — und beim dritten Mal
 * klickt sie jede Rückfrage weg, auch die richtigen.
 *
 * Diese Paare ergeben zusammen nachweislich eine leere oder sinnlose
 * Liste. Mehr steht hier nicht.
 */
export function filterkonflikte(
  filter: Record<string, string | undefined>,
): Filterkonflikt[] {
  const raus: Filterkonflikt[] = [];
  const hat = (k: string) => {
    const v = filter[k];
    return v !== undefined && v !== "";
  };

  /* Ein Umkreis um eine Stelle, die man von zuhause macht. */
  if (filter.remote === "remote" && hat("umkreisKm")) {
    raus.push({
      felder: ["remote", "umkreisKm"],
      frage:
        "Du suchst vollständig remote — dann spielt der Umkreis keine Rolle mehr. " +
        "Soll ich den Umkreis weglassen, oder ist dir ein Büro in der Nähe doch wichtig?",
      gewicht: 3,
    });
  }

  /* Ein Umkreis um ein Bundesland. */
  const ort = filter.ort?.trim().toLowerCase();
  if (ort && REGIONEN.has(ort) && hat("umkreisKm")) {
    raus.push({
      felder: ["ort", "umkreisKm"],
      frage:
        `„${filter.ort}" ist eine ganze Region — ein Umkreis darum ergibt keine sinnvolle Grenze. ` +
        "Soll ich den Umkreis weglassen, oder meinst du eine bestimmte Stadt?",
      gewicht: 3,
    });
  }

  /* Ein Praktikum mit Vollzeitgehalt. */
  const gehalt = Number(filter.gehaltAb);
  if (filter.contract === "internship" && Number.isFinite(gehalt) && gehalt > 20_000) {
    raus.push({
      felder: ["contract", "gehaltAb"],
      frage:
        `Praktika liegen fast immer deutlich unter ${gehalt.toLocaleString("de-DE")} €. ` +
        "Soll ich die Gehaltsgrenze für Praktika weglassen, oder suchst du doch eine feste Stelle?",
      gewicht: 2,
    });
  }

  /* Teilzeit mit einem Gehalt, das Vollzeit voraussetzt. */
  if (
    filter.arbeitszeit === "teilzeit" &&
    Number.isFinite(gehalt) &&
    gehalt >= TEILZEIT_GEHALT_AB
  ) {
    raus.push({
      felder: ["arbeitszeit", "gehaltAb"],
      frage:
        `${gehalt.toLocaleString("de-DE")} € in Teilzeit ist selten — das wären hochgerechnet weit über hunderttausend. ` +
        "Ist die Summe als Vollzeitgehalt gemeint, oder soll sie so stehen bleiben?",
      gewicht: 2,
    });
  }

  /* Dasselbe Wort gesucht und ausgeschlossen. */
  const gesucht = new Set(
    (filter.q ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );
  const verboten = (filter.nicht ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && gesucht.has(w));
  if (verboten.length > 0) {
    raus.push({
      felder: ["q", "nicht"],
      frage:
        `„${verboten[0]}" steht bei dir gleichzeitig in der Suche und im Ausschluss — so bleibt die Liste leer. ` +
        "Was davon gilt?",
      gewicht: 4,
    });
  }

  return raus.sort((a, b) => b.gewicht - a.gewicht);
}
