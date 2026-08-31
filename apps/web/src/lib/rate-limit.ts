/**
 * Eine einfache Begrenzung pro Absender.
 *
 * Bewusst im Arbeitsspeicher und ohne Redis. Für einen öffentlichen
 * Endpunkt, der Nachrichten entgegennimmt, geht es nicht darum, einen
 * entschlossenen Angreifer aufzuhalten — dafür bräuchte es etwas vor
 * der Anwendung. Es geht um den Alltagsfall: ein hängengebliebenes
 * Skript, ein doppelt geklickter Knopf, ein simples Formularspam.
 *
 * Die Grenzen dieser Lösung sind real und sollen benannt sein: mehrere
 * Serverprozesse zählen getrennt, und ein Neustart setzt zurück. Wer
 * das nicht will, setzt einen Zähler davor. Etwas Einfaches, das
 * wirkt, ist trotzdem besser als nichts mit dem Vorsatz, später etwas
 * Richtiges zu bauen.
 */

interface Fenster {
  anzahl: number;
  bis: number;
}

const zähler = new Map<string, Fenster>();

/*
 * Damit die Karte nicht unbegrenzt wächst.
 *
 * Ohne dieses Aufräumen wächst sie mit jeder neuen Adresse und wird nie
 * kleiner — ein Speicherleck, das nur unter Last auffällt.
 */
const MAX_EINTRÄGE = 10_000;

export interface Grenze {
  /** Wie viele Anfragen im Fenster erlaubt sind. */
  anzahl: number;
  /** Fensterlänge in Millisekunden. */
  fensterMs: number;
}

export interface Ergebnis {
  erlaubt: boolean;
  /** Wie viele noch übrig sind. */
  übrig: number;
  /** Wann das Fenster endet, als Unixzeit in Sekunden. */
  zurücksetzenIn: number;
}

export function prüfeGrenze(schlüssel: string, grenze: Grenze, jetzt = Date.now()): Ergebnis {
  if (zähler.size > MAX_EINTRÄGE) {
    for (const [k, f] of zähler) if (f.bis <= jetzt) zähler.delete(k);
  }

  const vorhanden = zähler.get(schlüssel);

  if (!vorhanden || vorhanden.bis <= jetzt) {
    zähler.set(schlüssel, { anzahl: 1, bis: jetzt + grenze.fensterMs });
    return { erlaubt: true, übrig: grenze.anzahl - 1, zurücksetzenIn: Math.ceil(grenze.fensterMs / 1000) };
  }

  vorhanden.anzahl += 1;
  const übrig = Math.max(0, grenze.anzahl - vorhanden.anzahl);
  return {
    erlaubt: vorhanden.anzahl <= grenze.anzahl,
    übrig,
    zurücksetzenIn: Math.max(1, Math.ceil((vorhanden.bis - jetzt) / 1000)),
  };
}

/**
 * Wer fragt?
 *
 * Hinter einem Proxy steht die echte Adresse in `x-forwarded-for`; die
 * erste Angabe darin ist der ursprüngliche Absender. Ohne Proxy gibt es
 * sie nicht — dann zählen alle gemeinsam, was für eine lokale
 * Entwicklung genau richtig ist.
 *
 * Die Adresse wird NICHT gespeichert, nur als Schlüssel im Speicher
 * benutzt und mit dem Fenster wieder vergessen.
 */
export function absender(request: Request): string {
  const weitergeleitet = request.headers.get("x-forwarded-for");
  if (weitergeleitet) return weitergeleitet.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unbekannt";
}

/** Nur für Tests: den Zähler leeren. */
export function _zurücksetzen(): void {
  zähler.clear();
}
