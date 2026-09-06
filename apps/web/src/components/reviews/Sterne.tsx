import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Fünf Sterne — zum Lesen.
 *
 * Zwei Dinge, die eine Sternebewertung fast immer falsch macht:
 *
 *   **Sie sagt nichts, wenn man nicht sieht.** Fünf Symbole, von denen
 *   vier gefüllt sind, sind für ein Vorlesegerät fünf Symbole. Deshalb
 *   sind die Sterne hier `aria-hidden` und daneben steht der Wert im
 *   Klartext — einmal, nicht fünfmal.
 *
 *   **Sie rundet still.** 4,3 Sterne als vier gefüllte darzustellen
 *   verschweigt drei Zehntel. Ein halber Stern zeigt sie, und die Zahl
 *   daneben nennt sie genau.
 */

export function Sterne({
  wert,
  groesse = "md",
  className,
}: {
  wert: number;
  groesse?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = groesse === "lg" ? "size-6" : groesse === "sm" ? "size-3.5" : "size-[18px]";

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const anteil = Math.max(0, Math.min(1, wert - (i - 1)));
          return (
            <span key={i} className={cn("relative inline-block", px)}>
              <Star className={cn(px, "text-line-2")} strokeWidth={1.6} />
              {anteil > 0 && (
                // Der gefüllte Teil liegt exakt über dem leeren und wird
                // beschnitten — so lässt sich jeder Bruchteil zeigen,
                // nicht nur ganze und halbe Sterne.
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${anteil * 100}%` }}
                >
                  {/*
                    Blau, nicht gelb.

                    Gelbe Sterne sind die Voreinstellung jedes
                    Bewertungssystems — und genau deshalb tragen sie
                    keine Marke. Der Akzentton ist derselbe wie bei
                    Knöpfen, Verweisen und Ninas Core; die Bewertung
                    gehört sichtbar zu diesem Produkt.

                    `fill` und `text` gleich gesetzt: Der Stern wird
                    zur Fläche statt zur Kontur, damit er auch bei
                    14 Pixeln als Stern lesbar bleibt.
                  */}
                  <Star className={cn(px, "fill-accent text-accent")} strokeWidth={1.6} />
                </span>
              )}
            </span>
          );
        })}
      </span>
      <span className="sr-only">
        {wert.toLocaleString("de-DE", { maximumFractionDigits: 1 })} von 5 Sternen
      </span>
    </span>
  );
}

/**
 * Fünf Sterne — zum Wählen.
 *
 * Als Radiogruppe und nicht als fünf Knöpfe: eine Bewertung ist EINE
 * Auswahl aus fünf, und genau das ist eine Radiogruppe. Damit
 * funktionieren Pfeiltasten, Tabulator und Vorlesegeräte, ohne dass
 * dafür etwas nachgebaut werden müsste.
 */
export function SterneWahl({
  wert,
  onChange,
  fehler,
}: {
  wert: number;
  onChange: (n: number) => void;
  fehler?: boolean;
}) {
  return (
    <fieldset
      className={cn(
        "inline-flex items-center gap-1 rounded-(--radius-pill) px-1 py-1",
        fehler && "ring-1 ring-critical",
      )}
    >
      <legend className="sr-only">Bewertung in Sternen</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="cursor-pointer rounded-(--radius-pill) p-1 transition-colors hover:bg-soft focus-within:ring-2 focus-within:ring-accent/40"
        >
          <input
            type="radio"
            name="rating"
            value={n}
            checked={wert === n}
            onChange={() => onChange(n)}
            className="sr-only"
          />
          <Star
            aria-hidden
            className={cn("size-7 transition-colors", n <= wert ? "fill-accent text-accent" : "text-line-2")}
            strokeWidth={1.6}
          />
          <span className="sr-only">
            {n} {n === 1 ? "Stern" : "Sterne"}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
