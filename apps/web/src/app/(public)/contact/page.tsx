import type { Metadata } from "next";
import {
  anzeigbareKontakte,
  contactChannels,
  isPublishableEmail,
  team,
  zustellwarnung,
} from "@/lib/content/company";
import { PageHeader } from "@/components/ui/states";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Kontakt" };
export const dynamic = "force-dynamic";

export default function ContactPage() {
  const warnung = zustellwarnung(process.env.NODE_ENV === "production");
  const kontakte = anzeigbareKontakte();

  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-10 px-5 py-14 md:px-8">
      <PageHeader
        eyebrow="Kontakt"
        title="Schreib uns"
        lead="Wir lesen jede Nachricht. Antwortzeiten nennen wir erst, wenn wir sie auch halten können."
      />

      <ContactForm />

      {/* ── Team ─────────────────────────────────────────────── */}
      <section className="grid gap-6 border-t border-line pt-8">
        <div className="grid gap-2">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Wer dahintersteht</h2>
          <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
            Kein Callcenter. Die Nachricht landet bei den Leuten, die das Produkt bauen.
          </p>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2">
          {team.map((m) => (
            <li key={m.name} className="grid gap-1.5 rounded-(--radius-lg) bg-soft px-5 py-5">
              <p className="text-base font-semibold">{m.name}</p>
              <p className="text-sm text-ink-2">
                {m.role}
                {/*
                  Solange die Rollenbezeichnung nicht bestätigt ist,
                  steht sie ohne Anspruch da. Eine falsche Angabe zur
                  Vertretungsberechtigung ist ein Rechtsfehler, keine
                  Ungenauigkeit — deshalb der Zusatz statt einer
                  stillen Behauptung.
                */}
                {!m.roleConfirmed && (
                  <span className="text-ink-3"> · Bezeichnung noch nicht rechtlich bestätigt</span>
                )}
              </p>
              <p className="text-sm text-ink-2">{m.focus}</p>
              <p className="mt-1 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                {m.bio}
              </p>
              {isPublishableEmail(m.email) && kontakte.length > 0 ? (
                <a
                  href={`mailto:${m.email}`}
                  className="mt-1 text-sm text-accent-text underline underline-offset-[3px]"
                >
                  {m.email}
                </a>
              ) : (
                <p className="mt-1 text-sm text-ink-3">Erreichbar über das Formular oben.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Direkte Wege ─────────────────────────────────────── */}
      <section className="grid gap-4 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Direkte Wege</h2>

        {warnung && (
          /*
           * Sichtbar statt still (§25).
           *
           * Solange Domain und Mailzustellung nicht bestätigt sind,
           * werden keine Adressen als Kontaktweg angeboten. Eine
           * Adresse, an die nichts zugestellt wird, ist schlimmer als
           * gar keine: sie sieht aus wie ein Weg und ist keiner.
           */
          <p className="rounded-(--radius-md) bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink-2">
            Die E-Mail-Zustellung ist noch nicht bestätigt. Bis dahin geht jede Nachricht über das
            Formular oben — dort kommt sie sicher an.
          </p>
        )}

        <dl className="grid gap-3">
          {contactChannels.map((c) => (
            <div key={c.label} className="grid gap-0.5">
              <dt className="text-sm font-medium">{c.label}</dt>
              <dd className="text-sm leading-relaxed text-ink-2">
                {kontakte.some((k) => k.label === c.label) ? (
                  <a href={`mailto:${c.email}`} className="text-accent-text underline underline-offset-[3px]">
                    {c.email}
                  </a>
                ) : (
                  <span className="text-ink-3">{c.purpose} — über das Formular oben.</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
