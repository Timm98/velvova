/**
 * Blättert die Jobliste zuverlässig?
 *
 * Drei Fragen, und alle drei sind nur an echten Seiten zu beantworten:
 * kommt auf Seite 2 etwas anderes als auf Seite 1, verschwindet nichts,
 * und bleibt die Reihenfolge stabil.
 *
 *   node scripts/blaettern-pruefung.mjs
 */
import { chromium } from "@playwright/test";
const B = process.argv[2] ?? "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 } }).then((c) => c.newPage());

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`blatt-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 40000 });

const seiten = [];
for (const n of [1, 2, 3]) {
  const t = Date.now();
  await p.goto(`${B}/app/jobs?seite=${n}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const ids = await p.locator("[data-job-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job-id")));
  seiten.push({ n, ids, ms: Date.now() - t });
  console.log(`  Seite ${n}: ${String(ids.length).padStart(3)} Stellen · ${Date.now() - t} ms`);
}

let fehler = 0;
const [s1, s2, s3] = seiten;

// 1. Jede Seite hat Inhalt.
for (const s of seiten) if (s.ids.length === 0) { console.log(`  !! Seite ${s.n} ist leer`); fehler++; }

// 2. Keine Überschneidung zwischen den Seiten.
for (const [a, c] of [[s1, s2], [s2, s3], [s1, s3]]) {
  const doppelt = a.ids.filter((i) => c.ids.includes(i));
  if (doppelt.length > 0) { console.log(`  !! Seite ${a.n} und ${c.n} teilen ${doppelt.length} Stellen`); fehler++; }
}

// 3. Stabil: dieselbe Seite zweimal ergibt dieselbe Reihenfolge.
await p.goto(`${B}/app/jobs?seite=2`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const nochmal = await p.locator("[data-job-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job-id")));
if (JSON.stringify(nochmal) !== JSON.stringify(s2.ids)) { console.log("  !! Seite 2 zeigt beim zweiten Aufruf etwas anderes"); fehler++; }
else console.log("  ok Seite 2 ist beim zweiten Aufruf identisch");

// 4. Insgesamt eindeutig.
const alle = seiten.flatMap((s) => s.ids);
console.log(`  ${alle.length} Stellen über 3 Seiten · ${new Set(alle).size} davon eindeutig`);
if (new Set(alle).size !== alle.length) fehler++;

console.log(fehler === 0 ? "\nBlättern funktioniert." : `\n${fehler} Problem(e) beim Blättern.`);
await b.close();
process.exit(fehler === 0 ? 0 : 1);
