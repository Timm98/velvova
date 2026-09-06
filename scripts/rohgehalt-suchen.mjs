/**
 * Steckt in den Rohantworten Gehalt, das wir nicht auslesen? (§26)
 *
 * Die Frage vor jeder Ranking-Diskussion: Fehlt das Gehalt wirklich in
 * den Anzeigen — oder fehlt es nur bei uns, weil die Zuordnung ein Feld
 * übersieht?
 *
 * Sucht REKURSIV durch die gespeicherten Rohdaten, statt nach den
 * Feldnamen zu raten, die in einer Dokumentation stehen.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const MUSTER = /salary|salaer|gehalt|compensation|\bpay\b|pay_range|wage|verguetung|vergütung|entgelt|remuneration|income/i;

function suche(objekt, pfad = "", treffer = new Map(), tiefe = 0) {
  if (tiefe > 6 || objekt === null || typeof objekt !== "object") return treffer;
  for (const [k, v] of Object.entries(objekt)) {
    const p = pfad ? `${pfad}.${k}` : k;
    if (MUSTER.test(k)) {
      const leer = v === null || v === undefined || v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === "object" && v !== null && Object.values(v).every((x) => x === null));
      const eintrag = treffer.get(p) ?? { gesamt: 0, belegt: 0, beispiel: null };
      eintrag.gesamt++;
      if (!leer) { eintrag.belegt++; if (!eintrag.beispiel) eintrag.beispiel = JSON.stringify(v).slice(0, 60); }
      treffer.set(p, eintrag);
    }
    if (v && typeof v === "object") suche(v, p, treffer, tiefe + 1);
  }
  return treffer;
}

const db = await getDb();
const quellen = await db.execute(sql`
  SELECT s.display_name AS quelle, j.raw
  FROM jobs j JOIN job_sources s ON s.id = j.source_id
  WHERE j.raw IS NOT NULL AND j.raw::text <> '{}'`);

const proQuelle = new Map();
for (const z of (quellen.rows ?? quellen)) {
  if (!proQuelle.has(z.quelle)) proQuelle.set(z.quelle, { n: 0, treffer: new Map() });
  const e = proQuelle.get(z.quelle);
  e.n++;
  suche(z.raw, "", e.treffer);
}

for (const [quelle, e] of proQuelle) {
  console.log(`\n  ${quelle} — ${e.n} Rohdatensätze`);
  const sortiert = [...e.treffer.entries()].sort((a, b) => b[1].belegt - a[1].belegt);
  if (sortiert.length === 0) { console.log("    keine gehaltsartigen Felder"); continue; }
  for (const [pfad, t] of sortiert.slice(0, 10)) {
    const quote = Math.round((t.belegt / e.n) * 100);
    console.log(`    ${pfad.padEnd(34)} belegt in ${String(quote).padStart(3)} %  ${t.beispiel ?? ""}`);
  }
}
process.exit(0);
