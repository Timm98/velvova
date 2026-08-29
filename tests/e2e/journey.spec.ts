import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, loginAsDemo, setLocale, setTheme } from "./helpers.ts";

/**
 * Die Journey von der Landing Page bis zur Bewerbung.
 *
 * Diese Tests prüfen nicht, ob Knöpfe existieren, sondern ob sie etwas
 * tun - und ob die Zusagen des Produkts halten: kein Versand ohne
 * Freigabe, keine Empfehlungen ohne bestätigtes Profil, fehlende Angaben
 * als "nicht angegeben" statt als schlechter Wert.
 */

test.describe("Öffentlicher Bereich", () => {
  test("Landing Page erklärt das Produkt und bietet beide Einstiege", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Finde nicht irgendeinen Job");
    await expect(page.getByRole("link", { name: /sprechen/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /schreiben/i })).toBeVisible();

    // Keine erfundenen Belege: die Seite darf keine Erfolgsquoten behaupten.
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toMatch(/\d+\s*%\s*(mehr|höhere?)\s*(Erfolg|Einladungen|Interviews)/i);
    expect(body).not.toMatch(/über \d+\.?\d* (zufriedene )?(Nutzer|Kunden)/i);
  });

  test("Das gezeigte Match ist als Beispiel gekennzeichnet", async ({ page }) => {
    await page.goto("/");
    const matchCard = page.locator("text=Customer Success Manager").first().locator("xpath=ancestor::div[1]");
    await expect(page.getByText("Beispiel").first()).toBeVisible();
    void matchCard;
  });

  test("Methodik legt die Gewichte und die Grenzen offen", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByText(/keine Einstellungswahrscheinlichkeit/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grenzen" })).toBeVisible();
    await expect(page.getByText(/Unbekanntes ist neutral/i).first()).toBeVisible();
  });

  test("Datenschutz nennt den tatsächlichen Zustand der KI-Verarbeitung", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText(/kein externer KI-Anbieter verbunden/i)).toBeVisible();
  });

  test("Sicherheitsseite nennt offene Punkte", async ({ page }) => {
    await page.goto("/security");
    await expect(page.getByRole("heading", { name: /Was noch aussteht/i })).toBeVisible();
  });
});

test.describe("Registrierung und Anmeldung", () => {
  test("Registrierung weist ein zu kurzes Passwort am Feld zurück", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("E-Mail-Adresse").fill(`neu-${Date.now()}@example.invalid`);
    await page.getByLabel("Passwort").fill("kurz");
    await page.getByRole("button", { name: "Konto anlegen" }).click();

    // Der Browser blockt über minLength; das Formular bleibt stehen.
    await expect(page).toHaveURL(/\/register/);
  });

  test("Registrierung führt zum Consent-Schritt", async ({ page }) => {
    const email = `neu-${Date.now()}@example.invalid`;
    await page.goto("/register");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Passwort").fill("ein-langes-testpasswort");
    await page.getByRole("button", { name: "Konto anlegen" }).click();

    await expect(page).toHaveURL(/\/setup/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Bevor wir anfangen" })).toBeVisible();
  });

  test("Consent zeigt jede Einwilligung einzeln", async ({ page }) => {
    const email = `consent-${Date.now()}@example.invalid`;
    await page.goto("/register");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Passwort").fill("ein-langes-testpasswort");
    await page.getByRole("button", { name: "Konto anlegen" }).click();
    await page.waitForURL(/\/setup/, { timeout: 20_000 });

    // Fünf getrennte Einwilligungen, nicht ein Sammelhaken.
    for (const label of [
      "Karriereprofil erstellen",
      "Unterlagen auswerten",
      "Spracheingabe",
      "Transkript speichern",
      "Verarbeitung durch einen externen Anbieter",
    ]) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }

    // Ohne verbundenen Anbieter steht das auch so da.
    await expect(page.getByText(/kein externer Anbieter verbunden/i)).toBeVisible();
  });

  test("Ohne Anmeldung leitet die App zur Anmeldung", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Der Riegel vor personalisierten Jobs", () => {
  test("Ein frisches Konto sieht keine Jobempfehlungen", async ({ page }) => {
    const email = `gate-${Date.now()}@example.invalid`;
    await page.goto("/register");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Passwort").fill("ein-langes-testpasswort");
    await page.getByRole("button", { name: "Konto anlegen" }).click();
    await page.waitForURL(/\/setup/, { timeout: 20_000 });

    await page.goto("/app/jobs");
    await expect(page.getByText("Noch gesperrt")).toBeVisible();
    await expect(page.getByText(/Sonst wären es Zufallstreffer|Sonst waeren es Zufallstreffer/)).toBeVisible();
  });
});

test.describe("Angemeldet als Demo-Persona", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("Dashboard zeigt genau einen nächsten Schritt", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Dein nächster Schritt|Dein naechster Schritt/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bewerbungsfortschritt" })).toBeVisible();

    // Kein Gamification-Druck.
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toMatch(/Streak|Tagesziel|Serie von \d+ Tagen/i);
  });

  test("Demo-Daten sind als Demo gekennzeichnet", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByText("Demo-Modus").first()).toBeVisible();
    await expect(page.getByText(/Diese Daten sind erfunden/)).toBeVisible();
  });

  test("Jobliste zeigt fünf getrennte Bewertungen je Stelle", async ({ page }) => {
    await page.goto("/app/jobs");
    const firstCard = page.locator("li").filter({ hasText: "Warum sie passt" }).first();
    await expect(firstCard).toBeVisible();

    for (const label of ["Passung", "Sicherheit", "Jobqualität", "Entwicklung durch KI", "Vertrauen in die Anzeige"]) {
      await expect(firstCard.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test("Jede Stelle nennt einen Grund UND einen Vorbehalt", async ({ page }) => {
    await page.goto("/app/jobs");
    const reasons = await page.getByText("Warum sie passt:").count();
    const reservations = await page.getByText("Was du bedenken solltest:").count();
    expect(reasons).toBeGreaterThan(0);
    expect(reservations).toBe(reasons);
  });

  test("Fehlendes Gehalt erscheint als 'nicht angegeben', nicht als Null", async ({ page }) => {
    await page.goto("/app/jobs");
    await expect(page.getByText("Gehalt nicht angegeben").first()).toBeVisible();
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toMatch(/0,00\s*€|0 €\s*pro Jahr/);
  });

  test("Ausgeschlossene Stellen sind begründet einblendbar", async ({ page }) => {
    await page.goto("/app/jobs");
    await expect(page.getByText(/Stellen sind ausgeschlossen/)).toBeVisible();

    await page.getByRole("link", { name: /Ausgeschlossene Stellen anzeigen/ }).click();
    await expect(page.getByText("Ausgeschlossen wegen:").first()).toBeVisible();
  });

  test("Sortierung ändert die Reihenfolge tatsächlich", async ({ page }) => {
    await page.goto("/app/jobs");
    const firstBefore = await page.locator("h2").first().textContent();

    await page.getByRole("link", { name: "Höchstes Gehalt" }).click();
    await page.waitForURL(/sort=highest_salary/);
    const firstAfter = await page.locator("h2").first().textContent();

    // Bei den Seed-Daten unterscheiden sich beste Gesamtchance und höchstes Gehalt.
    expect(firstAfter).not.toBe(firstBefore);
  });

  test("Jobdetail trennt die Quellenarten sichtbar", async ({ page }) => {
    await page.goto("/app/jobs");
    await page.locator("a", { hasText: "Ansehen" }).first().click();
    await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/);

    await expect(page.getByText("Mitarbeiterstimmen").first()).toBeVisible();
    await expect(page.getByText("Kundenbewertungen").first()).toBeVisible();
    await expect(
      page.getByText(/Kundenurteile über den Standort|Kundenurteile ueber den Standort/),
    ).toBeVisible();
  });

  test("KI-Zusammenfassungen sind als solche gekennzeichnet", async ({ page }) => {
    await page.goto("/app/jobs");
    await page.locator("a", { hasText: "Ansehen" }).first().click();
    await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/);

    // Wo eine KI-Zusammenfassung erscheint, muss auch der Hinweis stehen,
    // dass sie von einem Sprachmodell stammt - nie das eine ohne das andere.
    const badges = await page.getByText("KI-Zusammenfassung").count();
    const notes = await page.getByText(/stammt von einem Sprachmodell/).count();
    expect(badges).toBeGreaterThan(0);
    expect(notes).toBeGreaterThanOrEqual(badges);
  });

  test("Jobdetail nennt Quelle und Abrufdatum", async ({ page }) => {
    await page.goto("/app/jobs");
    await page.locator("a", { hasText: "Ansehen" }).first().click();
    await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/);

    await expect(page.getByText("Zuletzt abgerufen")).toBeVisible();
    await expect(page.getByRole("link", { name: /Im Original öffnen|Im Original oeffnen/ }).first()).toBeVisible();
  });

  test("AI Transition nennt Aufgaben und Szenarien, keine Jahreszahl", async ({ page }) => {
    await page.goto("/app/jobs");
    await page.locator("a", { hasText: "Ansehen" }).first().click();
    await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/);

    await expect(page.getByRole("heading", { name: /Zukunft & KI/ })).toBeVisible();
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toMatch(/verschwindet in \d+ Jahren/i);
    expect(body).not.toMatch(/wird in \d+ Jahren ersetzt/i);
  });

  test("Profil zeigt bestätigte Fakten und offene Vermutungen getrennt", async ({ page }) => {
    await page.goto("/app/profile");
    await expect(page.getByRole("heading", { name: /Belegte Stärken|Belegte Staerken/ })).toBeVisible();
    await expect(page.getByText("Vermutung").first()).toBeVisible();
    await expect(page.getByText(/zählen sie nirgends/).first()).toBeVisible();
  });

  test("Eine Vermutung lässt sich ablehnen und zählt danach nicht mehr", async ({ page }) => {
    await page.goto("/app/profile");
    const rejectButton = page.getByRole("button", { name: "Stimmt nicht" }).first();
    await expect(rejectButton).toBeVisible();
    await rejectButton.click();

    await expect(page.getByRole("heading", { name: /Von dir abgelehnt/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Diese Aussagen bleiben sichtbar/)).toBeVisible();
  });

  test("Gespräch stellt eine Frage und erklärt, warum", async ({ page }) => {
    await page.goto("/app/nina");
    const button = page.getByRole("button", { name: /Warum diese Frage/ });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");

    const before = (await page.textContent("main")) ?? "";
    await button.click();

    // Die Zusage ist, dass eine Erklärung erscheint - nicht, welcher
    // Satz. Der Text hängt vom aktuellen Thema ab; ihn aufzuzählen
    // machte den Test zu einer Kopie der Anwendung.
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const after = (await page.textContent("main")) ?? "";
    expect(after.length).toBeGreaterThan(before.length + 20);
  });

  test("Fortschritt zählt Themen statt Prozente", async ({ page }) => {
    await page.goto("/app/nina");
    await expect(page.getByText(/von \d+ Themen verstanden/)).toBeVisible();
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toMatch(/Profil zu \d+ % vollständig/i);
  });

  test("Eine Antwort landet als unbestätigte Angabe im Profil", async ({ page }) => {
    await page.goto("/app/nina");
    const answer = `Testantwort ${Date.now()}: Ich habe zwei Jahre lang Kundenanfragen bearbeitet und dabei monatlich ausgewertet, woran es lag.`;
    await page.getByRole("textbox").first().fill(answer);
    await page.getByRole("button", { name: "Senden" }).click();

    await expect(page.getByText(answer.slice(0, 40), { exact: false }).first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/app/profile");
    await expect(page.getByText(answer.slice(0, 40), { exact: false }).first()).toBeVisible();
  });

  test("Application Hub zeigt die Pipeline und schweigt bei zu kleiner Stichprobe nicht fälschlich", async ({ page }) => {
    await page.goto("/app/applications");
    await expect(page.getByRole("heading", { name: "Deine Bewerbungen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Was deine Zahlen zeigen/ })).toBeVisible();

    // Die Diagnose muss ihre Grenzen benennen.
    await expect(page.getByText(/sagt deshalb nichts darüber aus|sagt nichts darueber aus/).first()).toBeVisible();
  });

  test("Studio sperrt die Freigabe bei unbelegter Aussage", async ({ page }) => {
    test.slow(); // Dokument erzeugen und jede Aussage pruefen dauert.
    await page.goto("/app/jobs");
    await page.locator("a", { hasText: "Ansehen" }).first().click();
    await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: "Bewerbung vorbereiten" }).click();
    await page.waitForURL(/\/app\/applications\/[0-9a-f-]{36}/, { timeout: 20_000 });

    await page.getByRole("button", { name: /Kurze Bewerbungs-E-Mail/ }).click();

    // Auf den INHALT des neuen Dokuments warten, nicht nur auf die
    // Rueckmeldung: die Meldung erscheint, bevor die Seite neu geladen
    // ist. Wer frueher tippt, tippt in den alten Editor, der beim
    // Eintreffen des neuen ersetzt wird - der Text waere weg.
    const editor = page.locator("#artifact");
    await expect(editor).toHaveValue(/Guten Tag/, { timeout: 30_000 });

    // Warten, bis das Neuladen nach der Erzeugung durch ist. Es landet
    // NACH der Erfolgsmeldung und setzt den Editor auf den Serverstand
    // zurück - eine vorher getippte Eingabe wäre weg.
    await page.waitForLoadState("networkidle");

    // Eine erfundene Kennzahl einfügen und speichern. Die Zahl wechselt
    // je Lauf: stünde derselbe Satz schon im Dokument, gäbe es nichts zu
    // speichern, und der Knopf bliebe zu Recht aus.
    const erfundeneZahl = 20 + (Date.now() % 60);
    const behauptung = `Ich habe den Umsatz meines Teams um ${erfundeneZahl} Prozent gesteigert.`;
    await editor.fill(behauptung);
    await expect(editor).toHaveValue(behauptung);

    // Erst wenn der Knopf freigeschaltet ist, klicken: er haengt am
    // Zustand "geaendert", und der wird erst nach dem Eingabeereignis
    // gesetzt.
    const save = page.getByRole("button", { name: "Speichern" });
    await expect(save).toBeEnabled({ timeout: 20_000 });
    await save.click();

    await expect(page.getByText("nicht belegt").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Dokument freigeben" })).toBeDisabled();
  });

  test("Ohne Freigabe gibt es keinen Versandknopf", async ({ page }) => {
    await page.goto("/app/applications");
    const first = page.locator("a").filter({ hasText: /Customer Success|Projektkoordination/ }).first();
    await first.click();
    await page.waitForURL(/\/app\/applications\/[0-9a-f-]{36}/);

    // Solange nichts freigegeben ist, erscheint der Versand gar nicht.
    await expect(page.getByRole("button", { name: "Jetzt senden" })).toHaveCount(0);
  });

  test("Coaching nennt zu jeder Frage ihre Herkunft", async ({ page }) => {
    await page.goto("/app/applications");
    await page.locator("a").filter({ hasText: /Customer Success/ }).first().click();
    await page.waitForURL(/\/app\/applications\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: /Gespräch vorbereiten|Gespraech vorbereiten/ }).click();
    await page.waitForURL(/\/app\/coaching\//);

    await expect(page.getByText(/Woher diese Frage kommt/)).toBeVisible();
    await expect(page.getByText(/Nicht deine Stimme, dein Gesicht/)).toBeVisible();
  });

  test("Privacy Center erlaubt Widerruf einzelner Einwilligungen", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { name: "Privacy Center" })).toBeVisible();

    // Bewusst zustandsunabhaengig: der aktuelle Wert wird gelesen,
    // umgeschaltet, geprueft und wiederhergestellt. Ein Test, der einen
    // bestimmten Ausgangszustand voraussetzt, bricht, sobald ein
    // frueherer Lauf ihn veraendert hat.
    // Der Schalter ist an den Serverzustand gebunden: der Klick loest
    // eine Aktion aus, und erst deren Ergebnis aendert die Anzeige.
    // Deshalb auf die sichtbare Folge warten, nicht auf den Klick.
    const row = page.locator("li").filter({ hasText: "Karriereprofil" }).first();
    const checkbox = row.getByRole("checkbox");
    const before = await checkbox.isChecked();

    await checkbox.click();
    await expect(row.getByText(before ? "nicht erteilt" : "erteilt", { exact: true })).toBeVisible({
      timeout: 25_000,
    });

    await checkbox.click();
    await expect(row.getByText(before ? "erteilt" : "nicht erteilt", { exact: true })).toBeVisible({
      timeout: 25_000,
    });
  });

  test("Kontolöschung verlangt eine Tippbestätigung", async ({ page }) => {
    await page.goto("/app/settings");
    const deleteButton = page.getByRole("button", { name: /Konto löschen|Konto loeschen/ });
    await expect(deleteButton).toBeDisabled();
  });

  test("Nicht verbundene Dienste erscheinen ehrlich als nicht verbunden", async ({ page }) => {
    await page.goto("/app/settings");
    const notConnected = await page.getByText("nicht verbunden").count();
    expect(notConnected).toBeGreaterThanOrEqual(3);
  });
});

test.describe("Sprache und Darstellung", () => {
  test("Englisch schaltet die Oberfläche vollständig um", async ({ page, context }) => {
    await setLocale(context, "en");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Don't find just any job");
    await expect(page.getByRole("link", { name: /Talk to/i })).toBeVisible();
  });

  test("Dunkle Darstellung greift serverseitig ohne Aufblitzen", async ({ page, context }) => {
    await setTheme(context, "dark");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Dunkler Grund, nicht der helle Standard.
    expect(bg).not.toBe("rgb(250, 248, 245)");
  });

  test("Systemdarstellung setzt kein Attribut", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  });
});

test.describe("Responsives Verhalten", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  for (const path of ["/", "/app", "/app/jobs", "/app/profile", "/app/applications"]) {
    test(`${path} läuft nicht seitlich über`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("Auf schmalen Geräten steht die Navigation unten", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Nur auf mobilen Geräten relevant");
    await page.goto("/app");
    const bottomNav = page.locator("nav.app-nav-bottom");
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("link")).toHaveCount(5);
  });
});
