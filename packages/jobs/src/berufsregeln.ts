/**
 * Amtliche Berufsbezeichnungen — die reinen Regeln.
 *
 * Hier steht, was ohne Datenbank und ohne Netz entschieden werden
 * kann: wie ein Anzeigentitel auf seinen Kern gebracht wird, in
 * welcher Reihenfolge gesucht wird, und wann eine Zuordnung eindeutig
 * genug ist, um eine Gehaltsspanne daran zu hängen.
 *
 * ── Warum das hier liegt und nicht in der Weboberfläche ───────
 *
 * Drei Stellen brauchen dieselben Regeln: die Anzeige (Weboberfläche),
 * der Sammellauf (Skript) und die Auffrischung (Worker). Läge die
 * Wahrheit in einer der drei, verschöben sich die beiden anderen
 * irgendwann still gegen sie — und niemand könnte sagen, welche recht
 * hat.
 */

/**
 * Ab wann eine Zuordnung eindeutig genug ist.
 *
 * Eine Bezeichnung, die unter hundert Treffern dreimal vorkommt, ist
 * kein Berufsbild, sondern Rauschen. Beide Bedingungen müssen gelten:
 * ein Mindestanteil UND eine Mindestzahl — der Anteil allein liesse
 * „1 von 2" durchgehen.
 */
const MIN_ANTEIL = 0.2;
const MIN_TREFFER = 3;


export interface Entgeltreferenz {
  beruf: string;
  /** Euro je Jahr. */
  q1: number;
  median: number;
  q3: number;
  anzahl: number;
  quelle: "bundesagentur" | "entgeltatlas";
  stand: Date;
}

/**
 * Den Anzeigentitel auf seinen Kern bringen.
 *
 * Was wegfällt: Geschlechtszusätze in jeder verbreiteten Schreibweise,
 * Klammerzusätze, Standortanhängsel nach Bindestrich, doppelte
 * Leerzeichen. Was bleibt: das Wort, unter dem ein Mensch den Beruf
 * suchen würde.
 *
 * Der Zweck ist doppelt — die Suchanfrage wird besser, und der
 * Zwischenspeicher trifft öfter: „Disponent (m/w/d)", „Disponent
 * m/w/d" und „Disponent/in" sind derselbe Schlüssel.
 */
export function titelNormalisieren(titel: string): string {
  return titel
    .toLowerCase()
    // (m/w/d), m/w/d, (w/m/x), (all genders), (gn) …
    .replace(/\(?\s*[mwdfxa]\s*[/|]\s*[mwdfxa]\s*([/|]\s*[mwdfxa]\s*)?\)?/g, " ")
    .replace(/\((?:all\s+genders?|gn|divers|d)\)/g, " ")
    .replace(/\*in\b|:in\b|\/-?in\b|\(in\)/g, " ")
    // Klammerzusätze und alles nach einem Trenner: „Disponent – Karlsruhe"
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+[–—|]\s+.*$/, " ")
    .replace(/[^\p{L}\p{N}\s+.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wörter, die eine Stufe bezeichnen und keinen Beruf.
 *
 * „Senior BI Developer" fand drei Treffer, „BI Developer" findet
 * genug. Die Stufe gehört zur Stelle, nicht zum Berufsbild — und der
 * Entgeltatlas führt sie ebensowenig als eigenen Beruf.
 */
const STUFENWORT =
  /\b(senior|junior|lead|leitende[rn]?|erfahrene[rn]?|principal|staff|head\s+of|stellv\.?|stellvertretende[rn]?|trainee|assistenz\s+der)\b/g;

/**
 * Aus einem Titel mehrere Suchanfragen, von genau nach allgemein.
 *
 * ── Warum es Stufen braucht ───────────────────────────────────
 *
 * Gemessen an den ersten zwölf Titeln: die Hälfte fand keine
 * Zuordnung, und zwar nicht wegen der Entscheidungsregel, sondern
 * wegen der Anfrage. „vertriebscontroller im bankenumfeld" liefert
 * zwei Treffer, „vertriebscontroller" liefert genug.
 * „finanzbuchhalter - memmingen" liefert fünf, weil der Ort mitgesucht
 * wird.
 *
 * Die Reihenfolge ist wichtig: genau zuerst. Wer sofort das
 * allgemeinste Wort nimmt, ordnet „IT-Systemadministrator" unter
 * „Fachkraft" ein.
 *
 * Der letzte Schritt — die ersten beiden Wörter — ist bewusst die
 * unterste Stufe. Weiter zu kürzen führte zu „Ingenieur" für alles,
 * was mit Ingenieur beginnt, und das ist kein Beruf, sondern eine
 * Familie.
 */
export function abfragestufen(titel: string): string[] {
  const kern = titelNormalisieren(titel);
  const stufen: string[] = [kern];

  // Ort- oder Zusatzanhängsel nach einem Bindestrich mit Leerzeichen.
  const ohneAnhang = kern.replace(/\s+-\s+.*$/, "").trim();
  if (ohneAnhang !== kern && ohneAnhang.length >= 3) stufen.push(ohneAnhang);

  // Präpositionale Zusätze: „… im Bankenumfeld", „… für den Aussendienst".
  const ohneZusatz = stufen[stufen.length - 1]!
    .replace(/\s+\b(im|in|für|fuer|mit|bei|am|an|zur|zum|der|des)\b\s+.*$/, "")
    .trim();
  if (!stufen.includes(ohneZusatz) && ohneZusatz.length >= 3) stufen.push(ohneZusatz);

  // Stufenwörter weg.
  const ohneStufe = stufen[stufen.length - 1]!.replace(STUFENWORT, " ").replace(/\s+/g, " ").trim();
  if (!stufen.includes(ohneStufe) && ohneStufe.length >= 3) stufen.push(ohneStufe);

  // Die ersten beiden Wörter — die unterste Stufe.
  const worte = ohneStufe.split(" ").filter(Boolean);
  if (worte.length > 2) {
    const kurz = worte.slice(0, 2).join(" ");
    if (!stufen.includes(kurz) && kurz.length >= 3) stufen.push(kurz);
  }

  return stufen;
}


/** Was von einer Anzeige gebraucht wird, um den Beruf zu bestimmen. */
export interface BerufsStelle {
  hauptberuf?: string;
}

/**
 * Aus Treffern die eine Bezeichnung — oder keine.
 *
 * Ausgelagert und exportiert, damit die Entscheidungsregel prüfbar ist,
 * ohne einen fremden Dienst zu befragen.
 */
export function haeufigsterBeruf(
  stellen: BerufsStelle[],
): { beruf: string | null; treffer: number; gesamt: number } {
  const zaehlung = new Map<string, number>();
  for (const s of stellen) {
    const b = s.hauptberuf?.trim();
    if (b) zaehlung.set(b, (zaehlung.get(b) ?? 0) + 1);
  }
  const gesamt = stellen.length;
  let beruf: string | null = null;
  let treffer = 0;
  for (const [b, n] of zaehlung) {
    if (n > treffer) {
      beruf = b;
      treffer = n;
    }
  }
  if (beruf === null || treffer < MIN_TREFFER || treffer / Math.max(1, gesamt) < MIN_ANTEIL) {
    return { beruf: null, treffer, gesamt };
  }
  return { beruf, treffer, gesamt };
}


/** Ab wann eine Entgelt-Referenz gezeigt wird. */
export const MIN_ANGABEN = 8;

/** Quartile zu einem amtlichen Beruf, in Euro je Jahr. */
export interface Entgeltreferenz {
  beruf: string;
  q1: number;
  median: number;
  q3: number;
  anzahl: number;
  quelle: "bundesagentur" | "entgeltatlas";
  stand: Date;
}
