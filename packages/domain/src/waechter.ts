/**
 * ══════════════════════════════════════════════════════════════════
 * Der Wächter — und warum er fast immer schweigt
 * ══════════════════════════════════════════════════════════════════
 *
 * „Deine Firma hat gestern eine Stelle ausgeschrieben, die deiner sehr
 * ähnlich ist."
 *
 * Das ist der Satz, für den es dieses Modul gibt. Er sagt einem
 * Menschen etwas über sein eigenes Leben, das er sonst erst erfährt,
 * wenn es zu spät ist — und niemand sonst kann ihn schicken, weil
 * niemand sonst alle Stellenanzeigen sieht und gleichzeitig weiss, wo
 * dieser Mensch arbeitet.
 *
 * ── Warum dieses Modul zu 99 % aus Bremsen besteht ──────────────
 *
 * Weil ein falscher Alarm hier anders wiegt als anderswo. Wer wegen
 * einer falsch zugeordneten Anzeige eine Nacht wachliegt, schaltet
 * den Wächter ab — und erzählt es weiter. Ein Marktwert, der
 * danebenliegt, kostet Glaubwürdigkeit. Ein Wächter, der grundlos
 * warnt, kostet den Menschen.
 *
 * Deshalb gilt hier die Umkehrung der üblichen Frage. Nicht „ist es
 * ähnlich genug?", sondern „gibt es einen Grund, NICHT zu warnen?".
 * Jeder Zweifel führt zum Schweigen.
 *
 * ── Was das Schweigen wert ist ──────────────────────────────────
 *
 * Ein Wächter, der monatelang nichts sagt, wirkt wie ein Dienst, der
 * nichts tut. Er ist aber genau dann am wertvollsten: Das Schweigen
 * ist die Auskunft „es ist nichts passiert", und sie ist nur etwas
 * wert, wenn man ihr trauen kann.
 */

/* ── Firmenabgleich ───────────────────────────────────────────── */

/**
 * Rechtsformen und Zusätze, die zwei Schreibweisen derselben Firma
 * unterscheiden, ohne dass es eine andere Firma wäre.
 */
const FORMEN =
  /\b(gmbh|mbh|ag|kg|ohg|gbr|ug|se|e\.?\s?v\.?|e\.?\s?k\.?|ltd|limited|inc|corp|co|company|holding|group|gruppe|deutschland|germany|international|and|und|&)\b/gi;

/**
 * Ein Firmenname in vergleichbarer Form.
 *
 * Absichtlich konservativ: Es wird nur entfernt, was sicher kein
 * Namensbestandteil ist. „Schmidt Logistik" und „Schmidt Bau" bleiben
 * verschieden — sie zusammenzuziehen wäre genau der Fehler, der einen
 * falschen Alarm auslöst.
 */
export function firmennameNormalisieren(roh: string | null | undefined): string {
  return (roh ?? "")
    .toLowerCase()
    .replace(/[.,()"'’`]/g, " ")
    .replace(FORMEN, " ")
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wie eindeutig ein Firmenname ist.
 *
 * ── Warum das überhaupt geprüft wird ────────────────────────────
 *
 * „Müller GmbH" gibt es hundertmal. Eine Anzeige der einen Müller
 * GmbH als Anzeige der anderen zu lesen, erzeugt einen Alarm über ein
 * Ereignis, das nie stattgefunden hat.
 *
 * Ein Name aus einem einzigen kurzen Wort ist deshalb nicht genug —
 * ausser er ist ungewöhnlich lang oder trägt eine Ziffer, wie es
 * Marken oft tun.
 */
export function nameIstEindeutig(normalisiert: string): boolean {
  const woerter = normalisiert.split(" ").filter(Boolean);
  if (woerter.length === 0) return false;
  if (woerter.length >= 2) return true;
  const eines = woerter[0]!;
  return eines.length >= 8 || /\d/.test(eines);
}

/* ── Positionsabgleich ────────────────────────────────────────── */

/**
 * Wörter, die in fast jedem Stellentitel stehen und deshalb nichts
 * über die Ähnlichkeit zweier Titel aussagen.
 */
const FUELLWOERTER = new Set([
  "m", "w", "d", "mwd", "gn", "x", "in", "der", "die", "das", "für", "im", "am", "und", "oder",
  "vollzeit", "teilzeit", "unbefristet", "befristet", "remote", "hybrid", "homeoffice",
  "job", "stelle", "position", "mitarbeiter", "mitarbeiterin", "gesucht", "neu",
]);

export function titelWoerter(roh: string | null | undefined): string[] {
  return (roh ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !FUELLWOERTER.has(w));
}

/**
 * Wie ähnlich sich zwei Stellentitel sind, zwischen 0 und 1.
 *
 * Gemessen an den bedeutungstragenden Wörtern und nicht an Zeichen:
 * „Buchhalter" und „Buchhalterin" sollen als dasselbe gelten,
 * „Bilanzbuchhalter" und „Lohnbuchhalter" nicht — und zeichenweise
 * liegen die beiden Paare gleich weit auseinander.
 */
export function titelAehnlichkeit(a: string | null | undefined, b: string | null | undefined): number {
  const wa = titelWoerter(a);
  const wb = titelWoerter(b);
  if (wa.length === 0 || wb.length === 0) return 0;

  const treffer = wa.filter((w) =>
    wb.some((v) => v === w || (v.length >= 5 && w.length >= 5 && (v.startsWith(w) || w.startsWith(v)))),
  ).length;

  /* Am kürzeren Titel gemessen: „Buchhalter" gegen „Buchhalter
     Kreditoren" ist eine hohe Ähnlichkeit — der längere Titel ist die
     genauere Fassung derselben Stelle, nicht eine andere. */
  return treffer / Math.min(wa.length, wb.length);
}

/* ── Der Befund ───────────────────────────────────────────────── */

/**
 * Ab wann zwei Titel als dieselbe Position gelten.
 *
 * Zwei Drittel der bedeutungstragenden Wörter. Bei 0,5 hiesse das:
 * die Hälfte passt, die andere nicht — und „Vertriebsleiter Nord"
 * gegen „Vertriebsmitarbeiter Innendienst" käme durch.
 */
export const AEHNLICH_AB = 0.66;

export interface Anzeige {
  jobId: string;
  titel: string;
  firma: string;
  /** Wann sie zuerst gesehen wurde. */
  gesehenAm: Date;
}

export interface Arbeitsplatz {
  /** Der Arbeitgeber laut Profil. */
  firma: string | null;
  /** Die eigene Position laut Profil. */
  position: string | null;
}

export type Waechterbefund =
  | {
      art: "warnung";
      jobId: string;
      titel: string;
      aehnlichkeit: number;
      gesehenAm: Date;
    }
  | {
      art: "still";
      /**
       * Warum nicht gewarnt wird. Nicht für den Menschen, sondern für
       * die Prüfung: Ein Wächter, dessen Schweigen niemand erklären
       * kann, ist nicht zu belegen — und dann glaubt ihm auch das
       * Warnen niemand.
       */
      grund:
        | "kein_arbeitgeber_im_profil"
        | "keine_position_im_profil"
        | "firmenname_zu_unspezifisch"
        | "andere_firma"
        | "andere_position";
    };

/**
 * Ist diese Anzeige die eigene Stelle beim eigenen Arbeitgeber?
 *
 * Rein und ohne Datenbank: Die Entscheidung, einen Menschen zu
 * beunruhigen, gehört an eine Stelle, die sich vollständig prüfen
 * lässt.
 */
export function waechterPruefen(platz: Arbeitsplatz, anzeige: Anzeige): Waechterbefund {
  if (!platz.firma?.trim()) return { art: "still", grund: "kein_arbeitgeber_im_profil" };
  if (!platz.position?.trim()) return { art: "still", grund: "keine_position_im_profil" };

  const meine = firmennameNormalisieren(platz.firma);
  const ihre = firmennameNormalisieren(anzeige.firma);

  if (!nameIstEindeutig(meine)) return { art: "still", grund: "firmenname_zu_unspezifisch" };

  /*
   * Gleichheit, keine Ähnlichkeit.
   *
   * Bei der Firma wird nicht geschätzt. „Bosch" und „Bosch Rexroth"
   * sind verschiedene Arbeitgeber, und ein Wächter, der sie
   * verwechselt, warnt jemanden vor der Umstrukturierung einer Firma,
   * für die er nicht arbeitet.
   */
  if (meine !== ihre) return { art: "still", grund: "andere_firma" };

  const naehe = titelAehnlichkeit(platz.position, anzeige.titel);
  if (naehe < AEHNLICH_AB) return { art: "still", grund: "andere_position" };

  return {
    art: "warnung",
    jobId: anzeige.jobId,
    titel: anzeige.titel,
    aehnlichkeit: Math.round(naehe * 100) / 100,
    gesehenAm: anzeige.gesehenAm,
  };
}
