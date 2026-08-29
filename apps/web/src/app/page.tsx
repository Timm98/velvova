import Link from "next/link";
import {
  ArrowRight,
  Check,
  MessageSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { Badge, Button, Card, Separator } from "@/components/ui";
import { ConfidenceMeter, ScoreRing } from "@/components/ui/score";

export const dynamic = "force-dynamic";

/**
 * Landing Page.
 *
 * Sie hat genau eine Aufgabe: in fünf Sekunden klarmachen, dass hier VOR
 * der Jobbörse angesetzt wird — und dass danach jemand mitgeht.
 *
 * Was bewusst fehlt: erfundene Kundenlogos, Testimonials, Erfolgsquoten,
 * Nutzerzahlen, Presselogos. Nichts davon ist belegbar, und eine
 * Karriereplattform, die beim ersten Kontakt schwindelt, hat ihren
 * wichtigsten Wert schon verspielt.
 *
 * Das gezeigte Match ist als Beispiel beschriftet.
 */
export default async function LandingPage() {
  const { t, brand } = await getPageContext();
  const user = await currentUser();

  return (
    <div className="min-h-dvh">
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      {/* ═══ Kopfzeile ═══ */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-page/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-3.5 md:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-[--radius-sm] bg-accent text-xs font-bold text-accent-on"
            >
              P
            </span>
            {brand.name}
          </Link>

          <nav aria-label="Hauptnavigation" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/how-it-works"
              className="hidden rounded-[--radius-sm] px-3 py-2 text-sm text-ink-2 transition-colors hover:text-ink sm:block"
            >
              {t("landing.ctaSecondary")}
            </Link>
            <Link
              href="/methodology"
              className="hidden rounded-[--radius-sm] px-3 py-2 text-sm text-ink-2 transition-colors hover:text-ink md:block"
            >
              Methodik
            </Link>
            <Button asChild variant={user ? "primary" : "secondary"} size="sm">
              <Link href={user ? "/app" : "/login"}>{user ? t("nav.home") : t("auth.login")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="inhalt">
        {/* ═══ Hero ═══ */}
        <section className="surface-gradient border-b border-line">
          <div className="mx-auto max-w-[1120px] px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
            <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div className="animate-fade-up">
                <Badge tone="assistant" className="mb-6">
                  <Sparkles className="size-3" strokeWidth={2} />
                  Karriereanalyse vor der Jobsuche
                </Badge>

                <h1 className="max-w-[15ch] text-[2.6rem] font-semibold sm:text-5xl lg:text-6xl">
                  {t("landing.headline")}
                </h1>

                <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-2">
                  {t("landing.subheadline")}
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Button asChild variant="primary" size="lg">
                    <Link href="/register?mode=voice">
                      <Mic className="size-4" strokeWidth={1.9} />
                      {t("landing.ctaVoice")}
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/register?mode=text">
                      <MessageSquare className="size-4" strokeWidth={1.9} />
                      {t("landing.ctaText")}
                    </Link>
                  </Button>
                </div>

                <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-3">
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-positive" strokeWidth={2.4} />
                    Etwa fünfzehn Minuten
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-positive" strokeWidth={2.4} />
                    Jederzeit pausierbar
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-positive" strokeWidth={2.4} />
                    Deine Daten bleiben deine
                  </span>
                </p>
              </div>

              {/* Beispielkarte — ausdrücklich als Beispiel beschriftet */}
              <div
                className="animate-fade-up lg:justify-self-end"
                style={{ animationDelay: "120ms" }}
              >
                <Card className="w-full max-w-[420px] shadow-xl">
                  <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">Customer Success Manager</p>
                      <p className="mt-0.5 truncate text-sm text-ink-3">
                        Hamburg · hybrid · 44.000–52.000 €
                      </p>
                    </div>
                    <Badge tone="caution">Beispiel</Badge>
                  </div>

                  <div className="grid gap-5 px-6 py-5">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                      <ScoreRing value={81} label="Passung" band="hohe Passung" />
                      <ConfidenceMeter level="medium" label="Sicherheit" />
                    </div>

                    <Separator soft />

                    <div className="grid gap-2.5 text-sm leading-relaxed">
                      <p className="flex gap-2">
                        <span
                          aria-hidden
                          className="mt-[7px] size-1.5 shrink-0 rounded-full bg-positive"
                        />
                        <span>
                          <span className="font-medium text-positive">Warum sie passt: </span>
                          <span className="text-ink-2">
                            Zwei von zwei Muss-Anforderungen sind durch bestätigte Erfahrungen
                            gedeckt.
                          </span>
                        </span>
                      </p>
                      <p className="flex gap-2">
                        <span
                          aria-hidden
                          className="mt-[7px] size-1.5 shrink-0 rounded-full bg-caution"
                        />
                        <span>
                          <span className="font-medium text-caution">
                            Was du bedenken solltest:{" "}
                          </span>
                          <span className="text-ink-2">
                            Zur Arbeitsbelastung liegen keine belastbaren Angaben vor.
                          </span>
                        </span>
                      </p>
                    </div>

                    <p className="rounded-[--radius-md] bg-sunken px-3.5 py-3 text-xs leading-relaxed text-ink-3">
                      Die Sicherheit ist mittel, weil die Anzeige nichts zur Arbeitszeit sagt. Das
                      senkt die Sicherheit — nicht die Passung.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Drei Schritte ═══ */}
        <section aria-labelledby="schritte" className="border-b border-line bg-raised">
          <div className="mx-auto max-w-[1120px] px-5 py-20 md:px-8 md:py-24">
            <h2 id="schritte" className="text-2xl font-semibold sm:text-3xl">
              {t("landing.stepsTitle")}
            </h2>

            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {[
                { n: "01", title: t("landing.step1Title"), body: t("landing.step1Body") },
                { n: "02", title: t("landing.step2Title"), body: t("landing.step2Body") },
                { n: "03", title: t("landing.step3Title"), body: t("landing.step3Body") },
              ].map((s) => (
                <li key={s.n} className="grid gap-3">
                  <span className="text-2xs font-semibold tracking-[0.16em] text-accent-text">
                    {s.n}
                  </span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═══ Aus Erfahrung wird Beleg ═══ */}
        <section aria-labelledby="evidenz" className="border-b border-line">
          <div className="mx-auto max-w-[1120px] px-5 py-20 md:px-8 md:py-24">
            <div className="max-w-[58ch]">
              <h2 id="evidenz" className="text-2xl font-semibold sm:text-3xl">
                {t("landing.evidenceTitle")}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-2">
                {t("landing.evidenceBody")}
              </p>
            </div>

            <div className="mt-10 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <Card className="p-6">
                <Badge tone="outline">im Lebenslauf</Badge>
                <p className="mt-4 text-lg text-ink-3">„Kundenservice, 2 Jahre"</p>
              </Card>

              <div className="hidden items-center justify-center md:flex">
                <ArrowRight className="size-5 text-ink-3" strokeWidth={1.6} />
              </div>

              <Card className="border-assistant-border bg-assistant-soft p-6">
                <Badge tone="assistant">
                  <Sparkles className="size-3" strokeWidth={2} />
                  was gefragt wird
                </Badge>
                <p className="mt-4 text-sm leading-relaxed">
                  „Erzähl von einer Eskalation, die du übernommen hast. Was hast du getan?"
                </p>
              </Card>

              <div className="hidden items-center justify-center md:flex">
                <ArrowRight className="size-5 text-ink-3" strokeWidth={1.6} />
              </div>

              <Card className="p-6">
                <Badge tone="positive">
                  <Check className="size-3" strokeWidth={2.4} />
                  belegte Stärke
                </Badge>
                <p className="mt-4 text-sm leading-relaxed">
                  Vermittelt zwischen Kunde und Technik unter Druck — belegt durch eine konkrete
                  Situation mit benanntem Ergebnis.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-ink-3">
                  Daraus entsteht eine Rollenidee, die im Lebenslauf nicht stand.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ═══ Quellen getrennt ═══ */}
        <section aria-labelledby="realitaet" className="border-b border-line bg-raised">
          <div className="mx-auto max-w-[1120px] px-5 py-20 md:px-8 md:py-24">
            <div className="max-w-[58ch]">
              <h2 id="realitaet" className="text-2xl font-semibold sm:text-3xl">
                {t("landing.realityTitle")}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-2">
                {t("landing.realityBody")}
              </p>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  kind: "Mitarbeiterstimmen",
                  note: "Sagen etwas über die Arbeit. Stichprobe und Zeitraum stehen dabei.",
                },
                {
                  kind: "Kundenbewertungen",
                  note: "Sagen etwas über Produkt oder Standort. Nicht über die Kultur.",
                },
                {
                  kind: "Arbeitgeberangaben",
                  note: "Die Selbstdarstellung. Wichtig, aber eine Partei.",
                },
                {
                  kind: "Register und Behörden",
                  note: "Harte Fakten wie Rechtsform und Sitz.",
                },
              ].map((s) => (
                <Card key={s.kind} className="p-5">
                  <h3 className="text-sm font-semibold">{s.kind}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.note}</p>
                </Card>
              ))}
            </ul>
          </div>
        </section>

        {/* ═══ Zwei Versprechen ═══ */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-[1120px] gap-6 px-5 py-20 md:grid-cols-2 md:px-8 md:py-24">
            <Card className="p-7">
              <div className="grid size-10 place-items-center rounded-[--radius-md] bg-accent-soft text-accent-text">
                <TrendingUp className="size-5" strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-lg font-semibold">Wie sich die Rolle entwickelt</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                Bewertet werden die Aufgaben der konkreten Stelle, nicht der Berufstitel. Ausgegeben
                werden Szenarien — nie eine Jahreszahl, wann etwas „verschwindet".
              </p>
            </Card>

            <Card className="p-7">
              <div className="grid size-10 place-items-center rounded-[--radius-md] bg-assistant-soft text-assistant-text">
                <ShieldCheck className="size-5" strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{t("landing.privacyTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{t("landing.privacyBody")}</p>
              <p className="mt-4">
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
                >
                  Zum Privacy Center
                  <ArrowRight className="size-3.5" strokeWidth={1.9} />
                </Link>
              </p>
            </Card>
          </div>
        </section>

        {/* ═══ Abschluss ═══ */}
        <section className="surface-gradient">
          <div className="mx-auto max-w-[1120px] px-5 py-24 md:px-8 md:py-32">
            <div className="max-w-[44ch]">
              <h2 className="text-3xl font-semibold sm:text-4xl">{t("landing.closingTitle")}</h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-2">{t("landing.closingBody")}</p>
              <div className="mt-9">
                <Button asChild variant="primary" size="lg">
                  <Link href="/register?mode=text">
                    {t("consent.start")}
                    <ArrowRight className="size-4" strokeWidth={1.9} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-sunken">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-5 px-5 py-8 text-sm text-ink-3 md:px-8">
          <span>
            {brand.name} · {brand.assistantName}
            <span className="text-ink-3/70"> — beide Namen sind vorläufig</span>
          </span>
          <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/how-it-works" className="transition-colors hover:text-ink-2">
              So funktioniert es
            </Link>
            <Link href="/methodology" className="transition-colors hover:text-ink-2">
              Methodik
            </Link>
            <Link href="/security" className="transition-colors hover:text-ink-2">
              Sicherheit
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink-2">
              Datenschutz
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
