import Image from "next/image";
import { AUSSENVERWEISE } from "@paycheck/config";

/**
 * Die sozialen Kanäle ganz unten im Fuss.
 *
 * ══════════════════════════════════════════════════════════════
 * Zeichen statt Kacheln — der dritte Anlauf
 * ══════════════════════════════════════════════════════════════
 *
 * Zuerst standen hier fünf selbstgezeichnete Pfade, nötig, weil die
 * Symbolsammlung des Projekts ihre Markenzeichen entfernt hat. Dann
 * Abzeichen mit Zeichen und Wortmarke in einer schwarzen Kachel — die
 * waren lesbar, brachten aber ihre eigene Fläche mit und sassen als
 * Reihe von Kästen in einer Zeile mit Kleingedrucktem.
 *
 * Jetzt liegen die Zeichen frei vor, weiss auf durchsichtigem Grund.
 * Das passt zum Fuss, der ohnehin dunkel ist, und ordnet sich neben
 * „Impressum" und „Datenschutz" ein, statt sie zu überstimmen.
 *
 * Alle sechs sind auf ihren Inhalt zugeschnitten und auf 96 Pixel Höhe
 * gebracht. Die Breiten unterscheiden sich dadurch — 83 bei TikTok,
 * 141 bei YouTube —, und das ist richtig: Ein liegendes Rechteck
 * braucht mehr Platz als ein stehendes. Gesetzt wird die Höhe.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie auch ohne Adresse erscheinen
 * ══════════════════════════════════════════════════════════════
 *
 * Die Regel war: kein Abzeichen ohne hinterlegte Adresse. Sie ist
 * richtig für einen Verweis — ein Klick, der ins Leere führt, ist eine
 * gebrochene Zusage.
 *
 * Ein Zeichen ohne Verweis ist etwas anderes: Es sagt „hier sind wir
 * zu finden", nicht „klick hier". Deshalb erscheinen die Zeichen
 * jetzt immer, und nur der Verweis hängt an der Adresse. Solange in
 * `maerkte.ts` `url: null` steht, ist es ein Bild ohne Klick — kein
 * toter Link.
 *
 * Sobald die Adressen eingetragen sind, wird aus demselben Zeichen ein
 * Verweis. Eine Zeile in `maerkte.ts`, nichts hier.
 */

/** Höhe jedes Zeichens. Die Breite ergibt sich aus dem Verhältnis. */
const HOEHE = 18;

/**
 * Zu welchem Netz welches Zeichen gehört.
 *
 * Ein Netz ohne Eintrag erscheint nicht — lieber ein Kanal weniger als
 * eine Lücke in der Reihe.
 */
const ZEICHEN: Partial<Record<string, string>> = {
  instagram: "/sozial/instagram-zeichen.png",
  linkedin: "/sozial/linkedin-zeichen.png",
  youtube: "/sozial/youtube-zeichen.png",
  tiktok: "/sozial/tiktok-zeichen.png",
  x: "/sozial/x-zeichen.png",
  discord: "/sozial/discord-zeichen.png",
};

export function SozialeKanaele() {
  const kanaele = AUSSENVERWEISE.social.filter((k) => ZEICHEN[k.netz]);
  if (kanaele.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-4">
      {kanaele.map((k) => {
        const bild = (
          <Image
            src={ZEICHEN[k.netz] as string}
            alt=""
            aria-hidden
            width={HOEHE * 2}
            height={HOEHE}
            style={{ height: HOEHE, width: "auto" }}
            className="object-contain"
          />
        );
        return (
          <li key={k.netz} className="flex items-center">
            {k.url ? (
              <a
                href={k.url}
                /*
                  `noopener` gegen den Zugriff der Zielseite auf unser
                  Fenster, `noreferrer` weil ein fremdes Netzwerk nicht
                  erfahren muss, von welcher Unterseite jemand kam.
                */
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${k.name} — öffnet in neuem Tab`}
                className="flex min-h-9 items-center opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {bild}
              </a>
            ) : (
              /* Ohne Adresse kein Verweis: ein Zeichen, das man nicht
                 anklicken kann, statt eines Klicks, der nirgends
                 ankommt. `title` nennt trotzdem den Namen. */
              <span title={k.name} className="flex min-h-9 items-center opacity-55">
                {bild}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
