import Link from "next/link";
import { getPageContext } from "@/lib/locale";

/**
 * Rahmen der öffentlichen Seiten.
 *
 * Keine Sprachumschaltung und keine Darstellungswahl mehr in der
 * Kopfzeile: beides gehört ins Konto, nicht in die dauerhafte Navigation.
 * Was oben steht, muss man mehrmals am Tag brauchen — sonst nimmt es nur
 * Aufmerksamkeit weg.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { t, brand } = await getPageContext();

  const legal = [
    { href: "/how-it-works", label: "So funktioniert es" },
    { href: "/methodology", label: "Methodik" },
    { href: "/security", label: "Sicherheit" },
    { href: "/privacy", label: "Datenschutz" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-page/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-[--radius-sm] bg-accent text-accent-on text-xs font-bold"
            >
              P
            </span>
            {brand.name}
          </Link>
          <nav aria-label="Seiten" className="flex items-center gap-1">
            <Link
              href="/login"
              className="rounded-[--radius-md] px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              {t("auth.login")}
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-[--radius-md] bg-accent px-4 text-sm font-medium text-accent-on shadow-sm transition-colors hover:bg-accent-hover"
            >
              {t("auth.register")}
            </Link>
          </nav>
        </div>
      </header>

      <main id="inhalt" className="mx-auto w-full max-w-[760px] flex-1 px-5 py-14 md:py-20">
        {children}
      </main>

      <footer className="border-t border-line bg-sunken">
        <nav
          aria-label="Rechtliches"
          className="mx-auto flex w-full max-w-[1120px] flex-wrap gap-x-7 gap-y-3 px-5 py-8 text-sm text-ink-2"
        >
          {legal.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
