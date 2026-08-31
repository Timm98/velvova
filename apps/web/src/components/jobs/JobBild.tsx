import { berufsbild, verlaufFür } from "@/lib/jobs/berufsbild";

/**
 * Das Titelbild einer Stelle.
 *
 * Zwei Stufen, mehr gibt es nicht:
 *
 *   **Berufsgruppe erkannt** → das Motiv dieser Gruppe. Abstrakt, in
 *   der Markenfamilie, ohne Menschen und ohne Räume. Es deutet die Art
 *   der Arbeit an, ohne einen Arbeitsplatz zu behaupten.
 *
 *   **Nicht erkannt** → der aus der Kennung gerechnete Verlauf. Eine
 *   Fläche, die nichts aussagt, ist ehrlicher als ein Motiv, das die
 *   falsche Arbeit zeigt.
 *
 * Was hier NICHT passiert: kein Foto vom Arbeitgeber, kein Stockbild,
 * keine Bilderzeugung beim Seitenaufruf. Ein Foto neben einer Anzeige
 * liest sich als „so sieht es dort aus" — und das wissen wir nicht.
 */
export function JobBild({
  job,
  hoehe = "h-40",
  className,
}: {
  job: { id: string; title: string; companyName: string; coreTasks?: string[] };
  hoehe?: string;
  className?: string;
}) {
  const b = berufsbild(job);

  return (
    <div
      className={`${hoehe} w-full overflow-hidden rounded-(--radius-lg) ${className ?? ""}`}
      style={b.bild ? undefined : { background: verlaufFür(job.id) }}
    >
      {b.bild && (
        /*
         * Ein einfaches <img> und kein next/image.
         *
         * Die Quelle ist ein data-URI unter einem Kilobyte — es gibt
         * nichts zu optimieren, nichts nachzuladen und keine zweite
         * Anfrage. `next/image` würde hier nur eine Ebene hinzufügen.
         *
         * `loading="lazy"` trotzdem: in einer langen Liste muss der
         * Browser die unteren Bilder nicht sofort dekodieren.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.bild}
          alt={b.altText}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/** Das kleine Format für die Liste. */
export function JobMiniatur({
  job,
}: {
  job: { id: string; title: string; companyName: string; coreTasks?: string[] };
}) {
  const b = berufsbild(job);
  return (
    <span
      aria-hidden
      className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-(--radius-sm)"
      style={b.bild ? undefined : { background: verlaufFür(job.id) }}
    >
      {b.bild && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.bild} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      )}
    </span>
  );
}
