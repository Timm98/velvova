import type { Database } from "@paycheck/db";
import { betreffZahlStimmt, mailtextPruefen, type Mailposten } from "@paycheck/matching";
import type { Auswahlposten } from "@paycheck/matching";
import { mitGrenze, type Modellrufer } from "./modell.ts";

/**
 * Systemprompt 3 — die Textbausteine der Zusammenfassung.
 *
 * ══════════════════════════════════════════════════════════════
 * Was das Modell hier darf
 * ══════════════════════════════════════════════════════════════
 *
 * Betreff, Einleitung, Abschluss. Und je Stelle: einen der bereits
 * validierten Gründe auswählen — nicht formulieren.
 *
 * Titel, Arbeitgeber, Gehalt, Ort, Link, Empfänger und Abmeldung
 * kommen aus geprüften Datensätzen und gehen gar nicht erst durch
 * dieses Modul. Ein Modell, das die Mail als Ganzes schreibt, schreibt
 * irgendwann auch das Gehalt hinein — plausibel, gerundet und falsch.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Antwort dreifach geprüft wird
 * ══════════════════════════════════════════════════════════════
 *
 *   Schema      Zod, beim Aufruf — die Form
 *   Auswahl     `mailtextPruefen` — dieselben Stellen, dieselbe
 *               Reihenfolge, nur validierte Gründe
 *   Zahl        `betreffZahlStimmt` — „5 neue Stellen" bei drei
 *
 * Structured Outputs sichern die Form, nicht den Inhalt. Die zweite
 * Prüfung ist die wichtige: Sie verhindert, dass am Ende der Kette
 * eine Entscheidung geändert wird, die vier Schritte vorher begründet
 * getroffen wurde.
 */

/*
 * Der Systemprompt und sein Schema kommen aus `@paycheck/ai`.
 *
 * Sie stehen dort, weil sie zu den anderen beiden gehören — und weil
 * dieses Paket kein Anbieter-SDK kennen soll. Übergeben werden sie
 * vom Aufrufer, damit `@paycheck/jobs` nicht von `@paycheck/ai`
 * abhängt: Der Hintergrunddienst zöge sonst die halbe Modellschicht
 * in jeden Testlauf.
 */
export interface Prompt3 {
  anweisung: string;
  schema: unknown;
  fassung: string;
}

export interface Mailtexteingabe {
  userId: string;
  auftragsname: string;
  posten: Auswahlposten[];
  /** Titel je Stelle — für die Eingabe an das Modell. */
  titelJeId: Map<string, string>;
  basisLabel: string;
  anrede: string | null;
  /**
   * Die bestätigten Kriterien, in Worten.
   *
   * Ohne sie leitet das Modell die „Wünsche" aus den Eigenschaften der
   * Stellen ab. In einer Probe wurde so aus „unbefristet und in
   * Teilzeit" — einer Eigenschaft der Anzeige — ein Satz über den
   * Wunsch der Person nach Teilzeit, den sie nie geäussert hatte.
   */
  wuensche: string[];
  ersatz: { betreff: string; einleitung: string; abschluss: string };
  rufer?: Modellrufer;
  /** Fehlt er, bleibt es beim deterministischen Text. */
  prompt?: Prompt3;
}

export interface Mailtexte {
  betreff: string;
  einleitung: string;
  abschluss: string;
  /** Welche Fassung den Text erzeugt hat — `ersatz-1`, wenn keine. */
  fassung: string;
  /** Was am Modelltext beanstandet wurde. Leer heisst: nichts. */
  modell: Record<string, unknown>;
  /** Der je Stelle übernommene Grund. */
  gruende: Map<string, string>;
  caveats: Map<string, string | null>;
}

function ersatzfassung(e: Mailtexteingabe, grund: string): Mailtexte {
  return {
    ...e.ersatz,
    fassung: "ersatz-1",
    modell: { rueckfall: grund },
    gruende: new Map(e.posten.map((p) => [p.jobId, p.grund ?? ""])),
    caveats: new Map(e.posten.map((p) => [p.jobId, p.caveat])),
  };
}

export async function mailtexteBauen(db: Database, e: Mailtexteingabe): Promise<Mailtexte> {
  if (!e.prompt || !e.rufer) return ersatzfassung(e, "kein_modell");

  /*
   * Was das Modell sieht.
   *
   * Kein Chatverlauf, keine Gesundheits- oder Familienangaben, keine
   * Stimmungslage. Nur, was in der Mail stehen darf: Titel, der
   * validierte Grund, der belegte Vorbehalt.
   */
  const eingabe = JSON.stringify({
    auftrag: e.auftragsname,
    /*
     * Die Anredeform gehört in die Eingabe.
     *
     * Der Systemprompt sagt „in der eingestellten Anrede" — ohne einen
     * Wert dafür wählt das Modell selbst, und in einer Probe hat es
     * gesiezt. Velvova duzt durchgängig; eine Mail, die als einzige
     * Sie sagt, klingt wie von einem anderen Absender.
     *
     * Hier steht die Stimme des Produkts. Wird sie eines Tages je
     * Person einstellbar, kommt der Wert von dort — die Eingabe bleibt
     * dieselbe.
     */
    anredeform: "du",
    anrede: e.anrede,
    /* Belegte Wünsche. Worauf sich die Einleitung beziehen darf — und
       auf nichts sonst. */
    wuensche: e.wuensche,
    basis: e.basisLabel,
    anzahl: e.posten.length,
    empfehlungen: e.posten.map((p) => ({
      job_id: p.jobId,
      titel: e.titelJeId.get(p.jobId) ?? "",
      art: p.art,
      /* Die erlaubten Gründe — das Modell wählt, es formuliert nicht. */
      gruende: [p.grund].filter((g): g is string => typeof g === "string" && g.length > 0),
      caveat: p.caveat,
    })),
  });

  const antwort = await mitGrenze<{
    subject: string;
    intro: string;
    closing: string;
    basis_label: string;
    items: Mailposten[];
  }>(db, {
    userId: e.userId,
    zweck: "suchauftrag:mailtext",
    promptKey: "zusammenfassung",
    promptVersion: e.prompt.fassung,
    system: e.prompt.anweisung,
    text: eingabe,
    schema: e.prompt.schema,
    schemaName: "velvova_zusammenfassung",
    tier: "fast",
    rufer: e.rufer,
    /* Keine Empfehlung, kein Aufruf. Es gibt nichts zu formulieren. */
    lohntSich: e.posten.length > 0,
  });

  if (!antwort.ok) return ersatzfassung(e, antwort.grund);

  const rahmen = {
    ausgewaehlt: e.posten.map((p) => p.jobId),
    gruende: new Map(
      e.posten.map((p) => [p.jobId, [p.grund].filter((g): g is string => typeof g === "string" && g.length > 0)]),
    ),
    caveats: new Map(e.posten.map((p) => [p.jobId, p.caveat])),
  };
  const geprueft = mailtextPruefen(antwort.data.items ?? [], rahmen);

  /*
   * Eine geänderte Auswahl ist kein Formulierungsfehler.
   *
   * Sie heisst, dass das Modell Stellen hinzugefügt oder weggelassen
   * hat — also eine Entscheidung getroffen, die ihm nicht zusteht.
   * Dann gilt der ganze Text als unbrauchbar, nicht nur die Liste.
   */
  if (geprueft.auswahlVeraendert) {
    return {
      ...ersatzfassung(e, "auswahl_veraendert"),
      modell: { rueckfall: "auswahl_veraendert", hinweise: geprueft.hinweise },
    };
  }

  const betreff = antwort.data.subject?.trim() ?? "";
  const betreffOk =
    betreff.length >= 3 &&
    betreff.length <= 50 &&
    betreffZahlStimmt(betreff, e.posten.length);

  return {
    /* Ein Betreff mit falscher Zahl fällt einzeln zurück — Einleitung
       und Abschluss sind davon nicht berührt. */
    betreff: betreffOk ? betreff : e.ersatz.betreff,
    einleitung: antwort.data.intro?.trim() || e.ersatz.einleitung,
    abschluss: antwort.data.closing?.trim() || e.ersatz.abschluss,
    fassung: e.prompt.fassung,
    modell: {
      hinweise: geprueft.hinweise,
      betreffErsetzt: !betreffOk,
      /*
       * Das Basislabel des Modells wird verworfen, nicht verglichen.
       *
       * Es steht im Schema, weil der Auftrag es dort vorsieht — aber
       * ob ein Auftrag bestätigt oder ein Filter übernommen wurde,
       * weiss der Code und nicht das Modell. Ein falsches Label wäre
       * ein erfundenes Gespräch.
       */
      basisLabelVerworfen: antwort.data.basis_label ?? null,
    },
    gruende: new Map(geprueft.posten.map((p) => [p.job_id, p.reason])),
    caveats: new Map(geprueft.posten.map((p) => [p.job_id, p.caveat])),
  };
}
