import { chromium } from "@playwright/test";

/**
 * Was die Anwendung wirklich kostet.
 *
 * Bewusst gegen den Production Build und mit echter Anmeldung: `next
 * dev` übersetzt Routen beim ersten Aufruf und misst damit vor allem
 * den Übersetzer. Und ohne Sitzung misst man Weiterleitungen nach
 * /login — 2 Millisekunden, die nichts bedeuten.
 *
 *   node scripts/perf-messung.mjs [basis-url]
 */

const B = process.argv[2] ?? "http://localhost:3000";
const ROUTEN = [
  ["Landingpage", "/"],
  ["Heute", "/app"],
  ["Monday", "/app/monday"],
  ["Jobs", "/app/jobs"],
  ["Jobdetail", null], // wird aus der Liste bestimmt
  ["Bewerbungen", "/app/applications"],
  ["Profil", "/app/profile"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

/* Anmeldung über das echte Formular — der Weg, den auch ein Mensch geht. */
await page.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await page.getByLabel("E-Mail-Adresse").fill(`perf-${Date.now()}@example.invalid`);
await page.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await page.getByRole("button", { name: /Konto anlegen/i }).click();
await page.waitForLoadState("networkidle").catch(() => {});

/* Eine Jobkennung für die Detailseite. */
await page.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const jobId = await page.locator("[data-job-id]").first().getAttribute("data-job-id");
ROUTEN[4][1] = jobId ? `/app/jobs/${jobId}` : null;

async function miss(pfad) {
  let bytes = 0;
  let anfragen = 0;
  const langsam = [];
  const zaehler = (r) => {
    anfragen++;
    r.response()
      ?.then(async (res) => {
        try {
          bytes += (await res.body()).length;
        } catch {}
      })
      .catch(() => {});
  };
  page.on("request", zaehler);
  /*
   * Die Dauer steht an der ANFRAGE, nicht an der Antwort — Playwright
   * legt `timing()` auf das Request-Objekt. Über die Antwort gelesen
   * wirft es, und zwar erst zur Laufzeit im Ereignisrückruf, wo der
   * Fehler die ganze Messung mitnimmt.
   */
  const antwortZeit = (res) => {
    const t = res.request().timing();
    if (t && t.responseEnd > 0 && t.responseEnd - t.requestStart > 300) {
      langsam.push(`${Math.round(t.responseEnd - t.requestStart)}ms ${res.url().replace(B, "").slice(0, 48)}`);
    }
  };
  page.on("response", antwortZeit);

  const t0 = Date.now();
  await page.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" });

  /*
   * LCP und CLS über PerformanceObserver, nicht geschätzt.
   *
   * Beide werden erst über die Lebensdauer der Seite endgültig; deshalb
   * wird zwei Sekunden gewartet und danach abgelesen. Der Wert ist ein
   * Laborwert auf einer schnellen Maschine — die Reihenfolge zwischen
   * den Seiten ist aussagekräftiger als die absolute Zahl.
   */
  const vitals = await page.evaluate(
    () =>
      new Promise((auf) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          auf({
            lcp: Math.round(lcp),
            cls: Math.round(cls * 1000) / 1000,
            ttfb: Math.round(nav?.responseStart ?? 0),
            domReady: Math.round(nav?.domContentLoadedEventEnd ?? 0),
          });
        }, 2000);
      }),
  );

  page.off("request", zaehler);
  page.off("response", antwortZeit);

  /* Wie lange dauert eine Interaktion? Stellvertretend ein Klick ins Nichts. */
  const t1 = Date.now();
  await page.mouse.click(5, 5);
  await page.waitForTimeout(50);
  const inp = Date.now() - t1 - 50;

  return {
    gesamt: Date.now() - t0,
    ...vitals,
    inp,
    anfragen,
    kb: Math.round(bytes / 1024),
    langsam: [...new Set(langsam)].slice(0, 3),
  };
}

console.log("Route         TTFB   LCP    CLS    DOM    ges.   Anfr.  KB");
console.log("─".repeat(72));
const ergebnis = {};
for (const [name, pfad] of ROUTEN) {
  if (!pfad) continue;
  /*
   * Median aus vier Läufen, den ersten verworfen.
   *
   * Einzelmessungen schwanken hier um mehr als 100 Prozent — derselbe
   * Aufruf lag einmal bei 487 und einmal bei 938 Millisekunden, ohne
   * dass sich am Code etwas geändert hätte. Wer daraus Schlüsse zieht,
   * jagt Rauschen. Der erste Lauf wärmt auf, aus den drei folgenden
   * wird der mittlere genommen.
   */
  await miss(pfad);
  const läufe = [await miss(pfad), await miss(pfad), await miss(pfad)];
  const median = (feld) => [...feld].sort((a, b) => a - b)[1];
  const m = {
    ...läufe[1],
    ttfb: median(läufe.map((l) => l.ttfb)),
    lcp: median(läufe.map((l) => l.lcp)),
    domReady: median(läufe.map((l) => l.domReady)),
    gesamt: median(läufe.map((l) => l.gesamt)),
  };
  ergebnis[name] = m;
  console.log(
    `${name.padEnd(13)} ${String(m.ttfb).padStart(4)}ms ${String(m.lcp).padStart(5)}ms ` +
      `${String(m.cls).padStart(6)} ${String(m.domReady).padStart(5)}ms ${String(m.gesamt).padStart(5)}ms ` +
      `${String(m.anfragen).padStart(5)} ${String(m.kb).padStart(5)}`,
  );
  for (const l of m.langsam) console.log(`              langsam: ${l}`);
}

console.log("\n── Navigation im Client (gefühlte Geschwindigkeit) ──");
await page.goto(`${B}/app`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
/*
 * Auf die ZIELADRESSE warten, nicht auf ein Stück des Linktexts.
 *
 * Der erste Versuch leitete das Muster aus der Beschriftung ab —
 * „Bewerbungen" wurde zu /bewe/, und die Adresse lautet
 * /app/applications. Die Prüfung lief in ihre 15-Sekunden-Grenze und
 * meldete eine Navigation, die in Wahrheit sofort fertig war.
 */
for (const [name, beschriftung, ziel] of [
  ["Heute → Jobs", "Jobs", "/app/jobs"],
  ["Jobs → Bewerbungen", "Bewerbungen", "/app/applications"],
  ["Bewerbungen → Profil", "Profil", "/app/profile"],
  ["Profil → Monday", "Monday", "/app/monday"],
]) {
  const messungen = [];
  for (let i = 0; i < 3; i++) {
    await page.goto(`${B}/app`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const t = Date.now();
    await page.getByRole("link", { name: beschriftung, exact: true }).first().click();
    await page.waitForURL((u) => u.pathname === ziel, { timeout: 20_000 }).catch(() => {});
    // Auf sichtbaren Inhalt warten, nicht nur auf die Adresse: die
    // Adresse wechselt sofort, die Seite ist damit noch nicht da.
    await page.locator("main h1, main h2").first().waitFor({ timeout: 20_000 }).catch(() => {});
    messungen.push(Date.now() - t);
  }
  messungen.sort((a, b) => a - b);
  console.log(`  ${name.padEnd(24)} ${messungen[1]}ms`);
}

await browser.close();
