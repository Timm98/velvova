import Image from "next/image";

/**
 * Die Bildflächen der Landingpage — und die Slots für echte Fotos.
 *
 * ── Warum diese Datei die einzige Stelle ist ──────────────────
 *
 * Ein Foto einzusetzen soll eine Zeile kosten und nicht eine Suche
 * durch acht Abschnitte. Hier stehen Pfad, Alternativtext und
 * Seitenverhältnis; die Abschnitte nennen nur noch den Namen.
 *
 * ── Was heute drinsteht ───────────────────────────────────────
 *
 * Platzhalter: Räume und Licht, keine Menschen. Fotos kann ich nicht
 * herstellen, und fremde Bilder ohne geklärte Lizenz wären kein
 * Kompromiss, sondern ein Rechtsverstoss. Drei Anläufe mit
 * gezeichneten Menschen sahen aus wie das, wovor der Auftrag warnt —
 * und eine mittelmässige Zeichnung eines Menschen ist schlechter als
 * gar keine.
 *
 * Wie ein Foto hierherkommt, steht in
 * `apps/web/public/arbeitswelt/BILDER.md`.
 */

export type Motiv =
  | "werkstatt"
  | "logistik"
  | "pflege"
  | "labor"
  | "buero"
  | "gastronomie"
  | "technik"
  | "gestaltung";

const MOTIVE: Record<Motiv, { datei: string; alt: string }> = {
  werkstatt: {
    datei: "/arbeitswelt/werkstatt.svg",
    alt: "Werkstatt mit Werkzeugwand, Tageslicht von links",
  },
  logistik: {
    datei: "/arbeitswelt/logistik.svg",
    alt: "Lagerhalle mit Regalfluchten, die sich in die Tiefe verlieren",
  },
  pflege: {
    datei: "/arbeitswelt/pflege.svg",
    alt: "Heller Flur einer Gesundheitseinrichtung mit hohen Fenstern",
  },
  labor: {
    datei: "/arbeitswelt/labor.svg",
    alt: "Laborbank mit Glasgefässen in einer Reihe",
  },
  buero: {
    datei: "/arbeitswelt/buero.svg",
    alt: "Arbeitsplatz mit zwei Bildschirmen und einer Wandprojektion",
  },
  gastronomie: {
    datei: "/arbeitswelt/gastronomie.svg",
    alt: "Tresen mit Tassen, Regal im Hintergrund",
  },
  technik: {
    datei: "/arbeitswelt/technik.svg",
    alt: "Werkhalle mit einer grossen runden Maschine und Bodenmarkierung",
  },
  gestaltung: {
    datei: "/arbeitswelt/gestaltung.svg",
    alt: "Atelier mit einem Entwurf an der Wand und Papier auf dem Tisch",
  },
};

/**
 * Ein Bild in seinem Slot.
 *
 * `prioritaet` nur für das, was ohne Scrollen sichtbar ist. Alles
 * andere lädt beim Heranscrollen — sonst konkurrieren acht Bilder mit
 * dem Text um dieselbe Leitung, und der Text verliert.
 */
export function Arbeitswelt({
  motiv,
  className = "",
  prioritaet = false,
  hoehe = "h-full",
}: {
  motiv: Motiv;
  className?: string;
  prioritaet?: boolean;
  hoehe?: string;
}) {
  const m = MOTIVE[motiv];
  return (
    <div className={`relative overflow-hidden ${hoehe} ${className}`}>
      <Image
        src={m.datei}
        alt={m.alt}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        priority={prioritaet}
        loading={prioritaet ? undefined : "lazy"}
        className="object-cover"
      />
    </div>
  );
}
