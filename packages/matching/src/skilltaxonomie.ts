/**
 * Fähigkeiten einer Taxonomie zuordnen — oder ehrlich nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Stand, den dieses Modul abbildet
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen im Bestand:
 *
 *   skills            0 Zeilen
 *   profile_skills    0 Zeilen
 *   isco_berufe     436 Zeilen  (Berufe, keine Fähigkeiten)
 *   jobs.kldb        37 % der analysierten Stellen
 *
 * Es gibt also eine BERUFS-Taxonomie und keine FÄHIGKEITS-Taxonomie.
 * Das ist ein Unterschied, den man leicht übergeht: Aus „Beruf 51302"
 * folgt nicht, welche Fähigkeiten jemand hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier trotzdem etwas steht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die Alternative schlechter wäre. Ohne diese Schicht landet
 * irgendwann eine erfundene ESCO-Kennung im Code — nicht aus bösem
 * Willen, sondern weil eine Funktion eine Kennung zurückgeben muss
 * und niemand eine hat.
 *
 * `unmapped` ist ein Ergebnis, kein Fehler. Es sagt: Diese Fähigkeit
 * kennt keine Taxonomie hier, sie zählt als Freitext, und ein
 * Vergleich stützt sich auf den Wortlaut. Das ist weniger, als eine
 * Kennung verspricht, und mehr, als eine erfundene wert wäre.
 */

export type Taxonomie = "esco" | "kldb" | "isco" | "intern";

export type Zuordnung =
  | { art: "mapped"; taxonomie: Taxonomie; kennung: string; bezeichnung: string }
  | { art: "unmapped"; grund: "keine_daten" | "kein_treffer"; text: string };

/**
 * Was ein Adapter können muss.
 *
 * Bewusst schmal: Eine Zeichenkette hinein, eine Zuordnung heraus.
 * Wer später ESCO anbindet, füllt genau diese Form aus — und alles
 * darüber merkt nichts davon ausser besseren Ergebnissen.
 */
export interface Skilladapter {
  readonly name: string;
  /** `null` heisst: Dieser Adapter hat zu dieser Fähigkeit nichts. */
  zuordnen(text: string): Zuordnung | null;
}

/**
 * Der Adapter für den gegenwärtigen Zustand: keine Fähigkeitsdaten.
 *
 * Er ordnet nichts zu und sagt das auch. Ein Adapter, der stattdessen
 * raten würde, wäre schlimmer als keiner — man sähe seinen Ergebnissen
 * nicht an, dass sie geraten sind.
 */
export const OHNE_SKILLDATEN: Skilladapter = {
  name: "ohne-daten",
  zuordnen(text: string): Zuordnung {
    return { art: "unmapped", grund: "keine_daten", text: text.trim() };
  },
};

/**
 * Ein Adapter über eine hinterlegte Tabelle.
 *
 * Der Vergleich ist bewusst schlicht — kleingeschrieben, getrimmt.
 * Eine Ähnlichkeitssuche hier wäre eine zweite Semantik neben der
 * Einbettung, mit eigenen Schwellen und eigenen Fehlern.
 */
export function tabellenadapter(
  name: string,
  taxonomie: Taxonomie,
  eintraege: ReadonlyMap<string, { kennung: string; bezeichnung: string }>,
): Skilladapter {
  return {
    name,
    zuordnen(text: string): Zuordnung {
      const schluessel = text.trim().toLowerCase();
      const treffer = eintraege.get(schluessel);
      if (!treffer) return { art: "unmapped", grund: "kein_treffer", text: text.trim() };
      return { art: "mapped", taxonomie, kennung: treffer.kennung, bezeichnung: treffer.bezeichnung };
    },
  };
}

/**
 * Mehrere Adapter der Reihe nach fragen.
 *
 * Der erste Treffer gewinnt. Ohne Treffer bleibt `unmapped` — und der
 * Grund unterscheidet, ob es keine Daten gab oder ob die Daten die
 * Fähigkeit nicht kennen. Das ist für den Betrieb ein Unterschied:
 * Das eine behebt eine Datenlieferung, das andere nicht.
 */
export function zuordnen(adapter: readonly Skilladapter[], text: string): Zuordnung {
  let ohneDaten = true;
  for (const a of adapter) {
    const z = a.zuordnen(text);
    if (z === null) continue;
    if (z.art === "mapped") return z;
    if (z.grund === "kein_treffer") ohneDaten = false;
  }
  return {
    art: "unmapped",
    grund: ohneDaten ? "keine_daten" : "kein_treffer",
    text: text.trim(),
  };
}

export type Transferart =
  | "direct_skill_match"
  | "transferable_skill_match"
  | "unverified_possible_transfer";

export interface Transferbefund {
  art: Transferart;
  /** Ob die Zuordnung über eine Taxonomie lief oder über den Wortlaut. */
  ueberTaxonomie: boolean;
  begruendung: string;
}

/**
 * Wie ein Fähigkeitstreffer einzustufen ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel, an der alles hängt
 * ══════════════════════════════════════════════════════════════
 *
 * Ohne belegte Erfahrung ist es eine Vermutung. „Gastronomie" beweist
 * keine Kundenbetreuungskompetenz — wer Beschwerden geklärt und
 * Abläufe koordiniert hat, bringt etwas mit; wer nur in der
 * Gastronomie war, vielleicht auch, vielleicht nicht.
 *
 * Die ersten beiden Arten dürfen in einen Fit einfliessen, die dritte
 * erzeugt eine Rückfrage. Wer sie verwechselt, rechnet eine Vermutung
 * in eine Zahl — und die Person sieht eine Empfehlung, hinter der
 * nichts steht.
 */
export function transferEinstufen(eingabe: {
  /** Ob eine bestätigte Erfahrung der Person die Grundlage ist. */
  belegt: boolean;
  /** Ob es dieselbe Fähigkeit ist oder eine, aus der sie folgt. */
  identisch: boolean;
  profilZuordnung: Zuordnung;
  jobZuordnung: Zuordnung;
}): Transferbefund {
  if (!eingabe.belegt) {
    return {
      art: "unverified_possible_transfer",
      ueberTaxonomie: false,
      begruendung: "Dafür liegt keine bestätigte Erfahrung vor.",
    };
  }

  const ueberTaxonomie =
    eingabe.profilZuordnung.art === "mapped" && eingabe.jobZuordnung.art === "mapped";

  if (eingabe.identisch) {
    return {
      art: "direct_skill_match",
      ueberTaxonomie,
      begruendung: ueberTaxonomie
        ? `Dieselbe Fähigkeit (${eingabe.profilZuordnung.art === "mapped" ? eingabe.profilZuordnung.kennung : ""}).`
        : "Dieselbe Fähigkeit, dem Wortlaut nach.",
    };
  }

  return {
    art: "transferable_skill_match",
    ueberTaxonomie,
    begruendung: ueberTaxonomie
      ? "Verwandte Fähigkeit laut Taxonomie, gestützt auf eine bestätigte Erfahrung."
      : "Gestützt auf eine bestätigte Erfahrung — ohne Taxonomie, dem Wortlaut nach.",
  };
}
