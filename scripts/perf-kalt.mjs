import { chromium } from "@playwright/test";

/**
 * Der erste Aufruf, nicht der vierte.
 *
 * `perf-messung.mjs` nimmt den Median aus vier Läufen — richtig für die
 * Frage „wie schnell ist die Anwendung im Gebrauch". Für die Frage, was
 * die Bewertung von 994 Stellen kostet, ist es die falsche Zahl: der
 * Bewertungscache hält das Ergebnis 45 Sekunden, und die Läufe zwei bis
 * vier messen einen Treffer darin.
 *
 * Hier bekommt jeder Lauf eine frische Person. Damit ist jeder Aufruf
 * kalt, und gemessen wird das, was der Umbau verändert hat: die
 * Ranglistenabfrage.
 *
 *   node scripts/perf-kalt.mjs [basis-url] [läufe]
 */

const B = process.argv[2] ?? "http://localhost:3100";
const LÄUFE = Number(process.argv[3] ?? 10);
const ROUTEN = [
  ["Heute", "/app"],
  ["Jobs", "/app/jobs"],
];

const browser = await chromium.launch();
const messungen = new Map(ROUTEN.map(([name]) => [name, []]));

for (let i = 0; i < LÄUFE; i++) {
  // Eigener Kontext je Lauf: eigene Cookies, eigener Cache, eigene
  // Person. Ein geteilter Kontext würde die zweite Route mit der
  // Sitzung der ersten messen.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const kennung = `kalt-${Date.now()}-${i}@example.invalid`;

  await page.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/e-?mail/i).fill(kennung);
  await page.getByLabel(/passwort/i).first().fill("Testpasswort-2026!");
  await page.getByRole("button", { name: /konto|registrieren|anlegen/i }).first().click();
  await page.waitForURL(/\/app|\/setup/, { timeout: 30_000 });

  /*
   * Nur EINE Route je Person.
   *
   * Der erste Versuch mass beide hintereinander — und die zweite war
   * dann warm: `/app` füllt denselben Bewertungscache, aus dem
   * `/app/jobs` liest. Gemessen wurden 715 ms für Jobs, was schlicht
   * die Zeit war, das fertige Ergebnis noch einmal zu formatieren.
   */
  const [name, pfad] = ROUTEN[i % ROUTEN.length];
  const antwort = await page.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" });
  const t = await antwort.request().timing();
  messungen.get(name).push(Math.round(t.responseStart - t.requestStart));
  await ctx.close();
  process.stdout.write(".");
}
process.stdout.write("\n\n");

console.log("Route      TTFB kalt (Median)   alle Läufe");
console.log("────────────────────────────────────────────────────────");
for (const [name, werte] of messungen) {
  const s = [...werte].sort((a, b) => a - b);
  const median = s[Math.floor(s.length / 2)];
  console.log(`${name.padEnd(10)} ${String(median + " ms").padStart(16)}   ${werte.join(", ")}`);
}

await browser.close();
