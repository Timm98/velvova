import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAsDemo, registerFreshUser } from "./helpers.ts";

/**
 * Die durchsuchbare Auswahl auf „Sprache & Region".
 *
 * Vier native Auswahlfelder mit zusammen 1157 `<option>`-Elementen sind
 * hier zu vier Kombifeldern geworden, die ihre Liste im Browser aus
 * `Intl` bauen. Das spart gemessene 168 KB im Dokument — und genau
 * deshalb steht diese Datei hier: eine Auswahl, die schlank aussieht,
 * aber den Wert nicht mehr speichert, wäre eine Verschlechterung, die
 * niemand bemerkt, bis jemand seine Zeitzone sucht.
 *
 * Geprüft wird deshalb nicht die Optik, sondern die Kette bis zur
 * Datenbank: suchen, wählen, speichern, neu laden, wieder da.
 */

/**
 * Nur die Vorschläge des Kombifelds — nicht jede Option der Seite.
 *
 * `page.getByRole("option")` trifft auch die nativen `<option>`
 * -Elemente in den kleinen Auswahlfeldern daneben; sie tragen die Rolle
 * implizit. Bei 31 davon auf der Seite meldete `toHaveCount(1)`
 * prompt 32, und `.first()` zeigte auf ein Element in einem
 * geschlossenen `<select>`, das nie sichtbar wird.
 *
 * Der Fehler stammt aus dieser Datei, nicht aus dem Bauteil — aber er
 * ist genau die Sorte, die man einmal versteht und dreimal wiederholt.
 * Deshalb ein Helfer und keine fünf Einzelkorrekturen.
 */
function vorschlaege(page: import("@playwright/test").Page) {
  return page.getByRole("listbox").getByRole("option");
}

test.describe("Sprache & Region: durchsuchbare Auswahl", () => {
  /*
   * Ein frisches Konto je Prüfung, nicht die Demo-Person.
   *
   * Einer dieser Tests speichert Portugal, Auckland und Franken. Auf
   * der geteilten Person wäre das eine Änderung, die im nächsten Test
   * einer anderen Datei wieder auftaucht — als Währung, die nicht
   * stimmt, oder als Datum in der falschen Zeitzone. Solche
   * Abhängigkeiten sind später kaum aufzulösen, weil der Fehler nie
   * dort auftritt, wo er entsteht.
   */
  test.beforeEach(async ({ page }) => {
    await registerFreshUser(page);
    await page.goto("/app/settings/language-region");
  });

  test("schickt die Liste nicht mehr mit", async ({ page }) => {
    /*
     * Die Zahl ist die Aussage.
     *
     * Vorher: 1157 Optionen. Übrig bleiben die kleinen Auswahlfelder
     * (Sprachen, Entfernungseinheit), die von Hand kurz sind. Steigt
     * die Zahl wieder in die Hunderte, hat jemand ein Kombifeld gegen
     * ein natives Feld zurückgetauscht — und das soll auffallen.
     */
    expect(await page.locator("option").count()).toBeLessThan(60);
    expect(await page.locator('[role="combobox"]').count()).toBe(4);
  });

  test("zeigt den gespeicherten Wert als Namen, nicht als Code", async ({ page }) => {
    // „DE" statt „Deutschland" wäre das Zeichen dafür, dass der Server
    // den Namen nicht mitgibt und die Seite bis zur Hydration falsch
    // aussieht.
    await expect(page.locator("#country")).not.toHaveValue(/^[A-Z]{2}$/);
  });

  test("findet eine Zeitzone, die man im nativen Feld nur scrollend fände", async ({ page }) => {
    const feld = page.locator("#timezone");
    await feld.click();
    await feld.fill("auckl");

    const treffer = vorschlaege(page);
    await expect(treffer).toHaveCount(1);
    await expect(treffer.first()).toContainText("Pacific/Auckland");
  });

  test("speichert die Auswahl und hält sie über das Neuladen", async ({ page }) => {
    for (const [feldId, suche] of [
      ["timezone", "auckl"],
      ["country", "Portug"],
      ["currency", "Schweizer"],
    ] as const) {
      const feld = page.locator(`#${feldId}`);
      await feld.click();
      await feld.fill(suche);
      await expect(vorschlaege(page).first()).toBeVisible();
      await page.keyboard.press("Enter");
    }

    // Das versteckte Feld trägt den Code — das ist, was das Formular
    // abschickt, und nicht das, was auf dem Bildschirm steht.
    await expect(page.locator('input[name="timezone"]')).toHaveValue("Pacific/Auckland");
    await expect(page.locator('input[name="country"]')).toHaveValue("PT");
    await expect(page.locator('input[name="currency"]')).toHaveValue("CHF");

    await page.getByRole("button", { name: /speichern|sichern/i }).first().click();
    await page.waitForTimeout(1500);
    await page.reload();

    await expect(page.locator('input[name="timezone"]')).toHaveValue("Pacific/Auckland");
    await expect(page.locator('input[name="country"]')).toHaveValue("PT");
    await expect(page.locator('input[name="currency"]')).toHaveValue("CHF");
  });

  test("lässt sich ohne Maus bedienen", async ({ page }) => {
    const feld = page.locator("#country");
    await feld.click();
    await page.keyboard.type("Portug");
    await expect(vorschlaege(page).first()).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.locator('input[name="country"]')).toHaveValue("PT");

    // Escape schliesst, ohne zu wählen.
    await feld.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.locator('input[name="country"]')).toHaveValue("PT");
  });

  test("sagt, wenn es nichts gibt — und wenn es mehr gibt", async ({ page }) => {
    const feld = page.locator("#timezone");
    await feld.click();

    await feld.fill("zzzznichtsda");
    await expect(vorschlaege(page)).toHaveCount(0);
    await expect(page.locator('p[aria-live="polite"]').last()).toContainText("Kein Treffer");

    /*
     * Der wichtigere Fall: abgeschnitten, aber gesagt.
     *
     * Bei „a" passen über 300 Zeitzonen, gezeigt werden 60. Ohne diesen
     * Hinweis sähe die Liste vollständig aus, und wer seine Zeitzone
     * nicht unter den ersten 60 findet, hört auf zu suchen.
     */
    await feld.fill("a");
    await expect(vorschlaege(page)).toHaveCount(60);
    await expect(page.locator('p[aria-live="polite"]').last()).toContainText("weitere Treffer");
  });

  test("bleibt auch geöffnet ohne axe-Verstösse", async ({ page }) => {
    /*
     * Die geöffnete Liste ist der Zustand, den eine Seitenprüfung nicht
     * sieht — sie misst geschlossen. Genau dort standen beim ersten
     * Anlauf zwei Verstösse: die Hinweiszeilen lagen als `<li>` in der
     * `role="listbox"`, die nur `option`-Kinder haben darf.
     */
    await page.locator("#timezone").click();
    await expect(page.getByRole("listbox")).toBeVisible();

    const ergebnis = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const ernst = ergebnis.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(ernst.map((v) => `${v.id}: ${v.help} (${v.nodes.length}x)`)).toEqual([]);
  });
});

test.describe("Ninas Kopfzeile", () => {
  test("bleibt in einer Reihe", async ({ page }) => {
    /*
     * Vorher: 220 Pixel, zwei Reihen. Die drei Knöpfe massen zusammen
     * 677 Pixel in einer Spalte von 820 und brachen deshalb gemeinsam
     * um — ein Viertel des Fensters ging für Bedienelemente drauf,
     * bevor eine Nachricht zu sehen war.
     *
     * Geprüft wird die Ursache, nicht die Zahl: liegen alle Knöpfe auf
     * derselben Höhe, ist nichts umgebrochen. Eine reine Höhenprüfung
     * würde auch dann bestehen, wenn jemand die Kopfzeile stattdessen
     * abschneidet.
     */
    await loginAsDemo(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/nina");

    const kopf = page.locator("header").last();
    await expect(kopf).toBeVisible();

    const knöpfe = kopf.locator("button");
    const anzahl = await knöpfe.count();
    expect(anzahl).toBeGreaterThanOrEqual(3);

    const höhen = new Set<number>();
    for (let i = 0; i < anzahl; i++) {
      const box = await knöpfe.nth(i).boundingBox();
      if (box) höhen.add(Math.round(box.y));
    }
    expect(höhen.size, `Knöpfe verteilen sich auf ${höhen.size} Reihen`).toBe(1);

    const box = await kopf.boundingBox();
    expect(box!.height).toBeLessThan(190);
  });
});
