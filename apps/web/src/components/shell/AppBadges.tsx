import QRCode from "qrcode";
import { AUSSENVERWEISE, loadRuntimeConfig } from "@paycheck/config";

/**
 * Velvova auch unterwegs — im Fussbereich, neben der Darstellung.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Abzeichen
 * ══════════════════════════════════════════════════════════════
 *
 * Die offiziellen Abzeichen von Apple und Google, vom Betreiber
 * bereitgestellt und unter `public/laden/` abgelegt. Beide sind
 * 135×40 und dürfen nur proportional skaliert werden — deshalb
 * `object-contain` und keine eigene Höhe.
 *
 * Sie tragen „Laden im App Store" und „Jetzt bei Google Play".
 * Solange die App in keinem der beiden Läden liegt, versprechen sie
 * mehr, als es gibt; der Satz darunter sagt deshalb ausdrücklich,
 * dass sie kommt. Sobald `AUSSENVERWEISE.iosUrl` beziehungsweise
 * `androidUrl` gesetzt sind, werden die Abzeichen zu Links und der
 * Satz wechselt mit.
 *
 * ══════════════════════════════════════════════════════════════
 * Wohin der Kode führt
 * ══════════════════════════════════════════════════════════════
 *
 * Auf die Seite selbst. Ein Kode, der ins Leere zeigt, ist auf einer
 * Seite, die Menschen bei Bewerbungen begleitet, die falsche Sorte
 * Attrappe — wer scannt, hat etwas erwartet.
 *
 * Auf dem Telefon geöffnet, ist Velvova heute schon vollständig
 * benutzbar. Der Kode hält also, was er verspricht, und bekommt
 * später den Ladenlink, ohne dass sich hier etwas ändern muss.
 */
export async function AppBadges() {
  const cfg = loadRuntimeConfig();

  /*
   * Ein Kode wird abfotografiert, oft von einem fremden Telefon in
   * einem fremden Netz — „localhost" führt dort ins Leere.
   *
   * `appUrl` steht in der Entwicklung auf localhost, und wenn in der
   * Produktion einmal `APP_URL` fehlt, ebenfalls. Beides darf nicht
   * in einem Kode landen, den jemand scannt.
   */
  const oeffentlich = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(cfg.appUrl)
    ? "https://velvova.com"
    : cfg.appUrl;
  const ziel = AUSSENVERWEISE.iosUrl ?? AUSSENVERWEISE.androidUrl ?? oeffentlich;

  /*
   * Der Kode wird beim Rendern erzeugt, nicht im Browser.
   *
   * Er ändert sich nie und wiegt als Pfad ein paar hundert Byte —
   * dafür eine Bibliothek an den Browser auszuliefern wäre teurer
   * als das Bild.
   *
   * Fehlerkorrektur „M": Ein Kode auf einer Webseite wird vom
   * Bildschirm abfotografiert, nicht von einem zerknitterten
   * Aufkleber. Höhere Stufen machen ihn nur dichter.
   */
  const qr = await QRCode.toString(ziel, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#000000", light: "#0000" },
  }).catch(() => null);

  return (
    <div className="grid gap-2.5">
      <span className="text-sm font-semibold text-ink">Velvova App</span>

      {/*
        Links der Kode, rechts die beiden Abzeichen übereinander.

        ══════════════════════════════════════════════════════════
        Warum hier Zahlen stehen und keine Automatik
        ══════════════════════════════════════════════════════════

        Hier stand einmal, stolz, „die Höhen passen ohne eine
        einzige Höhenangabe". Genau das war der Fehler.

        Die Zeile war `items-stretch`: Der Kode wollte über
        `aspect-square` quadratisch werden, die Abzeichenspalte
        wollte so hoch werden wie ihr Inhalt, und der Inhalt — ein
        Bild mit Breite UND Höhe auf 100 % — wollte so hoch werden
        wie seine Zeile. Jeder mass sich am anderen, keiner an einer
        Zahl.

        Der Browser löst das trotzdem auf, nur eben irgendwie:
        gemessen 102 statt 88 Pixel, und weil `align-self: stretch`
        eine Höhe SETZT, verlor `aspect-ratio` und aus dem Quadrat
        wurde ein hochkantes Rechteck.

        Jetzt steht die eine Zahl da, aus der alles folgt: Die
        Abzeichen sind 40 Pixel hoch, zwei davon mit 8 Pixeln
        Abstand sind 88 — und der Kode ist 88 × 88. Nichts misst
        sich mehr an etwas, das sich selbst noch nicht kennt.

        Die Masse stehen als Stil am Element, nicht als Klasse: Sie
        tragen die Zeile, und ob eine Utility-Klasse erzeugt wurde,
        darf darüber nicht entscheiden.
      */}
      <div className="flex items-start gap-2.5">
        <div
          /* Ohne Kode bleibt die Fläche gestrichelt statt leer weiss. */
          /*
           * Die Breite steht als Stil am Element, nicht als Klasse.
           *
           * Fehlt eine Breitenklasse, ist ein Flex-Kind mit
           * `aspect-square` und `shrink-0` nicht klein — es ist so
           * breit wie die Zeile hoch ist, und die Zeile ist so hoch
           * wie das Kind. Aus einem 88-Pixel-Kode wurde so ein
           * Quadrat über die halbe Fussspalte, das die Zahlungsarten
           * daneben überdeckte.
           *
           * Diese zwei Zahlen tragen die ganze Zeile: Der Kode gibt
           * die Höhe vor, die Abzeichen erben sie. Sie gehören
           * deshalb dorthin, wo nichts dazwischenkommen kann.
           */
          style={{ width: 88, height: 88 }}
          className={`grid shrink-0 place-items-center rounded-(--radius-md) p-1.5 ${
            qr ? "border border-line bg-white" : "border border-dashed border-line"
          }`}
          /*
           * Weisser Grund, auch im dunklen Schema.
           *
           * Ein QR-Kode braucht den Kontrast zwischen dunklen
           * Modulen und hellem Grund. Auf dunklem Grund invertiert
           * lesen ihn manche Kameras, viele nicht — und „manchmal"
           * ist bei einem Kode dasselbe wie „nicht".
           */
          aria-hidden
          {...(qr
            ? { dangerouslySetInnerHTML: { __html: qr.replace("<svg", '<svg class="size-full"') } }
            : {})}
        />

        <div style={{ width: 136 }} className="grid shrink-0 gap-2">
          <Abzeichen
            href={AUSSENVERWEISE.iosUrl}
            quelle="/laden/app-store-de.svg"
            beschriftung="Laden im App Store"
          />
          <Abzeichen
            href={AUSSENVERWEISE.androidUrl}
            quelle="/laden/google-play.svg"
            beschriftung="Jetzt bei Google Play"
          />
        </div>
      </div>

      <p className="max-w-[32ch] text-2xs leading-relaxed text-ink-3">
        {AUSSENVERWEISE.iosUrl || AUSSENVERWEISE.androidUrl
          ? "Scannen und die App laden."
          : "Die App kommt bald. Scanne den Kode, um Velvova auf dem Telefon zu öffnen — dort läuft schon heute alles."}
      </p>
    </div>
  );
}

/**
 * Ein Ladenabzeichen — Link, sobald es einen gibt, sonst nur Bild.
 *
 * Kein `<a href="#">` als Platzhalter: Ein Link, der nichts tut, ist
 * für die Tastatur ein Ziel und für den Vorleser ein Versprechen.
 *
 * Kein `next/image`: Für SVG bringt es nichts (nichts zu optimieren,
 * nichts zu skalieren) und verlangt `dangerouslyAllowSVG` für die
 * ganze Anwendung — ein weit geöffnetes Tor für zwei Dateien.
 */
function Abzeichen({
  href,
  quelle,
  beschriftung,
}: {
  href: string | null;
  quelle: string;
  beschriftung: string;
}) {
  /* eslint-disable-next-line @next/next/no-img-element */
  const bild = (
    <img
      src={quelle}
      alt={href ? beschriftung : `${beschriftung} — bald verfügbar`}
      width={135}
      height={40}
      /* `object-contain`: Die Abzeichen dürfen nur proportional
         skaliert werden, nie gedehnt oder beschnitten. */
      style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "left" }}
    />
  );

  /* 40 Pixel: die echte Höhe der Abzeichen (135 × 40). */
  return href ? (
    <a href={href} style={{ height: 40 }} className="block transition-opacity hover:opacity-85">
      {bild}
    </a>
  ) : (
    /* Ohne Laden bleibt es ein Bild, kein Bedienelement. */
    <span style={{ height: 40 }} className="block opacity-90">{bild}</span>
  );
}
