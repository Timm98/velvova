/**
 * ══════════════════════════════════════════════════════════════════
 * Die sechs Ebenen zwischen einem Wunsch und einem Auftrag
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Betrieb sagt: „Wir möchten Kunden schneller antworten.“ Der
 * heutige Weg in `bedarfAufnehmen` macht daraus einen Angebotsentwurf
 * — er sucht sich eine Rolle und schreibt eine Zeile in `angebote`.
 *
 * Das ist der Fehler, den diese Datei verhindert. Zwischen dem Satz
 * und einer Stelle liegen fünf Schritte, und jeder einzelne kann
 * ergeben, dass niemand eingestellt werden muss.
 *
 *   beduerfnis                Gewünschte Veränderung.
 *   beobachtung               Erhobenes oder berichtetes Geschehen.
 *   hypothese                 Eine noch zu prüfende Erklärung.
 *   bestaetigtes_problem      Im angegebenen Umfang geprüfter Missstand.
 *   loesungsbedarf            Das Ergebnis, das erreicht werden soll.
 *   freigegebene_moeglichkeit Ein autorisierter Job oder Auftrag.
 *
 * ── Der Satz, an dem alles hängt ────────────────────────────────
 *
 * **Ein bestätigtes Problem ist noch kein bestätigter Personalbedarf.**
 *
 * Manche Probleme verschwinden, wenn eine Zuständigkeit geklärt wird.
 * Ein System, das aus jedem Befund eine Stelle macht, ist keine
 * Diagnose, sondern ein Verkaufstrichter — und würde genau das
 * Vertrauen kosten, von dem das Produkt lebt.
 *
 * ── Warum der Aufstieg nicht aus Text abgeleitet wird ───────────
 *
 * Die Ebene ist nichts, was ein Modell einem Absatz ansieht. Sie ist
 * verdient: durch Belege, durch geprüfte Gegenerklärungen, durch die
 * Bestätigung eines Menschen im Betrieb. `aufstiegPruefen` rechnet
 * genau das nach und nennt sonst den Grund.
 *
 * `ebenensignal` gibt es trotzdem — aber es heisst Signal, nicht
 * Einstufung, und es darf nur entscheiden, ob eine Rückfrage kommt.
 */

export const EBENEN = [
  "beduerfnis",
  "beobachtung",
  "hypothese",
  "bestaetigtes_problem",
  "loesungsbedarf",
  "freigegebene_moeglichkeit",
] as const;

export type Ebene = (typeof EBENEN)[number];

/** Wo eine Ebene in der Kette steht. Kleiner heisst früher. */
export function ebenenrang(e: Ebene): number {
  return EBENEN.indexOf(e);
}

/** Was auf dieser Ebene tatsächlich feststeht — in einem Satz. */
export const EBENENSATZ: Record<Ebene, string> = {
  beduerfnis: "Eine gewünschte Veränderung. Noch ist nichts erhoben.",
  beobachtung: "Etwas wurde beobachtet oder berichtet. Die Ursache ist offen.",
  hypothese: "Eine mögliche Erklärung. Sie ist noch nicht geprüft.",
  bestaetigtes_problem:
    "Ein im angegebenen Umfang geprüfter Missstand. Ob dafür jemand eingestellt werden muss, ist damit nicht gesagt.",
  loesungsbedarf: "Das Ergebnis, das erreicht werden soll. Der Weg dorthin steht fest.",
  freigegebene_moeglichkeit: "Ein Mensch im Betrieb hat Umfang, Bedingungen und Ansprache freigegeben.",
};

/**
 * Die Wege, die aus einem bestätigten Problem herausführen.
 *
 * „Erst messen“ und „vorerst beobachten“ stehen bewusst mit in der
 * Liste. Ein Diagnosesystem, dessen Ergebnismenge nur aus Handlungen
 * besteht, findet immer eine Handlung.
 */
export const LOESUNGSWEGE = [
  "ablauf_aendern",
  "zustaendigkeit_klaeren",
  "faehigkeiten_entwickeln",
  "werkzeug_einsetzen",
  "auftrag_vergeben",
  "rolle_schaffen",
  "erst_messen",
  "vorerst_beobachten",
] as const;

export type Loesungsart = (typeof LOESUNGSWEGE)[number];

/** Nur diese zwei Wege führen zu einem Menschen von aussen. */
export const PERSONENWEGE: readonly Loesungsart[] = ["auftrag_vergeben", "rolle_schaffen"];

export function brauchtMenschen(l: Loesungsart): boolean {
  return PERSONENWEGE.includes(l);
}

/**
 * Ob auf dieser Ebene überhaupt von Personalbedarf die Rede sein darf.
 *
 * Erst ab `loesungsbedarf`, und auch dann nur, wenn der gewählte Weg
 * einer der beiden Personenwege ist. Ohne gewählten Weg lautet die
 * Antwort nein — nicht „vielleicht“.
 */
export function istPersonalbedarf(e: Ebene, weg: Loesungsart | null): boolean {
  if (ebenenrang(e) < ebenenrang("loesungsbedarf")) return false;
  if (weg === null) return false;
  return brauchtMenschen(weg);
}

/** Was beim Aufstieg von einer Ebene zur nächsten vorliegen muss. */
export interface Aufstiegslage {
  /**
   * Wie viele voneinander unabhängige Belege es gibt.
   *
   * Unabhängig heisst: aus verschiedenen Quellen. Drei Kopien
   * desselben Prozesshandbuchs sind ein Beleg, nicht drei —
   * `unabhaengigeQuellen` in `befundlage.ts` rechnet das aus.
   */
  unabhaengigeBelege: number;
  /** Ob nach Gegenbelegen tatsächlich gesucht wurde. */
  gegenbelegeGeprueft: boolean;
  /** Die festgehaltenen alternativen Erklärungen. */
  alternativen: readonly string[];
  /** Ob ein Mensch im Betrieb den Befund bestätigt hat. */
  vomUnternehmenBestaetigt: boolean;
  /** Wer freigegeben hat. `null` heisst: niemand. */
  freigabeVon: string | null;
  /** Der gewählte Lösungsweg, sobald es einen gibt. */
  weg: Loesungsart | null;
}

export type Aufstieg = { erlaubt: true } | { erlaubt: false; grund: string };

/**
 * Darf dieser Vorgang eine Ebene aufsteigen?
 *
 * ── Warum nur ein Schritt auf einmal ────────────────────────────
 *
 * Weil jeder übersprungene Schritt genau der ist, der die
 * Feststellung getragen hätte. Der Sprung von „Wir möchten schneller
 * antworten“ zu „Wir brauchen jemanden“ ist die häufigste Form, in
 * der ein erfundener Bedarf entsteht — und er sieht in jedem Protokoll
 * plausibel aus.
 */
export function aufstiegPruefen(von: Ebene, nach: Ebene, lage: Aufstiegslage): Aufstieg {
  const vonRang = ebenenrang(von);
  const nachRang = ebenenrang(nach);

  if (nachRang <= vonRang) {
    return { erlaubt: false, grund: "Das ist kein Aufstieg." };
  }
  if (nachRang - vonRang > 1) {
    return {
      erlaubt: false,
      grund: `Zwischen „${von}“ und „${nach}“ liegt mindestens ein Schritt, der nicht gegangen wurde.`,
    };
  }

  switch (nach) {
    case "beobachtung":
      if (lage.unabhaengigeBelege < 1) {
        return { erlaubt: false, grund: "Es liegt kein Beleg vor — nur der Wunsch." };
      }
      return { erlaubt: true };

    /*
     * Eine Hypothese kostet nichts und darf falsch sein. Sie hier zu
     * bremsen hiesse, das Denken zu bremsen; gebremst wird der
     * Schritt danach.
     */
    case "hypothese":
      return { erlaubt: true };

    case "bestaetigtes_problem": {
      if (lage.alternativen.length < 1) {
        return {
          erlaubt: false,
          grund: "Es ist keine alternative Erklärung festgehalten. Ein Signal ist keine Ursache.",
        };
      }
      if (!lage.gegenbelegeGeprueft) {
        return { erlaubt: false, grund: "Nach Gegenbelegen wurde noch nicht gesucht." };
      }
      if (lage.unabhaengigeBelege < 2) {
        return {
          erlaubt: false,
          grund: "Es gibt nur eine Quelle. Mehrere Kopien derselben Unterlage sind keine zweite.",
        };
      }
      if (!lage.vomUnternehmenBestaetigt) {
        return { erlaubt: false, grund: "Der Befund ist im Betrieb noch nicht bestätigt." };
      }
      return { erlaubt: true };
    }

    case "loesungsbedarf":
      if (lage.weg === null) {
        return { erlaubt: false, grund: "Es ist noch kein Lösungsweg gewählt." };
      }
      return { erlaubt: true };

    case "freigegebene_moeglichkeit":
      if (lage.freigabeVon === null) {
        return { erlaubt: false, grund: "Niemand hat Umfang und Bedingungen freigegeben." };
      }
      if (lage.weg === null || !brauchtMenschen(lage.weg)) {
        return {
          erlaubt: false,
          grund: "Der gewählte Weg braucht keinen Menschen von aussen.",
        };
      }
      return { erlaubt: true };

    default:
      return { erlaubt: false, grund: "Unbekannte Ebene." };
  }
}

/**
 * Darf aus diesem Stand ein Angebot entstehen?
 *
 * Der Riegel vor `angebote`. Er sitzt hier und nicht in der
 * Oberfläche, weil er auch für den Weg über die Sprachnachricht und
 * über jeden künftigen Weg gelten muss.
 */
export function darfAngebotEntstehen(e: Ebene, weg: Loesungsart | null): boolean {
  return istPersonalbedarf(e, weg);
}

/**
 * Wie viele Fragen eine Gesprächsrunde höchstens stellt.
 *
 * Drei, wie überall im Produkt. Danach antwortet niemand mehr, und
 * eine unbeantwortete vierte Frage ist schlechter als eine
 * ungestellte.
 */
export const MAX_FRAGEN_RUNDE = 3;

/**
 * Die Fragen dieser Runde.
 *
 * Bereits Bestätigtes fällt heraus — eine zweite Frage nach etwas,
 * das jemand schon gesagt hat, ist das verlässlichste Zeichen dafür,
 * dass niemand zuhört. Die Reihenfolge der Eingabe ist die
 * Rangfolge: Vorne steht, was die nächste Entscheidung ändert.
 */
export function fragenAuswaehlen(
  offen: readonly string[],
  bereitsBestaetigt: readonly string[],
): string[] {
  const bekannt = new Set(bereitsBestaetigt.map((b) => b.trim().toLowerCase()));
  return offen.filter((f) => !bekannt.has(f.trim().toLowerCase())).slice(0, MAX_FRAGEN_RUNDE);
}

/**
 * Wonach ein Satz klingt — ein Signal, keine Einstufung.
 *
 * ── Was diese Funktion darf und was nicht ───────────────────────
 *
 * Sie darf entscheiden, ob eine Rückfrage kommt. Sie darf nichts
 * schreiben, nichts freigeben und keine Ebene setzen. Der Aufstieg
 * läuft ausschliesslich über `aufstiegPruefen`.
 *
 * `null` heisst: kein Signal. Das ist der häufigste Rückgabewert und
 * der ehrlichste — die meisten Sätze klingen nach gar nichts.
 */
export function ebenensignal(text: string): Ebene | null {
  const t = ` ${text.toLowerCase()} `;

  /*
   * Wunschformeln. Sie stehen vorn, weil ein Satz beides enthalten
   * kann („Wir möchten schneller antworten, es bleibt einiges
   * liegen“) — und dann ist der Wunsch die schwächere Ebene und die
   * richtige Antwort.
   */
  const wunsch = [
    "wir möchten",
    "wir wollen",
    "wir hätten gern",
    "wir hätten gerne",
    "wäre schön",
    "ziel ist",
    "uns ist wichtig",
    "wir brauchen mehr",
  ];
  if (wunsch.some((w) => t.includes(w))) return "beduerfnis";

  /*
   * ── Warum hier Muster stehen und oben Zeichenketten ─────────────
   *
   * Weil das Deutsche seine Verben trennt. „Anfragen bleiben mehrere
   * Tage liegen“ enthält weder „bleiben liegen“ noch „liegenbleiben“
   * — die beiden Hälften stehen vier Wörter auseinander. Ein Test
   * unten steht genau auf diesem Satz; er war zuerst rot.
   *
   * `\\w` kennt keine Umlaute, deshalb die ausgeschriebene Klasse.
   */
  const wort = "[a-zäöüß0-9-]+";
  const beobachtet: RegExp[] = [
    new RegExp(`bleib[a-zäöüß]* (${wort} ){0,4}liegen`),
    new RegExp(`dauer[a-zäöüß]* (${wort} ){0,3}(zu )?lang`),
    /häufen sich/,
    /rückstand|rückstände/,
    /doppelt (gepflegt|erfasst|eingegeben|gemacht)/,
    /beschweren sich|beschwerden häufen/,
    new RegExp(`geh(t|en) (${wort} ){0,3}unter`),
    /wird vergessen|werden vergessen/,
    /liegt seit|liegen seit/,
  ];
  if (beobachtet.some((m) => m.test(t))) return "beobachtung";

  return null;
}

/**
 * Die Fragen, mit denen aus einer Situation eine Beobachtung wird.
 *
 * Fest formuliert und je Ebene verschieden, weil sie an jemanden
 * gehen, der gerade einen Satz über seinen Betrieb gesagt hat und
 * kein Formular erwartet.
 */
export const KLAERUNGSFRAGEN: Record<"beduerfnis" | "beobachtung", readonly string[]> = {
  beduerfnis: [
    "Woran merken Sie das im Alltag — was bleibt liegen oder dauert zu lange?",
    "In welchem Bereich oder Team ist das am deutlichsten?",
    "Woran würden Sie erkennen, dass es besser geworden ist?",
  ],
  beobachtung: [
    "Über welchen Zeitraum haben Sie das beobachtet, und wie viele Vorgänge betrifft es?",
    "Wer ist dafür heute zuständig?",
    "Was haben Sie schon versucht?",
  ],
};

export function klaerungsfragen(signal: Ebene | null): string[] {
  if (signal !== "beduerfnis" && signal !== "beobachtung") return [];
  return [...KLAERUNGSFRAGEN[signal]].slice(0, MAX_FRAGEN_RUNDE);
}

/** Umlaute falten, damit „Lagerfachkräfte“ und „Lagerfachkraft“ denselben Stamm haben. */
function falten(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/** Wie viele Zeichen eines Wortes verglichen werden — kurz genug für die Beugung. */
const STAMMLAENGE = 6;

/**
 * Steht die Rolle, die das Modell eingetragen hat, im Text des Menschen?
 *
 * ── Warum diese Prüfung nötig ist ───────────────────────────────
 *
 * Die Anweisung an das Modell sagt: Trage nur ein, was gesagt wurde.
 * Meistens hält es sich daran. Bei „Wir möchten Kunden schneller
 * antworten“ trägt es trotzdem gern „Kundenservice-Mitarbeiter“ ein
 * — und damit stünde in `angebote` eine Rolle, die niemand genannt
 * hat. Das ist der erfundene Bedarf in seiner häufigsten Form.
 *
 * Geprüft wird auf Wortstämmen, weil Deutsch beugt: „Lagerfachkräfte“
 * im Text muss „Lagerfachkraft“ im Feld decken. Alle inhaltlichen
 * Wörter der Rolle müssen vorkommen — bei
 * „Kundenservice-Mitarbeiter“ reicht „Kunden“ allein nicht.
 */
export function rolleBelegt(rolle: string | null, text: string): boolean {
  if (rolle === null) return true;
  const r = falten(rolle);
  const quelle = falten(text);

  const woerter = r.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  if (woerter.length === 0) return true;

  return woerter.every((w) => quelle.includes(w.slice(0, STAMMLAENGE)));
}
