import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy mit Nonce.
 *
 * Der erste Anlauf setzte die CSP statisch in next.config.ts, mit
 * `default-src 'self'` und ohne script-src. Das hat Nexts Inline-Skripte
 * blockiert - React hat nie hydriert, und damit war JEDER Knopf der
 * Anwendung tot. Serverseitig gerendertes HTML sah dabei vollstaendig
 * korrekt aus, weshalb es lange nicht auffiel. Ein E2E-Test, der auf
 * einen Klick wartete, hat es aufgedeckt.
 *
 * Die Loesung ist keine Aufweichung auf 'unsafe-inline', sondern eine
 * Nonce je Anfrage: Next erkennt sie in der CSP und setzt sie an seine
 * eigenen Skripte. Fremde Inline-Skripte bleiben blockiert.
 */
/** Läuft die Anfrage gegen einen lokalen Host ohne TLS? */
function istLokal(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return false;
  const host = request.nextUrl.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' laesst von einem vertrauten Skript geladene
    // Skripte zu, ohne jede URL einzeln erlauben zu muessen.
    // 'unsafe-eval' braucht ausschliesslich der Entwicklungsmodus (HMR).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React setzt Stile inline; ein Nonce-Weg dafuer existiert nicht.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    /*
     * `blob:` auch hier, für das 3D-Modell.
     *
     * Three.js lädt die GLB-Datei nicht direkt: es holt sie, legt sie
     * als Blob ab und liest sie von dort. Ohne `blob:` in `connect-src`
     * bricht genau dieser zweite Schritt ab — die Datei kommt mit HTTP
     * 200 an, und das Modell erscheint trotzdem nie.
     */
    /*
     * `api.openai.com` für das Live-Gespräch.
     *
     * Der Browser baut die Sprachverbindung direkt zum Anbieter auf —
     * mit einem kurzlebigen Sitzungsgeheimnis, das der Server geholt
     * hat. Den Ton über uns umzuleiten würde eine halbe Sekunde
     * kosten und nichts sicherer machen: das Geheimnis ist ohnehin
     * schon im Browser, der Projektschlüssel bleibt ohnehin hier.
     *
     * Ohne diesen Eintrag scheitert der Verbindungsaufbau — und zwar
     * so, wie CSP-Verstösse immer scheitern: die Anfrage geht raus,
     * die Antwort kommt an, der Browser wirft sie weg.
     */
    `connect-src 'self' blob: https://api.openai.com${isDev ? " ws: wss:" : ""}`,
    /* Draco- und KTX-Dekoder laufen in Workern, die aus Blobs
       entstehen. Ohne diese Zeile bleibt ein komprimiertes Modell
       schwarz. */
    `worker-src 'self' blob:`,
    /*
     * `blob:` ist für Mondays Stimme nötig.
     *
     * Der Ton kommt als Strom von der eigenen Route, wird im Browser zu
     * einem Blob und über einen Objekt-URL abgespielt. Ohne `blob:`
     * lehnt der Browser ihn ab — mit „Media load rejected by URL safety
     * check", und zwar lautlos: die Anfrage gelingt, die Daten sind
     * korrekt, es passiert nur nichts.
     *
     * `blob:` ist hier ungefährlich: ein Blob-URL entsteht
     * ausschließlich im eigenen Dokument aus Daten, die schon durch
     * `connect-src` mussten. Er lädt nichts von außen nach.
     */
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    /*
     * Nur, wenn die Seite tatsächlich über TLS läuft.
     *
     * `upgrade-insecure-requests` schreibt jede Anfrage auf https um.
     * Auf einem Produktionsserver hinter TLS ist das richtig; auf
     * `http://localhost` macht es die Anwendung unbenutzbar — jeder
     * Chunk scheitert mit einem TLS-Fehler. Genau das passiert beim
     * lokalen Test eines Production Builds, und ohne diese Bedingung
     * lässt sich der Build lokal gar nicht prüfen.
     */
    ...(isDev || istLokal(request) ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  // Die Nonce wandert als Anfrage-Header weiter; Next liest sie dort aus.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  /*
   * Der angefragte Pfad wandert mit, damit `requireUser` weiss, wohin
   * der Besucher wollte.
   *
   * Ohne ihn landet jeder, der ohne Anmeldung auf eine Stelle klickt,
   * nach dem Login auf der Übersicht — und die Stelle, wegen der er
   * gekommen ist, ist weg. Serverkomponenten kennen ihren eigenen Pfad
   * nicht; er ist nur hier verfügbar.
   *
   * Die Suchparameter gehören mit dazu: eine Stellensuche ohne ihre
   * Filter ist nicht dieselbe Seite.
   */
  headers.set("x-pfad", request.nextUrl.pathname + request.nextUrl.search);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Statische Dateien und Bilder brauchen keine CSP-Verarbeitung.
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
