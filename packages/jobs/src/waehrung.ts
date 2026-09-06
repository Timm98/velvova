/**
 * Welche Währung gehört zu diesem Gehalt?
 *
 * ── Der Anlass ────────────────────────────────────────────────
 *
 * Eine Stelle in Frankfurt am Main, Land DE, wurde mit
 * „60.000–80.000 GBP" angezeigt. Nicht wegen eines Anzeigefehlers: In
 * der Datenbank stand GBP, mit Herkunft `provider`. TheirStack hatte es
 * so geliefert, und der Adapter reichte es durch —
 * `salaryCurrency: s.salary_currency ?? "EUR"`.
 *
 * Das ist die teuerste Sorte Fehler in einem Gehaltsprodukt. Die Zahl
 * ist plausibel, das Kürzel ist plausibel, und zusammen ergeben sie
 * einen um etwa fünfzehn Prozent falschen Betrag — in die Richtung, die
 * eine Stelle attraktiver aussehen lässt, als sie ist. Wer sich danach
 * richtet, verhandelt gegen eine erfundene Grundlage.
 *
 * ── Die Regel ─────────────────────────────────────────────────
 *
 * Der Anbieter hat Vorrang, aber kein Vetorecht.
 *
 * Sagt er eine Währung, gilt sie — es sei denn, sie widerspricht dem
 * Land der Stelle, und der Rohtext bestätigt sie nicht. Dann gilt das
 * Land. Ein Arbeitgeber in Frankfurt zahlt keine Pfund; eine Angabe,
 * die das behauptet, ist ein Datenfehler und keine Besonderheit.
 *
 * Umgekehrt wird das Land NICHT zur letzten Instanz gemacht: Eine
 * Schweizer Firma darf einen Vertrag in Euro ausschreiben, und ein
 * Anbieter, der CHF sagt und dessen Rohtext „CHF 90'000" enthält,
 * behält recht. Deshalb zählt der Rohtext als Zeuge.
 *
 * ── Warum nichts geraten wird ─────────────────────────────────
 *
 * Bleibt alles unklar, ist das Ergebnis `null` und nicht „EUR". Ein
 * stiller Standardwert ist genau der Mechanismus, der den Fehler oben
 * erzeugt hat: `?? "EUR"` sieht harmlos aus und macht aus fehlendem
 * Wissen eine Behauptung.
 */

/** Woher die Währung stammt — für Nachvollziehbarkeit und Reparatur. */
export type Waehrungsherkunft =
  /** Der Anbieter hat sie geliefert und nichts widerspricht. */
  | "provider"
  /** Aus dem Gehaltstext gelesen (Symbol oder Kürzel). */
  | "raw_string"
  /** Aus dem Land der Stelle abgeleitet. */
  | "location_fallback"
  /** Von Hand korrigiert, etwa durch den Reparaturlauf. */
  | "manual_repair";

export interface Waehrungsbefund {
  /** ISO-4217, oder `null` wenn nichts belastbar ist. */
  waehrung: string | null;
  herkunft: Waehrungsherkunft | null;
  /** Kurz, in der Sprache eines Menschen. Für Protokoll und Reparatur. */
  begruendung: string;
}

/*
 * Land → Währung nach ISO 4217.
 *
 * Bewusst eine Tabelle und keine verstreuten Abfragen: Ein Land kommt
 * genau einmal vor, und wer eine Zuordnung sucht, findet sie hier statt
 * in einem Adapter.
 *
 * Die Liste ist nicht vollständig — sie deckt die Länder ab, aus denen
 * unsere Quellen Stellen liefern. Ein unbekanntes Land ergibt `null`,
 * nicht „EUR".
 */
export const LAND_ZU_WAEHRUNG: Record<string, string> = {
  // Euroraum
  DE: "EUR", AT: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  BE: "EUR", IE: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
  SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR",
  MT: "EUR", HR: "EUR",
  // Europa ausserhalb des Euroraums
  CH: "CHF", GB: "GBP", UK: "GBP", PL: "PLN", CZ: "CZK", HU: "HUF",
  SE: "SEK", NO: "NOK", DK: "DKK", RO: "RON", BG: "BGN", IS: "ISK",
  // Ausserhalb Europas
  US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", JP: "JPY", SG: "SGD",
  IN: "INR", BR: "BRL", MX: "MXN", ZA: "ZAR", IL: "ILS", AE: "AED",
};

/**
 * Währungssymbole, die eindeutig sind.
 *
 * `$` fehlt mit Absicht: Es steht für mindestens ein Dutzend Währungen.
 * Ohne Land ist ein Dollarzeichen keine Auskunft, sondern eine Frage —
 * und die wird unten mit dem Land beantwortet, nicht hier geraten.
 */
const SYMBOLE: [RegExp, string][] = [
  [/€|\bEUR\b/i, "EUR"],
  [/£|\bGBP\b/i, "GBP"],
  [/\bCHF\b|\bSFr\b/i, "CHF"],
  [/\bPLN\b|\bzł/i, "PLN"],
  [/\bSEK\b|\bkr\b.*\bSE\b/i, "SEK"],
  [/\bNOK\b/i, "NOK"],
  [/\bDKK\b/i, "DKK"],
  [/\bCZK\b|\bKč/i, "CZK"],
  [/\bHUF\b|\bFt\b/i, "HUF"],
  [/\bJPY\b|¥/i, "JPY"],
  [/\bINR\b|₹/i, "INR"],
];

/** Das Dollarzeichen, aufgelöst über das Land. */
const DOLLAR_LAENDER: Record<string, string> = {
  US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", SG: "SGD", MX: "MXN",
};

/** Aus einem Gehaltstext die Währung lesen. `null`, wenn er nichts sagt. */
export function waehrungAusText(text: string | null | undefined, land?: string | null): string | null {
  if (!text) return null;
  for (const [muster, code] of SYMBOLE) {
    if (muster.test(text)) return code;
  }
  if (/\$/.test(text)) {
    const l = (land ?? "").toUpperCase();
    return DOLLAR_LAENDER[l] ?? null;
  }
  return null;
}

export interface Waehrungseingabe {
  /** Was der Anbieter im eigenen Feld gesagt hat. */
  providerWaehrung?: string | null;
  /** Der unveränderte Gehaltstext, falls vorhanden. */
  rohtext?: string | null;
  /** Land der STELLE, nicht des Nutzers. */
  land?: string | null;
}

/**
 * Die Währung bestimmen — mit Begründung.
 *
 * Reihenfolge und ihre Ausnahme:
 *
 *   1. Anbieterangabe, wenn sie zum Land passt oder das Land nichts
 *      Klares erwarten lässt.
 *   2. Rohtext — er ist der einzige Zeuge, der die Anbieterangabe gegen
 *      das Land verteidigen kann.
 *   3. Land der Stelle.
 *   4. Nichts.
 */
export function waehrungBestimmen(e: Waehrungseingabe): Waehrungsbefund {
  const land = (e.land ?? "").toUpperCase().trim();
  const erwartet = land ? (LAND_ZU_WAEHRUNG[land] ?? null) : null;
  const ausText = waehrungAusText(e.rohtext, land);
  const vomAnbieter = normalisiere(e.providerWaehrung);

  if (vomAnbieter) {
    // Passt sie zum Land, oder erwartet das Land nichts Bestimmtes?
    if (!erwartet || vomAnbieter === erwartet) {
      return {
        waehrung: vomAnbieter,
        herkunft: "provider",
        begruendung: erwartet
          ? `Anbieter nennt ${vomAnbieter}, passt zu ${land}.`
          : `Anbieter nennt ${vomAnbieter}; für ${land || "unbekanntes Land"} keine Erwartung hinterlegt.`,
      };
    }

    /*
     * Widerspruch. Der Rohtext entscheidet.
     *
     * Steht dort dasselbe wie beim Anbieter, ist es eine echte
     * Besonderheit — ein Schweizer Vertrag in Euro etwa. Steht dort
     * nichts oder etwas anderes, ist die Anbieterangabe ein Datenfehler
     * und das Land die bessere Auskunft.
     */
    if (ausText && ausText === vomAnbieter) {
      return {
        waehrung: vomAnbieter,
        herkunft: "provider",
        begruendung: `Anbieter nennt ${vomAnbieter} abweichend von ${land} (${erwartet}) — der Gehaltstext bestätigt es.`,
      };
    }

    return {
      waehrung: erwartet,
      herkunft: "location_fallback",
      begruendung: `Anbieter nennt ${vomAnbieter}, die Stelle liegt aber in ${land}. Ohne Bestätigung im Gehaltstext gilt ${erwartet}.`,
    };
  }

  if (ausText) {
    return {
      waehrung: ausText,
      herkunft: "raw_string",
      begruendung: `Aus dem Gehaltstext gelesen: ${ausText}.`,
    };
  }

  if (erwartet) {
    return {
      waehrung: erwartet,
      herkunft: "location_fallback",
      begruendung: `Keine Angabe; aus dem Land ${land} abgeleitet.`,
    };
  }

  return {
    waehrung: null,
    herkunft: null,
    begruendung: "Weder Anbieter noch Gehaltstext noch Land geben etwas her.",
  };
}

function normalisiere(w: string | null | undefined): string | null {
  if (!w) return null;
  const k = w.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(k) ? k : null;
}
