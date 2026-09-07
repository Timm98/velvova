/**
 * Laden die Kernseiten — und wie lange brauchen sie?
 *
 * Im echten Browser, mit echtem Konto. Ein HTTP-200 sagt wenig: eine
 * Fehlerseite antwortet auch mit 200.
 *
 *   node scripts/seiten-pruefung.mjs [basis]
 */
import { chromium } from "@playwright/test";

const B = process.argv[2] ?? "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const jsFehler = [];
p.on("pageerror", (e) => jsFehler.push(e.message.slice(0, 120)));

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`seiten-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 40000 });

const SEITEN = [
  ["Landingpage", "/"],
  ["Heute", "/app"],
  ["Monday", "/app/monday"],
  ["Jobs", "/app/jobs"],
  ["Bewerbungen", "/app/applications"],
  ["Profil", "/app/profile"],
  ["Einstellungen", "/app/settings"],
  ["Abgleich & Bedingungen", "/app/settings/matching"],
];

let schlecht = 0;
for (const [name, pfad] of SEITEN) {
  jsFehler.length = 0;
  const t = Date.now();
  const r = await p.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" }).catch(() => null);
  await p.waitForLoadState("networkidle").catch(() => {});
  const ms = Date.now() - t;
  const text = await p.locator("body").innerText().catch(() => "");
  const kaputt = /schiefgegangen|Something went wrong|404|Seite nicht gefunden/i.test(text);
  const ok = r?.status() === 200 && !kaputt && text.length > 200;
  if (!ok) schlecht++;
  console.log(`  ${ok ? "ok " : "!! "} ${name.padEnd(24)} ${String(r?.status() ?? "—").padStart(3)} · ${String(ms).padStart(5)} ms · ${String(text.length).padStart(5)} Zeichen${jsFehler.length ? ` · JS: ${jsFehler[0]}` : ""}`);
}

// Jobdetail über die Liste
await p.goto(`${B}/app/jobs`, { waitUntil: "networkidle" });
const id = await p.locator("[data-job-id]").first().getAttribute("data-job-id").catch(() => null);
if (id) {
  const t = Date.now();
  const r = await p.goto(`${B}/app/jobs/${id}`, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle").catch(() => {});
  const text = await p.locator("body").innerText();
  const ok = r.status() === 200 && !/schiefgegangen/i.test(text);
  if (!ok) schlecht++;
  console.log(`  ${ok ? "ok " : "!! "} ${"Jobdetail".padEnd(24)} ${r.status()} · ${String(Date.now() - t).padStart(5)} ms`);
} else {
  schlecht++;
  console.log("  !!  Jobdetail                 keine Stelle in der Liste");
}

console.log(schlecht === 0 ? "\nAlle Kernseiten laden." : `\n${schlecht} Seite(n) mit Problem.`);
await b.close();
process.exit(schlecht === 0 ? 0 : 1);
