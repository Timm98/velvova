import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import type { MatchZustand } from "@paycheck/db/schema";
import { brand } from "@paycheck/config";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { darf } from "@/lib/arbeitgeber/rollen";
import {
  regelLaden,
  vorschlaegeLaden,
  vorschlagsZahlen,
  STUFENERKLAERUNG,
  STUFENNAME,
  ZUSTANDSNAME,
} from "@/lib/arbeitgeber/matches";
import { MatchKarte } from "./MatchKarte";
import { Automatisierung } from "./Automatisierung";
import { Suchlauf } from "./Suchlauf";

export const metadata: Metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

/**
 * Vorschläge zu den eigenen Stellen.
 *
 * ── Warum die Filter in der Adresse stehen ────────────────────
 *
 * Ein Team spricht über Vorschläge: „schau dir die über 90 bei der
 * Controller-Stelle an". Steht der Filter im Zustand einer
 * Client-Komponente, lässt sich dieser Satz nicht als Link schicken.
 * In der Adresse schon — und der Zurück-Knopf funktioniert.
 */
export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ stelle?: string; fit?: string; zustand?: string }>;
}) {
  const { organisation } = await arbeitgeberKontext();
  const p = await searchParams;
  const org = organisation.organizationId;
  const db = await getDb();

  const [stellen, zahlen, regel] = await Promise.all([
    db
      .select({ id: schema.jobPostings.id, title: schema.jobPostings.title, status: schema.jobPostings.status })
      .from(schema.jobPostings)
      .where(eq(schema.jobPostings.organizationId, org)),
    vorschlagsZahlen(org),
    regelLaden(org),
  ]);

  const minFit = p.fit ? Number.parseInt(p.fit, 10) : undefined;
  const vorschlaege = await vorschlaegeLaden(org, {
    postingId: p.stelle,
    minFit: Number.isFinite(minFit) ? minFit : undefined,
    zustaende: p.zustand ? [p.zustand as MatchZustand] : undefined,
  });

  const gesamt = Object.values(zahlen).reduce((a, b) => a + b, 0);
  const veroeffentlicht = stellen.filter((s) => s.status === "published").length;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.2rem)] font-semibold tracking-[-0.025em]">
          Matches
        </h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          Vorschläge von {brand.assistantName} — Menschen, die zu einer eurer Stellen passen
          könnten, ohne sich beworben zu haben. Anonym, bis sie selbst zustimmen.
        </p>
      </div>

      {/* Der Suchlauf steht über der Automatisierung: Er ist die
          Handlung, die Vorschläge überhaupt entstehen lässt. */}
      {darf(organisation.rolle, "recruiter") && stellen.length > 0 && (
        <Suchlauf organizationId={org} stellen={stellen.map((s) => ({ id: s.id, title: s.title }))} />
      )}

      <Automatisierung
        organizationId={org}
        stufe={regel.stufe}
        minFit={regel.minFit}
        pausiert={regel.pausiert}
        darfAendern={darf(organisation.rolle, "admin")}
        stufenname={STUFENNAME}
        erklaerung={STUFENERKLAERUNG}
      />

      {gesamt === 0 ? (
        <div className="grid gap-4 rounded-(--radius-md) border border-line p-6">
          <p className="text-[15px] font-medium text-ink">
            {brand.assistantName} schlägt noch niemanden vor.
          </p>
          <p className="max-w-[62ch] text-sm leading-relaxed text-ink-2">
            {veroeffentlicht === 0
              ? "Solange keine Stelle veröffentlicht ist, gibt es nichts, wogegen sie Profile prüfen könnte."
              : `${veroeffentlicht === 1 ? "Eine Stelle ist" : `${veroeffentlicht} Stellen sind`} veröffentlicht. Vorschläge entstehen nur zu Menschen, die der Auffindbarkeit ausdrücklich zugestimmt haben — ohne diese Einwilligung wird niemand geprüft.`}
          </p>
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <Link
              href="/business/stellen"
              className="inline-flex min-h-11 items-center rounded-(--radius-pill) bg-accent px-4 text-sm font-semibold text-accent-on hover:opacity-90"
            >
              Stellen ansehen
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ── Filter ───────────────────────────────────── */}
          <form className="flex flex-wrap items-end gap-4 rounded-(--radius-md) border border-line p-4">
            <label className="grid gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Stelle</span>
              <select
                name="stelle"
                defaultValue={p.stelle ?? ""}
                className="h-11 min-w-48 rounded-[10px] border border-line-3 bg-transparent px-3 text-sm text-ink"
              >
                <option value="">Alle</option>
                {stellen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Mindestpassung</span>
              <select
                name="fit"
                defaultValue={p.fit ?? ""}
                className="h-11 rounded-[10px] border border-line-3 bg-transparent px-3 text-sm text-ink"
              >
                <option value="">Alle</option>
                {[60, 70, 80, 90].map((n) => (
                  <option key={n} value={n}>
                    ab {n}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Zustand</span>
              <select
                name="zustand"
                defaultValue={p.zustand ?? ""}
                className="h-11 min-w-48 rounded-[10px] border border-line-3 bg-transparent px-3 text-sm text-ink"
              >
                <option value="">Alle</option>
                {Object.entries(ZUSTANDSNAME).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v} {zahlen[k] ? `(${zahlen[k]})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-(--radius-pill) border border-line-3 px-4 text-sm font-medium text-ink hover:bg-soft"
            >
              Filtern
            </button>
          </form>

          <p className="text-sm text-ink-3">
            <span className="font-mono tabular-nums">{vorschlaege.length}</span> von{" "}
            <span className="font-mono tabular-nums">{gesamt}</span> Vorschlägen
          </p>

          <ul className="grid gap-4">
            {vorschlaege.map((v) => (
              <MatchKarte
                key={v.id}
                organizationId={org}
                darfHandeln={darf(organisation.rolle, "recruiter")}
                daten={{ ...v, zustandName: ZUSTANDSNAME[v.zustand] }}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
