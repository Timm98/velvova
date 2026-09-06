/**
 * Wie viele Stellen trägt der Webserver wirklich?
 *
 * Die Obergrenze stand auf 50.000 je Land und führte zum Absturz —
 * damals wurden die Wortmengen (82 der 111 MB) noch mitgeladen.
 * Seit sie nur bei Bedarf kommen, ist der Verbrauch ein anderer, und
 * die Notbremse von 12.000 ist vielleicht zu vorsichtig.
 *
 * Gemessen wird, nicht geschätzt: Server starten, Bestand laden
 * lassen, Speicher ablesen.
 */
import { spawn } from "node:child_process";
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function messen(grenze) {
  const p = spawn("pnpm", ["--filter", "@paycheck/web", "start"], {
    cwd: "/Users/timenseling/paycheck-rebuild",
    env: { ...process.env, BEWERTUNG_JE_LAND: String(grenze) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let geladen = null, tot = false;
  p.stdout.on("data", (d) => {
    const t = String(d);
    const m = /\[bestand\] (\d+) Stellen vollständig geladen in (\d+) ms/.exec(t);
    if (m) geladen = { n: Number(m[1]), ms: Number(m[2]) };
  });
  p.stderr.on("data", (d) => { if (/heap out of memory|FATAL/.test(String(d))) tot = true; });

  await warte(20000);
  await fetch("http://localhost:3000/app/jobs", { redirect: "manual" }).catch(() => null);
  for (let i = 0; i < 40 && !geladen && !tot; i++) await warte(3000);

  let mb = 0;
  try {
    const { execSync } = await import("node:child_process");
    mb = Number(execSync(`ps -o rss= -p ${p.pid}`).toString().trim()) / 1024;
  } catch { /* Prozess schon tot */ }

  p.kill("SIGKILL");
  await warte(3000);
  return { grenze, geladen, tot, mb: Math.round(mb) };
}

for (const g of [20000, 40000, 80000]) {
  const r = await messen(g);
  console.log(
    `  je Land ${String(g).padStart(6)} → ${r.tot ? "ABSTURZ" : `${r.geladen?.n ?? "?"} Stellen in ${r.geladen?.ms ?? "?"} ms · ${r.mb} MB`}`,
  );
}
process.exit(0);
