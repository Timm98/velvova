import Link from "next/link";
import { brand } from "@paycheck/config";
import { BELEGZAHL, FELDER, KENNZAHLEN } from "./unternehmensbelege";
import { Erscheint } from "./Erscheint";
import { Rechnet } from "./Rechnet";

/**
 * Die Belege zum Recruiting — und ihre Grenzen.
 *
 * ── Warum drei Zahlen oben und fünfzig unten ──────────────────
 *
 * Eine Wand aus Prozentzahlen liest niemand, und sie wirkt weniger
 * glaubwürdig, nicht mehr: Wer fünfzig Zahlen zeigt, sieht aus, als
 * wolle er überzeugen. Wer drei zeigt und darunter die vollständige
 * Liste mit Jahr, Herausgeber und Einschränkung, sieht aus, als habe
 * er nachgelesen.
 *
 * ── Warum jeder Befund seine Grenze mitführt ──────────────────
 *
 * „Rund 50 % mehr Rückmeldungen bei weiss wahrgenommenen Namen" ist
 * ein US-Feldexperiment von 2004. Ohne diesen Zusatz liest es sich wie
 * eine Aussage über deutsche Personalabteilungen — und wer das später
 * bemerkt, glaubt auch den übrigen 49 Befunden nicht mehr.
 *
 * ── Was hier ausdrücklich NICHT steht ─────────────────────────
 *
 * Eine Erfolgsquote für Nina. Diese Studien belegen Probleme und
 * zeigen, welche Methoden wirken; keine von ihnen hat Nina
 * untersucht. Eigene Zahlen kommen nach Pilotkunden und eigener
 * Messung, mit Grundgesamtheit und Zeitraum — bis dahin steht hier
 * nichts über Nina, was nicht auch ohne Nina wahr wäre.
 */
export function Studienlage() {
  /* Nur die drei Zahlen. Die vollständige Methodik steht unter
     `/for-business/studien` — siehe `Methodik` weiter unten. */
  return (
      <section id="belege">
        <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-20 md:px-8 md:py-28">
          <Erscheint className="grid max-w-[68ch] gap-4">
            <p className="text-2xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ed-ink-3)" }}>
              Was belegt ist
            </p>
            <h2 className="font-display text-[clamp(1.7rem,3vw,2.6rem)] font-semibold leading-[1.06] tracking-[-0.03em]">
              Mehr Bewerbungen lösen kein Matchingproblem.
            </h2>
            <p className="text-[clamp(1rem,1.3vw,1.1rem)] leading-[1.62]" style={{ color: "var(--ed-ink-2)" }}>
              Die Zahlen stammen aus fremden Erhebungen — IAB, DIHK, KfW, BIBB und der
              Fachliteratur. Sie zeigen das Problem, nicht die Wirkung von {brand.assistantName}.
            </p>
          </Erscheint>

          <div className="grid gap-4 md:grid-cols-3">
            {KENNZAHLEN.map((k, i) => (
              <Erscheint
                key={k.quelle}
                className="grid content-start gap-3 rounded-(--radius-md) border border-line p-6"
              >
                {/*
                  Die Zahl rechnet sich beim Scrollen hoch — dieselbe
                  Bewegung wie überall sonst auf der Seite, damit sie
                  als dieselbe Art von Angabe gelesen wird.
                */}
                <span className="font-mono text-[clamp(2rem,4vw,3rem)] font-bold tabular-nums leading-none" style={{ color: "var(--ed-violet-text)" }}>
                  <Rechnet wert={k.zahl} einheit={k.einheit} verzoegerung={i * 160} />
                </span>
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                  {k.text}
                </p>
                <p className="text-2xs" style={{ color: "var(--ed-ink-3)" }}>
                  {k.quelle}
                </p>
              </Erscheint>
            ))}
          </div>

          {/*
            Der Verweis steht unter den Zahlen, nicht daneben.

            Wer die drei Zahlen gelesen hat und sie glaubt, liest nicht
            weiter. Wer sie nicht glaubt, sucht genau hier nach der
            Grundlage — und findet sie vollständig statt in einer
            Auswahl, die wir für ihn getroffen haben.
          */}
          <p className="text-sm" style={{ color: "var(--ed-ink-3)" }}>
            {BELEGZAHL} Befunde mit Herausgeber, Jahr und Grenze stehen unter{" "}
            <Link href="/for-business/studien" className="underline underline-offset-[3px]">
              Studien und Methodik
            </Link>
            .
          </p>
        </div>
      </section>
  );
}

/**
 * Die vollständige Methodik — auf einer eigenen Seite.
 *
 * ── Warum nicht auf der Unternehmensseite ─────────────────────
 *
 * Fünfundfünfzig Befunde mit Herausgeber, Jahr und Grenze sind rund
 * zweitausend Wörter. Auf der Seite, die zur Anmeldung führt, sind das
 * zweitausend Wörter zwischen jemandem und dem Knopf — und wer sie
 * liest, liest sie nicht dort, sondern wenn er es genau wissen will.
 *
 * Auf der Verkaufsseite stehen die drei Zahlen mit einem Verweis
 * hierher. Das ist auch die glaubwürdigere Reihenfolge: erst die
 * Behauptung, dann auf Wunsch die vollständige Grundlage.
 */
export function Methodik() {
  return (
      <section>
        <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-20 md:px-8 md:py-28">
          <div className="grid max-w-[68ch] gap-4">
            <p className="text-2xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ed-ink-3)" }}>
              Studien und Methodik
            </p>
            <h2 className="font-display text-[clamp(1.6rem,2.8vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
              {BELEGZAHL} Befunde, jeder mit Herausgeber, Jahr und Grenze.
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
              Diese Untersuchungen belegen Probleme im Recruiting und zeigen, welche Methoden
              wirken. Keine von ihnen hat {brand.assistantName} untersucht. Eigene Erfolgszahlen
              nennen wir erst nach Pilotkunden und eigener Messung — mit Grundgesamtheit und
              Erhebungszeitraum, wie bei jeder Zahl auf dieser Seite.
            </p>
          </div>

          <div className="grid gap-10">
            {FELDER.map((feld) => (
              <div key={feld.id} className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
                <div className="grid content-start gap-4">
                  <h3 className="font-display text-[clamp(1.2rem,2vw,1.5rem)] font-semibold leading-snug tracking-[-0.02em]">
                    {feld.titel}
                  </h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                    {feld.problem}
                  </p>

                  {/*
                    „Woran Nina daraufhin gebaut ist" — nicht „was Nina
                    bewirkt". Der Unterschied ist der ganze Punkt
                    dieses Abschnitts: Die Studien begründen die
                    Bauweise, nicht das Ergebnis.
                  */}
                  <div className="grid gap-2.5 rounded-(--radius-md) border border-line p-5">
                    <p className="text-2xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ed-violet-text)" }}>
                      Woran {brand.assistantName} daraufhin gebaut ist
                    </p>
                    <ul className="grid gap-2">
                      {feld.antwort.map((a) => (
                        <li key={a} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                          <span aria-hidden className="mt-2.5 h-px w-3 shrink-0" style={{ background: "var(--ed-hairline-strong)" }} />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <ol className="grid gap-4">
                  {feld.belege.map((b, i) => (
                    <li key={`${b.quelle}-${b.jahr}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                      <span className="pt-0.5 font-mono text-sm tabular-nums" style={{ color: "var(--ed-ink-3)" }}>
                        {i + 1}
                      </span>
                      <div className="grid gap-1">
                        <p className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink)" }}>
                          {b.erkenntnis}
                        </p>
                        <p className="text-2xs" style={{ color: "var(--ed-ink-3)" }}>
                          {b.quelle} · {b.jahr}
                        </p>
                        {/*
                          Die Grenze steht in derselben Schriftgrösse
                          wie die Quelle, nicht kleiner. Sie ist Teil
                          des Befunds und keine Fussnote dazu.
                        */}
                        {b.grenze && (
                          <p className="text-2xs italic leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
                            Grenze: {b.grenze}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>
  );
}
