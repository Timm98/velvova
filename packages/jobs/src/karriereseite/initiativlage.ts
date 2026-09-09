import type { Fremdinhalt } from "./fremdinhalt.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was die Seite über Initiativbewerbungen sagt
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Schritt, der über alles Weitere entscheidet: Ob ein Arbeitgeber
 * ungefragte Bewerbungen will, steht auf seiner Karriereseite — meist
 * in einem einzigen Satz.
 *
 * ── Warum das ohne Modell geht, und warum es so besser ist ──────
 *
 * Der naive Weg wäre, die Seite einem Modell zu geben. Er ist teurer,
 * langsamer, nicht wiederholbar und — an dieser Stelle — schlechter:
 * Die Sätze sind formelhaft. „Wir freuen uns über Ihre
 * Initiativbewerbung" und „Bitte sehen Sie von Initiativbewerbungen
 * ab" stehen so auf tausend Seiten.
 *
 * Ein Modell gehört an die Stelle, an der ein Satz mehrdeutig ist.
 * Diese Datei beantwortet die eindeutigen Fälle und sagt bei den
 * anderen `unklar` — das ist die ehrliche Antwort und keine Notlösung.
 *
 * ── Die Verneinung ist der ganze Punkt ──────────────────────────
 *
 * Ein Suchen nach dem Wort „Initiativbewerbung" findet die Seite, die
 * sie ausdrücklich ABLEHNT, genauso wie die, die sie erbittet — und
 * bewertet beide gleich. Das ist kein Randfall: Wer Initiativbewerbungen
 * nicht will, schreibt es hin, und zwar mit demselben Wort.
 *
 * Deshalb wird satzweise gelesen. Was im selben Satz steht, gehört
 * zusammen; was zwei Absätze weiter steht, nicht.
 *
 * ── In welche Richtung wir irren ────────────────────────────────
 *
 * Ein Verbot gilt für die ganze Seite, auch wenn es vielleicht nur
 * für einen Bereich gemeint war („Für Ausbildungsplätze können wir
 * keine Initiativbewerbungen berücksichtigen").
 *
 * Das ist absichtlich zu vorsichtig. Der eine Fehler kostet einen
 * Arbeitgeber, der sich gefreut hätte. Der andere schreibt jemanden
 * an, der ausdrücklich nein gesagt hat — und den bekommt man nicht
 * zurück.
 */

export type Initiativlage =
  | "erwuenscht"
  | "erlaubt"
  | "unklar"
  | "unerwuenscht"
  | "ausgeschlossen"
  | "unbekannt";

export interface Initiativbefund {
  lage: Initiativlage;
  /** Die Sätze, auf denen das Urteil beruht. Wörtlich, nicht zusammengefasst. */
  belegsaetze: string[];
  /** Woher sie stammen. */
  quelle: string;
}

/* Das Thema. Ohne eines dieser Wörter sagt ein Satz nichts zur Sache. */
const THEMA = [
  "initiativbewerbung", "initiativbewerbungen", "initiativ",
  "unaufgefordert", "unaufgeforderte", "blindbewerbung",
  "talentpool", "talent pool", "spontanbewerbung",
  "speculative application", "unsolicited application", "spontaneous application",
];

/** „Nein", in den Formeln, in denen es tatsächlich dasteht. */
const ABLEHNUNG = [
  "keine", "nicht", "können wir nicht", "koennen wir nicht",
  "sehen sie bitte ab", "sehen sie ab", "bitten wir, von",
  "bitten wir von", "abzusehen", "abgesehen",
  "werden nicht berücksichtigt", "werden nicht beruecksichtigt",
  "nicht bearbeitet", "nicht möglich", "nicht moeglich",
  "do not accept", "cannot accept", "are not accepted", "no unsolicited",
  "will not be considered",
];

/** „Ja", ebenso. */
const EINLADUNG = [
  "freuen uns", "willkommen", "gerne", "jederzeit", "laden wir ein",
  "senden sie uns", "schicken sie uns", "nehmen wir entgegen",
  "bewerben sie sich", "melden sie sich",
  "we welcome", "feel free", "happy to receive", "we accept", "encouraged",
];

/** Kleinschreibung, Umlaute normalisiert, unsichtbare Zeichen raus. */
function form(text: string): string {
  return text
    .replace(/[­​‌‍⁠﻿]/g, "")
    .toLowerCase();
}

/**
 * In Sätze zerlegen.
 *
 * Zeilenumbrüche zählen wie ein Satzende: Auf Webseiten steht die
 * Aussage oft in einem Listenpunkt ohne Punkt am Ende, und zwei
 * Listenpunkte zusammenzuziehen brächte die Verneinung des einen an
 * die Einladung des anderen.
 */
function saetze(text: string): string[] {
  return text
    .split(/(?<=[.!?:])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const enthaelt = (satz: string, woerter: readonly string[]) =>
  woerter.some((w) => satz.includes(w));

/**
 * Die Lage aus dem Seitentext lesen.
 *
 * Gibt `unbekannt` zurück, wenn das Thema gar nicht vorkommt — nicht
 * `unklar`. Der Unterschied trägt eine Entscheidung: `unbekannt`
 * heisst „nicht nachgesehen oder nichts gefunden" und verbietet den
 * Kontakt; `unklar` heisst „nachgesehen, steht nichts Eindeutiges"
 * und erlaubt eine vorsichtige Anfrage.
 */
export function initiativlageLesen(inhalt: Fremdinhalt): Initiativbefund {
  const treffer = saetze(inhalt.text).filter((s) => enthaelt(form(s), THEMA));

  if (treffer.length === 0) {
    return { lage: "unbekannt", belegsaetze: [], quelle: inhalt.quelle };
  }

  const ablehnend: string[] = [];
  const einladend: string[] = [];
  const neutral: string[] = [];

  for (const satz of treffer) {
    const f = form(satz);
    /*
     * Ablehnung schlägt Einladung IM SELBEN SATZ.
     *
     * „Wir freuen uns über Ihre Bewerbung, Initiativbewerbungen können
     * wir jedoch nicht berücksichtigen" ist ein Nein. Wer hier die
     * Einladung gewinnen liesse, läse das Gegenteil.
     */
    if (enthaelt(f, ABLEHNUNG)) ablehnend.push(satz);
    else if (enthaelt(f, EINLADUNG)) einladend.push(satz);
    else neutral.push(satz);
  }

  if (ablehnend.length > 0) {
    /*
     * Wie hart das Nein ist, entscheidet die Formulierung.
     *
     * „Können nicht berücksichtigt werden" ist eine Tatsache —
     * ausgeschlossen. „Wir bitten, davon abzusehen" ist eine Bitte —
     * unerwünscht. Beide führen dazu, dass nicht geschrieben wird; der
     * Unterschied steht trotzdem da, weil er dem Menschen erklärt
     * wird.
     */
    /*
     * Hier stand nur die Passivform: „werden nicht berücksichtigt".
     *
     * „Initiativbewerbungen können wir nicht berücksichtigen" ist
     * dasselbe Nein in der Aktivform und wurde als blosse Bitte
     * gelesen. Beide Sätze stehen etwa gleich häufig auf deutschen
     * Karriereseiten.
     *
     * Deshalb jetzt über den Wortstamm, mit der Verneinung in der Nähe
     * — bis zu 40 Zeichen davor, damit „können wir jedoch nicht"
     * dazwischen passt, aber kein zweiter Satzteil.
     */
    const hart = ablehnend.some((s) =>
      /(nicht|keine|kein)[^.!?]{0,40}(ber[üu]cksichtig|bearbeite|entgegennehm|annehm|weiterleit)/i.test(s) ||
      /nicht möglich|nicht moeglich|nicht vorgesehen/i.test(s) ||
      /not accepted|will not be considered|do not accept|cannot accept|no unsolicited/i.test(s),
    );
    return {
      lage: hart ? "ausgeschlossen" : "unerwuenscht",
      belegsaetze: ablehnend.slice(0, 3),
      quelle: inhalt.quelle,
    };
  }

  if (einladend.length > 0) {
    return { lage: "erwuenscht", belegsaetze: einladend.slice(0, 3), quelle: inhalt.quelle };
  }

  /*
   * Das Thema kommt vor, ohne Ja und ohne Nein.
   *
   * Etwa eine Überschrift „Initiativbewerbung" über einem Formular.
   * Das ist keine Einladung in Worten, aber auch keine Ablehnung —
   * und ein Formular dafür einzurichten sagt genug für „erlaubt".
   */
  return { lage: "erlaubt", belegsaetze: neutral.slice(0, 3), quelle: inhalt.quelle };
}

/* ══════════════════════════════════════════════════════════════════
   Kontaktwege, die auf der Seite stehen
   ══════════════════════════════════════════════════════════════════ */

export type Kanalart =
  | "initiativformular"
  | "karriereformular"
  | "recruitingadresse"
  | "ansprechpartner"
  | "allgemeiner_kontakt";

export interface Gefundenerkanal {
  art: Kanalart;
  ziel: string;
  /** Die Seite, auf der es stand. Ohne sie wäre der Kanal geraten. */
  belegUrl: string;
}

/**
 * Adressteile, die auf einen Personalbereich zeigen.
 *
 * Die Zuordnung entscheidet über den Rang, nicht über die Gültigkeit:
 * `info@` ist ein echter Kontaktweg, nur ein schlechterer als
 * `bewerbung@`.
 */
const PERSONALTEILE = [
  "bewerbung", "bewerbungen", "karriere", "job", "jobs", "personal",
  "recruiting", "recruitment", "hr", "stellen", "ausbildung", "career", "careers",
];

/**
 * Kontaktwege aus dem HTML lesen.
 *
 * ── Nur, was dasteht ────────────────────────────────────────────
 *
 * Gefunden werden `mailto:`-Verweise und Adressen im sichtbaren Text.
 * NICHT erzeugt werden Adressen nach einem Muster —
 * `vorname.nachname@firma.de` ist eine wahrscheinliche Schreibweise
 * und keine Auskunft, und wer danach schreibt, schreibt an jemanden,
 * der nie gesagt hat, dass er erreichbar sein will.
 *
 * Jeder Fund trägt deshalb `belegUrl`: die Seite, auf der er stand.
 */
export function kontaktkanaeleAusSeite(html: string, seitenUrl: string): Gefundenerkanal[] {
  const gefunden = new Map<string, Gefundenerkanal>();

  const eintragen = (art: Kanalart, ziel: string) => {
    const schluessel = ziel.toLowerCase();
    const vorhanden = gefunden.get(schluessel);
    /* Die genauere Einordnung gewinnt. */
    if (vorhanden && RANG[vorhanden.art] <= RANG[art]) return;
    gefunden.set(schluessel, { art, ziel, belegUrl: seitenUrl });
  };

  /* mailto: — die verlässlichste Fundstelle, weil sie verlinkt ist. */
  for (const t of html.matchAll(/href\s*=\s*(["'])mailto:([^"'?]+)/gi)) {
    const adresse = decodeURIComponent((t[2] ?? "").trim());
    if (!istAdresse(adresse)) continue;
    eintragen(adresseinordnen(adresse), adresse);
  }

  /* Adressen im Text — ohne Verweis, aber veröffentlicht. */
  for (const t of html.replace(/<[^>]*>/g, " ").matchAll(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  )) {
    const adresse = t[0];
    if (!istAdresse(adresse)) continue;
    eintragen(adresseinordnen(adresse), adresse);
  }

  /*
   * Formulare.
   *
   * Ein Formular ist der von der Seite VORGESEHENE Weg und steht
   * deshalb über jeder Adresse. Erkannt wird es am Verweis, nicht am
   * `<form>`-Element: Das Ziel eines Formulars ist eine Adresse, die
   * ein Mensch nicht aufrufen kann.
   */
  for (const t of html.matchAll(/<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = t[2] ?? "";
    const text = form((t[3] ?? "").replace(/<[^>]*>/g, " "));
    if (!/^https?:|^\//.test(href)) continue;

    let ziel: string;
    try {
      ziel = new URL(href, seitenUrl).toString();
    } catch {
      continue;
    }
    const wo = `${text} ${form(href)}`;
    if (/initiativ|talentpool|talent pool|spontanbewerbung|unaufgefordert/.test(wo)) {
      eintragen("initiativformular", ziel);
    } else if (/bewerbungsformular|online.?bewerbung|jetzt bewerben|bewerben sie sich|apply now|application form/.test(wo)) {
      eintragen("karriereformular", ziel);
    }
  }

  return [...gefunden.values()].sort((a, b) => RANG[a.art] - RANG[b.art]);
}

const RANG: Record<Kanalart, number> = {
  initiativformular: 0,
  karriereformular: 1,
  recruitingadresse: 2,
  ansprechpartner: 3,
  allgemeiner_kontakt: 4,
};

function istAdresse(a: string): boolean {
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a)) return false;
  /*
   * Beispiele aus Vorlagen und Bildpfade, die wie Adressen aussehen.
   * `name@example.com` steht in jedem zweiten Impressumsgenerator.
   */
  return !/@(example|test|domain|ihre-?domain|muster)\./i.test(a) && !/\.(png|jpe?g|svg|webp)$/i.test(a);
}

function adresseinordnen(adresse: string): Kanalart {
  const lokal = form(adresse.split("@")[0] ?? "");
  if (PERSONALTEILE.some((t) => lokal.includes(t))) return "recruitingadresse";
  /* Ein Name als Adressteil ist ein Ansprechpartner, kein Postfach. */
  if (/^[a-zäöüß]+[._-][a-zäöüß]+$/.test(lokal)) return "ansprechpartner";
  return "allgemeiner_kontakt";
}
