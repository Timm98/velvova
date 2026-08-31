/**
 * Aus einem Satz wird eine Suche.
 *
 * Der Anlass ist ein Fehler, der wie fehlende Intelligenz aussah, aber
 * einer Zeile Code geschuldet war. Der freie Text lief in einen
 * UND-Vergleich über Titel, Unternehmen, Ort und Aufgaben: jedes Wort
 * musste vorkommen. Bei „Maximal zwei Bürotage rund um Karlsruhe"
 * heisst das, es müsste eine Stelle geben, in deren Titel das Wort
 * „maximal" steht. Es gibt keine. Die Liste wurde leer, und es sah aus,
 * als verstünde Nina den Satz nicht — dabei hat ihn nie jemand gelesen.
 *
 * Also zwei Hälften, die verschieden schnell sind:
 *
 *   **Diese Datei ist die schnelle.** Regeln, kein Modell. Sie erkennt,
 *   was sich zuverlässig erkennen lässt — Orte, Bürotage, Gehalt,
 *   Vertragsart, Aktualität — und setzt daraus echte Filter. Das
 *   passiert, bevor irgendein Netzwerkaufruf beginnt.
 *
 *   **Nina ist die langsame.** Sie liest denselben Satz und erklärt in
 *   einem Satz, was sie berücksichtigt. Sie darf dabei mehr verstehen
 *   als diese Regeln — aber die Liste wartet nicht auf sie.
 *
 * Warum nicht gleich alles dem Modell überlassen? Weil eine Filterliste
 * reproduzierbar sein muss. Wer zweimal „ab 45.000 €" schreibt, muss
 * zweimal dieselbe Liste bekommen, und muss sehen können, welcher
 * Filter deshalb gesetzt ist. Ein Modell, das mal 45.000 und mal 45.001
 * zurückgibt, macht aus einer Suche ein Orakel.
 *
 * Was NICHT erkannt wird, bleibt als freier Text stehen, statt geraten
 * zu werden. Lieber ein Filter weniger als ein falscher.
 */

export interface Suchintention {
  /** Was als echter Filter in die URL geht. */
  filter: {
    q?: string;
    /** Begriffe, die NICHT vorkommen dürfen. */
    nicht?: string;
    ort?: string;
    remote?: "remote" | "hybrid" | "onsite";
    contract?: "permanent" | "temporary" | "freelance" | "internship";
    gehaltAb?: number;
    since?: number;
    salary?: "disclosed";
  };
  /** Was verstanden wurde, in Worten. Für Ninas kurze Erklärung. */
  erkannt: string[];
  /** Der Rest, den keine Regel erklärt. */
  rest: string;
}

/*
 * Füllwörter.
 *
 * Sie sind der eigentliche Grund, warum der UND-Vergleich nichts fand.
 * Was hiervon übrig bleibt, sucht nicht mehr mit.
 */
const FÜLLWÖRTER = new Set([
  "ich", "mir", "mich", "mein", "meine", "meinen", "einen", "eine", "einem",
  "der", "die", "das", "den", "dem", "des", "ein", "und", "oder", "aber",
  "mit", "für", "von", "zu", "zum", "zur", "im", "in", "am", "an",
  "auf", "aus", "bei", "nach", "über", "unter", "rund", "etwa", "circa",
  "maximal", "mindestens", "höchstens", "gern", "gerne", "bitte", "suche",
  "such", "finde", "zeig", "zeige", "mir", "job", "jobs", "stelle", "stellen",
  "arbeit", "möchte", "will", "würde", "kann", "soll", "sind", "ist", "sein",
  "nur", "noch", "auch", "sehr", "ganz", "wieder", "schon", "wenn", "dass",
  "wo", "was", "wie", "welche", "welcher", "welches", "angegeben", "angegebene",
  "the", "and", "with",
  "for", "from", "want", "looking", "would", "like", "show", "find", "some",
]);

/** „45.000 €", „45000", „45k", „45 000 Euro" → 45000 */
function alsBetrag(roh: string): number | null {
  const sauber = roh.replace(/[.\s ]/g, "").replace(",", ".");
  const k = /^(\d+(?:\.\d+)?)k$/i.exec(sauber);
  if (k) return Math.round(Number(k[1]) * 1000);
  const zahl = Number(sauber);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  // Ein Gehalt unter 1000 ist als Jahresgehalt gemeint: „ab 45" heisst
  // 45.000, nicht 45 Euro.
  return zahl < 1000 ? Math.round(zahl * 1000) : Math.round(zahl);
}

export function deuteSuchintention(eingabe: string): Suchintention {
  let rest = ` ${eingabe} `;
  const filter: Suchintention["filter"] = {};
  const erkannt: string[] = [];

  /**
   * Schneidet den Treffer aus dem Resttext heraus.
   *
   * Der Rückgabewert der Wirkung steuert zweierlei, und die
   * Unterscheidung ist wichtiger, als sie aussieht:
   *
   *   ein Text  → verstanden, wird erklärt und herausgeschnitten
   *   `""`      → verstanden, aber schon gesagt: nur herausschneiden
   *   `null`    → nicht zuständig, Text bleibt stehen
   *
   * Der mittlere Fall hat gefehlt, und das war ein echter Fehler.
   * „ab 45.000 €, wenn das Gehalt angegeben ist" setzt beim Betrag
   * bereits `salary=disclosed`; die spätere Gehaltsregel war damit
   * überflüssig und liess ihre Wörter stehen. Übrig blieb
   * `q=gehalt angegeben` — ein Volltextfilter auf zwei Wörter, die in
   * keiner Anzeige stehen, und damit eine leere Liste aus einem Satz,
   * der vollständig verstanden wurde.
   */
  function nimm(muster: RegExp, wirkung: (treffer: RegExpMatchArray) => string | null): void {
    const treffer = muster.exec(rest);
    if (!treffer) return;
    const text = wirkung(treffer);
    if (text === null) return;
    if (text !== "") erkannt.push(text);
    rest = rest.replace(treffer[0], " ");
  }

  // ── Arbeitsmodell ────────────────────────────────────────────
  // Vor dem Ort, weil „remote in Berlin" sonst „remote" als Ort liest.
  nimm(/\b(100\s*%\s*)?(remote|homeoffice|home\s*office|vollständig\s+remote)\b/i, () => {
    filter.remote = "remote";
    return "nur remote";
  });
  nimm(/\b(hybrid|teilweise\s+remote)\b/i, () => {
    if (filter.remote) return "";
    filter.remote = "hybrid";
    return "hybrid";
  });
  nimm(/\b(vor\s*ort|onsite|präsenz|im\s+büro)\b/i, () => {
    if (filter.remote) return "";
    filter.remote = "onsite";
    return "vor Ort";
  });

  /*
   * „Maximal zwei Bürotage" ist eine Aussage über das Arbeitsmodell.
   *
   * Bis zwei Tage im Büro ist hybrid; null ist remote. Mehr als zwei
   * liesse sich nicht sauber abbilden — dann wird bewusst kein Filter
   * gesetzt, statt einen zu erfinden.
   */
  nimm(
    /\b(?:max(?:imal)?\.?\s+)?(\d+|null|kein[en]?|ein[enms]?|zwei|drei|vier|fünf)\s*(?:tage?\s*)?(?:im\s+)?(?:büro|bürotage?|office\s*days?|präsenztage?)\b/i,
    (t) => {
      const wort = (t[1] ?? "").toLowerCase();
      const zahlen: Record<string, number> = {
        null: 0, kein: 0, keine: 0, keinen: 0,
        ein: 1, eine: 1, einen: 1, eins: 1,
        zwei: 2, drei: 3, vier: 4, fünf: 5,
      };
      const tage = zahlen[wort] ?? Number(wort);
      if (!Number.isFinite(tage)) return null;
      if (tage === 0) {
        filter.remote = "remote";
        return "keine Bürotage";
      }
      if (tage <= 2) {
        filter.remote = "hybrid";
        return `höchstens ${tage} Bürotage`;
      }
      return null;
    },
  );

  // ── Gehalt ───────────────────────────────────────────────────
  nimm(
    /\b(?:ab|mindestens|min\.?|from|at\s+least)\s+([\d.,\s ]+k?)\s*(?:€|eur|euro)?\b/i,
    (t) => {
      const betrag = alsBetrag(t[1] ?? "");
      if (betrag === null) return null;
      filter.gehaltAb = betrag;
      /*
       * Ein Mindestgehalt setzt zusätzlich „Gehalt angegeben".
       *
       * Sonst fielen alle Stellen ohne Gehaltsangabe stumm durch das
       * Raster — und der Mensch dächte, es gäbe sie nicht. Es gibt sie,
       * sie sagen nur nichts.
       */
      filter.salary = "disclosed";
      return `ab ${betrag.toLocaleString("de-DE")} €`;
    },
  );
  nimm(/\b(?:mit\s+)?gehalt(?:sangabe)?\b/i, () => {
    if (filter.salary) return "";
    filter.salary = "disclosed";
    return "nur mit Gehaltsangabe";
  });

  // ── Vertragsart ──────────────────────────────────────────────
  nimm(/\b(unbefristete?[nrms]?|festanstellung|permanent)\b/i, () => {
    filter.contract = "permanent";
    return "unbefristet";
  });
  nimm(/\b(befristete?[nrms]?|temporary)\b/i, () => {
    if (filter.contract) return "";
    filter.contract = "temporary";
    return "befristet";
  });
  nimm(/\b(freelance|freiberufliche?[nrms]?|selb?stständige?[nrms]?|selbständige?[nrms]?)\b/i, () => {
    if (filter.contract) return "";
    filter.contract = "freelance";
    return "freiberuflich";
  });
  nimm(/\b(praktikum|internship|werkstudent)\b/i, () => {
    if (filter.contract) return "";
    filter.contract = "internship";
    return "Praktikum oder Werkstudium";
  });

  // ── Aktualität ───────────────────────────────────────────────
  nimm(/\b(?:aus\s+der\s+)?letzten?\s+(\d+)\s+tagen?\b/i, (t) => {
    const tage = Number(t[1]);
    if (!Number.isFinite(tage) || tage <= 0) return null;
    filter.since = tage;
    return `aus den letzten ${tage} Tagen`;
  });
  nimm(/\b(neu|frisch|aktuell|neue?\s+stellen)\b/i, () => {
    if (filter.since) return "";
    filter.since = 7;
    return "aus den letzten 7 Tagen";
  });

  // ── Ausschlüsse ──────────────────────────────────────────────
  /*
   * „ohne Kaltakquise" ist das Gegenteil von „Kaltakquise".
   *
   * Vorher stand „ohne" in der Füllwortliste und verschwand. Übrig
   * blieb der Suchbegriff „kaltakquise" — die Suche verlangte also
   * genau das, was ausgeschlossen werden sollte. Das ist schlimmer als
   * ein fehlender Filter: eine leere Liste merkt man, eine
   * umgedrehte Bedingung nicht.
   */
  const ausschlüsse: string[] = [];
  for (const treffer of [...rest.matchAll(/\bohne\s+([\wäöüß-]+(?:\s+[\wäöüß-]+)?)/gi)]) {
    const begriff = (treffer[1] ?? "").trim().toLowerCase();
    if (begriff.length < 3) continue;
    // Nur das erste Wort ausschliessen, wenn das zweite ein Füllwort
    // ist: „ohne Kaltakquise und" darf nicht „und" ausschliessen.
    const wörter = begriff.split(/\s+/).filter((w) => !FÜLLWÖRTER.has(w) && w.length > 2);
    if (wörter.length === 0) continue;
    ausschlüsse.push(wörter[0]!);
    erkannt.push(`ohne ${wörter[0]}`);
    rest = rest.replace(treffer[0], " ");
  }
  if (ausschlüsse.length > 0) filter.nicht = ausschlüsse.join(" ");

  // ── Ort ──────────────────────────────────────────────────────
  /*
   * Zuletzt, damit die Ortsregel nicht vorher Erkanntes einsammelt.
   *
   * Der Ort wird als eigener Filter geführt und nicht in den freien
   * Text geworfen: „Berlin" im Volltext trifft auch eine Firma, die
   * „Berlin" im Namen hat, und der Mensch sieht nicht, warum.
   */
  nimm(
    /\b(?:in|um|rund\s+um|nahe|bei|around|near)\s+([A-ZÄÖÜ][\wäöüß.-]*(?:\s+[A-ZÄÖÜ][\wäöüß.-]*)?)/,
    (t) => {
      /*
       * Satzzeichen am Ende abschneiden.
       *
       * Der Punkt gehört bewusst zu den erlaubten Zeichen — „St. Gallen"
       * braucht ihn. Am Wortende ist er aber fast immer das Satzende,
       * und „Karlsruhe." findet keine einzige Stelle.
       */
      const ort = (t[1] ?? "").trim().replace(/[.,;:!?]+$/, "");
      if (ort.length < 2) return null;
      filter.ort = ort;
      return `rund um ${ort}`;
    },
  );

  /*
   * Was übrig bleibt, ohne Füllwörter.
   *
   * Ein leerer Rest ist ein gutes Ergebnis: dann ist der ganze Satz in
   * Filtern aufgegangen und niemand sucht mehr nach „maximal".
   */
  const restWörter = rest
    .toLowerCase()
    .replace(/[.,;:!?„“"'()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FÜLLWÖRTER.has(w));

  if (restWörter.length > 0) filter.q = restWörter.join(" ");

  return { filter, erkannt, rest: restWörter.join(" ") };
}

/**
 * Ninas Satz dazu (§16.3).
 *
 * Bewusst kurz und ohne Fachwort. Wer „maximal zwei Bürotage" schreibt,
 * soll nicht „workModel=hybrid" zurückbekommen.
 */
export function erklärung(intention: Suchintention, assistentName = "Ich"): string | null {
  if (intention.erkannt.length === 0) return null;
  const teile = intention.erkannt;
  const aufzählung =
    teile.length === 1
      ? teile[0]!
      : `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
  return `${assistentName} berücksichtige jetzt: ${aufzählung}.`;
}
