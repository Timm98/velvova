import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Moon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { berichtGesehen, morgenlage } from "@/lib/nachtlauf";
import { fastPassende } from "@/lib/wandelbar";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Heute Nacht" };
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Morgen
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Moment, um den es geht: Jemand klappt abends den Rechner zu und
 * findet morgens einen Satz vor, der stimmt.
 *
 *   „Ich habe heute Nacht 143 Stellen geprüft. 61 erfüllten deine
 *    Mindestanforderungen. Diese fünf würde ich mir zuerst ansehen."
 *
 * ── Warum der Satz aus einer Funktion kommt ─────────────────────
 *
 * Weil er nichts formulieren darf, was nicht gezählt wurde. Ein
 * Modell, das ihn schreibt, kann „viele" sagen, wo vier stehen, oder
 * „über Nacht durchsucht" behaupten, wenn drei Quellen ausgefallen
 * sind. `bilanzSatz()` kann das nicht — es hat nur die Zahlen.
 *
 * ── Warum der Grund vor den Vorschlägen steht ───────────────────
 *
 * Wer „zwei Vorschläge" liest, denkt, das Produkt taugt nichts. Wer
 * liest „deine Gehaltsgrenze schliesst 84 von 91 aus", hat eine
 * Entscheidung vor sich. Deshalb steht der Grund oben, nicht als
 * Fussnote.
 *
 * ── Warum hier kein Knopf „alle bewerben" steht ─────────────────
 *
 * Weil Velvova nicht versendet. Der Weg zur Bewerbung führt über die
 * Stelle und die Entwurfsübergabe, wo der Mensch sieht, was in seinem
 * Namen hinausgeht. Ein Sammelknopf hier wäre bequem und genau die
 * Stelle, an der das Versprechen bricht.
 */
export default async function MorgenSeite() {
  const user = await requireUser();
  const [lage, wandelbar] = await Promise.all([morgenlage(user.id), fastPassende(user.id)]);

  /*
   * Das Aufschlagen ist das Ereignis, nicht das Schreiben.
   *
   * Ohne diese Zeile liesse sich nie beantworten, ob der Morgenmoment
   * überhaupt stattfindet — die eine Frage, an der das Vorhaben hängt.
   */
  if (lage.lauf && !lage.lauf.schonGesehen) await berichtGesehen(user.id, lage.lauf.id);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={lage.lauf ? lage.lauf.auftragsname : undefined}
        title="Heute Nacht"
        lead={
          lage.lauf
            ? lage.satz
            : "Hier steht morgens, was in der Nacht passiert ist — sobald eine Suche läuft."
        }
      />

      {!lage.lauf && (
        <section className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-6">
          <div className="flex items-center gap-2">
            <Moon className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
            <h2 className="text-[17px] font-semibold text-ink">
              {lage.auftragLaeuft ? "Die erste Nacht steht noch aus" : "Noch keine Suche"}
            </h2>
          </div>
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            {lage.auftragLaeuft
              ? "Deine Suche ist aktiv, aber es gab noch keinen nächtlichen Lauf. Morgen früh steht hier, was Monday geprüft hat."
              : "Sag Monday, was du suchst. Danach sucht sie nachts weiter und legt dir morgens hin, was sie gefunden hat — und was nicht."}
          </p>
          <Link
            href="/app/monday"
            className="inline-flex min-h-11 w-fit items-center rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90"
          >
            Mit Monday sprechen
          </Link>
        </section>
      )}

      {lage.grund && (
        /*
         * Der Grund zuerst.
         *
         * Er ist keine Entschuldigung, sondern eine Entscheidung, die
         * beim Menschen liegt: ein Kriterium lockern oder nicht.
         */
        <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-soft p-5">
          <h2 className="text-[15px] font-semibold text-ink">Warum heute wenig dabei ist</h2>
          <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
            {lage.grund}
          </p>
          <Link
            href="/app/suchauftrag"
            className="w-fit text-[14px] text-accent-text underline-offset-4 hover:underline"
          >
            Kriterien ansehen
          </Link>
        </section>
      )}

      {lage.vorschlaege.length > 0 && (
        <section className="grid gap-4">
          <h2 className="text-[17px] font-semibold text-ink">
            {lage.vorschlaege.length === 1
              ? "Diese Stelle würde ich mir ansehen"
              : `Diese ${lage.vorschlaege.length} würde ich mir zuerst ansehen`}
          </h2>

          <ul className="grid gap-3">
            {lage.vorschlaege.map((v) => (
              <li
                key={v.trefferId}
                className="grid gap-2.5 rounded-(--radius-lg) border border-line bg-raised p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="grid gap-0.5">
                    <span className="text-[16px] font-semibold text-ink">{v.titel}</span>
                    <span className="text-[14px] text-ink-2">
                      {v.firma}
                      {v.ort ? ` · ${v.ort}` : ""}
                    </span>
                  </div>
                  {v.fitScore !== null && (
                    /*
                     * Die Zahl steht da, wo sie hingehört: neben der
                     * Stelle, nicht als Überschrift. Und ohne
                     * Prozentzeichen-Theater — sie ist ein Rangsignal,
                     * keine Wahrscheinlichkeit.
                     */
                    <span className="font-mono text-2xs uppercase tracking-[0.09em] text-accent-text tabular-nums">
                      Passung {v.fitScore}
                    </span>
                  )}
                </div>

                {v.gruende.length > 0 && (
                  <ul className="grid gap-1">
                    {v.gruende.slice(0, 3).map((g) => (
                      <li key={g} className="text-[14.5px] leading-relaxed text-ink-2">
                        · {g}
                      </li>
                    ))}
                  </ul>
                )}

                {(v.offenePunkte.length > 0 || v.caveat) && (
                  /*
                   * Was offen ist, steht mit dabei — nicht kleiner,
                   * nicht weggeklappt. Eine unbekannte Muss-Angabe ist
                   * weder erfüllt noch verletzt, und sie auf „passt"
                   * zu runden ist der Fehler, den dieses Produkt
                   * ausdrücklich nicht macht.
                   */
                  <p className="max-w-[var(--measure)] border-t border-line pt-2.5 text-2xs leading-relaxed text-ink-3">
                    Offen: {[...v.offenePunkte, v.caveat].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="flex flex-wrap gap-2.5 pt-0.5">
                  <Link
                    href={`/app/jobs/${v.jobId}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90"
                  >
                    Die Stelle ansehen
                    <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.8} />
                  </Link>
                  <Link
                    href={`/app/bruecke/${v.jobId}`}
                    className="inline-flex min-h-10 items-center rounded-(--radius-control) border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:bg-soft"
                  >
                    In ihrer Sprache
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {wandelbar.length > 0 && (
        /*
         * Die Stellen, die der Abgleich weggeworfen hat — zu Recht.
         *
         * Ein verletztes Muss-Kriterium ist ein verletztes
         * Muss-Kriterium. Nur ist die Anzeige keine Tatsache, sondern
         * eine Momentaufnahme dessen, was sich jemand vorgestellt hat,
         * und niemand fragt nach.
         *
         * Hier stehen nur die, bei denen ALLE Hindernisse Bedingungen
         * des Arbeitgebers sind. Wo eine Zulassung fehlt, steht nichts:
         * Die Frage wäre eine Aufforderung zum Rechtsbruch.
         */
        <section className="grid gap-4 border-t border-line pt-6">
          <div className="grid gap-1">
            <h2 className="text-[17px] font-semibold text-ink">
              Fast passend — es fehlt nur eine Bedingung
            </h2>
            <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
              Diese Stellen habe ich aussortiert, weil ein Muss-Kriterium verletzt ist. Bei ihnen
              ist es eines, das der Arbeitgeber selbst gesetzt hat — und das er ändern könnte, wenn
              er wollte.
            </p>
          </div>

          <ul className="grid gap-3">
            {wandelbar.map((w) => (
              <li
                key={w.jobId}
                className="grid gap-2.5 rounded-(--radius-lg) border border-line border-dashed p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="grid gap-0.5">
                    <span className="text-[15.5px] font-semibold text-ink">{w.titel}</span>
                    <span className="text-[14px] text-ink-2">
                      {w.firma}
                      {w.ort ? ` · ${w.ort}` : ""}
                    </span>
                  </div>
                  {w.fitScore !== null && (
                    <span className="font-mono text-2xs uppercase tracking-[0.09em] text-ink-3 tabular-nums">
                      Passung {w.fitScore}
                    </span>
                  )}
                </div>

                <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
                  {w.text}
                </p>

                {/*
                  Die Fragen stehen im Wortlaut da, nicht als Andeutung.

                  Wer nicht liest, was in seinem Namen gefragt würde,
                  kann es nicht freigeben — und eine Anfrage, die
                  jemand nicht gelesen hat, soll von hier nicht
                  hinausgehen.
                */}
                <ul className="grid gap-1 border-t border-line pt-2.5">
                  {w.fragen.map((f) => (
                    <li key={f} className="text-[14px] leading-relaxed text-ink-3">
                      „{f}"
                    </li>
                  ))}
                </ul>

                <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                  Gefragt wird erst, wenn du es freigibst — und ohne deinen Namen. Der Arbeitgeber
                  erfährt, dass jemand passen würde, nicht wer.
                </p>

                <Link
                  href={`/app/jobs/${w.jobId}`}
                  className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-(--radius-control) border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:bg-soft"
                >
                  Die Stelle ansehen
                  <ArrowUpRight className="size-4 shrink-0" strokeWidth={1.8} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lage.lauf && lage.vorschlaege.length === 0 && !lage.grund && (
        <section className="rounded-(--radius-lg) border border-line bg-raised p-6">
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Heute Nacht war nichts dabei, das ich dir empfehlen würde. Das ist kein Ausfall — es
            heisst nur, dass keine der geprüften Anzeigen deine Bedingungen wirklich getroffen hat.
          </p>
        </section>
      )}

      {lage.lauf && (
        /*
         * Die Bilanz zum Nachsehen.
         *
         * Nicht als Kachelwand mit grossen Zahlen: Sie ist die
         * Rechenschaft über den Satz oben, kein Dashboard. Wer prüfen
         * will, ob die Zahl stimmt, findet sie hier — wer nicht,
         * liest sie nie.
         */
        <section className="grid gap-3 border-t border-line pt-6">
          <h2 className="text-[15px] font-semibold text-ink">Die Nacht in Zahlen</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-4">
            {(
              [
                ["Angesehen", lage.bilanz.geprueft],
                ["Erfüllen deine Muss-Kriterien", lage.bilanz.nachFiltern],
                ["Empfohlen", lage.bilanz.empfohlen],
                ["Angabe fehlt", lage.bilanz.zurueckgestellt],
              ] as const
            ).map(([wort, zahl]) => (
              <div key={wort} className="grid gap-0.5">
                <dt className="text-2xs leading-snug text-ink-3">{wort}</dt>
                <dd className="text-[18px] font-semibold text-ink tabular-nums">{zahl}</dd>
              </div>
            ))}
          </dl>

          {lage.bilanz.quellenFehler.length > 0 && (
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-critical">
              Nicht erreichbar in dieser Nacht: {lage.bilanz.quellenFehler.join(", ")}. Der Lauf ist
              trotzdem gelaufen, aber er war nicht vollständig.
            </p>
          )}

          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            {lage.stillerMarktText} Ein Arbeitgeber, der zu dir passt und gerade nichts
            ausgeschrieben hat, ist keine Stelle — deshalb steht er hier als Zahl und nicht als
            Vorschlag.
          </p>
        </section>
      )}
    </div>
  );
}
