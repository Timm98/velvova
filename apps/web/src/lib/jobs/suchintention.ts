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
    /**
     * Nur dieser Ort, kein Umkreis.
     *
     * „Nur Karlsruhe" und „rund um Karlsruhe" sind verschiedene
     * Wünsche. Ohne diese Unterscheidung wird aus dem ersten
     * stillschweigend das zweite — und wer ausdrücklich „nur" sagt,
     * bekommt Stellen, die er ausgeschlossen hat.
     */
    ortGenau?: boolean;
    remote?: "remote" | "hybrid" | "onsite";
    contract?: "permanent" | "temporary" | "freelance" | "internship";
    gehaltAb?: number;
    since?: number;
    salary?: "disclosed";
    /** Vollzeit oder Teilzeit — als Filter, nicht als Suchwort. */
    arbeitszeit?: "vollzeit" | "teilzeit";
    /** `false` heisst ausdrücklich: keine Schicht-, Nacht- oder Wochenendarbeit. */
    schicht?: false;
    /** Umkreis in Kilometern. Nur sinnvoll zusammen mit `ort`. */
    umkreisKm?: number;
    /** Höchste Fahrzeit zur Arbeit, in Minuten. */
    pendelzeit?: number;
  };
  /**
   * Filter, die dieser Satz ENTFERNEN will.
   *
   * ── Warum das in die Absicht gehört ───────────────────────
   *
   * „Mach den Gehaltsfilter wieder weg" ist eine vollständige,
   * eindeutige Anweisung. Ohne dieses Feld wurde daraus eine
   * Volltextsuche nach „mach gehaltsfilter weg" — drei Wörter, die
   * in keiner Anzeige stehen. Der Mensch bekam null Treffer auf einen
   * Satz, den jeder versteht.
   *
   * Der Aufrufer wendet die Absicht auf den BESTEHENDEN Zustand an;
   * ein Satz kann also etwas setzen und etwas anderes wegnehmen.
   */
  entfernen: (keyof Suchintention["filter"])[];
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
  /* „Doch lieber 25 Kilometer" liess sonst „doch lieber" als Suchwort stehen. */
  "doch", "lieber", "eher", "besser", "stattdessen", "bitte", "mal",
  "wo", "was", "wie", "welche", "welcher", "welches", "angegeben", "angegebene",
  "the", "and", "with",
  "for", "from", "want", "looking", "would", "like", "show", "find", "some",
  /*
   * ── Wörter rund um die Fahrzeit ─────────────────────────────
   *
   * „Keine längere Autofahrt als 170 Minuten" setzt jetzt einen
   * Filter — aber die Wörter drumherum blieben stehen und wurden zur
   * Volltextsuche nach „längere autofahrt als". Null Treffer, und die
   * Person sieht einen leeren Arbeitsmarkt statt eines Filters.
   *
   * Sie stehen hier und nicht in der Regel, weil sie auch ohne
   * Fahrzeit Füllwörter sind: Kein Mensch sucht eine Stelle, in deren
   * Anzeige das Wort „längere" vorkommt.
   */
  "kein", "keine", "keinen", "länger", "längere", "längeren", "weiter",
  "weitere", "weiteren", "mehr", "als", "bis", "minuten", "minute", "min",
  "autofahrt", "auto", "fahrt", "fahrzeit", "anfahrt", "arbeitsweg",
  "pendeln", "pendelei", "pendelzeit", "weg", "entfernt", "entfernung",
  "kilometer", "km", "umkreis", "radius",
  "stunde", "stunden", "std", "auto", "fahren", "will",
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

/**
 * Wörter, die nach „nur" stehen können, ohne ein Ort zu sein.
 *
 * Bedingungen und Sammelbegriffe. Die Liste ist kurz und wächst nur,
 * wenn ein echter Fall auftaucht — jeder Eintrag ist ein Ort, den
 * jemand nie suchen kann.
 */
const KEIN_ORT =
  /^(vollzeit|teilzeit|remote|hybrid|homeoffice|home\s*office|unbefristet|befristet|deutsch|englisch|schicht|nachtschicht|minijob|ausbildung|praktikum|werkstudent|stellen?|jobs?|arbeit|positionen?|angebote?|firmen|unternehmen|arbeitgeber|anzeigen?|ergebnisse?)$/i;

export function deuteSuchintention(eingabe: string): Suchintention {
  let rest = ` ${eingabe} `;
  const filter: Suchintention["filter"] = {};
  const erkannt: string[] = [];
  const entfernen: (keyof Suchintention["filter"])[] = [];

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
       * Ein Mindestgehalt setzt NICHT mehr „nur mit Gehaltsangabe".
       *
       * ── Warum es das einmal tat ───────────────────────────
       *
       * Damals hatten Stellen ohne eigene Angabe gar keine Zahl. Ein
       * Mindestgehalt hätte sie stumm durchfallen lassen, und der
       * Mensch hätte gedacht, es gäbe sie nicht.
       *
       * ── Warum es jetzt falsch wäre ────────────────────────
       *
       * Inzwischen tragen 82,4 Prozent der deutschen Stellen eine
       * Gehaltsorientierung — 23,3 Prozent vom Arbeitgeber, 59,1
       * Prozent als amtliche Referenz über die Berufskennung. Eine
       * Untergrenze lässt sich also auch gegen die Referenz prüfen.
       *
       * Vor allem aber kehrte die alte Regel die Absicht um: Auf
       * „ab 45.000 Euro, Schätzungen sind okay" antwortete das
       * Produkt mit einem Filter, der genau die Schätzungen
       * ausschliesst. Wer das ausdrücklich sagt, muss es bekommen.
       */
      return `ab ${betrag.toLocaleString("de-DE")} €`;
    },
  );
  /*
   * Schätzungen ausdrücklich erlauben — VOR der Regel, die sie
   * ausschliesst.
   *
   * „Schätzungen sind okay" enthält kein Wort, das die
   * Gehaltsangabe-Regel auslöst; ohne diese Zeile bliebe der Satz
   * unverstanden und landete als Volltextsuche nach „schätzungen
   * okay" — zwei Wörter, die in keiner Anzeige stehen.
   *
   * Sie merkt sich die Erlaubnis, damit eine spätere Regel sie nicht
   * überschreibt.
   */
  let schaetzungErlaubt = false;
  nimm(
    /\b(?:sch[äa]tzung(?:en)?\s+(?:sind\s+)?(?:okay|ok|in\s+ordnung|erlaubt|egal)|auch\s+gesch[äa]tzt|gesch[äa]tzte?\s+(?:sind\s+)?(?:okay|ok|erlaubt))\b/i,
    () => {
      schaetzungErlaubt = true;
      delete filter.salary;
      return "Schätzungen erlaubt";
    },
  );

  nimm(/\b(?:mit\s+)?gehalt(?:sangabe)?\b/i, () => {
    if (schaetzungErlaubt) return "";
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

  // ── Arbeitszeit ──────────────────────────────────────────────
  /*
   * Als Filter, nicht als Suchwort.
   *
   * „Vollzeit" fiel vorher in die Volltextsuche. Getroffen hätte das
   * nur Anzeigen, die das Wort schreiben — und verfehlt jede
   * Vollzeitstelle, die es für selbstverständlich hält.
   */
  nimm(/\b(vollzeit|full[\s-]?time)\b/i, () => {
    filter.arbeitszeit = "vollzeit";
    return "Vollzeit";
  });
  nimm(/\b(teilzeit|part[\s-]?time)\b/i, () => {
    if (filter.arbeitszeit) return "";
    filter.arbeitszeit = "teilzeit";
    return "Teilzeit";
  });

  // ── Schicht ──────────────────────────────────────────────────
  /*
   * Nur die Verneinung.
   *
   * „Keine Nachtschicht" ist eine Bedingung; „Nachtschicht" allein
   * wäre eine Suche nach Stellen MIT Nachtschicht, und die will
   * praktisch niemand so formulieren. Was nicht eindeutig ist, wird
   * hier nicht geraten.
   */
  nimm(
    /\b(?:keine?n?|ohne)\s+(?:nacht|wochenend|spät)?schicht(?:arbeit|dienst)?\b/i,
    () => {
      filter.schicht = false;
      return "keine Schichtarbeit";
    },
  );

  // ── Umkreis ──────────────────────────────────────────────────
  /*
   * „Doch lieber 25 Kilometer" — eine Änderung, kein neuer Satz.
   *
   * Sie kam vorher gar nicht an: Der Satz landete als Volltextsuche
   * nach „doch lieber kilometer". Wer den Umkreis anpasst, hat den
   * Ort schon gesetzt; deshalb steht die Zahl hier für sich und
   * verlangt keinen Ortsnamen daneben.
   */
  nimm(/\b(\d{1,3})\s*(?:km|kilometer)\b/i, (t) => {
    const km = Number(t[1]);
    if (!Number.isFinite(km) || km <= 0 || km > 300) return null;
    filter.umkreisKm = km;
    return `${km} km Umkreis`;
  });

  // ── Filter entfernen ─────────────────────────────────────────
  /*
   * Was der Satz wegnehmen will.
   *
   * Bewusst nur mit einem ausdrücklichen Wort („weg", „raus",
   * „entfernen", „vergiss"). „Ohne Gehaltsfilter" wäre mehrdeutig —
   * es könnte auch heissen, dass gar keiner gesetzt werden soll.
   */
  const WEGFELDER: [RegExp, keyof Suchintention["filter"], string][] = [
    [/gehalts?(?:filter|grenze|angabe)?/i, "gehaltAb", "Gehaltsfilter"],
    [/orts?(?:filter)?|stadt/i, "ort", "Ortsfilter"],
    [/(?:arbeits)?modell|remote|hybrid|homeoffice/i, "remote", "Arbeitsmodell"],
    [/vertrags?(?:art|filter)?|befristung/i, "contract", "Vertragsart"],
    [/arbeitszeit|vollzeit|teilzeit/i, "arbeitszeit", "Arbeitszeit"],
    [/schicht/i, "schicht", "Schichtfilter"],
    [/umkreis|radius/i, "umkreisKm", "Umkreis"],
  ];
  nimm(
    /\b(?:mach|nimm|lösch|loesch|entfern|vergiss)\w*\s+(?:den|die|das)?\s*([\wäöüß]+?)(?:filter|grenze)?\s*(?:wieder\s*)?(?:weg|raus|heraus)?\b/i,
    (t) => {
      const wort = t[1] ?? "";
      const treffer = WEGFELDER.find(([m]) => m.test(wort));
      if (!treffer) return null;
      entfernen.push(treffer[1]);
      /* Der Gehaltsfilter hängt an zweien: Betrag und „nur mit Angabe". */
      if (treffer[1] === "gehaltAb") entfernen.push("salary");
      return `${treffer[2]} entfernt`;
    },
  );

  // ── Ort ──────────────────────────────────────────────────────
  /*
   * Zuletzt, damit die Ortsregel nicht vorher Erkanntes einsammelt.
   *
   * Der Ort wird als eigener Filter geführt und nicht in den freien
   * Text geworfen: „Berlin" im Volltext trifft auch eine Firma, die
   * „Berlin" im Namen hat, und der Mensch sieht nicht, warum.
   */
  /*
   * „Nur Karlsruhe" — zuerst, weil es das engere ist.
   *
   * ── Was gefehlt hat ───────────────────────────────────────
   *
   * Die Ortsregel darunter verlangt eine Präposition („in", „rund
   * um", „bei"). „Nur Karlsruhe" hat keine — der Satz fiel durch und
   * landete als Volltextsuche nach „karlsruhe". Getroffen hätte das
   * jede Anzeige, in der das Wort irgendwo vorkommt, und verfehlt
   * jede Karlsruher Stelle, die es nicht schreibt.
   *
   * Das ist TEST 1 aus der Vorgabe, und es ist gleichzeitig der
   * Unterschied, den die Suche danach honorieren muss: `ortGenau`
   * heisst kein Umkreis.
   */
  nimm(
    /*
     * Die Schlüsselwörter mit beiden Schreibweisen, nicht mit der
     * `i`-Flagge: Der Ortsteil dahinter MUSS grossgeschrieben sein,
     * sonst fängt die Regel jedes Wort nach „nur" ein. Eine globale
     * `i`-Flagge würde genau das aufheben.
     */
    /\b(?:[Nn]ur|[Aa]usschliesslich|[Aa]usschließlich|[Oo]nly)\s+(?:in\s+)?([A-ZÄÖÜ][\wäöüß.-]*(?:\s+[A-ZÄÖÜ][\wäöüß.-]*)?)/,
    (t) => {
      const ort = (t[1] ?? "").trim().replace(/[.,;:!?]+$/, "");
      /*
       * Nicht jedes Wort nach „nur" ist ein Ort.
       *
       * „Nur Vollzeit", „Nur unbefristet", „Nur Remote" sind
       * Bedingungen, die eigene Regeln haben — und die laufen
       * vorher. Was hier ankommt, ist grossgeschrieben und keines
       * der bekannten Bedingungswörter.
       */
      if (ort.length < 3) return null;
      /*
       * Nicht jedes grossgeschriebene Wort nach „nur" ist ein Ort.
       *
       * Zwei Sorten stehen im Weg. Bedingungen („Nur Vollzeit") haben
       * eigene Regeln, die vorher laufen — was hier ankommt, hat
       * keine getroffen. Und Sammelbegriffe („Nur Stellen ab
       * 45.000 €") sind das Wort, mit dem der Satz überhaupt von
       * Stellen redet.
       *
       * Ohne diese Liste wurde aus „Nur Stellen ab 45.000 Euro" ein
       * Ortsfilter auf die Stadt „Stellen" — und die Liste blieb leer.
       */
      if (KEIN_ORT.test(ort)) return null;
      filter.ort = ort;
      filter.ortGenau = true;
      return `nur ${ort}`;
    },
  );

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
   * ══════════════════════════════════════════════════════════════
   * Die Fahrzeit — der Filter, der gefehlt hat
   * ══════════════════════════════════════════════════════════════
   *
   * „Keine längere Autofahrt als 170 Minuten" ergab bisher keinen
   * Filter. Der ganze Satz wanderte in die Volltextsuche, und die
   * suchte nach Anzeigen, in denen „längere", „autofahrt" und „min"
   * vorkommen — null Treffer, und daneben eine Rückfrage, die zu
   * nichts passte.
   *
   * Dabei gibt es die Zahl längst: `commuteMinutes` steht an jeder
   * bewerteten Stelle, und `maxCommuteMinutes` im Profil. Es fehlte
   * nur der Weg von einem Satz dorthin.
   *
   * ── Warum vor dem Umkreis ───────────────────────────────────
   *
   * Weil „170 min" sonst als Entfernung gelesen wird. Minuten und
   * Kilometer stehen in denselben Sätzen und meinen Verschiedenes —
   * die Zeit zuerst zu prüfen ist billiger als jede Nachbesserung.
   */
  nimm(
    /\b(?:h[öo]chstens|maximal|max\.?|nicht (?:l[äa]nger|mehr) als|bis zu|unter)?\s*(\d{1,3})\s*(?:min|minuten|minütig)\b[^.]*?\b(?:fahr|pendel|weg|anfahrt|arbeitsweg)?/i,
    (t) => {
      const minuten = Number(t[1]);
      if (!Number.isFinite(minuten) || minuten < 5 || minuten > 300) return null;
      filter.pendelzeit = minuten;
      return `höchstens ${minuten} Minuten Fahrt`;
    },
  );

  /*
   * Dieselbe Angabe in Worten ohne Zahl davor: „keine lange Anfahrt".
   *
   * Sie bleibt ohne Wirkung — eine Zahl steht nicht da, und eine zu
   * erfinden hiesse, eine Grenze zu setzen, die niemand genannt hat.
   * Der Satz wird nur AUFGEBRAUCHT, damit er nicht als Suchwort in
   * der Volltextsuche landet und dort garantiert nichts findet.
   */
  /*
   * Dieselbe Angabe in Stunden.
   *
   * „Höchstens 2 Stunden Auto" ist die häufigere Formulierung als
   * „120 Minuten" — und sie fiel durch, weil die Regel nur Minuten
   * kannte. Das Modell rechnete richtig um und setzte die 120
   * zusätzlich als KILOMETER: zwei Plättchen, eines davon falsch.
   *
   * Eine Regel, die Stunden kennt, nimmt dem Modell die Gelegenheit
   * dazu — und kostet keinen Aufruf.
   */
  nimm(/(?<![\d,.])(\d{1,2})(?:[,.](\d))?\s*(?:std\.?|stunden?|h)\b/i, (t) => {
    const ganze = Number(t[1]);
    const zehntel = t[2] ? Number(t[2]) / 10 : 0;
    const minuten = Math.round((ganze + zehntel) * 60);
    if (!Number.isFinite(minuten) || minuten < 15 || minuten > 300) return null;
    if (filter.pendelzeit !== undefined) return "";
    filter.pendelzeit = minuten;
    return `höchstens ${minuten} Minuten Fahrt`;
  });

  nimm(/\bkeine?\s+(?:lange|weite)\s+(?:anfahrt|autofahrt|fahrt|pendelei)\b/i, () => "");

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

  /*
   * Widersprüche auflösen — nach allen Regeln, nicht in einer.
   *
   * „Nur Karlsruhe, 25 Kilometer" setzt beides: genau diese Stadt UND
   * einen Umkreis. Zusammen ergibt das keinen Sinn, und welches der
   * beiden gewinnt, darf nicht davon abhängen, welche Regel zufällig
   * zuerst läuft. Der Umkreis ist die spätere Präzisierung — er
   * gewinnt.
   */
  if (filter.umkreisKm !== undefined) delete filter.ortGenau;

  return { filter, erkannt, entfernen, rest: restWörter.join(" ") };
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
