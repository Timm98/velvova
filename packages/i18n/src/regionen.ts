/**
 * Länder, Zeitzonen, Währungen.
 *
 * Alles aus der Laufzeit, nichts von Hand gepflegt.
 *
 * `Intl` trägt CLDR mit sich: ISO-3166-Ländercodes mit übersetzten
 * Namen, die IANA-Zeitzonendatenbank, ISO-4217-Währungen. Das ist
 * dieselbe Quelle, die auch Betriebssysteme benutzen, sie wird mit
 * jedem Node- und Browser-Update gepflegt, und sie kostet uns kein
 * einziges Kilobyte im Bundle.
 *
 * Die Alternative wäre eine Liste im Repository gewesen. Sie hätte
 * angefangen mit Deutschland, Österreich und der Schweiz — genau das,
 * was V7 §20.4 ausschliesst — und wäre danach nie wieder angefasst
 * worden. Länder werden umbenannt, Zeitzonen verschoben, Währungen
 * abgeschafft; eine eingefrorene Liste ist ab dem Tag ihrer Entstehung
 * falsch und sagt es nicht.
 *
 * Eine Einschränkung, die man kennen muss: die Daten stammen aus der
 * Umgebung, in der der Code läuft. Ein sehr altes Gerät hat eine
 * ältere Fassung. Für Anzeige und Auswahl ist das unerheblich —
 * gespeichert werden ohnehin nur die Codes, nie die Namen.
 */

export interface Land {
  /** ISO-3166-1 alpha-2. */
  code: string;
  /** In der Sprache der Oberfläche. */
  name: string;
}

/*
 * Zweistellige Grossbuchstaben, ohne die Sammelcodes.
 *
 * `Intl.DisplayNames` kennt auch Gebilde wie „EU" oder „Welt" und die
 * UN-Regionen (dreistellige Zahlen). In einer Länderauswahl haben sie
 * nichts zu suchen: „Europäische Union" ist kein Arbeitsort.
 */
const CODE_MUSTER = /^[A-Z]{2}$/;

/*
 * Nicht zuteilbare oder rein technische Codes.
 *
 * `ZZ` steht für „unbekannt", `QO` für abgelegene Inselgruppen, `XA`
 * und `XB` sind Testcodes für Pseudo-Übersetzungen. `EU`, `EZ` und `UN`
 * sind Zusammenschlüsse, keine Länder.
 */
const KEINE_LÄNDER = new Set(["ZZ", "QO", "XA", "XB", "EU", "EZ", "UN"]);

function alleLändercodes(): string[] {
  // Alle 26×26 Kombinationen durchzugehen ist billiger, als es
  // aussieht, und die einzige Möglichkeit: `Intl` gibt keine Liste der
  // Regionen heraus, nur Namen zu Codes. Unbekannte Codes liefert es
  // unverändert zurück — daran erkennt man sie.
  const codes: string[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      codes.push(String.fromCharCode(a, b));
    }
  }
  return codes;
}

const CACHE = new Map<string, Land[]>();

/** Alle Länder, in der gewünschten Sprache, alphabetisch sortiert. */
export function länder(sprache: string): Land[] {
  const gemerkt = CACHE.get(sprache);
  if (gemerkt) return gemerkt;

  const namen = new Intl.DisplayNames([sprache], { type: "region", fallback: "none" });
  const collator = new Intl.Collator(sprache);

  const liste = alleLändercodes()
    .filter((c) => CODE_MUSTER.test(c) && !KEINE_LÄNDER.has(c))
    .map((code) => ({ code, name: namen.of(code) }))
    // `fallback: "none"` gibt `undefined` für alles, was kein Land ist.
    // Das ist der Filter, den es sonst von Hand bräuchte.
    .filter((l): l is Land => typeof l.name === "string" && l.name !== l.code)
    .sort((a, b) => collator.compare(a.name, b.name));

  CACHE.set(sprache, liste);
  return liste;
}

export function landName(code: string, sprache: string): string {
  const name = new Intl.DisplayNames([sprache], { type: "region", fallback: "none" }).of(code);
  return name ?? code;
}

/** IANA-Zeitzonen. */
export function zeitzonen(): string[] {
  /*
   * `supportedValuesOf` gibt es seit ES2022 und in jeder Umgebung, die
   * dieses Projekt sonst voraussetzt. Der Rückfall ist trotzdem da,
   * weil eine fehlende Zeitzonenliste sonst eine leere Auswahl ergäbe —
   * und eine leere Auswahl sieht aus wie ein Ladefehler.
   */
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [Intl.DateTimeFormat().resolvedOptions().timeZone];
  }
}

/** Wie eine Zeitzone gerade zur Ortszeit steht: „Europe/Berlin (UTC+2)". */
export function zeitzoneMitVersatz(zone: string, sprache: string, jetzt: Date): string {
  try {
    const teil = new Intl.DateTimeFormat(sprache, { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(jetzt)
      .find((p) => p.type === "timeZoneName")?.value;
    return teil ? `${zone.replace(/_/g, " ")} (${teil})` : zone.replace(/_/g, " ");
  } catch {
    return zone;
  }
}

/** ISO-4217-Währungen. */
export function währungen(): string[] {
  try {
    return Intl.supportedValuesOf("currency");
  } catch {
    return ["EUR", "USD", "GBP", "CHF"];
  }
}

export function währungName(code: string, sprache: string): string {
  try {
    const name = new Intl.DisplayNames([sprache], { type: "currency", fallback: "none" }).of(code);
    return name ? `${code} — ${name}` : code;
  } catch {
    return code;
  }
}
