import Link from "next/link";
import { Bookmark, Calculator, MessagesSquare, Search } from "lucide-react";

/**
 * Vier Wege, die man von hier aus gehen kann.
 *
 * ── Warum vier und nicht acht ─────────────────────────────────
 *
 * Eine Fläche mit acht gleichwertigen Angeboten ist keine Auswahl,
 * sondern eine Bitte um eine Entscheidung, die niemand treffen will.
 * Vier lassen sich mit einem Blick erfassen.
 *
 * ── Warum ruhig und ohne Farbverlauf ──────────────────────────
 *
 * Der Akzent gehört dorthin, wo etwas ausgewählt oder bestätigt wird
 * — nicht auf jede Kachel. Eine Fläche, auf der alles leuchtet, hat
 * keine Hierarchie mehr, und der Blick sucht sich selbst eine.
 */
const KARTEN = [
  {
    href: "/app/nina",
    icon: MessagesSquare,
    titel: "Mit Nina sprechen",
    text: "Kläre Fragen zu Stellen, Entscheidungen und deinem nächsten Schritt.",
  },
  {
    href: "/app/jobs?gespeichert=1",
    icon: Bookmark,
    titel: "Gespeicherte Stellen",
    text: "Alles, was du dir später noch einmal ansehen wolltest.",
  },
  {
    href: "/app/jobs",
    icon: Search,
    titel: "Stellen entdecken",
    text: "Sortiert nach begründeter Passung — mit Gehalt, Standzeit und Zukunft.",
  },
  {
    href: "/app/tools/gehalt",
    icon: Calculator,
    titel: "Karriere-Tools",
    text: "Was von einem Gehalt übrig bleibt und was der Weg zur Arbeit kostet.",
  },
] as const;

export function KarriereKarten() {
  return (
    <section aria-labelledby="karriere-karten" className="grid gap-6">
      <h2 id="karriere-karten" className="text-2xl font-semibold text-ink">
        Alles für deinen nächsten Karriereschritt
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KARTEN.map((k) => (
          <Link
            key={k.href}
            href={k.href}
            className={
              "group grid min-h-[13.5rem] content-center gap-3 rounded-(--radius-lg) border border-line " +
              "bg-raised px-6 py-7 transition-[border-color,transform] duration-(--duration-fast) " +
              "hover:-translate-y-0.5 hover:border-ink-3 motion-reduce:hover:translate-y-0"
            }
          >
            <k.icon className="size-6 text-ink-2" strokeWidth={1.6} />
            <h3 className="text-base font-semibold text-ink">{k.titel}</h3>
            <p className="text-sm leading-relaxed text-ink-2">{k.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
