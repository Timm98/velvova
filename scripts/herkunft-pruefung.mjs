import { chromium } from "@playwright/test";

/**
 * Passt sich die Landingpage an das Land an — und bleibt korrigierbar?
 *
 * Geprüft wird mit gesetzter CDN-Kopfzeile, also genau so, wie es in
 * Betrieb ankommt. Ein Test, der stattdessen das Cookie setzt, prüfte
 * die halbe Kette.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

async function seite(header = {}) {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "de-DE",
    extraHTTPHeaders: header,
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  return p;
}
const text = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

// ── Ohne Kopfzeile: Deutschland, kein Band ───────────────────
let p = await seite();
await p.goto(`${B}/`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
let t = await text(p);
zeile(!/kein Steuerregelwerk/.test(t), "Ohne Länderkopfzeile: kein Einschränkungsband");
zeile(/rechnet mit deinen Steuerangaben/.test(t), "Das Netto-Versprechen steht");
zeile(/Angezeigt für Deutschland/.test(t), "Der Schalter im Fuss nennt das angenommene Land");
await p.context().close();

// ── Schweiz über die Vercel-Kopfzeile ────────────────────────
p = await seite({ "x-vercel-ip-country": "CH" });
await p.goto(`${B}/`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
t = await text(p);
zeile(/Schweiz/.test(t), "Die Schweiz wird erkannt");
zeile(/kein Steuerregelwerk/.test(t), "Das Band nennt die fehlende Nettorechnung");
zeile(!/rechnet mit deinen Steuerangaben/.test(t), "Das Netto-Versprechen steht dort NICHT");
zeile(/Beispiel nach deutschen Steuerregeln/.test(t), "Die Beispielrechnung wird eingeordnet");
zeile(/anhand deiner Verbindung angenommen/.test(t), "Es steht da, woher die Annahme stammt");
await p.context().close();

// ── Cloudflare-Kopfzeile, Land ohne alles ────────────────────
p = await seite({ "cf-ipcountry": "PT" });
await p.goto(`${B}/`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
t = await text(p);
zeile(/Portugal/.test(t), "Auch die Cloudflare-Kopfzeile wird gelesen");
zeile(/keine Stellenquellen/.test(t), "Sagt klar, dass die Suche hier nichts findet");
zeile(/eigene Stellenlinks/.test(t), "Und nennt trotzdem einen Weg");
await p.context().close();

// ── XX und T1 gelten nicht als Land ──────────────────────────
for (const [wert, was] of [["XX", "unbekannt"], ["T1", "Tor"]]) {
  p = await seite({ "cf-ipcountry": wert });
  await p.goto(`${B}/`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  const s = await text(p);
  zeile(!/kein Steuerregelwerk|keine Stellenquellen/.test(s), `„${wert}" (${was}) zählt nicht als Land`);
  await p.context().close();
}

// ── Die eigene Wahl schlägt die Kopfzeile ────────────────────
p = await seite({ "x-vercel-ip-country": "CH" });
await p.goto(`${B}/`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
await p.getByRole("link", { name: /Ich bin in Deutschland/ }).click();
await p.waitForURL(/localhost:3000\/$/, { timeout: 30000 });
await p.waitForTimeout(1200);
t = await text(p);
zeile(!/kein Steuerregelwerk/.test(t), "Nach der Wahl verschwindet das Band");
zeile(/rechnet mit deinen Steuerangaben/.test(t), "Und das Netto-Versprechen ist zurück");

await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
zeile(!/kein Steuerregelwerk/.test(await text(p)), "Die Wahl hält über das Neuladen");

// ── Und wieder zurück auf die Schweiz ────────────────────────
await p.getByRole("link", { name: /^Schweiz$/ }).first().click();
await p.waitForURL(/localhost:3000\/$/, { timeout: 30000 });
await p.waitForTimeout(1200);
t = await text(p);
zeile(/kein Steuerregelwerk/.test(t), "Der Schalter im Fuss stellt wieder um");
zeile(/von dir gewählt/.test(t), "Und sagt, dass es jetzt eine Wahl ist");
await p.context().close();

// ── Sprache als schwächster Hinweis ──────────────────────────
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-AT" });
const q = await ctx.newPage();
await q.goto(`${B}/`, { waitUntil: "domcontentloaded" });
await q.waitForTimeout(1500);
const s2 = (await q.locator("body").innerText()).replace(/\s+/g, " ");
zeile(/Österreich/.test(s2), "Ohne Kopfzeile greift die Spracheinstellung (de-AT)");
zeile(/aus deiner Spracheinstellung geschlossen/.test(s2), "Und benennt diese schwächere Quelle");
await ctx.close();

await b.close();
