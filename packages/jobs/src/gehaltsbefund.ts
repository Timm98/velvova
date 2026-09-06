/**
 * Alle Gehaltsangaben einer Anzeige — getrennt, nicht verrechnet.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den diese Datei verhindert
 * ══════════════════════════════════════════════════════════════
 *
 * `gehaltAusText` liefert die ERSTE Angabe, die es findet. Bei einer
 * Anzeige, die an einer Stelle „7.000–10.000 € pro Monat" verspricht
 * und an anderer „3.000–7.000 € je nach Qualifikation und Leistung"
 * einräumt, entscheidet damit die Reihenfolge im Text darüber, was
 * jemand als sein Gehalt liest.
 *
 * Beide Zahlen stehen da. Beide stammen vom Arbeitgeber. Sie zu
 * mitteln, die höhere zu nehmen oder die erste zu nehmen ist jeweils
 * eine Erfindung — und die gefährlichste Art davon, weil sie wie eine
 * Tatsache aussieht.
 *
 * ══════════════════════════════════════════════════════════════
 * Was stattdessen passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Alle Angaben bleiben nebeneinander stehen, mit ihrer Textstelle.
 * Der Befund sagt, was daraus folgt: dass es unterschiedliche Angaben
 * gibt, und dass kein garantiertes Fixgehalt erkennbar ist.
 *
 * Das ist weniger, als eine Zahl zu nennen. Es ist aber das, was die
 * Anzeige hergibt.
 */

export type Zeitraum = "year" | "month" | "hour";

export type Gehaltsangabe = {
  min: number | null;
  max: number | null;
  waehrung: string;
  /**
   * Der Zeitraum — oder `null`, wenn die Anzeige ihn nicht nennt.
   *
   * `null` ist nicht dasselbe wie „Jahr". Ein Vorgabewert hier hat
   * die Angabe „3.000 - 7.000 EUR" aus dem Testfall verschluckt: Als
   * Jahresgehalt gelesen fiel sie durch die Plausibilitätsprüfung, und
   * damit verschwand ausgerechnet die Angabe, die den Widerspruch
   * ausmacht.
   */
  zeitraum: Zeitraum | null;
  /** Die Textstelle. Ohne sie ist die Angabe nicht prüfbar. */
  beleg: string;
  /**
   * Wie fest die Angabe ist.
   *
   * `fix` — ohne Vorbehalt genannt.
   * `bedingt` — „je nach", „abhängig von", „bis zu".
   * `variabel` — Provision, Erfolgsbeteiligung, Bonus.
   */
  art: "fix" | "bedingt" | "variabel";
};

export type Gehaltsbefund = {
  angaben: Gehaltsangabe[];
  /** Ob sich daraus ein verlässlicher Betrag ableiten lässt. */
  eindeutig: boolean;
  /** Was die Person wissen muss. Leer, wenn alles klar ist. */
  hinweise: string[];
};

const BETRAG = String.raw`\d{1,3}(?:[.\s]\d{3})+|\d{4,6}|\d{1,3}(?:,\d{2})?`;

/** Wörter, die eine Angabe an Bedingungen knüpfen. */
const BEDINGT =
  /je nach|abhängig von|abhaengig von|bis zu|nach Vereinbarung|nach Absprache|richtet sich nach|orientiert sich an/i;

/** Wörter, die auf variable Bestandteile hinweisen. */
const VARIABEL =
  /provision|erfolgsbeteiligung|bonus|tantieme|umsatzbeteiligung|prämie|praemie|variable[rn]? (?:anteil|verg)/i;

/** Wörter, mit denen ein Fixgehalt ausdrücklich zugesagt wird. */
const ZUGESAGT = /fixgehalt|grundgehalt|festgehalt|garantiert|mindestens|ab \d/i;

const GRENZEN: Record<Zeitraum, { min: number; max: number }> = {
  year: { min: 12_000, max: 500_000 },
  month: { min: 1_000, max: 40_000 },
  hour: { min: 10, max: 400 },
};

function zahl(roh: string): number {
  return Number(roh.replace(/[.\s]/g, "").replace(",", "."));
}

/**
 * Den Zeitraum aus der Umgebung lesen — oder `null`.
 *
 * Kein Vorgabewert. Ein angenommenes „Jahr" macht aus einer nicht
 * genannten Angabe eine falsche, und die fällt danach durch die
 * Plausibilitätsprüfung: Genau so verschwand im Testfall die Spanne
 * 3.000–7.000, also ausgerechnet die Angabe, die den Widerspruch
 * ausmacht.
 */
function zeitraumAus(umgebung: string): Zeitraum | null {
  if (/pro Stunde|je Stunde|\/\s*(?:h|Std)|stündlich|stuendlich/i.test(umgebung)) return "hour";
  if (/pro Monat|je Monat|monatlich|\/\s*Monat|p\.?\s*m\./i.test(umgebung)) return "month";
  if (/pro Jahr|jährlich|jaehrlich|p\.?\s*a\.|\/\s*Jahr/i.test(umgebung)) return "year";
  return null;
}

/**
 * Den Satz um eine Fundstelle herum.
 *
 * ── Warum Satz und nicht Zeichenfenster ──────────────────────
 *
 * Der erste Anlauf nahm neunzig Zeichen in beide Richtungen. Damit
 * reichte die Umgebung der ersten Gehaltsangabe bis in den dritten
 * Satz — und weil dort „Erfolgsbeteiligung" stand, galten plötzlich
 * ALLE Angaben als variabel. Danach gab es keine feste Angabe mehr,
 * die sich mit einer anderen hätte widersprechen können, und der
 * Widerspruch verschwand.
 *
 * Ein Satz ist die richtige Einheit: „abhängig von Qualifikation"
 * bezieht sich auf die Zahl im selben Satz, nicht auf eine drei
 * Zeilen weiter.
 */
function satzUm(text: string, von: number, bis: number): string {
  const links = Math.max(
    ...[".", "!", "?", "\n", ";"].map((z) => text.lastIndexOf(z, von)),
    -1,
  );
  const rechts = [".", "!", "?", "\n", ";"]
    .map((z) => text.indexOf(z, bis))
    .filter((i) => i !== -1);
  const ende = rechts.length > 0 ? Math.min(...rechts) : text.length;
  return text.slice(links + 1, ende).replace(/\s+/g, " ").trim();
}

/**
 * Alle Gehaltsangaben im Text finden.
 */
export function alleGehaltsangaben(text: string): Gehaltsangabe[] {
  if (!text || text.length < 20) return [];

  const muster = new RegExp(
    String.raw`(${BETRAG})\s*(?:€|EUR|eur)?\s*(?:-|–|—|bis)\s*(${BETRAG})\s*(?:€|EUR|eur)|(${BETRAG})\s*(?:€|EUR|eur)`,
    "gi",
  );

  const gefunden: Gehaltsangabe[] = [];
  const gesehen = new Set<string>();

  for (const t of text.matchAll(muster)) {
    const umgebung = satzUm(text, t.index, t.index + t[0].length);
    const zeitraum = zeitraumAus(umgebung);

    const min = t[1] ? zahl(t[1]) : t[3] ? zahl(t[3]) : null;
    const max = t[2] ? zahl(t[2]) : null;

    const werte = [min, max].filter((n): n is number => n !== null);
    if (werte.length === 0) continue;

    /*
     * Plausibel als IRGENDEIN Zeitraum reicht.
     *
     * Bei genanntem Zeitraum wird gegen dessen Grenzen geprüft. Ohne
     * Angabe genügt, dass die Zahl als Stunden-, Monats- oder
     * Jahresbetrag denkbar ist — sonst hinge das Verwerfen an einer
     * Annahme, die die Anzeige nie gemacht hat.
     *
     * Der Filter bleibt wirksam: „seit 2019" und „5000 Kunden" tragen
     * kein Euro-Zeichen, „Postleitzahl 80331 €" wäre als Stundenlohn
     * zu hoch und als Jahresgehalt zu niedrig.
     */
    const passt = (g: { min: number; max: number }) =>
      werte.every((n) => n >= g.min && n <= g.max);
    const plausibel = zeitraum
      ? passt(GRENZEN[zeitraum])
      : (Object.keys(GRENZEN) as Zeitraum[]).some((z) => passt(GRENZEN[z]));
    if (!plausibel) continue;

    const schluessel = `${min}-${max}-${zeitraum}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);

    const art = VARIABEL.test(umgebung)
      ? "variabel"
      : BEDINGT.test(umgebung)
        ? "bedingt"
        : "fix";

    gefunden.push({
      min,
      max,
      waehrung: "EUR",
      zeitraum,
      beleg: umgebung.replace(/\s+/g, " ").trim(),
      art,
    });
  }

  return gefunden;
}

/**
 * Was aus den Angaben folgt.
 *
 * Die Hinweise sind bewusst zurückhaltend formuliert. „Unterschiedliche
 * Gehaltsangaben" ist eine Beobachtung über den Text; „der Arbeitgeber
 * verspricht zu viel" wäre eine Unterstellung, und dafür reicht die
 * Datenlage nie.
 */
export function gehaltsbefund(text: string): Gehaltsbefund {
  const angaben = alleGehaltsangaben(text);
  const hinweise: string[] = [];

  if (angaben.length === 0) {
    return { angaben, eindeutig: false, hinweise: ["Die Anzeige nennt kein Gehalt."] };
  }

  /*
   * Verschieden ist nicht dasselbe wie mehrfach.
   *
   * Eine Anzeige, die dieselbe Spanne zweimal nennt, ist nicht
   * widersprüchlich — sie wiederholt sich. Verglichen wird deshalb
   * über die Werte, nicht über die Anzahl der Fundstellen.
   */
  const feste = angaben.filter((a) => a.art !== "variabel");
  const verschieden =
    new Set(feste.map((a) => `${a.min}-${a.max}-${a.zeitraum}`)).size > 1;

  if (verschieden) {
    hinweise.push("Unterschiedliche Gehaltsangaben.");
  }

  const zugesagt = angaben.some((a) => a.art === "fix" && ZUGESAGT.test(a.beleg));
  const nurBedingt = feste.length > 0 && feste.every((a) => a.art === "bedingt");

  /*
   * Ein fehlender Zeitraum ist selbst eine Auskunft.
   *
   * „3.000 - 7.000 EUR" ohne „pro Monat" oder „pro Jahr" ist ein
   * Unterschied um den Faktor zwölf. Ihn stillschweigend zu ergänzen
   * wäre die teuerste Annahme in dieser Datei.
   */
  if (angaben.some((a) => a.zeitraum === null)) {
    hinweise.push("Bei mindestens einer Angabe fehlt der Zeitraum.");
  }

  if (verschieden || nurBedingt || !zugesagt) {
    hinweise.push("Garantiertes Fixgehalt nicht eindeutig angegeben.");
  }

  if (angaben.some((a) => a.art === "variabel")) {
    hinweise.push("Variable Bestandteile genannt — nicht als sicheres Einkommen gerechnet.");
  }

  return {
    angaben,
    /* Eindeutig nur, wenn genau eine feste Angabe dasteht und nichts
       sie einschränkt. Alles andere lässt Spielraum, und Spielraum
       gehört benannt statt weggerechnet. */
    eindeutig: hinweise.length === 0,
    hinweise,
  };
}
