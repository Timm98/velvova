/**
 * Sind die Original-Links brauchbar?
 *
 * Eine Stichprobe, nicht der ganze Bestand: 1160 fremde Server
 * gleichzeitig abzurufen wäre eine Belastung, die niemand von uns
 * verlangt hat, und rechtlich fragwürdig. Zwei Stufen:
 *
 *   1. Form — ohne Netzzugriff, für ALLE Stellen. Fängt das meiste:
 *      fehlend, localhost, kein http, offensichtlich kaputt.
 *   2. Erreichbarkeit — für eine kleine Stichprobe, mit HEAD und
 *      Pause dazwischen.
 *
 *   node scripts/link-pruefung.mjs [stichprobe]
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const stichprobe = Number(process.argv[2] ?? 20);
const alle = (await db.execute(sql`select id, original_url, title from jobs`)).rows ?? [];

// ── Stufe 1: Form ───────────────────────────────────────────
const problem = { fehlt: 0, keinHttp: 0, lokal: 0, unparsbar: 0 };
const gut = [];
for (const z of alle) {
  const u = z.original_url;
  if (!u) { problem.fehlt++; continue; }
  let url;
  try { url = new URL(u); } catch { problem.unparsbar++; continue; }
  if (!/^https?:$/.test(url.protocol)) { problem.keinHttp++; continue; }
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname)) { problem.lokal++; continue; }
  gut.push({ ...z, host: url.hostname });
}

console.log(`══ Form (alle ${alle.length}) ══`);
console.log(`  formal brauchbar        ${gut.length}`);
console.log(`  ohne Link               ${problem.fehlt}`);
console.log(`  nicht http/https        ${problem.keinHttp}`);
console.log(`  localhost o. Ä.         ${problem.lokal}`);
console.log(`  nicht lesbar            ${problem.unparsbar}`);

const hosts = new Map();
for (const g of gut) hosts.set(g.host, (hosts.get(g.host) ?? 0) + 1);
console.log(`\n  Ziel-Hosts: ${[...hosts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([h,n])=>`${h} (${n})`).join(", ")}`);

// ── Stufe 2: Erreichbarkeit ─────────────────────────────────
const auswahl = [];
const proHost = new Map();
for (const g of gut.sort(() => 0.5 - Math.random())) {
  const n = proHost.get(g.host) ?? 0;
  // Höchstens 5 je Host — wir prüfen unsere Daten, nicht fremde Server.
  if (n >= 5) continue;
  proHost.set(g.host, n + 1);
  auswahl.push(g);
  if (auswahl.length >= stichprobe) break;
}

console.log(`\n══ Erreichbarkeit (${auswahl.length} Stichproben, höchstens 5 je Host) ══`);
const zaehler = { ok: 0, weiterleitung: 0, weg: 0, fehler: 0 };
for (const g of auswahl) {
  try {
    const r = await fetch(g.original_url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10000) });
    if (r.status >= 200 && r.status < 300) zaehler.ok++;
    else if (r.status >= 300 && r.status < 400) zaehler.weiterleitung++;
    else if (r.status === 404 || r.status === 410) { zaehler.weg++; console.log(`  ${r.status} ${String(g.title).slice(0,44)}`); }
    else zaehler.fehler++;
  } catch { zaehler.fehler++; }
  await new Promise((r) => setTimeout(r, 250));
}
console.log(`  erreichbar (2xx)        ${zaehler.ok}`);
console.log(`  Weiterleitung (3xx)     ${zaehler.weiterleitung}`);
console.log(`  weg (404/410)           ${zaehler.weg}`);
console.log(`  sonstiges/Zeitgrenze    ${zaehler.fehler}`);
process.exit(0);
