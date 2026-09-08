/**
 * Muss und Wunsch — und warum ein Muss nicht wegzurechnen ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Unterschied, den ein Score nicht ausdrücken kann
 * ══════════════════════════════════════════════════════════════
 *
 * „Tagschicht wäre schön" und „Nachtschicht kommt nicht infrage" sind
 * zwei verschiedene Sätze. Ein Punktesystem macht aus beiden einen
 * Abzug — und ein grosser Vorteil an anderer Stelle gleicht den Abzug
 * aus. Das Ergebnis ist eine Empfehlung, die eine Entscheidung
 * überstimmt, die die Person selbst schon getroffen hat.
 *
 * `constraints.ts` trennt bereits `blocked` von `uncertain`, und das
 * ist die halbe Miete. Was fehlte, sind zwei Dinge:
 *
 *   **Der Rang.** Ein Muss verträgt keine Verrechnung, ein Wunsch
 *   schon. Ohne diese Unterscheidung ist jede Bedingung verhandelbar
 *   oder keine.
 *
 *   **Die Bestätigung.** Aus einem Gespräch verdichtete Bedingungen
 *   sind Vermutungen über die Person, bis sie zustimmt. Sie dürfen
 *   deshalb nichts ausschliessen.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum das Ändern hier steht
 * ══════════════════════════════════════════════════════════════
 *
 * Der Prüfbestand hat dafür einen eigenen Fall (B06): Die Person
 * erweitert nur den Radius. Danach müssen alle anderen bestätigten
 * Bedingungen unverändert dastehen.
 *
 * Das klingt selbstverständlich und ist der Ort, an dem stille
 * Lockerungen entstehen — ein neu aufgebautes Bedingungsobjekt, in dem
 * eine Zeile fehlt, sieht aus wie ein Objekt, in dem nie eine stand.
 * `bedingungenAendern` gibt deshalb zurück, was es NICHT angefasst hat.
 * Was man beweisen muss, kann man nicht vergessen.
 */

export const BEDINGUNGSRAENGE = ["muss", "wunsch"] as const;
export type Bedingungsrang = (typeof BEDINGUNGSRAENGE)[number];

export const BEDINGUNGSHERKUENFTE = ["gesagt", "verdichtet", "vorbelegt"] as const;
export type Bedingungsherkunft = (typeof BEDINGUNGSHERKUENFTE)[number];

export const HERKUNFTSTEXT: Record<Bedingungsherkunft, string> = {
  gesagt: "so von dir gesagt",
  verdichtet: "aus deinen Angaben zusammengefasst",
  vorbelegt: "voreingestellt",
};

export interface Bedingung {
  /** Eindeutig je Person. Der Griff, an dem geändert wird. */
  schluessel: string;
  /** In der Sprache der Person, nicht als Feldname. */
  text: string;
  rang: Bedingungsrang;
  herkunft: Bedingungsherkunft;
  /**
   * Die Person hat diese Bedingung ausdrücklich bestätigt.
   *
   * Nur eine bestätigte Muss-Bedingung darf eine Stelle ausschliessen.
   * Alles andere wäre ein Ausschluss aufgrund einer Vermutung.
   */
  bestaetigt: boolean;
}

/** Was die Anzeige zu einer Bedingung sagt. `unbekannt` ist kein `verletzt`. */
export const BEFUNDE = ["erfuellt", "verletzt", "unbekannt"] as const;
export type Befund = (typeof BEFUNDE)[number];

export interface Bedingungsurteil {
  bedingung: Bedingung;
  befund: Befund;
  /**
   * Diese Bedingung schliesst die Stelle aus.
   *
   * Nur bei `muss` + `bestaetigt` + `verletzt`. Drei Bedingungen, und
   * jede einzelne ist ein bewusster Halt: kein Ausschluss durch einen
   * Wunsch, keiner durch eine Vermutung, keiner durch eine Lücke.
   */
  schliesstAus: boolean;
  satz: string;
}

export function bedingungBewerten(bedingung: Bedingung, befund: Befund): Bedingungsurteil {
  const schliesstAus = bedingung.rang === "muss" && bedingung.bestaetigt && befund === "verletzt";
  const satz =
    befund === "unbekannt"
      ? `${bedingung.text}: steht nicht in der Anzeige.`
      : befund === "erfuellt"
        ? `${bedingung.text}: erfüllt.`
        : schliesstAus
          ? `${bedingung.text}: nicht erfüllt — und von dir als unverzichtbar bestätigt.`
          : bedingung.rang === "muss"
            ? `${bedingung.text}: nicht erfüllt. Du hast diese Bedingung noch nicht bestätigt.`
            : `${bedingung.text}: nicht erfüllt. Das war ein Wunsch, kein Muss.`;
  return { bedingung, befund, schliesstAus, satz };
}

export interface Bedingungsbilanz {
  urteile: readonly Bedingungsurteil[];
  /** Bestätigte Muss-Bedingungen, die verletzt sind. */
  ausschluesse: readonly Bedingungsurteil[];
  /** Muss-Bedingungen, zu denen die Anzeige schweigt. */
  offeneMuss: readonly Bedingungsurteil[];
  /**
   * Ein Vorteil hebt einen Ausschluss nicht auf.
   *
   * Das Feld existiert, damit die Oberfläche beides zeigen kann, ohne
   * dass eines das andere aufwiegt: Der kürzere Weg bleibt wahr, auch
   * wenn die Wochenendbedingung verletzt ist.
   */
  trotzVorteilenAusgeschlossen: boolean;
}

export function bedingungsbilanz(urteile: readonly Bedingungsurteil[]): Bedingungsbilanz {
  const ausschluesse = urteile.filter((u) => u.schliesstAus);
  const offeneMuss = urteile.filter(
    (u) => u.bedingung.rang === "muss" && u.bedingung.bestaetigt && u.befund === "unbekannt",
  );
  return {
    urteile,
    ausschluesse,
    offeneMuss,
    trotzVorteilenAusgeschlossen: ausschluesse.length > 0,
  };
}

export interface Aenderungsprotokoll {
  nachher: readonly Bedingung[];
  /** Die Schlüssel, die nicht angefasst wurden — der Nachweis. */
  unveraendert: readonly string[];
  geaendert: string | null;
  /** Was sich innerhalb der einen Bedingung geändert hat. */
  felder: readonly string[];
}

/**
 * Genau eine Bedingung ändern.
 *
 * Kein Neuaufbau der Liste, kein `map` über alles: Diese Funktion fasst
 * einen Schlüssel an und gibt die übrigen unverändert weiter — als
 * dieselben Objekte, damit ein Test die Gleichheit prüfen kann und
 * nicht nur den Inhalt.
 *
 * Einen unbekannten Schlüssel legt sie nicht an. Eine Änderung, die
 * still zu einer neuen Bedingung wird, ist der zweite Weg, auf dem
 * Bedingungen verloren gehen: Der Tippfehler erzeugt eine zweite Zeile,
 * die alte bleibt stehen, und beide gelten.
 */
export function bedingungenAendern(
  vorher: readonly Bedingung[],
  schluessel: string,
  aenderung: Partial<Omit<Bedingung, "schluessel">>,
): Aenderungsprotokoll {
  const treffer = vorher.find((b) => b.schluessel === schluessel);
  if (!treffer) {
    return { nachher: vorher, unveraendert: vorher.map((b) => b.schluessel), geaendert: null, felder: [] };
  }

  const felder = (Object.keys(aenderung) as (keyof typeof aenderung)[]).filter(
    (k) => aenderung[k] !== undefined && aenderung[k] !== treffer[k],
  );

  if (felder.length === 0) {
    return { nachher: vorher, unveraendert: vorher.map((b) => b.schluessel), geaendert: null, felder: [] };
  }

  const neu: Bedingung = { ...treffer, ...aenderung, schluessel };
  return {
    nachher: vorher.map((b) => (b.schluessel === schluessel ? neu : b)),
    unveraendert: vorher.filter((b) => b.schluessel !== schluessel).map((b) => b.schluessel),
    geaendert: schluessel,
    felder: felder as string[],
  };
}
