import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { LocaleToggle, ThemeToggle } from "@/components/ThemeToggle";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { t, brand, locale } = await getPageContext();

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <a href="#inhalt" className="skip-link">{t("nav.skipToContent")}</a>

      <header style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-4) var(--space-5)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <Link href="/" style={{ fontWeight: 600, textDecoration: "none" }}>{brand.name}</Link>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <LocaleToggle current={locale} />
            <ThemeToggle labels={{ light: t("settings.themeLight"), dark: t("settings.themeDark"), system: t("settings.themeSystem"), group: t("settings.theme") }} />
          </div>
        </div>
      </header>

      <main id="inhalt" style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: "var(--space-8) var(--space-5) var(--space-9)" }}>
        {children}
      </main>

      <footer style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-sunken)" }}>
        <nav aria-label="Rechtliches" style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-5)", display: "flex", gap: "var(--space-5)", flexWrap: "wrap", fontSize: "var(--text-sm)" }}>
          <Link href="/how-it-works" style={{ textDecoration: "none" }}>So funktioniert es</Link>
          <Link href="/methodology" style={{ textDecoration: "none" }}>Methodik</Link>
          <Link href="/security" style={{ textDecoration: "none" }}>Sicherheit</Link>
          <Link href="/privacy" style={{ textDecoration: "none" }}>Datenschutz</Link>
        </nav>
      </footer>
    </div>
  );
}
