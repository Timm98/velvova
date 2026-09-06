import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Titel des Bestands ihren amtlichen Berufen zuordnen — aufholend.
 *
 * ── Warum das dringend ist ────────────────────────────────────
 *
 * Gemessen: 39.356 Stellen, 22.294 verschiedene Titel, davon 1.625
 * zugeordnet. Für 93 % greift damit keine Gehaltsschätzung und keine
 * Entgelt-Referenz — also genau das, was die Rangfolge braucht.
 *
 * Der Worker holt 12 Titel je Viertelstunde nach. Das war richtig
 * bemessen für einen Bestand, der langsam wächst; für einen, der sich
 * an einem Tag verfünfzehnfacht, ist es zu langsam. 20.669 offene
 * Titel wären achtzehn Tage.
 *
 * ── Wie hier mit der Quelle umgegangen wird ───────────────────
 *
 * Je Titel eine Suchanfrage, keine Detailabrufe. Mehrere gleichzeitig,
 * mit Pause — und Abbruch bei 429 oder 5xx, ohne Nachfassen. Der Lauf
 * ist wiederaufnehmbar: Was zugeordnet ist, wird übersprungen.
 */
const { titelNormalisieren, haeufigsterBeruf, abfragestufen } = await import(
  "../packages/jobs/src/berufsregeln.ts"
);
const { KEIN_VOLLZEITVERGLEICH } = await import("../apps/web/src/lib/jobs/beschaeftigungsform.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const BASIS = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const KOPF = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const GLEICHZEITIG = Number(process.argv[3] ?? 4);
const PAUSE = 200;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let abbruch = false;
async function hol(url) {
  if (abbruch) return null;
  const a = await fetch(url, { headers: KOPF, signal: AbortSignal.timeout(25_000) }).catch(() => null);
  if (!a) return null;
  if (a.status === 429 || a.status >= 500) {
    console.error(`\nAbbruch: Jobbörse antwortete ${a.status}. Später fortsetzen.`);
    abbruch = true;
    return null;
  }
  return a.ok ? a.json().catch(() => null) : null;
}

/** Ein Titel, von genau nach allgemein, bis eine Stufe etwas hergibt. */
async function aufloesen(titel) {
  for (const stufe of abfragestufen(titel)) {
    const d = await hol(`${BASIS}/pc/v6/jobs?was=${encodeURIComponent(stufe)}&size=100&page=1`);
    if (abbruch) return null;
    const r = haeufigsterBeruf(d?.ergebnisliste ?? []);
    if (r.beruf) return r;
  }
  return { beruf: null, treffer: 0, gesamt: 0 };
}

const grenze = Number(process.argv[2] ?? 30000);

const roh = (await db.execute(sql`
  select distinct j.title from jobs j where j.is_demo = false`)).rows;
const bekannt = new Set(
  (await db.execute(sql`select titel from beruf_zuordnung`)).rows.map((r) => r.titel),
);

const offen = [];
const gesehen = new Set();
for (const r of roh) {
  const t = String(r.title ?? "");
  if (KEIN_VOLLZEITVERGLEICH.test(t)) continue;
  const n = titelNormalisieren(t);
  if (n.length < 3 || gesehen.has(n) || bekannt.has(n)) continue;
  gesehen.add(n);
  offen.push(n);
}
console.log(`${roh.length} Titel im Bestand · ${bekannt.size} zugeordnet · ${offen.length} offen`);
console.log(`Dieser Lauf: bis zu ${Math.min(grenze, offen.length)}, ${GLEICHZEITIG} gleichzeitig.\n`);

const arbeit = offen.slice(0, grenze);
let fertig = 0, gefunden = 0;
const t0 = Date.now();

for (let i = 0; i < arbeit.length && !abbruch; i += GLEICHZEITIG) {
  const buendel = arbeit.slice(i, i + GLEICHZEITIG);
  const ergebnisse = await Promise.all(buendel.map((t) => aufloesen(t).catch(() => null)));
  if (abbruch) break;

  const zeilen = [];
  for (const [k, t] of buendel.entries()) {
    const r = ergebnisse[k];
    if (!r) continue;
    if (r.beruf) gefunden++;
    zeilen.push(sql`(${t}, ${r.beruf}, ${r.treffer}, ${r.gesamt}, now())`);
    fertig++;
  }
  if (zeilen.length > 0) {
    await db.execute(sql`
      insert into beruf_zuordnung (titel, beruf, treffer, gesamt, gefragt_am)
      values ${sql.join(zeilen, sql`, `)}
      on conflict (titel) do update set beruf = excluded.beruf, treffer = excluded.treffer,
        gesamt = excluded.gesamt, gefragt_am = now()`);
  }
  await warte(PAUSE);

  if (fertig % 200 < GLEICHZEITIG) {
    const min = (Date.now() - t0) / 60000;
    const rate = fertig / Math.max(0.1, min);
    console.log(
      `  ${fertig}/${arbeit.length} · zugeordnet ${gefunden} (${(100 * gefunden / Math.max(1, fertig)).toFixed(0)} %) · ` +
        `${rate.toFixed(0)}/min · noch ~${((arbeit.length - fertig) / Math.max(1, rate)).toFixed(0)} min`,
    );
  }
}

console.log(`\nFertig: ${fertig} bearbeitet, ${gefunden} zugeordnet, ${((Date.now() - t0) / 60000).toFixed(1)} min.`);
process.exit(abbruch ? 1 : 0);
