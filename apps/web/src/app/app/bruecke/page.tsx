import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock, Check } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { bruecke, GEPRUEFT } from "@/lib/bruecke/liste";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Was du heute kannst" };
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was du heute schon antreten kannst
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine Pflegefachkraft mit neun Jahren Erfahrung kann „Fachleitung
 * Sicherheit und Ordnung" für 61.653 € — gemessen, nicht behauptet.
 * Sie bewirbt sich nie darauf, weil sie nicht weiss, dass sie es kann.
 *
 * Diese Seite ist deshalb kein Rat, sondern ein Inventar. Sie sagt
 * nicht „du solltest", sie sagt „du kannst — hier ist die Liste".
 *
 * ── Warum das eine eigene Seite ist ─────────────────────────────
 *
 * Weil die Startfläche von Monday eine Frage stellt und diese Seite
 * eine Antwort gibt. Eine Liste unter dem Eingabefeld wäre eine
 * Behauptung, bevor jemand etwas gefragt hat — und sie würde die eine
 * Fläche zustellen, an der jemand einen Satz formuliert.
 *
 * ── Was hier NICHT steht ────────────────────────────────────────
 *
 * Kein Ranking, keine Prozentzahl, kein „passt zu 82 %". Eine Zahl
 * ohne Grundlage ist der schnellste Weg, das Vertrauen zu verlieren:
 * Wer 68.000 verdient und „Marktwert 52.000" liest, glaubt dem Rest
 * auch nicht mehr.
 *
 * Stattdessen bei jeder Zeile, WARUM sie geht — aus dem, was die
 * Person selbst erzählt hat.
 */
export default async function BrueckeSeite() {
  const user = await requireUser();
  const lage = await bruecke(user.id);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Deine Möglichkeiten"
        title="Was du heute schon kannst"
        lead="Stellen, die du ohne Umschulung und ohne neuen Abschluss antreten könntest. Die meisten davon hast du nie gesucht."
      />

      {lage.art === "kein_profil" && (
        /*
         * Kein Fehler, sondern die ehrliche Auskunft. Wer nichts
         * erzählt hat, über den lässt sich nichts sagen — und eine
         * Liste aus dem Nichts wäre geraten.
         */
        <section className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-6">
          <h2 className="text-[17px] font-semibold text-ink">Dafür muss ich dich erst kennen</h2>
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Diese Liste entsteht aus dem, was du tatsächlich getan hast — nicht aus deinem
            Berufstitel. Erzähl Monday von deinen letzten Stationen, dann rechne ich sie gegen die
            offenen Stellen.
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
            Für diese Prüfung ist kein Modell freigegeben. Die Liste bleibt leer, bis eines läuft —
            sie zu raten wäre schlimmer als sie nicht zu zeigen.
          </p>
        </section>
      )}

      {lage.art === "liste" && (
        <>
          {lage.stellen.length === 0 ? (
            <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-6">
              <h2 className="text-[17px] font-semibold text-ink">Diesmal war nichts dabei</h2>
              <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                Ich habe {lage.geprueft} Anzeigen gegen deinen Verlauf gehalten. Keine davon
                konntest du ohne neuen Abschluss antreten.
                {lage.huerden.length > 0 && (
                  <> Am häufigsten stand im Weg: {lage.huerden[0]!.was}.</>
                )}
              </p>
            </section>
          ) : (
            <section className="grid gap-4">
              <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                Aus {lage.geprueft} geprüften Anzeigen sind{" "}
                <strong className="font-medium text-ink">{lage.stellen.length}</strong> übrig
                geblieben. Bei jeder steht, warum sie geht.
              </p>

              <ul className="grid gap-2">
                {lage.stellen.map((s) => (
                  <li key={s.jobId}>
                    <Link
                      href={`/app/jobs/${s.jobId}`}
                      className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-5 transition-colors hover:border-accent"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-[16px] font-semibold text-ink">{s.titel}</span>
                        {s.jahr !== null && (
                          <span className="font-mono text-[15px] tabular-nums text-accent-text">
                            {s.jahr.toLocaleString("de-DE")} €
                          </span>
                        )}
                      </div>

                      <span className="text-[14px] text-ink-3">{s.firma}</span>

                      {/*
                        Der Grund steht bei der Stelle, nicht in einer
                        Fussnote. Er ist der ganze Unterschied zwischen
                        einem Treffer und einer Erkenntnis.
                      */}
                      {s.weil && (
                        <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
                          {s.weil}
                        </p>
                      )}

                      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-2xs text-ink-3">
                        {s.erreichbar.art === "sofort" && (
                          <span className="inline-flex items-center gap-1.5 text-accent-text">
                            <Check className="size-3.5 shrink-0" strokeWidth={2} />
                            Kannst du sofort antreten
                          </span>
                        )}
                        {s.erreichbar.art === "einarbeitung" && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0" strokeWidth={1.8} />
                            Mit Einarbeitung
                          </span>
                        )}
                        {s.erreichbar.art === "kurzschein" && (
                          /*
                            Die billigste Brücke, mit Preis. Sechs
                            Stellen im Messlauf scheiterten einzig am
                            Staplerschein — zwei Tage. Das zu
                            verschweigen hiesse, den kürzesten Weg zu
                            verschweigen.
                          */
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0" strokeWidth={1.8} />
                            Es fehlt nur: {s.erreichbar.scheine.map((k) => k.name).join(", ")} —{" "}
                            {s.erreichbar.tage} {s.erreichbar.tage === 1 ? "Tag" : "Tage"}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          Anzeige ansehen
                          <ArrowUpRight className="size-3 shrink-0" strokeWidth={2} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {lage.huerden.length > 0 && (
                /*
                 * Was NICHT geht, gehört dazu.
                 *
                 * Eine Stelle, die nicht erscheint, ist für den
                 * Menschen dasselbe wie eine, die es nicht gibt. Wer
                 * sieht, woran es lag, hält die Liste für vollständig
                 * statt für willkürlich.
                 */
                <section className="grid gap-2 border-t border-line pt-5">
                  <h2 className="text-[15px] font-semibold text-ink">Was im Weg stand</h2>
                  <ul className="grid gap-1 text-[14px] text-ink-2">
                    {lage.huerden.map((h) => (
                      <li key={h.was}>
                        {h.anzahl} {h.anzahl === 1 ? "Stelle" : "Stellen"}: {h.was}
                      </li>
                    ))}
                  </ul>
                  <p className="max-w-[var(--measure)] pt-1 text-2xs leading-relaxed text-ink-3">
                    Gesetzlich vorgeschriebene Qualifikationen — Approbation, Meisterbrief,
                    staatliche Anerkennung — werden nie übergangen. Wo das Gesetz eine Ausbildung
                    verlangt, gibt es keine Brücke.
                  </p>
                </section>
              )}
            </section>
          )}

          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Geprüft werden je Aufruf {GEPRUEFT} Anzeigen mit erfasster Anforderungsliste und echter
            Gehaltsangabe. Stellen ohne genannte Vergütung bleiben aussen vor: Ohne Zahl lässt sich
            nicht sagen, ob ein Wechsel ein Aufstieg wäre.
          </p>
        </>
      )}
    </div>
  );
}
