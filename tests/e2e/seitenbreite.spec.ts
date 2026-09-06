import { test, expect } from "@playwright/test";

/**
 * Keine Seite rollt seitlich.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine eigene Prüfung braucht
 * ══════════════════════════════════════════════════════════════
 *
 * Seitliches Rollen entsteht fast nie absichtlich. Es entsteht aus
 * einer Rasterspalte ohne `minmax(0, …)`, aus einer festen Breite in
 * einem schmalen Fenster, aus einem langen Wort ohne Umbruch — und es
 * fällt beim Bauen nicht auf, weil man am breiten Bildschirm sitzt.
 *
 * Ein langer Stellentitel schob die Liste einmal auf 881 Pixel in
 * einem 390 Pixel breiten Fenster. Gemerkt hat es niemand, bis jemand
 * die Seite auf dem Telefon geöffnet hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nur öffentliche Seiten
 * ══════════════════════════════════════════════════════════════
 *
 * Die angemeldeten Seiten sind von hier aus nicht erreichbar: Der
 * Entwickler-Login braucht eine Demo-Person, die es nicht gibt, und
 * Produktionsdaten zu erzeugen ist untersagt. Die Prüfung deckt
 * deshalb ab, was sie abdecken kann — und behauptet nicht mehr.
 */

const SEITEN = ["/", "/product", "/for-business", "/how-it-works"];

/* Schmal, mittel, breit. Der Fehler zeigt sich meistens ganz unten
   oder ganz oben, selten dazwischen. */
const BREITEN = [390, 1024, 1760];

for (const pfad of SEITEN) {
  for (const breite of BREITEN) {
    test(`${pfad} rollt bei ${breite}px nicht seitlich`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 900 });
      await page.goto(pfad);
      await page.waitForLoadState("networkidle");

      const mass = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        fenster: window.innerWidth,
      }));

      /* Ein Pixel Toleranz: Unterpixel-Rundung bei Rahmen und
         Umrechnungen erzeugt gelegentlich 1440.4 statt 1440, und das
         ist kein Fehler, den jemand sieht. */
      expect(
        mass.scroll,
        `${pfad} bei ${breite}px: ${mass.scroll} statt ${mass.fenster}`,
      ).toBeLessThanOrEqual(mass.fenster + 1);
    });
  }
}
