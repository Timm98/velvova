/**
 * ══════════════════════════════════════════════════════════════════
 * Die Brücke — was ein Mensch heute schon antreten könnte
 * ══════════════════════════════════════════════════════════════════
 *
 * Gemessen am 10.9.2026 an 300 deutschen Anzeigen, für eine
 * Pflegefachkraft mit neun Jahren Erfahrung: 33 % der Stellen wären
 * erreichbar, 8 % davon bei mindestens gleichem Gehalt. Hochgerechnet
 * rund 22.600 Stellen im Bestand — Fachleitung Sicherheit und
 * Ordnung, Sachbearbeitung Kitaförderung, Betriebsassistenz.
 *
 * Diese Datei entscheidet, welche davon gezeigt werden dürfen.
 *
 * ── Der Fehler, der diese Datei nötig macht ─────────────────────
 *
 * Derselbe Messlauf lieferte eine Einrichtungsleitung für 72.500 € als
 * „mit Einarbeitung erreichbar". Sie ist es nicht: In Deutschland
 * verlangt sie eine formale Weiterbildung. Das Modell hat die Hürde
 * übersehen, weil sie nicht im Anforderungstext stand, sondern im
 * Gesetz.
 *
 * Ein einziger solcher Eintrag kostet das Vertrauen für alle
 * richtigen. Wer einer Pflegekraft eine Stelle zeigt, die sie formal
 * nicht antreten darf, hat ihr nicht geholfen — er hat ihr bewiesen,
 * dass das Produkt nicht weiss, wovon es redet.
 *
 * ── Warum die Prüfung hier liegt und nicht im Modell ────────────
 *
 * Weil ein Modell überredbar ist und ein Gesetz nicht. Was
 * reglementiert ist, steht in der Handwerksordnung, im
 * Pflegeberufegesetz, in der Bundesärzteordnung — nicht im Ermessen
 * eines Sprachmodells. Diese Liste ist eine Wand, kein Hinweis.
 */

/* ── Was eine Hürde ist ──────────────────────────────────────── */

/**
 * Die Arten von Hürde, nach dem, was sie den Menschen kosten.
 *
 * Die Reihenfolge ist die Rangfolge: Was weiter oben steht, wiegt
 * schwerer. Eine Stelle wird nach ihrer schwersten Hürde beurteilt.
 */
export const HUERDENARTEN = [
  /** Gesetzlich vorgeschrieben. Keine Brücke, kein Ermessen. */
  "gesetzlich",
  /** Ein Abschluss, den die Anzeige verlangt und der nicht vorgeschrieben ist. */
  "abschluss",
  /** Jahre an Erfahrung in einem Feld, das die Person nicht hat. */
  "erfahrung",
  /** Ein Schein, ein Kurs, eine Unterweisung — Tage bis Wochen. */
  "kurzschein",
  /** In der Einarbeitung zu lernen. */
  "einarbeitung",
  /** Erfüllt. */
  "erfuellt",
] as const;
export type Huerdenart = (typeof HUERDENARTEN)[number];

const GEWICHT: Record<Huerdenart, number> = {
  gesetzlich: 5,
  abschluss: 4,
  erfahrung: 3,
  kurzschein: 2,
  einarbeitung: 1,
  erfuellt: 0,
};

/* ── Reglementierte Berufe ───────────────────────────────────── */

/**
 * Was in Deutschland nicht ohne formale Qualifikation geht.
 *
 * Bewusst nach Wortstämmen und nicht nach Berufsbezeichnungen: Eine
 * Anzeige schreibt „Approbation erforderlich", „staatlich anerkannte
 * Erzieherin", „Meisterbrief im Elektrohandwerk" — die
 * Berufsbezeichnung im Titel steht oft gar nicht drin.
 *
 * Diese Liste erhebt keinen Anspruch auf Vollständigkeit und ersetzt
 * keine Rechtsprüfung. Sie ist ein Fangnetz: Was hier hängenbleibt,
 * wird nicht gezeigt. Was durchfällt, muss die Prüfung darunter
 * abfangen.
 */
export const REGLEMENTIERT: readonly RegExp[] = [
  /* Heilberufe */
  /\bapprobation/i,
  /\bapprobiert/i,
  /\barzt\b|\bärztin\b|\bmediziner/i,
  /\bzahnarzt|\bzahnärzt/i,
  /\bapotheker/i,
  /\bpsychotherapeut/i,
  /\btierarzt|\btierärzt/i,
  /\bheilpraktiker/i,
  /\bhebamme|\bentbindungspfleger/i,
  /\bnotfallsanitäter/i,
  /\brettungsassistent/i,

  /* Pflege und Soziales */
  /\bexaminiert/i,
  /\bstaatlich (anerkannt|geprüft)/i,
  /\bpflegedienstleitung.{0,40}(weiterbildung|qualifikation|§\s?71)/i,
  /\beinrichtungsleitung/i,
  /\bheimleitung/i,
  /\berzieher(in)?\b/i,
  /\bsozialpädagog/i,
  /\bsozialarbeiter/i,
  /\bpädagogische fachkraft/i,

  /* Handwerk mit Meisterpflicht (Handwerksordnung Anlage A) */
  /\bmeisterbrief|\bmeisterprüfung|\bhandwerksmeister/i,
  /\belektromeister|\banlagenmechanikermeister|\bkfz-meister/i,
  /\bschornsteinfeger/i,

  /* Rechts- und Wirtschaftsberufe */
  /\brechtsanwalt|\brechtsanwält/i,
  /\bsteuerberater/i,
  /\bwirtschaftsprüfer/i,
  /\bnotar/i,
  /\bvolljurist|\bzweites? staatsexamen/i,

  /* Technik und Sicherheit */
  /\bsachverständige/i,
  /\bprüfsachverständige/i,
  /\bstatiker|\btragwerksplan/i,
  /\bfachkunde nach §\s?34a/i,
  /\bluftfahrt(technisch|personal)|\bpilot/i,
  /\bfahrdienstleiter|\btriebfahrzeugführer|\blokführer/i,

  /* Lehre */
  /\blehramt|\bstaatsexamen für das lehramt|\bstudienrat/i,
];

/**
 * Verlangt diese Anforderung etwas gesetzlich Vorgeschriebenes?
 *
 * Wird auf den Anforderungstext UND den Stellentitel angewandt: Eine
 * Anzeige „Erzieher (m/w/d)" nennt die Qualifikation im Titel und
 * setzt sie im Text als selbstverständlich voraus.
 */
export function istReglementiert(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (t.length === 0) return false;
  return REGLEMENTIERT.some((m) => m.test(t));
}

/* ── Kurzscheine ─────────────────────────────────────────────── */

/**
 * Was in Tagen zu holen ist — und deshalb keine echte Hürde.
 *
 * Der Messlauf fand sechs Stellen, die einzig am Staplerführerschein
 * scheiterten. Der kostet zwei Tage und rund 300 €. Eine Liste, die
 * solche Stellen als „nicht erreichbar" führt, verschweigt genau die
 * Brücke, die am billigsten zu gehen wäre.
 *
 * Der Aufwand steht dabei, weil „fehlt dir" und „fehlt dir für zwei
 * Tage" für einen Menschen zwei verschiedene Sätze sind.
 */
export interface Kurzschein {
  muster: RegExp;
  name: string;
  /** Ungefährer Aufwand in Tagen. */
  tage: number;
}

export const KURZSCHEINE: readonly Kurzschein[] = [
  { muster: /\bstapler(schein|führerschein)?|\bgabelstapler/i, name: "Staplerschein", tage: 2 },
  { muster: /\bführerschein.{0,12}\b(b|klasse b)\b/i, name: "Führerschein Klasse B", tage: 30 },
  { muster: /\bersthelfer|\berste hilfe\b/i, name: "Ersthelfer-Kurs", tage: 1 },
  { muster: /\bhygieneschulung|\binfektionsschutz|\bbelehrung nach §\s?43/i, name: "Infektionsschutzbelehrung", tage: 1 },
  { muster: /\bsachkundenachweis §\s?34a|\bunterrichtung nach §\s?34a/i, name: "Unterrichtung §34a", tage: 5 },
  { muster: /\bführungszeugnis|\berweitertes führungszeugnis/i, name: "Führungszeugnis", tage: 14 },
  { muster: /\bsifa\b|\bsicherheitsbeauftragte/i, name: "Sicherheitsbeauftragten-Schulung", tage: 3 },
  { muster: /\bbrandschutzhelfer/i, name: "Brandschutzhelfer", tage: 1 },
];

export function kurzscheinFuer(text: string | null | undefined): Kurzschein | null {
  const t = (text ?? "").trim();
  if (t.length === 0) return null;
  return KURZSCHEINE.find((k) => k.muster.test(t)) ?? null;
}

/* ── Das Urteil ──────────────────────────────────────────────── */

export interface Huerde {
  /** Der Anforderungstext, aus dem sie stammt. */
  text: string;
  art: Huerdenart;
  /** Bei `kurzschein`: was zu holen ist und wie lange es dauert. */
  schein?: Kurzschein;
}

export type Erreichbarkeit =
  | { art: "sofort" }
  | { art: "kurzschein"; scheine: Kurzschein[]; tage: number }
  | { art: "einarbeitung" }
  | { art: "gesperrt"; grund: string; huerde: string };

/**
 * Darf diese Stelle in der Liste stehen — und wie?
 *
 * ── Warum `gesperrt` einen Grund trägt ──────────────────────────
 *
 * Weil eine Stelle, die nicht erscheint, für den Menschen dasselbe ist
 * wie eine, die es nicht gibt. Wer später fragt „warum steht die
 * Pflegedienstleitung nicht in meiner Liste", muss eine Antwort
 * bekommen, die stimmt — und nicht „passt nicht zu dir".
 */
export function erreichbarkeit(
  stellentitel: string | null | undefined,
  huerden: readonly Huerde[],
): Erreichbarkeit {
  /*
   * Der Titel zuerst.
   *
   * „Erzieher (m/w/d)" nennt die Qualifikation dort und setzt sie im
   * Text als selbstverständlich voraus — es steht dann keine
   * Anforderung „staatlich anerkannt" mehr drin, und die Prüfung über
   * die Anforderungen allein liesse die Stelle durch.
   */
  if (istReglementiert(stellentitel)) {
    return {
      art: "gesperrt",
      grund: "gesetzlich geschützte Berufsbezeichnung",
      huerde: (stellentitel ?? "").trim().slice(0, 80),
    };
  }

  const gesetzlich = huerden.find((h) => h.art === "gesetzlich");
  if (gesetzlich) {
    return {
      art: "gesperrt",
      grund: "gesetzlich vorgeschriebene Qualifikation",
      huerde: gesetzlich.text.slice(0, 80),
    };
  }

  const schwerste = huerden.reduce<Huerdenart>(
    (max, h) => (GEWICHT[h.art] > GEWICHT[max] ? h.art : max),
    "erfuellt",
  );

  if (schwerste === "abschluss" || schwerste === "erfahrung") {
    const h = huerden.find((x) => x.art === schwerste)!;
    return {
      art: "gesperrt",
      grund: schwerste === "abschluss" ? "verlangter Abschluss" : "verlangte Erfahrung",
      huerde: h.text.slice(0, 80),
    };
  }

  if (schwerste === "kurzschein") {
    /*
     * Mehrere Scheine addieren sich, aber nicht endlos. Wer fünf
     * Kurse braucht, hat keine Brücke mehr vor sich, sondern eine
     * Ausbildung — und das gehört nicht in eine Liste, die „heute
     * antreten" verspricht.
     */
    const scheine = huerden.filter((h) => h.art === "kurzschein" && h.schein).map((h) => h.schein!);
    const tage = scheine.reduce((n, s) => n + s.tage, 0);
    if (tage > 45) {
      return {
        art: "gesperrt",
        grund: "zu viele Nachweise",
        huerde: scheine.map((s) => s.name).join(", ").slice(0, 80),
      };
    }
    return { art: "kurzschein", scheine, tage };
  }

  if (schwerste === "einarbeitung") return { art: "einarbeitung" };
  return { art: "sofort" };
}

/**
 * Lohnt sich die Stelle gegenüber dem, was jemand heute verdient?
 *
 * Der erste Messlauf zählte Lagerhelfer und Warenverräumung als
 * Treffer. Technisch richtig, als Angebot eine Beleidigung — eine
 * Pflegefachkraft mit neun Jahren Erfahrung braucht keine Liste, die
 * ihr Hilfstätigkeiten anbietet.
 *
 * Ohne bekanntes Vergleichsgehalt gilt die Stelle als lohnend: Dann
 * ist die Frage offen, und offene Fragen werden nicht zu Lasten des
 * Menschen entschieden.
 */
export function lohntSich(
  jahresgehalt: number | null | undefined,
  heute: number | null | undefined,
): boolean {
  if (!heute || !Number.isFinite(heute) || heute <= 0) return true;
  if (!jahresgehalt || !Number.isFinite(jahresgehalt) || jahresgehalt <= 0) return false;
  return jahresgehalt >= heute;
}
