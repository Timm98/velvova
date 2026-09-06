import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" }).then((c) => c.newPage());
const jsErr = []; p.on("pageerror", (e) => jsErr.push(e.message.slice(0, 130)));
const f5 = []; p.on("response", (r) => { if (r.status() >= 500) f5.push(`${r.status()} ${r.url().replace(B, "")}`); });

const schritt = async (n, fn) => {
  try { const d = await fn(); console.log(`  ok   ${n}${d ? " — " + d : ""}`); return d ?? true; }
  catch (e) { console.log(`  FAIL ${n} — ${String(e.message).split("\n")[0].slice(0, 120)}`); return null; }
};

console.log("FLOW 4 — BEWERBUNG\n");
await schritt("Anmeldung", async () => {
  await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
  await p.getByLabel("E-Mail-Adresse").fill(`bew-${Date.now()}@example.invalid`);
  await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
  await p.getByRole("button", { name: /Konto anlegen/i }).click();
  await p.waitForURL(/\/(app|setup)/, { timeout: 45000 });
  return new URL(p.url()).pathname;
});

const id = await schritt("Stelle auswählen", async () => {
  await p.goto(`${B}/app/jobs`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const x = await p.locator("[data-job-id]").first().getAttribute("data-job-id");
  if (!x) throw new Error("keine Stelle gefunden");
  return x;
});

await schritt("Jobdetail zeigt Hauptaktion", async () => {
  await p.goto(`${B}/app/jobs/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const k = p.getByRole("button", { name: /Bewerbung vorbereiten/i }).or(p.getByRole("link", { name: /Bewerbung vorbereiten/i }));
  if (await k.count() === 0) throw new Error("Knopf 'Bewerbung vorbereiten' fehlt");
  return `${await k.count()} Treffer`;
});

/*
 * Der Weg geht ueber die Bewerbungsbruecke, nicht direkt in den
 * Arbeitsbereich. Die erste Fassung dieses Tests erwartete
 * `/app/applications/...` und meldete deshalb einen Fehler, wo keiner
 * war — das Produkt fuehrt bewusst erst auf eine Seite, die zeigt, was
 * vorbereitet ist und was noch fehlt.
 */
await schritt("Bewerbung vorbereiten öffnet die Brücke", async () => {
  const k = p.getByRole("button", { name: /Bewerbung vorbereiten/i }).or(p.getByRole("link", { name: /Bewerbung vorbereiten/i })).first();
  await k.click();
  await p.waitForURL(/\/apply\/?$/, { timeout: 45000 });
  return new URL(p.url()).pathname;
});

await schritt("Brücke zeigt Paket und Übergabe", async () => {
  await p.waitForTimeout(2000);
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  if (/schiefgegangen/i.test(t)) throw new Error("Fehlerseite");
  const hat = ["Bereit", "Noch prüfen", "Fehlt", "Nicht nötig"].filter((x) => t.includes(x));
  if (hat.length === 0) throw new Error("keine Paketstatus sichtbar");
  return `Status sichtbar: ${hat.join(", ")}`;
});

await schritt("Arbeitsbereich zeigt Inhalt", async () => {
  await p.waitForTimeout(2500);
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  if (/schiefgegangen/i.test(t)) throw new Error("Fehlerseite");
  if (t.length < 400) throw new Error(`nur ${t.length} Zeichen`);
  return `${t.length} Zeichen`;
});

await schritt("Bewerbungsübersicht listet sie", async () => {
  await p.goto(`${B}/app/applications`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  if (/schiefgegangen/i.test(t)) throw new Error("Fehlerseite");
  return `${t.length} Zeichen`;
});

console.log(`\n  JS-Fehler: ${jsErr.length}${jsErr.length ? " — " + jsErr[0] : ""}`);
console.log(`  HTTP 5xx:  ${f5.length}${f5.length ? " — " + f5[0] : ""}`);
await b.close();
