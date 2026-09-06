import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getDb, schema, withSystem } from "@paycheck/db";
import { desc, isNotNull } from "drizzle-orm";
import { Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { foto } from "@/lib/fotos";

export const metadata: Metadata = { title: "Was gerade passiert" };
export const dynamic = "force-dynamic";

/**
 * Beiträge aus dem eigenen Bestand.
 *
 * ── Warum das kein Nachrichtenportal ist ──────────────────────
 *
 * Wir haben keine Redaktion und keine Presseagentur. Was wir haben,
 * sind Zählungen über 1,14 Millionen Anzeigen — und die tragen
 * Aussagen, die sonst niemand macht: wie viele Stellen Schichtarbeit
 * bedeuten, wie viele zum Gehalt schweigen, wo gerade gesucht wird.
 *
 * ── Warum jeder Beitrag seinen Beleg zeigt ────────────────────
 *
 * „Im Handwerk fehlen Fachkräfte" ist eine Meinung. „34 % der
 * Anzeigen, bei denen die Bundesagentur dazu etwas angibt, bedeuten
 * Schicht, Nacht oder Wochenende" ist eine Auskunft — und wer sie
 * nicht glaubt, kann nachlesen, worüber gezählt wurde.
 *
 * Ein Beitrag, den niemand nachrechnen kann, wäre eine Behauptung.
 * Davon gibt es genug.
 */

const ARTNAME: Record<string, string> = {
  krise: "Belastung",
  markt: "Arbeitsmarkt",
  beruf: "Berufe",
  ratgeber: "Was hilft",
};

export default async function BeitraegePage() {
  await requireUser();
  const db = await getDb();

  const beitraege = await withSystem(db, (tx) =>
    tx
      .select()
      .from(schema.beitraege)
      .where(isNotNull(schema.beitraege.veroeffentlichtAm))
      .orderBy(desc(schema.beitraege.veroeffentlichtAm))
      .limit(20),
  ).catch(() => []);

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Aus unseren Zahlen" title="Was gerade passiert" />

      <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
        Keine Nachrichten von aussen, sondern Auszählungen über den eigenen Bestand. Unter jedem
        Beitrag steht, worüber gezählt wurde — wer die Aussage nicht glaubt, kann sie nachrechnen.
      </p>

      {beitraege.length === 0 ? (
        <EmptyState title="Noch nichts" body="Sobald genug Daten zusammenkommen, steht hier etwas." />
      ) : (
        <ul className="grid gap-5">
          {beitraege.map((b) => {
            const bild = b.bildSlug ? foto(b.bildSlug) : null;
            return (
              <li key={b.id}>
                <Card padded={false}>
                  <article className="grid gap-0 sm:grid-cols-[16rem_1fr]">
                    {bild ? (
                      /*
                       * Symbolbild — wie überall in diesem Produkt.
                       *
                       * Ein Foto neben einer Zahl liest sich schnell als
                       * Beleg für sie. Der Beleg steht darunter im Text.
                       */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bild.klein}
                        alt={bild.alt}
                        loading="lazy"
                        className="h-40 w-full object-cover sm:h-full"
                      />
                    ) : (
                      <div className="hidden sm:block" />
                    )}
                    <div className="grid gap-2 p-5">
                      <span className="abschnitts-titel text-ink-3">
                        {ARTNAME[b.art] ?? b.art}
                      </span>
                      <h2 className="text-lg font-semibold text-ink">{b.titel}</h2>
                      <p className="max-w-[var(--measure)] leading-relaxed text-ink">
                        {b.kernaussage}
                      </p>
                      {b.text && (
                        <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                          {b.text}
                        </p>
                      )}
                      <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                        {b.beleg}
                      </p>
                    </div>
                  </article>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
