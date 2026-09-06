import Link from "next/link";
import { desc, isNotNull } from "drizzle-orm";
import { ArrowRight, Newspaper } from "lucide-react";
import { getDb, schema, withSystem } from "@paycheck/db";

/**
 * Ein Streifen statt eines Abschnitts.
 *
 * ── Warum nur ein Teaser ──────────────────────────────────────
 *
 * Drei Beitragskarten auf der Startseite kosten eine halbe
 * Bildschirmhöhe und beantworten die Frage nicht, mit der jemand
 * herkommt — die lautet „welche Stelle passt zu mir", nicht „was gibt
 * es Neues".
 *
 * Eine Zeile mit der jüngsten Schlagzeile sagt, dass es etwas gibt,
 * und führt dorthin. Wer mehr will, klickt.
 *
 * ── Warum nichts steht, wenn nichts da ist ────────────────────
 *
 * Ohne veröffentlichten Beitrag erscheint der Streifen nicht. Ein
 * Teaser vor einer leeren Seite ist ein Versprechen, das der erste
 * Klick widerlegt.
 */
export async function NeuigkeitenTeaser() {
  const db = await getDb();
  const [neuestes] = await withSystem(db, (tx) =>
    tx
      .select({
        titel: schema.beitraege.titel,
        veroeffentlichtAm: schema.beitraege.veroeffentlichtAm,
      })
      .from(schema.beitraege)
      .where(isNotNull(schema.beitraege.veroeffentlichtAm))
      .orderBy(desc(schema.beitraege.veroeffentlichtAm))
      .limit(1),
  ).catch(() => []);

  if (!neuestes) return null;

  return (
    <Link
      href="/app/beitraege"
      className="group flex items-center gap-4 rounded-(--radius-lg) border border-line bg-surface px-5 py-4 transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-(--radius-md) bg-accent-subtle text-accent"
      >
        <Newspaper className="size-[18px]" strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-mono text-2xs uppercase tracking-[0.14em] text-ink-3">
          Was gerade passiert
        </span>
        {/*
          Die Schlagzeile selbst, nicht „Neuer Beitrag verfügbar".
          Ein Teaser, der seinen Inhalt verschweigt, zwingt zum Klick,
          um zu erfahren, ob er sich lohnt.
        */}
        <span className="mt-0.5 block truncate text-sm font-medium text-ink">
          {neuestes.titel}
        </span>
      </span>

      <span className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-accent-text sm:inline-flex">
        Alle Neuigkeiten
        <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
