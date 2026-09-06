import { chromium } from "@playwright/test";

/**
 * Die neuen Filter über die Adresse — das ist die Stelle, an der sie
 * wirken müssen. Der Composer schreibt nur dorthin.
 */
const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-filter-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

const orte = async (adresse) => {
  await s.goto(`${BASIS}${adresse}`);
  await s.waitForLoadState("networkidle");
  const text = await s.locator("main").innerText();
  const zahl = text.match(/([\d.]+) passende/)?.[1] ?? "?";
  /* Die Ortszeilen aus den Karten — sie stehen nach dem Firmennamen. */
  const treffer = [...text.matchAll(/\n([A-ZÄÖÜ][\wäöüß.\- ]+, [A-ZÄÖÜ][\wäöüß.\- ]+)\n/g)]
    .map((m) => m[1]).slice(0, 5);
  return { zahl, treffer };
};

for (const [name, adresse] of [
  ["ohne Filter", "/app/jobs"],
  ["ort=Karlsruhe", "/app/jobs?ort=Karlsruhe"],
  ["ort=Karlsruhe genau", "/app/jobs?ort=Karlsruhe&ortGenau=1"],
  ["Vollzeit", "/app/jobs?arbeitszeit=vollzeit"],
  ["Teilzeit", "/app/jobs?arbeitszeit=teilzeit"],
  ["keine Schicht", "/app/jobs?schicht=0"],
]) {
  const r = await orte(adresse);
  console.log(`${name.padEnd(22)} ${String(r.zahl).padStart(7)} passend   ${r.treffer.slice(0,2).join(" | ").slice(0, 60)}`);
}
await b.close();
