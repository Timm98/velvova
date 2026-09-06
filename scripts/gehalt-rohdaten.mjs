import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Was die Anbieter wirklich zum Gehalt schicken.
 *
 * ── Warum das nicht im Adapter geprüft wird ───────────────────
 *
 * Ein Adapter liest die Felder, die jemand einmal gesehen hat. Genau
 * das war die Ursache des letzten Befunds: Die Bundesagentur schickt
 * `gehaltsspanneVon`, und im Adapter stand ein Kommentar, sie sende
 * „keinen Betrag". Der Kommentar war falsch, und niemand hat es
 * gemerkt, weil niemand in die Antwort geschaut hat.
 *
 * Also: rekursiv durch die ROHE Antwort, nach allem, was nach Gehalt
 * aussieht — ohne Rücksicht auf bekannte Feldnamen.
 *
 * KEINE SCHLÜSSEL IM PROTOKOLL. Ausgegeben werden Feldnamen und Werte,
 * nie Adressen mit Zugangsdaten.
 */

const MUSTER =
  /^(salary|salaries|salaryMin|salaryMax|salary_min|salary_max|salaryRange|salary_range|salaryText|salary_text|salaryCurrency|salaryPeriod|salary_currency|salary_period|compensation|comp|pay|payRange|pay_range|payment|estimatedSalary|estimated_salary|remuneration|wage|wages|gehalt|gehaltsspanne\w*|verguetung|vergütung|entgelt|lohn|min_amount|max_amount|amount|currency|period|interval)$/i;

/** Alles einsammeln, was nach Gehalt aussieht — beliebig tief. */
function felderSuchen(wert, pfad = "", treffer = [], tiefe = 0) {
  if (tiefe > 8 || wert === null || wert === undefined) return treffer;
  if (Array.isArray(wert)) {
    wert.slice(0, 3).forEach((w, i) => felderSuchen(w, `${pfad}[${i}]`, treffer, tiefe + 1));
    return treffer;
  }
  if (typeof wert !== "object") return treffer;

  for (const [k, v] of Object.entries(wert)) {
    const p = pfad ? `${pfad}.${k}` : k;
    if (MUSTER.test(k) && v !== null && v !== undefined && v !== "") {
      treffer.push({ feld: p, wert: typeof v === "object" ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120) });
    }
    /*
     * Auch Freitext durchsuchen.
     *
     * Viele Portale nennen das Gehalt nur im Beschreibungstext. Wer
     * ausschliesslich nach Feldnamen sucht, findet es nie — und schreibt
     * dann in den Adapter, der Anbieter liefere keines.
     */
    if (typeof v === "string" && v.length > 40) {
      const geld = /(\d{2}[.\s]?\d{3})\s*(?:–|-|bis)\s*(\d{2}[.\s]?\d{3})\s*(?:€|EUR|Euro)|(\d{2}[.\s]?\d{3})\s*(?:€|EUR|Euro)/i.exec(v);
      if (geld) treffer.push({ feld: `${p} (Text)`, wert: geld[0].slice(0, 60) });
    }
    felderSuchen(v, p, treffer, tiefe + 1);
  }
  return treffer;
}

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/*
 * Die gespeicherten Rohantworten, je Quelle.
 *
 * Sie liegen in `job_snapshots.raw_payload` — dafür ist die Tabelle da.
 * Ohne sie müsste dieses Skript die Anbieter erneut abfragen, und das
 * ginge auf deren Kontingent.
 */
const quellen = (await db.execute(sql`
  select s.display_name as quelle, count(*)::int as n
  from job_snapshots r
  join jobs j on j.id = r.job_id
  join job_sources s on s.id = j.source_id
  group by 1 order by n desc`)).rows;

if (quellen.length === 0) {
  console.log("Keine Rohantworten gespeichert — nichts zu prüfen.");
  process.exit(0);
}

console.log("Rohantworten je Quelle:");
for (const q of quellen) console.log(`  ${String(q.n).padStart(5)}  ${q.quelle}`);
console.log("");

for (const q of quellen) {
  const zeilen = (await db.execute(sql`
    select r.raw_payload as payload, j.title, j.salary_min, j.salary_max,
           j.salary_currency, j.salary_period, j.salary_provenance
    from job_snapshots r
    join jobs j on j.id = r.job_id
    join job_sources s on s.id = j.source_id
    where s.display_name = ${q.quelle}
      and r.raw_payload ? 'rohantwort'
    order by r.fetched_at desc
    limit 20`)).rows;

  let mitFeld = 0;
  let uebernommen = 0;
  const beispiele = [];

  for (const z of zeilen) {
    const roh = typeof z.payload === "string" ? JSON.parse(z.payload) : z.payload;
    const treffer = felderSuchen(roh);
    if (treffer.length > 0) mitFeld++;
    if (z.salary_min !== null || z.salary_max !== null) uebernommen++;
    if (treffer.length > 0 && z.salary_min === null && z.salary_max === null && beispiele.length < 3) {
      beispiele.push({ titel: (z.title ?? "?").slice(0, 46), treffer: treffer.slice(0, 5) });
    }
  }

  console.log(`── ${q.quelle} — ${zeilen.length} geprüft`);
  console.log(`   Rohantwort nennt etwas Gehaltsartiges: ${mitFeld}`);
  console.log(`   Bei uns gespeichert:                   ${uebernommen}`);
  if (beispiele.length > 0) {
    console.log(`   NICHT übernommen, obwohl in der Antwort:`);
    for (const b of beispiele) {
      console.log(`     „${b.titel}"`);
      for (const t of b.treffer) console.log(`        ${t.feld} = ${t.wert}`);
    }
  }
  console.log("");
}
process.exit(0);
