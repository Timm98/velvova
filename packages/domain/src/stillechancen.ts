/**
 * ══════════════════════════════════════════════════════════════════
 * Stille Chancen — was noch keine Stelle ist
 * ══════════════════════════════════════════════════════════════════
 *
 * Velvova sucht bisher, was ausgeschrieben ist. Das ist der kleinere
 * Teil der beruflichen Wirklichkeit: Ein Arbeitgeber kann gut passen,
 * ohne gerade etwas zu suchen, und ein Landratsamt schreibt aus, wenn
 * die Stelle frei wird — nicht, wenn jemand Passendes vorbeikommt.
 *
 * Diese Datei entscheidet, ob daraus ein Vorschlag werden darf. Sie
 * verschickt nichts, sie schreibt nichts, sie ruft nichts auf. Sie
 * beantwortet eine einzige Frage:
 *
 *     Darf Monday diesem Menschen diesen Arbeitgeber vorschlagen?
 *
 * ── Die Regel, die über allen steht ─────────────────────────────
 *
 * **Eine Vermutung ist kein Job.** Das ist keine Formulierungsfrage,
 * sondern eine Typunterscheidung: `Chancenart` trennt drei Dinge, die
 * in einer Liste nebeneinander stehen und nie ineinander übergehen
 * dürfen. Wer sie in einem Feld führt, schreibt irgendwann „Offene
 * Stelle" über etwas, das niemand bestätigt hat — und das ist der
 * Punkt, an dem Velvova zu dem wird, wogegen es gebaut ist.
 *
 * ── Was diese Datei ausdrücklich NICHT entscheidet ──────────────
 *
 * Ob etwas versendet wird. Es gibt hier keine Funktion `darfSenden`,
 * und das ist Absicht: Versand braucht die Zustimmung eines Menschen
 * zu genau diesem Text an genau diesen Empfänger. Eine hohe Punktzahl
 * ist kein Ersatz dafür und darf nie einer werden. Deshalb heisst das
 * Ergebnis `darfVorschlagen` und nichts sonst.
 */

/* ══════════════════════════════════════════════════════════════════
   Die drei Dinge, die nie eins werden dürfen
   ══════════════════════════════════════════════════════════════════ */

export type Chancenart =
  /** Eine veröffentlichte Stelle. Nur das ist ein Job. */
  | "oeffentliche_stelle"
  /** Ein passender Arbeitgeber ohne passende Anzeige. Eine Vermutung. */
  | "stille_chance"
  /** Vom Arbeitgeber selbst bestätigt. Noch immer keine Anzeige. */
  | "bestaetigte_moeglichkeit";

/**
 * Wie eine Chancenart heissen darf, wenn ein Mensch sie liest.
 *
 * Steht hier und nicht in einer Komponente, damit es genau eine
 * Fassung gibt. Zwei Oberflächen mit eigenen Wörtern laufen
 * auseinander, und dann steht an einer Stelle „Offene Stelle" über
 * einer Vermutung.
 */
export const CHANCENWORT: Record<Chancenart, string> = {
  oeffentliche_stelle: "Ausgeschriebene Stelle",
  stille_chance: "Mögliche Chance",
  bestaetigte_moeglichkeit: "Vom Arbeitgeber bestätigt",
};

/** Darf über dieser Karte „Stelle" stehen? Nur bei einer echten Anzeige. */
export function istEineStelle(art: Chancenart): boolean {
  return art === "oeffentliche_stelle";
}

/* ══════════════════════════════════════════════════════════════════
   Was der Arbeitgeber zu Initiativbewerbungen sagt
   ══════════════════════════════════════════════════════════════════ */

export type Initiativlage =
  /** Ausdrücklich erwünscht — Talent-Pool, eigenes Formular. */
  | "erwuenscht"
  /** Erlaubt, ohne Werbung dafür. */
  | "erlaubt"
  /** Die Seite sagt beides oder nichts Eindeutiges. */
  | "unklar"
  /** Steht sinngemäss: lieber nicht. */
  | "unerwuenscht"
  /** Steht ausdrücklich: nein. */
  | "ausgeschlossen"
  /** Es wurde noch nicht nachgesehen. */
  | "unbekannt";

/* ══════════════════════════════════════════════════════════════════
   Wie man hinkommt
   ══════════════════════════════════════════════════════════════════ */

export type Kanalart =
  | "initiativformular"
  | "karriereformular"
  | "recruitingadresse"
  | "ansprechpartner"
  | "allgemeiner_kontakt";

/** Kleiner heisst: dafür vorgesehen. §11 in dieser Reihenfolge. */
const KANALRANG: Record<Kanalart, number> = {
  initiativformular: 0,
  karriereformular: 1,
  recruitingadresse: 2,
  ansprechpartner: 3,
  allgemeiner_kontakt: 4,
};

export interface Kontaktkanal {
  art: Kanalart;
  /** Adresse oder Formular-URL. */
  ziel: string;
  /**
   * Wo das steht.
   *
   * ── Warum das ein Pflichtfeld ist ───────────────────────────
   *
   * Weil ein Kanal ohne Fundstelle geraten ist. `vorname.nachname@`
   * ist ein wahrscheinliches Format und keine Auskunft; wer danach
   * schreibt, schreibt an eine Person, die nie gesagt hat, dass sie
   * erreichbar sein will.
   *
   * Als Pflichtfeld im Typ ist „ich trage schnell eine Adresse ein"
   * nicht die kürzere Variante — es gibt keine kürzere.
   */
  belegUrl: string;
  geprueftAm: Date;
}

/** Ist dieser Kanal belegt und frisch genug, um ihn zu benutzen? */
export function kanalVerwendbar(kanal: Kontaktkanal, jetzt: Date = new Date()): boolean {
  if (!kanal.ziel.trim() || !kanal.belegUrl.trim()) return false;
  return alterInTagen(kanal.geprueftAm, jetzt) <= BELEG_HOECHSTALTER_TAGE;
}

/** Der am besten geeignete verwendbare Kanal — oder keiner. */
export function besterKanal(
  kanaele: readonly Kontaktkanal[],
  jetzt: Date = new Date(),
): Kontaktkanal | null {
  const brauchbar = kanaele.filter((k) => kanalVerwendbar(k, jetzt));
  if (brauchbar.length === 0) return null;
  return [...brauchbar].sort((a, b) => KANALRANG[a.art] - KANALRANG[b.art])[0] ?? null;
}

/* ══════════════════════════════════════════════════════════════════
   Was gefragt werden darf
   ══════════════════════════════════════════════════════════════════ */

export type Anfrageart =
  /** Kurze Frage, ob etwas ansteht. Ohne Unterlagen. */
  | "stellenanfrage"
  /** Bewerbung ohne ausgeschriebene Zielstelle. */
  | "initiativbewerbung";

export type Arbeitgeberart = "privat" | "oeffentlich";

/* ══════════════════════════════════════════════════════════════════
   Wie sicher wir uns sind
   ══════════════════════════════════════════════════════════════════ */

export type Sicherheit = "niedrig" | "mittel" | "hoch" | "bestaetigt";

/**
 * `bestaetigt` gibt es nur aus dem Mund des Arbeitgebers.
 *
 * Keine Menge an Belegen, keine Übereinstimmung mehrerer Modelle und
 * keine hohe Punktzahl führt dorthin. Der Unterschied zwischen „sehr
 * wahrscheinlich" und „gesagt" ist der einzige, auf den sich jemand
 * verlassen kann — wenn er verwischt, ist die ganze Stufe wertlos.
 */
export function sicherheitAus(opt: {
  belege: number;
  arbeitgeberHatBestaetigt: boolean;
  initiativlage: Initiativlage;
}): Sicherheit {
  if (opt.arbeitgeberHatBestaetigt) return "bestaetigt";
  if (opt.belege >= 3 && opt.initiativlage === "erwuenscht") return "hoch";
  if (opt.belege >= 2) return "mittel";
  return "niedrig";
}

/* ══════════════════════════════════════════════════════════════════
   Die Grenzen
   ══════════════════════════════════════════════════════════════════ */

/** Wie alt eine Karriereseiten-Prüfung sein darf. Karriereseiten ändern sich. */
export const BELEG_HOECHSTALTER_TAGE = 14;
/** Wie lange nach einem Kontakt Ruhe ist. */
export const ABKUEHLUNG_TAGE = 90;
/** Wie viele unbeantwortete Anfragen an denselben Arbeitgeber. */
export const MAX_UNBEANTWORTET = 1;
export const TAGESGRENZE = 3;
export const WOCHENGRENZE = 10;

function alterInTagen(seit: Date, jetzt: Date): number {
  return (jetzt.getTime() - seit.getTime()) / 86_400_000;
}

/* ══════════════════════════════════════════════════════════════════
   Die Entscheidung
   ══════════════════════════════════════════════════════════════════ */

export interface Chancenlage {
  /**
   * Gibt es bei diesem Arbeitgeber eine passende Anzeige?
   *
   * §3, und die wichtigste Zeile in dieser Datei. Einen Arbeitgeber
   * nach einer Stelle zu fragen, die er ausgeschrieben hat, ist der
   * peinlichste Fehler, den dieses System machen kann — er beweist,
   * dass nicht nachgesehen wurde.
   */
  passendeStelleVorhanden: boolean;
  /** Wann zuletzt auf der Karriereseite nachgesehen wurde. */
  karriereseiteGeprueftAm: Date | null;

  initiativlage: Initiativlage;
  kanaele: readonly Kontaktkanal[];
  arbeitgeberart: Arbeitgeberart;

  /** Wann dieser Arbeitgeber zuletzt kontaktiert wurde. */
  letzterKontakt: Date | null;
  unbeantworteteKontakte: number;
  /** Ob der Arbeitgeber weiteren Kontakt abgelehnt hat. */
  kontaktAbgelehnt: boolean;

  heuteVersendet: number;
  dieseWocheVersendet: number;

  /** Der Mensch hat diesen Arbeitgeber ausgeschlossen. */
  vomNutzerAusgeschlossen: boolean;
  /** Der Mensch will grundsätzlich keine Initiativkontakte. */
  nutzerWillInitiativkontakt: boolean;
}

export interface Vorschlagsurteil {
  darfVorschlagen: boolean;
  /** Welche Art Anfrage zulässig wäre. `null`, wenn keine. */
  anfrageart: Anfrageart | null;
  kanal: Kontaktkanal | null;
  /** Ein Satz. Bei `false` der Grund, bei `true` die Grundlage. */
  grund: string;
}

const NEIN = (grund: string): Vorschlagsurteil => ({
  darfVorschlagen: false, anfrageart: null, kanal: null, grund,
});

/**
 * Darf Monday diesen Arbeitgeber vorschlagen?
 *
 * ── Die Reihenfolge der Prüfungen ist die Antwort ───────────────
 *
 * Wer zuerst geprüft wird, bestimmt, welchen Grund der Mensch zu
 * lesen bekommt. Deshalb steht die ausgeschriebene Stelle ganz oben:
 * Wenn es sie gibt, ist alles Weitere gegenstandslos — und die
 * richtige Auskunft ist nicht „Kontakt nicht empfohlen", sondern
 * „dafür gibt es eine Anzeige".
 *
 * Danach die Ablehnungen: Was der Mensch oder der Arbeitgeber gesagt
 * hat, schlägt jede Berechnung. Erst danach die Mechanik.
 */
export function darfVorschlagen(
  lage: Chancenlage,
  jetzt: Date = new Date(),
): Vorschlagsurteil {
  /* §3 — die Anzeige gewinnt immer. */
  if (lage.passendeStelleVorhanden) {
    return NEIN("Für dieses Profil gibt es dort eine ausgeschriebene Stelle.");
  }

  /* §34 — was der Mensch gesagt hat. */
  if (lage.vomNutzerAusgeschlossen) {
    return NEIN("Du hast diesen Arbeitgeber ausgeschlossen.");
  }
  if (!lage.nutzerWillInitiativkontakt) {
    return NEIN("Du möchtest keine Initiativkontakte.");
  }

  /* §16 — was der Arbeitgeber gesagt hat. */
  if (lage.kontaktAbgelehnt) {
    return NEIN("Dieser Arbeitgeber hat weiteren Kontakt abgelehnt.");
  }

  /* §10 — was auf der Seite steht. */
  if (lage.initiativlage === "ausgeschlossen") {
    return NEIN("Der Arbeitgeber schliesst Initiativbewerbungen ausdrücklich aus.");
  }
  if (lage.initiativlage === "unerwuenscht") {
    return NEIN("Der Arbeitgeber bittet darum, von Initiativbewerbungen abzusehen.");
  }
  if (lage.initiativlage === "unbekannt") {
    /*
     * Nicht dasselbe wie „unklar".
     *
     * `unbekannt` heisst: Es wurde nicht nachgesehen. Auf dieser
     * Grundlage jemanden anzuschreiben, hiesse zu raten — und das
     * unterscheidet dieses System von einem Serienbrief.
     */
    return NEIN("Die Karriereseite wurde noch nicht geprüft.");
  }

  /* §31 — steht das noch, was wir gelesen haben? */
  if (!lage.karriereseiteGeprueftAm) {
    return NEIN("Die Karriereseite wurde noch nicht geprüft.");
  }
  if (alterInTagen(lage.karriereseiteGeprueftAm, jetzt) > BELEG_HOECHSTALTER_TAGE) {
    return NEIN("Die Prüfung der Karriereseite ist zu alt und wird wiederholt.");
  }

  /* §11 — gibt es einen belegten Weg? */
  const kanal = besterKanal(lage.kanaele, jetzt);
  if (!kanal) {
    return NEIN("Es ist kein belegter Kontaktweg bekannt.");
  }

  /* §17 — Abkühlung und Grenzen. */
  if (lage.letzterKontakt && alterInTagen(lage.letzterKontakt, jetzt) < ABKUEHLUNG_TAGE) {
    return NEIN("Dieser Arbeitgeber wurde vor Kurzem schon angeschrieben.");
  }
  if (lage.unbeantworteteKontakte >= MAX_UNBEANTWORTET) {
    /*
     * Keine Nachfassschleifen. Wer nicht geantwortet hat, hat
     * geantwortet.
     */
    return NEIN("Eine frühere Anfrage ist unbeantwortet geblieben.");
  }
  if (lage.heuteVersendet >= TAGESGRENZE) {
    return NEIN("Für heute sind genug Anfragen gestellt.");
  }
  if (lage.dieseWocheVersendet >= WOCHENGRENZE) {
    return NEIN("Für diese Woche sind genug Anfragen gestellt.");
  }

  /*
   * §33 — der öffentliche Dienst.
   *
   * Dort werden Stellen in geregelten Verfahren besetzt und
   * ausgeschrieben. Eine Initiativbewerbung dorthin zu schicken
   * suggeriert, es ginge auch daran vorbei — was nicht stimmt und der
   * Person nicht hilft.
   *
   * Was hilft: die Frage, ob etwas ansteht, wo es veröffentlicht wird
   * und ob es eine Vormerkung gibt. Deshalb bleibt hier nur die
   * Stellenanfrage, unabhängig davon, wie gut alles andere aussieht.
   */
  const anfrageart: Anfrageart =
    lage.arbeitgeberart === "oeffentlich"
      ? "stellenanfrage"
      : lage.initiativlage === "erwuenscht"
        ? "initiativbewerbung"
        : "stellenanfrage";

  return {
    darfVorschlagen: true,
    anfrageart,
    kanal,
    grund:
      lage.arbeitgeberart === "oeffentlich"
        ? "Öffentlicher Arbeitgeber: Anfrage nach geplanten Ausschreibungen."
        : lage.initiativlage === "erwuenscht"
          ? "Der Arbeitgeber lädt ausdrücklich zu Initiativbewerbungen ein."
          : "Kontakt ist möglich; eine kurze Anfrage ist angemessen.",
  };
}
