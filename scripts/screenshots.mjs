import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * Bildschirmfotos in den drei geforderten Größen.
 *
 * Der Anmeldeweg läuft über die Entwicklungsroute, die die Sitzung im
 * Serverprozess anlegt — PGlite ist ein Einzelprozess, eine von außen
 * erzeugte Sitzung wäre für den laufenden Server unsichtbar.
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const LABEL = process.argv[2] ?? "aktuell";

const SCHEME = process.env.SCHEME === "light" ? "light" : "dark";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 1000 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
];

const PUBLIC_PAGES = [
  ["landing", "/"],
  ["product", "/product"],
  ["how-it-works", "/how-it-works"],
  ["login", "/login"],
  ["register", "/register"],
];

const APP_PAGES = [
  ["dashboard", "/app"],
  ["nina", "/app/monday"],
  ["jobs", "/app/jobs"],
  ["career", "/app/career"],
  ["documents", "/app/documents"],
  ["applications", "/app/applications"],
  ["settings", "/app/settings"],
  ["settings-language", "/app/settings/language-region"],
  ["settings-integrations", "/app/settings/integrations"],
];

const dir = `docs/screenshots/${LABEL}`;
await mkdir(dir, { recursive: true });

/**
 * Ein Bildschirmfoto, das auch bei sehr langen Seiten ankommt.
 *
 * Chrome bricht die Ganzseitenaufnahme ab einer bestimmten Höhe ab. Der
 * erste Lauf ist genau daran gescheitert — und zwar mit einem Abbruch
 * des ganzen Skripts, sodass die restlichen Seiten gar nicht erst
 * aufgenommen wurden. Ein Werkzeug, das wegen einer Seite alle anderen
 * verliert, ist im Zweifel das falsche Werkzeug.
 */
async function shoot(page, path, label) {
  try {
    await page.screenshot({ path, fullPage: true });
  } catch {
    await page.screenshot({ path });
    console.warn(`${label}: zu lang für eine Ganzseitenaufnahme, nur der sichtbare Bereich.`);
  }
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    colorScheme: SCHEME,
  });
  const page = await context.newPage();

  for (const [name, path] of PUBLIC_PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await shoot(page, `${dir}/${vp.name}--${name}.png`, `${vp.name} ${path}`);
  }

  const login = await page.goto(`${BASE}/api/dev/login`);
  if (login && login.ok()) {
    for (const [name, path] of APP_PAGES) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await shoot(page, `${dir}/${vp.name}--${name}.png`, `${vp.name} ${path}`);
    }
  } else {
    console.warn(`Anmeldung fehlgeschlagen (${login?.status()}) — App-Seiten übersprungen.`);
  }

  const jobLink = await page
    .goto(`${BASE}/app/jobs`, { waitUntil: "networkidle" })
    .then(() => page.locator("article h3 a").first().getAttribute("href"))
    .catch(() => null);

  if (jobLink) {
    await page.goto(`${BASE}${jobLink}`, { waitUntil: "networkidle" });
    await shoot(page, `${dir}/${vp.name}--job-detail.png`, `${vp.name} job-detail`);
  }

  await context.close();
  console.log(`${vp.name} fertig`);
}

await browser.close();
console.log(`Bildschirmfotos in ${dir}`);
