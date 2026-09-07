import type { Metadata } from "next";
import { and, count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { vollstaendigkeit, profilLaden } from "@/lib/arbeitgeber/profil";

export const metadata: Metadata = { title: "Analysen" };
export const dynamic = "force-dynamic";

/**
 * Analysen.
 *
 * ── Warum hier nur gezählt und nicht gedeutet wird ────────────
 *
 * Jede Zahl auf dieser Seite kommt aus einer Zeile in der eigenen
 * Datenbank: Stellen nach Zustand, Bewerbungen nach Stufe,
 * Vollständigkeit des Profils. Keine Quoten, keine Vergleiche mit
 * „ähnlichen Unternehmen", keine Prognose.
 *
 * Der Grund ist nicht Bescheidenheit. Ein Vergleichswert setzt eine
 * Grundgesamtheit voraus, die belegt, dass die Unternehmen wirklich
 * vergleichbar sind — und die haben wir nicht. Eine Zahl wie „ihr
 * antwortet 30 % langsamer als vergleichbare Unternehmen" klingt
 * präzise und ist eine Behauptung mit Nachkommastelle.
 *
 * Sobald der Bestand es hergibt, gehört genau das hierher — mit
 * Grundgesamtheit an jeder Zahl, wie überall sonst im Produkt.
 */
export default async function AnalysenPage() {
  const { organisation } = await arbeitgeberKontext();
  const db = await getDb();
  const org = organisation.organizationId;

  const [stellen, bewerbungen, profil] = await Promise.all([
    db
      .select({ status: schema.jobPostings.status, n: count() })
      .from(schema.jobPostings)
      .where(eq(schema.jobPostings.organizationId, org))
      .groupBy(schema.jobPostings.status),
    db
      .select({ stage: schema.postingCandidates.stage, n: count() })
      .from(schema.postingCandidates)
      .where(
        and(
          eq(schema.postingCandidates.organizationId, org),
          sql`${schema.postingCandidates.withdrawnAt} is null`,
        ),
      )
      .groupBy(schema.postingCandidates.stage),
    profilLaden(org),
  ]);

  const { prozent, offen } = vollstaendigkeit(profil);
  const stellenGesamt = stellen.reduce((a, z) => a + z.n, 0);
  const bewerbungenGesamt = bewerbungen.reduce((a, z) => a + z.n, 0);

  const STUFE: Record<string, string> = {
    new: "Neu",
    screening: "In Sichtung",
    interview: "Im Gespräch",
    offer: "Angebot",
    hired: "Eingestellt",
    rejected: "Abgesagt",
  };
  const ZUSTAND: Record<string, string> = {
    draft: "Entwurf",
    published: "Veröffentlicht",
    paused: "Pausiert",
    closed: "Geschlossen",
    archived: "Archiviert",
  };

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.2rem)] font-normal tracking-[-0.015em]">
          Analysen
        </h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          Gezählt aus euren eigenen Daten. Keine Quoten, keine Vergleiche mit anderen Unternehmen —
          dafür fehlt die Grundgesamtheit, die belegt, dass sie vergleichbar sind.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Stellen", stellenGesamt],
          ["Bewerbungen", bewerbungenGesamt],
          ["Profil vollständig", `${prozent} %`],
        ].map(([k, v]) => (
          <div key={String(k)} className="grid gap-1 rounded-(--radius-md) border border-line p-5">
            <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">{k}</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">{v}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Verteilung titel="Stellen nach Zustand" zeilen={stellen.map((z) => [ZUSTAND[z.status] ?? z.status, z.n])} />
        <Verteilung titel="Bewerbungen nach Stufe" zeilen={bewerbungen.map((z) => [STUFE[z.stage] ?? z.stage, z.n])} />
      </div>

      {offen.length > 0 && (
        <div className="grid gap-2.5 rounded-(--radius-md) border border-line p-5">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">
            Offene Angaben im Profil
          </p>
          <p className="text-sm leading-relaxed text-ink-2">
            {offen.map((f) => f.label).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Eine Verteilung als Balken.
 *
 * Leer bleibt sie nicht leer, sondern sagt, dass sie leer ist. Ein
 * Diagramm ohne Balken sieht aus wie eines, das nicht geladen hat.
 */
function Verteilung({ titel, zeilen }: { titel: string; zeilen: [string, number][] }) {
  const max = Math.max(1, ...zeilen.map(([, n]) => n));
  return (
    <div className="grid content-start gap-3 rounded-(--radius-md) border border-line p-5">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">{titel}</p>
      {zeilen.length === 0 ? (
        <p className="text-sm text-ink-3">Noch nichts vorhanden.</p>
      ) : (
        <ul className="grid gap-2.5">
          {zeilen.map(([k, n]) => (
            <li key={k} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-sm text-ink-2">{k}</span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-inset">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="font-mono text-sm tabular-nums text-ink">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
