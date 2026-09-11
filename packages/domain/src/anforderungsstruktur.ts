/**
 * ══════════════════════════════════════════════════════════════════
 * Eine Stellenanzeige als Struktur, nicht als Stichprobe
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Der Engpass, den diese Datei behebt ─────────────────────────
 *
 * Die alte Extraktion liess eine Zeile nur durch, wenn sie eines von
 * sieben Wörtern enthielt — „erfahrung", „kenntnis", „abschluss",
 * „sprach", „fuehrerschein", „sicher im", „bereitschaft". „Sie
 * kommissionieren Waren und bedienen Flurförderzeuge" enthält keines.
 *
 * Gemessen am 11.09.2026: Von 120 Logistikanzeigen hatte **keine
 * einzige** zwei oder mehr prüfbare Muss-Anforderungen. Nicht, weil
 * die Anzeigen nichts sagen, sondern weil die Extraktion nur eine
 * Sorte Satz gesehen hat.
 *
 * ── Die Trennung, auf die es ankommt ────────────────────────────
 *
 * **Eine Tätigkeit ist keine Anforderung.**
 *
 * „Sie bedienen einen Scanner" sagt, was der Job ist. Es sagt nicht,
 * dass jemand Scannergebrauch nachweisen muss. Wer daraus eine
 * Muss-Anforderung macht, erfindet eine Hürde, die die Anzeige nicht
 * aufgestellt hat — und schliesst Menschen aus, die eingeladen wären.
 *
 * Erst wenn die Anzeige ausdrücklich Erfahrung, Kenntnisse oder einen
 * Nachweis verlangt, entsteht eine Anforderung.
 *
 * ── Und die zweite ──────────────────────────────────────────────
 *
 * **Unklar ist ein Ergebnis.** „Idealerweise SAP" ist kein Muss.
 * „SAP" allein in einer Aufzählung ohne Überschrift ist auch keins —
 * es ist unklar. Erfundene Präzision an dieser Stelle kostet Menschen
 * Bewerbungen.
 */

/** Die Fassung der Extraktion. Ändert sich, wenn sich die Regeln ändern. */
export const EXTRAKTIONSFASSUNG = "anforderung-2";

export const ANFORDERUNGSKATEGORIEN = [
  /** Was im Job getan wird. Keine Hürde. */
  "TASK",
  /** Eine fachliche Fähigkeit, die verlangt wird. */
  "MUST_SKILL",
  /** Eine fachliche Fähigkeit, die gewünscht wird. */
  "NICE_SKILL",
  /** Abschluss, Schein, Zertifikat. */
  "QUALIFICATION",
  /** Berufserfahrung, mit oder ohne Domäne. */
  "EXPERIENCE",
  /** Ein benanntes Werkzeug oder System. */
  "TOOL",
  /** Eine Sprache. */
  "LANGUAGE",
  /** Verantwortung für Menschen, Budget oder Ergebnis. */
  "RESPONSIBILITY",
  /** Schicht, Wochenende, Reise, Ort — gehört in die Bedingungskette. */
  "WORK_CONDITION",
  /** Führerschein, Zulassung, Führungszeugnis, Gesundheitsnachweis. */
  "LEGAL_REQUIREMENT",
  /** Erkannt, aber nicht einzuordnen. */
  "UNKNOWN",
] as const;
export type Anforderungskategorie = (typeof ANFORDERUNGSKATEGORIEN)[number];

/** Ob die Anzeige es verlangt, wünscht — oder es nicht sagt. */
export const VERBINDLICHKEITEN = ["muss", "wunsch", "unklar"] as const;
export type Verbindlichkeit = (typeof VERBINDLICHKEITEN)[number];

/** In welchem Abschnitt der Anzeige eine Zeile steht. */
export const ABSCHNITTE = ["aufgaben", "profil", "wunsch", "angebot", "unbekannt"] as const;
export type Abschnitt = (typeof ABSCHNITTE)[number];

export interface Strukturierte {
  /** Der Satz, wie er in der Anzeige steht. Unverändert. */
  original: string;
  /** Worum es geht, ohne Beiwerk. Für den Abgleich. */
  bedeutung: string;
  kategorie: Anforderungskategorie;
  verbindlichkeit: Verbindlichkeit;
  /** Das Wort, an dem die Verbindlichkeit hängt. `null` heisst: keins. */
  belegstelle: string | null;
  /** 0–100. Worauf die Verbindlichkeitsbefund beruht, nicht wie wahr sie ist. */
  konfidenz: number;
  abschnitt: Abschnitt;
  /** Bei EXPERIENCE: worin. `null` heisst unbekannt — nie „egal". */
  erfahrungsfeld: string | null;
  /** Bei EXPERIENCE: wie lange, in den Worten der Anzeige. */
  erfahrungsmass: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   Überschriften
   ═══════════════════════════════════════════════════════════════ */

const UEBERSCHRIFT: readonly [RegExp, Abschnitt][] = [
  [/^(deine|ihre|das sind deine|zu (deinen|ihren))?\s*(aufgaben|taetigkeiten|tätigkeiten|das erwartet (dich|sie)|dein arbeitsalltag|womit du dich beschäftigst|deine aufgaben als)\b/i, "aufgaben"],
  [/^(das\s+)?(bringst du mit|bringen sie mit|erwarten wir|dein profil|ihr profil|anforderungen|qualifikation(en)?|das solltest du mitbringen|damit überzeugst du uns|was (du|sie) mitbring|was solltest du mitbringen|dein können|ihre qualifikation)\b/i, "profil"],
  [/^(das\s+)?(waere|wäre)?\s*(von vorteil|wünschenswert|schoen|schön|ideal|nice to have|zusätzlich)\b/i, "wunsch"],
  /*
   * ── Der Angebotsblock, in allen Formen ──────────────────────────
   *
   * Gemessen an echten Anzeigen: „Was wir Ihnen bieten:" beendete den
   * Profilblock NICHT, weil das Muster nur „(das) bieten wir" kannte.
   * Danach lief die Extraktion mit `abschnitt = "profil"` weiter, und
   * jede Zeile bis zum Ende der Anzeige wurde zu einer
   * Muss-Anforderung — einschliesslich „Urlaubs- und Weihnachtsgeld"
   * und „Bewerben Sie sich doch gleich".
   *
   * Das ist die gefährlichste Fehlerquelle dieser Datei: Sie erzeugt
   * Pflichten aus Zusagen.
   */
  [/^(das\s+)?(bieten wir|erwartet dich bei uns|wir bieten|deine vorteile|ihre vorteile|benefits|unser angebot|was wir (dir|ihnen|euch)?\s*bieten|was wir bieten|darauf (kannst|können) (du|sie) sich freuen|wir bieten (dir|ihnen))\b/i, "angebot"],
  /*
   * Schlussblöcke. Ab hier steht in Anzeigen nichts mehr über die
   * Arbeit — nur noch, wie man sich bewirbt.
   */
  [/^(ihr weg zu uns|dein weg zu uns|interessiert|haben wir dein interesse|bewerbung|so bewirbst du dich|kontakt|ansprechpartner|über uns|wir über uns|unser unternehmen)\b/i, "angebot"],
];

/** Welcher Abschnitt hier beginnt — oder `null`, wenn es keine Überschrift ist. */
export function abschnittWechsel(zeile: string): Abschnitt | null {
  const z = zeile.trim();
  /* Eine Überschrift ist kurz und trägt selten einen Satzpunkt. */
  if (z.length > 70) return null;
  for (const [muster, abschnitt] of UEBERSCHRIFT) {
    if (muster.test(z)) return abschnitt;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Verbindlichkeit
   ═══════════════════════════════════════════════════════════════ */

const WUNSCHWORTE: readonly [RegExp, string][] = [
  [/idealerweise/i, "idealerweise"],
  [/von\s+vorteil/i, "von Vorteil"],
  [/wuenschenswert|wünschenswert/i, "wünschenswert"],
  [/nice\s*to\s*have/i, "nice to have"],
  [/gerne\s+auch|gern\s+auch/i, "gerne auch"],
  [/(waere|wäre)\s+(ein\s+)?(plus|bonus)/i, "wäre ein Plus"],
  [/kein\s+muss/i, "kein Muss"],
  [/nicht\s+zwingend/i, "nicht zwingend"],
  [/von\s+(gro(ss|ß)em\s+)?vorteil/i, "von Vorteil"],
  [/optional/i, "optional"],
];

const MUSSWORTE: readonly [RegExp, string][] = [
  [/zwingend\s+(erforderlich|notwendig|vorausgesetzt)/i, "zwingend erforderlich"],
  [/unabdingbar|unerl(ae|ä)sslich/i, "unabdingbar"],
  /*
   * Beide Wortstellungen. „Voraussetzung ist ein gültiger
   * Staplerschein" ist die häufigere in echten Anzeigen und fiel
   * durch, weil das Muster nur „ist Voraussetzung" kannte — der
   * Eintrag landete dann auf dem Abschnitt statt auf dem Wort.
   */
  [/(ist|sind)\s+voraussetzung/i, "ist Voraussetzung"],
  [/^voraussetzung(en)?\b/i, "Voraussetzung"],
  [/voraussetzung(en)?\s+(ist|sind|f(ue|ü)r)/i, "Voraussetzung"],
  [/setzen\s+wir\s+voraus|setzt\s+voraus|vorausgesetzt/i, "setzen wir voraus"],
  [/zwingend/i, "zwingend"],
  [/erforderlich|notwendig/i, "erforderlich"],
  [/\bmuss\b|\bmüssen\b|\bmuessen\b/i, "muss"],
  [/verf(ue|ü)gen\s+(sie|du)?\s*(ueber|über)/i, "verfügen über"],
];

export interface Verbindlichkeitsbefund {
  verbindlichkeit: Verbindlichkeit;
  belegstelle: string | null;
  konfidenz: number;
}

/**
 * Verlangt oder gewünscht — oder nicht gesagt.
 *
 * ── Warum der Wunsch vor dem Muss geprüft wird ──────────────────
 *
 * Weil „Erfahrung mit SAP ist zwingend von Vorteil" existiert, und
 * weil der Fehler in dieser Richtung teurer ist. Eine fälschlich als
 * Wunsch gelesene Pflicht kostet eine Bewerbung, die vielleicht
 * scheitert. Eine fälschlich als Pflicht gelesene Bitte kostet eine
 * Bewerbung, die nie geschrieben wird.
 *
 * ── Warum der Abschnitt nur zählt, wenn das Wort schweigt ───────
 *
 * Eine Zeile unter „Das wäre zusätzlich schön" ohne eigenes Signal
 * ist ein Wunsch — das ist eine solide Ableitung (70). Dieselbe Zeile
 * im Profilblock ist ein Muss, aber nur mit 60: Anzeigen mischen
 * dort, und „Teamfähigkeit" steht neben „Staplerschein".
 */
export function verbindlichkeitAus(zeile: string, abschnitt: Abschnitt): Verbindlichkeitsbefund {
  const wunsch = WUNSCHWORTE.find(([r]) => r.test(zeile));
  if (wunsch) return { verbindlichkeit: "wunsch", belegstelle: wunsch[1], konfidenz: 90 };

  const muss = MUSSWORTE.find(([r]) => r.test(zeile));
  if (muss) return { verbindlichkeit: "muss", belegstelle: muss[1], konfidenz: 95 };

  if (abschnitt === "wunsch") {
    return { verbindlichkeit: "wunsch", belegstelle: "Abschnitt „Wünschenswert“", konfidenz: 70 };
  }
  if (abschnitt === "profil") {
    return { verbindlichkeit: "muss", belegstelle: "Abschnitt „Ihr Profil“", konfidenz: 60 };
  }
  /*
   * Ohne Signalwort und ohne Abschnitt: unklar. Nicht „muss" — eine
   * erfundene Pflicht schliesst Menschen aus, die eingeladen wären.
   */
  return { verbindlichkeit: "unklar", belegstelle: null, konfidenz: 30 };
}

/* ═══════════════════════════════════════════════════════════════
   Kategorie
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sätze, die beschreiben, was getan wird.
 *
 * Zweite Person Plural oder Singular mit einem Tätigkeitsverb, oder
 * ein Satz, der mit einem Substantiv im Aufgabenblock steht. Deutsch
 * macht das erkennbar: „Sie kommissionieren", „Du bedienst", „Zu
 * Ihren Aufgaben gehört".
 */
const TAETIGKEITSMUSTER: readonly RegExp[] = [
  /^(sie|du)\s+[a-zäöüß]+(en|st)\b/i,
  /^(zu\s+(ihren|deinen)\s+aufgaben)/i,
  /^(die\s+)?(bedienung|kommissionierung|bearbeitung|durchf(ue|ü)hrung|erstellung|pflege|steuerung|koordination|abwicklung|kontrolle|verbuchung|annahme|verladung|be-\s*und\s*entladung)\b/i,
  /\b(sie|du)\s+(uebernehmen|übernehmen|uebernimmst|übernimmst|verantworten|verantwortest|betreuen|betreust)\b/i,
];

/** Wörter, mit denen eine Anzeige einen Nachweis verlangt statt eine Tätigkeit nennt. */
const FORDERWORTE =
  /\b(erfahrung|erfahrungen|kenntnis|kenntnisse|routine|sicher(er|e|en)?\s+umgang|beherrsch|vertraut\s+mit|versiert|fundiert|nachweis|nachweislich|abschluss|ausbildung|qualifikation|befaehigung|befähigung|schein|zertifikat|lizenz|berechtigung)\b/i;

/*
 * ══════════════════════════════════════════════════════════════════
 * Warum hier fast überall die hintere Wortgrenze fehlt
 * ══════════════════════════════════════════════════════════════════
 *
 * Deutsch bildet Komposita. `\bdeutsch\b` trifft „Deutschkenntnisse"
 * nicht, `\bschicht\b` nicht „Schichtbetrieb", `\bstapler\b` nicht
 * „Staplerschein". Gemessen an einer Stichprobe aus hundert echten
 * Anzeigen war das die häufigste Einzelursache falscher Kategorien:
 * Sprachanforderungen landeten als Tätigkeit, Schichtbereitschaft als
 * Unbekannt.
 *
 * Derselbe Fehler wie im Fähigkeitskatalog und im Signalmuster — dort
 * beim dritten Mal erkannt. Die Grenze steht deshalb nur vorn.
 */
const QUALIFIKATION = /\b(abschluss|ausbildung|studium|berufsausbildung|weiterbildung|meister|techniker|bachelor|master|zertifik|qualifikation|schulabschluss|umschulung)/i;
const RECHTLICH = /\b(f(ue|ü)hrerschein|fahrerlaubnis|klasse\s*[a-z]{1,2}\d?|staplerschein|gabelstaplerschein|kranschein|f(ue|ü)hrungszeugnis|gesundheitszeugnis|arbeitserlaubnis|approbation|sachkundenachweis|adr-schein|g\s?25|nachweis der)/i;
const SPRACHE = /\b(deutschkenntnis|englischkenntnis|sprachkenntnis|sprachniveau|deutsch|englisch|franz(oe|ö)sisch|spanisch|italienisch|polnisch|t(ue|ü)rkisch|[abc][12]-niveau|english skills)/i;
const WERKZEUG = /\b(sap|erp|ms[- ]?office|excel|outlook|word|lagerverwaltungssystem|lvs|wms|scanner|mde|warenwirtschaft|edv|it-system|software)/i;
const VERANTWORTUNG = /\b(f(ue|ü)hrungsverantwortung|f(ue|ü)hrung\s+(von|eines)|verantwortung\s+f(ue|ü)r|budgetverantwortung|disziplinarisch|teamleitung|schichtleitung|anleitung\s+von)/i;
const BEDINGUNG = /\b(schicht|nachtarbeit|wochenend|samstag|sonntag|bereitschaft|reisebereit|au(ss|ß)endienst|homeoffice|remote|vollzeit|teilzeit|befristet|unbefristet|stundenlohn|arbeitstage|arbeitszeit)/i;
const ERFAHRUNG = /\b(berufserfahrung|erfahrung|mehrj(ae|ä)hrig|einschl(ae|ä)gig)/i;

/**
 * Welche Kategorie eine Zeile trägt.
 *
 * ── Die Reihenfolge ist die Aussage ─────────────────────────────
 *
 * Arbeitsbedingungen zuerst: „Bereitschaft zur Schichtarbeit" steht
 * im Profilblock und sieht aus wie eine Anforderung. Sie ist keine —
 * sie gehört in die andere Kette, und dort wird sie gegen das
 * geprüft, was der Mensch über sein Leben gesagt hat.
 *
 * Dann das Rechtliche, weil ein Staplerschein kein „Skill" ist,
 * sondern ein Papier. Dann Sprache, Qualifikation, Verantwortung.
 *
 * Die Tätigkeit steht VOR den Fähigkeiten — aber nur, wenn kein
 * Forderwort dasteht. „Sie bedienen Flurförderzeuge" ist eine
 * Tätigkeit; „Sie bedienen Flurförderzeuge — Erfahrung erforderlich"
 * ist eine Anforderung.
 */
export function kategorisieren(
  zeile: string,
  abschnitt: Abschnitt,
  verbindlichkeit: Verbindlichkeit,
): Anforderungskategorie {
  if (BEDINGUNG.test(zeile)) return "WORK_CONDITION";
  if (RECHTLICH.test(zeile)) return "LEGAL_REQUIREMENT";
  if (SPRACHE.test(zeile)) return "LANGUAGE";
  if (QUALIFIKATION.test(zeile)) return "QUALIFICATION";

  const fordert = FORDERWORTE.test(zeile);

  /*
   * Tätigkeit vor Fähigkeit — und nur ohne Forderwort.
   *
   * Das ist die Regel, an der die ganze Trennung hängt: Was der Job
   * IST, ist keine Hürde. Wer „Sie bedienen einen Scanner" zu
   * „Scannergebrauch sicher" macht, erfindet eine Anforderung.
   */
  /*
   * Eine genannte Eigenschaft ist keine Tätigkeit und keine
   * Anforderung. „Zuverlässigkeit" unter „Ihre Aufgaben" wurde sonst
   * zu einer Aufgabe, die niemand ausführt.
   */
  if (istEigenschaft(zeile)) return "UNKNOWN";

  if (!fordert && TAETIGKEITSMUSTER.some((m) => m.test(zeile.trim()))) return "TASK";
  if (!fordert && abschnitt === "aufgaben") return "TASK";

  if (VERANTWORTUNG.test(zeile)) return "RESPONSIBILITY";
  if (ERFAHRUNG.test(zeile)) return "EXPERIENCE";
  if (WERKZEUG.test(zeile)) return "TOOL";

  if (fordert) return verbindlichkeit === "wunsch" ? "NICE_SKILL" : "MUST_SKILL";
  return "UNKNOWN";
}

/* ═══════════════════════════════════════════════════════════════
   Erfahrung
   ═══════════════════════════════════════════════════════════════ */

const MASSE: readonly [RegExp, string][] = [
  [/mehrj(ae|ä)hrig/i, "mehrjährig"],
  [/(\d{1,2})\s*(\+|bis\s*\d{1,2})?\s*jahre?/i, "in Jahren genannt"],
  [/erste\s+(berufs)?erfahrung/i, "erste Erfahrung"],
  [/einschl(ae|ä)gig/i, "einschlägig"],
];

/**
 * Worin und wie lange.
 *
 * ── Warum `null` und nicht „egal" ───────────────────────────────
 *
 * „Mehrjährige Erfahrung erforderlich" ohne Bezug ist eine Aussage
 * über nichts. Sie gegen beliebige Berufsjahre zu prüfen hiesse,
 * jemanden an einer Zahl zu messen, die die Anzeige nie gemeint hat.
 * Unbekannt bleibt unbekannt.
 */
export function erfahrungAus(zeile: string): { feld: string | null; mass: string | null } {
  const mass = MASSE.find(([r]) => r.test(zeile))?.[1] ?? null;

  /* „Erfahrung in der Disposition", „Erfahrung mit SAP", „Erfahrung im Lager" */
  const bezug = zeile.match(
    /erfahrung(?:en)?\s+(?:in\s+der\s+|in\s+dem\s+|im\s+|in\s+|mit\s+|als\s+|bei\s+der\s+|bei\s+)([a-zäöüß0-9/\- ]{3,42})/i,
  );
  const feld = bezug?.[1]?.trim().replace(/\s+(von|und|sowie|oder)\s*$/i, "").trim() ?? null;

  return { feld: feld && feld.length >= 3 ? feld : null, mass };
}

/**
 * Der Satz ohne Beiwerk.
 *
 * Aufzählungszeichen, Wunsch- und Mussfloskeln und die üblichen
 * Höflichkeiten fallen weg. Was bleibt, ist das, wogegen verglichen
 * wird — der Originalsatz bleibt daneben stehen.
 */
export function bedeutungAus(zeile: string): string {
  return zeile
    .replace(/^[-•·*–]\s*/, "")
    .replace(/\b(idealerweise|w(ue|ü)nschenswert|von\s+vorteil|zwingend\s+erforderlich|zwingend|erforderlich|nice\s*to\s*have|optional|gerne\s+auch)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;:\s]+|[,;:\s]+$/g, "")
    .trim();
}

/** Ob aus dieser Zeile überhaupt etwas entstehen soll. */
export function zeileTaugt(zeile: string): boolean {
  const z = zeile.trim();
  if (z.length < 8 || z.length > 240) return false;
  /*
   * Ein einzelnes Wort ist keine Anforderung.
   *
   * „Sonstiges", „Qualifikationen", „Weiteres" stehen in Anzeigen als
   * Zwischenüberschriften, die keine der bekannten Formen trifft. Als
   * Anforderung gezählt stünden sie später in der Liste, die ein
   * Mensch liest.
   */
  if (z.split(/\s+/).length < 2) return false;
  /* Reine Aufzählung von Benefits, Firmenwerbung, Kontaktzeilen. */
  if (/^(wir\s+(sind|bieten|freuen)|bewerbung|kontakt|ansprechpartner|schwerbehinderte|https?:)/i.test(z)) {
    return false;
  }
  /*
   * ── Firmenwerbung und Bewerbungshinweise ──────────────────────
   *
   * Sie stehen mitten im Text, tragen keinen Aufzählungspunkt und
   * sehen aus wie Sätze über die Arbeit. Gemessen: In einer Anzeige
   * kamen so achtzehn Einträge zustande, von denen keiner eine
   * Anforderung war — darunter „Bewerben Sie sich doch gleich."
   */
  const RAUSCHEN: readonly RegExp[] = [
    /\b(gmbh|ag|kg|se|e\.?k\.?)\b.{0,40}\b(gehoert|gehört|ist|sind|zaehlt|zählt)\b/i,
    /^(werde|werden sie|werde teil|herzlich willkommen|willkommen bei)/i,
    /\b(bewerben sie sich|bewirb dich|bewerbung(sunterlagen)?|lebenslauf|online-bewerbung|per e-?mail|freuen uns auf)\b/i,
    /\b(personaldienstleist|zeitarbeit unternehmen|marktfuehrer|marktführer|traditionsunternehmen|familienunternehmen seit)\b/i,
    /^(bei (weiteren )?fragen|haben sie fragen|noch fragen)/i,
    /\b(menschen verbinden|leben verbessern)\b/i,
    /^(du|sie) (bist|sind) (wetterfest|zuverl(ae|ä)ssig)/i,
  ];
  if (RAUSCHEN.some((m) => m.test(z))) return false;

  /*
   * Eine Zwischenüberschrift, die keine der bekannten Formen trifft.
   * „Unsere Anforderungen an Sie als Sortierer m/w/d:" endet mit
   * einem Doppelpunkt und ist kurz — als Anforderung gezählt stünde
   * sie später in der Liste, die ein Mensch liest.
   */
  if (z.endsWith(":") && z.length < 70) return false;

  /*
   * Zusagen an den Menschen, nicht Ansprüche an ihn. Sie stehen oft
   * ausserhalb eines erkannten Angebotsblocks — „steuerfreie
   * Zulagen", „Übernahme bei entsprechender Eignung".
   */
  const ZUSAGE =
    /\b(zulage|urlaubsgeld|weihnachtsgeld|pr(ae|ä)mie|zuschuss|rabatt|corporate benefits|mitarbeiterrabatt|betriebliche altersvorsorge|(ue|ü)bernahme bei|persoenliche betreuung|persönliche betreuung|gr(ue|ü)ndliche einarbeitung|kostenlose|wir zahlen|verg(ue|ü)tung nach)\b/i;
  if (ZUSAGE.test(z)) return false;

  return true;
}

/**
 * Zeilen, die nur eine Eigenschaft nennen.
 *
 * „Zuverlässigkeit", „Teamfähigkeit sowie Belastbarkeit", „Motivation
 * & Zuverlässigkeit" — sie stehen in fast jeder Anzeige und lassen
 * sich gegen nichts prüfen. Sie sind weder Tätigkeit noch belegbare
 * Fähigkeit; sie bleiben `UNKNOWN` und damit ohne Verbindlichkeit.
 */
export function istEigenschaft(zeile: string): boolean {
  const z = zeile.trim();
  if (z.length > 90) return false;
  return /\b(zuverl(ae|ä)ssig|teamf(ae|ä)hig|belastbar|motivation|flexibilit(ae|ä)t|sorgfalt|genauigkeit|engagement|eigeninitiative|kommunikationsf(ae|ä)hig|verantwortungsbewusst|verantwortungsgef(ue|ü)hl|strukturierte arbeitsweise|selbst(ae|ä)ndige arbeitsweise|freundlich)/i.test(z)
    && !/\b(erfahrung|kenntnis|schein|abschluss|ausbildung)/i.test(z);
  return /[a-zäöüß]/i.test(z);
}
