import Link from "next/link";
import { getPageContext } from "@/lib/locale";

/**
 * Der Rahmen für Anmelden und Registrieren.
 *
 * Zweigeteilt ab Tablet: links das Formular, rechts eine ruhige Fläche
 * mit einem Satz zur Haltung des Produkts. Keine Sprachumschaltung —
 * die Sprache wird im Onboarding gewählt.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, brand } = await getPageContext();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      <div className="flex flex-col">
        <header className="px-5 py-5 md:px-10 md:py-7">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[15px] font-semibold">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-[--radius-sm] bg-accent text-xs font-bold text-accent-on"
            >
              P
            </span>
            {brand.name}
          </Link>
        </header>

        <main id="inhalt" className="flex flex-1 items-center justify-center px-5 py-8 md:px-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>

        <footer className="px-5 py-6 text-center text-sm text-ink-3 md:px-10">
          <Link href="/privacy" className="transition-colors hover:text-ink-2">
            Datenschutz
          </Link>
        </footer>
      </div>

      {/* Ruhige Fläche rechts — nur ab großen Bildschirmen */}
      <aside className="surface-gradient relative hidden border-l border-line lg:flex lg:items-center">
        <div className="px-12 py-16">
          <p className="text-2xs font-medium uppercase tracking-[0.16em] text-accent-text">
            {brand.assistantName}
          </p>
          <p className="mt-5 max-w-[24ch] text-3xl font-semibold leading-tight">
            Erst verstehen, dann suchen.
          </p>
          <p className="mt-5 max-w-[38ch] text-base leading-relaxed text-ink-2">
            Bevor du Stellen siehst, klären wir, was du tatsächlich kannst — anhand konkreter
            Situationen, nicht anhand von Selbsteinschätzungen.
          </p>
        </div>
      </aside>
    </div>
  );
}
