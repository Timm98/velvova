import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";

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

  /*
   * Wer angemeldet ist, sieht hier kein „Anmelden" mehr.
   *
   * Das war ein gemeldeter Fehler — und ein hartnäckiger, weil er wie
   * etwas ganz anderes aussah: „Die Hilfe loggt mich aus." Tat sie
   * nicht. Die Sitzung blieb die ganze Zeit gültig, das Cookie
   * unberührt. Aber „Hilfe" führt nach /how-it-works, das liegt in
   * diesem öffentlichen Rahmen, und der bot jedem unbesehen
   * „Anmelden / Konto anlegen" an. Man klickt auf Hilfe, sieht den
   * Anmeldeknopf und zieht den einzig naheliegenden Schluss.
   *
   * Ein Login-Knopf ist eine Aussage über den eigenen Zustand. Wird sie
   * ungeprüft getroffen, ist sie in der Hälfte der Fälle falsch.
   */
  const user = await currentUser();

  const legal = [
    { href: "/how-it-works", label: "So funktioniert es" },
    { href: "/methodology", label: "Methodik" },
    { href: "/security", label: "Sicherheit" },
    { href: "/privacy", label: "Datenschutz" },
  ];

  return (
    /*
     * Öffentliche Seiten sind immer hell.
     *
     * Auch wenn im Konto „dunkel“ steht: Landingpage, Anmeldung und
     * Registrierung werden von Menschen geöffnet, die das Produkt noch
     * nicht kennen — meist bei Tageslicht und oft am Telefon. Das
     * Attribut hier überschreibt die Wahl auf `:root` für genau diesen
     * Teilbaum; die Tokens definieren die helle Palette sowohl für
     * `:root` als auch für `[data-theme="light"]`.
     */
    <div data-theme="light" className="flex min-h-dvh flex-col bg-page text-ink">
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      <header className="sticky top-0 z-40 bg-page/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-(--radius-sm) bg-accent text-accent-on text-xs font-bold"
            >
              P
            </span>
            {brand.name}
          </Link>
          <nav aria-label="Seiten" className="flex items-center gap-1">
            {user ? (
              /* Ein Weg zurück, kein Ausloggen. Wer die Hilfe liest,
                 will danach weitermachen, wo er war. */
              <Link
                href="/app"
                className="inline-flex h-9 items-center rounded-(--radius-md) bg-accent px-4 text-sm font-medium text-accent-on shadow-sm transition-colors hover:bg-accent-hover"
              >
                {t("nav.backToApp")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-(--radius-md) px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
                >
                  {t("auth.login")}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center rounded-(--radius-md) bg-accent px-4 text-sm font-medium text-accent-on shadow-sm transition-colors hover:bg-accent-hover"
                >
                  {t("auth.register")}
                </Link>
              </>
            )}
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
