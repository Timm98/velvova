import { radarBeiträge } from "@/lib/content/radar";
import { ArbeitsweltRadar } from "./ArbeitsweltRadar";

/**
 * Der Radar als eigener Server-Baustein.
 *
 * Er lädt drei fremde Feeds. Beim ersten Aufruf nach einem Neustart
 * dauert das rund fünf Sekunden — und genau so lange stand vorher die
 * ganze Startseite still, weil sie auf ihn gewartet hat. Der Radar ist
 * eine Randnotiz; er darf nicht das Erste sein, worauf man wartet.
 *
 * Als eigene Komponente hinter `<Suspense>` streamt Next ihn nach: die
 * Seite steht sofort, an dieser Stelle steht ein Platzhalter, und der
 * Radar erscheint, sobald die Feeds da sind. Bei jedem weiteren Aufruf
 * innerhalb einer Stunde kommt er aus dem Zwischenspeicher und ist
 * sofort da.
 */
export async function RadarBereich({
  assistantName,
  locale,
}: {
  assistantName: string;
  locale: string;
}) {
  const roh = await radarBeiträge().catch(() => []);

  return (
    <ArbeitsweltRadar
      assistantName={assistantName}
      locale={locale}
      beiträge={roh.map((b) => ({
        id: b.id,
        titel: b.titel,
        beschreibung: b.beschreibung,
        link: b.link,
        // Als Zeichenkette über die Grenze zur Client-Komponente.
        datumIso: b.datum ? b.datum.toISOString() : null,
        quelleName: b.quelle.name,
      }))}
    />
  );
}

/** Was steht, solange die Feeds unterwegs sind. */
export function RadarPlatzhalter() {
  return (
    <section aria-labelledby="radar-laedt" className="grid gap-4">
      <h2 id="radar-laedt" className="font-display text-xl font-semibold tracking-[-0.02em]">
        Arbeitswelt-Radar
      </h2>
      <ul className="grid gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="grid gap-2.5 rounded-(--radius-lg) bg-soft px-5 py-4">
            {/* Umrisse in der Form des späteren Inhalts, nicht ein
                kreisender Ring: so springt beim Eintreffen nichts. */}
            <span className="h-4 w-3/5 rounded-full bg-inset motion-safe:animate-pulse" />
            <span className="h-3.5 w-4/5 rounded-full bg-inset motion-safe:animate-pulse" />
            <span className="h-3.5 w-1/4 rounded-full bg-inset motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    </section>
  );
}
