import type { Angabe } from "./bewertung";

/**
 * Aus einer freien Antwort strukturierte Angaben lesen — mit Regeln.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Regeln und nicht sofort ein Sprachmodell
 * ══════════════════════════════════════════════════════════════
 *
 * Dieselbe Entscheidung wie in `packages/ai/dimensionslesen.ts`, und
 * aus demselben Grund: Ein Modell liefert für jede Antwort Werte —
 * auch für „weiss nicht". Diese Werte sind nicht wiederholbar, nicht
 * prüfbar und stünden anschliessend als Aussage über ein Unternehmen
 * in dessen öffentlichem Profil.
 *
 * Die Regeln hier sagen in vielen Fällen nichts. Das ist die
 * gewünschte Eigenschaft: Was sie nicht sicher lesen, bleibt offen und
 * geht an die zweite Stufe — das Modell in `deutung.ts`, dessen Funde
 * als „abgeleitet" mit niedrigerer Konfidenz markiert werden.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Regeln zuerst laufen
 * ══════════════════════════════════════════════════════════════
 *
 * „65.000 bis 80.000 Euro" ist eine Gehaltsspanne, und zwar
 * zweifelsfrei. Ein Modell könnte daraus 65.000 bis 80.000 machen oder
 * 65 bis 80 oder „im mittleren Bereich" — meistens richtig, manchmal
 * nicht, und der Unterschied fällt niemandem auf.
 *
 * Was sich mit einer Regel lesen lässt, wird mit einer Regel gelesen.
 * Das Modell bekommt den Rest.
 */

/**
 * Ein Fund trägt seine Belegstelle mit.
 *
 * Der Typ kommt aus `bewertung.ts` und nicht aus `angaben.ts`: Letzteres
 * zieht `server-only` mit und wäre in Tests und in der Vorschau nicht
 * ladbar. Derselbe Schnitt wie bei `mail/bereitschaft.ts`.
 */
export type Fund = Omit<Angabe, "quelleDetail"> & { belegstelle: string };

/* ── Bausteine ────────────────────────────────────────────────── */

/**
 * Eine deutsche Zahl.
 *
 * `65.000` ist fünfundsechzigtausend, nicht 65 Komma null null null.
 * Der Punkt ist hier Tausendertrenner — die englische Lesart wäre um
 * den Faktor tausend daneben, und zwar bei jeder Gehaltsangabe.
 */
function zahl(roh: string): number | null {
  const sauber = roh.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(sauber);
  return Number.isFinite(n) ? n : null;
}

/** Die Umgebung eines Treffers — als Beleg, nicht als Zierde. */
function umfeld(text: string, index: number, laenge: number): string {
  const von = Math.max(0, index - 40);
  const bis = Math.min(text.length, index + laenge + 40);
  return (von > 0 ? "…" : "") + text.slice(von, bis).trim() + (bis < text.length ? "…" : "");
}

/* ── Die Regeln ───────────────────────────────────────────────── */

/**
 * Wörter, die eine Anforderung zur Pflicht machen — oder eben nicht.
 *
 * Das ist die wichtigste Unterscheidung im ganzen Leser. „Excel und
 * möglichst SAP" heisst: Excel ist Pflicht, SAP nicht. Wer beides in
 * dieselbe Liste schreibt, macht aus einer Wunschangabe einen
 * Ausschlussgrund — und genau daran scheitern später Menschen, die die
 * Arbeit könnten.
 */
const WUNSCHWORT = /\b(möglichst|idealerweise|wünschenswert|von vorteil|gerne|optimalerweise|nice to have|plus)\b/i;
const MUSSWORT = /\b(muss|müssen|zwingend|unbedingt|voraussetzung|erforderlich|zwingende|setzen voraus)\b/i;

/**
 * Fähigkeiten und Werkzeuge, die sich zuverlässig erkennen lassen.
 *
 * Bewusst eine Liste und keine allgemeine Erkennung: „Er sollte
 * belastbar sein" ist keine Fähigkeit, die sich prüfen lässt, und
 * würde als solche in die Muss-Liste wandern. Was hier nicht steht,
 * liest das Modell — und wird als abgeleitet markiert.
 */
const WERKZEUGE = [
  "Excel", "SAP", "DATEV", "Power BI", "Tableau", "Salesforce", "HubSpot", "Jira", "Confluence",
  "Photoshop", "Figma", "AutoCAD", "SolidWorks", "MATLAB", "Python", "SQL", "Java", "JavaScript",
  "TypeScript", "React", "Kubernetes", "Docker", "AWS", "Azure", "Lexware", "Navision",
  "Dynamics", "Oracle", "S/4HANA", "SharePoint", "Salesforce",
];

/** Die grösseren Städte im deutschsprachigen Raum. */
const ORTE = [
  "Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig",
  "Dortmund", "Essen", "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg", "Bochum",
  "Wuppertal", "Bielefeld", "Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsburg", "Wiesbaden",
  "Mönchengladbach", "Gelsenkirchen", "Braunschweig", "Kiel", "Aachen", "Halle", "Magdeburg",
  "Freiburg", "Krefeld", "Lübeck", "Mainz", "Erfurt", "Rostock", "Kassel", "Potsdam", "Saarbrücken",
  "Ulm", "Heidelberg", "Regensburg", "Würzburg", "Ingolstadt", "Wien", "Graz", "Linz", "Salzburg",
  "Zürich", "Genf", "Basel", "Bern", "Lausanne",
];

/**
 * Ausgeschriebene Zahlen.
 *
 * „zwei Tage zu Hause" und „drei Jahre Erfahrung" sind der Normalfall
 * im gesprochenen Satz — wer nur auf Ziffern prüft, liest die Hälfte
 * der Antworten nicht.
 */
const ZAHLWORT: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
};

/** Ziffer oder Zahlwort zu einer Zahl. */
function zahlOderWort(roh: string): number | null {
  return ZAHLWORT[roh.toLowerCase()] ?? zahl(roh);
}

const ZW = Object.keys(ZAHLWORT).join("|");

const BRANCHEN: { muster: RegExp; wert: string }[] = [
  { muster: /\bberatung|consulting|unternehmensberatung\b/i, wert: "Unternehmensberatung" },
  { muster: /\b(software|it-|informatik|saas|tech)\b/i, wert: "IT und Software" },
  { muster: /\b(produktion|fertigung|maschinenbau|industrie)\b/i, wert: "Industrie und Produktion" },
  { muster: /\b(handel|einzelhandel|grosshandel|großhandel|e-commerce)\b/i, wert: "Handel" },
  { muster: /\b(pflege|klinik|krankenhaus|gesundheit|arztpraxis)\b/i, wert: "Gesundheit und Pflege" },
  { muster: /\b(bank|versicherung|finanz)\b/i, wert: "Finanzen und Versicherung" },
  { muster: /\b(bau|handwerk|installation|sanitär|elektro)\b/i, wert: "Bau und Handwerk" },
  { muster: /\b(logistik|spedition|transport)\b/i, wert: "Logistik und Verkehr" },
  { muster: /\b(schule|hochschule|bildung|ausbildung)\b/i, wert: "Bildung" },
  { muster: /\b(gastronomie|hotel|restaurant)\b/i, wert: "Gastgewerbe" },
];

/**
 * Der Leser.
 *
 * Jeder Fund trägt seine Belegstelle: den Satzausschnitt, aus dem er
 * stammt. Ohne ihn wäre „Konfidenz 90" eine Zahl ohne Grundlage — und
 * bei einer Korrektur wüsste niemand, worauf sich der Wert bezog.
 */
export function lies(text: string): Fund[] {
  const funde: Fund[] = [];
  const gesehen = new Set<string>();

  /* Ein Feld nur einmal. Der erste Treffer gewinnt: Er steht früher im
     Satz und ist meist der gemeinte. */
  const merke = (f: Fund) => {
    const k = `${f.bereich}.${f.feld}`;
    if (gesehen.has(k)) return;
    gesehen.add(k);
    funde.push(f);
  };

  /* ── Gehaltsspanne ────────────────────────────────────────── */
  const gehalt = text.match(
    /(\d{2,3}(?:[.\s]\d{3})?)\s*(?:bis|-|–|und)\s*(\d{2,3}(?:[.\s]\d{3})?)\s*(?:€|eur|euro|tsd|k\b)/i,
  );
  if (gehalt) {
    const von = zahl(gehalt[1]!.replace(/\s/g, ""));
    const bis = zahl(gehalt[2]!.replace(/\s/g, ""));
    if (von && bis && bis >= von) {
      /* „65 bis 80" meint Tausender, wenn die Zahlen klein sind. Die
         Grenze bei 1000 ist die einzige Stelle, an der geraten wird —
         und ein Jahresgehalt von 65 Euro gibt es nicht. */
      const faktor = von < 1000 ? 1000 : 1;
      merke({
        bereich: "gehalt",
        feld: "spanne",
        wert: { von: von * faktor, bis: bis * faktor, waehrung: "EUR", zeitraum: "jahr" },
        quelle: "gespraech",
        status: "gefunden",
        konfidenz: 90,
        belegstelle: umfeld(text, gehalt.index!, gehalt[0].length),
      });
    }
  }

  /* ── Unternehmensgrösse ───────────────────────────────────── */
  const groesse = text.match(/(\d{1,6})\s*(?:mitarbeiter|mitarbeitende|beschäftigte|kolleg\w+|leute|personen)/i);
  if (groesse) {
    const n = zahl(groesse[1]!);
    if (n) {
      merke({
        bereich: "unternehmen",
        feld: "groesse",
        wert: n,
        quelle: "gespraech",
        status: "gefunden",
        konfidenz: 90,
        belegstelle: umfeld(text, groesse.index!, groesse[0].length),
      });
    }
  }

  /* ── Teamgrösse ───────────────────────────────────────────── */
  const team = text.match(/team\w*\s+(?:von|mit|aus)\s+(\d{1,3})|(\d{1,3})[-\s]?köpfiges?\s+team/i);
  if (team) {
    const n = zahl(team[1] ?? team[2] ?? "");
    if (n) {
      merke({
        bereich: "kultur",
        feld: "teamgroesse",
        wert: n,
        quelle: "gespraech",
        status: "gefunden",
        konfidenz: 85,
        belegstelle: umfeld(text, team.index!, team[0].length),
      });
    }
  }

  /* ── Berufserfahrung ──────────────────────────────────────── */
  const erfahrung = text.match(
    new RegExp(`(?:mindestens\\s+|min\\.\\s+|ab\\s+)?(\\d{1,2}|${ZW})\\s*jahr\\w*\\s*(?:berufs)?erfahrung`, "i"),
  );
  if (erfahrung) {
    const n = zahlOderWort(erfahrung[1]!);
    if (n) {
      merke({
        bereich: "muss",
        feld: "erfahrungsjahre",
        wert: n,
        quelle: "gespraech",
        status: "gefunden",
        konfidenz: 85,
        belegstelle: umfeld(text, erfahrung.index!, erfahrung[0].length),
      });
    }
  }

  /* ── Homeoffice und Arbeitsmodell ─────────────────────────── */
  const homeoffice = text.match(
    new RegExp(`(\\d|${ZW})\\s*tage?\\s*(?:pro\\s+woche\\s*)?(?:im\\s+)?(?:home\\s?office|zu\\s+hause|mobil|remote)`, "i"),
  );
  if (homeoffice) {
    const tage = zahlOderWort(homeoffice[1]!);
    if (tage !== null) {
      merke({
        bereich: "standort",
        feld: "bueroTage",
        /* Gefragt ist die Zahl der BÜROtage. Angegeben wurden
           Homeoffice-Tage — bei einer Fünftagewoche ist das die
           Differenz. Die Annahme steht in der Belegstelle. */
        wert: Math.max(0, 5 - tage),
        quelle: "gespraech",
        status: "gefunden",
        konfidenz: 70,
        belegstelle: umfeld(text, homeoffice.index!, homeoffice[0].length),
      });
      merke({
        bereich: "standort",
        feld: "modell",
        wert: tage >= 5 ? "remote" : tage > 0 ? "hybrid" : "on_site",
        quelle: "gespraech",
        status: "gefunden",
        konfidenz: 85,
        belegstelle: umfeld(text, homeoffice.index!, homeoffice[0].length),
      });
    }
  } else if (/\bvollständig\s+remote|komplett\s+remote|100\s*%\s*remote\b/i.test(text)) {
    const i = text.search(/\bvollständig\s+remote|komplett\s+remote|100\s*%\s*remote\b/i);
    merke({ bereich: "standort", feld: "modell", wert: "remote", quelle: "gespraech", status: "gefunden", konfidenz: 90, belegstelle: umfeld(text, i, 20) });
  } else if (/\bhybrid\b/i.test(text)) {
    const i = text.search(/\bhybrid\b/i);
    merke({ bereich: "standort", feld: "modell", wert: "hybrid", quelle: "gespraech", status: "gefunden", konfidenz: 85, belegstelle: umfeld(text, i, 10) });
  } else if (/\bvor\s+ort\b|\bpräsenz\b/i.test(text)) {
    const i = text.search(/\bvor\s+ort\b|\bpräsenz\b/i);
    merke({ bereich: "standort", feld: "modell", wert: "on_site", quelle: "gespraech", status: "gefunden", konfidenz: 80, belegstelle: umfeld(text, i, 10) });
  }

  /* ── Wochenstunden ────────────────────────────────────────── */
  const stunden = text.match(/(\d{2})\s*(?:wochen)?stunden|(\d{2})\s*h\s*\/\s*woche/i);
  if (stunden) {
    const n = zahl(stunden[1] ?? stunden[2] ?? "");
    if (n && n >= 10 && n <= 60) {
      merke({
        bereich: "bedingungen",
        feld: "wochenstunden",
        wert: n,
        quelle: "gespraech",
        status: "gefunden",
        konfidenz: 90,
        belegstelle: umfeld(text, stunden.index!, stunden[0].length),
      });
    }
  }

  /* ── Ort ──────────────────────────────────────────────────── */
  for (const ort of ORTE) {
    const i = text.search(new RegExp(`\\b${ort}\\b`));
    if (i < 0) continue;
    merke({
      bereich: "unternehmen",
      feld: "hauptsitz",
      wert: ort,
      quelle: "gespraech",
      status: "gefunden",
      konfidenz: 85,
      belegstelle: umfeld(text, i, ort.length),
    });
    merke({
      bereich: "standort",
      feld: "ort",
      wert: ort,
      quelle: "gespraech",
      status: "gefunden",
      konfidenz: 80,
      belegstelle: umfeld(text, i, ort.length),
    });
    break;
  }

  /* ── Branche ──────────────────────────────────────────────── */
  for (const b of BRANCHEN) {
    const i = text.search(b.muster);
    if (i < 0) continue;
    merke({
      bereich: "unternehmen",
      feld: "branche",
      wert: b.wert,
      quelle: "gespraech",
      status: "gefunden",
      konfidenz: 75,
      belegstelle: umfeld(text, i, 20),
    });
    break;
  }

  /* ── Werkzeuge: Muss oder Wunsch ──────────────────────────── */
  const muss: string[] = [];
  const wunsch: string[] = [];
  let werkzeugBeleg = "";

  for (const w of WERKZEUGE) {
    const i = text.search(new RegExp(`\\b${w.replace(/[/]/g, "\\/")}\\b`, "i"));
    if (i < 0) continue;

    /*
     * Das Wunschwort steht VOR dem Werkzeug, nicht irgendwo im Satz.
     *
     * „Excel und möglichst SAP" — das „möglichst" gehört zu SAP. Ein
     * Fenster von dreissig Zeichen davor trifft das; der ganze Satz
     * machte Excel mit zum Wunsch.
     */
    const davor = text.slice(Math.max(0, i - 30), i);
    if (WUNSCHWORT.test(davor)) wunsch.push(w);
    else muss.push(w);
    if (!werkzeugBeleg) werkzeugBeleg = umfeld(text, i, w.length);
  }

  if (muss.length > 0) {
    merke({
      bereich: "muss",
      feld: "faehigkeiten",
      wert: muss,
      quelle: "gespraech",
      status: "gefunden",
      /* Ohne ausdrückliches Musswort ist die Einordnung eine Annahme
         aus der Satzstellung — deshalb nicht über 75. */
      konfidenz: MUSSWORT.test(text) ? 85 : 75,
      belegstelle: werkzeugBeleg,
    });
  }
  if (wunsch.length > 0) {
    merke({
      bereich: "wunsch",
      feld: "faehigkeiten",
      wert: wunsch,
      quelle: "gespraech",
      status: "gefunden",
      konfidenz: 85,
      belegstelle: werkzeugBeleg,
    });
  }

  /* ── Stellentitel ─────────────────────────────────────────── */
  /*
   * Der Artikel allein reicht nicht.
   *
   * „Wir sind eine Beratung aus Karlsruhe … und suchen einen Senior
   * Controller" — wer nur auf „eine(n)" prüft, liest „Beratung" als
   * Stellentitel, weil das im Satz weiter vorne steht. Die Absicht
   * steckt im Verb, nicht im Artikel; der Artikel darf danach stehen,
   * aber nie den Treffer auslösen.
   */
  const TITELWORT = String.raw`(?:such\w*|stelle\s+(?:als|für)|position\s+(?:als|des|der)|besetzen|einstellen|brauchen|benötigen)`;
  const TITELKERN = String.raw`((?:Senior|Junior|Lead|Head\s+of)?\s*[A-ZÄÖÜ][\wäöüß]+(?:[\s-][A-ZÄÖÜ][\wäöüß]+){0,3})`;
  const titel = text.match(new RegExp(`\\b${TITELWORT}\\s+(?:einen?|eine|die|den|der)?\\s*${TITELKERN}`));
  if (titel?.[1]) {
    const wert = titel[1].trim();
    /* Ein einzelnes Grosswort nach „einen" ist meistens kein
       Berufsbild, sondern der Satzanfang. Zwei Wörter oder ein
       bekanntes Vorwort machen es belastbar. */
    const belastbar = wert.split(/\s+/).length > 1 || /^(Senior|Junior|Lead)/.test(wert);
    merke({
      bereich: "stelle",
      feld: "titel",
      wert,
      quelle: "gespraech",
      status: "gefunden",
      konfidenz: belastbar ? 80 : 55,
      belegstelle: umfeld(text, titel.index!, titel[0].length),
    });
  }

  return funde;
}
