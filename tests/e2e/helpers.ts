import type { BrowserContext, Page } from "@playwright/test";

/**
 * Meldet die Demo-Persona an.
 *
 * Der Weg fuehrt bewusst ueber einen Endpunkt IM Serverprozess. PGlite
 * ist eine eingebettete Einzelprozess-Datenbank: eine Sitzung, die ein
 * externes Skript anlegt, waere fuer den laufenden Server unsichtbar.
 * Der Endpunkt antwortet ausserhalb der lokalen Entwicklung mit 404.
 */
export async function loginAsDemo(page: Page): Promise<void> {
  // Echte Navigation statt API-Aufruf: nur so landet das Cookie
  // zuverlaessig im Browser-Kontext, und der Weg entspricht dem, den
  // ein Entwickler im Browser geht.
  const response = await page.goto("/api/dev/login");
  if (!response || response.status() >= 400) {
    throw new Error(
      `Demo-Anmeldung fehlgeschlagen (HTTP ${response?.status()}). ` +
        `Wurde der Seed geladen? "pnpm db:seed" im Repo-Wurzelverzeichnis.`,
    );
  }
  await page.waitForURL(/\/app/);
}

/** Setzt die Darstellung, ohne den Umschalter zu bedienen. */
export async function setTheme(context: BrowserContext, theme: "light" | "dark"): Promise<void> {
  await context.addCookies([
    { name: "paycheck_theme", value: theme, domain: "127.0.0.1", path: "/", sameSite: "Lax" },
  ]);
}

export async function setLocale(context: BrowserContext, locale: "de" | "en"): Promise<void> {
  await context.addCookies([
    { name: "paycheck_locale", value: locale, domain: "127.0.0.1", path: "/", sameSite: "Lax" },
  ]);
}

/**
 * Prueft, dass die Seite nicht seitlich ueberlaeuft. Breite Inhalte
 * duerfen in sich scrollen, die Seite selbst nicht.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scroll: doc.scrollWidth, client: doc.clientWidth };
  });
  if (overflow.scroll > overflow.client + 1) {
    throw new Error(
      `Die Seite laeuft seitlich ueber: ${overflow.scroll}px Inhalt bei ${overflow.client}px Breite.`,
    );
  }
}
