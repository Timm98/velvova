/**
 * Was aus einem Dokument über einen Menschen folgt — und was nicht.
 *
 * Aus einem Lebenslauf lässt sich viel herauslesen, und genau darin
 * liegt die Gefahr. Ein Sprachmodell, das frei formulieren darf, erfindet
 * bei dünner Vorlage Stationen, Titel und Zeiträume, die plausibel
 * klingen. In einem Karriereprofil ist das kein Schönheitsfehler,
 * sondern eine Fälschung über eine reale Person — die sie später in
 * einem Vorstellungsgespräch verteidigen müsste.
 *
 * Deshalb wird hier NICHT formuliert, sondern GEFUNDEN. Jede Behauptung
 * ist ein Fund im Text, mit Anfang, Ende und Zitat. Was nicht wörtlich
 * dasteht, entsteht nicht.
 *
 * Das Ergebnis ist bescheidener als eine Modellausgabe und hat eine
 * Eigenschaft, die eine Modellausgabe nicht hat: die Person kann jede
 * Zeile im eigenen Dokument nachschlagen. Und keine davon zählt, bevor
 * sie bestätigt ist.
 *
 * Ein Sprachmodell kann später dazukommen — als zweiter Schritt, der
 * die gefundenen Stellen ORDNET und benennt, nicht als erster, der sie
 * erzeugt.
 */

export interface Behauptung {
  /** skill | role | employer | period | qualification | tool */
  art: string;
  aussage: string;
  von: number;
  bis: number;
  zitat: string;
  sicherheit: number;
}

/*
 * Muster, die im Deutschen wie im Englischen tragen.
 *
 * Bewusst wenige und bewusst spezifisch. Ein grosszügiges Muster findet
 * überall etwas — und ein Fund, der überall auftritt, sagt nichts.
 */
const MUSTER: { art: string; re: RegExp; sicherheit: number; benenne: (m: RegExpExecArray) => string }[] = [
  {
    // „2019 – 2022", „03/2019 bis heute", „2019-2022"
    art: "period",
    re: /\b((?:0?[1-9]|1[0-2])[./])?((?:19|20)\d{2})\s*(?:[–—-]|bis|to)\s*((?:0?[1-9]|1[0-2])[./])?((?:19|20)\d{2}|heute|present|jetzt)\b/gi,
    sicherheit: 0.75,
    benenne: (m) => `Zeitraum ${m[0].replace(/\s+/g, " ").trim()}`,
  },
  {
    // „Müller GmbH", „Beispiel AG", „Firma & Co. KG"
    art: "employer",
    re: /\b([A-ZÄÖÜ][\wÄÖÜäöüß&.\-]*(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß&.\-]*){0,3})\s+(GmbH|AG|SE|KG|OHG|mbH|e\.?V\.?|Ltd\.?|Inc\.?|BV|NV)\b/g,
    sicherheit: 0.7,
    benenne: (m) => `Arbeitgeber ${m[1]!.trim()} ${m[2]}`,
  },
  {
    // Formale Abschlüsse — die einzige Sorte Qualifikation, die im Text
    // zuverlässig als solche erkennbar ist.
    art: "qualification",
    re: /\b(Bachelor|Master|Diplom|Magister|Promotion|Doktor|Ausbildung zum?r?|Ausbildung als|Fachwirt|Meister|Techniker|Staatlich geprüfte?r?)\b[^.\n]{0,60}/gi,
    sicherheit: 0.65,
    benenne: (m) => `Abschluss: ${m[0].trim()}`,
  },
  {
    // Führerscheine und Berechtigungen. Steht fast immer wörtlich da.
    art: "qualification",
    re: /\b(Führerschein(?:\s+Klasse)?\s+[A-Z]{1,2}\d?|Staplerschein|Gabelstaplerschein|Sachkundenachweis)\b/gi,
    sicherheit: 0.85,
    benenne: (m) => m[0].trim(),
  },
  {
    // Sprachniveaus nach GER. Eindeutig, weil normiert.
    art: "skill",
    re: /\b(Deutsch|Englisch|Französisch|Spanisch|Italienisch|Türkisch|Polnisch|Russisch|German|English)\s*[:(-]?\s*(A1|A2|B1|B2|C1|C2|Muttersprache|verhandlungssicher|fliessend|fließend)\b/gi,
    sicherheit: 0.85,
    benenne: (m) => `${m[1]} ${m[2]}`,
  },
];

/*
 * Werkzeuge, die in Anzeigen und Lebensläufen namentlich stehen.
 *
 * Eine geschlossene Liste und keine Worterkennung: „Excel" ist ein
 * Werkzeug, „Tabelle" nicht, und der Unterschied lässt sich nicht
 * erraten. Was fehlt, fehlt — und ist besser als ein erfundenes
 * Werkzeug im Profil einer Person.
 */
const WERKZEUGE = [
  "Excel", "Word", "PowerPoint", "Outlook", "SAP", "DATEV", "Salesforce", "HubSpot",
  "Jira", "Confluence", "Trello", "Asana", "Slack", "Teams", "Notion",
  "Photoshop", "Illustrator", "InDesign", "Figma", "Sketch", "Canva",
  "Python", "JavaScript", "TypeScript", "Java", "SQL", "R", "Tableau", "Power BI",
  "AutoCAD", "SolidWorks", "Zendesk", "Shopify", "WordPress", "Google Analytics",
];

const MAX_BEHAUPTUNGEN = 40;

export function behauptungenAusText(text: string): Behauptung[] {
  const gefunden: Behauptung[] = [];
  const gesehen = new Set<string>();

  const merke = (b: Behauptung) => {
    const schluessel = `${b.art}|${b.aussage.toLowerCase()}`;
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    gefunden.push(b);
  };

  for (const m of MUSTER) {
    // `lastIndex` zurücksetzen: dieselben Ausdrücke werden für mehrere
    // Dokumente benutzt, und ein globaler Ausdruck merkt sich, wo er
    // beim letzten Mal stand.
    m.re.lastIndex = 0;
    let treffer: RegExpExecArray | null;
    while ((treffer = m.re.exec(text)) !== null) {
      if (gefunden.length >= MAX_BEHAUPTUNGEN) break;
      merke({
        art: m.art,
        aussage: m.benenne(treffer).slice(0, 200),
        von: treffer.index,
        bis: treffer.index + treffer[0].length,
        zitat: zitat(text, treffer.index, treffer[0].length),
        sicherheit: m.sicherheit,
      });
    }
  }

  for (const w of WERKZEUGE) {
    if (gefunden.length >= MAX_BEHAUPTUNGEN) break;
    // Wortgrenzen: „R" darf nicht in „Reklamation" treffen.
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");
    const i = text.search(re);
    if (i < 0) continue;
    merke({
      art: "tool",
      aussage: w,
      von: i,
      bis: i + w.length,
      zitat: zitat(text, i, w.length),
      sicherheit: 0.8,
    });
  }

  return gefunden.sort((a, b) => a.von - b.von).slice(0, MAX_BEHAUPTUNGEN);
}

/**
 * Der Satz drumherum.
 *
 * Ohne Zusammenhang ist ein Fund nicht prüfbar: „Excel" allein sagt
 * nicht, ob dort „Excel sicher" oder „keine Excel-Kenntnisse" steht.
 * Etwa achtzig Zeichen davor und danach genügen fast immer für den
 * Satz.
 */
function zitat(text: string, von: number, laenge: number): string {
  const a = Math.max(0, von - 80);
  const b = Math.min(text.length, von + laenge + 80);
  const roh = text.slice(a, b).replace(/\s+/g, " ").trim();
  return (a > 0 ? "… " : "") + roh + (b < text.length ? " …" : "");
}
