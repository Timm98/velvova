/**
 * ══════════════════════════════════════════════════════════════════
 * Das Modell schon anfordern, während die Seite noch aufgebaut wird
 * ══════════════════════════════════════════════════════════════════
 *
 * Gemessen auf der Produktionsseite, 9. September 2026:
 *
 *   1 408 ms   erstes sichtbares Bild
 *   1 735 ms   `nina.opt.glb` wird angefordert
 *   + 3 900 ms Herunterladen bei kaltem Zwischenspeicher (7,6 MB)
 *
 * Die 1 735 ms sind keine Netzzeit, sondern eine Kette: Erst muss das
 * Seiten-JavaScript da sein, dann lädt `dynamic()` den three.js-Teil
 * nach, und erst dieser fordert das Modell an. Drei Wartezeiten
 * hintereinander, von denen die ersten beiden nichts mit dem Modell zu
 * tun haben.
 *
 * Ein `preload` im Kopf der Seite bricht die Kette auf: Der Browser
 * sieht die Zeile beim Lesen des HTML — also bei etwa 200 ms — und
 * beginnt sofort. Wenn `NinaScene` anderthalb Sekunden später danach
 * fragt, ist die Datei ganz oder halb da.
 *
 * ── Warum ein Server-Bauteil ────────────────────────────────────
 *
 * Weil es nur dann etwas bringt. Ein `preload`, das erst ein
 * Client-Bauteil einfügt, entsteht genau in dem Moment, in dem die
 * Kette ohnehin am Modell angekommen ist — es käme zu spät und wäre
 * eine Zeile ohne Wirkung. Next hebt diese Zeile aus einem
 * Server-Bauteil in den `<head>` der ersten Auslieferung.
 *
 * ── Warum `crossOrigin` dabeisteht ─────────────────────────────
 *
 * Ein Vorladen zählt nur, wenn es zur späteren Anfrage passt — in
 * Ziel, Art UND Anmeldemodus. Passt es nicht, lädt der Browser die
 * Datei ein zweites Mal: Das Vorladen sieht dann wie eine
 * Verbesserung aus und verdoppelt in Wahrheit die Last.
 *
 * Genau das ist beim ersten Versuch passiert. Ohne `crossOrigin`
 * gemessen: zwei Anfragen bei 477 und 716 Millisekunden, zusammen
 * 15,2 statt 7,6 MB. `as="fetch"` verlangt nach Spezifikation einen
 * CORS-Abruf, und ohne die Angabe beschreibt das Vorladen einen
 * anderen Modus als den, mit dem `GLTFLoader` die Datei später holt.
 *
 * Mit `crossOrigin="anonymous"` gemessen: eine Anfrage bei 432
 * Millisekunden. Vorher wurde das Modell bei 1 735 angefordert — die
 * Kette aus Seiten-JavaScript, `dynamic()` und three.js ist damit
 * übersprungen, rund 1,3 Sekunden früher.
 *
 * Diese Zahl ist der Grund, warum an dieser Stelle gemessen und nicht
 * geschätzt wird. Beide Fassungen sahen im Code gleich vernünftig aus;
 * die eine war doppelt so teuer wie gar keine.
 *
 */
export function NinaVorladen({ datei = "/models/nina.opt.glb" }: { datei?: string }) {
  return <link rel="preload" as="fetch" href={datei} crossOrigin="anonymous" />;
}
