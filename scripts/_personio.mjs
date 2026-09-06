import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie viele unserer Arbeitgeber haben ein öffentliches Personio-Board?
 *
 * Personio ist das verbreitetste Bewerbermanagement im deutschen
 * Mittelstand, und jedes Board hat einen offenen XML-Feed unter
 * `{kennung}.jobs.personio.de/xml`. Nur: Eine Liste der Kennungen gibt
 * es nicht.
 *
 * Aus dem Firmennamen lässt sich eine raten. Ob sich das lohnt,
 * entscheidet die Trefferquote — deshalb erst eine Stichprobe von
 * fünfzig, mit Pause, statt vierzigtausend Anfragen auf Verdacht.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/** Aus „Muster Technik GmbH & Co. KG" wird „muster-technik". */
function kennung(name) {
  return String(name)
    .toLowerCase()
    .replace(/\b(gmbh|mbh|ag|kg|ohg|se|e\.?\s?v\.?|co\.?|und|&|ug|haftungsbeschränkt|inh\.?)\b/g, " ")
    .replace(/[^a-zäöüß0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .split("-").filter(Boolean).slice(0, 3).join("-");
}

const firmen = (await db.execute(sql`
  select c.name from companies c
  join jobs j on j.company_id = c.id
  where j.is_demo = false and j.country in ('DE','AT','CH')
  group by c.name order by random() limit 50`)).rows;

let treffer = 0, stellen = 0;
for (const f of firmen) {
  const k = kennung(f.name);
  if (k.length < 3) continue;
  const r = await fetch(`https://${k}.jobs.personio.de/xml`, {
    headers: { "User-Agent": "Paycheck/1.0" }, signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  await warte(400);
  if (!r?.ok) continue;
  const t = await r.text().catch(() => "");
  const n = (t.match(/<position>/g) ?? []).length;
  if (n > 0) {
    treffer++;
    stellen += n;
    console.log(`  ✓ ${String(f.name).slice(0, 38).padEnd(40)} → ${k} · ${n} Stellen`);
  }
}
console.log(`\n${treffer} von ${firmen.length} Firmen haben ein Board · ${stellen} Stellen`);
console.log(`Trefferquote ${(100 * treffer / firmen.length).toFixed(0)} % · Ø ${treffer ? (stellen/treffer).toFixed(0) : 0} Stellen je Board`);
console.log(`Hochgerechnet auf 40.713 Arbeitgeber: ~${Math.round(40713 * treffer / firmen.length).toLocaleString("de-DE")} Boards, ~${Math.round(40713 * stellen / firmen.length).toLocaleString("de-DE")} Stellen`);
process.exit(0);
