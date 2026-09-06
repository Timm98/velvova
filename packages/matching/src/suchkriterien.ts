/**
 * Ein Suchkriterium gegen eine Stelle prüfen.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel, die alles trägt
 * ══════════════════════════════════════════════════════════════
 *
 * Fünf Ausgänge, nicht zwei:
 *
 *   erfuellt          die Anzeige belegt es
 *   teilweise         teils belegt, teils offen
 *   nicht_erfuellt    die Anzeige widerspricht nachweislich
 *   unbekannt         die Anzeige sagt nichts dazu
 *   widerspruechlich  die Anzeige sagt zweierlei
 *
 * `unbekannt` ist der wichtigste davon. Eine Anzeige, die nichts zum
 * Gehalt sagt, erfüllt keine Gehaltsuntergrenze — sie verletzt aber
 * auch keine. Beides zu „erfüllt" zu runden, weil die Liste sonst leer
 * bliebe, ist genau der Fehler, den ein Suchauftrag nicht machen darf:
 * Die Person liest „passt zu deinem Mindestgehalt" und bewirbt sich.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht im Modell
 * ══════════════════════════════════════════════════════════════
 *
 * Weil es rechenbar ist. Ob 42.000 unter 45.000 liegt, ist keine
 * Ermessensfrage, und ein Modell, das sie beantwortet, kostet Geld und
 * kann sich irren. Das Modell bekommt später die Fälle, die
 * tatsächlich Sprachverständnis brauchen — Aufgabenähnlichkeit,
 * übertragbare Fähigkeiten.
 */

export type Staerke = "muss" | "wunsch" | "interesse";

export type Kriterienstatus =
  | "erfuellt"
  | "teilweise"
  | "nicht_erfuellt"
  | "unbekannt"
  | "widerspruechlich";

/**
 * Die Kriterien, für die es eine Prüfung gibt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Liste existiert
 * ══════════════════════════════════════════════════════════════
 *
 * `kriteriumPruefen` gibt für einen unbekannten Schlüssel `unbekannt`
 * zurück — das ist richtig und reicht nicht. Ein Modell, das
 * „arbeitsatmosphaere" vorschlägt, erzeugt sonst ein Kriterium, das
 * jede Stelle offen lässt: Die Person sieht es in ihrem Auftrag
 * stehen, und es bewirkt nie etwas.
 *
 * Deshalb wird schon beim Anlegen geprüft, ob ein Schlüssel eine
 * Entsprechung hat. Was hier nicht steht, wird nicht übernommen —
 * und die Person erfährt, dass es weggefallen ist.
 *
 * Die Liste wächst mit `kriteriumPruefen`. Sie hier zu ergänzen und
 * dort zu vergessen, fällt sofort auf: Das Kriterium existiert und
 * prüft nichts.
 */
export const KRITERIEN_SCHLUESSEL = [
  "mindestgehalt",
  "arbeitsmodell",
  "arbeitsort",
  "umkreis",
  "arbeitsland",
  "pendelzeit",
  "vertragsform",
  "befristung",
  "wochenstunden",
  "schichtarbeit",
  "reisebereitschaft",
  "erfahrungsniveau",
  "lizenz",
  "arbeitgeber_ausschluss",
  "taetigkeit_ausschluss",
  "taetigkeit",
  "berufsfeld",
  "sprache",
] as const;

export type Kriteriumsschluessel = (typeof KRITERIEN_SCHLUESSEL)[number];

export function kriteriumBekannt(schluessel: string): schluessel is Kriteriumsschluessel {
  return (KRITERIEN_SCHLUESSEL as readonly string[]).includes(schluessel);
}

export type Operator =
  | "gleich"
  | "mindestens"
  | "hoechstens"
  | "enthaelt"
  | "einer_von"
  | "nicht";

export interface Suchkriterium {
  id: string;
  /** Der stabile Schlüssel, etwa „mindestgehalt". */
  kriterium: string;
  wert: unknown;
  einheit: string | null;
  operator: Operator;
  staerke: Staerke;
  /**
   * Alternativen teilen sich eine Gruppe.
   *
   * „Stuttgart oder vollständig remote" sind zwei Kriterien mit
   * derselben Gruppe. Ohne dieses Feld wären es zwei gleichzeitig
   * zwingende Standortbedingungen, und die Suche fände nichts.
   */
  gruppe: string | null;
}

/**
 * Was die Anzeige über die Stelle sagt.
 *
 * Absichtlich eine eigene, schmale Form statt `Job`: Hier steht nur,
 * was geprüft wird, und jedes Feld darf `null` sein. `null` heisst
 * „steht nicht in der Anzeige" — nicht „ist es nicht".
 */
export interface Stellenangaben {
  titel: string;
  arbeitgeber: string;
  ort: string | null;
  land: string;
  /** on_site · hybrid · remote — die Werte des Schemas, nicht ihre Kurzformen. */
  arbeitsmodell: string | null;
  remoteAnteil: number | null;
  vertragsform: string | null;
  befristet: boolean | null;
  wochenstunden: number | null;
  schichtarbeit: boolean | null;
  reiseanteil: number | null;
  /** entry · junior · mid · senior · lead */
  erfahrungsniveau: string | null;
  gehalt: Gehaltsangabe | null;
  /** Weitere Gehaltsaussagen aus dem Text — etwa ein „bis zu"-Betrag. */
  weitereGehaelter: Gehaltsangabe[];
  aufgaben: string[];
  /**
   * Die Anforderungen der Anzeige.
   *
   * Sie beschreiben die Rolle wie die Aufgaben — und anders als der
   * Fliesstext. „Erfahrung in der Kommissionierung" ist eine Auskunft
   * über die Arbeit, „Obstkorb" ist es nicht.
   */
  anforderungen: string[];
  /** Die eindeutigen Wörter der Beschreibung, kleingeschrieben. */
  wortmenge: string;
  lizenzen: string[];
  sprachen: Record<string, string>;
  /**
   * Fahrtzeit in Minuten — nur mit echten Routendaten.
   *
   * `null` heisst: Wir wissen es nicht. Aus Luftlinie eine Fahrtzeit
   * zu machen und „zehn Minuten entfernt" zu behaupten, ist eine
   * Aussage über den Alltag einer Person, für die es keine Grundlage
   * gibt.
   */
  pendelminuten: number | null;
  entfernungKm: number | null;
  /**
   * Die Koordinaten der Stelle — oder `null`.
   *
   * `null` ist der Normalfall: Von 1.215 analysierten Anzeigen tragen
   * elf Koordinaten. Eine Umkreisprüfung ohne sie ist deshalb keine
   * Ausnahme, sondern die Regel — und sie sagt dann `unbekannt`,
   * nicht „passt".
   */
  breitengrad: number | null;
  laengengrad: number | null;
}

export interface Gehaltsangabe {
  min: number | null;
  max: number | null;
  waehrung: string;
  /** year · month · hour — `null`, wenn die Anzeige ihn nicht nennt. */
  zeitraum: "year" | "month" | "hour" | null;
  /**
   * Ob der Betrag zugesagt ist.
   *
   * „Bis zu 50.000" ist keine Zusage. Ein garantiertes Mindestgehalt
   * von 45.000 ist damit nicht erfüllt — die Anzeige sagt nur, dass
   * mehr nicht drin ist.
   */
  garantiert: boolean;
  /** brutto · netto — `null`, wenn nicht genannt. */
  basis: "brutto" | "netto" | null;
  /** employer · provider · board_estimate · text */
  herkunft: string | null;
  beleg: string | null;
}

export interface Kriteriumsergebnis {
  kriteriumId: string;
  kriterium: string;
  staerke: Staerke;
  gruppe: string | null;
  status: Kriterienstatus;
  begruendung: string;
  /** Welches Feld der Anzeige fehlt. Nur bei `unbekannt` gesetzt. */
  fehlendesFeld: string | null;
  /** Die Stelle in der Anzeige, auf die sich das Urteil stützt. */
  beleg: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   Gehalt
   ═══════════════════════════════════════════════════════════════ */

/** Auf Jahr gerechnet. 40-Stunden-Woche als offengelegte Annahme. */
export function aufJahr(betrag: number, zeitraum: "year" | "month" | "hour"): number {
  if (zeitraum === "year") return betrag;
  if (zeitraum === "month") return betrag * 12;
  return Math.round(betrag * 40 * 52);
}

/**
 * Reicht das Gehalt der Anzeige für die geforderte Untergrenze?
 *
 * ── Was hier nicht verglichen wird ────────────────────────────
 *
 * Andere Währung, fehlender Zeitraum, Netto gegen Brutto: In allen
 * drei Fällen ist das Ergebnis `unbekannt`, nicht „passt". Eine
 * Umrechnung von Netto auf Brutto hängt an Steuerklasse, Kirche und
 * Bundesland — sie hier zu raten wäre eine Zahl mit falscher
 * Genauigkeit.
 */
function gehaltPruefen(
  gefordert: number,
  einheit: string | null,
  angaben: Gehaltsangabe[],
): { status: Kriterienstatus; begruendung: string; fehlendesFeld: string | null; beleg: string | null } {
  const zeitraum = (einheit === "month" || einheit === "hour" ? einheit : "year") as
    | "year"
    | "month"
    | "hour";
  const grenze = aufJahr(gefordert, zeitraum);

  const brauchbar = angaben.filter(
    (a) => a.zeitraum !== null && a.waehrung === "EUR" && a.basis !== "netto",
  );
  if (brauchbar.length === 0) {
    return {
      status: "unbekannt",
      begruendung: "Die Anzeige nennt kein vergleichbares Gehalt.",
      fehlendesFeld: "gehalt",
      beleg: null,
    };
  }

  /*
   * Zuerst die zugesagten Beträge. Nur sie können eine Untergrenze
   * wirklich erfüllen.
   */
  const zugesagt = brauchbar.filter((a) => a.garantiert);
  for (const a of zugesagt) {
    const untergrenze = a.min ?? a.max;
    if (untergrenze === null) continue;
    const jahr = aufJahr(untergrenze, a.zeitraum!);
    if (jahr >= grenze) {
      return {
        status: "erfuellt",
        begruendung: `Zugesagt ab ${Math.round(jahr).toLocaleString("de-DE")} EUR im Jahr.`,
        fehlendesFeld: null,
        beleg: a.beleg,
      };
    }
  }

  /*
   * Eine Spanne, die die Grenze überschneidet, ist nicht erfüllt und
   * nicht verletzt.
   *
   * „40.000 bis 55.000" bei geforderten 45.000: Es kann reichen. Ob es
   * reicht, entscheidet ein Gespräch, nicht die Anzeige.
   */
  for (const a of brauchbar) {
    const oben = a.max ?? a.min;
    if (oben === null) continue;
    const obenJahr = aufJahr(oben, a.zeitraum!);
    /*
     * Reicht die Obergrenze nicht an die Untergrenze heran, ist diese
     * Angabe kein offener Fall, sondern ein geschlossener.
     */
    if (obenJahr < grenze) continue;
    /*
     * Hier ist die Obergrenze hoch genug, die Zusage aber nicht
     * belegt — sonst wäre der Fall oben als `erfuellt` herausgegangen.
     *
     * Das gilt für beide Formen: „40.000 bis 55.000" (der zugesagte
     * Boden liegt darunter) und „bis zu 50.000" (es gibt gar keinen
     * genannten Boden). Beide sind offen, keine ist erfüllt.
     */
    {
      const untenJahr = a.min === null ? null : aufJahr(a.min, a.zeitraum!);
      return {
        status: "teilweise",
        begruendung:
          a.garantiert && untenJahr !== null
            ? `Die Spanne reicht von ${Math.round(untenJahr).toLocaleString("de-DE")} bis ${Math.round(obenJahr).toLocaleString("de-DE")} EUR — deine Grenze liegt darin.`
            : `Genannt ist höchstens ${Math.round(obenJahr).toLocaleString("de-DE")} EUR. Ein zugesagtes Mindestgehalt steht nicht dabei.`,
        fehlendesFeld: a.garantiert && untenJahr !== null ? null : "garantiertes_fixgehalt",
        beleg: a.beleg,
      };
    }
  }

  /*
   * Alle brauchbaren Angaben liegen darunter. Erst jetzt ist es eine
   * nachgewiesene Verletzung.
   */
  const hoechster = Math.max(
    ...brauchbar.map((a) => aufJahr((a.max ?? a.min)!, a.zeitraum!)).filter((n) => Number.isFinite(n)),
  );
  if (Number.isFinite(hoechster) && hoechster < grenze) {
    return {
      status: "nicht_erfuellt",
      begruendung: `Die Anzeige nennt höchstens ${Math.round(hoechster).toLocaleString("de-DE")} EUR im Jahr, du willst mindestens ${Math.round(grenze).toLocaleString("de-DE")}.`,
      fehlendesFeld: null,
      beleg: brauchbar[0]!.beleg,
    };
  }

  return {
    status: "unbekannt",
    begruendung: "Aus den Gehaltsangaben lässt sich kein Vergleich ziehen.",
    fehlendesFeld: "gehalt",
    beleg: null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Entfernung
   ═══════════════════════════════════════════════════════════════ */

const ERDRADIUS_KM = 6371;

/**
 * Luftlinie zwischen zwei Punkten, in Kilometern.
 *
 * ── Was das ist und was nicht ─────────────────────────────────
 *
 * Luftlinie. Keine Fahrtzeit und keine Strassenentfernung. Der
 * Auftrag verlangt, die drei getrennt zu behandeln, und das ist keine
 * Pedanterie: Zwanzig Kilometer sind je nach Verbindung fünfzehn
 * Minuten oder eine Stunde.
 *
 * Für „30 km um Stuttgart" ist Luftlinie die richtige Grösse — die
 * Person hat einen Radius genannt, keine Fahrtzeit.
 */
export function luftlinieKm(
  aBreite: number,
  aLaenge: number,
  bBreite: number,
  bLaenge: number,
): number {
  const bogen = (grad: number) => (grad * Math.PI) / 180;
  const dBreite = bogen(bBreite - aBreite);
  const dLaenge = bogen(bLaenge - aLaenge);
  const h =
    Math.sin(dBreite / 2) ** 2 +
    Math.cos(bogen(aBreite)) * Math.cos(bogen(bBreite)) * Math.sin(dLaenge / 2) ** 2;
  return 2 * ERDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ═══════════════════════════════════════════════════════════════
   Die einzelnen Prüfungen
   ═══════════════════════════════════════════════════════════════ */

/**
 * Aus „Lagerstellen" den Stamm „lager" machen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nötig ist
 * ══════════════════════════════════════════════════════════════
 *
 * Die Suche vergleicht am Wortanfang: „lager" findet „Lagerhelfer",
 * „Lagerlogistik", „Lagerist". „lagerstellen" findet nichts davon —
 * es ist kein Präfix dieser Wörter.
 *
 * Ein echter Modellaufruf lieferte für „such nach Lagerstellen" genau
 * das: `taetigkeit: ["lagerstellen"]`. Der Auftrag hätte im ganzen
 * Bestand keine einzige Stelle gefunden, und niemand hätte gesehen,
 * warum — eine leere Liste sieht aus wie ein leerer Arbeitsmarkt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nur diese Endungen
 * ══════════════════════════════════════════════════════════════
 *
 * Weil eine allgemeine Wortzerlegung für Deutsch hier nicht drin ist
 * und Halbwissen schlimmer wäre: Aus „Fachkraft" darf nicht „Fach"
 * werden. Gestrichen wird nur, was ausdrücklich „Stelle" bedeutet und
 * einen brauchbaren Rest übriglässt.
 */
const STELLENENDUNGEN = ["stellenangebote", "stellenangebot", "stellen", "stelle", "jobs", "job"];

export function taetigkeitStamm(wort: string): string {
  const w = wort.toLowerCase().trim();
  for (const endung of STELLENENDUNGEN) {
    if (!w.endsWith(endung)) continue;
    const rest = w.slice(0, -endung.length);
    /* Ein zu kurzer Rest ist kein Beruf mehr. „Jobs" bleibt „jobs". */
    if (rest.length >= 4) return rest;
  }
  return w;
}

/**
 * Das erste Wort im Text, das mit der Nadel beginnt — oder `null`.
 *
 * ── Warum kein `includes` ─────────────────────────────────────
 *
 * Ein Probelauf mit dem Kriterium „lager" fand eine Stelle als
 * „Koch / Köchin" — die Beschreibung enthielt „Lagerung", und
 * `includes("lager")` war zufrieden. Die Person hätte in der Mail
 * gelesen: „Die Anzeige nennt lager."
 *
 * ── Warum kein exakter Wortvergleich ──────────────────────────
 *
 * Weil Deutsch zusammensetzt. „Lagerist", „Lagerlogistik",
 * „Lagerfachkraft" sind echte Treffer für „lager", und ein
 * Wortvergleich fände keinen einzigen davon.
 *
 * Der Wortanfang ist der Kompromiss: „Lagerlogistik" trifft,
 * „Schlager" nicht. „Lagerfeuer" trifft auch — das ist der Preis,
 * und er ist erheblich kleiner als eine erfundene Passung.
 */
export function wortTreffer(heuhaufen: string, nadel: string): string | null {
  if (nadel.length < 3) return null;
  const gesucht = nadel.toLowerCase();
  for (const wort of heuhaufen.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (wort.length >= gesucht.length && wort.startsWith(gesucht)) return wort;
  }
  return null;
}

/** `onsite`, `on-site`, `vor ort` → `on_site`. */
export function arbeitsmodellNormal(wert: string): string {
  const w = wert.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (w === "onsite" || w === "on_site" || w === "vor_ort" || w === "praesenz" || w === "präsenz") return "on_site";
  if (w === "homeoffice" || w === "remote" || w === "vollstaendig_remote") return "remote";
  return w;
}

function alsListe(wert: unknown): string[] {
  if (Array.isArray(wert)) return wert.map((w) => String(w).toLowerCase().trim());
  if (wert === null || wert === undefined) return [];
  return [String(wert).toLowerCase().trim()];
}

function alsZahl(wert: unknown): number | null {
  const n = typeof wert === "number" ? wert : Number(wert);
  return Number.isFinite(n) ? n : null;
}

function ergebnis(
  k: Suchkriterium,
  status: Kriterienstatus,
  begruendung: string,
  fehlendesFeld: string | null = null,
  beleg: string | null = null,
): Kriteriumsergebnis {
  return {
    kriteriumId: k.id,
    kriterium: k.kriterium,
    staerke: k.staerke,
    gruppe: k.gruppe,
    status,
    begruendung,
    fehlendesFeld,
    beleg,
  };
}

/** Fehlt in der Anzeige — nicht erfüllt und nicht verletzt. */
function fehlt(k: Suchkriterium, feld: string, was: string): Kriteriumsergebnis {
  /* `was` bringt sein „zu" selbst mit, wo es eines braucht — sonst
     stand in einem Probelauf „sagt nichts zu zu Schichtdiensten". */
  return ergebnis(k, "unbekannt", `Die Anzeige sagt nichts ${was}.`, feld);
}

export function kriteriumPruefen(k: Suchkriterium, s: Stellenangaben): Kriteriumsergebnis {
  switch (k.kriterium) {
    case "mindestgehalt": {
      const gefordert = alsZahl(k.wert);
      if (gefordert === null) return ergebnis(k, "unbekannt", "Kein vergleichbarer Wert hinterlegt.");
      const alle = [s.gehalt, ...s.weitereGehaelter].filter((a): a is Gehaltsangabe => a !== null);
      const g = gehaltPruefen(gefordert, k.einheit, alle);
      return ergebnis(k, g.status, g.begruendung, g.fehlendesFeld, g.beleg);
    }

    case "arbeitsmodell": {
      if (s.arbeitsmodell === null) return fehlt(k, "arbeitsmodell", "zur Vor-Ort-Anwesenheit oder zum Homeoffice");
      /*
       * „onsite" und „on_site" meinen dasselbe.
       *
       * Im Schema heisst der Wert `on_site`, im Gespräch sagt niemand
       * so. Ohne diese Normalisierung wäre ein Kriterium mit dem
       * naheliegenden Wort stillschweigend nie erfüllt — und die
       * Person bekäme keine einzige Vor-Ort-Stelle, ohne dass sich
       * irgendwo ein Fehler zeigt.
       */
      const erlaubt = alsListe(k.wert).map(arbeitsmodellNormal);
      const trifft = erlaubt.includes(arbeitsmodellNormal(s.arbeitsmodell));
      return k.operator === "nicht"
        ? ergebnis(
            k,
            trifft ? "nicht_erfuellt" : "erfuellt",
            trifft ? `Die Stelle ist „${s.arbeitsmodell}" — das schliesst du aus.` : `Arbeitsmodell „${s.arbeitsmodell}".`,
            null,
            s.arbeitsmodell,
          )
        : ergebnis(
            k,
            trifft ? "erfuellt" : "nicht_erfuellt",
            trifft
              ? `Arbeitsmodell „${s.arbeitsmodell}".`
              : `Die Stelle ist „${s.arbeitsmodell}", du suchst ${erlaubt.join(" oder ")}.`,
            null,
            s.arbeitsmodell,
          );
    }

    case "arbeitsort": {
      /*
       * Der Ort ist ein Textvergleich und bleibt einer.
       *
       * Eine Umkreissuche gehört in die Vorauswahl mit Koordinaten und
       * Index, nicht hierher. Was hier passiert, ist die Prüfung: Steht
       * der gewünschte Ort in der Ortsangabe der Anzeige?
       */
      if (s.ort === null || s.ort.trim() === "") return fehlt(k, "ort", "zum Arbeitsort");
      const gesucht = alsListe(k.wert);
      const ort = s.ort.toLowerCase();
      const trifft = gesucht.some((g) => g.length >= 3 && ort.includes(g));
      return ergebnis(
        k,
        trifft ? "erfuellt" : "nicht_erfuellt",
        trifft ? `Arbeitsort ${s.ort}.` : `Arbeitsort ${s.ort} — du suchst ${gesucht.join(" oder ")}.`,
        null,
        s.ort,
      );
    }

    case "umkreis": {
      /*
       * „30 km um Stuttgart."
       *
       * Ohne Koordinaten der Stelle gibt es keine Entfernung — und
       * dann steht `unbekannt` da, nicht „passt". Das ist im
       * gegenwärtigen Bestand der häufigste Ausgang: Elf von 1.215
       * analysierten Anzeigen tragen Koordinaten.
       *
       * Die bequeme Alternative wäre, den Ortsnamen zu vergleichen und
       * das eine Umkreissuche zu nennen. Dann fiele die Nachbarstadt
       * heraus, obwohl sie zwölf Kilometer entfernt liegt — und
       * niemand könnte den Unterschied sehen.
       */
      const ziel = k.wert as { breite?: number; laenge?: number; km?: number; ort?: string } | null;
      const km = alsZahl(ziel?.km);
      if (!ziel || typeof ziel.breite !== "number" || typeof ziel.laenge !== "number" || km === null)
        return ergebnis(k, "unbekannt", "Für diesen Umkreis fehlt ein Mittelpunkt.", "umkreis_mitte");

      if (s.breitengrad === null || s.laengengrad === null)
        return ergebnis(
          k,
          "unbekannt",
          `Die Anzeige nennt ${s.ort ?? "einen Ort"}, aber keine Koordinaten — die Entfernung lässt sich nicht rechnen.`,
          "koordinaten",
        );

      const entfernung = luftlinieKm(ziel.breite, ziel.laenge, s.breitengrad, s.laengengrad);
      const gerundet = Math.round(entfernung);
      return ergebnis(
        k,
        entfernung <= km ? "erfuellt" : "nicht_erfuellt",
        entfernung <= km
          ? `Rund ${gerundet} km von ${ziel.ort ?? "deinem Ort"} — Luftlinie, keine Fahrtzeit.`
          : `Rund ${gerundet} km von ${ziel.ort ?? "deinem Ort"}, dein Umkreis ist ${km} km.`,
        null,
        s.ort,
      );
    }

    case "arbeitsland": {
      /*
       * „Remote innerhalb Deutschlands."
       *
       * `jobs.country` ist das Land, in dem beschäftigt wird, nicht der
       * Ort des Schreibtischs. Eine vollständig remote ausgeschriebene
       * Stelle in den USA kann jemand ohne Arbeitserlaubnis dort nicht
       * annehmen — auch wenn er sie vom Küchentisch aus machen könnte.
       */
      const erlaubt = alsListe(k.wert).map((l) => l.toUpperCase());
      if (erlaubt.length === 0) return ergebnis(k, "unbekannt", "Kein Land hinterlegt.");
      const land = s.land.toUpperCase();
      return ergebnis(
        k,
        erlaubt.includes(land) ? "erfuellt" : "nicht_erfuellt",
        erlaubt.includes(land)
          ? `Beschäftigung in ${land}.`
          : `Die Stelle wird in ${land} besetzt, du suchst in ${erlaubt.join(" oder ")}.`,
        null,
        land,
      );
    }

    case "pendelzeit": {
      const grenze = alsZahl(k.wert);
      if (grenze === null) return ergebnis(k, "unbekannt", "Keine Obergrenze hinterlegt.");
      /*
       * Ohne Routendaten keine Aussage.
       *
       * Die Luftlinie liegt oft vor, und aus ihr eine Fahrtzeit zu
       * machen wäre die bequeme Lösung. Sie wäre auch falsch: Zwanzig
       * Kilometer sind je nach Verbindung fünfzehn Minuten oder eine
       * Stunde. „Zehn Minuten entfernt" ist eine Aussage über den
       * Alltag einer Person.
       */
      if (s.pendelminuten === null)
        return ergebnis(
          k,
          "unbekannt",
          s.entfernungKm !== null
            ? `Entfernung rund ${Math.round(s.entfernungKm)} km. Eine Fahrtzeit liegt nicht vor.`
            : "Zur Fahrtzeit liegen keine Routendaten vor.",
          "fahrtzeit",
        );
      return ergebnis(
        k,
        s.pendelminuten <= grenze ? "erfuellt" : "nicht_erfuellt",
        `Fahrtzeit rund ${s.pendelminuten} Minuten, deine Grenze liegt bei ${grenze}.`,
        null,
        null,
      );
    }

    case "vertragsform": {
      if (s.vertragsform === null) return fehlt(k, "vertragsform", "zur Vertragsform");
      const erlaubt = alsListe(k.wert);
      const trifft = erlaubt.includes(s.vertragsform.toLowerCase());
      return k.operator === "nicht"
        ? ergebnis(
            k,
            trifft ? "nicht_erfuellt" : "erfuellt",
            trifft ? `Vertragsform „${s.vertragsform}" — die schliesst du aus.` : `Vertragsform „${s.vertragsform}".`,
            null,
            s.vertragsform,
          )
        : ergebnis(
            k,
            trifft ? "erfuellt" : "nicht_erfuellt",
            trifft ? `Vertragsform „${s.vertragsform}".` : `Die Stelle ist „${s.vertragsform}", du suchst ${erlaubt.join(" oder ")}.`,
            null,
            s.vertragsform,
          );
    }

    case "befristung": {
      /*
       * Eine eigene Achse, keine Vertragsform.
       *
       * „Unbefristet", „Teilzeit" und „Zeitarbeit" schliessen einander
       * nicht aus — eine Teilzeitstelle kann unbefristet und über eine
       * Zeitarbeitsfirma besetzt sein. In ein Feld gepresst würde jede
       * Angabe die andere überschreiben.
       */
      if (s.befristet === null) return fehlt(k, "befristung", "zur Befristung");
      const willUnbefristet = k.wert === false || k.wert === "unbefristet";
      const passt = willUnbefristet ? !s.befristet : s.befristet;
      return ergebnis(
        k,
        passt ? "erfuellt" : "nicht_erfuellt",
        s.befristet ? "Die Stelle ist befristet." : "Die Stelle ist unbefristet.",
        null,
        null,
      );
    }

    case "wochenstunden": {
      const grenze = alsZahl(k.wert);
      if (grenze === null) return ergebnis(k, "unbekannt", "Kein Wert hinterlegt.");
      if (s.wochenstunden === null) return fehlt(k, "wochenstunden", "zur Wochenarbeitszeit");
      const passt =
        k.operator === "hoechstens"
          ? s.wochenstunden <= grenze
          : k.operator === "mindestens"
            ? s.wochenstunden >= grenze
            : Math.abs(s.wochenstunden - grenze) <= 2;
      return ergebnis(
        k,
        passt ? "erfuellt" : "nicht_erfuellt",
        `${s.wochenstunden} Stunden pro Woche.`,
        null,
        null,
      );
    }

    case "schichtarbeit": {
      if (s.schichtarbeit === null) return fehlt(k, "schichtarbeit", "zu Schicht- oder Wochenenddiensten");
      const willKeine = k.wert === false || k.operator === "nicht";
      const passt = willKeine ? !s.schichtarbeit : s.schichtarbeit;
      return ergebnis(
        k,
        passt ? "erfuellt" : "nicht_erfuellt",
        s.schichtarbeit ? "Die Stelle nennt Schichtarbeit." : "Die Anzeige nennt keine Schichtarbeit.",
        null,
        null,
      );
    }

    case "reisebereitschaft": {
      const grenze = alsZahl(k.wert);
      if (grenze === null) return ergebnis(k, "unbekannt", "Kein Wert hinterlegt.");
      if (s.reiseanteil === null) return fehlt(k, "reiseanteil", "zum Reiseanteil");
      return ergebnis(
        k,
        s.reiseanteil <= grenze ? "erfuellt" : "nicht_erfuellt",
        `Reiseanteil rund ${s.reiseanteil} Prozent.`,
        null,
        null,
      );
    }

    case "erfahrungsniveau": {
      if (s.erfahrungsniveau === null) return fehlt(k, "erfahrungsniveau", "zur geforderten Erfahrung");
      const erlaubt = alsListe(k.wert);
      const trifft = erlaubt.includes(s.erfahrungsniveau.toLowerCase());
      return ergebnis(
        k,
        trifft ? "erfuellt" : "nicht_erfuellt",
        `Gesuchte Erfahrungsstufe: ${s.erfahrungsniveau}.`,
        null,
        null,
      );
    }

    case "lizenz": {
      const gefordert = alsListe(k.wert);
      /*
       * Ein Zertifikat der Person, nicht der Stelle.
       *
       * Geprüft wird umgekehrt: Verlangt die Stelle etwas, das die
       * Person nicht hat? Steht in `lizenzen` der Anzeige nichts, ist
       * nichts zu erfüllen.
       */
      const fehlend = s.lizenzen.filter((l) => !gefordert.includes(l.toLowerCase()));
      if (s.lizenzen.length === 0)
        return ergebnis(k, "erfuellt", "Die Stelle verlangt keinen gesonderten Nachweis.");
      return ergebnis(
        k,
        fehlend.length === 0 ? "erfuellt" : "nicht_erfuellt",
        fehlend.length === 0
          ? "Alle geforderten Nachweise liegen vor."
          : `Es fehlt: ${fehlend.join(", ")}.`,
        null,
        s.lizenzen.join(", "),
      );
    }

    case "arbeitgeber_ausschluss": {
      const raus = alsListe(k.wert);
      const name = s.arbeitgeber.toLowerCase();
      const trifft = raus.some((r) => r.length >= 3 && name.includes(r));
      return ergebnis(
        k,
        trifft ? "nicht_erfuellt" : "erfuellt",
        trifft ? `${s.arbeitgeber} hast du ausgeschlossen.` : `Arbeitgeber ${s.arbeitgeber}.`,
        null,
        s.arbeitgeber,
      );
    }

    case "taetigkeit_ausschluss": {
      const raus = alsListe(k.wert);
      /*
       * Beim Ausschluss zählt der Fliesstext mit.
       *
       * Wer „kein Callcenter" sagt, meint auch die Anzeige, die es nur
       * im Nebensatz erwähnt. Bei einem Wunsch ist Vorsicht der
       * richtige Fehler; bei einem Treffer wäre es Übermut.
       */
      const heuhaufen = `${s.titel} ${s.aufgaben.join(" ")} ${s.anforderungen.join(" ")} ${s.wortmenge}`;
      const treffer = raus.map((r) => wortTreffer(heuhaufen, r)).find((t) => t !== null) ?? null;
      return ergebnis(
        k,
        treffer ? "nicht_erfuellt" : "erfuellt",
        treffer ? `Die Anzeige nennt „${treffer}" — das schliesst du aus.` : "Nichts Ausgeschlossenes gefunden.",
        null,
        treffer,
      );
    }

    case "taetigkeit":
    case "berufsfeld": {
      const gesucht = alsListe(k.wert);
      /*
       * ── Drei Fundorte, und sie wiegen verschieden ─────────
       *
       * Titel und Aufgaben beschreiben die Rolle: Der Titel ist die
       * Festlegung des Arbeitgebers, die Aufgabenliste die Auskunft,
       * was tatsächlich getan wird. Beide zählen.
       *
       * Der Fliesstext ist etwas anderes. Dort steht auch, was neben
       * der Arbeit passiert — und in einem Probelauf stand „Lagerung"
       * in einer Anzeige für Pflegehelfer.
       *
       * Die erste Fassung liess nur den Titel zählen. Das war zu eng:
       * Eine Stelle „Kommissionierer", deren Aufgaben Kommissionierung
       * und Warenannahme im Lager sind, fiel durch die Bedingung
       * „Lager" — obwohl jeder Mensch sie als Lagerstelle liest.
       */
      const imTitel = new Map<string, string>();
      const inAufgaben = new Map<string, string>();
      const imText = new Map<string, string>();
      const aufgabentext = `${s.aufgaben.join(" ")} ${s.anforderungen.join(" ")}`;
      for (const g of gesucht) {
        const t = wortTreffer(s.titel, g);
        if (t !== null) {
          imTitel.set(g, t);
          continue;
        }
        const a = wortTreffer(aufgabentext, g);
        if (a !== null) {
          inAufgaben.set(g, a);
          continue;
        }
        const w = wortTreffer(s.wortmenge, g);
        if (w !== null) imText.set(g, w);
      }
      const rollentreffer = new Map([...imTitel, ...inAufgaben]);
      const treffer = [...rollentreffer.keys(), ...imText.keys()];
      const woerter = [...rollentreffer.values(), ...imText.values()];

      /*
       * ══════════════════════════════════════════════════════════
       * Eine Werteliste ist ein Oder, kein Und
       * ══════════════════════════════════════════════════════════
       *
       * Die erste Fassung verlangte `rollentreffer.size ===
       * gesucht.length` — also ALLE gesuchten Begriffe in Titel oder
       * Aufgaben.
       *
       * Aus „Lager- oder Logistikjobs" wird `["lager","logistik"]`.
       * Die Bestätigung, die die Person liest, sagt „Tätigkeit lager
       * oder logistik". Die Prüfung verlangte beide.
       *
       * Gemessen im echten Lauf: „Recycling- und Lagerhelfer" —
       * Lagerarbeit im Titel — bekam `teilweise`, weil das Wort
       * „Logistik" fehlte. Damit reichte es nie für eine Empfehlung.
       *
       * Zwischen dem Satz, den jemand bestätigt, und der Prüfung, die
       * daraufhin läuft, darf kein Unterschied sein. Steht ein Begriff
       * der Liste in Titel oder Aufgaben, ist die Tätigkeit getroffen.
       */
      if (rollentreffer.size > 0)
        return ergebnis(
          k,
          "erfuellt",
          imTitel.size > 0
            ? `Der Titel nennt ${[...imTitel.values()].join(", ")}.`
            : `Die Aufgaben nennen ${[...inAufgaben.values()].join(", ")}.`,
          null,
          [...rollentreffer.values()].join(", "),
        );

      /*
       * Nur im Fliesstext: `teilweise`.
       *
       * Dort steht auch, was neben der Arbeit passiert — in einem
       * Probelauf stand „Lagerung" in einer Anzeige für Pflegehelfer.
       */
      if (treffer.length > 0)
        return ergebnis(
          k,
          "teilweise",
          `Im Fliesstext steht ${woerter.join(", ")} — weder im Titel noch in den Aufgaben.`,
          null,
          woerter.join(", "),
        );

      /*
       * Ein Titel allein beweist keine Passung — und sein Fehlen
       * beweist keine Nicht-Passung. Der Text der Anzeige kann kurz
       * sein, und übertragbare Fähigkeiten stehen selten wörtlich da.
       * Deshalb `unbekannt` und nicht `nicht_erfuellt`.
       */
      return ergebnis(
        k,
        "unbekannt",
        `Die Anzeige nennt ${gesucht.join(" oder ")} nicht wörtlich.`,
        "aufgaben",
      );
    }

    case "sprache": {
      const stufen = ["A1", "A2", "B1", "B2", "C1", "C2"];
      const eintraege = Object.entries(s.sprachen);
      if (eintraege.length === 0) return ergebnis(k, "erfuellt", "Die Anzeige fordert kein Sprachniveau.");
      const haben = (k.wert ?? {}) as Record<string, string>;
      const luecken = eintraege.filter(([sprache, noetig]) => {
        const hat = haben[sprache];
        if (!hat) return true;
        return stufen.indexOf(hat) < stufen.indexOf(noetig);
      });
      return ergebnis(
        k,
        luecken.length === 0 ? "erfuellt" : "nicht_erfuellt",
        luecken.length === 0
          ? "Dein Sprachniveau reicht aus."
          : `Gefordert: ${luecken.map(([l, v]) => `${l} ${v}`).join(", ")}.`,
        null,
        null,
      );
    }

    default:
      /*
       * Ein unbekannter Schlüssel wird nicht stillschweigend erfüllt.
       *
       * Sonst wäre jeder Tippfehler in einem Kriterium ein Kriterium,
       * das jede Stelle besteht.
       */
      return ergebnis(
        k,
        "unbekannt",
        `Für „${k.kriterium}" gibt es noch keine Prüfung.`,
        k.kriterium,
      );
  }
}

/* ═══════════════════════════════════════════════════════════════
   Gruppen: ODER innerhalb, UND zwischen
   ═══════════════════════════════════════════════════════════════ */

export interface Gruppenergebnis {
  gruppe: string;
  staerke: Staerke;
  status: Kriterienstatus;
  mitglieder: Kriteriumsergebnis[];
}

/**
 * Ergebnisse zu Gruppen zusammenfassen.
 *
 * Eine Gruppe ist erfüllt, sobald eine Alternative erfüllt ist —
 * „Stuttgart oder vollständig remote" ist erfüllt, wenn die Stelle
 * remote ist, auch wenn sie in Hamburg sitzt.
 *
 * Verletzt ist eine Gruppe erst, wenn ALLE Alternativen nachweislich
 * verletzt sind. Ist auch nur eine offen, ist die Gruppe offen.
 */
export function gruppieren(ergebnisse: Kriteriumsergebnis[]): Gruppenergebnis[] {
  const nachGruppe = new Map<string, Kriteriumsergebnis[]>();
  for (const e of ergebnisse) {
    const schluessel = e.gruppe ?? `__einzeln__${e.kriteriumId}`;
    const liste = nachGruppe.get(schluessel);
    if (liste) liste.push(e);
    else nachGruppe.set(schluessel, [e]);
  }

  const raus: Gruppenergebnis[] = [];
  for (const [gruppe, mitglieder] of nachGruppe) {
    /* Die stärkste Anforderung der Gruppe bestimmt ihr Gewicht. */
    const staerke: Staerke = mitglieder.some((m) => m.staerke === "muss")
      ? "muss"
      : mitglieder.some((m) => m.staerke === "wunsch")
        ? "wunsch"
        : "interesse";

    let status: Kriterienstatus;
    if (mitglieder.some((m) => m.status === "erfuellt")) status = "erfuellt";
    else if (mitglieder.every((m) => m.status === "nicht_erfuellt")) status = "nicht_erfuellt";
    else if (mitglieder.some((m) => m.status === "widerspruechlich")) status = "widerspruechlich";
    else if (mitglieder.some((m) => m.status === "teilweise")) status = "teilweise";
    else status = "unbekannt";

    raus.push({ gruppe, staerke, status, mitglieder });
  }
  return raus;
}

/**
 * Ein Kriterium in einem Satzteil, den ein Mensch liest.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das genau einmal existiert
 * ══════════════════════════════════════════════════════════════
 *
 * Es gab drei Fassungen davon — in der Auftragskarte, in der
 * Trefferliste und im Bestätigungssatz. Drei Fassungen desselben
 * Wortlauts laufen auseinander, und dann heisst dieselbe Bedingung an
 * einer Stelle „Teilzeit" und an der nächsten „34 Std./Woche".
 *
 * In einer Mail wiegt das schwerer als in der Oberfläche: Dort steht
 * es als „dein Wunsch", und wer seinen eigenen Wunsch nicht
 * wiedererkennt, glaubt dem Rest auch nicht.
 */
/**
 * Vertragsarten in der Sprache der Person.
 *
 * Die Datenbank führt sie englisch, weil der Import sie so liefert.
 * In einem Satz, den jemand bestätigen soll, hat „temp_agency" nichts
 * zu suchen.
 */
const VERTRAGSFORM_WORT: Record<string, string> = {
  permanent: "Festanstellung",
  fixed_term: "befristete Anstellung",
  temp_agency: "Zeitarbeit",
  freelance: "freie Mitarbeit",
  internship: "Praktikum",
  apprenticeship: "Ausbildung",
  working_student: "Werkstudentenstelle",
};

export function kriteriumSatz(k: { kriterium: string; wert: unknown }): string {
  const wert = Array.isArray(k.wert) ? k.wert.join(" oder ") : String(k.wert);
  switch (k.kriterium) {
    case "taetigkeit":
    case "berufsfeld":
      return `Tätigkeit ${wert}`;
    case "taetigkeit_ausschluss":
      return `nicht ${wert}`;
    case "arbeitgeber_ausschluss":
      return `nicht bei ${wert}`;
    case "arbeitsort":
      return `Arbeitsort ${wert}`;
    case "umkreis": {
      /*
       * Ohne diesen Zweig stand in der Bestätigung „umkreis
       * [object Object]".
       *
       * In einer Mail wiegt das schwerer als anderswo: Dort steht es
       * als „dein Wunsch", und wer seinen eigenen Wunsch nicht
       * wiedererkennt, glaubt dem Rest auch nicht.
       */
      const u = k.wert as { km?: number; ort?: string } | null;
      if (!u || typeof u.km !== "number") return "Umkreis";
      return `höchstens ${u.km} km um ${u.ort ?? "deinen Ort"}`;
    }
    case "arbeitsmodell":
      return arbeitsmodellNormal(wert) === "remote"
        ? "vollständig remote"
        : arbeitsmodellNormal(wert) === "hybrid"
          ? "hybrid"
          : "vor Ort";
    case "vertragsform": {
      /*
       * Der Operator gehört in den Satz.
       *
       * Ohne ihn stand in der Bestätigung „Muss stimmen: … Vertrag
       * temp_agency" — für einen Auftrag, dessen Satz „keine
       * Zeitarbeit" lautete. Wer das liest, bestätigt das Gegenteil
       * dessen, was er gesagt hat.
       */
      const namen = (Array.isArray(k.wert) ? k.wert : [k.wert])
        .map((v) => VERTRAGSFORM_WORT[String(v)] ?? String(v))
        .join(" oder ");
      return (k as { operator?: string }).operator === "nicht"
        ? `nicht ${namen}`
        : `Vertrag ${namen}`;
    }
    case "befristung":
      return k.wert === false ? "unbefristet" : "befristet";
    case "mindestgehalt":
      return `mindestens ${Number(k.wert).toLocaleString("de-DE")} EUR im Jahr`;
    case "wochenstunden":
      return `${wert} Stunden pro Woche`;
    case "schichtarbeit":
      return k.wert === false ? "keine Schichtarbeit" : "Schichtarbeit";
    case "reisebereitschaft":
      return `höchstens ${wert} Prozent Reiseanteil`;
    case "pendelzeit":
      return `höchstens ${wert} Minuten Fahrtzeit`;
    case "erfahrungsniveau":
      return `Erfahrungsstufe ${wert}`;
    case "lizenz":
      return `Nachweis ${wert}`;
    case "sprache":
      return "Sprachniveau";
    default:
      return `${k.kriterium} ${wert}`;
  }
}
