import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Exportierte Funktionen ohne Aufrufer.
 *
 * Das wiederkehrende Fehlermuster in diesem Bestand: Ein Schreiber
 * steht fertig im Code, mit Kommentar, und niemand ruft ihn auf. Die
 * Tabelle bleibt leer, und alles, was daran hängt, gibt still auf —
 * `persistMatch` war genau das.
 */
/*
 * Die Skripte gehören dazu.
 *
 * Ohne sie meldet der Scanner alles als tot, was nur von einem
 * Wartungslauf gerufen wird — `verlaufsbelegeSchreiben` etwa. Ein
 * Werkzeug, das Falschmeldungen produziert, wird nach der dritten
 * ignoriert, und dann findet es auch die echten nicht mehr.
 */
const wurzeln = ["apps/web/src", "packages", "scripts"];
const dateien = [];
function lauf(d) {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === "dist" || e === ".next") continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) lauf(p);
    else if (/\.(ts|tsx|mjs)$/.test(p) && !/\.test\.|\.d\.ts$/.test(p)) dateien.push(p);
  }
}
for (const w of wurzeln) lauf(w);

const inhalt = new Map(dateien.map((d) => [d, readFileSync(d, "utf8")]));
const alles = [...inhalt.values()].join("\n");

const treffer = [];
for (const [datei, text] of inhalt) {
  for (const m of text.matchAll(/^export (?:async )?function (\w+)/gm)) {
    const name = m[1];
    /* Next-Konventionen: Seiten, Layouts, Routen werden vom Rahmen gerufen. */
    if (/^(default|GET|POST|PUT|PATCH|DELETE|generateMetadata|generateStaticParams|middleware)$/.test(name)) continue;
    if (/page\.tsx|layout\.tsx|route\.ts|not-found|error\.tsx|loading\.tsx/.test(datei)) continue;
    const vorkommen = alles.split(new RegExp(`\\b${name}\\b`)).length - 1;
    /* 1 = nur die Definition selbst. */
    if (vorkommen <= 1) treffer.push([datei, name]);
  }
}
treffer.sort();
for (const [d, n] of treffer) console.log(n.padEnd(34), d);
console.log(`\n${treffer.length} exportierte Funktionen ohne jeden weiteren Verweis`);
