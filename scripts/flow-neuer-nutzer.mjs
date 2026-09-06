import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
const p = await ctx.newPage();
const jsErr = [];
p.on("pageerror", (e) => jsErr.push(e.message.slice(0, 120)));
const http = [];
p.on("response", (r) => { if (r.status() >= 500) http.push(`${r.status()} ${r.url().replace(B, "")}`); });

const schritt = async (name, fn) => {
  try { const d = await fn(); console.log(`  ok   ${name}${d ? " — " + d : ""}`); return true; }
  catch (e) { console.log(`  FAIL ${name} — ${String(e.message).split("\n")[0].slice(0, 110)}`); return false; }
};

const mail = `flow1-${Date.now()}@example.invalid`;
console.log("FLOW 1 — NEW USER\n");

await schritt("Registrierung", async () => {
  await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
  await p.getByLabel("E-Mail-Adresse").fill(mail);
  await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
  await p.getByRole("button", { name: /Konto anlegen/i }).click();
  await p.waitForURL(/\/(app|setup)/, { timeout: 45000 });
  return new URL(p.url()).pathname;
});

await schritt("Nina-Seite erreichbar", async () => {
  await p.goto(`${B}/app/nina`, { waitUntil: "networkidle" });
  const t = await p.locator("body").innerText();
  if (/schiefgegangen|Fehler/i.test(t.slice(0, 400))) throw new Error("Fehlerseite");
  return `${t.replace(/\s+/g, " ").length} Zeichen Text`;
});

await schritt("Nachricht an Nina absendbar", async () => {
  const feld = p.locator("textarea, input[type=text]").first();
  await feld.waitFor({ timeout: 15000 });
  await feld.fill("Ich arbeite im Lager, aber das Koerperliche macht mich fertig. Mit Kunden komme ich gut klar und ich mache oft die Schichtplanung.");
  await p.keyboard.press("Enter");
  return "gesendet";
});

await schritt("Nina antwortet", async () => {
  await p.waitForTimeout(30000);
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  if (t.length < 300) throw new Error("kaum Text auf der Seite");
  if (/konnte gerade nicht|nicht erreichbar|schiefgegangen/i.test(t)) throw new Error("Fehlermeldung sichtbar");
  return `${t.length} Zeichen`;
});

await schritt("Jobs-Seite zeigt echte Stellen", async () => {
  await p.goto(`${B}/app/jobs`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const n = await p.locator("[data-job-id]").count();
  if (n === 0) throw new Error("0 Stellen in der Liste");
  return `${n} Stellen`;
});

await schritt("Jobdetail öffnet", async () => {
  const id = await p.locator("[data-job-id]").first().getAttribute("data-job-id");
  await p.goto(`${B}/app/jobs/${id}`, { waitUntil: "networkidle" });
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  if (/schiefgegangen/i.test(t)) throw new Error("Fehlerseite");
  return `${t.slice(0, 60)}…`;
});

await schritt("Begründung sichtbar (Phase 3)", async () => {
  const t = (await p.locator("body").innerText()).toLowerCase();
  if (!/warum|dafür spricht|passung/.test(t)) throw new Error("keine Match-Erklaerung gefunden");
  return "vorhanden";
});

console.log(`\n  JS-Fehler: ${jsErr.length}${jsErr.length ? " — " + jsErr[0] : ""}`);
console.log(`  HTTP 5xx:  ${http.length}${http.length ? " — " + http[0] : ""}`);
await b.close();
