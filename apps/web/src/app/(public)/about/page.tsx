import type { Metadata } from "next";
import { company, contactChannels, isPublishableEmail, team } from "@/lib/content/company";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Über uns" };
export const dynamic = "force-dynamic";

/**
 * Über uns.
 *
 * Wenige Angaben, alle geprüft. Was noch nicht feststeht, steht als
 * fehlend da — nicht als Platzhalter, der versehentlich in Produktion
 * landet und dort aussieht wie eine Angabe.
 */
export default function AboutPage() {
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-10 px-5 py-14 md:px-8">
      <PageHeader
        eyebrow="Über uns"
        title="Wer hinter Paycheck steht"
        lead="Zwei Menschen, ein Produkt und die Überzeugung, dass eine Bewerbung mehr wert ist als dreihundert."
      />

      <section className="grid gap-8">
        {team.map((m) => (
          <div key={m.name} className="grid gap-2 border-t border-line pt-6">
            <p className="font-display text-lg font-semibold tracking-[-0.02em]">{m.name}</p>
            <p className="font-mono text-2xs uppercase tracking-wider text-ink-3">
              {m.roleConfirmed ? `${m.role} · ${m.focus}` : m.focus}
            </p>
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{m.bio}</p>

            {isPublishableEmail(m.email) ? (
              <a
                href={`mailto:${m.email}`}
                className="inline-flex min-h-6 items-center text-sm text-accent-text underline underline-offset-[3px]"
              >
                {m.email}
              </a>
            ) : (
              /*
               * Keine Adresse ist besser als eine halbe. Eine wie
               * "name@....com" sieht fertig aus und ist es nicht — wer
               * darauf schreibt, bekommt keine Antwort und weiss nicht,
               * warum.
               */
              <p className="text-sm text-ink-3">
                Kontaktadresse wird vor Veröffentlichung ergänzt.
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-4 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Kontakt</h2>
        <dl className="grid gap-4">
          {contactChannels.map((c) => (
            <div key={c.label} className="grid gap-1">
              <dt className="text-sm font-medium">{c.label}</dt>
              <dd className="text-sm leading-relaxed text-ink-2">
                {c.purpose}{" "}
                {isPublishableEmail(c.email) ? (
                  <a
                    href={`mailto:${c.email}`}
                    className="text-accent-text underline underline-offset-[3px]"
                  >
                    {c.email}
                  </a>
                ) : (
                  <span className="text-ink-3">Adresse wird vor Veröffentlichung ergänzt.</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {!company.legalName && (
        <p className="text-xs leading-relaxed text-ink-3">
          Die vollständigen Unternehmensangaben stehen im Impressum, sobald die Gesellschaft
          eingetragen ist.
        </p>
      )}
    </div>
  );
}
