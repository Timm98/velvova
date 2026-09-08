/**
 * Kurse lesen und rechnen — ohne Datenbank, ohne Netz.
 *
 * Eigene Datei, weil beides an beiden Enden gebraucht wird: auf dem
 * Server, der die Kurse holt und ablegt, und im Browser, wo
 * `gehaltsanzeige.ts` ein Gehalt umrechnet. Nebenan in `kurse.ts`
 * steht der Datenbankzugriff; von dort zu importieren zog den
 * Postgres-Treiber ins Client-Bündel und brach den Bau.
 */
/**
 * Die EZB-Tageskurse als Paare.
 *
 * Gelesen wird mit einem Ausdruck statt mit einem XML-Parser: Die
 * Datei ist zwei Dutzend gleichförmige Zeilen, und eine
 * Parser-Abhängigkeit für zwei Attribute wäre mehr Angriffsfläche als
 * Nutzen. Was nicht auf das Muster passt, fällt weg — eine kaputte
 * Zeile darf nicht den ganzen Abruf verlieren.
 */
export function ecbLesen(xml: string): { stand: string | null; kurse: Record<string, number> } {
  const datum = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1] ?? null;
  const kurse: Record<string, number> = {};
  for (const t of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    const wert = Number.parseFloat(t[2] ?? "");
    if (Number.isFinite(wert) && wert > 0) kurse[t[1]!] = wert;
  }
  /*
   * Der Euro steht nicht in der Datei — er ist die Basis. Ohne diese
   * Zeile müsste jede Umrechnung den Sonderfall kennen.
   */
  if (Object.keys(kurse).length > 0) kurse.EUR = 1;
  return { stand: datum, kurse };
}

/**
 * Einen Betrag umrechnen.
 *
 * `null`, wenn eine der beiden Währungen fehlt. Nicht `betrag` —
 * eine Zahl unverändert zurückzugeben und als umgerechnet
 * auszugeben, wäre die schlimmste denkbare Antwort: Sie sieht aus wie
 * ein Ergebnis.
 *
 * Gerechnet wird über EUR, weil die Kurse so vorliegen. Zwei
 * Divisionen statt eines Kreuzkurses — das Ergebnis ist dasselbe, und
 * es gibt keine zweite Rundungsregel.
 */
export function umrechnen(
  betrag: number,
  von: string,
  nach: string,
  kurse: Record<string, number>,
): number | null {
  if (!Number.isFinite(betrag)) return null;
  const a = von.toUpperCase();
  const b = nach.toUpperCase();
  if (a === b) return betrag;

  const kursVon = kurse[a];
  const kursNach = kurse[b];
  if (!kursVon || !kursNach) return null;

  return (betrag / kursVon) * kursNach;
}
