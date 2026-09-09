/**
 * ══════════════════════════════════════════════════════════════════
 * Welche Sprache jemand bekommt — an genau einer Stelle entschieden
 * ══════════════════════════════════════════════════════════════════
 *
 * Vorher stand die Entscheidung in `getLocale()` und bestand aus zwei
 * Zeilen: Cookie lesen, sonst Deutsch. Damit bekam jeder Deutsch —
 * auch wer aus Lissabon kam, auch wer einen englischen Browser hatte,
 * auch wer im Konto etwas anderes eingestellt hatte.
 *
 * ── Die Rangfolge, und warum sie so herum ist ───────────────────
 *
 *   1. ausdrücklich gewählt      der Mensch hat es gerade gesagt
 *   2. im Konto hinterlegt       der Mensch hat es einmal gesagt
 *   3. im Cookie                 dasselbe, nur ohne Konto
 *   4. Browsersprache            was sein Gerät über ihn weiss
 *   5. Land aus dem Netz         was seine Leitung über ihn verrät
 *   6. Englisch
 *
 * Die Grenze verläuft zwischen 3 und 4: Darüber steht, was jemand
 * gesagt hat, darunter, was man über ihn vermutet. Eine Vermutung darf
 * eine Aussage nie überschreiben — wer in Paris sitzt und Deutsch
 * gewählt hat, bekommt Deutsch, und zwar auch beim nächsten Besuch.
 *
 * Deshalb steht das Land ganz unten und nicht etwa vor dem Browser:
 * Eine IP sagt, wo eine Leitung endet. Das ist bei VPN, Firmennetz
 * oder Urlaub schlicht ein anderer Ort als der Mensch.
 *
 * ── Was diese Datei nicht tut ───────────────────────────────────
 *
 * Sie liest keine Cookies, keine Kopfzeilen und keine Datenbank. Sie
 * bekommt fünf Werte und gibt einen zurück. Das ist der Grund, warum
 * sie prüfbar ist: Jeder Fall — Schweiz, VPN, Bot ohne Sprache,
 * Reisender mit Konto — ist ein Aufruf mit anderen Argumenten und
 * braucht weder Browser noch Server.
 */

/** Die Sprachen, für die die Architektur vorbereitet ist. */
export const VORBEREITETE_SPRACHEN = ["de", "en", "fr", "es", "it", "nl", "pl"] as const;

export type Sprachcode = (typeof VORBEREITETE_SPRACHEN)[number];

export function istSprachcode(wert: unknown): wert is Sprachcode {
  return typeof wert === "string" && (VORBEREITETE_SPRACHEN as readonly string[]).includes(wert);
}

/**
 * Land → Sprache, als schwächstes Signal.
 *
 * ── Warum die Schweiz hier nur Deutsch bekommt ──────────────────
 *
 * Weil sie an dieser Stelle gar nicht entschieden wird. Die Schweiz
 * ist viersprachig, und welche es ist, weiss das Land nicht — der
 * Browser aber schon: `fr-CH` ist eindeutig, `it-CH` auch.
 *
 * Die Browsersprache wird VOR dieser Tabelle geprüft. Wer aus der
 * Schweiz mit `fr-CH` kommt, ist längst bei Französisch, bevor hier
 * jemand nachschlägt. Was hier steht, gilt nur für den Fall, dass der
 * Browser gar nichts Brauchbares mitschickt — und dann ist Deutsch die
 * grösste Gruppe und damit die beste verbleibende Schätzung.
 *
 * Dasselbe gilt für Belgien (nl vor fr) und Kanada. Die Tabelle ist
 * eine letzte Rückfallebene, keine Landeskunde.
 */
export const LAND_ZU_SPRACHE: Readonly<Record<string, Sprachcode>> = {
  DE: "de", AT: "de", CH: "de", LI: "de", LU: "fr",
  GB: "en", IE: "en", US: "en", CA: "en", AU: "en", NZ: "en", ZA: "en", MT: "en",
  FR: "fr", MC: "fr", BE: "nl",
  ES: "es", MX: "es", AR: "es", CL: "es", CO: "es", PE: "es",
  IT: "it", SM: "it", VA: "it",
  NL: "nl", SR: "nl",
  PL: "pl",
};

export interface Sprachsignale {
  /** Gerade ausdrücklich gewählt — schlägt alles. */
  gewaehlt?: string | null;
  /** Im Konto hinterlegt. */
  konto?: string | null;
  /** Aus dem Cookie einer früheren Wahl. */
  cookie?: string | null;
  /**
   * Was der Browser mitschickt, in seiner Reihenfolge.
   *
   * Erwartet werden vollständige Tags wie `de-CH` oder `en-US`. Die
   * Region wird nicht weggeworfen, bevor sie geprüft ist — sie ist bei
   * der Schweiz die einzige verwertbare Auskunft.
   */
  browsersprachen?: readonly string[] | null;
  /** ISO-3166-1 alpha-2. Kommt aus einer Kopfzeile des CDN, nicht aus einer IP-Abfrage. */
  land?: string | null;
}

/**
 * Die Sprache bestimmen.
 *
 * `nutzbar` sind die Sprachen, für die es tatsächlich Texte gibt —
 * nicht die, für die die Architektur vorbereitet ist. Der Unterschied
 * ist entscheidend: `getTranslator` fällt bei einem fehlenden Katalog
 * stillschweigend auf die Standardsprache zurück. Wer „Français"
 * bekäme, ohne dass es französische Texte gibt, sähe Deutsch — und
 * hielte das für einen Fehler, nicht für eine fehlende Übersetzung.
 *
 * Deshalb entscheidet diese Funktion nur zwischen Sprachen, die
 * wirklich etwas anzeigen können. Kommt eine Datei dazu, wächst
 * `nutzbar`, und dieselbe Logik liefert sie aus — ohne Änderung hier.
 */
export function spracheAufloesen(
  signale: Sprachsignale,
  nutzbar: readonly string[],
): string {
  const kann = (wert: string | null | undefined): string | null =>
    wert && nutzbar.includes(wert) ? wert : null;

  /* 1–3: Was jemand gesagt hat. */
  const gesagt = kann(signale.gewaehlt) ?? kann(signale.konto) ?? kann(signale.cookie);
  if (gesagt) return gesagt;

  /*
   * 4: Was sein Gerät sagt.
   *
   * In der Reihenfolge des Browsers, denn die ist bereits eine
   * Rangfolge: `["fr-CH", "de-CH", "en"]` heisst „am liebsten
   * Französisch". Der erste Treffer gewinnt.
   *
   * `de-CH` wird auf `de` gekürzt — aber erst, nachdem der volle Tag
   * geprüft wurde. Andersherum ginge die Region verloren, und genau
   * sie unterscheidet in der Schweiz die Fälle.
   */
  for (const tag of signale.browsersprachen ?? []) {
    const sauber = tag.trim().toLowerCase();
    if (!sauber) continue;
    const treffer = kann(sauber) ?? kann(sauber.split("-")[0]);
    if (treffer) return treffer;
  }

  /* 5: Was seine Leitung verrät. */
  const ausLand = signale.land ? LAND_ZU_SPRACHE[signale.land.trim().toUpperCase()] : undefined;
  const gelandet = kann(ausLand);
  if (gelandet) return gelandet;

  /*
   * 6: Englisch.
   *
   * Nicht Deutsch, obwohl der Stellenbestand deutsch geprägt ist. Wer
   * hier ankommt, hat weder etwas gewählt noch einen verwertbaren
   * Browser noch ein erkennbares Land — ein Bot, ein Sparmodus, eine
   * unbekannte Leitung. Für diesen Fall ist Englisch die Sprache mit
   * der grössten Chance, verstanden zu werden.
   *
   * Sollte es ausgerechnet Englisch nicht geben, nimmt die Funktion,
   * was da ist. Ein Rückgabewert ausserhalb von `nutzbar` wäre eine
   * Zusicherung, die diese Funktion sonst überall einhält.
   */
  return nutzbar.includes("en") ? "en" : (nutzbar[0] ?? "en");
}

/**
 * `Accept-Language` in eine Liste von Tags zerlegen.
 *
 * Die Kopfzeile sieht so aus: `fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7`.
 * Sortiert wird nach `q` — der Browser schreibt sie zwar meist schon
 * in der richtigen Reihenfolge, aber „meist" ist keine Zusage, und
 * eine falsch geordnete Liste kehrt die Sprachwahl um.
 *
 * Ohne `q` gilt 1.0. Ein `*` fällt weg: Es heisst „irgendetwas" und
 * ist damit keine Auskunft über eine Sprache.
 */
export function accepteSprachen(kopfzeile: string | null | undefined): string[] {
  if (!kopfzeile) return [];
  return kopfzeile
    .split(",")
    .map((teil) => {
      const [tag, ...rest] = teil.trim().split(";");
      const q = rest.map((r) => r.trim()).find((r) => r.startsWith("q="));
      const gewicht = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: (tag ?? "").trim(), gewicht: Number.isFinite(gewicht) ? gewicht : 0 };
    })
    .filter((e) => e.tag && e.tag !== "*")
    .sort((a, b) => b.gewicht - a.gewicht)
    .map((e) => e.tag);
}
