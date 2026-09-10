import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { uebersetzen } from "@/lib/bruecke/uebersetzen";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "In ihrer Sprache" };
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Dasselbe Leben, zwei Sprachen
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Liste sagt einem Menschen, dass er eine Stelle antreten könnte.
 * Diese Seite sagt ihm, wie er es aufschreibt.
 *
 * Wer sich mit einem Pflegelebenslauf auf eine Verwaltungsstelle
 * bewirbt, wird aussortiert — nicht wegen fehlender Eignung, sondern
 * weil der Personaler die Wörter nicht kennt. „Hygienebeauftragte der
 * Station" heisst dort „Ordnungsverantwortung mit gesetzlicher
 * Prüfpflicht", und beides beschreibt dieselbe Arbeit.
 *
 * ── Warum links und rechts nebeneinander stehen ─────────────────
 *
 * Weil die Gegenüberstellung die Aussage ist. Nur die rechte Spalte
 * zu zeigen sähe aus wie ein geschönter Lebenslauf. Nebeneinander
 * sieht man, dass nichts hinzugekommen ist — dieselbe Zeile, andere
 * Sprache.
 *
 * ── Warum das Verworfene sichtbar bleibt ────────────────────────
 *
 * Eine Zeile, die fehlt, sieht für den Menschen aus wie ein Fehler
 * des Produkts. Wer den Grund liest, sieht stattdessen eine Grenze,
 * die eingehalten wurde. Das ist der Unterschied zwischen einem
 * Werkzeug, das schönt, und einem, dem man glauben kann.
 */
export default async function UebersetzungSeite({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const user = await requireUser();
  const { jobId } = await params;
  const lage = await uebersetzen(user.id, jobId);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <Link
          href="/app/bruecke"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 transition-colors hover:text-ink-2"
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={1.8} />
          Zurück zur Liste
        </Link>

        <PageHeader
          eyebrow={lage.art === "fassung" ? lage.firma : undefined}
          title={lage.art === "fassung" ? lage.stellentitel : "In ihrer Sprache"}
          lead="Dieselbe Arbeit, in den Worten dieser Branche. Nichts ist hinzugekommen — links steht, worauf jede Zeile beruht."
        />
      </div>

      {lage.art === "kein_profil" && (
        <section className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-6">
          <h2 className="text-[17px] font-semibold text-ink">Dafür muss ich dich erst kennen</h2>
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Übersetzen kann ich nur, was du erzählt hast. Sag Monday, was du in deinen letzten
            Stationen tatsächlich gemacht hast.
          </p>
          <Link
            href="/app/monday"
            className="inline-flex min-h-11 w-fit items-center rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90"
          >
            Mit Monday sprechen
          </Link>
        </section>
      )}

      {lage.art === "kein_modell" && (
        <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-6">
          <h2 className="text-[17px] font-semibold text-ink">Gerade nicht möglich</h2>
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Für die Übersetzung ist gerade kein Modell erreichbar. Eine geratene Fassung wäre
            schlimmer als keine.
          </p>
        </section>
      )}

      {lage.art === "stelle_unbekannt" && (
        <section className="rounded-(--radius-lg) border border-line bg-raised p-6">
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Diese Stelle gibt es nicht mehr im Bestand.
          </p>
        </section>
      )}

      {lage.art === "fassung" && (
        <>
          {lage.zeilen.length === 0 ? (
            <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-6">
              <h2 className="text-[17px] font-semibold text-ink">Keine Brücke gefunden</h2>
              <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                Zu dieser Stelle liess sich keine deiner Stationen übersetzen, ohne etwas
                hinzuzufügen. Das heisst nicht, dass du sie nicht kannst — nur, dass dein Verlauf
                es noch nicht hergibt.
              </p>
            </section>
          ) : (
            <section className="grid gap-3">
              <div className="overflow-x-auto rounded-(--radius-lg) border border-line">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-soft">
                      <th className="w-1/2 px-4 py-2.5 font-mono text-2xs font-normal uppercase tracking-[0.09em] text-ink-3">
                        So steht es in deinem Verlauf
                      </th>
                      <th className="w-1/2 border-l border-line px-4 py-2.5 font-mono text-2xs font-normal uppercase tracking-[0.09em] text-accent-text">
                        So liest es diese Branche
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lage.zeilen.map((z) => (
                      <tr key={z.original} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-3.5 align-top text-[14.5px] leading-relaxed text-ink-3">
                          {z.original}
                        </td>
                        <td className="border-l border-line px-4 py-3.5 align-top text-[14.5px] font-medium leading-relaxed text-ink">
                          {z.fassung}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                Beide Spalten beschreiben dieselbe Arbeit. Keine Zahl, keine Qualifikation und
                keine Führungsrolle steht rechts, die links nicht schon steht — das wird geprüft,
                Zeile für Zeile.
              </p>

              {/*
                Zwei Wege, und der erste ist der stärkere.

                Die Übersetzung sagt, wie jemand es aufschreibt — eine
                Aussage von Velvova über einen Menschen. Genau das
                bewirkte in einem randomisierten Feldexperiment nichts.
                Was wirkte, war ein Nachweis, den er weitergeben kann.
              */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/app/bruecke/${jobId}/probe`}
                  className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90"
                >
                  Zeig, dass du es kannst
                  <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.8} />
                </Link>
                <Link
                  href={`/app/jobs/${jobId}`}
                  className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-(--radius-control) border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:bg-soft"
                >
                  Die Stelle ansehen
                </Link>
              </div>
            </section>
          )}

          {lage.verworfen.length > 0 && (
            /*
             * Das Verworfene steht unter der Fassung, nicht daneben.
             *
             * Es ist keine gleichwertige Spalte, sondern eine
             * Rechenschaft: Hier hätte etwas gestanden, und hier ist
             * der Grund, warum nicht. Wer das liest, glaubt der
             * Fassung darüber mehr.
             */
            <section className="grid gap-3 border-t border-line pt-6">
              <div className="grid gap-1">
                <h2 className="text-[15px] font-semibold text-ink">
                  Was ich weggelassen habe
                </h2>
                <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-ink-2">
                  Diese Fassungen hätten mehr behauptet als dein Verlauf hergibt. Sie stehen hier,
                  damit du siehst, wo die Grenze lag — nicht, damit du sie benutzt.
                </p>
              </div>

              <ul className="grid gap-2">
                {lage.verworfen.map((v) => (
                  <li
                    key={v.versuch}
                    className="grid gap-1.5 rounded-(--radius-lg) border border-line border-dashed p-4"
                  >
                    <span className="text-[14px] text-ink-3 line-through decoration-ink-3/40">
                      {v.versuch}
                    </span>
                    <span className="text-2xs leading-relaxed text-critical">{v.grund}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
