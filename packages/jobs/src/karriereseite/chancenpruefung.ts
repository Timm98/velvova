import {
  arbeitgeberpassung,
  darfVorschlagen,
  type Arbeitgeberart,
  type Arbeitgeberprofil,
  type Chancenlage,
  type Kontaktkanal,
  type Passungsbeleg,
  type Suchprofil,
  type Vorschlagsurteil,
} from "@paycheck/domain";
import { karrierelinks, type Karrierefund } from "./karrierelinks.ts";
import { initiativlageLesen, kontaktkanaeleAusSeite } from "./initiativlage.ts";
import { seiteHolen, type Abrufwerkzeuge } from "./abruf.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Durchlauf — von einem Arbeitgeber zu einer stillen Chance
 * ══════════════════════════════════════════════════════════════════
 *
 * Alle Teile stehen einzeln und sind einzeln geprüft. Diese Datei
 * setzt sie in die Reihenfolge, in der sie laufen müssen — und die
 * Reihenfolge ist die eigentliche Aussage.
 *
 *   1. Kennen wir schon eine passende Anzeige?   → dann nichts
 *   2. Passt der Arbeitgeber überhaupt?          → sonst nichts
 *   3. Wo ist sein Karrierebereich?
 *   4. Steht dort etwas Passendes?               → dann nichts
 *   5. Was sagt er zu Initiativbewerbungen?
 *   6. Darf Monday es vorschlagen?
 *
 * ── Warum die Anzeige zweimal geprüft wird ──────────────────────
 *
 * Einmal im eigenen Bestand (1) und einmal auf seiner Seite (4).
 * Beides ist nötig: Unser Bestand kennt nicht jede Anzeige — genau
 * deshalb gibt es dieses ganze System —, und die Karriereseite ist
 * die Quelle, an der sie zuerst steht.
 *
 * Einen Arbeitgeber nach einer Stelle zu fragen, die auf seiner
 * eigenen Seite ausgeschrieben ist, ist der peinlichste Fehler, den
 * dieses System machen kann. Er beweist, dass nicht nachgesehen wurde.
 *
 * ── Wie mit Unsicherheit umgegangen wird ────────────────────────
 *
 * Bei Schritt 4 wird nicht versucht, Stellen aus fremdem HTML zu
 * lesen — das ist ein eigenes Vorhaben. Stattdessen: Enthält die
 * Karriereseite Wörter aus dem Berufsfeld der Person, gilt sie als
 * „dort steht möglicherweise etwas", und es entsteht KEINE stille
 * Chance.
 *
 * Das ist bewusst zu vorsichtig. Der Fehler in dieser Richtung kostet
 * eine Gelegenheit und liefert der Person einen Link, den sie selbst
 * ansehen kann. Der Fehler in der anderen Richtung ist ein Brief, der
 * nach einer Stelle fragt, die danebensteht.
 *
 * ── Zwei Abrufe je Arbeitgeber, nicht mehr ──────────────────────
 *
 * Startseite und Karriereseite. Wer tiefer gräbt, bekommt bessere
 * Daten und wird zu einem Besucher, den ein Landratsamt in seinen
 * Protokollen bemerkt. Das ist der Handel, und er ist bewusst so
 * gewählt.
 */

export type Chancenergebnis =
  | {
      art: "chance";
      urteil: Vorschlagsurteil;
      punkte: number;
      belegdichte: number;
      belege: Passungsbeleg[];
      kanaele: Kontaktkanal[];
      karriereseite: string;
      initiativBelegsaetze: string[];
      /** Was an der Seite auffiel. Leer ist der Normalfall. */
      auffaelligkeiten: string[];
    }
  | {
      /** Dort steht möglicherweise eine passende Stelle — nachsehen lohnt. */
      art: "moeglicherweise_ausgeschrieben";
      karriereseite: string;
      grund: string;
    }
  | { art: "keine"; grund: string };

export interface Pruefeingaben {
  arbeitgeber: Arbeitgeberprofil;
  profil: Suchprofil;
  arbeitgeberart: Arbeitgeberart;
  /** Die Startseite. Ohne sie gibt es nichts abzurufen. */
  website: string | null;

  /** Kennt unser Bestand bereits eine passende Anzeige dieses Arbeitgebers? */
  passendeStelleImBestand: boolean;

  /* Aus `arbeitgeber_kontakte` und `arbeitgeber_kontaktsperre`. */
  letzterKontakt: Date | null;
  unbeantworteteKontakte: number;
  kontaktGesperrt: boolean;
  heuteVersendet: number;
  dieseWocheVersendet: number;
  vomNutzerAusgeschlossen: boolean;
  nutzerWillInitiativkontakt: boolean;
}

export interface Pruefoptionen extends Abrufwerkzeuge {
  /**
   * Ab welcher Passung ein Abruf sich lohnt.
   *
   * Der Wert entscheidet nicht über Qualität, sondern über Höflichkeit:
   * Jeder Arbeitgeber unter dieser Grenze bekommt gar keinen Besuch.
   */
  mindestpunkte?: number;
  jetzt?: () => Date;
}

export const MINDESTPUNKTE = 60;

const nichts = (grund: string): Chancenergebnis => ({ art: "keine", grund });

/**
 * Einen Arbeitgeber prüfen.
 *
 * Bricht früh ab und sagt warum. Jeder Abbruchgrund ist ein Satz, den
 * ein Mensch lesen kann — er landet in `arbeitgeber_chancen.status`
 * und im Protokoll, und er ist bei einer Rückfrage die Antwort.
 */
export async function chancePruefen(
  eingaben: Pruefeingaben,
  optionen: Pruefoptionen = {},
): Promise<Chancenergebnis> {
  const jetzt = optionen.jetzt ?? (() => new Date());
  const mindestens = optionen.mindestpunkte ?? MINDESTPUNKTE;

  /* ── 1. Kennen wir schon eine Anzeige? ───────────────────────── */
  if (eingaben.passendeStelleImBestand) {
    return nichts("Für dieses Profil gibt es dort eine ausgeschriebene Stelle.");
  }

  /*
   * Was der Mensch gesagt hat, VOR dem Abruf.
   *
   * Ein ausgeschlossener Arbeitgeber darf nicht besucht werden, nur
   * um festzustellen, dass er ausgeschlossen ist.
   */
  if (eingaben.vomNutzerAusgeschlossen) return nichts("Du hast diesen Arbeitgeber ausgeschlossen.");
  if (!eingaben.nutzerWillInitiativkontakt) return nichts("Du möchtest keine Initiativkontakte.");
  if (eingaben.kontaktGesperrt) return nichts("Dieser Arbeitgeber hat weiteren Kontakt abgelehnt.");

  /* ── 2. Passt er überhaupt? ──────────────────────────────────── */
  const passung = arbeitgeberpassung(eingaben.arbeitgeber, eingaben.profil, jetzt());
  if (!passung.bewertbar) return nichts(passung.grund);
  if (passung.punkte < mindestens) {
    return nichts(`Die Passung liegt bei ${passung.punkte} von 100 — zu wenig für eine Anfrage.`);
  }

  if (!eingaben.website) {
    return nichts("Von diesem Arbeitgeber ist keine Website bekannt.");
  }

  /* ── 3. Wo ist der Karrierebereich? ──────────────────────────── */
  const start = await seiteHolen(eingaben.website, optionen);
  if (!start.ok) {
    return nichts(`Die Website war nicht abrufbar: ${start.nachricht}`);
  }

  const funde = karrierelinks(start.rohHtml, start.endgueltigeUrl);
  const ziel = besterEinstieg(funde);
  if (!ziel) {
    /*
     * Keine geratene Adresse als Ersatz. Wer hier `/karriere`
     * probiert, ruft eine Seite ab, von der niemand gesagt hat, dass
     * es sie gibt — und bekommt im besten Fall eine 404, im
     * schlechteren die Fehlerseite als Karrieretext.
     */
    return nichts("Auf der Website ist kein Karrierebereich verlinkt.");
  }

  /* ── 4. Steht dort etwas Passendes? ──────────────────────────── */
  const karriere = await seiteHolen(ziel.url, optionen);
  if (!karriere.ok) {
    return nichts(`Der Karrierebereich war nicht abrufbar: ${karriere.nachricht}`);
  }

  if (nenntBerufsfeld(karriere.inhalt.text, eingaben.profil)) {
    return {
      art: "moeglicherweise_ausgeschrieben",
      karriereseite: karriere.endgueltigeUrl,
      grund:
        "Auf der Karriereseite kommen Wörter aus deinem Berufsfeld vor. " +
        "Sieh dort zuerst nach, bevor jemand angeschrieben wird.",
    };
  }

  /* ── 5. Was sagt er zu Initiativbewerbungen? ─────────────────── */
  const initiativ = initiativlageLesen(karriere.inhalt);
  const kanaele: Kontaktkanal[] = kontaktkanaeleAusSeite(
    karriere.rohHtml,
    karriere.endgueltigeUrl,
  ).map((k) => ({
    art: k.art,
    ziel: k.ziel,
    belegUrl: k.belegUrl,
    geprueftAm: karriere.inhalt.geholtAm,
  }));

  /* ── 6. Darf Monday es vorschlagen? ──────────────────────────── */
  const lage: Chancenlage = {
    passendeStelleVorhanden: false,
    karriereseiteGeprueftAm: karriere.inhalt.geholtAm,
    initiativlage: initiativ.lage,
    kanaele,
    arbeitgeberart: eingaben.arbeitgeberart,
    letzterKontakt: eingaben.letzterKontakt,
    unbeantworteteKontakte: eingaben.unbeantworteteKontakte,
    kontaktAbgelehnt: eingaben.kontaktGesperrt,
    heuteVersendet: eingaben.heuteVersendet,
    dieseWocheVersendet: eingaben.dieseWocheVersendet,
    vomNutzerAusgeschlossen: eingaben.vomNutzerAusgeschlossen,
    nutzerWillInitiativkontakt: eingaben.nutzerWillInitiativkontakt,
  };

  const urteil = darfVorschlagen(lage, jetzt());
  if (!urteil.darfVorschlagen) return nichts(urteil.grund);

  return {
    art: "chance",
    urteil,
    punkte: passung.punkte,
    belegdichte: passung.belegdichte,
    belege: passung.belege,
    kanaele,
    karriereseite: karriere.endgueltigeUrl,
    initiativBelegsaetze: initiativ.belegsaetze,
    auffaelligkeiten: [...karriere.inhalt.auffaelligkeiten],
  };
}

/**
 * Welchen Karrierelink wir besuchen.
 *
 * Die Initiativseite zuerst — sie beantwortet die Frage, auf die es
 * ankommt. Danach die Stellenliste, weil sie Schritt 4 entscheidet.
 * Der allgemeine Karrierebereich zuletzt: Er enthält meist beides,
 * ist aber der ungenauere Einstieg.
 *
 * Ausbildung und Kontakt sind keine Einstiege — sie führen an der
 * Frage vorbei.
 */
function besterEinstieg(funde: readonly Karrierefund[]): Karrierefund | null {
  for (const art of ["initiativbewerbung", "stellenliste", "karriere"] as const) {
    const treffer = funde.find((f) => f.art === art);
    if (treffer) return treffer;
  }
  return null;
}

/**
 * Kommen Wörter aus dem Berufsfeld auf der Seite vor?
 *
 * Grob und absichtlich so. Eine genaue Stellenerkennung wäre ein
 * eigenes Vorhaben; diese Prüfung soll nur verhindern, dass jemand
 * nach etwas fragt, das danebensteht.
 *
 * Verlangt werden mindestens vier Zeichen je Wort — sonst trifft ein
 * Berufsfeld namens „IT" jeden Text, in dem „mit" vorkommt.
 */
function nenntBerufsfeld(text: string, profil: Suchprofil): boolean {
  const t = text.toLowerCase();
  return profil.berufsfelder.some((b) => {
    const wort = b.trim().toLowerCase();
    return wort.length >= 4 && t.includes(wort);
  });
}
