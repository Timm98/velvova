/**
 * Eine Stelle, mehrere Quellen.
 *
 * Dieselbe offene Stelle steht oft auf drei Portalen. Für die Person ist
 * es eine Stelle — sie will sie einmal sehen, nicht dreimal, und sie
 * will wissen, wo sie sich bewerben kann.
 *
 * Der Abgleich läuft über einen Schlüssel aus Titel, Unternehmen und
 * Ort. Bewusst nicht über den Volltext: dieselbe Anzeige wird von
 * verschiedenen Portalen unterschiedlich gekürzt, mit anderen
 * Standardsätzen versehen und anders formatiert. Ein Hash über den Text
 * findet solche Dubletten nie.
 *
 * Die Normalisierung ist grob, und das ist Absicht. Zwei Fehler sind
 * möglich, und sie sind nicht gleich schlimm:
 *
 *   Zusammenwerfen, was getrennt gehört — die Person sieht eine echte
 *   Möglichkeit nie. Der Schaden ist unsichtbar und dauerhaft.
 *
 *   Trennen, was zusammengehört — die Liste ist etwas länger. Ärgerlich,
 *   aber sichtbar und reparierbar.
 *
 * Deshalb im Zweifel trennen. Der Schlüssel verlangt Übereinstimmung in
 * allen drei Teilen; ein abweichender Ort reicht, um zwei Anzeigen
 * getrennt zu halten.
 */

/** Rechtsformen und Zusätze, die zwischen Portalen variieren. */
const RECHTSFORMEN =
  /\b(gmbh|mbh|ag|kg|ohg|gbr|se|ug|e\.?\s?v|e\.?\s?k|co\.?\s?kg|inc|ltd|llc|plc|corp|sa|nv|bv|aps|ab|oy)\b/g;

/**
 * Was Portale an einen Stellentitel anhängen.
 *
 * Die erste Fassung hat m/w/d, w/m/d und d/m/w einzeln aufgezählt. Der
 * erste Lauf gegen echte Daten brachte sofort "(f/m/d)" — englische
 * Schreibweise, in derselben Anzeige. Aufzählen ist hier die falsche
 * Form: es gibt zu viele Varianten, und jede fehlende erzeugt eine
 * Dublette. Deshalb ein Muster über die Buchstaben selbst.
 */
const TITEL_ZUSAETZE =
  /\s*[\(\[]?\s*\b([mwfdxgn]\s*[\/|·]\s*[mwfdxgn](\s*[\/|·]\s*[mwfdxgn])?|all\s*genders?|divers|gn)\b\s*[\)\]]?/gi;

/** Beschäftigungsumfang gehört nicht in die Identität der Stelle. */
const UMFANG =
  /\b(vollzeit|teilzeit|full[\s-]?time|part[\s-]?time|festanstellung|unbefristet|befristet|remote|homeoffice|hybrid)\b/gi;

function grundform(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äàáâ]/g, "a")
    .replace(/[öòóô]/g, "o")
    .replace(/[üùúû]/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[éèêë]/g, "e")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normaliseTitle(title: string): string {
  return grundform(title.replace(TITEL_ZUSAETZE, " ").replace(UMFANG, " "));
}

export function normaliseCompany(name: string): string {
  return grundform(name).replace(RECHTSFORMEN, " ").replace(/\s+/g, " ").trim();
}

/**
 * Nur die Stadt. Ein Portal schreibt "Hamburg", das nächste
 * "Hamburg, Deutschland", das dritte "22765 Hamburg-Altona".
 */
export function normaliseLocation(location: string): string {
  const ersterTeil = location.split(/[,|·•]/)[0] ?? location;
  return grundform(ersterTeil)
    .replace(/\b\d{4,5}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Der Schlüssel, unter dem zwei Anzeigen dieselbe Stelle sind.
 *
 * Leere Bestandteile machen den Schlüssel ungültig: ohne Unternehmen
 * oder ohne Ort ist keine verlässliche Aussage möglich, und dann wird
 * nicht zusammengefasst.
 */
export function canonicalKey(listing: {
  title: string;
  companyName: string;
  location: string;
}): string | null {
  const titel = normaliseTitle(listing.title);
  const firma = normaliseCompany(listing.companyName);
  const ort = normaliseLocation(listing.location);

  if (!titel || !firma || !ort) return null;
  return `${titel}|${firma}|${ort}`;
}

export function isSameJob(
  a: { title: string; companyName: string; location: string },
  b: { title: string; companyName: string; location: string },
): boolean {
  const ka = canonicalKey(a);
  const kb = canonicalKey(b);
  // Zwei ungültige Schlüssel sind nicht dasselbe, sondern zweimal
  // unbekannt. Sie gleichzusetzen wäre der teure Fehler.
  return ka !== null && ka === kb;
}
