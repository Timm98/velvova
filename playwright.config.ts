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
  timeout: 60_000,
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
    command: "pnpm --filter @paycheck/web dev",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { WEB_PORT: "3210", NODE_ENV: "development" },
  },
});
