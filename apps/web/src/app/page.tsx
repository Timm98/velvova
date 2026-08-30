import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { brand } from "@paycheck/config";
import { getPageContext } from "@/lib/locale";
import { CareerSignal } from "@/components/marketing/CareerSignal";

export const metadata: Metadata = {
  title: "Nicht mehr suchen. Den richtigen nächsten Schritt sehen.",
  description:
    "Nina versteht deine Erfahrungen, findet frische Jobs aus geprüften Quellen und begleitet " +
    "dich von der Orientierung bis zur Bewerbung.",
};

/**
 * Die Landingpage.
 *
 * Sie ist öffentlich und braucht keine Anmeldung — sie liest weder
 * Sitzung noch Datenbank. Das ist keine Sparsamkeit, sondern eine
 * Eigenschaft: eine öffentliche Seite, die eine Sitzung anfasst, kann
 * an einer Sitzung scheitern.
 *
 * Gestaltung: Future Editorial. Wenige Aussagen, grosse Flächen, lange
 * Zeilen. Farbe erscheint als Linie und als Licht, nie als gefüllter
 * Block. Der Karriereweg ist eine durchgehende Linie und ausdrücklich
 * keine Reihe von Kästen — Boxen zeigen eine Aufzählung, hier geht es
 * um eine Bewegung.
 *
 * Was hier nicht steht: erfundene Nutzerzahlen, Presse-Logos,
 * Erfolgsquoten, Testimonials, Kundenlogos. Auf einer Seite, die
 * Belegbarkeit verspricht, wäre eine erfundene Zahl der schlechteste
 * mögliche erste Eindruck.
 */
export default async function LandingPage() {
  const { t } = await getPageContext();

  return (
    <div
      data-surface="editorial"
      className="min-h-dvh"
      style={{ background: "var(--ed-canvas)", color: "var(--ed-ink)" }}
    >
      <a href="#inhalt" className="skip-link">
        Zum Inhalt springen
      </a>

      {/* ══ Kopfzeile ═══════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{
          background: "color-mix(in oklab, var(--ed-canvas) 82%, transparent)",
          borderBottom: "1px solid var(--ed-hairline)",
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-6 px-5 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="block size-[18px] rounded-full"
              style={{
                background:
                  "conic-gradient(from 180deg, var(--ed-violet), var(--ed-ice), var(--ed-mint), var(--ed-violet))",
              }}
            />
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">
              {brand.name}
            </span>
          </Link>

          <nav aria-label="Hauptnavigation" className="ml-auto hidden items-center gap-7 md:flex">
            {([
              [t("landing.navProduct"), "/product"],
              [t("landing.navHow"), "/how-it-works"],
              [t("landing.navSecurity"), "/security"],
            ] as const).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="text-sm transition-colors"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 md:ml-0">
            <Link href="/login" className="text-sm" style={{ color: "var(--ed-ink-2)" }}>
              {t("landing.navSignIn")}
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-transform hover:-translate-y-px"
              style={{
                background: "var(--ed-ink)",
                color: "var(--ed-canvas)",
              }}
            >
              {t("landing.ctaPrimary", { assistant: brand.assistantName })}
            </Link>
          </div>
        </div>
      </header>

      <main id="inhalt">
        {/* ══ Hero ══════════════════════════════════════════════ */}
        <section className="relative overflow-hidden">
          {/* Licht statt Fläche. Es liegt hinter allem, bewegt sich
              kaum und holt den Blick nicht. */}
          <div
            aria-hidden
            className="ed-glow pointer-events-none absolute inset-x-0 -top-32 h-[560px] motion-safe:animate-[ed-drift_14s_ease-in-out_infinite]"
          />

          <div className="relative mx-auto w-full max-w-[1180px] px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
            <p
              className="font-mono text-2xs uppercase tracking-[0.18em]"
              style={{ color: "var(--ed-violet-text)" }}
            >
              {t("landing.eyebrow")}
            </p>

            <h1
              className="mt-5 max-w-[15ch] font-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] md:text-[4.25rem]"
              style={{ color: "var(--ed-ink)" }}
            >
              {t("landing.headlineLine1")}
              <br />
              {t("landing.headlineLine2")}
            </h1>

            <p
              className="mt-7 max-w-[54ch] text-lg leading-relaxed md:text-xl"
              style={{ color: "var(--ed-ink-2)" }}
            >
              {t("landing.subheadline", { assistant: brand.assistantName })}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium transition-transform hover:-translate-y-px"
                style={{
                  background: "var(--ed-ink)",
                  color: "var(--ed-canvas)",
                  boxShadow: "var(--ed-shadow-lift)",
                }}
              >
                {t("landing.ctaPrimary", { assistant: brand.assistantName })}
                <ArrowRight className="size-4" strokeWidth={1.9} />
              </Link>

              <Link
                href="/how-it-works"
                className="inline-flex h-12 items-center gap-1.5 text-[15px] underline underline-offset-[5px]"
                style={{ color: "var(--ed-ink-2)", textDecorationColor: "var(--ed-hairline-strong)" }}
              >
                {t("landing.ctaSecondary")}
              </Link>
            </div>
          </div>
        </section>

        {/* ══ Die Kernbotschaft ═════════════════════════════════ */}
        <section
          className="relative"
          style={{ borderTop: "1px solid var(--ed-hairline)" }}
        >
          <div className="mx-auto w-full max-w-[1180px] px-5 py-20 md:px-8 md:py-28">
            <p
              className="max-w-[20ch] font-display text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[3.25rem]"
              style={{ color: "var(--ed-ink)" }}
            >
              {t("landing.coreLine1")}
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(96deg, var(--ed-violet) 0%, var(--ed-ice) 58%, var(--ed-mint) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {t("landing.coreLine2")}
              </span>
            </p>

            <p
              className="mt-8 max-w-[42ch] text-lg leading-relaxed md:text-xl"
              style={{ color: "var(--ed-ink-2)" }}
            >
              {t("landing.coreSub")}
            </p>
          </div>
        </section>

        {/* ══ Der Weg ═══════════════════════════════════════════ */}
        <section
          aria-labelledby="weg"
          style={{ borderTop: "1px solid var(--ed-hairline)" }}
        >
          <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-20 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] md:gap-20 md:px-8 md:py-28">
            <div className="md:sticky md:top-28 md:self-start">
              <p
                className="font-mono text-2xs uppercase tracking-[0.18em]"
                style={{ color: "var(--ed-ink-3)" }}
              >
                {t("landing.pathEyebrow")}
              </p>
              <h2
                id="weg"
                className="mt-4 max-w-[14ch] font-display text-[1.75rem] font-semibold leading-[1.14] tracking-[-0.03em] md:text-[2.5rem]"
                style={{ color: "var(--ed-ink)" }}
              >
                {t("landing.pathTitle")}
              </h2>
              <p
                className="mt-5 max-w-[38ch] leading-relaxed"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {t("landing.pathBody")}
              </p>
            </div>

            <CareerSignal
              stationen={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
                label: t(`landing.step${n}`, { assistant: brand.assistantName }),
                detail: t(`landing.step${n}Detail`),
              }))}
            />
          </div>
        </section>

        {/* ══ Drei Unterschiede ═════════════════════════════════ */}
        <section
          aria-labelledby="unterschiede"
          style={{ borderTop: "1px solid var(--ed-hairline)" }}
        >
          <div className="mx-auto w-full max-w-[1180px] px-5 py-20 md:px-8 md:py-28">
            <h2 id="unterschiede" className="sr-only">
              Was {brand.name} anders macht
            </h2>

            {/* Getrennt durch Linien und Typografie, nicht durch Kästen.
                Drei Karten nebeneinander wären genau die Wand aus
                Rechtecken, die hier nicht hingehört. */}
            <div className="grid gap-y-14 md:grid-cols-3 md:gap-x-14">
              {[
                {
                  label: t("landing.diffUnderstand"),
                  text: t("landing.diffUnderstandBody", { assistant: brand.assistantName }),
                  farbe: "var(--ed-violet)",
                },
                {
                  label: t("landing.diffCheck"),
                  text: t("landing.diffCheckBody"),
                  farbe: "var(--ed-ice)",
                },
                {
                  label: t("landing.diffAct"),
                  text: t("landing.diffActBody", { assistant: brand.assistantName }),
                  farbe: "var(--ed-mint)",
                },
              ].map(({ label, text, farbe }) => (
                <div key={label} className="grid gap-4">
                  <span
                    aria-hidden
                    className="block h-px w-full"
                    style={{ background: farbe }}
                  />
                  <p
                    className="font-mono text-2xs uppercase tracking-[0.18em]"
                    style={{ color: "var(--ed-ink-3)" }}
                  >
                    {label}
                  </p>
                  <p
                    className="max-w-[34ch] font-display text-xl font-medium leading-snug tracking-[-0.02em] md:text-[1.5rem]"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ Abschluss ═════════════════════════════════════════ */}
        <section style={{ borderTop: "1px solid var(--ed-hairline)" }}>
          <div className="relative mx-auto w-full max-w-[1180px] overflow-hidden px-5 py-24 md:px-8 md:py-32">
            <div
              aria-hidden
              className="ed-glow pointer-events-none absolute inset-x-0 bottom-0 h-[420px] motion-safe:animate-[ed-drift_16s_ease-in-out_infinite]"
            />
            <div className="relative">
              <p
                className="max-w-[18ch] font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[3rem]"
                style={{ color: "var(--ed-ink)" }}
              >
                {t("landing.closingTitle")}
              </p>
              <p
                className="mt-6 max-w-[46ch] text-lg leading-relaxed"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {t("landing.closingBody")}
              </p>
              <div className="mt-10">
                <Link
                  href="/register"
                  className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium transition-transform hover:-translate-y-px"
                  style={{
                    background: "var(--ed-ink)",
                    color: "var(--ed-canvas)",
                    boxShadow: "var(--ed-shadow-lift)",
                  }}
                >
                  {t("landing.ctaPrimary", { assistant: brand.assistantName })}
                  <ArrowRight className="size-4" strokeWidth={1.9} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid var(--ed-hairline)" }}>
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-7 gap-y-3 px-5 py-10 text-sm md:px-8">
          <span style={{ color: "var(--ed-ink-3)" }}>
            {brand.name} — {brand.tagline.de}
          </span>
          <nav aria-label="Rechtliches" className="ml-auto flex flex-wrap gap-x-6 gap-y-2">
            {([
              [t("landing.footerPrivacy"), "/privacy"],
              [t("landing.footerSecurity"), "/security"],
              [t("landing.footerMethodology"), "/methodology"],
              [t("landing.footerImprint"), "/imprint"],
              [t("landing.footerTerms"), "/terms"],
            ] as const).map(([label, href]) => (
              <Link key={href} href={href} style={{ color: "var(--ed-ink-2)" }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
