import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`kar-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await p.goto(`${B}/app/monday`, { waitUntil: "networkidle" });
const feld = p.locator("textarea, input[type=text]").first();
await feld.waitFor({ timeout: 20000 });
await feld.fill("Ich arbeite seit drei Jahren im Lager und mache dort die Schichtplanung für zwölf Leute. Das Körperliche macht mich fertig.");
await p.keyboard.press("Enter");
await p.waitForTimeout(28000);
await p.goto(`${B}/app/career`, { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const knoepfe = await p.getByRole("button").all();
console.log(`  ${knoepfe.length} Knöpfe auf /app/career:`);
for (const k of knoepfe.slice(0, 14)) {
  const t = (await k.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const al = await k.getAttribute("aria-label");
  console.log(`    „${t || "(ohne Text)"}"${al ? ` · aria-label: ${al}` : ""}`);
}
await p.screenshot({ path: "artifacts/phase17/career.png", fullPage: true });
await b.close();
