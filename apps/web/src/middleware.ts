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
    `connect-src 'self' blob:${isDev ? " ws: wss:" : ""}`,
    /* Draco- und KTX-Dekoder laufen in Workern, die aus Blobs
       entstehen. Ohne diese Zeile bleibt ein komprimiertes Modell
       schwarz. */
    `worker-src 'self' blob:`,
    /*
     * `blob:` ist für Ninas Stimme nötig.
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
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  // Die Nonce wandert als Anfrage-Header weiter; Next liest sie dort aus.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

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
