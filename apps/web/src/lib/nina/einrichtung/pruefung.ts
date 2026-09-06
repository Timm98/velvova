import {
  IST_BEDIENART, IST_KANAL, IST_RHYTHMUS, IST_SPEICHERUNG, IST_STUFE, IST_ZEIT,
  type Bedienart, type Kanal, type Rhythmus, type Sprachspeicherung, type Stufe,
} from "./texte";

/**
 * Was aus dem Formular ankommt, in geprüfte Werte übersetzen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine eigene, reine Funktion ist
 * ══════════════════════════════════════════════════════════════
 *
 * Hier steht die Sicherheitsgrenze dieser Seite. Alles, was Nina
 * später im Hintergrund tun darf, entscheidet sich in diesen dreissig
 * Zeilen — und wenn sie in einem Modul stünden, das eine Datenbank
 * braucht, liesse sich keine einzige davon prüfen, ohne eine
 * Datenbank zu starten.
 *
 * Der Client schickt Zeichenketten. Was hier nicht ausdrücklich
 * erlaubt ist, kommt nicht durch — insbesondere nicht eine vierte
 * Stufe, ein Briefing ohne Hintergrundsuche oder eine Zeitangabe, die
 * keine ist.
 */

export type Wunsch = {
  bedienart: unknown;
  sprachspeicherung: unknown;
  stufe: unknown;
  briefingAktiv: unknown;
  briefingRhythmus: unknown;
  briefingZeit: unknown;
  zeitzone: unknown;
  kanaele: unknown;
};

export type GepruefteWerte = {
  bedienart: Bedienart;
  sprachspeicherung: Sprachspeicherung;
  stufe: Stufe;
  briefingAktiv: boolean;
  briefingRhythmus: Rhythmus;
  briefingZeit: string;
  zeitzone: string;
  kanaele: Kanal[];
};

export type Pruefergebnis =
  | { ok: true; werte: GepruefteWerte }
  | { ok: false; fehler: string };

/** Eine Zeitzone, die `Intl` kennt — sonst die Vorgabe. */
export function gueltigeZeitzone(w: unknown): string {
  if (typeof w !== "string" || w.length === 0 || w.length > 64) return "Europe/Berlin";
  try {
    /* Wirft bei einer unbekannten Zone. Das ist die einzige
       verlässliche Prüfung: Eine Liste hier wäre am Tag der nächsten
       Zeitzonenänderung veraltet. */
    new Intl.DateTimeFormat("de-DE", { timeZone: w }).format(new Date(0));
    return w;
  } catch {
    return "Europe/Berlin";
  }
}

export function pruefe(wunsch: Wunsch): Pruefergebnis {
  if (!IST_BEDIENART(wunsch.bedienart)) {
    return { ok: false, fehler: "Bitte wähle, ob du mit Nina sprechen oder schreiben möchtest." };
  }
  if (!IST_STUFE(wunsch.stufe)) {
    return { ok: false, fehler: "Bitte wähle, was Nina im Hintergrund tun darf." };
  }

  /*
   * Die Speicherung des Transkripts gilt nur beim Sprechen.
   *
   * Wer schreibt, hat kein Audio — „Transkript speichern" wäre dort
   * eine Zustimmung ohne Gegenstand. Sie stillschweigend zu
   * übernehmen hiesse, sie beim späteren Wechsel zur Sprache
   * vorzufinden, ohne dass sie je gegeben wurde.
   */
  const sprachspeicherung: Sprachspeicherung =
    wunsch.bedienart === "sprache" && IST_SPEICHERUNG(wunsch.sprachspeicherung)
      ? wunsch.sprachspeicherung
      : "nur_bestaetigte";

  /* Ohne Hintergrundsuche kein Briefing — hier erzwungen, nicht nur
     in der Oberfläche ausgeblendet. */
  const briefingAktiv = wunsch.stufe !== "manual" && wunsch.briefingAktiv === true;

  const kanaele: Kanal[] = briefingAktiv
    ? [...new Set(Array.isArray(wunsch.kanaele) ? wunsch.kanaele.filter(IST_KANAL) : [])]
    : [];
  /* Ein Briefing ohne Zustellweg käme nirgends an. */
  if (briefingAktiv && kanaele.length === 0) kanaele.push("in_app");

  return {
    ok: true,
    werte: {
      bedienart: wunsch.bedienart,
      sprachspeicherung,
      stufe: wunsch.stufe,
      briefingAktiv,
      briefingRhythmus: IST_RHYTHMUS(wunsch.briefingRhythmus) ? wunsch.briefingRhythmus : "werktags",
      briefingZeit: IST_ZEIT(wunsch.briefingZeit) ? wunsch.briefingZeit : "08:00",
      zeitzone: gueltigeZeitzone(wunsch.zeitzone),
      kanaele,
    },
  };
}
