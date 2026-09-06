import { berufsgruppe, verlaufFür, zahlAus, type BerufsgruppeKey } from "./visuals.ts";
import { fotosDerGruppe, fotosZuKldb } from "../fotos.ts";

/**
 * Ein Titelbild je Berufsgruppe — nicht je Stelle.
 *
 * Der Unterschied ist der ganze Punkt. Bei 994 Anzeigen wäre ein Bild
 * pro Stelle eine Rechnung pro Besucher und bei der nächsten
 * Einspielung wieder. Zehn Gruppen decken das Feld ab, und ein gutes
 * Bild je Gruppe ist bezahlbar und wiederverwendbar.
 *
 * Die Bilder sind eigene SVG-Kompositionen: fünfzehn Motive in EINER
 * Bildsprache — gleicher Horizont, gleiche Strichstärke, gleiche
 * Palette, je Gruppe ein eigener Gegenstand. Sie liegen als Dateien
 * unter `public/berufsbilder/` und entstehen aus
 * `scripts/illustrationen-bauen.mjs`.
 *
 * Vorher standen hier Formen mit 14 bis 24 Prozent Deckkraft —
 * überschneidende Kreise, versetzte Blöcke. In der Liste, wo das Bild
 * 48 Pixel hoch ist, war davon nichts zu erkennen: ein blasser Fleck,
 * bei jeder Gruppe ungefähr derselbe. Ein Bild, das man nicht
 * unterscheiden kann, ist Dekoration und keine Information.
 *
 * Kein Foto, keine Menschen, keine Räume: Ein Foto eines Großraumbüros
 * neben einer Anzeige liest sich als „so sieht es dort aus", und das
 * wissen wir nicht.
 *
 * Ohne erkennbare Gruppe bleibt der gerechnete Verlauf. Lieber eine
 * ehrliche Fläche als ein Motiv, das die falsche Arbeit zeigt.
 */

export interface Berufsbild {
  /** Das Zeichen der Gruppe als Datei. Kein Layoutsprung. */
  bild: string;
  /** Was zu sehen ist — für Vorlesegeräte und als Kennzeichnung. */
  altText: string;
  gruppe: BerufsgruppeKey | null;
  /**
   * Das Foto zum Berufsfeld, wo es eines gibt.
   *
   * ── Warum es das jetzt gibt ───────────────────────────────
   *
   * Bis hierher zeigte jede Stelle ein abstraktes Zeichen. Die
   * Begründung stand in `JobBild.tsx` und gilt weiter: Ein Foto neben
   * einer Anzeige liest sich als „so sieht es dort aus".
   *
   * Dagegen steht, dass eine Liste aus fünfzehn wiederkehrenden
   * Piktogrammen keinen Charakter hat. Beides lässt sich haben: Das
   * Foto zeigt das FELD, und das Etikett auf dem Bild sagt
   * „Symbolbild" statt „Illustration". Wer es sieht, liest, dass es
   * kein Bild dieses Arbeitgebers ist.
   *
   * `null`, wenn die Gruppe unbekannt ist oder für sie kein Motiv
   * vorliegt — dann bleibt es beim Zeichen und beim Verlauf. Ein
   * beliebiges Foto wäre genau die Behauptung, die wir vermeiden.
   */
  foto: { gross: string; klein: string; alt: string } | null;
}

/*
 * Je Gruppe zwei Töne und ein Motiv.
 *
 * Die Töne bleiben im Markenfenster (Eis bis Violett), damit die Liste
 * ruhig bleibt. Grün und Rot bedeuten im Produkt etwas — bestätigt,
 * Konflikt — und dürfen nicht dekorativ auftreten.
 */
/*
 * Was auf dem jeweiligen Bild zu sehen ist.
 *
 * Diese Texte MÜSSEN mit den Motiven in
 * `scripts/illustrationen-bauen.mjs` übereinstimmen. Sie beschrieben
 * einmal die Vorgängerfassung — überschneidende Kreise, versetzte
 * Blöcke — und blieben stehen, als die Motive ersetzt wurden. Ein
 * Vorlesegerät schilderte danach ein Bild, das es nicht mehr gab; das
 * ist schlimmer als gar kein Alternativtext, weil es niemandem
 * auffällt, der sehen kann.
 *
 * Jeder Text nennt zuerst, dass es eine Illustration ist. Das Bild
 * zeigt eine Berufsgruppe und nicht diesen Arbeitgeber.
 */
const ALT: Record<BerufsgruppeKey, string> = {
  customer_success: "Illustration: zwei Sprechblasen als Sinnbild für Kundenkontakt",
  software_data: "Illustration: ein Codefenster als Sinnbild für Softwarearbeit",
  data_bi: "Illustration: ein Balkendiagramm mit Verlaufslinie als Sinnbild für Datenauswertung",
  finance: "Illustration: gestapelte Münzen neben einem Beleg als Sinnbild für Finanzarbeit",
  healthcare: "Illustration: ein Kreuz mit Pulslinie als Sinnbild für Pflege und Gesundheit",
  education: "Illustration: ein aufgeschlagenes Buch und ein Absolventenhut als Sinnbild für Bildung",
  skilled_trades: "Illustration: ein Schutzhelm und ein Hammer als Sinnbild für handwerkliche Arbeit",
  operations: "Illustration: ineinandergreifende Zahnräder als Sinnbild für Produktion und Prozesse",
  logistics: "Illustration: gestapelte Kisten als Sinnbild für Logistik und Lager",
  sales: "Illustration: eine steigende Kurve und ein Preisschild als Sinnbild für Vertrieb",
  design: "Illustration: eine Malpalette und ein Stift als Sinnbild für Gestaltung",
  administration: "Illustration: eine Aktenmappe als Sinnbild für Verwaltung",
  hr: "Illustration: zwei Ausweiskarten als Sinnbild für Personalarbeit",
  marketing: "Illustration: ein Megafon mit Schallwellen als Sinnbild für Marketing",
  research: "Illustration: ein Erlenmeyerkolben als Sinnbild für Forschung und Labor",
};

export function berufsbild(job: {
  id: string;
  title: string;
  coreTasks?: string[];
  /**
   * Die amtliche Berufskennung, wo sie an der Stelle steht.
   *
   * Sie geht dem aus dem Titel geratenen Feld vor — sie ist die
   * Auskunft der Bundesagentur, das Feld ist unsere Vermutung aus
   * einer Zeichenkette.
   */
  kldb?: string | null;
}): Berufsbild {
  /*
   * Die amtliche Kennung entscheidet auch über die GRUPPE.
   *
   * ── Was hier falsch war ───────────────────────────────────
   *
   * Die Gruppe kam allein aus dem Titel; die Kennung wurde erst
   * dreissig Zeilen später herangezogen, und nur für die Auswahl des
   * Fotos. Ergebnis: Bei einem Lieferfahrer, dessen Titel auf ein
   * falsches Feld passte, stand das Motiv dieses falschen Feldes
   * daneben — und in einem Fall das Bild eines Softwareentwicklers.
   *
   * Der Kommentar weiter unten behauptete bereits „Erst die Kennung,
   * dann das Feld". Gemacht hat es der Code nicht.
   *
   * Jetzt zuerst: Wo eine Kennung an der Stelle steht, kommen Gruppe
   * UND Motiv aus derselben Quelle. Der Titel ist der Rückfall.
   */
  const ausKldb = fotosZuKldb(job.kldb);
  const gruppe = ausKldb[0]?.gruppe ?? berufsgruppe(job.title, job.coreTasks ?? []);
  if (!gruppe) {
    return {
      bild: "",
      altText: "Farbfläche als Platzhalter",
      gruppe: null,
      foto: null,
    };
  }
  /*
   * Eine Datei statt eines data-URI.
   *
   * Vorher wanderte das SVG in die HTML-Antwort. Bei 25 Stellen je
   * Seite waren das 25 Kopien von im Schnitt anderthalb Kilobyte,
   * obwohl sich die Motive über die Liste hinweg wiederholen — acht
   * verschiedene Gruppen auf 25 Anzeigen sind normal.
   *
   * Als Datei lädt der Browser jedes Motiv einmal und nimmt es danach
   * aus dem Zwischenspeicher, auch über Seitenwechsel hinweg. Das HTML
   * bleibt klein, und die Bilder liegen an einer Stelle, an der man sie
   * ansehen kann, ohne den Code zu lesen.
   */
  /*
   * Gestreut über die Stellenkennung, nicht über die Gruppe.
   *
   * Sonst zeigten die 5.521 Handwerksstellen einer Stichprobe alle
   * dasselbe Foto. Über die Kennung verteilen sich die Motive einer
   * Gruppe, und dieselbe Stelle behält ihres — auch nach dem Neuladen
   * und im zweiten Server-Rendering.
   */
  /*
   * Erst die Kennung, dann das Feld.
   *
   * Die fünfzehn Felder sind grob: „Gesundheit und Pflege" enthält
   * Pflegekraft, Zahnärztin, Rettungssanitäter, Tierärztin und
   * Physiotherapeutin. Eine Pflegestelle bekam so ein Bild vom
   * Rettungswagen — richtig im Feld, falsch im Beruf.
   *
   * Die KldB trennt feiner. Wo sie an der Stelle steht, entscheidet
   * sie; wo nicht, bleibt es beim Feld. Kein Rückschritt, nur eine
   * genauere Stufe davor.
   */
  const motive = ausKldb.length > 0 ? ausKldb : fotosDerGruppe(gruppe);
  const gewaehlt = motive.length > 0 ? motive[zahlAus(job.id) % motive.length]! : null;

  return {
    bild: `/berufsbilder/${gruppe}.svg`,
    altText: ALT[gruppe],
    gruppe,
    foto: gewaehlt ? { gross: gewaehlt.pfad, klein: gewaehlt.klein, alt: gewaehlt.alt } : null,
  };
}

/** Der Verlauf für Stellen ohne erkennbare Gruppe. */
export { verlaufFür };
