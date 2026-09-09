import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { alleSchalterlagen, modellzustaende } from "@paycheck/ai";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { Badge, Card } from "@/components/ui";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Modelle und Anbieter" };
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was die Modelle gerade tun — Anforderung 18
 * ══════════════════════════════════════════════════════════════════
 *
 * Zwei Fragen, die verschiedene Antworten haben:
 *
 *   „Dürfte dieses Modell?"  — steht in der Umgebung, ist sofort und
 *                              zuverlässig zu beantworten.
 *   „Antwortet es auch?"     — steht nur in dem, was tatsächlich
 *                              gelaufen ist.
 *
 * Die zweite Frage wird deshalb aus `ai_runs` beantwortet und nicht
 * aus dem Schutzschalter. Der lebt im Arbeitsspeicher einer Instanz;
 * auf Vercel sieht diese Seite fast immer eine andere Instanz als die,
 * die das Gespräch bedient hat. Eine Anzeige, die daraus „alles ruhig"
 * schliesst, wäre nicht ungenau, sondern zufällig.
 *
 * Der Schalter steht trotzdem unten — beschriftet als das, was er ist:
 * die Sicht DIESER Instanz.
 *
 * ── Warum die Zahlen erst seit heute stimmen ────────────────────
 *
 * Weil Fehlschläge bis eben nicht eingetragen wurden. `ai_runs` kannte
 * nur `status: "ok"` und zeigte deshalb immer hundert Prozent Erfolg.
 * Wer vor diesem Tag hierher gesehen hätte, hätte eine ruhige Anzeige
 * gesehen und ihr geglaubt.
 */

interface Zeile extends Record<string, unknown> {
  provider: string;
  laeufe: number;
  fehler: number;
  zeit: number;
  p95: number;
  letzterFehler: string | null;
}

export default async function Seite() {
  const user = await requireUser();
  const { flags } = await getPageContext();
  if (!flags.adminArea || (user.role !== "operator" && user.role !== "admin")) {
    notFound();
  }

  const zustaende = modellzustaende();
  const db = await getDb();

  /*
   * Vierundzwanzig Stunden, nach Anbieter.
   *
   * `percentile_cont` statt eines Mittelwerts: Ein Mittel aus neunzig
   * schnellen und zehn hängenden Aufrufen sieht gut aus, und die zehn
   * sind genau die, die jemand gemerkt hat.
   */
  const zeilen = await db
    .execute<Zeile>(
      sql`
        select
          provider,
          count(*)::int                                          as laeufe,
          count(*) filter (where status <> 'ok')::int             as fehler,
          coalesce(percentile_cont(0.5) within group (order by latency_ms), 0)::int  as zeit,
          coalesce(percentile_cont(0.95) within group (order by latency_ms), 0)::int as p95,
          (array_remove(array_agg(error_message order by created_at desc), null))[1] as "letzterFehler"
        from ai_runs
        where created_at > now() - interval '24 hours'
        group by provider
        order by count(*) desc
      `,
    )
    .catch(() => ({ rows: [] as Zeile[] }));

  const nachAnbieter = new Map(
    ((zeilen as { rows?: Zeile[] }).rows ?? []).map((z) => [z.provider, z] as const),
  );
  const schalter = alleSchalterlagen();

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Modelle und Anbieter"
        lead="Was freigegeben ist — und was in den letzten 24 Stunden tatsächlich geantwortet hat."
      />

      <section className="grid gap-3">
        <h2 className="abschnitts-titel">Antwortverhalten (24 Stunden)</h2>
        {nachAnbieter.size === 0 ? (
          <Card className="p-5 text-[14px] leading-relaxed text-ink-2">
            Keine Läufe in den letzten 24 Stunden — oder die Tabelle ist nicht
            erreichbar. Beides sieht hier gleich aus; das ist die ehrlichere
            Anzeige, solange nicht geprüft ist, welches von beidem zutrifft.
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="text-2xs uppercase tracking-[0.08em] text-ink-3">
                <tr>
                  <th className="py-2 pr-4 font-medium">Anbieter</th>
                  <th className="py-2 pr-4 font-medium">Läufe</th>
                  <th className="py-2 pr-4 font-medium">Fehlerquote</th>
                  <th className="py-2 pr-4 font-medium">Median</th>
                  <th className="py-2 pr-4 font-medium">p95</th>
                  <th className="py-2 font-medium">Letzter Fehler</th>
                </tr>
              </thead>
              <tbody>
                {[...nachAnbieter.values()].map((z) => {
                  const quote = z.laeufe > 0 ? z.fehler / z.laeufe : 0;
                  return (
                    <tr key={z.provider} className="border-t border-line align-top">
                      <td className="py-2.5 pr-4 font-medium text-ink">{z.provider}</td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-ink-2">{z.laeufe}</td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums">
                        <span className={quote > 0.1 ? "text-danger-text" : "text-ink-2"}>
                          {(quote * 100).toFixed(1)} %
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-ink-2">{z.zeit} ms</td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-ink-2">{z.p95} ms</td>
                      <td className="py-2.5 max-w-[22rem] truncate text-2xs text-ink-3">
                        {z.letzterFehler ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="abschnitts-titel">Freigabe je Modell</h2>
        <div className="grid gap-2">
          {zustaende.map((z) => (
            <Card key={z.definition.internId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
              <span className="font-medium text-ink">{z.definition.anzeigename}</span>
              <code className="text-2xs text-ink-3">{z.definition.internId}</code>
              <Badge tone={z.anbietbar ? "positive" : "neutral"}>
                {z.anbietbar ? "anbietbar" : "gesperrt"}
              </Badge>
              {z.grund && (
                <span className="w-full text-[13px] leading-relaxed text-ink-3">{z.grund}</span>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="abschnitts-titel">Schutzschalter dieser Instanz</h2>
        <p className="max-w-[var(--measure)] text-[13px] leading-relaxed text-ink-3">
          Nur die Sicht dieses einen Prozesses. Eine andere Instanz kann einen
          Anbieter längst wieder anfragen, während er hier noch draussen ist —
          und umgekehrt. Für die Frage, ob ein Anbieter gesund ist, gilt die
          Tabelle oben.
        </p>
        {schalter.length === 0 ? (
          <Card className="p-4 text-[14px] text-ink-2">
            Kein Anbieter hat in diesem Prozess bisher einen Fehler gemeldet.
          </Card>
        ) : (
          <div className="grid gap-2">
            {schalter.map(({ anbieter, lage }) => (
              <Card key={anbieter} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                <span className="font-medium text-ink">{anbieter}</span>
                <Badge tone={lage.zustand === "zu" ? "positive" : "caution"}>
                  {lage.zustand === "zu" ? "im Betrieb" : lage.zustand === "probe" ? "Probe offen" : "draussen"}
                </Badge>
                <span className="font-mono text-2xs text-ink-3">{lage.fehler} Fehler</span>
                {lage.grund && (
                  <span className="w-full text-[13px] leading-relaxed text-ink-3">{lage.grund}</span>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
