import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * Screenshots der Landingpage in drei Breiten und beiden Farbmodi.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein eigenes Skript und nicht `screenshots.mjs`
 * ══════════════════════════════════════════════════════════════
 *
 * Das vorhandene Skript fotografiert die ganze Anwendung inklusive
 * angemeldeter Bereiche und schreibt nach `docs/screenshots/`. Hier
 * geht es um sechs Bilder einer einzigen Seite, zum Vergleichen vor
 * und nach einer Änderung.
 *
 * Ziel ist bewusst ausserhalb des Projekts: Bilder gehören nicht ins
 * Repository. Am 8. September 2026 machten 275 MB Bildschirmfotos drei
 * Viertel der Git-Historie aus, und der erste Push scheiterte daran.
 *
 * ══════════════════════════════════════════════════════════════
 * Wie das Thema gesetzt wird
 * ══════════════════════════════════════════════════════════════
 *
 * Nicht über `colorScheme` allein: Die Anwendung liest ihr Thema aus
 * `data-theme` am Wurzelelement, und die Systemeinstellung greift nur,
 * solange dort nichts steht. Wer nur die Systemvorgabe emuliert,
 * fotografiert damit den Zufallszustand.
 *
 * Deshalb beides — die Emulation für Medienabfragen und das Attribut
 * für die Tokens. So steht fest, welcher Modus im Bild ist.
 *
 * Aufruf: node scripts/landing-screenshots.mjs [port] [marke]
 */
const port = process.argv[2] ?? "3007";
const marke = process.argv[3] ?? "stand";
const ZIEL = `/tmp/velvova-screenshots/${marke}`;

const BREITEN = [
  { name: "mobil-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
const SEITEN = [
  { pfad: "/", name: "landing" },
  { pfad: "/how-it-works", name: "warum" },
  { pfad: "/product", name: "loesungen" },
];

await mkdir(ZIEL, { recursive: true });
const browser = await chromium.launch();
let n = 0;

for (const modus of ["light", "dark"]) {
  for (const b of BREITEN) {
    const kontext = await browser.newContext({
      viewport: { width: b.width, height: b.height },
      colorScheme: modus,
      deviceScaleFactor: 2,
    });
    const seite = await kontext.newPage();

    for (const s of SEITEN) {
      try {
        await seite.goto(`http://localhost:${port}${s.pfad}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        /* Das Attribut setzen, DANN warten: Der Wechsel läuft über
           CSS-Variablen, und ohne kurze Pause fotografiert man den
           halben Übergang. */
        await seite.evaluate((m) => {
          document.documentElement.dataset.theme = m;
          document.documentElement.dataset.themeMode = m;
        }, modus);
        await seite.waitForTimeout(1200);

        const datei = `${ZIEL}/${s.name}-${b.name}-${modus}.png`;
        await seite.screenshot({ path: datei, fullPage: false });
        n++;
        console.log(`  ${s.name.padEnd(10)} ${b.name.padEnd(13)} ${modus.padEnd(5)} ✓`);
      } catch (e) {
        console.log(`  ${s.name.padEnd(10)} ${b.name.padEnd(13)} ${modus.padEnd(5)} FEHLER ${String(e.message).slice(0, 50)}`);
      }
    }
    await kontext.close();
  }
}

await browser.close();
console.log(`\n  ${n} Bilder in ${ZIEL}`);
