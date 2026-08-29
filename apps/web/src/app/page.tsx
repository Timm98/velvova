import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileCheck2,
  Globe,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { currentUser } from "@/lib/auth";
import type { Translator } from "@paycheck/i18n";
import { getPageContext } from "@/lib/locale";
import { EvidenceSequence } from "@/components/marketing/EvidenceSequence";

export const metadata: Metadata = {
  title: "Finde Arbeit, die zu deinem Leben passt",
  description:
    "Nina versteht erst deine Erfahrungen, Stärken und Bedingungen — und sortiert dann echte Stellen. Jede Empfehlung mit Grund, Vorbehalt und Quelle.",
};

export const dynamic = "force-dynamic";

/**
 * Die Landingpage.
 *
 * Sie muss in wenigen Sekunden eine einzige Sache klarmachen: hier wird
 * nicht gesucht, hier wird zuerst verstanden. Alles, was diese Aussage
 * nicht trägt, ist gestrichen.
 *
 * Was hier bewusst NICHT steht: erfundene Nutzerzahlen, Presse-Logos,
 * Erfolgsquoten, Testimonials. Ein Produkt, das Nachvollziehbarkeit
 * verspricht, darf seine eigene Startseite nicht damit beginnen, welche
 * zu erfinden.
 */
export default async function LandingPage() {
  if (await currentUser()) redirect("/app");
  const { t, brand } = await getPageContext();

  return (
    <div className="min-h-dvh">
      <a href="#inhalt" className="skip-link">
        Zum Inhalt springen
      </a>

      <SiteHeader brandName={brand.name} t={t} />

      <main id="inhalt">
        {/* ══ Hero ═══════════════════════════════════════════════ */}
        <section className="mx-auto grid w-full max-w-[1320px] gap-14 px-5 pb-20 pt-14 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="max-w-[36rem]">
            <p className="inline-flex items-center gap-2 rounded-[--radius-full] border border-line-2 bg-raised px-3 py-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-ink-2 shadow-xs">
              <Sparkles className="size-3 text-brand" strokeWidth={2.2} />
              {t("landing.eyebrow")}
            </p>

            {/* Höchstens drei Zeilen auf dem Desktop. Eine Überschrift,
                die Wort für Wort umbricht, sieht aus wie ein Unfall. */}
            <h1 className="mt-6 font-display text-[2.75rem] font-medium leading-[1.04] tracking-[-0.025em] text-balance sm:text-[3.4rem] lg:text-[4rem]">
              {t("landing.headline")}
            </h1>

            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">
              {t("landing.subheadline")}
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-[--radius-md] bg-accent px-6 text-base font-medium text-accent-on shadow-sm transition-[background-color,box-shadow,transform] duration-[--duration-fast] hover:bg-accent-hover hover:shadow-md active:translate-y-px"
              >
                {t("landing.ctaPrimary")}
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex h-12 items-center gap-2 rounded-[--radius-md] border border-line-2 bg-raised px-6 text-base font-medium shadow-xs transition-colors hover:border-line-3 hover:bg-sunken"
              >
                {t("landing.ctaSecondary")}
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
              {[
                t("landing.trustProfile"),
                t("landing.trustReasons"),
                t("landing.trustNoInvention"),
              ].map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm text-ink-2">
                  <Check className="size-3.5 shrink-0 text-positive" strokeWidth={2.4} />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <EvidenceSequence
            labels={{
              assistantName: brand.assistantName,
              example: t("common.example"),
              saidLabel: t("landing.exampleSaid"),
              saidText: t("landing.exampleSaidText"),
              askedLabel: t("landing.exampleAsked"),
              askedText: t("landing.exampleAskedText"),
              evidenceLabel: t("landing.exampleEvidence"),
              evidenceText: t("landing.exampleEvidenceText"),
              rolesLabel: t("landing.exampleRoles"),
            }}
          />
        </section>

        {/* ══ Der Ablauf ═════════════════════════════════════════ */}
        <section className="border-y border-line bg-raised">
          <div className="mx-auto w-full max-w-[1320px] px-5 py-20 md:px-8 lg:py-24">
            <div className="max-w-[42rem]">
              <SectionEyebrow>{t("landing.flowEyebrow")}</SectionEyebrow>
              <h2 className="mt-4 font-display text-[2rem] font-medium leading-[1.12] tracking-[-0.02em] lg:text-[2.5rem]">
                {t("landing.flowTitle")}
              </h2>
            </div>

            <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
              {[
                {
                  icon: MessagesSquare,
                  title: t("landing.step1Title"),
                  body: t("landing.step1Body"),
                },
                {
                  icon: ScanSearch,
                  title: t("landing.step2Title"),
                  body: t("landing.step2Body"),
                },
                {
                  icon: FileCheck2,
                  title: t("landing.step3Title"),
                  body: t("landing.step3Body"),
                },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title}>
                    <span aria-hidden className="font-mono text-2xs font-medium tracking-widest text-accent-text">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden
                      className="mt-4 grid size-10 place-items-center rounded-[--radius-md] bg-sunken text-ink-2"
                    >
                      <Icon className="size-[18px]" strokeWidth={1.7} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold leading-snug">{step.title}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ══ Was getrennt bleibt ════════════════════════════════ */}
        <section className="mx-auto w-full max-w-[1320px] px-5 py-20 md:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
            <div>
              <SectionEyebrow>{t("landing.methodEyebrow")}</SectionEyebrow>
              <h2 className="mt-4 font-display text-[2rem] font-medium leading-[1.12] tracking-[-0.02em] lg:text-[2.4rem]">
                {t("landing.methodTitle")}
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
                {t("landing.methodBody")}
              </p>
              <Link
                href="/methodology"
                className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-accent-text underline underline-offset-[3px]"
              >
                {t("landing.methodLink")}
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </Link>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: t("landing.knowledgeSaidTitle"),
                  body: t("landing.knowledgeSaidBody"),
                  dot: "bg-ink-3",
                },
                {
                  title: t("landing.knowledgeEvidenceTitle"),
                  body: t("landing.knowledgeEvidenceBody"),
                  dot: "bg-positive",
                },
                {
                  title: t("landing.knowledgeGuessTitle"),
                  body: t("landing.knowledgeGuessBody"),
                  dot: "bg-assistant",
                },
                {
                  title: t("landing.knowledgeExternalTitle"),
                  body: t("landing.knowledgeExternalBody"),
                  dot: "bg-caution",
                },
              ].map((item) => (
                <li key={item.title} className="rounded-[--radius-lg] border border-line bg-raised p-5 shadow-xs">
                  <span aria-hidden className={"block size-1.5 rounded-full " + item.dot} />
                  <h3 className="mt-3.5 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ══ Zwei Versprechen ═══════════════════════════════════ */}
        <section className="border-y border-line bg-raised">
          <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-5 py-20 md:grid-cols-2 md:px-8 lg:gap-16 lg:py-24">
            {[
              {
                icon: TrendingUp,
                title: t("landing.futureTitle"),
                body: t("landing.futureBody"),
                href: "/methodology",
                cta: t("landing.futureLink"),
              },
              {
                icon: ShieldCheck,
                title: t("landing.privacyTitle"),
                body: t("landing.privacyBody"),
                href: "/security",
                cta: t("landing.privacyLink"),
              },
            ].map((promise) => {
              const Icon = promise.icon;
              return (
                <div key={promise.title}>
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-[--radius-md] bg-sunken text-ink-2"
                  >
                    <Icon className="size-[18px]" strokeWidth={1.7} />
                  </span>
                  <h2 className="mt-4 text-xl font-semibold">{promise.title}</h2>
                  <p className="mt-3 max-w-[38rem] leading-relaxed text-ink-2">{promise.body}</p>
                  <Link
                    href={promise.href}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent-text underline underline-offset-[3px]"
                  >
                    {promise.cta}
                    <ArrowRight className="size-3.5" strokeWidth={2} />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══ Abschluss ══════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-[1320px] px-5 py-24 md:px-8 lg:py-32">
          <div className="mx-auto max-w-[40rem] text-center">
            <h2 className="font-display text-[2.25rem] font-medium leading-[1.1] tracking-[-0.02em] text-balance lg:text-[3rem]">
              {t("landing.closingTitle")}
            </h2>
            <p className="mx-auto mt-5 max-w-[32rem] text-lg leading-relaxed text-ink-2">
              {t("landing.closingBody")}
            </p>
            <Link
              href="/register"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-[--radius-md] bg-accent px-7 text-base font-medium text-accent-on shadow-sm transition-[background-color,box-shadow,transform] duration-[--duration-fast] hover:bg-accent-hover hover:shadow-md active:translate-y-px"
            >
              {t("landing.closingCta")}
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter brandName={brand.name} t={t} />
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-medium uppercase tracking-[0.14em] text-accent-text">{children}</p>;
}

/**
 * Die öffentliche Kopfzeile.
 *
 * Kein Sprachschalter, kein Darstellungsschalter. Was hier steht, muss
 * zur Entscheidung beitragen, ob jemand anfängt — sonst nimmt es nur
 * Platz und Aufmerksamkeit.
 */
function SiteHeader({ brandName, t }: { brandName: string; t: Translator["t"] }) {
  const links = [
    { href: "/product", label: t("landing.navProduct") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/methodology", label: t("nav.methodology") },
    { href: "/security", label: t("nav.security") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-6 px-5 py-3.5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-[--radius-sm] bg-brand text-xs font-bold text-white"
          >
            P
          </span>
          {brandName}
        </Link>

        <nav aria-label="Produktseiten" className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[--radius-md] px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/login"
            className="rounded-[--radius-md] px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
          >
            {t("auth.login")}
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-1.5 rounded-[--radius-md] bg-accent px-4 text-sm font-medium text-accent-on shadow-sm transition-colors hover:bg-accent-hover"
          >
            {t("landing.ctaPrimary")}
          </Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter({ brandName, t }: { brandName: string; t: Translator["t"] }) {
  const columns = [
    {
      title: t("landing.footerProduct"),
      links: [
        { href: "/product", label: t("landing.footerOverview") },
        { href: "/how-it-works", label: t("nav.howItWorks") },
        { href: "/pricing", label: t("landing.navPricing") },
      ],
    },
    {
      title: t("landing.footerTrust"),
      links: [
        { href: "/methodology", label: t("nav.methodology") },
        { href: "/security", label: t("nav.security") },
        { href: "/privacy", label: t("nav.privacy") },
      ],
    },
    {
      title: t("landing.footerCompany"),
      links: [
        { href: "/imprint", label: t("nav.imprint") },
        { href: "/register", label: t("auth.register") },
        { href: "/login", label: t("auth.login") },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-sunken">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <p className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-[--radius-sm] bg-brand text-xs font-bold text-white"
              >
                P
              </span>
              {brandName}
            </p>
            <p className="mt-3.5 max-w-[24rem] text-sm leading-relaxed text-ink-3">
              {t("landing.footerNote")}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">
                {column.title}
              </h2>
              <ul className="mt-4 grid gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-ink-2 transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="max-w-[42rem] text-xs leading-relaxed text-ink-3">
            {t("landing.footerLanguage")}
          </p>
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <Globe className="size-3.5" strokeWidth={1.8} />
            Deutsch (Deutschland)
          </p>
        </div>
      </div>
    </footer>
  );
}
