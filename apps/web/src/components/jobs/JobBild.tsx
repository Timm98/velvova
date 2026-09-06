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
  job: { id: string; title: string; companyName: string; coreTasks?: string[]; kldb?: string };
  hoehe?: string;
  className?: string;
}) {
  const b = berufsbild(job);

  return (
    <div
      className={`${hoehe} w-full overflow-hidden rounded-(--radius-lg) ${className ?? ""}`}
      style={b.foto || b.bild ? undefined : { background: verlaufFür(job.id) }}
    >
      {(b.foto || b.bild) && (
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
          src={b.foto?.klein ?? b.bild}
          alt={b.foto?.alt ?? b.altText}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

/** Das kleine Format für die Liste. */
export function JobMiniatur({
  job,
}: {
  job: { id: string; title: string; companyName: string; coreTasks?: string[]; kldb?: string };
}) {
  const b = berufsbild(job);
  return (
    <span
      aria-hidden
      /*
       * Zwei zu eins, nicht quadratisch.
       *
       * Vorher stand hier `size-11`: 44 Pixel im Quadrat, mit
       * `object-cover` auf ein Bild im Verhältnis 2:1. Der Browser
       * schnitt dabei links und rechts je ein Viertel weg und zeigte
       * den leeren Mittelteil — bei jeder Gruppe ungefähr dasselbe
       * Nichts. Die Motive waren da, man sah sie nur nicht.
       *
       * Im Seitenverhältnis des Bildes ist das ganze Motiv zu sehen,
       * und die Höhe von 48 Pixeln bleibt der Zeile angemessen.
       *
       * Dazu `object-contain` statt `object-cover`: Auch bei einem
       * Motiv, dessen Verhältnis nicht genau 2:1 ist, wird nichts
       * abgeschnitten. Ein Bild, dem der Kopf fehlt, ist schlimmer als
       * eines mit einem schmalen Rand daneben.
       */
      className="grid h-12 w-24 shrink-0 place-items-center overflow-hidden rounded-(--radius-sm)"
      style={b.foto || b.bild ? undefined : { background: verlaufFür(job.id) }}
    >
      {(b.foto || b.bild) && (
        /*
         * Die kleine Fassung, nicht die grosse verkleinert.
         *
         * Bei 25 Zeilen je Seite wären das 25 Bilder à 1200 Pixel
         * Breite für eine Fläche von 96 Pixeln. Die 480er Fassung ist
         * je Bild rund ein Zehntel so gross.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.foto?.klein ?? b.bild} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
      )}
    </span>
  );
}

/**
 * Das grosse Titelbild oben in der Detailspalte.
 *
 * Es steht als erstes Element der ausgewählten Stelle — vor Titel,
 * Unternehmen und jeder Zahl. Vorher lag es mitten im Kopf, hinter der
 * Entscheidungsvorlage und den Warnzeichen; dort war es weder Auftakt
 * noch Information, sondern eine Unterbrechung im Lesefluss.
 *
 * Drei Dinge unterscheiden es von `JobBild`:
 *
 *   **Es hat immer eine Fläche.** Der Verlauf liegt im Container, nicht
 *   im Bild. Damit steht die Höhe fest, bevor irgendetwas geladen ist —
 *   es gibt keinen Moment, in dem der Titel nach oben springt und beim
 *   Erscheinen des Bildes wieder herunterrutscht.
 *
 *   **Das Bild blendet auf.** `onLoad` schaltet die Deckkraft. Bei
 *   einem data-URI passiert das im selben Bild und ist unsichtbar; bei
 *   einem späteren echten Foto ist es der Unterschied zwischen einem
 *   weichen Auftauchen und einem harten Umspringen.
 *
 *   **Es blockiert nichts.** Titel, Unternehmen, Passung und Aktionen
 *   stehen im selben Server-Rendering wie das Bild und warten nicht auf
 *   es. Das Bild ist der Auftakt der Seite, nicht ihre Bedingung.
 */
export function JobHero({
  job,
  className,
}: {
  job: { id: string; title: string; companyName: string; coreTasks?: string[]; kldb?: string };
  className?: string;
}) {
  const b = berufsbild(job);

  return (
    <div
      /* 240px auf kleinen Flächen, 300px ab Laptop — innerhalb der
         geforderten Spanne, und beides ohne die Spalte zu dominieren.
         `--radius-lg` sind 30px und damit genau die Rundung, die der
         Rest der Oberfläche für grosse Flächen benutzt. */
      className={`relative h-60 w-full overflow-hidden rounded-(--radius-lg) lg:h-[300px] ${className ?? ""}`}
      style={{ background: verlaufFür(job.id) }}
    >
      {(b.foto || b.bild) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.foto?.gross ?? b.bild}
          alt={b.foto?.alt ?? b.altText}
          decoding="async"
          /* Kein `loading="lazy"`: dieses eine Bild steht ganz oben und
             ist immer im Blickfeld. Verzögert zu laden, was ohnehin
             sofort sichtbar ist, verschiebt nur den Moment, in dem es
             da ist. */
          className="h-full w-full object-contain"
        />
      )}

      {/*
       * „Illustration" — sichtbar, nicht nur im Alt-Text.
       *
       * Ein grosses Bild über einer Stellenanzeige liest sich als
       * Aussage über den Arbeitgeber: so sieht es dort aus, das ist das
       * Team, das ist das Produkt. Nichts davon wissen wir. Das Motiv
       * gehört zur Berufsgruppe, nicht zur Firma.
       *
       * Der Alt-Text sagt das bereits — aber nur denen, die ihn hören.
       * Wer sieht, braucht dasselbe zu lesen. Deshalb das kleine
       * Etikett: leise genug, um nicht zu stören, deutlich genug, um
       * nicht übersehen zu werden.
       */}
      {/*
       * „Symbolbild" statt „Illustration", sobald ein Foto steht.
       *
       * Bei einem Zeichen ist offensichtlich, dass es nichts abbildet.
       * Bei einem Foto ist es das nicht — und genau dann muss das
       * Etikett es sagen.
       */}
      <span className="absolute bottom-3 right-3 rounded-(--radius-pill) bg-surface/85 px-2.5 py-1 abschnitts-titel text-ink-2 backdrop-blur-sm">
        {b.foto ? "Symbolbild" : "Illustration"}
      </span>
    </div>
  );
}
