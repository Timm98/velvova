import { type Angabe, bewerte } from "./bewertung";
import { BEREICHSNAME, FELDER, LEERFORMELN, type OnboardingFeld } from "./felder";
import type { Fund } from "./leser";

/**
 * Was Nina als Nächstes sagt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Frage aus einer Regel kommt und nicht aus dem Modell
 * ══════════════════════════════════════════════════════════════
 *
 * Die Fragen stehen bereits in `felder.ts` — jemand hat sie
 * geschrieben, jede zu einem bestimmten Feld. Ein Modell würde daraus
 * jedes Mal eine leicht andere Formulierung machen, gelegentlich zwei
 * Fragen auf einmal stellen und irgendwann nach etwas fragen, das
 * schon beantwortet ist.
 *
 * Die Auswahl ist eine Reihenfolge, keine Erfindung. Das Modell
 * arbeitet in diesem System an genau einer Stelle: beim Lesen dessen,
 * was der Mensch geantwortet hat (`deutung.ts`).
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Leerformel vorgeht
 * ══════════════════════════════════════════════════════════════
 *
 * Wer gerade „attraktives Gehalt“ gesagt hat, hat die Frage nach dem
 * Gehalt für beantwortet gehalten. Eine Rückfrage zwei Züge später
 * wirkt wie ein Missverständnis; sofort gestellt ist sie ein Gespräch.
 */

export type Zug = {
  /** Was Nina sagt. */
  text: string;
  /** Worauf sich die Frage bezieht — für Hervorhebung in der Vorschau. */
  bezug: { bereich: string; feld: string } | null;
  /** Ob das Gespräch inhaltlich am Ende ist. */
  fertig: boolean;
};

/* ── Bestätigung: was Nina verstanden hat ─────────────────────── */

/** Einen Wert so schreiben, wie ein Mensch ihn vorlesen würde. */
export function wertText(wert: unknown): string {
  if (wert === null || wert === undefined) return "—";
  if (Array.isArray(wert)) return wert.join(", ");
  if (typeof wert === "object") {
    const s = wert as { von?: number; bis?: number; waehrung?: string };
    if (typeof s.von === "number" && typeof s.bis === "number") {
      const f = (n: number) => n.toLocaleString("de-DE");
      return `${f(s.von)} bis ${f(s.bis)} ${s.waehrung ?? "EUR"}`;
    }
    return JSON.stringify(wert);
  }
  if (typeof wert === "number") return wert.toLocaleString("de-DE");
  return String(wert);
}

const LABEL = new Map(FELDER.map((f) => [`${f.bereich}.${f.feld}`, f.label]));

/**
 * Was Nina zurückspiegelt.
 *
 * Nur die Werte, keine Bewertung. „Ich habe verstanden: 25
 * Mitarbeitende“ lässt sich widersprechen; „Klingt nach einem
 * spannenden Unternehmen“ nicht.
 */
export function quittung(funde: Fund[]): string {
  if (funde.length === 0) return "";
  const zeilen = funde
    .slice(0, 8)
    .map((f) => `${LABEL.get(`${f.bereich}.${f.feld}`) ?? f.feld}: ${wertText(f.wert)}`);
  const rest = funde.length - zeilen.length;
  return (
    "Ich habe notiert:\n" +
    zeilen.map((z) => `• ${z}`).join("\n") +
    (rest > 0 ? `\n• … und ${rest} weitere` : "")
  );
}

/* ── Die nächste Frage ────────────────────────────────────────── */

function gefuellt(a: Angabe | undefined): boolean {
  if (!a || a.status === "nicht_angegeben") return false;
  const w = a.wert;
  if (w === null || w === undefined) return false;
  if (typeof w === "string") return w.trim().length > 0;
  if (Array.isArray(w)) return w.length > 0;
  return true;
}

/**
 * Leerformeln in einer Antwort finden.
 *
 * Läuft auf dem Wortlaut, nicht auf den Funden: Die Formel ist ja
 * gerade das, woraus die Extraktion nichts machen konnte.
 */
export function leerformeln(text: string) {
  return LEERFORMELN.filter((l) => l.muster.test(text));
}

export function naechsterZug(opt: {
  angaben: Angabe[];
  /** Die letzte Antwort des Menschen — für die Leerformelprüfung. */
  letzteAntwort?: string;
  /** Felder, nach denen in diesem Gespräch schon gefragt wurde. */
  bereitsGefragt?: string[];
}): Zug {
  const gefragt = new Set(opt.bereitsGefragt ?? []);
  const nach = new Map(opt.angaben.map((a) => [`${a.bereich}.${a.feld}`, a]));
  const da = (f: OnboardingFeld) => gefuellt(nach.get(`${f.bereich}.${f.feld}`));

  /* ── 1. Leerformel: sofort, sonst nie ──────────────────────── */
  if (opt.letzteAntwort) {
    for (const l of leerformeln(opt.letzteAntwort)) {
      if (gefragt.has(`leerformel:${l.label}`)) continue;
      return {
        text: `Ihr schreibt „${l.label}“. ${l.frage}`,
        bezug: null,
        fertig: false,
      };
    }
  }

  const offenMitFrage = (nurZwingend: boolean) =>
    FELDER.find(
      (f) =>
        (nurZwingend ? f.zwingend === true : true) &&
        f.frage !== undefined &&
        !da(f) &&
        !gefragt.has(`${f.bereich}.${f.feld}`),
    );

  /* ── 2. Was ohne Antwort nicht veröffentlicht werden kann ──── */
  const zwingend = offenMitFrage(true);
  if (zwingend) {
    return {
      text: zwingend.frage!,
      bezug: { bereich: zwingend.bereich, feld: zwingend.feld },
      fertig: false,
    };
  }

  /*
   * ── 3. Die Rückfrage ───────────────────────────────────────
   *
   * Ein Wert steht da, aber die Entscheidung dahinter nicht. „Drei
   * Jahre Erfahrung“ ist erst dann eine Anforderung, wenn jemand
   * gesagt hat, dass zwei Jahre nicht reichen — vorher ist es eine
   * Zahl, die aus einer alten Anzeige übernommen wurde.
   */
  const rueck = FELDER.find(
    (f) =>
      f.nachfrage !== undefined &&
      da(f) &&
      nach.get(`${f.bereich}.${f.feld}`)?.status !== "bestaetigt" &&
      !gefragt.has(`nachfrage:${f.bereich}.${f.feld}`),
  );
  if (rueck) {
    return {
      text: rueck.nachfrage!,
      bezug: { bereich: rueck.bereich, feld: rueck.feld },
      fertig: false,
    };
  }

  /* ── 4. Was die Anzeige besser macht, aber nicht blockiert ─── */
  const freiwillig = offenMitFrage(false);
  if (freiwillig) {
    return {
      text: freiwillig.frage!,
      bezug: { bereich: freiwillig.bereich, feld: freiwillig.feld },
      fertig: false,
    };
  }

  /* ── 5. Fertig — aber nur, wenn wirklich fertig ─────────────── */
  const anzeige = bewerte("anzeige", opt.angaben);
  const matching = bewerte("matching", opt.angaben);
  if (anzeige.bereit && matching.bereit) {
    return {
      text:
        "Das reicht mir. Schau dir rechts an, was daraus geworden ist — " +
        "und korrigier alles, was ich falsch verstanden habe. " +
        "Erst wenn du bestätigst, geht etwas davon nach draussen.",
      bezug: null,
      fertig: true,
    };
  }

  /*
   * Es gibt keine Frage mehr, aber es fehlt noch etwas — das
   * passiert bei Feldern ohne eigene `frage`, etwa `standort.ort`.
   * Dann benennt Nina die Lücke, statt „fertig“ zu sagen.
   */
  const fehlt = [...anzeige.fehlendZwingend, ...matching.fehlendZwingend][0];
  if (fehlt) {
    return {
      text: `Mir fehlt noch eine Angabe: ${fehlt.label} (${BEREICHSNAME[fehlt.bereich] ?? fehlt.bereich}). Trag sie rechts ein oder sag sie mir.`,
      bezug: { bereich: fehlt.bereich, feld: fehlt.feld },
      fertig: false,
    };
  }

  return { text: "Ich habe keine offenen Fragen mehr.", bezug: null, fertig: true };
}

/** Die Begrüssung — der einzige Text, der nicht aus einem Feld kommt. */
export const ERSTER_ZUG: Zug = {
  text:
    "Erzähl mir von der Stelle, die du besetzen willst. In eigenen Worten — " +
    "ich sortiere das und frage nach, wo etwas fehlt.",
  bezug: null,
  fertig: false,
};
