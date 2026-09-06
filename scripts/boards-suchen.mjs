import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Offene Arbeitgeber-Boards finden.
 *
 * ── Wozu ──────────────────────────────────────────────────────
 *
 * Greenhouse, Ashby, SmartRecruiters und Personio führen je
 * Arbeitgeber ein offenes Stellenverzeichnis — ohne Schlüssel, mit
 * Volltext und oft mit Gehalt. Das sind Arbeitgeber, die auf keinem
 * Portal ausschreiben; über Adzuna oder die Jobbörse erreichen wir sie
 * nie.
 *
 * Ein Verzeichnis der Kennungen gibt es nicht. Sie wird aus dem
 * Firmennamen geraten — gemessene Trefferquote 4 % bei Personio.
 *
 * ── Wie hier mit fremden Diensten umgegangen wird ─────────────
 *
 * Gewöhnliche Anfragen an eine öffentliche Adresse, mit Pause, ohne
 * Nachfassen. Jeder Versuch wird gespeichert — auch der erfolglose,
 * damit kein zweiter Lauf dieselben zehntausend Fehlversuche macht.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/boards-suchen.mjs [anzahl]
 */
const { boardkennungen } = await import("../packages/jobs/src/boardkennung.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Die Anbieter und wie man ihr Verzeichnis abruft.
 *
 * `zaehle` bekommt den Rumpf der Antwort und sagt, wie viele Stellen
 * darin stehen. Null heisst „kein Board" — ein leeres Board ist für
 * uns dasselbe wie keines.
 */
const ANBIETER = [
  {
    name: "personio",
    url: (k) => `https://${k}.jobs.personio.de/xml`,
    zaehle: (t) => (t.match(/<position>/g) ?? []).length,
  },
  {
    name: "greenhouse",
    url: (k) => `https://boards-api.greenhouse.io/v1/boards/${k}/jobs`,
    zaehle: (t) => {
      try { return JSON.parse(t).jobs?.length ?? 0; } catch { return 0; }
    },
  },
  {
    name: "ashby",
    url: (k) => `https://api.ashbyhq.com/posting-api/job-board/${k}`,
    zaehle: (t) => {
      try { return JSON.parse(t).jobs?.length ?? 0; } catch { return 0; }
    },
  },
];

const grenze = Number(process.argv[2] ?? 2000);

const firmen = (await db.execute(sql`
  select c.name, count(*)::int n from companies c
  join jobs j on j.company_id = c.id
  where j.is_demo = false
  group by c.name order by count(*) desc limit ${grenze * 2}`)).rows;

const bekannt = new Set(
  (await db.execute(sql`select anbieter || '|' || kennung as k from arbeitgeber_boards`)).rows.map((r) => r.k),
);

console.log(`${firmen.length} Arbeitgeber · ${bekannt.size} Kombinationen schon geprüft\n`);

let gefragt = 0, gefunden = 0, stellen = 0;
const t0 = Date.now();

for (const f of firmen) {
  if (gefragt >= grenze) break;
  for (const k of boardkennungen(f.name)) {
    for (const a of ANBIETER) {
      if (bekannt.has(`${a.name}|${k}`)) continue;
      if (gefragt >= grenze) break;

      const r = await fetch(a.url(k), {
        headers: { "User-Agent": "Paycheck/1.0", Accept: "application/json, application/xml" },
        signal: AbortSignal.timeout(12_000),
      }).catch(() => null);
      await warte(120);
      gefragt++;
      bekannt.add(`${a.name}|${k}`);

      const n = r?.ok ? a.zaehle(await r.text().catch(() => "")) : 0;
      if (n > 0) {
        gefunden++;
        stellen += n;
        console.log(`  ✓ ${a.name.padEnd(11)} ${k.padEnd(28)} ${String(n).padStart(4)} Stellen   (${String(f.name).slice(0, 30)})`);
      }
      await db.execute(sql`
        insert into arbeitgeber_boards (anbieter, kennung, firma, gefunden, stellen, gefragt_am)
        values (${a.name}, ${k}, ${f.name}, ${n > 0}, ${n}, now())
        on conflict (anbieter, kennung) do update
          set gefunden = excluded.gefunden, stellen = excluded.stellen, gefragt_am = now()`);
    }
  }
  if (gefragt % 300 < 3 && gefragt > 0) {
    const min = (Date.now() - t0) / 60000;
    console.log(`  … ${gefragt} geprüft · ${gefunden} Boards · ${stellen} Stellen · ${(gefragt/Math.max(0.1,min)).toFixed(0)}/min`);
  }
}

console.log(`\n${gefragt} Kennungen geprüft · ${gefunden} Boards gefunden · ${stellen} Stellen dahinter`);
console.log(`Trefferquote ${(100 * gefunden / Math.max(1, gefragt)).toFixed(1)} %`);
process.exit(0);
