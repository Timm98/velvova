/**
 * Zeigt Schlüsselnamen und ob sie gesetzt sind — nie den Wert.
 *
 * Zweimal in einer Sitzung habe ich beim Nachsehen in `.env.local`
 * Werte mitausgegeben (Findwork, dann EURES). Beide mussten deshalb
 * neu erzeugt werden. Ein `grep` auf diese Datei ist kein Werkzeug,
 * sondern ein Leck; dieses Skript ist der Ersatz.
 *
 * Aufruf: node --experimental-strip-types scripts/env-zeigen.mjs [muster]
 */
import { readFileSync } from "node:fs";

const muster = process.argv[2];
const zeilen = readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n");

for (const [i, z] of zeilen.entries()) {
  const t = z.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!t) continue;
  const [, name, wert] = t;
  if (muster && !name.toLowerCase().includes(muster.toLowerCase())) continue;
  const w = wert.trim().replace(/^["']|["']$/g, "");
  const stand = w === "" ? "leer" : `gesetzt (${w.length} Zeichen)`;
  console.log(`${String(i + 1).padStart(4)}  ${name.padEnd(34)} ${stand}`);
}
