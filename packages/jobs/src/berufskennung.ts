import { getDb, schema, withSystem } from "@paycheck/db";
import { isNotNull } from "drizzle-orm";

/**
 * Die amtliche Berufskennung beim Import setzen — nicht nachtragen.
 *
 * ── Was hier vorher passierte ─────────────────────────────────
 *
 * `kldb` wurde beim Import auf `null` gesetzt, mit der Begründung, die
 * Kennung entstehe erst aus der Zuordnung des Titels zu einer
 * amtlichen Bezeichnung. Das stimmte für fremde Quellen — und war für
 * die Bundesagentur falsch: Ihre Anzeigen tragen `hauptberuf`, also
 * genau diese Bezeichnung, von der Behörde selbst vergeben.
 *
 * Sie landete in `job_snapshots.raw_payload` und wurde nie gelesen. Ein
 * eigener Nachtragslauf holte dieselbe Information über einen
 * Netzaufruf je Titel wieder herein und kam nach Stunden auf 26 %.
 *
 * ── Warum die Tabelle in den Speicher passt ───────────────────
 *
 * `beruf_schluessel` hat 45.244 Zeilen mit Kennung — Name und fünf
 * Ziffern. Das sind wenige Megabyte und eine einzige Abfrage, statt
 * eines Nachschlagens je Anzeige. Bei einem Importlauf über 3.000
 * Anzeigen wären das 3.000 Netzrunden für eine Tabelle, die sich in
 * Stunden nicht ändert.
 */

let tabelle: { nach: Map<string, string>; bis: number } | null = null;
let letzterFehler: string | null = null;

/* Eine Stunde. Neue Berufe kommen selten dazu, und ein Importlauf
   dauert Minuten — innerhalb eines Laufs bliebe sie ohnehin gleich. */
const HALTBAR_MS = 60 * 60 * 1000;

/** Wie die Tabelle geladen wird — austauschbar, damit der Fehlerfall prüfbar ist. */
export type Tabellenlader = () => Promise<{ beruf: string; schluessel: string | null }[]>;

const AUS_DER_DATENBANK: Tabellenlader = async () => {
  const db = await getDb();
  return withSystem(db, (tx) =>
    tx
      .select({ beruf: schema.berufSchluessel.beruf, schluessel: schema.berufSchluessel.schluessel })
      .from(schema.berufSchluessel)
      .where(isNotNull(schema.berufSchluessel.schluessel)),
  );
};

/**
 * Die Nachschlagetabelle — oder eine leere, wenn sie nicht zu haben ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Fehler, die hier standen
 * ══════════════════════════════════════════════════════════════
 *
 * **Der Verbindungsaufbau lag ausserhalb der Absicherung.** Ein
 * `.catch` fing den Fehler der Abfrage ab, nicht den von `getDb()`.
 * Im Testlauf flog deshalb ein `PgliteBusyError` bis in einen Test,
 * der mit Datenbanken nichts zu tun hat — die eingebettete Datenbank
 * lässt genau einen Schreiber zu, und bei mehreren Testprozessen
 * konkurrieren sie um dieselbe Datei.
 *
 * **Ein Fehlschlag wurde eine Stunde lang behalten.** Das war der
 * teurere von beiden: Eine einzige Störung, und für die nächste
 * Stunde bekam keine einzige Anzeige eine Berufskennung — lautlos,
 * denn eine leere Tabelle sieht aus wie „dieser Beruf steht nicht
 * drin". Genau der Zustand, den der Kommentar über dieser Datei
 * ausschliessen will.
 *
 * ── Warum ein Fehlschlag trotzdem `null` ergibt und nicht wirft ─
 *
 * Weil eine erfundene Kennung schlimmer wäre als keine: Sie wählt
 * Titelbild, Arbeitsprobe und Gehaltsreferenz, und ein falsches
 * Ergebnis ist für den Lesenden nicht als falsch zu erkennen. Ein
 * Import, der wegen einer fehlenden Nachschlagetabelle abbricht,
 * wäre auch keine Verbesserung.
 *
 * Der Fehler verschwindet aber nicht: `schluesselstand()` gibt ihn
 * heraus, und der nächste Aufruf versucht es erneut.
 */
async function schluesseltabelle(lader: Tabellenlader = AUS_DER_DATENBANK): Promise<Map<string, string>> {
  if (tabelle && tabelle.bis > Date.now()) return tabelle.nach;

  let zeilen: { beruf: string; schluessel: string | null }[];
  try {
    zeilen = await lader();
    letzterFehler = null;
  } catch (fehler) {
    letzterFehler = fehler instanceof Error ? fehler.message.slice(0, 200) : "unbekannt";
    /* Nicht zwischenspeichern. Der nächste Aufruf versucht es neu. */
    return new Map();
  }

  const nach = new Map<string, string>();
  for (const z of zeilen) if (z.schluessel) nach.set(z.beruf, z.schluessel);
  tabelle = { nach, bis: Date.now() + HALTBAR_MS };
  return nach;
}

/**
 * Ob die Tabelle steht — und woran es sonst lag.
 *
 * Ohne diese Auskunft wäre „keine Kennung gefunden" nicht von
 * „Tabelle nicht ladbar" zu unterscheiden, und der Unterschied ist
 * der zwischen einer normalen Anzeige und einem Ausfall.
 */
export function schluesselstand(): { geladen: boolean; eintraege: number; letzterFehler: string | null } {
  return {
    geladen: tabelle !== null && tabelle.bis > Date.now(),
    eintraege: tabelle?.nach.size ?? 0,
    letzterFehler,
  };
}

/** Nur für Tests: den Zwischenspeicher leeren. */
export function schluesseltabelleVergessen(): void {
  tabelle = null;
  letzterFehler = null;
}

/** Nur für Tests: mit einem eigenen Lader nachschlagen. */
export async function kennungFuerBerufMit(beruf: unknown, lader: Tabellenlader): Promise<string | null> {
  if (typeof beruf !== "string") return null;
  const name = beruf.trim();
  if (name.length < 3) return null;
  return (await schluesseltabelle(lader)).get(name) ?? null;
}

/**
 * Die Kennung zu einer amtlichen Berufsbezeichnung.
 *
 * `null`, wenn die Bezeichnung fehlt oder unbekannt ist. Geraten wird
 * nicht: Eine erfundene amtliche Kennung wäre schlimmer als keine —
 * sie wählt Titelbild, Arbeitsprobe und Gehaltsreferenz.
 */
export async function kennungFuerBeruf(beruf: unknown): Promise<string | null> {
  if (typeof beruf !== "string") return null;
  const name = beruf.trim();
  if (name.length < 3) return null;
  return (await schluesseltabelle()).get(name) ?? null;
}

/**
 * Die Kennung aus den Rohdaten einer Anzeige.
 *
 * Nur die Bundesagentur liefert `hauptberuf`. Andere Quellen geben
 * nichts Vergleichbares her — dort bleibt die Kennung offen, und der
 * Nachtrag über den Titel ist weiterhin der einzige Weg.
 */
export async function kennungAusRohdaten(raw: Record<string, unknown> | undefined): Promise<string | null> {
  if (!raw) return null;
  return kennungFuerBeruf(raw.hauptberuf);
}
