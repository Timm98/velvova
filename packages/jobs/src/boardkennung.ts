/**
 * Aus einem Firmennamen eine Board-Kennung raten.
 *
 * ── Warum geraten werden muss ─────────────────────────────────
 *
 * Greenhouse, Ashby, SmartRecruiters und Personio führen je
 * Arbeitgeber ein offenes Stellenverzeichnis — abrufbar ohne
 * Schlüssel, mit Volltext und oft mit Gehalt. Ein Verzeichnis der
 * Kennungen gibt es nicht: Wer `stripe` nicht kennt, findet Stripes
 * Board nicht.
 *
 * Die Kennung ist fast immer der Firmenname ohne Rechtsform und
 * Sonderzeichen. „gocomo GmbH" wird zu `gocomo`, „WOHN-UNION GmbH" zu
 * `wohn-union` — beide gemessen und getroffen.
 *
 * ── Warum mehrere Varianten ───────────────────────────────────
 *
 * „Muster Technik GmbH" kann `muster-technik`, `mustertechnik` oder
 * `muster` heissen. Eine Variante zu raten trifft in 4 % der Fälle;
 * drei zu probieren kostet dreimal so viele Anfragen und trifft
 * spürbar öfter. Die Reihenfolge geht von der wahrscheinlichsten zur
 * unwahrscheinlichsten.
 */

/** Rechtsformen und Füllwörter, die nie Teil einer Kennung sind. */
const RECHTSFORM =
  /\b(gmbh|mbh|ag|kg|ohg|se|ug|kgaa|gbr|ev|e\s?v|co|und|the|group|holding|deutschland|germany|international|haftungsbeschränkt|inh)\b/g;

function grundform(name: string): string {
  return name
    .toLowerCase()
    .replace(/[&+]/g, " ")
    .replace(/[.,]/g, " ")
    .replace(RECHTSFORM, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Die Kennungen zu einem Firmennamen, von wahrscheinlich zu weniger.
 *
 * Höchstens drei — jede weitere ist eine Anfrage mehr bei einem
 * fremden Dienst für eine immer unwahrscheinlichere Vermutung.
 */
export function boardkennungen(firma: string): string[] {
  const worte = grundform(firma).split(" ").filter(Boolean);
  if (worte.length === 0) return [];

  const raus: string[] = [];
  const nimm = (k: string) => {
    if (k.length >= 3 && k.length <= 50 && !raus.includes(k)) raus.push(k);
  };

  // Alle Wörter mit Bindestrich — die häufigste Form.
  nimm(worte.join("-"));
  // Alle Wörter zusammengeschrieben.
  if (worte.length > 1) nimm(worte.join(""));
  // Nur das erste Wort — trifft bei Firmen mit beschreibendem Zusatz.
  if (worte.length > 1) nimm(worte[0]!);

  return raus.slice(0, 3);
}
