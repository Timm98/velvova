import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Firmendaten holen und speichern.
 *
 * ── Warum es diesen Lauf gibt ─────────────────────────────────
 *
 * Die Spalten `industry`, `size_band` und `headquarters` gibt es seit
 * jeher in `companies`. Gefüllt waren sie bei **null von 134.221**
 * Firmen: Der Coresignal-Adapter war gebaut, aber nirgends
 * angeschlossen — sein einziger Verweis stand auf einer
 * Verwaltungsseite, die anzeigt, ob ein Schlüssel hinterlegt ist.
 *
 * ── Warum in dieser Reihenfolge ───────────────────────────────
 *
 * Die Firmen mit den meisten Stellen zuerst. Eine angereicherte Firma
 * wirkt auf alle ihre Anzeigen: Die 18.293 Arbeitgeber mit fünf oder
 * mehr Stellen decken rund 380.000 der 608.000 Stellen ab.
 *
 * ── Was das kostet ────────────────────────────────────────────
 *
 * Die Suche ist frei, jeder abgeholte Datensatz kostet zehn Einheiten.
 * Gemessen nach der Umstellung: 14,2 Einheiten je erfolgreichem
 * Treffer bei 38 % Trefferquote. Der Lauf hört auf, wenn das
 * vorgegebene Budget erreicht ist — nicht, wenn das Guthaben leer ist.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/firmen-anreichern.mjs [budget] [land]
 */
const { CoresignalEnrichment } = await import("../packages/jobs/src/sources/coresignal.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const budget = Number(process.argv[2] ?? 2000);
const land = process.argv[3] ?? "Germany";

async function guthaben() {
  const r = await fetch("https://api.coresignal.com/cdapi/v2/company_base/search/filter", {
    method: "POST",
    headers: { apikey: process.env.CORESIGNAL_API_KEY.trim(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Zzzzz" }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  return Number(r?.headers.get("x-credits-remaining") ?? NaN);
}

const offen = (await db.execute(sql`
  select c.id, c.name, count(j.id)::int stellen
  from companies c join jobs j on j.company_id = c.id
  where j.is_demo = false and c.angereichert_am is null
  group by c.id, c.name
  order by count(j.id) desc
  limit 4000`)).rows;

const start = await guthaben();
console.log(`Guthaben: ${start} · Budget für diesen Lauf: ${budget} Einheiten`);
console.log(`${offen.length} Firmen ohne Anreicherung, die mit den meisten Stellen zuerst.\n`);

const cs = new CoresignalEnrichment({ land });
let gefragt = 0, gefunden = 0, stellenAbgedeckt = 0;
const t0 = Date.now();

for (const f of offen) {
  const jetzt = await guthaben();
  if (start - jetzt >= budget) {
    console.log(`\nBudget aufgebraucht (${start - jetzt} Einheiten).`);
    break;
  }

  const d = await cs.unternehmen(f.name).catch(() => null);
  gefragt++;

  /*
   * Auch ein Misserfolg wird vermerkt.
   *
   * 62 % der Firmen lassen sich nicht zuordnen. Ohne diesen Eintrag
   * versuchte der nächste Lauf dieselben erneut — bei 134.221 Firmen
   * wären das zehntausende Einheiten für nichts.
   */
  await db.execute(sql`
    update companies set
      angereichert_am = now(),
      website = coalesce(${d?.website ?? null}, website),
      industry = coalesce(${d?.branche ?? null}, industry),
      size_band = coalesce(${d?.groesse ?? null}, size_band),
      mitarbeiter = coalesce(${d?.groesse ?? null}, mitarbeiter),
      headquarters = coalesce(${d?.hauptsitz ?? null}, headquarters),
      gegruendet = coalesce(${d?.gegruendet ?? null}, gegruendet)
    where id = ${f.id}`);

  if (d) {
    gefunden++;
    stellenAbgedeckt += f.stellen;
  }
  if (gefragt % 50 === 0) {
    const verbraucht = start - (await guthaben());
    console.log(
      `  ${gefragt} gefragt · ${gefunden} zugeordnet (${(100 * gefunden / gefragt).toFixed(0)} %) · ` +
        `${verbraucht} Einheiten · ${stellenAbgedeckt} Stellen abgedeckt · ${((Date.now() - t0) / 60000).toFixed(1)} min`,
    );
  }
}

const ende = await guthaben();
console.log(`\n${gefragt} Firmen gefragt · ${gefunden} zugeordnet · ${stellenAbgedeckt} Stellen abgedeckt`);
console.log(`Verbraucht: ${start - ende} Einheiten · Guthaben jetzt ${ende}`);
console.log(`Je Treffer: ${gefunden ? ((start - ende) / gefunden).toFixed(1) : "—"} Einheiten`);
process.exit(0);
