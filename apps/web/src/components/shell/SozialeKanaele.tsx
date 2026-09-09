import Image from "next/image";
import { AUSSENVERWEISE } from "@paycheck/config";

/**
 * Die sozialen Kanäle ganz unten im Fuss.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nur die echten
 * ══════════════════════════════════════════════════════════════
 *
 * Gezeigt wird ein Abzeichen nur, wenn in `AUSSENVERWEISE.social` eine
 * Adresse steht. Sechs Abzeichen, von denen vier ins Leere führen,
 * sind die billigste Art, grösser auszusehen als man ist — und wer
 * einmal darauf geklickt hat, rechnet danach damit, dass auch der Rest
 * der Seite so gemeint ist.
 *
 * Steht nirgends eine Adresse, erscheint die Leiste gar nicht. Genau
 * das ist heute der Fall: Die Abzeichen liegen im Projekt, alle sechs
 * `url` stehen auf `null`. Es fehlt nicht das Bild, es fehlt die
 * Adresse — und die Liste in `maerkte.ts` ist der einzige Ort, an dem
 * sich das ändert.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum jetzt Bilder statt gezeichneter Zeichen
 * ══════════════════════════════════════════════════════════════
 *
 * Vorher standen hier fünf selbstgezeichnete Pfade — nötig, weil die
 * Symbolsammlung des Projekts ihre Markenzeichen entfernt hat. Sie
 * waren reine Zeichen ohne Namen.
 *
 * Die neuen Abzeichen tragen Zeichen und Wortmarke in einer Kachel und
 * kommen als Datei. Das nimmt der Oberfläche die Aufgabe, fremde
 * Marken nachzuzeichnen — und macht die Leiste lesbar statt
 * rätselhaft: „Discord" erkennt am Symbol allein kaum jemand, der es
 * nicht ohnehin benutzt.
 *
 * Die Dateien kamen mit grosszügigem durchsichtigem Rand — bei 32
 * Pixeln Höhe blieb von der Kachel selbst ein Streifen von dreizehn.
 * Sie sind deshalb auf ihren Inhalt zugeschnitten; aus 420 × 140 wurde
 * je nach Wortmarke 110 × 48 bis 185 × 62.
 *
 * Damit unterscheiden sich die Seitenverhältnisse leicht — 2,29 bei
 * „X", 3,11 bei „Instagram" —, und das ist richtig so: Ein kurzes Wort
 * braucht weniger Platz als ein langes. Gesetzt wird nur die Höhe;
 * gleich hoch ist die Achse, an der das Auge eine Reihe misst.
 *
 * Der Zusatz `-badge` im Namen ist nötig, weil Next optimierte Bilder
 * unter Pfad und Breite ablegt: Nach dem Zuschneiden lagen unter den
 * alten Pfaden noch die ungeschnittenen Fassungen.
 */

/** Höhe jedes Abzeichens. Die Breite ergibt sich aus dem Verhältnis. */
const HOEHE = 34;

/**
 * Zu welchem Netz welche Datei gehört.
 *
 * Ein Netz ohne Eintrag erscheint nicht — auch dann nicht, wenn eine
 * Adresse hinterlegt ist. Lieber ein Kanal weniger als eine Lücke in
 * der Reihe.
 */
const ABZEICHEN: Partial<Record<string, string>> = {
  instagram: "/sozial/instagram-badge.png",
  linkedin: "/sozial/linkedin-badge.png",
  youtube: "/sozial/youtube-badge.png",
  tiktok: "/sozial/tiktok-badge.png",
  x: "/sozial/x-badge.png",
  discord: "/sozial/discord-badge.png",
};

export function SozialeKanaele() {
  const kanaele = AUSSENVERWEISE.social.filter((k) => Boolean(k.url) && ABZEICHEN[k.netz]);
  if (kanaele.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {kanaele.map((k) => (
        <li key={k.netz}>
          <a
            href={k.url as string}
            /*
              `noopener` gegen den Zugriff der Zielseite auf unser
              Fenster, `noreferrer` weil ein fremdes Netzwerk nicht
              erfahren muss, von welcher Unterseite jemand kam.
            */
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${k.name} — öffnet in neuem Tab`}
            className="block rounded-(--radius-md) opacity-85 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Image
              src={ABZEICHEN[k.netz] as string}
              alt=""
              aria-hidden
              width={HOEHE * 3}
              height={HOEHE}
              style={{ height: HOEHE, width: "auto" }}
              className="object-contain"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
