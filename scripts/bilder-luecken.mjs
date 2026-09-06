import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Welche Berufshauptgruppen kein eigenes Motiv haben — und was daran hängt.
 *
 * Die Zahl der Stellen entscheidet, was zuerst fehlt. Eine Lücke bei
 * 40.000 Stellen wiegt anders als eine bei 300.
 */
const { FOTOS } = await import("../apps/web/src/lib/fotos.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const NAME = {
 "11":"Land-, Tier-, Forstwirtschaft","12":"Gartenbau, Floristik","21":"Rohstoffe, Glas, Keramik",
 "22":"Kunststoff, Holz","23":"Papier, Druck","24":"Metallerzeugung, -bearbeitung",
 "25":"Maschinen- und Fahrzeugtechnik","26":"Mechatronik, Energie, Elektro",
 "27":"Technische Entwicklung, Konstruktion","28":"Textil, Leder","29":"Lebensmittelherstellung",
 "31":"Bauplanung, Architektur, Vermessung","32":"Hoch- und Tiefbau","33":"Innenausbau",
 "34":"Gebäude- und Versorgungstechnik","41":"Mathematik, Biologie, Chemie, Physik",
 "42":"Geologie, Geografie, Umweltschutz","43":"Informatik, IuK-Technologie",
 "51":"Verkehr, Logistik (ohne Fahrzeugführung)","52":"Fahrzeug- und Transportgeräteführung",
 "53":"Schutz, Sicherheit, Überwachung","54":"Reinigung","61":"Einkauf, Vertrieb, Handel",
 "62":"Verkauf","63":"Tourismus, Hotel, Gastronomie","71":"Unternehmensführung, -organisation",
 "72":"Finanzen, Rechnungswesen, Steuern","73":"Recht und Verwaltung",
 "81":"Medizinische Gesundheitsberufe","82":"Körperpflege, Wellness, Medizintechnik",
 "83":"Erziehung, Soziales, Hauswirtschaft","84":"Lehrende und ausbildende Berufe",
 "91":"Geistes-, Gesellschafts-, Wirtschaftswissenschaften",
 "92":"Werbung, Marketing, Medien","93":"Produktdesign, Kunsthandwerk",
 "94":"Darstellende und unterhaltende Berufe",
};

const proHG = new Map();
for (const f of FOTOS) if (f.art === "beruf") for (const k of f.kldb)
  proHG.set(k, (proHG.get(k) ?? 0) + 1);

const zeilen = (await db.execute(sql`
  select left(j.kldb, 2) as hg, count(*)::int as n
  from jobs j
  where j.is_demo = false and j.kldb is not null
  group by 1 order by n desc`)).rows;

const gesamt = zeilen.reduce((a, z) => a + Number(z.n), 0);
console.log(`${gesamt.toLocaleString("de-DE")} Stellen mit amtlicher Kennung\n`);
console.log("HG  Berufshauptgruppe".padEnd(46), "Stellen".padStart(9), "Motive".padStart(7), "  Stellen je Motiv");
let ohne = 0;
for (const z of zeilen) {
  const hg = String(z.hg), n = Number(z.n), m = proHG.get(hg) ?? 0;
  if (m === 0) ohne += n;
  const warnung = m === 0 ? "  ← KEIN MOTIV" : n / m > 20000 ? "  ← zu wenige" : "";
  console.log(
    `${hg}  ${(NAME[hg] ?? "unbekannt").slice(0, 42).padEnd(42)} ${n.toLocaleString("de-DE").padStart(9)} ` +
    `${String(m).padStart(7)}   ${m ? Math.round(n/m).toLocaleString("de-DE") : "—"}${warnung}`);
}
console.log(`\nAn Hauptgruppen ohne eigenes Motiv hängen ${ohne.toLocaleString("de-DE")} Stellen (${(100*ohne/gesamt).toFixed(1)} %).`);
process.exit(0);
