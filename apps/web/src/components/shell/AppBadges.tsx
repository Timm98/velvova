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

        ── Warum die Höhen ohne eine einzige Höhenangabe passen ──

        Die Abzeichen sind 135×40. Zwei davon mit 8 Pixeln Abstand
        sind 88 Pixel hoch — und `w-22` ist 5.5rem, also 88 Pixel.
        Der quadratische Kode ist damit genau so hoch wie die
        Abzeichenspalte, ohne dass irgendwo eine Höhe steht.

        Beide Spalten haben eine feste Breite. Mit `flex-1` wuchsen
        die Abzeichen vorher auf die halbe Fussspalte, und ein
        Ladenabzeichen von 300 Pixeln Breite sieht nach nichts mehr
        aus.
      */}
      <div className="flex items-stretch gap-2.5">
        <div
          /* Ohne Kode bleibt die Fläche gestrichelt statt leer weiss. */
          className={`grid aspect-square w-22 shrink-0 place-items-center rounded-(--radius-md) p-1.5 ${
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

        <div className="grid w-34 shrink-0 grid-rows-2 gap-2">
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
      className="size-full object-contain object-left"
    />
  );

  return href ? (
    <a href={href} className="block transition-opacity hover:opacity-85">
      {bild}
    </a>
  ) : (
    /* Ohne Laden bleibt es ein Bild, kein Bedienelement. */
    <span className="block opacity-90">{bild}</span>
  );
}
