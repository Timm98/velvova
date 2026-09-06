import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { MapPin, Building2 } from "lucide-react";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { Laufband } from "@/components/ui/Laufband";

/**
 * Ein laufendes Band mit Stellen.
 *
 * ── Warum es sich bewegt und die Stimmen nicht ────────────────
 *
 * Eine Stellenkarte ist ein Angebot, kein Text: Man erfasst Titel,
 * Ort und Gehalt im Vorbeigehen und greift zu, wenn etwas passt. Dafür
 * ist ein laufendes Band richtig — es zeigt Breite, ohne Platz zu
 * kosten. Bewertungen dagegen will man lesen; die warten.
 *
 * ── Warum nur die neuesten und keine „Empfehlung" ─────────────
 *
 * „Diese Stellen könnten zu dir passen" wäre ohne bestätigtes Profil
 * eine Behauptung. Was hier steht, ist überprüfbar: die zuletzt
 * hinzugekommenen Anzeigen des gewählten Marktes, nach Datum sortiert.
 * Sobald ein Profil vorliegt, trägt die Stellenseite die begründete
 * Reihenfolge — dort, wo auch die Begründung danebensteht.
 */
export async function StellenBand({ anzahl = 12 }: { anzahl?: number } = {}) {
  const user = await requireUser();
  const db = await getDb();

  /*
   * Der Markt kommt aus den Einstellungen, nicht aus einer Vorgabe.
   *
   * Wer die Region im Fuss auf Grossbritannien stellt und dann auf der
   * Startseite deutsche Stellen sieht, hält die Einstellung für kaputt
   * — und hat recht.
   */
  const [einstellung] = await withUser(db, user.id, (tx) =>
    tx
      .select({ land: schema.userSettings.jobMarketCountry })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, user.id))
      .limit(1),
  ).catch(() => []);
  const land = einstellung?.land ?? "DE";

  /*
   * Erst die Stellen, dann die Namen — dieselbe Reihenfolge wie in der
   * öffentlichen Suche. Mit `join` in einer Abfrage verbindet der
   * Planer die ganze Treffermenge, bevor er sie kürzt.
   */
  const zeilen = await db
    .select({
      id: schema.jobs.id,
      titel: schema.jobs.title,
      firmaId: schema.jobs.companyId,
      ort: schema.jobs.location,
      gehaltMin: schema.jobs.salaryMin,
      waehrung: schema.jobs.salaryCurrency,
      angegeben: schema.jobs.salaryDisclosed,
      gehaltMax: schema.jobs.salaryMax,
      zeitraum: schema.jobs.salaryPeriod,
    })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.isDemo, false), eq(schema.jobs.country, land)))
    .orderBy(sql`coalesce(${schema.jobs.publishedAt}, ${schema.jobs.fetchedAt}) desc`)
    .limit(anzahl)
    .catch(() => []);

  if (zeilen.length === 0) return null;

  const firmen = await db
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(inArray(schema.companies.id, [...new Set(zeilen.map((z) => z.firmaId))]))
    .catch(() => []);
  const name = new Map(firmen.map((f) => [f.id, f.name]));

  return (
    <section aria-labelledby="neue-stellen" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="neue-stellen" className="font-display text-xl font-semibold tracking-[-0.02em]">
          Gerade dazugekommen
        </h2>
        <Link
          href="/app/jobs"
          className="text-sm font-medium text-accent-text underline underline-offset-[3px]"
        >
          Alle Stellen
        </Link>
      </div>

      <Laufband beschriftung="Zuletzt hinzugekommene Stellen">
        {zeilen.map((z) => (
          <Link
            key={z.id}
            href={`/app/jobs/${z.id}`}
            className="grid w-[19rem] shrink-0 content-start rounded-(--radius-lg) border border-line bg-surface transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {/*
              Ohne Motiv.

              Ein Bild je Karte kam aus der Berufsgruppe, nicht vom
              Unternehmen — und genau das war das Problem: Vier Stellen
              desselben Arbeitgebers trugen vier verschiedene
              Symbolbilder, die mit der Anzeige nichts zu tun hatten.
              Ein Band aus Titel, Ort und Gehalt liest sich schneller
              und behauptet nichts.
            */}
            <div className="grid content-start gap-2 px-4 py-3.5">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{z.titel}</p>
              {/* `line-clamp-2` statt `truncate`: Ein Firmenname, der
                  mitten im Wort endet, sieht aus wie ein Fehler. Zwei
                  Zeilen kosten in einer Karte dieser Höhe nichts. */}
              <p className="flex items-start gap-1.5 text-2xs text-ink-2">
                <Building2 aria-hidden className="mt-0.5 size-3 shrink-0 text-ink-3" />
                {name.get(z.firmaId) ?? "Unternehmen nicht angegeben"}
              </p>
              <p className="flex items-start gap-1.5 text-2xs text-ink-2">
                <MapPin aria-hidden className="mt-0.5 size-3 shrink-0 text-ink-3" />
                {z.ort}
              </p>
              {/*
                Das Gehalt steht nur da, wenn die Anzeige eines nennt —
                und wird dann hervorgehoben. Eine Schätzung gehört auf
                die Detailseite, wo daneben steht, woher sie kommt.
              */}
              {z.angegeben && z.gehaltMin ? (
                <span className="mt-0.5 justify-self-start rounded-full bg-positive-soft px-2.5 py-1 font-mono text-2xs font-bold text-ink">
                  {geld(z.gehaltMin, z.gehaltMax, z.waehrung, z.zeitraum)}
                </span>
              ) : (
                <span className="mt-0.5 text-2xs text-ink-3">Gehalt nicht angegeben</span>
              )}
            </div>
          </Link>
        ))}
      </Laufband>
    </section>
  );
}

/** Betrag oder Spanne, in der Währung der Anzeige. */
function geld(
  min: number,
  max: number | null,
  waehrung: string,
  zeitraum: string | null,
): string {
  const f = (n: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: waehrung || "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  const einheit = zeitraum === "hour" ? " / Std." : zeitraum === "month" ? " / Mon." : "";
  return max && max > min ? `${f(min)} – ${f(max)}${einheit}` : `ab ${f(min)}${einheit}`;
}
