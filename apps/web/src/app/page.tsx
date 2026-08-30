import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import type { Translator } from "@paycheck/i18n";
import { getDb, schema } from "@paycheck/db";
import { currentUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { NinaSignal, BrandMark } from "@/components/nina/NinaSignal";
import { EvidenceSequence, type LiveJobTeaser } from "@/components/marketing/EvidenceSequence";

export const metadata: Metadata = {
  title: "Deine Karriere. Nicht nach Keywords, sondern nach dir.",
  description:
    "Nina versteht deine Erfahrungen, entdeckt passende Rollen und bringt dich von der Orientierung bis zur Bewerbung.",
};

export const dynamic = "force-dynamic";

/**
 * Die Landingpage.
 *
 * Sie sieht bewusst nicht aus wie die Anwendung und besteht nicht aus
 * einer Reihe gleich großer Karten. Jeder Abschnitt hat eine eigene
 * Komposition, weil jeder eine andere Sache sagt.
 *
 * Was hier nicht steht: erfundene Nutzerzahlen, Presse-Logos,
 * Erfolgsquoten, Testimonials — und keine erfundenen Unternehmen. Die
 * Stellen im Hero kommen aus derselben Datenbank wie die in der
 * Anwendung, mit Quellenangabe.
 */
export default async function LandingPage() {
  if (await currentUser()) redirect("/app");
  const { t, brand } = await getPageContext();

  // Drei echte Anzeigen für die Vorschau. Sind noch keine abgerufen,
  // bleibt der Abschnitt leer statt gefüllt mit Erfundenem.
  const db = await getDb();
  const liveJobs: LiveJobTeaser[] = await db
    .select({
      title: schema.jobs.title,
      companyName: schema.companies.name,
      location: schema.jobs.location,
      sourceName: schema.jobSources.displayName,
    })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .innerJoin(schema.jobSources, eq(schema.jobSources.id, schema.jobs.sourceId))
    .where(eq(schema.jobs.isDemo, false))
    .orderBy(desc(schema.jobs.publishedAt))
    .limit(3)
    .catch(() => []);

  return (
    <div className="min-h-dvh bg-page">
      <a href="#inhalt" className="skip-link">
        Zum Inhalt springen
      </a>

      <SiteHeader brandName={brand.name} t={t} />

      <main id="inhalt">
        {/* ══ Hero ═══════════════════════════════════════════════ */}
        <section className="relative overflow-hidden border-b border-line">
          <div aria-hidden className="aurora pointer-events-none absolute inset-0 -z-10" />

          <div className="mx-auto grid w-full max-w-[1400px] gap-16 px-5 pb-24 pt-16 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,400px)] lg:items-center lg:gap-16 lg:pb-32 lg:pt-24">
            <div className="max-w-[44rem]">
              <p className="inline-flex items-center gap-2.5 rounded-[--radius-full] border border-line-2 bg-raised/60 px-3.5 py-1.5 font-mono text-2xs uppercase tracking-[0.14em] text-ink-2 backdrop-blur">
                <NinaSignal size="xs" state="active" />
                {t("landing.eyebrow")}
              </p>

              {/* Höchstens drei Zeilen. Eine Überschrift, die Wort für
                  Wort umbricht, sieht aus wie ein Unfall. */}
              <h1 className="mt-7 font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.035em] text-balance sm:text-[3.5rem] lg:text-[3.9rem]">
                {t("landing.headline")}
              </h1>

              <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-ink-2">
                {t("landing.subheadline")}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="signal-gradient inline-flex h-12 items-center gap-2.5 rounded-[--radius-md] px-6 text-base font-medium text-white shadow-glow transition-transform duration-[--duration-fast] active:translate-y-px"
                >
                  <NinaSignal size="xs" />
                  {t("landing.ctaPrimary")}
                  <ArrowRight className="size-4" strokeWidth={2} />
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex h-12 items-center gap-2 rounded-[--radius-md] border border-line-2 bg-raised px-6 text-base font-medium transition-colors hover:border-line-3"
                >
                  {t("landing.ctaSecondary")}
                </Link>
              </div>

              <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-2.5">
                {[
                  t("landing.trustProfile"),
                  t("landing.trustReasons"),
                  t("landing.trustNoInvention"),
                ].map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-ink-2">
                    <Check className="size-3.5 shrink-0 text-positive" strokeWidth={2.6} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <EvidenceSequence
              jobs={liveJobs}
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
                jobsLabel: t("landing.exampleJobs"),
                jobsNote: t("landing.exampleJobsNote"),
              }}
            />
          </div>
        </section>

        {/* ══ Drei Aussagen, drei Kompositionen ══════════════════ */}
        <Statement
          eyebrow={t("landing.understandEyebrow")}
          title={t("landing.understandTitle")}
          body={t("landing.understandBody")}
          align="left"
        >
          <FlowStrip
            items={[
              { label: "Im Lebenslauf", text: "„Kundenservice, 2 Jahre“", tone: "muted" },
              { label: "Was Nina fragt", text: "„Was war die schwierigste Eskalation?“", tone: "assistant" },
              { label: "Belegte Stärke", text: "Konfliktklärung unter Druck", tone: "positive" },
            ]}
          />
        </Statement>

        <Statement
          eyebrow={t("landing.discoverEyebrow")}
          title={t("landing.discoverTitle")}
          body={t("landing.discoverBody")}
          align="right"
        >
          <RoleFan />
        </Statement>

        <Statement
          eyebrow={t("landing.explainEyebrow")}
          title={t("landing.explainTitle")}
          body={t("landing.explainBody")}
          align="left"
        >
          <ScorePanel />
        </Statement>

        <Statement
          eyebrow={t("landing.applyEyebrow")}
          title={t("landing.applyTitle")}
          body={t("landing.applyBody")}
          align="right"
        >
          <ClaimPanel />
        </Statement>

        {/* ══ Methodik ═══════════════════════════════════════════ */}
        <section className="border-y border-line bg-sunken">
          <div className="mx-auto w-full max-w-[1400px] px-5 py-24 md:px-8">
            <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
              <div>
                <Eyebrow>{t("landing.methodEyebrow")}</Eyebrow>
                <h2 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.028em] lg:text-[2.5rem]">
                  {t("landing.methodTitle")}
                </h2>
                <p className="mt-6 text-[15px] leading-relaxed text-ink-2">
                  {t("landing.methodBody")}
                </p>
                <Link
                  href="/methodology"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent-text underline underline-offset-[3px]"
                >
                  {t("landing.methodLink")}
                  <ArrowRight className="size-3.5" strokeWidth={2} />
                </Link>
              </div>

              {/* Eine Tabelle statt vier Karten: vier Zeilen, die man
                  untereinander vergleicht, sind genau das — eine Liste. */}
              <ul className="grid divide-y divide-line border-y border-line">
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
                    dot: "bg-cyan",
                  },
                ].map((item) => (
                  <li key={item.title} className="grid gap-1.5 py-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
                    <span className="flex items-center gap-2.5 text-sm font-medium">
                      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${item.dot}`} />
                      {item.title}
                    </span>
                    <span className="text-sm leading-relaxed text-ink-2">{item.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ══ Datenschutz ════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-[1400px] px-5 py-24 md:px-8">
          <div className="mx-auto max-w-[46rem] text-center">
            <h2 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.028em] text-balance lg:text-[2.5rem]">
              {t("landing.privacyTitle")}
            </h2>
            <p className="mx-auto mt-6 max-w-[38rem] leading-relaxed text-ink-2">
              {t("landing.privacyBody")}
            </p>
            <Link
              href="/security"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-accent-text underline underline-offset-[3px]"
            >
              {t("landing.privacyLink")}
              <ArrowRight className="size-3.5" strokeWidth={2} />
            </Link>
          </div>
        </section>

        {/* ══ Fragen ═════════════════════════════════════════════ */}
        <section className="border-t border-line bg-sunken">
          <div className="mx-auto w-full max-w-[1400px] px-5 py-24 md:px-8">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-20">
              <h2 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.028em]">
                {t("landing.faqTitle")}
              </h2>

              <ul className="grid divide-y divide-line border-y border-line">
                {[
                  { q: t("landing.faq1Q"), a: t("landing.faq1A") },
                  { q: t("landing.faq2Q"), a: t("landing.faq2A") },
                  { q: t("landing.faq3Q"), a: t("landing.faq3A") },
                  { q: t("landing.faq4Q"), a: t("landing.faq4A") },
                ].map((item) => (
                  <li key={item.q}>
                    <details className="group py-1">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 text-[15px] font-medium">
                        {item.q}
                        <span aria-hidden className="relative grid size-5 shrink-0 place-items-center text-ink-3">
                          <Plus className="size-4 group-open:hidden" strokeWidth={1.8} />
                          <Minus className="hidden size-4 group-open:block" strokeWidth={1.8} />
                        </span>
                      </summary>
                      <p className="max-w-[var(--measure)] pb-5 pr-10 text-sm leading-relaxed text-ink-2">
                        {item.a}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ══ Abschluss ══════════════════════════════════════════ */}
        <section className="relative overflow-hidden border-t border-line">
          <div aria-hidden className="aurora pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto w-full max-w-[1400px] px-5 py-28 md:px-8 lg:py-36">
            <div className="mx-auto max-w-[42rem] text-center">
              <h2 className="font-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.032em] text-balance lg:text-[3.25rem]">
                {t("landing.closingTitle")}
              </h2>
              <p className="mx-auto mt-6 max-w-[32rem] text-lg leading-relaxed text-ink-2">
                {t("landing.closingBody")}
              </p>
              <Link
                href="/register"
                className="signal-gradient mt-10 inline-flex h-12 items-center gap-2.5 rounded-[--radius-md] px-7 text-base font-medium text-white shadow-glow transition-transform duration-[--duration-fast] active:translate-y-px"
              >
                {t("landing.closingCta")}
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter brandName={brand.name} t={t} />
    </div>
  );
}

/* ── Bausteine ──────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-2xs uppercase tracking-[0.16em] text-accent-text">{children}</p>
  );
}

/**
 * Ein Abschnitt mit einer Aussage und einem Bild dazu.
 *
 * Die Seiten wechseln sich ab. Vier gleich aufgebaute Blöcke
 * untereinander lesen sich wie eine Tabelle; abwechselnd gesetzt lesen
 * sie sich wie ein Text.
 */
function Statement({
  eyebrow,
  title,
  body,
  align,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  align: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-12 px-5 py-20 md:px-8 lg:grid-cols-2 lg:gap-20 lg:py-24">
        <div className={align === "right" ? "lg:order-2" : undefined}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-4 max-w-[20ch] font-display text-[1.875rem] font-semibold leading-[1.12] tracking-[-0.028em] lg:text-[2.375rem]">
            {title}
          </h2>
          <p className="mt-6 max-w-[var(--measure)] leading-relaxed text-ink-2">{body}</p>
        </div>
        <div className={align === "right" ? "lg:order-1" : undefined}>{children}</div>
      </div>
    </section>
  );
}

function FlowStrip({
  items,
}: {
  items: { label: string; text: string; tone: "muted" | "assistant" | "positive" }[];
}) {
  return (
    <ol className="grid gap-2.5">
      {items.map((item, index) => (
        <li key={item.label}>
          {index > 0 && (
            <div aria-hidden className="ml-6 h-4 w-px bg-line-3" />
          )}
          <div
            className={
              item.tone === "positive"
                ? "rounded-[--radius-md] border border-positive/25 bg-positive-soft px-5 py-4"
                : item.tone === "assistant"
                  ? "rounded-[--radius-md] border border-line-2 bg-assistant-soft px-5 py-4"
                  : "rounded-[--radius-md] border border-line bg-inset px-5 py-4"
            }
          >
            <p className="font-mono text-2xs uppercase tracking-wider text-ink-3">{item.label}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed">{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Ein Fächer aus Rollen: naheliegend, angrenzend, speziell. */
function RoleFan() {
  const roles = [
    { name: "Customer Success", kind: "naheliegend", offset: "lg:ml-0" },
    { name: "Implementation Specialist", kind: "angrenzend", offset: "lg:ml-8" },
    { name: "Service Operations", kind: "angrenzend", offset: "lg:ml-16" },
    { name: "Technical Account Management", kind: "speziell", offset: "lg:ml-24" },
  ];

  return (
    <ul className="grid gap-2.5">
      {roles.map((role) => (
        <li
          key={role.name}
          className={`flex items-center justify-between gap-4 rounded-[--radius-md] border border-line-2 bg-raised px-5 py-3.5 ${role.offset}`}
        >
          <span className="text-[15px] font-medium">{role.name}</span>
          <span
            className={
              role.kind === "naheliegend"
                ? "font-mono text-2xs uppercase tracking-wider text-ink-3"
                : role.kind === "angrenzend"
                  ? "font-mono text-2xs uppercase tracking-wider text-assistant-text"
                  : "font-mono text-2xs uppercase tracking-wider text-cyan-text"
            }
          >
            {role.kind}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Ein Score mit seiner Aufschlüsselung — ohne Ring, ohne Tortendiagramm. */
function ScorePanel() {
  const factors = [
    { label: "Belegte Fähigkeiten", value: 82 },
    { label: "Tätigkeiten", value: 74 },
    { label: "Arbeitsumfeld", value: 61 },
    { label: "Entwicklung", value: 55 },
  ];

  return (
    <div className="rounded-[--radius-lg] border border-line-2 bg-raised p-6">
      <div className="flex items-end justify-between gap-6 border-b border-line pb-5">
        <div>
          <p className="font-mono text-2xs uppercase tracking-wider text-ink-3">Passung</p>
          <p className="mt-1 font-mono text-[2.75rem] font-semibold leading-none tabular">71</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xs uppercase tracking-wider text-ink-3">Sicherheit</p>
          <p className="mt-2 flex items-center justify-end gap-1.5 text-sm">
            <span aria-hidden className="flex gap-[3px]">
              <span className="h-1.5 w-4 rounded-full bg-positive" />
              <span className="h-1.5 w-4 rounded-full bg-positive" />
              <span className="h-1.5 w-4 rounded-full bg-inset" />
            </span>
            mittel
          </p>
        </div>
      </div>

      <ul className="mt-5 grid gap-3.5">
        {factors.map((f) => (
          <li key={f.label} className="grid gap-1.5">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              {f.label}
              <span className="font-mono text-xs text-ink-3 tabular">{f.value}</span>
            </span>
            <span aria-hidden className="h-1 overflow-hidden rounded-full bg-inset">
              <span className="signal-gradient block h-full rounded-full" style={{ width: `${f.value}%` }} />
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-2">
        <span className="font-medium text-caution">Offen: </span>
        Zur Arbeitsbelastung sagt die Anzeige nichts. Das senkt die Sicherheit — nicht die Passung.
      </p>
    </div>
  );
}

/** Belegte und unbelegte Aussage nebeneinander. */
function ClaimPanel() {
  return (
    <div className="grid gap-3">
      <div className="rounded-[--radius-md] border border-positive/25 bg-positive-soft px-5 py-4">
        <p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-positive">
          <Check className="size-3" strokeWidth={2.6} />
          belegt
        </p>
        <p className="mt-2 text-[15px] leading-relaxed">
          „Ich habe eine Eskalation mit einem Großkunden übernommen und bis zur Lösung begleitet.“
        </p>
        <p className="mt-2 text-xs text-ink-3">Quelle: Gespräch, Thema „konkrete Erfahrungen“</p>
      </div>

      <div className="rounded-[--radius-md] border border-critical/25 bg-critical-soft px-5 py-4">
        <p className="font-mono text-2xs uppercase tracking-wider text-critical">
          ohne Beleg — wird nicht geschrieben
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2 line-through decoration-critical/40">
          „Ich habe die Kundenzufriedenheit um 30 % gesteigert.“
        </p>
        <p className="mt-2 text-xs text-ink-3">
          Keine Zahl im Profil. Nina fragt nach — oder lässt die Aussage weg.
        </p>
      </div>
    </div>
  );
}

/* ── Kopf und Fuß ───────────────────────────────────────────── */

function SiteHeader({ brandName, t }: { brandName: string; t: Translator["t"] }) {
  const links = [
    { href: "/product", label: t("landing.navProduct") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/methodology", label: t("nav.methodology") },
    { href: "/security", label: t("nav.security") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-8 px-5 md:px-8">
        <Link href="/" className="rounded-[--radius-sm]">
          <BrandMark name={brandName} size="md" />
        </Link>

        <nav aria-label="Produktseiten" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[--radius-md] px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-inset hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-[--radius-md] px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-inset hover:text-ink"
          >
            {t("auth.login")}
          </Link>
          <Link
            href="/register"
            className="signal-gradient inline-flex h-9 items-center gap-2 rounded-[--radius-md] px-4 text-sm font-medium text-white"
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
        { href: "/terms", label: "Nutzungsbedingungen" },
        { href: "/login", label: t("auth.login") },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-sunken">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <BrandMark name={brandName} size="md" />
            <p className="mt-4 max-w-[24rem] text-sm leading-relaxed text-ink-3">
              {t("landing.footerNote")}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-mono text-2xs uppercase tracking-[0.16em] text-ink-3">
                {column.title}
              </h2>
              <ul className="mt-4 grid gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-14 max-w-[46rem] border-t border-line pt-6 text-xs leading-relaxed text-ink-3">
          {t("landing.footerLanguage")}
        </p>
      </div>
    </footer>
  );
}
