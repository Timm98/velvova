/**
 * Orte als zweite Suchachse.
 *
 * ── Das Problem, das sie löst ─────────────────────────────────
 *
 * Die Jobbörse gibt je Suchbegriff höchstens 10.000 Anzeigen heraus —
 * hundert Seiten à hundert, danach antwortet sie mit 400. Für die
 * meisten Berufe reicht das bei weitem. Für die grossen nicht:
 * „Elektroniker" hat 42.889 Anzeigen, „Pflegefachkraft" ähnlich viele.
 * Drei Viertel davon waren unerreichbar.
 *
 * Mit einem Ort beginnt die Zählung von vorn. Gemessen für
 * „Elektroniker" im Umkreis von 50 km:
 *
 *   Berlin 2.156 · Hamburg 2.088 · München 1.565 · Köln 2.507 ·
 *   Frankfurt 2.220 · Stuttgart 1.767 · Leipzig 1.221 · Dresden 1.172
 *
 * Jede Zahl weit unter der Grenze — der Beruf wird vollständig
 * erreichbar.
 *
 * ── Warum Städte und nicht Postleitzahlen ─────────────────────
 *
 * Ein Umkreis um eine Stadt trifft dort, wo Stellen sind. Ein Raster
 * über Postleitzahlen wäre gleichmässiger und würde die Hälfte der
 * Anfragen auf Gegenden verwenden, in denen es kaum Arbeitgeber gibt.
 *
 * ── Warum sich die Umkreise überlappen dürfen ─────────────────
 *
 * Fünfzig Kilometer um Köln und um Düsseldorf überschneiden sich
 * stark. Das kostet Anfragen und bringt Dubletten — beides ist
 * billiger als eine Lücke: Eine doppelt geholte Anzeige erkennt der
 * Import und führt sie zusammen. Eine nie geholte fehlt für immer.
 */
export const ORTE_DE = [
  "Berlin",
  "Hamburg",
  "München",
  "Köln",
  "Frankfurt am Main",
  "Stuttgart",
  "Düsseldorf",
  "Leipzig",
  "Dortmund",
  "Essen",
  "Bremen",
  "Dresden",
  "Hannover",
  "Nürnberg",
  "Duisburg",
  "Bochum",
  "Wuppertal",
  "Bielefeld",
  "Bonn",
  "Münster",
  "Karlsruhe",
  "Mannheim",
  "Augsburg",
  "Wiesbaden",
  "Mönchengladbach",
  "Gelsenkirchen",
  "Braunschweig",
  "Kiel",
  "Chemnitz",
  "Aachen",
  "Halle (Saale)",
  "Magdeburg",
  "Freiburg im Breisgau",
  "Krefeld",
  "Mainz",
  "Lübeck",
  "Erfurt",
  "Rostock",
  "Kassel",
  "Saarbrücken",
  "Osnabrück",
  "Oldenburg",
  "Heidelberg",
  "Potsdam",
  "Würzburg",
  "Regensburg",
  "Ingolstadt",
  "Ulm",
  "Koblenz",
  "Trier",
  "Jena",
  "Siegen",
  "Passau",
  "Flensburg",
  "Görlitz",
  "Konstanz",
] as const;

/**
 * Ab wann sich die Ortsachse lohnt.
 *
 * Unter dieser Zahl ist ein Beruf mit einer einzigen Suche vollständig
 * erreichbar. Ihn trotzdem nach Orten aufzuteilen wäre sechsundfünfzig
 * Mal dieselbe Frage für dasselbe Ergebnis.
 *
 * Achttausend statt zehntausend, weil die Zahl der Jobbörse schwankt:
 * Ein Beruf mit 9.500 Anzeigen kann morgen 10.400 haben, und dann
 * fehlten die letzten vierhundert unbemerkt.
 */
export const ORTSACHSE_AB = 8000;
