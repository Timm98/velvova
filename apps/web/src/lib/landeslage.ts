import { LAND_ZU_WAEHRUNG } from "@paycheck/jobs/waehrung";

/**
 * Was in einem Land tatsächlich funktioniert.
 *
 * ── Warum die Landingpage das wissen muss ─────────────────────
 *
 * Sie verspricht drei Dinge: geprüfte Stellen, eine Nettorechnung und
 * einen Vergleich, der Steuern und Arbeitsweg einbezieht. Zwei davon
 * hängen am Land — und zwar hart:
 *
 *   Der Stellenmarkt: Es gibt Quellen für Deutschland, Österreich und
 *   die Schweiz. Für Portugal gibt es keine.
 *
 *   Die Nettorechnung: Es gibt genau EIN Steuerregelwerk, das deutsche
 *   für 2026. Einer Person in Zürich „3.114 € netto" zu zeigen, ist
 *   nicht ungenau, sondern falsch.
 *
 * Wer aus Zürich kommt und diese Versprechen liest, meldet sich an und
 * merkt es zehn Minuten später selbst. Das ist die teuerste Art, es zu
 * erfahren.
 *
 * ── Warum hier keine Zahlen umgerechnet werden ────────────────
 *
 * Naheliegend wäre, das Beispielgehalt in Landeswährung zu zeigen. Aus
 * „53.000 €" würde „53.000 CHF" — dieselbe Zahl, ein anderes Zeichen,
 * und damit eine Behauptung über das Schweizer Lohnniveau, die niemand
 * geprüft hat. Ein Wechselkurs wäre auch keine Lösung: Löhne folgen
 * keinem Wechselkurs.
 *
 * Das Beispiel bleibt deshalb, wie es ist, und ist als Beispiel
 * gekennzeichnet. Angepasst wird, was ÜBERPRÜFBAR anders ist.
 *
 * ── Reine Funktion ────────────────────────────────────────────
 *
 * Kein Header, kein Netz, keine Datenbank. Woher der Ländercode kommt,
 * ist Sache von `herkunft.ts`; was er bedeutet, steht hier — und ist
 * damit ohne Server prüfbar.
 */

/** Länder, für die es einen Steuerrechner gibt. */
const NETTO_LAENDER = new Set(["DE"]);

/**
 * Länder mit eigenen Stellenquellen.
 *
 * Aus `JOOBLE_COUNTRIES` plus der Bundesagentur (nur DE). Bewusst als
 * Liste hier und nicht aus der Registry gelesen: Die Registry braucht
 * Zugangsdaten und Netz, die Landingpage darf beides nicht.
 */
const MARKT_VOLL = new Set(["DE"]);
const MARKT_TEILWEISE = new Set(["AT", "CH"]);

export type Marktlage = "voll" | "teilweise" | "keiner";

export interface Landeslage {
  /** ISO-3166-1 alpha-2, immer gross. */
  code: string;
  /** Ob es ein Steuerregelwerk gibt — und damit eine Nettorechnung. */
  nettoRechnung: boolean;
  /** Wie gut der Stellenmarkt abgedeckt ist. */
  markt: Marktlage;
  waehrung: string;
  /**
   * Ein Satz für die Landingpage — oder `null`, wenn alles zutrifft.
   *
   * `null` ist der Normalfall für Deutschland: Wo nichts einzuschränken
   * ist, steht auch kein Hinweis. Ein Band, das immer da ist, liest
   * niemand mehr.
   */
  hinweis: string | null;
}

export function lageFuer(code: string | null | undefined): Landeslage {
  /*
   * Ohne Angabe gilt Deutschland.
   *
   * Nicht aus Bequemlichkeit: Es ist das einzige Land, für das dieses
   * Produkt heute vollständig funktioniert. Ein unbekannter Besucher
   * bekommt damit die Seite ohne Einschränkungshinweis — und wenn er
   * doch woanders sitzt, sagt ihm der Schalter darunter, dass er das
   * ändern kann.
   */
  const c = (code ?? "DE").toUpperCase();
  const netto = NETTO_LAENDER.has(c);
  const markt: Marktlage = MARKT_VOLL.has(c)
    ? "voll"
    : MARKT_TEILWEISE.has(c)
      ? "teilweise"
      : "keiner";

  return {
    code: c,
    nettoRechnung: netto,
    markt,
    waehrung: LAND_ZU_WAEHRUNG[c] ?? "EUR",
    hinweis: hinweisFuer(c, netto, markt),
  };
}

function hinweisFuer(code: string, netto: boolean, markt: Marktlage): string | null {
  if (netto && markt === "voll") return null;

  if (markt === "teilweise" && !netto) {
    return (
      `Für ${mitArtikel(code)} haben wir Stellen, aber noch kein Steuerregelwerk. ` +
      "Die Nettorechnung und der Vergleich nach Steuern gelten bisher nur für Deutschland — " +
      "alles andere funktioniert."
    );
  }

  if (markt === "keiner") {
    return (
      `Für ${mitArtikel(code)} haben wir bisher keine Stellenquellen und kein Steuerregelwerk. ` +
      "Du kannst ein Konto anlegen und eigene Stellenlinks prüfen lassen; die Suche findet " +
      "hier noch nichts."
    );
  }

  return null;
}

/**
 * Der Ländername, wenn ihn die Laufzeit kennt.
 *
 * `Intl.DisplayNames` trägt CLDR mit sich — dieselbe Quelle wie
 * `regionen.ts`. Eine eigene Liste wäre ab dem Tag ihrer Entstehung
 * falsch und würde es nicht sagen.
 */
function name(code: string): string {
  try {
    return new Intl.DisplayNames(["de"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/*
 * Der Artikel, wo das Deutsche einen verlangt.
 *
 * `Intl.DisplayNames` liefert den blossen Namen: „Schweiz", nicht „die
 * Schweiz". In einer Aufzählung ist das richtig, in einem Satz falsch —
 * „Für Schweiz haben wir Stellen" liest sich wie eine maschinelle
 * Übersetzung, und genau daran erkennt man sie.
 *
 * Die Liste ist kurz und deckt die Länder ab, die hier vorkommen
 * können. Für alle anderen bleibt es beim blossen Namen, was für die
 * grosse Mehrheit richtig ist.
 */
const ARTIKEL: Record<string, string> = {
  CH: "die Schweiz",
  NL: "die Niederlande",
  US: "die USA",
  GB: "das Vereinigte Königreich",
  UK: "das Vereinigte Königreich",
  CZ: "die Tschechische Republik",
  SK: "die Slowakei",
  TR: "die Türkei",
  UA: "die Ukraine",
  AE: "die Vereinigten Arabischen Emirate",
};

function mitArtikel(code: string): string {
  return ARTIKEL[code] ?? name(code);
}

export { name as landesname };
