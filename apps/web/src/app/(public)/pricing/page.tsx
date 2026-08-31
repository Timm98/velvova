import type { Metadata } from "next";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { GEPLANTE_ZAHLARTEN, zahlungsanbieter } from "@/lib/billing/anbieter";
import { PreisTafel } from "./PreisTafel";

export const metadata: Metadata = { title: "Preise" };
export const dynamic = "force-dynamic";

/**
 * Preise.
 *
 * Hier stand lange: „Es gibt noch kein Preismodell, und deshalb steht
 * hier auch keines." Das war richtig, solange es keines gab. Jetzt gibt
 * es eines — zwei Pläne, ein Preis, ein sichtbar ausgerechneter
 * Jahresrabatt.
 *
 * Was sich nicht geändert hat: es wird nichts behauptet, was nicht
 * stimmt. Solange kein Zahlungsanbieter angeschlossen ist, steht an der
 * Stelle des Kaufknopfes ein Satz, der genau das sagt. Ein „Jetzt
 * kaufen", das nichts kauft, wäre schlimmer als eine leere Seite.
 */
export default async function PricingPage() {
  const { brand } = await getPageContext();
  const [user, anbieter] = await Promise.all([currentUser(), zahlungsanbieter()]);

  return (
    <div className="grid gap-12">
      <header className="grid gap-4">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-accent-text">Preise</p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Zwei Pläne, ein klarer Unterschied
        </h1>
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
          {brand.assistantName} führt das Gespräch, findet Stellen und bereitet Bewerbungen vor —
          auch kostenlos. Premium geht tiefer, zeigt mehr und spricht deine Sprache.
        </p>
      </header>

      <PreisTafel
        angemeldet={Boolean(user)}
        zahlartenVerfügbar={anbieter.verfügbar()}
        geplanteZahlarten={anbieter.verfügbar() ? anbieter.zahlarten : GEPLANTE_ZAHLARTEN}
      />

      <section className="grid gap-3 rounded-(--radius-lg) bg-ice px-6 py-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
          Was auch ohne Premium bleibt
        </h2>
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
          Das Karrieregespräch, deine bestätigten Stärken, begründete Stellenvorschläge und das
          Vorbereiten einer Bewerbung sind nicht hinter der Bezahlung. Ein Produkt, das seine
          Kernaussage einschliesst, kann sie nicht mehr beweisen. Deine Daten kannst du jederzeit
          exportieren und löschen — auch das kostet nichts.
        </p>
      </section>
    </div>
  );
}
