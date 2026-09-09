import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CHANCENWORT, istEineStelle } from "@paycheck/domain";
import type { StilleChance } from "@/lib/chancen/stillechancen";

/**
 * ══════════════════════════════════════════════════════════════════
 * Stille Chancen — und warum hier nirgends „Stelle" steht
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine stille Chance ist ein Arbeitgeber, der zu jemandem passt und
 * gerade nichts ausgeschrieben hat. In einer Liste sieht sie aus wie
 * eine Stelle — und genau das darf sie nicht.
 *
 * Deshalb kommt das Wort aus `CHANCENWORT` und nicht aus dieser
 * Datei: Es gibt genau eine Fassung, sie steht in der Domäne, und
 * `istEineStelle()` entscheidet, ob etwas so heissen darf. Zwei
 * Oberflächen mit eigenen Wörtern laufen auseinander, und dann steht
 * an einer Stelle „Offene Stelle" über einer Vermutung.
 *
 * ── Warum die Belegdichte neben der Punktzahl steht ─────────────
 *
 * Weil eine 90 aus einem Datenpunkt keine 90 ist. Sie allein zu
 * zeigen wäre dieselbe Zahl mit einer anderen Bedeutung, und der
 * Unterschied zwischen „wir wissen viel und es passt" und „wir wissen
 * fast nichts" ist genau der, auf den es bei einer Entscheidung
 * ankommt.
 *
 * ── Warum kein Knopf „Bewerben" ─────────────────────────────────
 *
 * Es gibt nichts, worauf man sich bewerben könnte. Der einzige
 * ehrliche nächste Schritt ist ein Gespräch darüber, ob eine Anfrage
 * sinnvoll wäre — und diese Entscheidung trifft ein Mensch.
 */

const LAGENWORT: Record<string, string> = {
  erwuenscht: "Initiativbewerbungen ausdrücklich erwünscht",
  erlaubt: "Initiativbewerbungen möglich",
  unklar: "Zu Initiativbewerbungen steht nichts Eindeutiges",
  unerwuenscht: "Der Arbeitgeber bittet, davon abzusehen",
  ausgeschlossen: "Initiativbewerbungen ausgeschlossen",
  unbekannt: "Karriereseite noch nicht geprüft",
};

const KANALWORT: Record<string, string> = {
  initiativformular: "Initiativformular",
  karriereformular: "Bewerbungsformular",
  recruitingadresse: "Adresse der Personalabteilung",
  ansprechpartner: "Ansprechpartner",
  allgemeiner_kontakt: "Allgemeiner Kontakt",
};

export function StilleChancen({ chancen }: { chancen: StilleChance[] }) {
  if (chancen.length === 0) return null;

  return (
    <section className="grid gap-4">
      <div className="grid gap-1.5">
        <h2 className="text-[19px] font-semibold tracking-tight text-ink">
          Arbeitgeber ohne passende Anzeige
        </h2>
        <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
          Sie beschäftigen Menschen wie dich — nachweisbar, aus ihren früheren
          Ausschreibungen. Ob dort gerade etwas frei ist, weiss niemand.{" "}
          <strong className="font-medium text-ink">Das hier sind keine Stellen.</strong>
        </p>
      </div>

      <ul className="grid gap-3">
        {chancen.map((c) => (
          <Karte key={c.id} chance={c} />
        ))}
      </ul>
    </section>
  );
}

function Karte({ chance }: { chance: StilleChance }) {
  const bestaetigt = chance.sicherheit === "bestaetigt";
  const kanal = chance.kanaele[0];

  return (
    <li className="grid gap-3.5 rounded-(--radius-lg) border border-line bg-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          {/*
            Das Wort kommt aus der Domäne. `istEineStelle` gibt hier
            immer false — die Prüfung steht trotzdem da, weil sie die
            Regel ist und nicht die Annahme.
          */}
          <span
            className={[
              "w-fit rounded-(--radius-pill) border px-2.5 py-0.5 text-2xs uppercase tracking-[0.08em]",
              bestaetigt
                ? "border-accent/40 bg-accent/10 text-accent-text"
                : "border-line text-ink-3",
            ].join(" ")}
          >
            {CHANCENWORT[chance.art]}
          </span>
          <h3 className="text-[16px] font-semibold text-ink">{chance.arbeitgeber}</h3>
          {!istEineStelle(chance.art) && chance.bestaetigteRolle && (
            <p className="text-[14px] text-ink-2">{chance.bestaetigteRolle}</p>
          )}
        </div>

        {chance.punkte !== null && (
          /*
            Beide Zahlen, immer zusammen. Die Belegdichte ist keine
            Nebenangabe — sie sagt, was die erste Zahl wert ist.
          */
          <div className="grid justify-items-end gap-0.5 text-right">
            <span className="font-mono text-[19px] font-medium tabular-nums text-ink">
              {chance.punkte}
            </span>
            <span className="font-mono text-2xs tabular-nums text-ink-3">
              {chance.belegdichte === null
                ? "Belege unbekannt"
                : `belegt zu ${Math.round(chance.belegdichte * 100)} %`}
            </span>
          </div>
        )}
      </div>

      {chance.belege.length > 0 && (
        <ul className="grid gap-1.5 border-t border-line pt-3">
          {chance.belege.slice(0, 3).map((b, i) => (
            <li key={`${b.quelle}-${i}`} className="grid gap-0.5">
              <span className="text-[14px] leading-relaxed text-ink-2">{b.aussage}</span>
              <span className="font-mono text-2xs text-ink-3">
                {b.quelle} · {new Date(b.standAm).toLocaleDateString("de-DE")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-1.5 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-3">
        <span>{LAGENWORT[chance.initiativlage] ?? chance.initiativlage}</span>

        {kanal && (
          <span>
            Weg dorthin: {KANALWORT[kanal.art] ?? kanal.art} —{" "}
            <a
              href={kanal.belegUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-baseline gap-1 text-accent-text underline underline-offset-[3px]"
            >
              gefunden auf ihrer Seite
              <ExternalLink className="size-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
            </a>
          </span>
        )}

        {chance.karriereseiteGeprueftAm && (
          <span>
            Karriereseite geprüft am{" "}
            {new Date(chance.karriereseiteGeprueftAm).toLocaleDateString("de-DE")}
          </span>
        )}

        {chance.erwarteterZeitraum && (
          <span className="text-ink-2">Möglicher Zeitraum: {chance.erwarteterZeitraum}</span>
        )}
      </div>

      {/*
        Kein „Bewerben". Es gibt nichts, worauf man sich bewerben
        könnte — der einzige ehrliche nächste Schritt ist ein Gespräch
        darüber, ob eine Anfrage sinnvoll wäre.
      */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/app/monday"
          className="inline-flex min-h-11 items-center rounded-(--radius-control) border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Mit Monday prüfen
        </Link>
        {chance.karriereseiteUrl && (
          <a
            href={chance.karriereseiteUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-4 text-[14px] text-ink-2 transition-colors hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Karriereseite ansehen
            <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.8} />
          </a>
        )}
      </div>
    </li>
  );
}
