import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { brand } from "@paycheck/config";
import { getPageContext } from "@/lib/locale";
import { NinaVisual } from "@/components/nina/NinaVisual";
import { CareerSignal } from "@/components/marketing/CareerSignal";
import {
  ApplyVisual,
  HeroVisual,
  ProfileVisual,
  RoleFanVisual,
} from "@/components/marketing/ProductVisual";

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
      /* Die Landingpage ist immer hell — auch für angemeldete Menschen
         mit dunklem Thema. Sie ist die erste Seite, die jemand sieht. */
      data-theme="light"
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
          // Ein sehr weicher Schatten statt einer Linie. Eine
          // 1-Pixel-Kante quer über den Bildschirm ist das härteste
          // Element auf einer Seite, die weich wirken soll.
          boxShadow: "0 1px 24px rgba(9, 11, 18, 0.05)",
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

          {/*
            Die Navigation erscheint erst ab `lg`, nicht ab `md`.

            Bei genau 768 Pixeln — der `md`-Grenze und der Breite jedes
            Tablets im Hochformat — standen fünf Punkte, „Anmelden" und
            der Startknopf nebeneinander und brauchten 809 Pixel. Die
            Seite lief 41 Pixel über, und zwar auf einem sehr
            gewöhnlichen Gerät.

            Ab `lg` ist Platz für alles. Darunter tragen Wortmarke und
            Startknopf die Kopfzeile; die Punkte stehen ohnehin im Fuss.
          */}
          <nav aria-label="Hauptnavigation" className="ml-auto hidden items-center gap-7 lg:flex">
            {([
              /* Die fünf aus §22.1. Kurze Wörter, weil die Kopfzeile
                 eine Orientierung ist und kein Inhaltsverzeichnis —
                 „So funktioniert Nina" stand hier vorher und war das
                 längste Element in einer Reihe aus Einwortpunkten. */
              [t("landing.navProduct"), "/product"],
              [brand.assistantName, "/how-it-works"],
              ["Jobs", "/product#jobs"],
              [t("landing.navSecurity"), "/security"],
              ["Über uns", "/about"],
            ] as const).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                /* 44 Pixel Höhe, auch für ein kurzes Wort wie „Jobs". Ein
                   Berührungsziel misst sich an der Fläche, nicht am Text. */
                className="inline-flex min-h-11 items-center rounded-full px-2 text-sm transition-colors"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 lg:ml-0">
            <Link href="/login" className="text-sm" style={{ color: "var(--ed-ink-2)" }}>
              {t("landing.navSignIn")}
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-transform hover:-translate-y-px"
              style={{ background: "var(--ed-violet)", color: "#ffffff" }}
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

          <div className="relative mx-auto grid w-full max-w-[1240px] items-center gap-14 px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
            {/* Kein Monospace mehr im Vorspann. Eine technische
                Schrift über einem Satz wie „Deine persönliche
                Karrierebegleitung" nimmt ihm genau das Menschliche,
                das er behauptet. */}
            <p
              className="text-sm font-medium tracking-[0.01em]"
              style={{ color: "var(--ed-violet-text)" }}
            >
              {t("landing.eyebrow")}
            </p>

            <h1
              className="mt-5 max-w-[14ch] font-display text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.035em] md:text-[3.5rem]"
              style={{ color: "var(--ed-ink)" }}
            >
              {t("landing.headlineLine1")}
              <br />
              {t("landing.headlineLine2")}
            </h1>

            <p
              className="mt-7 max-w-[46ch] text-lg leading-relaxed"
              style={{ color: "var(--ed-ink-2)" }}
            >
              {t("landing.subheadline", { assistant: brand.assistantName })}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium transition-transform hover:-translate-y-px"
                /* Der Markenton statt Schwarz. Ein schwarzer Knopf über
                   einem Satz wie „Deine persönliche Karrierebegleitung"
                   ist der härteste Kontrast auf der Seite — und damit
                   das Gegenteil dessen, was der Satz verspricht. */
                style={{
                  background: "var(--ed-violet)",
                  color: "#ffffff",
                  boxShadow: "0 6px 24px rgba(99, 91, 255, 0.28)",
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
                {t("landing.ctaSecondary", { assistant: brand.assistantName })}
              </Link>
            </div>

            {/* Eine Vertrauenszeile, keine Behauptung über Ergebnisse. */}
            <p className="mt-8 max-w-[42ch] text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
              Deine Angaben bleiben kontrollierbar. Jede Empfehlung wird begründet.
            </p>
            </div>

            {/* Rechts die Produktansicht: die echte Nina über den
                überlappenden Produktmomenten (§22.2). */}
            <div className="grid gap-6 lg:pl-4">
              {/*
                Nina selbst, nicht ein Symbol für sie.

                Sie steht hier erst, seit sie überhaupt sichtbar ist:
                die Leinwand lag zuvor unter ihrem eigenen Lichtverlauf,
                weil ein absolut positioniertes Element über
                nicht positioniertem Inhalt malt. Auf einer Startseite
                wäre ein leerer violetter Kreis besonders bitter
                gewesen.

                Das Modell kommt lazy und mit `ssr: false`; bis dahin
                steht das Signal in derselben Grösse, also springt
                nichts. Wer kein WebGL hat, behält das Signal.
              */}
              <div className="flex justify-center lg:justify-start">
                <NinaVisual size="lg" state="idle" strategie="beiInteresse" />
              </div>
              <HeroVisual assistantName={brand.assistantName} />
            </div>
          </div>
        </section>

        {/* ══ Die Kernbotschaft ═════════════════════════════════ */}
        <section
          className="relative"
          >
          <div className="mx-auto grid w-full max-w-[1180px] items-center gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
            <p
              className="max-w-[20ch] font-display text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[2.75rem]"
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
                {t("landing.coreLine2", { assistant: brand.assistantName })}
              </span>
            </p>

            <p
              className="mt-8 max-w-[42ch] text-lg leading-relaxed md:text-xl"
              style={{ color: "var(--ed-ink-2)" }}
            >
              {t("landing.coreSub")}
            </p>
            <p
              className="mt-5 max-w-[46ch] leading-relaxed"
              style={{ color: "var(--ed-ink-3)" }}
            >
              {t("landing.learnsBody")}
            </p>
            </div>

            {/* Das Profil-Visual gehört hierher, nicht in eine eigene
                Sektion: es zeigt genau das, wovon der Absatz spricht. */}
            <div className="justify-self-center lg:justify-self-end">
              <ProfileVisual />
            </div>
          </div>
        </section>

        {/* ══ Der Weg ═══════════════════════════════════════════ */}
        <section
          aria-labelledby="weg"
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

        {/* ══ Unerwartete Möglichkeiten ═════════════════════════ */}
        <section aria-labelledby="unerwartet">
          <div className="mx-auto grid w-full max-w-[1180px] items-center gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--ed-violet-text)" }}>
                Unerwartete Möglichkeiten
              </p>
              <h2
                id="unerwartet"
                className="mt-4 max-w-[18ch] font-display text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[2.75rem]"
                style={{ color: "var(--ed-ink)" }}
              >
                Auch Jobs, nach denen du selbst nie gesucht hättest.
              </h2>
              <p
                className="mt-6 max-w-[46ch] text-lg leading-relaxed"
                style={{ color: "var(--ed-ink-2)" }}
              >
                Wer im Kundenservice Prozesse geordnet und neue Kolleginnen eingearbeitet hat,
                sucht meistens wieder Kundenservice. Dabei passen dieselben Fähigkeiten oft auf
                Rollen, deren Namen man gar nicht kennt.
              </p>
              <p
                className="mt-5 max-w-[46ch] leading-relaxed"
                style={{ color: "var(--ed-ink-3)" }}
              >
                Zu jedem ungewöhnlichen Vorschlag steht, worauf er beruht, was anders wäre, was
                fehlt — und wie du ihn klein ausprobieren kannst.
              </p>
            </div>
            <div className="justify-self-center lg:justify-self-end">
              <RoleFanVisual />
            </div>
          </div>
        </section>

        {/* ══ Richtungen und Stellen ════════════════════════════ */}
        <section aria-labelledby="richtungen">
          <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--ed-violet-text)" }}>
                {t("landing.rolesEyebrow")}
              </p>
              <h2
                id="richtungen"
                className="mt-4 max-w-[16ch] font-display text-[1.75rem] font-semibold leading-[1.14] tracking-[-0.03em] md:text-[2.25rem]"
                style={{ color: "var(--ed-ink)" }}
              >
                {t("landing.rolesTitle")}
              </h2>
              <p
                className="mt-5 max-w-[46ch] text-lg leading-relaxed"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {t("landing.rolesBody")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--ed-violet-text)" }}>
                {t("landing.jobsEyebrow")}
              </p>
              <h2
                className="mt-4 max-w-[18ch] font-display text-[1.75rem] font-semibold leading-[1.14] tracking-[-0.03em] md:text-[2.25rem]"
                style={{ color: "var(--ed-ink)" }}
              >
                {t("landing.jobsTitle")}
              </h2>
              <p
                className="mt-5 max-w-[46ch] text-lg leading-relaxed"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {t("landing.jobsBody")}
              </p>
            </div>
          </div>
        </section>

        {/* ══ Bewerbung vorbereiten ═════════════════════════════ */}
        <section aria-labelledby="bewerbung">
          <div className="mx-auto grid w-full max-w-[1180px] items-center gap-12 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28">
            <div className="order-2 justify-self-center md:order-1 md:justify-self-start">
              <ApplyVisual />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-sm font-medium" style={{ color: "var(--ed-violet-text)" }}>
                {t("landing.applyEyebrow")}
              </p>
              <h2
                id="bewerbung"
                className="mt-4 max-w-[16ch] font-display text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[2.75rem]"
                style={{ color: "var(--ed-ink)" }}
              >
                {t("landing.applyTitle", { assistant: brand.assistantName })}
              </h2>
              <p
                className="mt-6 max-w-[46ch] text-lg leading-relaxed"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {t("landing.applyBody")}
              </p>
            </div>
          </div>
        </section>

        {/* ══ Abschluss ═════════════════════════════════════════ */}
        <section>
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
                    background: "var(--ed-violet)",
                    color: "#ffffff",
                    boxShadow: "0 6px 24px rgba(99, 91, 255, 0.28)",
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

      <footer>
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-7 gap-y-3 px-5 py-10 text-sm md:px-8">
          <span style={{ color: "var(--ed-ink-3)" }}>
            {brand.name} — {brand.tagline.de}
          </span>
          {/* Die Abstände sitzen an den Links selbst, nicht zwischen
              ihnen: „AGB“ ist 29 Pixel breit, und ein Wort ist kein
              Berührungsziel. Die Fläche trägt die geforderten 44. */}
          <nav aria-label="Rechtliches" className="-my-2 ml-auto flex flex-wrap gap-x-3 gap-y-0">
            {([
              ["Über uns", "/about"],
              ["Kontakt", "/contact"],
              ["KI-Transparenz", "/ai-transparency"],
              [t("landing.footerPrivacy"), "/privacy"],
              [t("landing.footerImprint"), "/imprint"],
              [t("landing.footerTerms"), "/terms"],
            ] as const).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center px-2"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
