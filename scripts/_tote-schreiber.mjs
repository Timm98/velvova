import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Tote Exporte, die schreiben.
 *
 * Von 115 Exporten ohne Aufrufer sind die meisten harmlos: Testhelfer,
 * Unterkomponenten, Formatierer. Gefährlich ist nur eine Sorte — die,
 * die in die Datenbank schreibt oder eine Regel durchsetzt. Bleibt sie
 * ungerufen, ist die Tabelle leer und die Regel wirkungslos, und beides
 * fällt niemandem auf.
 *
 * Genau so waren `persistMatch`, `markInterviewCompleted`,
 * `consumeMagicLink`, `gespraechAnbieten` und `rueckmeldungAbgeben`.
 */
const roh = execSync("node scripts/_tote-exporte.mjs", { encoding: "utf8", cwd: process.cwd() });
const zeilen = roh.split("\n").filter((z) => /\s+\S+\.(ts|tsx)$/.test(z));

const treffer = [];
for (const z of zeilen) {
  const [name, datei] = z.trim().split(/\s+/);
  let text;
  try { text = readFileSync(datei, "utf8"); } catch { continue; }
  const i = text.indexOf(`export ${text.includes(`export async function ${name}`) ? "async " : ""}function ${name}`);
  if (i < 0) continue;
  /* Der Rumpf grob: bis zum nächsten Export auf Spaltenanfang. */
  const rest = text.slice(i);
  const ende = rest.indexOf("\nexport ", 10);
  const rumpf = ende > 0 ? rest.slice(0, ende) : rest;
  const schreibt = /\.insert\(|\.update\(|\.delete\(|revalidatePath|createSession|destroySession/.test(rumpf);
  const regel = /return\s+(false|\{\s*ok:\s*false)/.test(rumpf) && /erlaub|allow|darf|policy|Policy/.test(rumpf);
  if (schreibt || regel) treffer.push([schreibt ? "SCHREIBT" : "REGEL   ", name, datei]);
}
for (const [art, n, d] of treffer) console.log(art, n.padEnd(28), d);
console.log(`\n${treffer.length} von ${zeilen.length} sind Schreiber oder Regeln`);
