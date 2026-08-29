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
  const { brand } = await getPageContext();

  return (
    <div className="min-h-dvh">
      <a href="#inhalt" className="skip-link">
        Zum Inhalt springen
      </a>

      <SiteHeader brandName={brand.name} assistantName={brand.assistantName} />

      <main id="inhalt">
        {/* ══ Hero ═══════════════════════════════════════════════ */}
        <section className="mx-auto grid w-full max-w-[1320px] gap-14 px-5 pb-20 pt-14 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="max-w-[36rem]">
            <p className="inline-flex items-center gap-2 rounded-[--radius-full] border border-line-2 bg-raised px-3 py-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-ink-2 shadow-xs">
              <Sparkles className="size-3 text-brand" strokeWidth={2.2} />
              Deine Karriere, verstanden statt geraten
            </p>

            {/* Höchstens drei Zeilen auf dem Desktop. Eine Überschrift,
                die Wort für Wort umbricht, sieht aus wie ein Unfall. */}
            <h1 className="mt-6 font-display text-[2.75rem] font-medium leading-[1.04] tracking-[-0.025em] text-balance sm:text-[3.4rem] lg:text-[4rem]">
              Finde Arbeit, die zu deinem Leben passt.
            </h1>

            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">
              {brand.assistantName} fragt zuerst nach dem, was du tatsächlich getan hast — und
              sortiert dann echte Stellen. Jede Empfehlung kommt mit Grund, Vorbehalt und Quelle.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-[--radius-md] bg-accent px-6 text-base font-medium text-accent-on shadow-sm transition-[background-color,box-shadow,transform] duration-[--duration-fast] hover:bg-accent-hover hover:shadow-md active:translate-y-px"
              >
                Mit {brand.assistantName} starten
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex h-12 items-center gap-2 rounded-[--radius-md] border border-line-2 bg-raised px-6 text-base font-medium shadow-xs transition-colors hover:border-line-3 hover:bg-sunken"
              >
                So funktioniert es
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
              {[
                "Privates Profil",
                "Nachvollziehbare Matches",
                "Keine erfundenen Bewerbungsangaben",
              ].map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm text-ink-2">
                  <Check className="size-3.5 shrink-0 text-positive" strokeWidth={2.4} />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <EvidenceSequence />
        </section>

        {/* ══ Der Ablauf ═════════════════════════════════════════ */}
        <section className="border-y border-line bg-raised">
          <div className="mx-auto w-full max-w-[1320px] px-5 py-20 md:px-8 lg:py-24">
            <div className="max-w-[42rem]">
              <SectionEyebrow>Der Ablauf</SectionEyebrow>
              <h2 className="mt-4 font-display text-[2rem] font-medium leading-[1.12] tracking-[-0.02em] lg:text-[2.5rem]">
                Erst verstehen. Dann vergleichen. Dann bewerben.
              </h2>
            </div>

            <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
              {[
                {
                  icon: MessagesSquare,
                  title: brand.assistantName + " fragt, bevor sie sucht",
                  body: "Konkrete Situationen statt Selbsteinschätzung. Aus „Kundenservice, 2 Jahre“ wird eine benannte Handlung mit Ergebnis.",
                },
                {
                  icon: ScanSearch,
                  title: "Du siehst wenige, wirklich passende Stellen",
                  body: "Echte Anzeigen mit Quelle und Abrufdatum, sortiert nach begründeter Passung — nicht nach Werbebudget.",
                },
                {
                  icon: FileCheck2,
                  title: brand.assistantName + " begleitet Bewerbung und Interview",
                  body: "Jeder Satz in den Unterlagen hängt an etwas, das du bestätigt hast. Versendet wird nie ohne deine ausdrückliche Freigabe.",
                },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title}>
                    <span aria-hidden className="font-mono text-2xs font-medium tracking-widest text-brand">
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
              <SectionEyebrow>Methodik</SectionEyebrow>
              <h2 className="mt-4 font-display text-[2rem] font-medium leading-[1.12] tracking-[-0.02em] lg:text-[2.4rem]">
                Vier Arten von Wissen. Nie vermischt.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
                Der häufigste Fehler in KI-Produkten ist, eine Vermutung wie eine Tatsache aussehen
                zu lassen. Deshalb trägt jede Aussage im Profil sichtbar, woher sie stammt — und du
                kannst jede Ableitung bestätigen, ändern oder löschen.
              </p>
              <Link
                href="/methodology"
                className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-accent-text underline underline-offset-[3px]"
              >
                Ausführliche Methodik
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </Link>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Was du gesagt hast",
                  body: "Deine eigenen Angaben, wörtlich gespeichert.",
                  dot: "bg-ink-3",
                },
                {
                  title: "Was belegt ist",
                  body: "Eine Aussage mit konkreter Situation, Handlung und Ergebnis — von dir bestätigt.",
                  dot: "bg-positive",
                },
                {
                  title: "Was vermutet wird",
                  body:
                    "Eine Hypothese von " +
                    brand.assistantName +
                    ". Immer als solche gekennzeichnet, nie stillschweigend übernommen.",
                  dot: "bg-assistant",
                },
                {
                  title: "Was von außen kommt",
                  body: "Stellenanzeigen, Register, Bewertungen — mit Quelle und Abrufdatum.",
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
                title: "Wie sich die Rolle entwickelt",
                body: "Bewertet werden die Aufgaben der konkreten Stelle, nicht die Berufstafel. Ausgegeben werden Szenarien mit Datenstand — nie eine Jahreszahl, wann etwas „verschwindet“.",
                href: "/methodology",
                cta: "Wie das berechnet wird",
              },
              {
                icon: ShieldCheck,
                title: "Deine Daten bleiben deine",
                body: "Du siehst, was gespeichert ist, kannst alles einzeln ändern oder löschen und jede Einwilligung getrennt widerrufen. An das Sprachmodell geht nur der Kontext, den die jeweilige Aufgabe braucht.",
                href: "/security",
                cta: "Sicherheit und Datenschutz",
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
              Fang mit dem an, was du schon kannst.
            </h2>
            <p className="mx-auto mt-5 max-w-[32rem] text-lg leading-relaxed text-ink-2">
              Das erste Gespräch dauert etwa fünfzehn Minuten. Du kannst jederzeit pausieren und
              später weitermachen.
            </p>
            <Link
              href="/register"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-[--radius-md] bg-accent px-7 text-base font-medium text-accent-on shadow-sm transition-[background-color,box-shadow,transform] duration-[--duration-fast] hover:bg-accent-hover hover:shadow-md active:translate-y-px"
            >
              Kostenlos beginnen
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter brandName={brand.name} assistantName={brand.assistantName} />
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-medium uppercase tracking-[0.14em] text-brand">{children}</p>;
}

/**
 * Die öffentliche Kopfzeile.
 *
 * Kein Sprachschalter, kein Darstellungsschalter. Was hier steht, muss
 * zur Entscheidung beitragen, ob jemand anfängt — sonst nimmt es nur
 * Platz und Aufmerksamkeit.
 */
function SiteHeader({ brandName, assistantName }: { brandName: string; assistantName: string }) {
  const links = [
    { href: "/product", label: "Produkt" },
    { href: "/how-it-works", label: "So funktioniert es" },
    { href: "/methodology", label: "Methodik" },
    { href: "/security", label: "Sicherheit" },
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
            Anmelden
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-1.5 rounded-[--radius-md] bg-accent px-4 text-sm font-medium text-accent-on shadow-sm transition-colors hover:bg-accent-hover"
          >
            Mit {assistantName} starten
          </Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter({ brandName, assistantName }: { brandName: string; assistantName: string }) {
  const columns = [
    {
      title: "Produkt",
      links: [
        { href: "/product", label: "Überblick" },
        { href: "/how-it-works", label: "So funktioniert es" },
        { href: "/pricing", label: "Preise" },
      ],
    },
    {
      title: "Vertrauen",
      links: [
        { href: "/methodology", label: "Methodik" },
        { href: "/security", label: "Sicherheit" },
        { href: "/privacy", label: "Datenschutz" },
      ],
    },
    {
      title: "Unternehmen",
      links: [
        { href: "/imprint", label: "Impressum" },
        { href: "/register", label: "Konto anlegen" },
        { href: "/login", label: "Anmelden" },
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
              {brandName} und {assistantName} sind vorläufige Namen. Kandidatenseitig — dieses
              Produkt arbeitet für die suchende Person, nicht für Arbeitgeber.
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
            Sprache und Region wählst du beim Anlegen des Kontos und änderst sie jederzeit unter
            Profil → Sprache &amp; Region.
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
