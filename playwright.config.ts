import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Konfiguration.
 *
 * Die Tests laufen gegen den echten Entwicklungsserver mit der lokalen
 * PGlite-Datenbank und den Seed-Daten. Kein gemocktes Backend: was hier
 * gruen ist, funktioniert tatsaechlich.
 *
 * Die Breitenpunkte entsprechen denen aus der Designvorgabe.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  /*
   * 120 Sekunden je Prüfung, und der Grund ist der Entwicklungsmodus.
   *
   * Die Testreihe läuft gegen `next dev`. Der übersetzt eine Route beim
   * ERSTEN Aufruf, und das dauert bei einer grossen Seite zehn Sekunden
   * und mehr. Gemessen: `/app/jobs/[id]` antwortet warm in 130 ms — und
   * lief kalt in die 60-Sekunden-Grenze.
   *
   * Das war kein Fehler der Anwendung, sah aber genau so aus: eine
   * Prüfung, die allein bestanden hätte, scheiterte in der vollen Reihe,
   * weil sie zufällig die erste war, die diese Route öffnete.
   */
  timeout: 120_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3210",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },

  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "laptop-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile-390", use: { ...devices["iPhone 14"] } },
    { name: "mobile-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 }, isMobile: false } },
  ],

  webServer: {
    /*
     * Erst migrieren, dann starten.
     *
     * Die eingebettete Datenbank der Testreihe liegt in `.data/pglite`
     * und überlebt die Läufe — was gut ist, weil das Einspielen der
     * Beispieldaten Zeit kostet. Sie zieht Migrationen aber nicht von
     * selbst nach.
     *
     * Ohne diese Zeile scheitert nach jeder neuen Migration die halbe
     * Reihe mit „column does not exist", und der Fehler sieht aus wie
     * ein Anwendungsfehler statt wie ein veralteter Schemastand. Genau
     * so ist es einmal passiert.
     */
    command:
      "pnpm --filter @paycheck/db exec node --experimental-strip-types src/migrate.ts && " +
      "pnpm --filter @paycheck/web dev",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    /*
     * Die Testreihe läuft gegen die lokale Datenbank, nicht gegen die
     * echte.
     *
     * Vorher übernahm sie den Treiber aus `.env.local` — also Supabase.
     * Damit hingen zwanzig Prüfungen an Daten in der Produktionsbank:
     * sie brauchen die Demo-Persona mit bestätigten Belegen,
     * Bewerbungen und Rollenclustern. Die dort einzuspielen hiesse,
     * Demo-Datensätze in die Bank zu schreiben, aus der echte Menschen
     * ihre Stellen bekommen.
     *
     * Mit PGlite bringt die Testreihe ihre Daten selbst mit
     * (`DATABASE_DRIVER=pglite pnpm db:seed`), läuft überall gleich und
     * kann nichts kaputtmachen, was jemandem gehört.
     *
     * `DEV_LOGIN_ENABLED` gehört dazu: der Endpunkt ist sonst aus, und
     * ohne ihn käme die Reihe nicht an der Anmeldung vorbei.
     *
     * `NEXT_DIST_DIR` ist die Lehre aus einem Nachmittag Fehlersuche.
     * Next benutzt für `dev` und `build` dasselbe `.next`. Läuft
     * nebenher ein Entwicklungsserver — und beim Arbeiten läuft immer
     * einer — dann überschreiben sich die beiden gegenseitig die
     * gemeinsamen Manifeste. Danach zeigt die Seite auf Chunks, die der
     * andere Server nicht ausliefern kann: das CSS kommt als 404
     * zurück, der Client wirft, und die Person sieht „Da ist etwas
     * schiefgegangen".
     *
     * Das Tückische daran ist, dass es nach einem Anwendungsfehler
     * aussieht. Mit einem eigenen Verzeichnis je Server ist die
     * Kollision nicht seltener, sondern ausgeschlossen.
     */
    env: {
      WEB_PORT: "3210",
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      DEV_LOGIN_ENABLED: "true",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
