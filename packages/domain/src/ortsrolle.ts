/**
 * Welcher Ort ist gemeint — und ist er überhaupt einer?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Stellenort mehr als ein Feld braucht
 * ══════════════════════════════════════════════════════════════
 *
 * In der Wettbewerbsprüfung vom 7. September 2026 standen bei drei
 * Anzeigen im Kopf und im Text verschiedene Städte: Stuttgart gegen
 * Freiburg, Halle gegen Magdeburg, München gegen Nürnberg. Welcher
 * der beiden Orte falsch ist, war nicht feststellbar — und genau das
 * ist der Punkt.
 *
 * Ein Portal, das solche Anzeigen mit einer Pendelzeit versieht,
 * rechnet mit einem geratenen Ort. Die Zahl sieht danach genauso
 * verlässlich aus wie jede andere, und die Person trifft eine
 * Entscheidung auf einer Grundlage, die es nicht gibt.
 *
 * Deshalb liegt hier keine Prüfung „ist der Ort richtig", sondern eine
 * Unterscheidung, welche Art von Ort jede Angabe überhaupt behauptet:
 *
 *   einsatzort          dort wird gearbeitet
 *   firmensitz          dort sitzt das Unternehmen
 *   recruiting_region   dort wird gesucht
 *   unklar              die Rolle geht aus der Quelle nicht hervor
 *
 * Ein Firmensitz in Stuttgart und ein Einsatzort in Freiburg sind kein
 * Widerspruch, sondern der Normalfall. Zwei verschiedene Einsatzorte
 * sind einer.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Datei ausdrücklich NICHT tut
 * ══════════════════════════════════════════════════════════════
 *
 * Sie schlägt keine Koordinaten nach und entscheidet nicht, welcher
 * Ort stimmt. Ein stilles Geocoding des ersten Treffers wäre genau der
 * Fehler, den sie verhindern soll: Es macht aus einer offenen Frage
 * eine Zahl.
 *
 * Ob ein Ortsteil zu einer Gemeinde gehört, kann sie ebenfalls nicht
 * wissen. Wer es weiss, sagt es über `teilVon` — belegt, nicht geraten.
 */

export const ORTSROLLEN = ["einsatzort", "firmensitz", "recruiting_region", "unklar"] as const;
export type Ortsrolle = (typeof ORTSROLLEN)[number];

export const ORTSROLLENTEXT: Record<Ortsrolle, string> = {
  einsatzort: "Arbeitsort",
  firmensitz: "Sitz des Unternehmens",
  recruiting_region: "Suchregion",
  unklar: "Ort ohne erkennbare Zuordnung",
};

export interface Ortsangabe {
  /** Der Ort, wie er in der Quelle steht. */
  ort: string;
  rolle: Ortsrolle;
  /** Verweise auf die Fundstellen. Ohne Beleg keine Rolle. */
  belege: readonly string[];
  /**
   * Diese Angabe ist ein Ortsteil des genannten Ortes — belegt, nicht
   * vermutet.
   *
   * Der Bericht nennt das ausdrücklich: Dornstedt und Teutschenthal
   * wurden NICHT als zusätzlicher Ortsfehler gezählt, weil die
   * Verwaltungsebenen nicht geprüft waren. Wer diesen Zusammenhang
   * belegen kann, trägt ihn hier ein; wer nicht, lässt das Feld leer
   * und bekommt einen Widerspruch statt einer Annahme.
   */
  teilVon?: string;
}

export const ORTSBEFUNDE = [
  "eindeutig",
  "mehrere_belegt",
  "widerspruch",
  "unbekannt",
  "ohne_einsatzort",
] as const;
export type Ortsbefund = (typeof ORTSBEFUNDE)[number];

export interface Ortslage {
  befund: Ortsbefund;
  /** Der Ort, mit dem gerechnet werden darf — oder `null`. */
  einsatzort: string | null;
  /**
   * Der Ort steht nur als ausdrücklich gewähltes Szenario.
   *
   * Ein Szenario darf gezeigt werden. Es wird nicht gespeichert, als
   * wäre die Stelle geklärt, und es erfüllt keine Pendelbedingung.
   */
  nurSzenario: boolean;
  /** Bei mehreren belegten Einsatzorten: die Auswahl, aus der zu klären ist. */
  auswahl: readonly string[];
  /** Ein Satz für die Person. Kein Feldname, kein Fehlercode. */
  satz: string;
}

/** Vergleicht Ortsnamen tolerant gegen Schreibweise, nicht gegen Bedeutung. */
function gleich(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("de") === b.trim().toLocaleLowerCase("de");
}

/**
 * Gehört `a` zu `b` oder umgekehrt — nach dem, was belegt ist?
 *
 * Nur über `teilVon`. „Raum Freiburg" und „Freiburg" sehen für einen
 * Menschen zusammengehörig aus; ein Textvergleich, der das erkennen
 * will, erkennt irgendwann auch „Frankfurt (Oder)" als „Frankfurt".
 */
function zusammengehoerig(a: Ortsangabe, b: Ortsangabe): boolean {
  if (gleich(a.ort, b.ort)) return true;
  if (a.teilVon && gleich(a.teilVon, b.ort)) return true;
  if (b.teilVon && gleich(b.teilVon, a.ort)) return true;
  return a.teilVon !== undefined && b.teilVon !== undefined && gleich(a.teilVon, b.teilVon);
}

export interface Ortsoptionen {
  /**
   * Die Quelle belegt, dass es keinen festen Einsatzort gibt.
   *
   * Nur bei belegter Arbeit ohne physischen Einsatzort. „Remote" allein
   * genügt dafür nicht — siehe `arbeitsort.ts` in der Google-Referenz:
   * geografische Anforderungen an Fernarbeit bleiben eine eigene Frage.
   */
  ohneEinsatzortBelegt?: boolean;
  /**
   * Die Quelle nennt ausdrücklich mehrere Einsatzorte zur Auswahl.
   *
   * Das macht aus einem Widerspruch keinen geklärten Fall: Welcher der
   * Orte für diese Person gilt, ist weiterhin offen. Es ändert nur den
   * Grund — ein Mehrstandort-Angebot ist kein Datenfehler.
   */
  mehrstandortBelegt?: boolean;
}

/**
 * Aus den Ortsangaben einer Anzeige die Lage bestimmen.
 *
 * Die Reihenfolge der Prüfungen ist die Rangfolge: Ein belegter Fall
 * ohne Einsatzort schlägt alles, danach zählen nur noch Angaben mit der
 * Rolle `einsatzort`. Firmensitz und Suchregion können einen
 * Arbeitsort weder setzen noch widerlegen.
 */
export function ortslage(
  angaben: readonly Ortsangabe[],
  optionen: Ortsoptionen = {},
): Ortslage {
  if (optionen.ohneEinsatzortBelegt) {
    return {
      befund: "ohne_einsatzort",
      einsatzort: null,
      nurSzenario: false,
      auswahl: [],
      satz: "Für diese Stelle ist kein fester Arbeitsort angegeben.",
    };
  }

  const einsatzorte = angaben.filter((a) => a.rolle === "einsatzort" && a.belege.length > 0);

  if (einsatzorte.length === 0) {
    const andere = angaben.filter((a) => a.rolle !== "einsatzort");
    return {
      befund: "unbekannt",
      einsatzort: null,
      nurSzenario: false,
      auswahl: [],
      satz:
        andere.length > 0
          ? "Die Anzeige nennt einen Ort, aber nicht, ob dort gearbeitet wird."
          : "Die Anzeige nennt keinen Arbeitsort.",
    };
  }

  /* Verschiedene Schreibweisen desselben Ortes sind ein Ort. */
  const gruppen: Ortsangabe[][] = [];
  for (const a of einsatzorte) {
    const treffer = gruppen.find((g) => g.some((b) => zusammengehoerig(a, b)));
    if (treffer) treffer.push(a);
    else gruppen.push([a]);
  }

  if (gruppen.length === 1) {
    return {
      befund: "eindeutig",
      einsatzort: gruppen[0]![0]!.ort,
      nurSzenario: false,
      auswahl: [],
      satz: `Arbeitsort: ${gruppen[0]![0]!.ort}.`,
    };
  }

  const auswahl = gruppen.map((g) => g[0]!.ort);
  return {
    befund: optionen.mehrstandortBelegt ? "mehrere_belegt" : "widerspruch",
    einsatzort: null,
    nurSzenario: false,
    auswahl,
    satz: optionen.mehrstandortBelegt
      ? `Die Stelle wird für mehrere Orte ausgeschrieben (${auswahl.join(", ")}). Welcher für dich gilt, ist noch offen.`
      : `Die Ortsangaben widersprechen sich (${auswahl.join(" gegen ")}). Bevor ich deinen Arbeitsweg vergleiche, muss der konkrete Einsatzort geklärt sein.`,
  };
}

/**
 * Darf mit diesem Ort gerechnet werden?
 *
 * Die eine Frage, an der die Pendelrechnung hängt. Ein Szenario zählt
 * nicht: Es ist eine Anschauung, kein Befund.
 */
export function arbeitswegBelastbar(lage: Ortslage): boolean {
  return lage.befund === "eindeutig" && !lage.nurSzenario && lage.einsatzort !== null;
}

/**
 * Einen der offenen Orte ausdrücklich als Szenario ansehen.
 *
 * Die Person darf sich anschauen, was Freiburg bedeuten würde — sie
 * darf nur nicht mit dem Ergebnis dastehen, als sei Freiburg geklärt.
 * Deshalb bleibt `nurSzenario` gesetzt und `befund` unverändert offen.
 *
 * Ein Ort, der gar nicht zur Auswahl stand, wird nicht angenommen:
 * Sonst entstünde über den Umweg „Szenario" doch wieder ein frei
 * gewählter Arbeitsort.
 */
export function szenario(lage: Ortslage, ort: string): Ortslage {
  if (!lage.auswahl.some((o) => gleich(o, ort))) return lage;
  return {
    ...lage,
    einsatzort: ort,
    nurSzenario: true,
    satz: `Angenommen, der Arbeitsort wäre ${ort} — das ist eine Annahme, keine geklärte Angabe.`,
  };
}
