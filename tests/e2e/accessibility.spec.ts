import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { demoPersonaVerfuegbar, loginAsDemo, setTheme } from "./helpers.ts";

/**
 * Barrierefreiheit.
 *
 * axe findet einen Teil der Verstoesse automatisch - nicht alle. Deshalb
 * stehen hier zusaetzlich Tastaturpruefungen, die axe nicht abdeckt:
 * Fokusreihenfolge, Sprungmarke, Bedienbarkeit ohne Maus.
 */

const PUBLIC_PAGES = [
  "/",
  "/how-it-works",
  "/methodology",
  "/security",
  "/privacy",
  "/login",
  "/register",
  /*
   * Die zweite Landingpage und die Kontowahl.
   *
   * `/for-business` trägt eigene Kopfzeile, eigene Farbflächen und
   * einen dunklen Abschnitt — also drei eigene Wege, Kontrast zu
   * verfehlen. Und `?absicht=unternehmen` schaltet auf der
   * Registrierung eine Weiche frei, die es sonst nicht gibt.
   */
  "/for-business",
  "/register?absicht=unternehmen",
];

/*
 * Das Länderband wird eigens geprüft.
 *
 * Es erscheint nur mit gesetzter Länderkopfzeile — die Seiten oben
 * sehen es also nie. Es hat aber eigene Farben auf lavendelfarbenem
 * Grund und ist damit eine eigene Gelegenheit, Kontrast zu verfehlen.
 */
const APP_PAGES = [
  "/app",
  "/app/nina",
  "/app/career",
  "/app/jobs",
  "/app/applications",
  "/app/settings",
  /*
   * Die Seiten, auf denen mit Geld gerechnet wird.
   *
   * Sie kamen später dazu und standen deshalb nicht in dieser Liste —
   * ein Kontrastfehler auf der Lebenshaltungsseite wäre unbemerkt
   * geblieben, obwohl die Prüfung nebenan lief. Der Vergleich ist eine
   * echte Tabelle mit Zeilenköpfen; gerade dort entscheidet die
   * Auszeichnung darüber, ob eine Zahl überhaupt zuzuordnen ist.
   */
  /*
   * Die Belegseite trägt vier Etiketten mit eigenen Farbtönen —
   * `beobachtet` auf grünem, `berichtet` auf lavendelfarbenem Grund.
   * Kleine Grossbuchstaben auf getöntem Grund sind genau die Stelle,
   * an der Kontrast verfehlt wird.
   */
  "/app/belege",
  /*
   * Die stellengebundene Probe.
   *
   * Sie hat eigene Antwortknöpfe mit `aria-pressed` und einen
   * Energie-Fieldset — beides Stellen, an denen ein Zustand leicht nur
   * über Farbe erkennbar wird.
   */
  "/app/proben",
  "/app/settings/gehalt",
  "/app/settings/lebenshaltung",
  "/app/jobs/vergleich",
  /*
   * Der Arbeitgeberbereich.
   *
   * Eigener Bereich, eigene Kopfzeile, eigene Formulare — und damit
   * eigene Wege, Kontrast und Beschriftung zu verfehlen. Ohne diese
   * Zeilen liefe die Prüfung an der halben Anwendung vorbei.
   *
   * `/business` leitet ohne Arbeitgeberkonto auf `/business/einrichten`
   * um; geprüft wird also die Seite, die ein neues Konto tatsächlich zu
   * sehen bekommt.
   */
  "/business",
  "/business/einrichten",
];

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

test.describe("axe: Länderband", () => {
  test("Der Hinweis für ein anderes Land hält die Kontraste", async ({ browser }) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: { "x-vercel-ip-country": "CH" },
    });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByText(/kein Steuerregelwerk/).first()).toBeVisible();

    const ergebnis = await new AxeBuilder({ page }).analyze();
    const serious = ergebnis.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}x)`),
      "Verstoesse auf / mit Länderband",
    ).toEqual([]);
    await ctx.close();
  });
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
  test("Die Sprungmarke ist der erste Fokus und funktioniert", async ({ page, isMobile }) => {
    // Auf einem Touchgeraet gibt es keine Tabulatortaste. Die Pruefung
    // gehoert auf Geraete mit Tastatur - dort laeuft sie auch.
    test.skip(!!isMobile, "Kein Tastaturfokus auf Touchgeraeten");
    await page.goto("/");
    await page.keyboard.press("Tab");

    // Ueber den Locator statt ueber activeElement.textContent: letzteres
    // liefert bei einem Container den gesamten Seitentext.
    const skipLink = page.locator("a.skip-link");
    await expect(skipLink).toBeFocused();

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
          // Visuell versteckte Elemente - Sprungmarke, sr-only - sind
          // keine Beruehrungsziele. Sie werden sichtbar, sobald sie den
          // Fokus bekommen, und dann gelten die Masse.
          if (el.classList.contains("skip-link") || el.classList.contains("sr-only")) return false;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;

          /*
           * Die Ausnahme fuer Links im Fliesstext.
           *
           * WCAG 2.5.8 nimmt Ziele ausdruecklich aus, die "in einem
           * Satz stehen oder deren Groesse durch die Zeilenhoehe des
           * umgebenden Textes bestimmt wird". Ein Wort mitten in einem
           * Absatz auf 24 Pixel Hoehe zu bringen, hiesse den Zeilenfall
           * aufzureissen — die Regel verlangt das Gegenteil.
           *
           * Ohne diese Ausnahme meldete die Pruefung jeden Textlink und
           * verleitete dazu, entweder den Satz zu zerstoeren oder die
           * Pruefung abzuschalten. Beides waere schlechter als die
           * Regel richtig zu lesen.
           */
          const imFliesstext =
            getComputedStyle(el).display === "inline" &&
            (el.parentElement?.textContent?.trim().length ?? 0) >
              (el.textContent?.trim().length ?? 0);
          if (imFliesstext) return false;

          // WCAG 2.2 AA verlangt mindestens 24x24 CSS-Pixel.
          return r.height < 24 || r.width < 24;
        })
        .map((el) => `${el.tagName}: ${el.textContent?.trim().slice(0, 30)}`);
    });

    expect(tooSmall).toEqual([]);
  });

  test("Zustaende sind nicht nur ueber Farbe erkennbar", async ({ page }) => {
    /*
     * Diese Pruefung braucht Daten, nicht nur eine Anmeldung.
     *
     * Ein frisch angelegtes Konto hat keine bestaetigten Belege — es
     * gibt dann schlicht nichts, dessen Zustand man pruefen koennte.
     * Alle anderen Pruefungen hier kommen mit irgendeinem angemeldeten
     * Menschen aus; diese eine nicht.
     *
     * Deshalb wird sie uebersprungen statt zu scheitern, und der Grund
     * steht im Text. Ein roter Balken, der nur "Seed fehlt" bedeutet,
     * gewoehnt einen daran, rote Balken zu ignorieren.
     */
    test.skip(
      !(await demoPersonaVerfuegbar(page)),
      "Braucht die Demo-Persona mit bestaetigten Belegen: pnpm db:seed",
    );

    await loginAsDemo(page);
    await page.goto("/app/career");

    // Bestaetigt und abgelehnt tragen Text, nicht nur eine Farbe oder
    // eine abgeblendete Darstellung.
    await expect(page.getByText("bestätigt").first()).toBeVisible();
  });
});
