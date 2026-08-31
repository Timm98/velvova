import type { BrowserContext, Page } from "@playwright/test";

/**
 * Meldet einen Menschen an, damit die Tests hinter die Anmeldung kommen.
 *
 * Zwei Wege, in dieser Reihenfolge:
 *
 * 1. **Die Demo-Persona über `/api/dev/login`.** Der bequeme Weg, wenn
 *    der Seed geladen ist. Er führt bewusst über einen Endpunkt IM
 *    Serverprozess: bei PGlite, einer eingebetteten
 *    Einzelprozess-Datenbank, wäre eine von aussen angelegte Sitzung
 *    für den laufenden Server unsichtbar.
 *
 * 2. **Ein frisches Konto über das echte Formular.** Wenn der Endpunkt
 *    nicht antwortet — abgeschaltet, oder der Seed fehlt in dieser
 *    Datenbank.
 *
 * Der zweite Weg ist der Grund, warum es diese Funktion in dieser Form
 * gibt. Vorher hing die gesamte Testreihe hinter der Anmeldung an
 * einem einzigen Datensatz in einer einzigen Datenbank. Als das Projekt
 * von PGlite auf Supabase umzog, fiel dieser Datensatz weg — und
 * zehn Prüfungen meldeten „HTTP 404", also gar nichts. Sie liefen
 * monatelang nicht mehr, ohne dass es aussah wie ein Ausfall.
 *
 * Ein Test, der eine bestimmte Person BRAUCHT, muss das selbst
 * sicherstellen. Für alles andere — Kontraste, Fokus, Überschriften,
 * Berührungsziele — reicht irgendein angemeldeter Mensch, und ein
 * frisch angelegter ist der verlässlichste, den es gibt.
 */
export async function demoPersonaVerfuegbar(page: Page): Promise<boolean> {
  const antwort = await page.request.get("/api/dev/login");
  return antwort.status() < 400;
}

export async function loginAsDemo(page: Page): Promise<void> {
  // Echte Navigation statt API-Aufruf: nur so landet das Cookie
  // zuverlaessig im Browser-Kontext.
  const response = await page.goto("/api/dev/login");

  if (response && response.status() < 400) {
    await page.waitForURL(/\/app/);
    return;
  }

  await registerFreshUser(page);
}

/**
 * Legt ein Konto über das echte Formular an.
 *
 * Der Zeitstempel im Namen hält die Läufe auseinander; `.invalid` ist
 * die dafür reservierte Domain (RFC 2606) und kann niemandem gehören.
 */
export async function registerFreshUser(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.invalid`;

  await page.goto("/register");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
  await page.getByRole("button", { name: /Konto anlegen/i }).click();

  // Nach der Registrierung geht es in die Einrichtung oder direkt in
  // die Anwendung — beides ist angemeldet.
  await page.waitForURL(/\/(app|setup)/, { timeout: 30_000 });
  return email;
}

/** Setzt die Darstellung, ohne den Umschalter zu bedienen. */
export async function setTheme(context: BrowserContext, theme: "light" | "dark"): Promise<void> {
  await context.addCookies([
    { name: "paycheck_theme", value: theme, domain: "127.0.0.1", path: "/", sameSite: "Lax" },
  ]);
}

export async function setLocale(context: BrowserContext, locale: "de" | "en"): Promise<void> {
  await context.addCookies([
    { name: "paycheck_locale", value: locale, domain: "127.0.0.1", path: "/", sameSite: "Lax" },
  ]);
}

/**
 * Prueft, dass die Seite nicht seitlich ueberlaeuft. Breite Inhalte
 * duerfen in sich scrollen, die Seite selbst nicht.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scroll: doc.scrollWidth, client: doc.clientWidth };
  });
  if (overflow.scroll > overflow.client + 1) {
    throw new Error(
      `Die Seite laeuft seitlich ueber: ${overflow.scroll}px Inhalt bei ${overflow.client}px Breite.`,
    );
  }
}

/**
 * Die erste Stelle der Liste öffnen.
 *
 * Die Karte ist als Ganzes klickbar; der Titel ist der Anker. Ein Test,
 * der auf einen Knopf mit der Aufschrift "Ansehen" zeigt, bricht bei
 * jeder Textänderung — der Titel-Link ist die Struktur, nicht die
 * Formulierung.
 */
export async function openFirstJob(page: Page): Promise<void> {
  /*
   * Die Einzelseite direkt ansteuern.
   *
   * Der Weg ueber Klicks haengt an der Fensterbreite: unterhalb von
   * 1024 Pixeln gibt es kein Nebeneinander, und die rechte Spalte
   * erscheint erst nach einer ausdruecklichen Auswahl. Ein Test, der
   * das nachbaut, prueft am Ende das Layout statt der Seite.
   *
   * Die Kennung steht im Listeneintrag; von dort fuehrt die Route.
   */
  const id = await page.locator("[data-job-id]").first().getAttribute("data-job-id");
  if (!id) throw new Error("Kein Listeneintrag gefunden. Wurden Stellen geladen?");

  await page.goto(`/app/jobs/${id}`);
  await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/);
}

/** Waehlt die erste Stelle in der geteilten Ansicht aus. */
export async function selectFirstJob(page: Page): Promise<void> {
  await page.locator("[data-job-id] a").first().click();
  await page.waitForURL(/[?&]job=/);
}
