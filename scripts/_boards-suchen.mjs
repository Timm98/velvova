import fs from "node:fs";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { findeArbeitgeberBoards } = await import("../packages/jobs/src/sources/ats/verifizierung.ts");

const roh = JSON.parse(fs.readFileSync("/tmp/kandidaten.json", "utf8"));
const gesehen = new Set();
const kand = [];
for (const r of roh) {
  const d = String(r.website).trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  // Kürzungsdienste und Unfug fliegen raus: sie führen nicht zur Karriereseite.
  if (!d.includes(".") || d.length < 4) continue;
  if (/^(bit\.ly|goo\.gl|t\.co|tinyurl\.com|linkedin\.com|facebook\.com|xn--)/.test(d)) continue;
  if (gesehen.has(d)) continue;
  gesehen.add(d);
  kand.push({ domain: d, name: r.name, n: r.n });
}
console.log("Prüfbare Domänen:", kand.length, "(von", roh.length + " Zeilen)");

const funde = [];
let fertig = 0, fehler = 0;
const NEBEN = 5;
async function arbeiter(liste) {
  for (const k of liste) {
    try {
      const f = await findeArbeitgeberBoards(k.domain, { timeoutMs: 10_000, pauseMs: 400 });
      if (f.length) {
        funde.push({ ...k, funde: f });
        console.log("  ✓ " + k.domain.padEnd(34) + f.map(x => x.board + ":" + x.boardToken).join(", "));
      }
    } catch { fehler++; }
    if (++fertig % 25 === 0) console.log("     … " + fertig + "/" + kand.length + ", Funde: " + funde.length);
  }
}
const teile = Array.from({ length: NEBEN }, (_, i) => kand.filter((_, j) => j % NEBEN === i));
const t0 = Date.now();
await Promise.all(teile.map(arbeiter));
console.log("\nGeprüft:", fertig, "| Funde:", funde.length, "| Ausfälle:", fehler,
            "| Dauer:", Math.round((Date.now() - t0) / 1000) + "s");
const proBoard = {};
for (const f of funde) for (const x of f.funde) proBoard[x.board] = (proBoard[x.board] || 0) + 1;
console.log("Je Anbieter:", JSON.stringify(proBoard));
fs.writeFileSync("/tmp/board-funde.json", JSON.stringify(funde, null, 2));
console.log("\nTreffer mit Stellenzahl:");
for (const f of funde.sort((a,b)=>b.n-a.n)) console.log("  "+String(f.n).padStart(6)+"  "+f.domain.padEnd(32)+f.funde.map(x=>x.board+":"+x.boardToken).join(", "));
process.exit(0);
