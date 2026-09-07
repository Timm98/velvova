/**
 * Was Monday von selbst darf — und was nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Tabelle im Code steht und nicht im Prompt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Sprachmodell, das seine eigenen Rechte beschreibt, kann sie
 * auch erweitern. Nicht aus Bosheit — es genügt eine ungeschickt
 * formulierte Nutzernachricht, ein widersprüchlicher Kontext, ein
 * Beispiel im Prompt, das wie eine Erlaubnis aussieht.
 *
 * Deshalb steht hier eine geschlossene Liste. Das Modell bekommt die
 * erlaubten Handlungen als Eingabe und darf aus ihnen wählen. Was
 * nicht in dieser Datei steht, existiert für Monday nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Die drei Klassen
 * ══════════════════════════════════════════════════════════════
 *
 *   auto_allowed    Monday handelt selbst und sagt es hinterher
 *   propose_first   Monday fragt und handelt nach Zustimmung
 *   explicit_only   Monday handelt nur auf ausdrücklichen Auftrag
 *
 * Die Grenze zwischen der ersten und der zweiten Klasse ist nicht
 * „wie nützlich", sondern: Lässt es sich zurücknehmen, kostet es
 * nichts, geht nichts nach draussen, und ändert es nichts, was die
 * Person bestätigt hat?
 *
 * Vier Ja — dann darf Monday. Ein Nein genügt für `propose_first`.
 */

export type Handlungsklasse = "auto_allowed" | "propose_first" | "explicit_only";

export interface Handlungsregel {
  /** Was Monday dabei prüfen und begründen muss. */
  klasse: Handlungsklasse;
  /** In der Sprache der Person — steht so in „Von Monday automatisch". */
  beschreibung: string;
  /**
   * Ob die Person sie einzeln abschalten kann.
   *
   * Nur für `auto_allowed` sinnvoll: Was ohnehin gefragt wird, muss
   * nicht zusätzlich abschaltbar sein.
   */
  abschaltbar: boolean;
  /** Wie lange sich die Handlung rückgängig machen lässt, in Stunden. */
  rueckgaengigStunden: number | null;
}

/**
 * Die elf Handlungen, die Monday von selbst ausführen darf.
 *
 * ── Warum keine davon „speichern" heisst ──────────────────────
 *
 * „Gespeichert" bedeutet in Velvova: Ich will diese Stelle bewusst
 * behalten. Das ist eine Aussage der Person über sich selbst, und
 * Monday kann sie nicht an ihrer Stelle treffen.
 *
 * `interesting` ist die ehrliche Zwischenstufe: Monday hat Interesse
 * VERMUTET. Der Unterschied steht auch in der Oberfläche — „Von Monday
 * vorgemerkt", nicht „Gespeichert".
 */
export const HANDLUNGEN: Record<string, Handlungsregel> = {
  /* ── Klasse A: Monday handelt selbst ──────────────────────────── */

  job_vormerken: {
    klasse: "auto_allowed",
    beschreibung: "Stelle als interessant vormerken",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  job_zu_klaeren: {
    klasse: "auto_allowed",
    beschreibung: "Stelle mit fehlenden Angaben unter „Noch zu klären“ einordnen",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  aehnliche_gruppieren: {
    klasse: "auto_allowed",
    beschreibung: "Sehr ähnliche Stellen zusammenfassen",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  geschlossene_ausblenden: {
    klasse: "auto_allowed",
    beschreibung: "Abgelaufene Anzeigen aus den aktiven Vorschlägen nehmen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  aenderung_hervorheben: {
    klasse: "auto_allowed",
    beschreibung: "Wesentliche Änderungen an gemerkten Stellen hervorheben",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  vergleich_vorbereiten: {
    klasse: "auto_allowed",
    beschreibung: "Vergleich zwischen mehrfach angesehenen Stellen vorbereiten",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  hypothese_merken: {
    klasse: "auto_allowed",
    beschreibung: "Mögliche neue Suchrichtung als unbestätigte Vermutung notieren",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  offene_fragen_sammeln: {
    klasse: "auto_allowed",
    beschreibung: "Offene Fragen zur Stelle für später sammeln",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  analyse_vorbereiten: {
    klasse: "auto_allowed",
    beschreibung: "Mondays Einschätzung zu einer Stelle im Voraus berechnen",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },
  ausschluss_herabstufen: {
    klasse: "auto_allowed",
    /*
     * Herabstufen, nicht löschen.
     *
     * Die Stelle verletzt ein bestätigtes Ausschlusskriterium und
     * gehört deshalb nicht nach oben. Sie ganz verschwinden zu lassen
     * hiesse, der Person die Möglichkeit zu nehmen, ihre eigene
     * Entscheidung zu revidieren — und ein Filter, der Dinge
     * unauffindbar macht, ist eine Bevormundung, keine Hilfe.
     */
    beschreibung: "Stellen, die deine Ausschlüsse verletzen, nach hinten sortieren",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },

  treffer_melden: {
    klasse: "auto_allowed",
    /*
     * Melden, nicht filtern.
     *
     * Die Stellen sind ohnehin in der Liste; Monday sagt nur, dass
     * ungewöhnlich gute dabei sind. Es lässt sich zurücknehmen, es
     * kostet nichts, es geht nichts nach draussen, und es ändert
     * nichts, was die Person bestätigt hat — die vier Ja.
     */
    beschreibung: "Melden, wenn mehrere neue Stellen ungewöhnlich gut passen",
    abschaltbar: true,
    rueckgaengigStunden: null,
  },

  /* ── Klasse B: Monday fragt zuerst ────────────────────────────── */

  suchauftrag_aendern: {
    klasse: "propose_first",
    beschreibung: "Suchauftrag ändern",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  gehalt_lockern: {
    klasse: "propose_first",
    beschreibung: "Mindestgehalt senken",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  umkreis_erweitern: {
    klasse: "propose_first",
    beschreibung: "Suchradius vergrössern",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  richtung_aufnehmen: {
    klasse: "propose_first",
    beschreibung: "Neue Berufsrichtung in die laufende Suche aufnehmen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  mail_aktivieren: {
    klasse: "propose_first",
    beschreibung: "Tägliche E-Mail einschalten",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  mail_haeufiger: {
    klasse: "propose_first",
    beschreibung: "Häufiger benachrichtigen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  profil_uebernehmen: {
    klasse: "propose_first",
    beschreibung: "Eine Vermutung ins bestätigte Profil übernehmen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  lebenslauf_anpassen: {
    klasse: "propose_first",
    beschreibung: "Lebenslauf für eine Stelle anpassen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  bewerbung_vorbereiten: {
    klasse: "propose_first",
    beschreibung: "Bewerbung vorbereiten",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },

  /*
   * ── Die drei Fragen aus der Intelligenzschicht ──────────────
   *
   * Sie tun nichts. Sie fragen — und was daraus folgt, ist eine
   * Aussage der Person über sich selbst.
   *
   * `propose_first` ist deshalb nicht die vorsichtige Wahl, sondern
   * die einzig mögliche: Eine Frage, die niemand beantwortet, hat
   * kein Ergebnis. Sie still auszuführen hiesse, sich die Antwort
   * selbst zu geben.
   */
  klaerung_ansprechen: {
    klasse: "propose_first",
    beschreibung: "Ansprechen, wenn eine Angabe und dein Verhalten nicht zusammenpassen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  wissensluecke_fragen: {
    klasse: "propose_first",
    beschreibung: "Nach einer fehlenden Angabe fragen, die viel verändert",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  suchfrage_stellen: {
    klasse: "propose_first",
    /*
     * Die Rückfrage zur laufenden Suche.
     *
     * Sie entsteht, wenn jemand oben etwas eingibt und dabei eine
     * Angabe offen bleibt, ohne die die Liste deutlich schlechter
     * wird — ein Ort ohne Umkreis etwa.
     *
     * `propose_first`, obwohl sie nur fragt: Die Antwort ändert den
     * Suchauftrag, und das ist eine Aussage der Person über das, was
     * sie will. Sie sich selbst zu geben wäre genau die Handlung ohne
     * Zustimmung, die die Klasse verhindert.
     */
    beschreibung: "Nachfragen, was für deine Suche noch fehlt",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  unsicherheit_melden: {
    klasse: "propose_first",
    beschreibung: "Sagen, wenn zwei Durchgänge zu keinem eindeutigen Bild kommen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },

  /* ── Klasse C: nur auf ausdrücklichen Auftrag ────────────────── */

  bewerbung_senden: {
    klasse: "explicit_only",
    beschreibung: "Bewerbung abschicken",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  arbeitgeber_kontaktieren: {
    klasse: "explicit_only",
    beschreibung: "Arbeitgeber kontaktieren",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  daten_weitergeben: {
    klasse: "explicit_only",
    beschreibung: "Persönliche Daten an Dritte übertragen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  profil_freigeben: {
    klasse: "explicit_only",
    beschreibung: "Profil gegenüber Arbeitgebern freigeben",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  kuendigung_senden: {
    klasse: "explicit_only",
    beschreibung: "Kündigung senden",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  vertrag_unterschreiben: {
    klasse: "explicit_only",
    beschreibung: "Vertrag unterschreiben",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
  zahlung_ausloesen: {
    klasse: "explicit_only",
    beschreibung: "Zahlung auslösen",
    abschaltbar: false,
    rueckgaengigStunden: null,
  },
} as const;

export type Handlungsart = keyof typeof HANDLUNGEN;

/**
 * Die Fassung dieser Tabelle.
 *
 * Sie steht an jeder ausgeführten Handlung. Ohne sie liesse sich
 * später nicht sagen, nach welcher Regel Monday damals gehandelt hat —
 * und „warum hat sie das gemacht" wäre nicht beantwortbar, sobald
 * jemand die Tabelle ändert.
 */
export const POLICY_FASSUNG = "proaktiv-2";

export function handlungBekannt(art: string): art is Handlungsart {
  return Object.hasOwn(HANDLUNGEN, art);
}

/**
 * Ob Monday diese Handlung ohne Rückfrage ausführen darf.
 *
 * ── Warum eine unbekannte Handlung `false` ergibt ─────────────
 *
 * Weil die Alternative wäre, dass ein Tippfehler im Modellausgabe-
 * feld zu einer erlaubten Handlung wird. Eine Handlung, die niemand
 * eingetragen hat, ist keine Handlung.
 */
export function darfSelbstHandeln(art: string): boolean {
  return handlungBekannt(art) && HANDLUNGEN[art]!.klasse === "auto_allowed";
}

export function klasseVon(art: string): Handlungsklasse | null {
  return handlungBekannt(art) ? HANDLUNGEN[art]!.klasse : null;
}

/** Alle Handlungen einer Klasse — für die Eingabe an das Modell. */
export function handlungenDerKlasse(klasse: Handlungsklasse): Handlungsart[] {
  return (Object.keys(HANDLUNGEN) as Handlungsart[]).filter(
    (a) => HANDLUNGEN[a]!.klasse === klasse,
  );
}
