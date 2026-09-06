/**
 * Eine Ortsangabe in Bestandteile zerlegen und auflösen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Zerlegung ein eigener Schritt ist
 * ══════════════════════════════════════════════════════════════
 *
 * Stellenanzeigen schreiben denselben Ort auf ein Dutzend Arten:
 *
 *   Karlsruhe
 *   Karlsruhe, Baden-Württemberg
 *   76131 Karlsruhe
 *   Karlsruhe, Karlsruhe (Kreis)
 *   Moabit, Berlin
 *
 * Wer daraus direkt eine Koordinate sucht, sucht bei jeder Schreibweise
 * neu und findet bei der Hälfte nichts. Zerlegt man zuerst — PLZ,
 * Stadt, Region —, wird aus zwölf Schreibweisen eine Anfrage.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Mehrdeutigkeit ein eigenes Ergebnis ist
 * ══════════════════════════════════════════════════════════════
 *
 * Es gibt zwei Frankfurt, und sie liegen fünfhundert Kilometer
 * auseinander. Eine Umkreisrechnung um das falsche sieht genauso aus
 * wie eine um das richtige — dieselbe Zahl, dieselbe Einheit,
 * dieselbe Zuversicht.
 *
 * Blind den ersten Kandidaten zu nehmen ist deshalb nicht “ein bisschen
 * ungenau”, sondern eine Angabe, die stimmen kann oder auch nicht, und
 * niemand sieht welches. `ambiguous` ist die ehrlichere Antwort: Die
 * Stelle bleibt in der Liste, mit einer offenen Frage statt einer
 * erfundenen Entfernung.
 */

export type Geostatus =
  | "resolved_exact"
  | "resolved_city"
  | "ambiguous"
  | "not_found"
  | "not_applicable_remote"
  | "invalid_input";

export type Genauigkeit = "exact" | "plz" | "stadt" | "region";

export interface Ortsteile {
  /** Die Rohangabe, unverändert. */
  roh: string;
  /** Die Postleitzahl, wenn eine dastand. */
  plz: string | null;
  /**
   * Schreibweisen des Ortsnamens, beste zuerst.
   *
   * ── Warum eine Leiter und kein einzelner Name ────────────────
   *
   * “Neuenhagen bei Berlin” ist ein Ortsname, kein Ort mit Zusatz.
   * Wer “bei” für Beiwerk hält, macht daraus “Neuenhagen Berlin” und
   * findet nichts — obwohl der Ort genau so in der Referenz steht.
   *
   * Deshalb steht die ungekürzte Form vorn und wird zuerst probiert;
   * die gekürzten Formen kommen nur zum Zug, wenn sie nichts findet.
   */
  varianten: string[];
  /**
   * Bundesland oder Landkreis — was hinter dem Ort stand.
   *
   * Welches von beiden es ist, entscheidet die Auflösung: Sie
   * vergleicht die Angabe gegen beide Felder der Referenz. “Barnim”
   * ist ein Kreis, “Hessen” ein Bundesland, und die Anzeige sagt
   * nicht dazu, welches sie meint.
   */
  region: string | null;
  /** Ob die Angabe überhaupt einen Ort meint. */
  brauchbar: boolean;
}

/** Zusätze, die kein Ortsname sind — erst in der zweiten Variante entfernt. */
const ZUSAETZE =
  /\b(kreis|landkreis|lkr\.?|stadtkreis|regierungsbezirk|bundesland|deutschland|germany|und umgebung|umgebung|raum|region|gebiet|bei|nähe|naehe)\b/gi;

/**
 * Angaben, die keinen Ort nennen.
 *
 * ── Warum Ländernamen hier stehen ─────────────────────────────
 *
 * “Deutschland” steht an 29 der 1209 analysierten Stellen als
 * vollständige Ortsangabe. Es ist keine Lücke in der Referenz — es
 * ist eine Angabe, aus der sich keine Entfernung rechnen lässt.
 *
 * Der Unterschied ist betrieblich wichtig: `not_found` heisst
 * “gesucht und nichts gefunden” und ruft nach besseren Daten,
 * `invalid_input` heisst “hier ist nichts zu finden” und ruft nach
 * gar nichts.
 */
const KEIN_ORT =
  /^(remote|homeoffice|home ?office|deutschlandweit|bundesweit|mobiles arbeiten|ortsunabhängig|ortsunabhaengig|verschiedene orte|mehrere standorte|nach vereinbarung|hybrid|vor ort|k\.?a\.?|unbekannt|nicht angegeben|n\/a|-+|deutschland|germany|österreich|austria|schweiz|switzerland|united kingdom|great britain|uk|eu|europa|europe)$/i;

/**
 * Englische Namen deutscher Städte.
 *
 * ── Warum diese Liste kurz bleibt ─────────────────────────────
 *
 * Sie enthält nur Namen, die genau eine deutsche Stadt meinen und
 * die im Bestand tatsächlich vorkommen — “Munich” an sieben Stellen,
 * “Cologne” an fünf. Sie ist kein Übersetzungsversuch: Wer sie um
 * Vermutungen erweitert, baut lautlos falsche Zuordnungen ein.
 *
 * Die vollständige Lösung wäre die Datei `alternateNames` derselben
 * Quelle. Sie ist 400 MB gross und für vierzehn Stellen nicht
 * verhältnismässig; wenn der Bestand wächst, ist sie der nächste
 * Schritt.
 */
const ENGLISCHE_NAMEN = new Map<string, string>([
  ["munich", "München"],
  ["cologne", "Köln"],
  ["nuremberg", "Nürnberg"],
  ["hanover", "Hannover"],
  ["brunswick", "Braunschweig"],
  ["ratisbon", "Regensburg"],
  ["treves", "Trier"],
  ["bavaria", "Bayern"],
  ["saxony", "Sachsen"],
  ["hesse", "Hessen"],
  ["lower saxony", "Niedersachsen"],
  ["north rhine-westphalia", "Nordrhein-Westfalen"],
  ["rhineland-palatinate", "Rheinland-Pfalz"],
  ["thuringia", "Thüringen"],
]);

/** Deutsche Bundesländer, damit ein Segment als Region erkannt wird. */
const BUNDESLAENDER = new Set([
  "baden-wuerttemberg", "bayern", "berlin", "brandenburg", "bremen",
  "hamburg", "hessen", "mecklenburg-vorpommern", "niedersachsen", "nordrhein-westfalen",
  "rheinland-pfalz", "saarland", "sachsen", "sachsen-anhalt", "schleswig-holstein",
  "thueringen",
]);

/**
 * Kleinschreibung, Umlaute vereinheitlicht, Mehrfachleerzeichen weg.
 *
 * ── Warum Umlaute umgeschrieben werden ────────────────────────
 *
 * “Thüringen” und “Thueringen” stehen beide in echten Anzeigen, und
 * beide meinen dasselbe. Wer nur eine Form kennt, findet die andere
 * nie — und die Stelle fällt lautlos aus dem Umkreis.
 *
 * Der Bindestrich bleibt stehen: “Baden-Baden” ist nicht “Baden”.
 */
export function ortNormalisieren(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ein Segment von Klammern und Mehrfachleerzeichen befreien. */
function segmentSaeubern(text: string): string {
  return text.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Eine Ortsangabe zerlegen.
 *
 * `brauchbar: false` heisst: Da steht kein Ort. “Remote”,
 * “deutschlandweit”, ein Bindestrich — das sind Angaben über die
 * Arbeitsform oder gar keine, und sie zu geokodieren erzeugt einen
 * plausiblen Unsinn.
 */
export function ortZerlegen(roh: string): Ortsteile {
  const leer: Ortsteile = { roh, plz: null, varianten: [], region: null, brauchbar: false };
  const sauber = roh.trim();
  if (sauber.length < 2) return leer;
  if (KEIN_ORT.test(sauber)) return leer;

  /* Die Postleitzahl steht in Deutschland fünfstellig, meist vorn. */
  const plzTreffer = /\b(\d{5})\b/.exec(sauber);
  const plz = plzTreffer ? plzTreffer[1]! : null;

  const ohnePlz = segmentSaeubern(sauber.replace(/\b\d{5}\b/g, " "));

  /*
   * Getrennt wird an Komma, senkrechtem Strich und am Gedankenstrich
   * mit Leerzeichen — nicht am Schrägstrich.
   *
   * ── Warum der Schrägstrich keine Trennung ist ───────────────
   *
   * “Fürstenwalde/Spree” ist ein Ortsname, kein Paar. Wer daran
   * trennt, sucht nach “Fürstenwalde” und findet sechs Kandidaten,
   * wo einer stand. Gemessen an sechs Stellen im Bestand.
   *
   * ── Warum am Gedankenstrich schon ───────────────────────────
   *
   * “Remote - Berlin” und “London - Hybrid” schreiben Arbeitsform und
   * Ort in eine Zeile. Ohne die Trennung ist beides zusammen ein
   * Name, den es nirgends gibt.
   */
  const segmente = ohnePlz
    .split(/,|\||\s[-–—]\s/)
    .map(segmentSaeubern)
    .filter((t) => t.length >= 2)
    /*
     * Arbeitsformen fliegen raus, nicht der Rest der Angabe.
     * “Remote - Berlin” soll Berlin ergeben, nicht nichts.
     */
    .filter((t) => !KEIN_ORT.test(t));

  if (segmente.length === 0) {
    return plz ? { ...leer, plz, brauchbar: true } : leer;
  }

  const erst = segmente[0]!;

  /*
   * Die Leiter der Schreibweisen, beste zuerst.
   *
   * Ganz vorn steht die ungeteilte Angabe: “Fürstenwalde/Spree” steht
   * genau so in der Referenz, und jede Zerlegung macht sie schlechter.
   * Erst danach kommen die Kürzungen.
   */
  const varianten = [
    segmente.length === 1 ? ohnePlz : "",
    erst,
    sanktAusschreiben(erst),
    englischUebersetzen(erst),
    segmentSaeubern(erst.replace(ZUSAETZE, " ")),
    kopfWort(erst),
  ]
    .map((v) => v.trim())
    .filter((v) => v.length >= 2);

  /*
   * Die Region ist das letzte Segment — aber nur, wenn es eines ist.
   *
   * “Karlsruhe, Karlsruhe (Kreis)” nennt nach dem Entfernen des
   * Zusatzes zweimal denselben Namen. Ihn als Region zu führen macht
   * die Suche enger, ohne etwas zu unterscheiden.
   */
  let region: string | null = null;
  for (let i = segmente.length - 1; i > 0; i--) {
    const kandidat = segmentSaeubern(segmente[i]!.replace(ZUSAETZE, " "));
    if (kandidat.length < 2) continue;
    if (ortNormalisieren(kandidat) === ortNormalisieren(erst)) continue;
    if (BUNDESLAENDER.has(ortNormalisieren(kandidat))) {
      region = kandidat;
      break;
    }
    if (region === null) region = kandidat;
  }

  return {
    roh,
    plz,
    varianten: [...new Set(varianten)],
    region: region === null ? null : (englischUebersetzen(region) || region),
    brauchbar: true,
  };
}

/**
 * “St. Ingbert” → “Sankt Ingbert”.
 *
 * Die Quelle schreibt den Heiligen aus, die Stellenanzeige kürzt ihn
 * ab. Ohne diesen Schritt findet “St. Ingbert” nichts — und die
 * Notlösung, am ersten Wort zu kürzen, sucht dann nach “St.” und
 * trifft ein Dutzend Krankenhäuser.
 */
function sanktAusschreiben(text: string): string {
  return /^st\.? /i.test(text) ? text.replace(/^st\.? /i, "Sankt ") : "";
}

/** Ein englischer Städtename, falls es einer ist. */
function englischUebersetzen(text: string): string {
  return ENGLISCHE_NAMEN.get(text.trim().toLowerCase()) ?? "";
}

/**
 * Das erste Wort — die letzte, gröbste Schreibweise.
 *
 * ── Warum sie eine Untergrenze braucht ────────────────────────
 *
 * “St. Ingbert” hätte hier “St.” ergeben, und das steht als Präfix
 * vor jedem “St. Anna-Hospital” der Postleitzahlenliste. Eine
 * Abkürzung mit Punkt oder ein Wort unter drei Zeichen ist kein
 * Ortsname, sondern ein Anfang.
 */
function kopfWort(text: string): string {
  const kopf = text.split(/[\s-]/)[0] ?? "";
  if (kopf.endsWith(".") || kopf.length < 3) return "";
  return kopf;
}

export interface Referenzort {
  name: string;
  nameNorm: string;
  /** Das Bundesland. */
  region: string | null;
  /** Der Landkreis, ohne das Wort “Landkreis”. */
  kreis: string | null;
  plz: string | null;
  latitude: number;
  longitude: number;
  plzAnzahl: number;
}

export interface Aufloesung {
  status: Geostatus;
  latitude: number | null;
  longitude: number | null;
  stadt: string | null;
  plz: string | null;
  region: string | null;
  genauigkeit: Genauigkeit | null;
  quelle: string | null;
  /** Wie viele Kandidaten in Frage kamen. Über 1 heisst mehrdeutig. */
  kandidaten: number;
}

const OHNE_TREFFER: Aufloesung = {
  status: "not_found",
  latitude: null,
  longitude: null,
  stadt: null,
  plz: null,
  region: null,
  genauigkeit: null,
  quelle: null,
  kandidaten: 0,
};

/**
 * Ab welcher Streuung mehrere Kandidaten wirklich mehrdeutig sind.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Regel nötig wurde
 * ══════════════════════════════════════════════════════════════
 *
 * Die Quelle führt Hamburg unter zwei Bundesländern: 401 Zeilen unter
 * “Hamburg”, 15 unter “Schleswig-Holstein”. Beide meinen Hamburg —
 * ein paar Postleitzahlgebiete reichen über die Landesgrenze.
 *
 * Eine Regel, die nur Namen zählt, nennt die zweitgrösste Stadt des
 * Landes mehrdeutig und liefert für sie keine Koordinate. Das ist
 * formal korrekt und praktisch unbrauchbar.
 *
 * Mehrdeutig ist eine Angabe erst, wenn die Wahl das Ergebnis ändert.
 * Liegen alle Kandidaten dicht beieinander, ändert sie nichts, und
 * der Mittelpunkt ist so gut wie jeder einzelne. Liegen sie 600 km
 * auseinander — Bernau in Brandenburg und Bernau in Baden-Württemberg
 * — ändert sie alles.
 *
 * ── Woher die Zahl kommt ──────────────────────────────────────
 *
 * Nirgendwoher. Zwanzig Kilometer ist eine Produktentscheidung, kein
 * Messwert: klein genug, dass der Fehler innerhalb einer Stadt
 * bleibt, gross genug für ein Stadtgebiet wie Hamburg oder Berlin.
 * Sie ist nicht gegen Nutzerurteile validiert.
 *
 * Bei einem Suchradius von 30 km kann ein Punkt, der um 20 km danebe
 * liegt, eine Stelle an der Grenze falsch einordnen. Deshalb trägt
 * das Ergebnis `genauigkeit: "region"` statt `"stadt"` — die
 * Ungenauigkeit steht am Befund, nicht nur in diesem Kommentar.
 */
export const ORTSSTREUUNG_MAX_KM = 20;

const ERDRADIUS_KM = 6371;

export function entfernungKm(aB: number, aL: number, bB: number, bL: number): number {
  const bog = Math.PI / 180;
  const dB = (bB - aB) * bog;
  const dL = (bL - aL) * bog;
  const h =
    Math.sin(dB / 2) ** 2 + Math.cos(aB * bog) * Math.cos(bB * bog) * Math.sin(dL / 2) ** 2;
  return 2 * ERDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Der grösste Abstand zwischen zwei Kandidaten. */
function streuungKm(orte: readonly Referenzort[]): number {
  let max = 0;
  for (let i = 0; i < orte.length; i++) {
    for (let j = i + 1; j < orte.length; j++) {
      const a = orte[i]!;
      const b = orte[j]!;
      max = Math.max(max, entfernungKm(a.latitude, a.longitude, b.latitude, b.longitude));
    }
  }
  return max;
}

/**
 * Aus mehreren dicht beieinander liegenden Kandidaten einen Punkt.
 *
 * Gibt `null` zurück, wenn sie zu weit auseinander liegen — dann ist
 * die Angabe wirklich mehrdeutig und es wird nicht gewählt.
 */
function zusammenfassen(orte: readonly Referenzort[], quelle: string): Aufloesung | null {
  if (orte.length === 0) return null;
  if (orte.length === 1) return treffer(orte[0]!, quelle, 1);

  const streuung = streuungKm(orte);
  if (streuung > ORTSSTREUUNG_MAX_KM) return null;

  const b = orte.reduce((n, o) => n + o.latitude, 0) / orte.length;
  const l = orte.reduce((n, o) => n + o.longitude, 0) / orte.length;
  const erst = orte[0]!;
  return {
    status: "resolved_city",
    latitude: b,
    longitude: l,
    stadt: erst.name,
    plz: null,
    region: erst.region,
    /* Ein Mittelpunkt aus mehreren Kandidaten ist gröber als eine
       Stadtkoordinate. Das steht hier, damit es nicht verlorengeht. */
    genauigkeit: "region",
    quelle,
    kandidaten: orte.length,
  };
}

/**
 * Ob die Angabe hinter dem Ort auf diese Referenzzeile passt.
 *
 * Sie kann ein Bundesland sein oder ein Kreis — die Anzeige sagt
 * nicht, welches. “Karlsruhe, Baden-Württemberg” nennt das Land,
 * “Bernau bei Berlin, Barnim (Kreis)” den Kreis, und beide Formen
 * stehen im selben Bestand.
 */
function regionPasst(r: Referenzort, gesucht: string): boolean {
  if (r.region !== null && ortNormalisieren(r.region) === gesucht) return true;
  if (r.kreis !== null && ortNormalisieren(r.kreis) === gesucht) return true;
  return false;
}

function treffer(r: Referenzort, quelle: string, anzahl: number): Aufloesung {
  return {
    status: "resolved_city",
    latitude: r.latitude,
    longitude: r.longitude,
    stadt: r.name,
    plz: r.plz,
    region: r.region,
    genauigkeit: "stadt",
    quelle,
    kandidaten: anzahl,
  };
}

/**
 * Namen, die mit der Anfrage anfangen — an einer Wortgrenze.
 *
 * ── Warum der Bindestrich keine Grenze ist ────────────────────
 *
 * “Frankfurt” soll “Frankfurt am Main” und “Frankfurt (Oder)” finden,
 * denn beide sind gemeint sein könnende Kandidaten und die Anzeige
 * schreibt oft nur den kurzen Namen. “Baden” soll “Baden-Baden” NICHT
 * finden — das ist eine andere Stadt, keine ausgeschriebene Form.
 */
function nameBeginntMit(nameNorm: string, anfrageNorm: string): boolean {
  if (!nameNorm.startsWith(anfrageNorm)) return false;
  if (nameNorm.length === anfrageNorm.length) return true;
  return nameNorm[anfrageNorm.length] === " ";
}

/**
 * Aus zerlegter Angabe und Referenzorten eine Koordinate machen.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Reihenfolge, und warum sie so ist
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Postleitzahl        eindeutig, genauer als jeder Name
 *   2. Name und Region     unterscheidet gleichnamige Orte
 *   3. Name allein         nur, wenn er eindeutig ist
 *   4. Ausgeschriebene Form  “Frankfurt” → “Frankfurt am Main”
 *   5. Übergeordneter Ort  “Moabit, Berlin” → Berlin
 *
 * Schritt 3 und 4 sind die, an denen man Mehrdeutigkeit verliert, wenn
 * man nicht aufpasst. Zwischen Frankfurt am Main und Frankfurt (Oder)
 * liegen fünfhundert Kilometer; wer hier den ersten Treffer nimmt,
 * rechnet in der Hälfte der Fälle mit dem falschen Punkt.
 *
 * ── Was Schritt 3 bewusst NICHT prüft ─────────────────────────
 *
 * Ob es neben dem exakt gleichnamigen Ort noch ausgeschriebene Formen
 * gibt. “Neustadt” gibt es genau einmal so — in Thüringen — daneben
 * aber zwanzig Neustadt-an-der-Irgendwas. Der exakte Name gewinnt,
 * weil die Anzeige genau ihn geschrieben hat. Das ist eine Entscheidung
 * mit Restrisiko und keine Messung: Meint die Anzeige Neustadt an der
 * Weinstrasse und schreibt nur “Neustadt”, liegt der Punkt falsch.
 */
export function ortAufloesen(teile: Ortsteile, referenz: readonly Referenzort[]): Aufloesung {
  if (!teile.brauchbar) return { ...OHNE_TREFFER, status: "invalid_input" };

  /* ── 1. Postleitzahl ─────────────────────────────────────── */
  if (teile.plz) {
    const nachPlz = referenz.filter((r) => r.plz === teile.plz);
    if (nachPlz.length > 0) {
      const r = nachPlz[0]!;
      return {
        status: "resolved_exact",
        latitude: r.latitude,
        longitude: r.longitude,
        stadt: r.name,
        plz: r.plz,
        region: r.region,
        genauigkeit: "plz",
        quelle: "geonames_plz",
        kandidaten: nachPlz.length,
      };
    }
  }

  const regionNorm = teile.region ? ortNormalisieren(teile.region) : null;

  /*
   * Ab hier zählen nur die Mittelpunktzeilen — die ohne Postleitzahl.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum, und was die erste Fassung damit kaputtmachte
   * ══════════════════════════════════════════════════════════════
   *
   * Die Referenz führt jede Stadt doppelt: einmal je Postleitzahl und
   * einmal als Mittelpunkt über alle. Berlin sind 190 Zeilen, deren
   * äusserste vierzig Kilometer auseinander liegen.
   *
   * Die Streuungsregel las diese vierzig Kilometer als “mehrere
   * Kandidaten, weit auseinander” und erklärte Berlin für mehrdeutig.
   * Gemessen: Die Abdeckung fiel von 84,4 % auf 56,8 %, die
   * Mehrdeutigen stiegen von 62 auf 311.
   *
   * Der Denkfehler war, zwei verschiedene Dinge in einen Topf zu
   * werfen. Zwei Postleitzahlen derselben Stadt sind kein Zweifel
   * darüber, welche Stadt gemeint ist. Zwei gleichnamige Städte in
   * verschiedenen Kreisen sind genau das.
   *
   * Die Postleitzahlzeilen bleiben in der Referenz — Schritt 1
   * braucht sie, und dort sind sie das Genaueste, was es gibt.
   */
  const orte = referenz.filter((r) => r.plz === null);

  /*
   * Der übergeordnete Ort wird vorab gesucht, nicht erst am Ende.
   *
   * ── Warum die Reihenfolge geändert wurde ────────────────────
   *
   * “Lichtenberg, Berlin” steht an 14 Stellen im Bestand. Lichtenberg
   * gibt es in Bayern und in Sachsen, also erklärte die erste Fassung
   * die Angabe für mehrdeutig — obwohl “Berlin” dahinterstand und die
   * Frage längst beantwortet war.
   *
   * Ein Berliner Bezirk, dessen Stadt danebensteht, ist nicht
   * mehrdeutig. Er ist ungenauer, und das sagt `genauigkeit`.
   */
  const umgebend = regionNorm
    ? zusammenfassen(
        orte.filter((r) => r.nameNorm === regionNorm),
        "geonames_ort_umgebend",
      )
    : null;

  for (const variante of teile.varianten) {
    const norm = ortNormalisieren(variante);
    if (norm.length < 2) continue;

    const exakt = orte.filter((r) => r.nameNorm === norm);

    /* ── 2. Name und Bundesland oder Kreis ─────────────────── */
    if (exakt.length > 0 && regionNorm) {
      const passend = exakt.filter((r) => regionPasst(r, regionNorm));
      const zusammen = zusammenfassen(passend, "geonames_ort");
      if (zusammen) return zusammen;
    }

    /* ── 3. Name allein ────────────────────────────────────── */
    if (exakt.length > 0) {
      const zusammen = zusammenfassen(exakt, "geonames_ort");
      if (zusammen) return zusammen;
      /* Wirklich weit auseinander — aber die Stadt dahinter zählt. */
      if (umgebend) return umgebend;
      return {
        ...OHNE_TREFFER,
        status: "ambiguous",
        stadt: variante,
        kandidaten: new Set(exakt.map((r) => `${r.region ?? ""}|${r.kreis ?? ""}`)).size,
      };
    }

    /* ── 4. Ausgeschriebene Form ───────────────────────────── */
    const beginnend = orte.filter((r) => nameBeginntMit(r.nameNorm, norm));
    if (beginnend.length === 0) continue;

    if (regionNorm) {
      const passend = beginnend.filter((r) => regionPasst(r, regionNorm));
      const namen = new Set(passend.map((r) => r.nameNorm));
      if (namen.size === 1) {
        const zusammen = zusammenfassen(passend, "geonames_ort_lang");
        if (zusammen) return zusammen;
      }
    }

    const zusammen = zusammenfassen(beginnend, "geonames_ort_lang");
    if (zusammen) return zusammen;
    if (umgebend) return umgebend;
    return {
      ...OHNE_TREFFER,
      status: "ambiguous",
      stadt: variante,
      kandidaten: new Set(beginnend.map((r) => r.nameNorm)).size,
    };
  }

  /* ── 5. Übergeordneter Ort ───────────────────────────────── */
  /*
   * “Moabit, Berlin” — der Bezirk steht in keiner
   * Postleitzahlenliste, die Stadt dahinter schon. Der Punkt wird
   * dadurch ungenauer, aber er liegt in der richtigen Stadt; für
   * einen Umkreis von dreissig Kilometern ist das brauchbar und
   * ehrlich benannt.
   */
  return umgebend ?? OHNE_TREFFER;
}
