import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAsDemo, setTheme } from "./helpers.ts";

/**
 * Barrierefreiheit.
 *
 * axe findet einen Teil der Verstoesse automatisch - nicht alle. Deshalb
 * stehen hier zusaetzlich Tastaturpruefungen, die axe nicht abdeckt:
 * Fokusreihenfolge, Sprungmarke, Bedienbarkeit ohne Maus.
 */

const PUBLIC_PAGES = ["/", "/how-it-works", "/methodology", "/security", "/privacy", "/login", "/register"];
const APP_PAGES = ["/app", "/app/nina", "/app/profile", "/app/jobs", "/app/applications", "/app/settings"];

test.describe("axe: oeffentliche Seiten", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} ohne Verstoesse`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}x)`),
        `Verstoesse auf ${path}`,
      ).toEqual([]);
    });
  }
});

test.describe("axe: App-Seiten", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  for (const path of APP_PAGES) {
    test(`${path} ohne Verstoesse`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}x)`),
        `Verstoesse auf ${path}`,
      ).toEqual([]);
    });
  }
});

test.describe("axe im dunklen Modus", () => {
  test("Kontraste halten auch dunkel", async ({ page, context }) => {
    await setTheme(context, "dark");
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
    const contrast = results.violations.filter((v) => v.id === "color-contrast");
    expect(contrast.map((v) => `${v.nodes.length} Elemente`)).toEqual([]);
  });
});

test.describe("Tastaturbedienung", () => {
  test("Die Sprungmarke ist der erste Fokus und funktioniert", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focused).toMatch(/Zum Inhalt springen/);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#inhalt/);
  });

  test("Die Anmeldung ist vollstaendig ohne Maus bedienbar", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("E-Mail-Adresse").first().focus();
    await page.keyboard.type("lea.demo@example.invalid");
    await page.keyboard.press("Tab");
    await page.keyboard.type("falsches-passwort-hier");

    const active = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type);
    expect(active).toBe("password");
  });

  test("Fokus ist sichtbar, nicht entfernt", async ({ page }) => {
    await page.goto("/login");
    const field = page.getByLabel("E-Mail-Adresse").first();
    await field.focus();

    const outline = await field.evaluate((el) => {
      const s = getComputedStyle(el, ":focus-visible");
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    // Der Fokusring darf nirgends auf "none" gesetzt sein.
    expect(outline.style).not.toBe("none");
  });

  test("Ueberschriften bilden eine sinnvolle Hierarchie", async ({ page }) => {
    await loginAsDemo(page);
    await page.goto("/app/jobs");

    const levels = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => Number(h.tagName[1])),
    );

    expect(levels.filter((l) => l === 1).length, "genau eine h1").toBe(1);
    // Keine uebersprungene Ebene.
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!, `Sprung bei Position ${i}`).toBeLessThanOrEqual(1);
    }
  });

  test("Beruehrungsziele sind gross genug", async ({ page }) => {
    await loginAsDemo(page);
    await page.goto("/app/jobs");

    const tooSmall = await page.evaluate(() => {
      const targets = [...document.querySelectorAll("button, a[href], input[type=checkbox]")];
      return targets
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          // WCAG 2.2 AA verlangt mindestens 24x24 CSS-Pixel.
          return r.height < 24 || r.width < 24;
        })
        .map((el) => `${el.tagName}: ${el.textContent?.trim().slice(0, 30)}`);
    });

    expect(tooSmall).toEqual([]);
  });

  test("Zustaende sind nicht nur ueber Farbe erkennbar", async ({ page }) => {
    await loginAsDemo(page);
    await page.goto("/app/profile");

    // Bestaetigt und abgelehnt tragen Text, nicht nur eine Farbe oder
    // eine abgeblendete Darstellung.
    await expect(page.getByText("bestätigt").first()).toBeVisible();
  });
});
