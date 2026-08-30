import type { Metadata } from "next";
import { contactChannels, isPublishableEmail } from "@/lib/content/company";
import { PageHeader } from "@/components/ui/states";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Kontakt" };
export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-10 px-5 py-14 md:px-8">
      <PageHeader
        eyebrow="Kontakt"
        title="Schreib uns"
        lead="Wir lesen jede Nachricht. Antwortzeiten nennen wir erst, wenn wir sie auch halten können."
      />

      <ContactForm />

      <section className="grid gap-4 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Direkte Wege</h2>
        <dl className="grid gap-3">
          {contactChannels.map((c) => (
            <div key={c.label} className="grid gap-0.5">
              <dt className="text-sm font-medium">{c.label}</dt>
              <dd className="text-sm leading-relaxed text-ink-2">
                {isPublishableEmail(c.email) ? (
                  <a href={`mailto:${c.email}`} className="text-accent-text underline underline-offset-[3px]">
                    {c.email}
                  </a>
                ) : (
                  <span className="text-ink-3">
                    Adresse wird vor Veröffentlichung ergänzt — bis dahin über das Formular.
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
