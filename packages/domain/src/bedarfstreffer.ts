/**
 * ══════════════════════════════════════════════════════════════════
 * Aus bestätigtem Bedarf werden Vorschläge — und sonst nichts
 * ══════════════════════════════════════════════════════════════════
 *
 * Der gefährlichste Schritt im ganzen Produkt. Bis hierher hat ein
 * Betrieb über seine Abläufe gesprochen; ab hier kommen Menschen ins
 * Spiel, die davon nichts wissen.
 *
 * ── Die vier Riegel ─────────────────────────────────────────────
 *
 *   1. Gesucht wird erst ab `freigegebene_moeglichkeit`, und nur
 *      wenn der gewählte Weg einen Menschen von aussen braucht. Ein
 *      bestätigtes Problem allein reicht nicht.
 *   2. Durchsucht werden nur Profile, deren Menschen dem zugestimmt
 *      haben. Ein registriertes Konto ist kein Kandidatenpool.
 *   3. Die Vorschau ist intern. Sie löst keine Nachricht aus und legt
 *      dem Betrieb keine Person offen, die nicht freigegeben hat.
 *   4. Was der Mensch als Untergrenze hinterlegt hat, erfährt die
 *      Gegenseite nicht — auch dann nicht, wenn es passt.
 *
 * ── Warum „keine passenden Personen" ein Ergebnis ist ───────────
 *
 * Weil die Alternative ist, die Schwelle zu senken, bis fünf Zeilen
 * dastehen. Ein Betrieb, der fünfmal jemanden angeschrieben hat, den
 * das System selbst für unpassend hielt, glaubt der sechsten Liste
 * nicht mehr.
 */

import { brauchtMenschen, ebenenrang, type Ebene, type Loesungsart } from "./bedarfsebenen.ts";

/** Höchstens so viele Vorschläge. Mehr liest niemand, und mehr meint niemand ernst. */
export const MAX_VORSCHLAEGE = 5;

/**
 * Harte Bedingungen kennen drei Antworten, nicht zwei.
 *
 * `unbekannt` ist die häufigste und die wichtigste: Wer sie zu
 * `nicht_erfuellt` rundet, sortiert alle aus, die eine Angabe nicht
 * gemacht haben — und wer sie zu `erfuellt` rundet, verspricht dem
 * Betrieb etwas, das niemand gesagt hat.
 */
export const BEDINGUNGSSTAENDE = ["erfuellt", "nicht_erfuellt", "unbekannt"] as const;
export type Bedingungsstand = (typeof BEDINGUNGSSTAENDE)[number];

export interface Bedingungslage {
  bedingung: string;
  stand: Bedingungsstand;
  /** Was dafür spricht. Bei `unbekannt` steht hier, was fehlt. */
  begruendung: string;
}

export interface Bedarfskandidat {
  userId: string;
  /** 0–100 aus derselben Rechnung wie überall. `null` heisst: nicht ermittelbar. */
  passung: number | null;
  /** 0–1. Ohne sie ist die Passung eine Zahl ohne Aussage. */
  abdeckung: number | null;
  bedingungen: readonly Bedingungslage[];
  /** Nachweise, die dieser Mensch zur Weitergabe freigegeben hat. */
  freigegebeneNachweise: readonly string[];
}

/**
 * Darf zu diesem Vorgang überhaupt gesucht werden?
 *
 * Der erste Riegel, und er sitzt in der Domäne statt in der
 * Oberfläche, weil er auch für jeden künftigen Aufrufer gelten muss.
 */
export function darfGesuchtWerden(
  ebene: Ebene,
  weg: Loesungsart | null,
): { ja: boolean; grund: string } {
  if (ebenenrang(ebene) < ebenenrang("freigegebene_moeglichkeit")) {
    return {
      ja: false,
      grund: "Der Bedarf ist noch nicht freigegeben. Vorher wird niemand gesucht.",
    };
  }
  if (weg === null || !brauchtMenschen(weg)) {
    return {
      ja: false,
      grund: "Der gewählte Weg braucht keinen Menschen von aussen.",
    };
  }
  return { ja: true, grund: "" };
}

/**
 * Was eine harte Bedingung ergibt.
 *
 * Beide Seiten müssen etwas gesagt haben. Fehlt eine Angabe, ist die
 * Antwort `unbekannt` — und das ist ein offener Punkt, kein Ausschluss.
 */
export function bedingungPruefen(
  bedingung: string,
  verlangt: string | number | null,
  vorhanden: string | number | null,
  passt: (a: string | number, b: string | number) => boolean,
): Bedingungslage {
  if (verlangt === null) {
    return { bedingung, stand: "unbekannt", begruendung: "Der Bedarf sagt dazu nichts." };
  }
  if (vorhanden === null) {
    return { bedingung, stand: "unbekannt", begruendung: "Dazu liegt keine Angabe der Person vor." };
  }
  return passt(verlangt, vorhanden)
    ? { bedingung, stand: "erfuellt", begruendung: "Beide Angaben passen zusammen." }
    : { bedingung, stand: "nicht_erfuellt", begruendung: "Die Angaben widersprechen sich." };
}

export type Trefferlage =
  | { art: "gesperrt"; grund: string }
  | { art: "keine"; geprueft: number }
  | { art: "vorschlaege"; kandidaten: Bedarfskandidat[]; geprueft: number; weitere: number };

/**
 * Die Vorschläge zu einem freigegebenen Bedarf.
 *
 * ── Warum die Zahl der Geprüften mitgeht ────────────────────────
 *
 * Weil „keine passenden Personen" zwei sehr verschiedene Dinge heissen
 * kann: Es hat niemand zugestimmt, gefunden zu werden — oder es haben
 * vierhundert zugestimmt und keiner passt. Das eine ist ein Problem
 * der Plattform, das andere eine Auskunft über den Bedarf.
 */
export function trefferlage(
  ebene: Ebene,
  weg: Loesungsart | null,
  kandidaten: readonly Bedarfskandidat[],
  geprueft: number,
): Trefferlage {
  const darf = darfGesuchtWerden(ebene, weg);
  if (!darf.ja) return { art: "gesperrt", grund: darf.grund };

  /*
   * Wer eine harte Bedingung verletzt, fällt heraus. `unbekannt`
   * fällt NICHT heraus — es wird als offener Punkt gezeigt.
   */
  const uebrig = kandidaten.filter((k) => !k.bedingungen.some((b) => b.stand === "nicht_erfuellt"));
  if (uebrig.length === 0) return { art: "keine", geprueft };

  const sortiert = [...uebrig].sort((a, b) => {
    /* Ohne Passung ganz nach hinten — aber nicht heraus. */
    const pa = a.passung ?? -1;
    const pb = b.passung ?? -1;
    if (pa !== pb) return pb - pa;
    return a.userId.localeCompare(b.userId);
  });

  return {
    art: "vorschlaege",
    kandidaten: sortiert.slice(0, MAX_VORSCHLAEGE),
    geprueft,
    weitere: Math.max(0, sortiert.length - MAX_VORSCHLAEGE),
  };
}

/**
 * Die offenen Punkte eines Vorschlags — die Sätze, die dabeistehen.
 *
 * Sie stehen neben dem Vorschlag und nicht darunter. Ein Vorschlag
 * ohne seine offenen Punkte liest sich wie eine Zusage.
 */
export function offeneTrefferpunkte(k: Bedarfskandidat): string[] {
  const raus = k.bedingungen
    .filter((b) => b.stand === "unbekannt")
    .map((b) => `${b.bedingung}: ${b.begruendung}`);

  if (k.abdeckung !== null && k.abdeckung < 0.4) {
    raus.push(
      "Über diese Person ist wenig bekannt. Die Passung beruht auf wenigen Angaben und sagt entsprechend wenig.",
    );
  }
  if (k.freigegebeneNachweise.length === 0) {
    raus.push("Es liegt kein freigegebener Nachweis vor — nur Selbstauskunft.");
  }
  return raus;
}

/**
 * Ein überlappendes Preisband ist keine vereinbarte Vergütung.
 *
 * Der Satz steht im Produkt, weil der Irrtum sonst unvermeidlich ist:
 * Zwei Zahlen, die sich überschneiden, sehen aus wie eine Einigung.
 */
export function preisbandSatz(ueberlappt: boolean | null): string {
  if (ueberlappt === null) return "Zur Vergütung liegt auf mindestens einer Seite nichts vor.";
  return ueberlappt
    ? "Die Vorstellungen überschneiden sich. Das ist keine Vereinbarung — verhandelt ist nichts."
    : "Die Vorstellungen überschneiden sich nicht.";
}

/**
 * Der Fingerabdruck, an dem ein veralteter Vorschlag zu erkennen ist.
 *
 * ── Warum überhaupt ─────────────────────────────────────────────
 *
 * „Veränderungen machen veraltete Empfehlungen sichtbar." Ein
 * Vorschlag, der auf einem Bedarf von vor drei Monaten und einem
 * Profil von vor sechs Wochen beruht, ist keine Aussage über heute.
 * Ohne diesen Vergleich sähe er genauso aus wie ein frischer.
 *
 * Die Bestandteile sind Versionsstände, keine Inhalte: Was verglichen
 * wird, ist ob sich etwas geändert hat — nicht was.
 */
export function grundlageAus(teile: {
  bedarfStand: string;
  profilStand: string;
  nachweisStand: string;
}): string {
  return [teile.bedarfStand, teile.profilStand, teile.nachweisStand].join("|");
}

export function istVeraltet(damals: string, jetzt: string): boolean {
  return damals !== jetzt;
}
