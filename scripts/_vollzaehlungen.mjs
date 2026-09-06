import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Abfragen, die über die ganze Stellentabelle laufen.
 *
 * ── Warum das eine eigene Suche wert ist ──────────────────────
 *
 * Die Stellenseite antwortete mit 500, weil sie bei jedem Aufruf
 * `count(*)`, `count(distinct content_hash)` und ein gefiltertes
 * `count(*)` über 1,73 Mio. Zeilen rechnete. Der Kommentar daneben
 * hatte das Wachstum vorweggenommen und trotzdem niemanden gewarnt.
 *
 * Dieselbe Bombe kann anderswo liegen. Gesucht wird nach Zählungen
 * und Gruppierungen ohne einschränkende Bedingung.
 */
const wurzeln = ["apps/web/src", "packages"];
const dateien = [];
function lauf(d) {
  for (const e of readdirSync(d)) {
    if (["node_modules", "dist", ".next"].includes(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) lauf(p);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)) dateien.push(p);
  }
}
for (const w of wurzeln) lauf(w);

/* Grosse Tabellen: alles über hunderttausend Zeilen. */
const GROSS = ["jobs", "jobSnapshots", "jobSourceLinks", "jobRequirements", "companies", "berufZuordnung"];

const treffer = [];
for (const datei of dateien) {
  const text = readFileSync(datei, "utf8");
  const zeilen = text.split("\n");
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    const zaehlt = /\bcount\(\)|count\(\*\)|count\(distinct/i.test(z);
    if (!zaehlt) continue;
    /* Im Umkreis nachsehen, auf welche Tabelle sich das bezieht. */
    const umfeld = zeilen.slice(Math.max(0, i - 4), i + 12).join("\n");
    const tabelle = GROSS.find((t) => new RegExp(`schema\\.${t}\\b`).test(umfeld));
    if (!tabelle) continue;
    /* Eine Bedingung im Umfeld macht daraus keinen Volldurchlauf. */
    const eingeschraenkt = /\.where\(|where\s|eq\(|and\(|inArray\(/.test(umfeld);
    treffer.push([eingeschraenkt ? "eingeschränkt" : "VOLL        ", tabelle, `${datei}:${i + 1}`]);
  }
}
for (const [art, t, ort] of treffer) console.log(art, t.padEnd(16), ort);
console.log(`\n${treffer.filter((t) => t[0].startsWith("VOLL")).length} ohne Einschränkung von ${treffer.length}`);
