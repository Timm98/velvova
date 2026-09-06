/**
 * Alle Länder, nicht nur der deutschsprachige Raum.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nur Codes und keine Namen
 * ══════════════════════════════════════════════════════════════
 *
 * Hier standen drei Länder: Deutschland, Österreich, Schweiz. Wer
 * anderswo wohnt, konnte sein Land nicht angeben — und stand damit
 * am ersten Bildschirm vor der Aussage, dass er nicht gemeint ist.
 *
 * Die Namen kommen aus `Intl.DisplayNames` und nicht aus einer Liste
 * hier. Eine handgepflegte Tabelle mit 267 Namen wäre in zwei
 * Sprachen zu pflegen, veraltet bei jeder Umbenennung und in der
 * Sortierung falsch, sobald jemand ein Land vergisst. Die
 * Regionsdatenbank von Node und den Browsern kennt sie bereits,
 * einschliesslich der deutschen Schreibweise und der englischen.
 *
 * Ausgeschlossen sind Sondercodes wie `EU`, `UN` oder `XA`: Sie sind
 * keine Länder, tauchen aber in der Datenbank auf.
 */

/** ISO 3166-1 alpha-2, ohne Sonderkennungen. */
export const LAENDERCODES: string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AN", "AO", "AQ", "AR", "AS",
  "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH",
  "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BU", "BV",
  "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL",
  "CM", "CN", "CO", "CQ", "CR", "CS", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DD", "DE", "DJ", "DK", "DM", "DO", "DY", "DZ", "EC", "EE", "EG", "EH",
  "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "FX", "GA", "GB",
  "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR",
  "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "HV",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY",
  "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO",
  "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NH", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS",
  "PT", "PW", "PY", "QA", "RE", "RH", "RO", "RS", "RU", "RW", "SA", "SB",
  "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO",
  "SR", "SS", "ST", "SU", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG",
  "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TP", "TR", "TT", "TV", "TW",
  "TZ", "UA", "UG", "UK", "UM", "US", "UY", "UZ", "VA", "VC", "VD", "VE",
  "VG", "VI", "VN", "VU", "WF", "WS", "XK", "YD", "YE", "YT", "YU", "ZA",
  "ZM", "ZR", "ZW",
];

export type Landeseintrag = { code: string; name: string };

/**
 * Die Länder, alphabetisch nach dem Namen in der gewünschten Sprache.
 *
 * Sortiert wird mit `localeCompare`, nicht mit `<`: Sonst stünde
 * „Österreich" hinter „Zypern", weil das Ö einen höheren Codepunkt
 * hat als das Z.
 */
export function laender(sprache: string = "de"): Landeseintrag[] {
  const namen = new Intl.DisplayNames([sprache], { type: "region" });
  return LAENDERCODES.map((code) => {
    let name = code;
    try {
      name = namen.of(code) ?? code;
    } catch {
      /* Eine Laufzeit ohne vollständige Regionsdaten gibt den Code
         zurück. Das ist unschön, aber brauchbar — und besser als eine
         leere Auswahl. */
    }
    return { code, name };
  }).sort((a, b) => a.name.localeCompare(b.name, sprache));
}

/** Der Name eines einzelnen Landes. */
export function landName(code: string, sprache: string = "de"): string {
  try {
    return new Intl.DisplayNames([sprache], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function istLandescode(w: unknown): w is string {
  return typeof w === "string" && LAENDERCODES.includes(w.toUpperCase());
}
