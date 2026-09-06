/**
 * Rufnummern ins E.164-Format.
 *
 * ── Warum von Hand und nicht mit einer Bibliothek ─────────────
 *
 * `libphonenumber-js` kann das vollständig — und wiegt rund 145 KB,
 * weil es die Nummernpläne aller Länder mitbringt. Auf der
 * Anmeldeseite, die viele Menschen als erste Seite überhaupt öffnen,
 * ist das der falsche Tausch für eine Umformung, die aus drei Regeln
 * besteht.
 *
 * Die drei Regeln:
 *
 *   1. Alles ausser Ziffern und einem führenden Plus entfernen.
 *      Menschen schreiben „0170 123 45-67", und das ist völlig in
 *      Ordnung.
 *   2. Beginnt die Nummer mit `00`, ist das die internationale
 *      Vorwahl in ihrer alten Schreibweise — sie wird zum Plus.
 *   3. Beginnt sie mit `0`, ist es eine nationale Nummer: Die Null
 *      fällt weg, die Landesvorwahl kommt davor. Genau hier gehen die
 *      meisten Eingaben schief, und genau das ist der Grund für diese
 *      Datei.
 *
 * Was hier bewusst NICHT passiert: eine Prüfung, ob es die Nummer
 * geben kann. Die Längen je Land und Netz sind der Teil, für den man
 * die Bibliothek bräuchte — und die einzige Prüfung, die zählt, ist
 * ohnehin, ob die SMS ankommt.
 */

export type Land = { code: string; name: string; vorwahl: string; flagge: string };

/**
 * Die Auswahl ist bewusst kurz.
 *
 * Sie deckt den deutschsprachigen Raum, die Nachbarländer und die
 * Märkte, in denen wir Stellen führen. Eine Liste aller 195 Länder
 * wäre vollständiger und in einem Auswahlfeld unbenutzbar; wer eine
 * andere Vorwahl braucht, tippt die Nummer mit Plus davor — das
 * erkennt `nachE164` und lässt sie unangetastet.
 */
export const LAENDER: Land[] = [
  { code: "DE", name: "Deutschland", vorwahl: "+49", flagge: "🇩🇪" },
  { code: "AT", name: "Österreich", vorwahl: "+43", flagge: "🇦🇹" },
  { code: "CH", name: "Schweiz", vorwahl: "+41", flagge: "🇨🇭" },
  { code: "NL", name: "Niederlande", vorwahl: "+31", flagge: "🇳🇱" },
  { code: "BE", name: "Belgien", vorwahl: "+32", flagge: "🇧🇪" },
  { code: "FR", name: "Frankreich", vorwahl: "+33", flagge: "🇫🇷" },
  { code: "IT", name: "Italien", vorwahl: "+39", flagge: "🇮🇹" },
  { code: "ES", name: "Spanien", vorwahl: "+34", flagge: "🇪🇸" },
  { code: "PL", name: "Polen", vorwahl: "+48", flagge: "🇵🇱" },
  { code: "CZ", name: "Tschechien", vorwahl: "+420", flagge: "🇨🇿" },
  { code: "DK", name: "Dänemark", vorwahl: "+45", flagge: "🇩🇰" },
  { code: "SE", name: "Schweden", vorwahl: "+46", flagge: "🇸🇪" },
  { code: "GB", name: "Vereinigtes Königreich", vorwahl: "+44", flagge: "🇬🇧" },
  { code: "IE", name: "Irland", vorwahl: "+353", flagge: "🇮🇪" },
  { code: "US", name: "USA", vorwahl: "+1", flagge: "🇺🇸" },
];

export const STANDARDLAND = "DE";

export function landZu(code: string): Land {
  return LAENDER.find((l) => l.code === code) ?? LAENDER[0]!;
}

/**
 * Aus Eingabe und gewählter Vorwahl wird E.164.
 *
 * Gibt `null` zurück, wenn nichts Brauchbares übrig bleibt — der
 * Aufrufer zeigt dann einen Hinweis, statt eine unvollständige Nummer
 * an Supabase zu schicken und dort einen technischen Fehler zu ernten.
 */
export function nachE164(eingabe: string, vorwahl: string): string | null {
  const roh = eingabe.trim();
  if (!roh) return null;

  /* Ein Plus zählt nur ganz vorn. „0170+123" ist ein Tippfehler,
     keine internationale Nummer. */
  const plus = roh.startsWith("+");
  let ziffern = roh.replace(/\D/g, "");

  if (plus) {
    return ziffern.length >= 8 ? `+${ziffern}` : null;
  }
  if (ziffern.startsWith("00")) {
    ziffern = ziffern.slice(2);
    return ziffern.length >= 8 ? `+${ziffern}` : null;
  }
  /* Die nationale Verkehrsausscheidungsziffer fällt weg — aus
     „0170 1234567" mit +49 wird +491701234567, nicht +4901701234567. */
  if (ziffern.startsWith("0")) ziffern = ziffern.replace(/^0+/, "");

  if (ziffern.length < 6) return null;
  return `${vorwahl}${ziffern}`;
}

/** Für die Anzeige: +491701234567 → +49 170 1234567 */
export function lesbar(e164: string): string {
  const land = LAENDER.find((l) => e164.startsWith(l.vorwahl));
  if (!land) return e164;
  const rest = e164.slice(land.vorwahl.length);
  if (rest.length <= 4) return `${land.vorwahl} ${rest}`;
  return `${land.vorwahl} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}
