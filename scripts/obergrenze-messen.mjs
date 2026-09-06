import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie viele Stellen sind mit unserem Wortschatz überhaupt erreichbar?
 *
 * Nicht „wie viele gibt es" — das steht in der Kopfzahl der Quelle —
 * sondern: Wie viele davon kommen wir heran? Das ist eine andere Zahl,
 * denn beide Quellen begrenzen die Blättertiefe je Suchbegriff:
 *
 *   • Bundesagentur: 100 Seiten à 100 = 10.000 je Begriff (gemessen:
 *     Seite 100 antwortet, Seite 200 mit 400).
 *   • Adzuna: 100 Seiten à 50 = 5.000 je Begriff (gemessen: ab Seite
 *     120 wiederholen sich die Ergebnisse).
 *
 * Die Summe über alle Begriffe ist eine OBERGRENZE, keine Prognose:
 * Dieselbe Anzeige erscheint unter mehreren Berufen. Wie stark, sagt
 * erst der Import.
 */
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
const berufe = await berufsabfragen(400);
console.log(`Wortschatz: ${berufe.length} amtliche Berufsbezeichnungen\n`);

const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let summe = 0;
let erreichbar = 0;
let ueberDeckel = 0;
const DECKEL = 10_000;

for (const [i, b] of berufe.entries()) {
  const u = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?was=${encodeURIComponent(b)}&size=1&page=1`;
  const r = await fetch(u, { headers: K, signal: AbortSignal.timeout(20000) }).catch(() => null);
  await warte(150);
  if (!r?.ok) continue;
  const d = await r.json().catch(() => null);
  const n = d?.maxErgebnisse ?? 0;
  summe += n;
  erreichbar += Math.min(n, DECKEL);
  if (n > DECKEL) ueberDeckel++;
  if ((i + 1) % 40 === 0) process.stdout.write(`\r  ${i + 1}/${berufe.length} …`);
}

console.log(`\n\nBundesagentur, über ${berufe.length} Berufsbezeichnungen:`);
console.log(`  Treffer aufsummiert:        ${summe.toLocaleString("de-DE")}`);
console.log(`  davon erreichbar (Deckel):  ${erreichbar.toLocaleString("de-DE")}`);
console.log(`  Berufe über dem Deckel:     ${ueberDeckel}`);
console.log(`\n  Gesamtbestand der Jobbörse: 999.398`);
console.log(`  → Die Summe übersteigt den Gesamtbestand um das ${(summe / 999398).toFixed(1)}-fache.`);
console.log(`    Das ist die Überschneidung: dieselbe Anzeige zählt unter mehreren Berufen mit.`);
process.exit(0);
