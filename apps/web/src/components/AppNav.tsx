"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation. Dieselben fünf Punkte oben auf dem Desktop und unten auf
 * dem Telefon - wer das Produkt auf beiden Geräten nutzt, soll nicht
 * umlernen müssen.
 */

type NavLabels = Record<"home" | "assistant" | "jobs" | "applications" | "profile", string>;

const ITEMS: { key: keyof NavLabels; href: string }[] = [
  { key: "home", href: "/app" },
  { key: "assistant", href: "/app/nina" },
  { key: "jobs", href: "/app/jobs" },
  { key: "applications", href: "/app/applications" },
  { key: "profile", href: "/app/profile" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

export function AppNav({ labels }: { labels: NavLabels }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Hauptbereiche" className="app-nav-desktop">
      <ul style={{ display: "flex", gap: "var(--space-1)", listStyle: "none" }}>
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 40,
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                  fontWeight: active ? 500 : 400,
                  textDecoration: "none",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  background: active ? "var(--surface-inset)" : "transparent",
                }}
              >
                {labels[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>

      <style>{`
        .app-nav-desktop { display: none; }
        @media (min-width: 768px) { .app-nav-desktop { display: block; } }
      `}</style>
    </nav>
  );
}

export function BottomNav({ labels }: { labels: NavLabels }) {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Hauptbereiche"
        className="app-nav-bottom"
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--surface-raised)",
          borderTop: "1px solid var(--border-subtle)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 20,
        }}
      >
        <ul style={{ display: "flex", listStyle: "none" }}>
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.key} style={{ flex: 1 }}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    minHeight: 56,
                    fontSize: "var(--text-xs)",
                    textDecoration: "none",
                    color: active ? "var(--accent-text)" : "var(--text-secondary)",
                    fontWeight: active ? 500 : 400,
                    borderTop: active ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  {labels[item.key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <style>{`
        .app-nav-bottom { display: block; }
        @media (min-width: 768px) { .app-nav-bottom { display: none; } }
      `}</style>
    </>
  );
}
