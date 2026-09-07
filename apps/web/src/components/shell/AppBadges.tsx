import { AUSSENVERWEISE } from "@paycheck/config";

/**
 * Velvova auch unterwegs — im Fussbereich, neben der Darstellung.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Kode eine Datei ist und keine Berechnung
 * ══════════════════════════════════════════════════════════════
 *
 * Hier stand `async function` mit `QRCode.toString()` beim Rendern.
 * Das war falsch, und der Browser hat es auch gesagt:
 *
 *   „<AppBadges> is an async Client Component."
 *   „A component was suspended by an uncached promise."
 *
 * Der Fuss hängt unter `AppShell`, und die trägt `"use client"`. Alles
 * darin ist Client-Code — dort darf nichts asynchron sein. Die Folge
 * war kein Absturz, sondern etwas Schlimmeres: Bei JEDEM Rendern
 * hielt React an einer Zusage an, die es nicht zwischenspeichern
 * kann. Auf jeder Seite, denn der Fuss steht überall.
 *
 * Der Kode ändert sich nie. Er ist deshalb eine Datei unter
 * `public/bilder/`, einmal erzeugt (`qrcode`, Fehlerkorrektur M,
 * Rand 0). Neu erzeugen muss man sie nur, wenn sich die Adresse
 * ändert — dann steht sie im Bild und nicht in einer Berechnung, die
 * bei jedem Seitenaufruf mitläuft.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Abzeichen
 * ══════════════════════════════════════════════════════════════
 *
 * Die offiziellen von Apple und Google, vom Betreiber gestellt. Beide
 * sind 135×40 und dürfen nur proportional skaliert werden — deshalb
 * `object-contain` und keine eigene Höhe.
 *
 * Sie tragen „Laden im App Store" und „Jetzt bei Google Play".
 * Solange die App in keinem Laden liegt, versprechen sie mehr, als es
 * gibt; der Satz darunter sagt deshalb, dass sie kommt.
 */
export function AppBadges() {
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
          style={{ width: 88, height: 88 }}
          className="grid shrink-0 place-items-center rounded-(--radius-md) border border-line bg-white p-1.5"
        >
          {/*
            Weisser Grund, auch im dunklen Schema.

            Ein QR-Kode braucht den Kontrast zwischen dunklen Modulen
            und hellem Grund. Auf dunklem Grund invertiert lesen ihn
            manche Kameras, viele nicht — und „manchmal" ist bei einem
            Kode dasselbe wie „nicht".
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bilder/qr-velvova.svg"
            alt=""
            aria-hidden
            width={76}
            height={76}
            className="size-full"
          />
        </div>

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
