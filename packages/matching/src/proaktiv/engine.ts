import {
  darfSelbstHandeln,
  handlungBekannt,
  klasseVon,
  POLICY_FASSUNG,
  type Handlungsart,
} from "./handlungsklassen.ts";
import type { Verhaltenssignal } from "./signale.ts";

/**
 * Wann Monday von selbst etwas tut — und wann sie besser schweigt.
 *
 * ══════════════════════════════════════════════════════════════
 * Regeln zuerst, Modell nur wenn nötig
 * ══════════════════════════════════════════════════════════════
 *
 * „Stelle dreimal geöffnet, Gehalt und Anforderungen angesehen" führt
 * zu genau einer sinnvollen Handlung: vormerken. Dafür ein
 * Sprachmodell zu fragen kostet Geld, dauert Sekunden und liefert bei
 * jedem Lauf eine andere Formulierung derselben Sache.
 *
 * Das Modell kommt erst ins Spiel, wenn mehrere Handlungen plausibel
 * sind oder ein Satz formuliert werden muss, der nicht vorgeschrieben
 * werden kann.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Engine auch „nichts tun" als Ergebnis kennt
 * ══════════════════════════════════════════════════════════════
 *
 * Weil eine Assistentin, die ständig etwas beiträgt, keine Hilfe ist,
 * sondern ein Störgeräusch. Der häufigste richtige Ausgang dieser
 * Funktion ist `null`.
 */

export interface Gelegenheit {
  handlung: Handlungsart;
  /** Warum — in der Sprache der Person, für „Warum hat Monday das gemacht?" */
  begruendung: string;
  jobId: string | null;
  belegEreignisse: string[];
  /** Ob die Person zustimmen muss. Ergibt sich aus der Klasse, nicht aus dem Modell. */
  brauchtZustimmung: boolean;
  dringlichkeit: "niedrig" | "mittel" | "hoch";
  /** Die kurze Nachricht im Chat — `null` heisst: still ausführen. */
  nachricht: string | null;
  /** Die betroffenen Stellen, wenn es mehr als eine ist. */
  stellen?: string[];
  /**
   * Woran die Gelegenheit hängt, wenn nicht an einer Stelle.
   *
   * Eine Klärung hat keine `jobId` — sie hängt an einer Aussage oder
   * an einem Wissensfeld. Ohne diesen Schlüssel wären zwei
   * verschiedene Widersprüche für die Entdopplung dasselbe: gleiche
   * Handlungsart, beide ohne Stelle.
   */
  schluessel?: string;
  /**
   * Wie wichtig sie ist, 0 bis 1 — aus `relevanz.ts`.
   *
   * Fehlt sie, entscheidet allein die Zurückhaltung. Das ist der Fall
   * für die Gelegenheiten aus Verhaltenssignalen, die ohnehin nur
   * einen engen Wertebereich haben.
   */
  relevanz?: number;
}

/* ═══════════════════════════════════════════════════════════════
   Zurückhaltung
   ═══════════════════════════════════════════════════════════════ */

export type Eigeninitiative = "zurueckhaltend" | "ausgeglichen" | "proaktiv";

export interface Zurueckhaltung {
  /** Mindestabstand zwischen zwei proaktiven Nachrichten, in Minuten. */
  abstandMinuten: number;
  /** Höchstzahl proaktiver Hinweise je Sitzung. */
  jeSitzung: number;
  /** Wie lange ein abgelehnter Vorschlag nicht wiederkommt, in Tagen. */
  abgelehntTage: number;
}

/**
 * Die drei Stufen.
 *
 * ── Was die Einstellung NICHT ändert ──────────────────────────
 *
 * Welche Handlungen erlaubt sind. „Proaktiv" macht Monday häufiger,
 * nicht mächtiger. Wer die Häufigkeit mit der Berechtigung
 * vermischt, baut eine Einstellung, mit der sich Sicherheitsregeln
 * abschalten lassen.
 *
 * Die Zahlen sind Produktentscheidungen, keine Messwerte.
 */
export const ZURUECKHALTUNG: Record<Eigeninitiative, Zurueckhaltung> = {
  zurueckhaltend: { abstandMinuten: 60, jeSitzung: 1, abgelehntTage: 30 },
  ausgeglichen: { abstandMinuten: 10, jeSitzung: 3, abgelehntTage: 7 },
  proaktiv: { abstandMinuten: 4, jeSitzung: 6, abgelehntTage: 7 },
};

export interface Zustand {
  /** Wann Monday zuletzt von sich aus etwas gesagt hat. */
  letzteNachricht: Date | null;
  /** Wie viele proaktive Hinweise in dieser Sitzung schon kamen. */
  inSitzung: number;
  /** Themen, die in dieser Sitzung schon dran waren. */
  themenDerSitzung: ReadonlySet<string>;
  /** Handlungsarten, die die Person kürzlich abgelehnt hat, mit Zeitpunkt. */
  abgelehnt: ReadonlyMap<string, Date>;
  /** Welche automatischen Handlungen die Person abgeschaltet hat. */
  abgeschaltet: ReadonlySet<string>;
  einstellung: Eigeninitiative;
}

export type Ablehnungsgrund =
  | "unbekannte_handlung"
  | "abgeschaltet"
  | "kuerzlich_abgelehnt"
  | "zu_frueh"
  | "genug_fuer_diese_sitzung"
  | "thema_schon_dran";

export interface Zurueckhaltungsbefund {
  erlaubt: boolean;
  grund: Ablehnungsgrund | null;
}

/**
 * Darf diese Gelegenheit jetzt zu einer Nachricht werden?
 *
 * ── Warum stilles Handeln die Grenzen nicht sprengt ───────────
 *
 * Eine Handlung ohne Nachricht stört niemanden. Sie taucht in „Von
 * Monday automatisch" auf, wo die Person sie sieht, wenn sie hinsieht.
 * Die Abstände hier gelten dem Unterbrechen, nicht dem Arbeiten.
 */
export function darfJetzt(
  gelegenheit: Gelegenheit,
  zustand: Zustand,
  jetzt: Date,
): Zurueckhaltungsbefund {
  if (!handlungBekannt(gelegenheit.handlung))
    return { erlaubt: false, grund: "unbekannte_handlung" };

  if (zustand.abgeschaltet.has(gelegenheit.handlung))
    return { erlaubt: false, grund: "abgeschaltet" };

  const regeln = ZURUECKHALTUNG[zustand.einstellung];

  const abgelehntAm = zustand.abgelehnt.get(gelegenheit.handlung);
  if (abgelehntAm) {
    const tage = (jetzt.getTime() - abgelehntAm.getTime()) / (24 * 60 * 60 * 1000);
    if (tage < regeln.abgelehntTage) return { erlaubt: false, grund: "kuerzlich_abgelehnt" };
  }

  /* Ohne Nachricht endet die Prüfung hier — es wird niemand gestört. */
  if (gelegenheit.nachricht === null) return { erlaubt: true, grund: null };

  if (zustand.themenDerSitzung.has(gelegenheit.handlung))
    return { erlaubt: false, grund: "thema_schon_dran" };

  if (zustand.inSitzung >= regeln.jeSitzung)
    return { erlaubt: false, grund: "genug_fuer_diese_sitzung" };

  if (zustand.letzteNachricht) {
    const minuten = (jetzt.getTime() - zustand.letzteNachricht.getTime()) / 60_000;
    if (minuten < regeln.abstandMinuten) return { erlaubt: false, grund: "zu_frueh" };
  }

  return { erlaubt: true, grund: null };
}

/* ═══════════════════════════════════════════════════════════════
   Von Signalen zu Gelegenheiten
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ab welcher Signalstärke Monday von selbst vormerkt.
 *
 * Produktentscheidung, kein Messwert. 0,5 entspricht genau der
 * Mindestzahl an Hinweisen — schwächer wäre ein einzelner Klick.
 */
export const VORMERKEN_AB = 0.5;

/**
 * Was sich aus den Signalen ergibt, ohne ein Modell zu fragen.
 *
 * ── Warum die Nachricht hier fest formuliert ist ──────────────
 *
 * Weil sie immer dasselbe sagt und nichts zu variieren hat. Ein
 * Modell würde bei jedem Lauf eine andere Wendung finden, und die
 * Person läse dieselbe Beobachtung dreimal verschieden formuliert —
 * was den Eindruck erweckt, es sei jedes Mal etwas anderes gemeint.
 */
export function gelegenheitenAusSignalen(signale: readonly Verhaltenssignal[]): Gelegenheit[] {
  const raus: Gelegenheit[] = [];

  for (const s of signale) {
    if (s.status === "rejected") continue;

    if (s.art === "interesse_an_stelle" && s.staerke >= VORMERKEN_AB && s.jobId) {
      raus.push({
        handlung: "job_vormerken",
        begruendung: s.beobachtung,
        jobId: s.jobId,
        belegEreignisse: s.belege,
        brauchtZustimmung: false,
        dringlichkeit: "niedrig",
        nachricht: `${s.beobachtung} Ich habe sie für dich vorgemerkt.`,
      });

      /*
       * Offene Fragen entstehen zusammen mit der Vormerkung.
       *
       * Wer eine Stelle mehrfach ansieht, prüft sie — und stösst dabei
       * auf das, was nicht dasteht. Die Liste vorzubereiten kostet
       * nichts und erspart es, vor dem Gespräch noch einmal die ganze
       * Anzeige zu durchsuchen.
       *
       * Ohne Nachricht: Der Hinweis zur Vormerkung ist schon draussen,
       * und zwei Meldungen über dieselbe Stelle sind eine zu viel.
       */
      raus.push({
        handlung: "offene_fragen_sammeln",
        begruendung: `Bei dieser Stelle fehlen Angaben, die vor einer Bewerbung zählen.`,
        jobId: s.jobId,
        belegEreignisse: s.belege,
        brauchtZustimmung: false,
        dringlichkeit: "niedrig",
        nachricht: null,
      });
    }

    /*
     * Ein Muster wird nie still ausgeführt.
     *
     * „Gehalt scheint dir wichtig" ändert, wonach gesucht wird. Das
     * ist eine Aussage über die Person, und die trifft sie selbst.
     * Deshalb `propose_first` und eine Frage, keine Feststellung.
     */
    if (s.art === "gehalt_wichtig") {
      raus.push({
        handlung: "suchauftrag_aendern",
        begruendung: s.beobachtung,
        jobId: null,
        belegEreignisse: s.belege,
        brauchtZustimmung: true,
        dringlichkeit: "niedrig",
        nachricht: `${s.beobachtung} Soll ich Stellen mit genannter Vergütung weiter oben zeigen?`,
      });
    }

    if (s.art === "remote_interesse") {
      raus.push({
        handlung: "hypothese_merken",
        begruendung: s.beobachtung,
        jobId: null,
        belegEreignisse: s.belege,
        brauchtZustimmung: false,
        dringlichkeit: "niedrig",
        /*
         * Eine Frage, keine Diagnose.
         *
         * „Eigentlich bist du ein Remote-Typ" wäre eine Behauptung über
         * einen Menschen aus vier Klicks. Die Vermutung wird notiert,
         * das Suchprofil bleibt unverändert, bis die Person antwortet.
         */
        nachricht: `${s.beobachtung} Ist das gerade wichtiger geworden, oder schaust du nur?`,
      });
    }
  }

  return raus;
}

/**
 * Wie viele Stellen ein vorbereiteter Vergleich umfasst.
 *
 * Drei ist die Zahl, die jemand noch nebeneinander lesen kann. Bei
 * fünf Spalten sucht man die Unterschiede, statt sie zu sehen.
 */
export const VERGLEICH_MAX = 3;

/**
 * Aus mehreren interessanten Stellen ein Vergleich.
 *
 * ── Warum das eine eigene Funktion ist ────────────────────────
 *
 * Weil es kein Signal einer einzelnen Stelle ist, sondern eine
 * Beziehung zwischen mehreren. `gelegenheitenAusSignalen` geht Signal
 * für Signal durch und kann das nicht sehen.
 */
export function vergleichsgelegenheit(
  signale: readonly Verhaltenssignal[],
): Gelegenheit | null {
  const interessant = signale
    .filter((s) => s.art === "interesse_an_stelle" && s.status !== "rejected" && s.jobId)
    .sort((a, b) => b.staerke - a.staerke)
    .slice(0, VERGLEICH_MAX);

  if (interessant.length < 2) return null;

  return {
    handlung: "vergleich_vorbereiten",
    begruendung: `Du hast dir ${interessant.length} ähnliche Stellen genauer angesehen.`,
    jobId: null,
    belegEreignisse: [...new Set(interessant.flatMap((s) => s.belege))],
    brauchtZustimmung: false,
    dringlichkeit: "niedrig",
    nachricht:
      "Du vergleichst gerade mehrere Stellen. Ich habe die wichtigsten Unterschiede schon zusammengestellt.",
    /* Welche Stellen — der Lauf braucht sie für das Ergebnis. */
    stellen: interessant.map((s) => s.jobId!),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Die letzte Prüfung
   ═══════════════════════════════════════════════════════════════ */

export interface Freigabe {
  handlung: Handlungsart;
  begruendung: string;
  jobId: string | null;
  belegEreignisse: string[];
  brauchtZustimmung: boolean;
  nachricht: string | null;
  stellen: string[];
  schluessel: string | null;
  policyFassung: string;
}

/**
 * Was tatsächlich ausgeführt werden darf.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum `brauchtZustimmung` hier neu gesetzt wird
 * ══════════════════════════════════════════════════════════════
 *
 * Weil es aus der Klasse folgt und nicht aus dem, was der Aufrufer
 * behauptet. Kommt die Gelegenheit aus einem Modellvorschlag, hat sie
 * ein `requires_confirmation` mitgebracht — und das ist genau das
 * Feld, das ein Modell falsch setzen kann.
 *
 * Der Wert wird deshalb nicht geprüft, sondern ersetzt. Was
 * `propose_first` ist, braucht Zustimmung, egal was danebensteht.
 */
export function freigeben(
  gelegenheit: Gelegenheit,
  zustand: Zustand,
  jetzt: Date,
): Freigabe | null {
  const klasse = klasseVon(gelegenheit.handlung);
  if (klasse === null) return null;

  /*
   * `explicit_only` erreicht diese Funktion nie mit Erfolg.
   *
   * Bewerbungen, Kündigungen, Zahlungen: Diese Handlungen entstehen
   * aus einem Auftrag der Person, nicht aus einer Beobachtung. Dass
   * die Engine sie nicht einmal vorschlagen kann, ist keine doppelte
   * Absicherung — es ist die Absicherung.
   */
  if (klasse === "explicit_only") return null;

  const brauchtZustimmung = !darfSelbstHandeln(gelegenheit.handlung);

  let befund = darfJetzt(gelegenheit, zustand, jetzt);

  /*
   * ══════════════════════════════════════════════════════════════
   * Die Sperren gelten dem Reden, nicht dem Arbeiten
   * ══════════════════════════════════════════════════════════════
   *
   * Ein Test hat das aufgedeckt: Zwei Stellen, beide mit genug
   * Hinweisen, und Monday merkte nur die erste vor. Grund war
   * `thema_schon_dran` — sie hatte in dieser Sitzung bereits über
   * eine Vormerkung gesprochen.
   *
   * Das war falsch. Die Person hätte die zweite Stelle verloren, weil
   * Monday zu höflich war, ein zweites Mal darüber zu reden. Die
   * Sperren sollen verhindern, dass sie nervt — nicht, dass sie hilft.
   *
   * Also: Was Monday selbst darf, tut sie auch dann, wenn sie gerade
   * nichts sagen darf. Nur eben still. Der Eintrag steht in „Von Monday
   * automatisch", wo die Person ihn sieht, wenn sie hinsieht.
   *
   * ── Warum das für `propose_first` nicht gilt ────────────────
   *
   * Weil ein Vorschlag ohne Frage kein Vorschlag ist. Ihn stumm
   * auszuführen wäre genau die Handlung ohne Zustimmung, die die
   * Klasse verhindert.
   */
  const nurWegenNachricht =
    !befund.erlaubt &&
    (befund.grund === "thema_schon_dran" ||
      befund.grund === "genug_fuer_diese_sitzung" ||
      befund.grund === "zu_frueh");

  if (nurWegenNachricht && !brauchtZustimmung) {
    gelegenheit = { ...gelegenheit, nachricht: null };
    befund = darfJetzt(gelegenheit, zustand, jetzt);
  }

  if (!befund.erlaubt) return null;

  return {
    handlung: gelegenheit.handlung,
    begruendung: gelegenheit.begruendung,
    jobId: gelegenheit.jobId,
    belegEreignisse: gelegenheit.belegEreignisse,
    brauchtZustimmung,
    /* Ein Vorschlag ohne Frage wäre eine Handlung ohne Zustimmung. */
    nachricht: brauchtZustimmung
      ? (gelegenheit.nachricht ?? gelegenheit.begruendung)
      : gelegenheit.nachricht,
    stellen: gelegenheit.stellen ?? [],
    schluessel: gelegenheit.schluessel ?? null,
    policyFassung: POLICY_FASSUNG,
  };
}
