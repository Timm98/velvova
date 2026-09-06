/**
 * Den Umkreis aus dem Satz lesen.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den dieses Modul behebt
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen am 6. September 2026 mit dem Satz
 *
 *   „Such für mich Lager- oder Logistikjobs bis 30 km um Karlsruhe,
 *    mindestens 36.000 € brutto, keine Zeitarbeit und möglichst
 *    geregelte Arbeitszeiten."
 *
 * Systemprompt 1 machte daraus `arbeitsort: ["karlsruhe"]` — einen
 * Vergleich von Ortsnamen — und schob die 30 km in eine Rückfrage.
 *
 * Das Ergebnis: Von 25 gefundenen Stellen wurde jede einzelne
 * ausgeschlossen. „Recycling- und Lagerhelfer" in Oberderdingen,
 * 28,7 km von Karlsruhe und damit innerhalb des gewünschten Umkreises,
 * scheiterte an `arbeitsort: nicht_erfuellt` — weil dort
 * „Oberderdingen" steht und nicht „Karlsruhe".
 *
 * Der Prüfer für `umkreis` war die ganze Zeit da, samt Haversine und
 * Begründungstext. Es hat ihn nur nie jemand erzeugt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht das Modell entscheidet
 * ══════════════════════════════════════════════════════════════
 *
 * Aus demselben Grund wie bei Muss und Wunsch: Eine Zahl, die im Satz
 * steht, gehört nicht geraten. „30 km" ist keine Auslegungsfrage.
 *
 * Und der Fehler ist teuer. Ein übersehener Umkreis macht aus einer
 * Suche im Umland eine Suche in einer einzigen Stadt — und die Liste
 * ist leer, ohne dass irgendwo ein Fehler steht.
 */

export interface Umkreisangabe {
  /** Der Radius in Kilometern. */
  km: number;
  /** Der Ort in der Mitte, im Wortlaut des Satzes. */
  ort: string;
}

/**
 * Die Obergrenze für einen glaubhaften Umkreis.
 *
 * ── Warum es eine gibt ────────────────────────────────────────
 *
 * „36.000 € brutto" enthält eine Zahl, und ein zu gieriges Muster
 * liest daraus 36.000 km. Ein Umkreis, der den halben Globus umspannt,
 * prüft nichts mehr — er sagt zu allem ja und sieht dabei aus wie eine
 * Eingrenzung.
 *
 * Fünfhundert Kilometer ist etwa die Nord-Süd-Ausdehnung
 * Deutschlands. Die Zahl ist eine Produktentscheidung, kein Messwert.
 */
export const UMKREIS_MAX_KM = 500;

/**
 * Wortformen, mit denen ein Umkreis geschrieben wird.
 *
 * Jedes Muster fängt die Zahl in Gruppe 1 und den Ort in Gruppe 2 —
 * bis auf das letzte, bei dem es umgekehrt ist.
 */
const MUSTER: readonly { regex: RegExp; ortZuerst?: boolean }[] = [
  /* „im Umkreis von 30 km um Karlsruhe" · „30 km rund um Karlsruhe" */
  {
    regex:
      /(?:im\s+)?umkreis\s+von\s+(\d{1,3})\s*(?:km|kilometer)\s*(?:um|von|rund um)\s+([^,.;]+)/i,
  },
  /* „bis 30 km um Karlsruhe" · „maximal 25 Kilometer von Stuttgart" */
  {
    regex:
      /(?:bis(?:\s+zu)?|max(?:imal)?\.?|höchstens|nicht\s+(?:weiter|mehr)\s+als)\s+(\d{1,3})\s*(?:km|kilometer)\s*(?:um|von|rund um|entfernt\s+von)\s+([^,.;]+)/i,
  },
  /* „30 km um Karlsruhe" — die knappste Form */
  { regex: /(\d{1,3})\s*(?:km|kilometer)\s+(?:um|rund um|von)\s+([^,.;]+)/i },
  /* „Umkreis Karlsruhe 30 km" */
  { regex: /umkreis\s+([^,.;\d]+?)\s+(\d{1,3})\s*(?:km|kilometer)/i, ortZuerst: true },
];

/** Wörter, die nach dem Ortsnamen stehen und nicht dazugehören. */
const NACHSATZ =
  /\s+(?:entfernt|herum|liegen|liegt|sein|sind|arbeiten|wohnen|suchen|gesucht|maximal|bitte)\b.*$/i;

/**
 * Den Umkreis aus einem Satz lesen. `null`, wenn keiner dasteht.
 *
 * ── Warum eine Zeitangabe nicht zählt ─────────────────────────
 *
 * „Höchstens eine halbe Stunde Fahrtzeit" ist eine Bedingung, aber
 * keine Entfernung. Sie in Kilometer umzurechnen hiesse, eine
 * Annahme über Verkehrsmittel und Verkehrslage zu treffen und sie als
 * Angabe der Person auszugeben.
 */
export function umkreisAusText(satz: string): Umkreisangabe | null {
  for (const { regex, ortZuerst } of MUSTER) {
    const treffer = regex.exec(satz);
    if (!treffer) continue;

    const km = Number(ortZuerst ? treffer[2] : treffer[1]);
    const rohOrt = (ortZuerst ? treffer[1] : treffer[2]) ?? "";
    if (!Number.isFinite(km) || km <= 0 || km > UMKREIS_MAX_KM) continue;

    const ort = rohOrt.replace(NACHSATZ, "").trim().replace(/\s+/g, " ");
    if (ort.length < 2) continue;

    return { km, ort };
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Zeitarbeit
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ob der Satz Zeitarbeit ausschliesst.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht dem Modell überlassen bleibt
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen am 6. September 2026: Aus „keine Zeitarbeit" machte
 * Systemprompt 1 ein `arbeitgeber_ausschluss: ["zeitarbeit"]` — einen
 * Vergleich des Firmennamens gegen die Zeichenkette „zeitarbeit".
 *
 * Das Ergebnis stand im Protokoll des echten Laufs:
 *
 *   erfuellt  arbeitgeber_ausschluss
 *             — Arbeitgeber Franz & Wach Personalservice GmbH
 *
 * Eine Personalservice-GmbH heisst nicht „Zeitarbeit", und die Prüfung
 * sagte ja. Die Stelle war `fixed_term` über einen Verleiher — also
 * genau das, was die Person ausgeschlossen hatte.
 *
 * Die Vertragsart steht als Feld in der Anzeige. Sie zu lesen ist
 * richtig; den Firmennamen zu durchsuchen ist eine Vermutung, die
 * aussieht wie eine Prüfung.
 *
 * ── Warum der Firmenname trotzdem geprüft wird ────────────────
 *
 * Weil `contract_type` fehlen kann. Zwei Prüfungen, die beide
 * stimmen müssen, sind strenger als eine — und für einen
 * ausdrücklichen Ausschluss ist streng die richtige Richtung.
 */
const ZEITARBEIT =
  /\b(?:keine?|ohne|nicht)\s+(?:[\wäöüÄÖÜß]+\s+){0,2}?(zeitarbeit|leiharbeit|arbeitnehmerüberlassung|zeitarbeitsfirma|leihfirma|personalverleih)/i;

export function zeitarbeitAusgeschlossen(satz: string): boolean {
  return ZEITARBEIT.test(satz);
}
