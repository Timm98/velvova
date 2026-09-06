import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie viele Anfragen Adzuna gerade zulässt.
 *
 * Nicht geraten: Der Tarif entscheidet, und der ist gewechselt worden.
 * Gemessen wird mit steigender Parallelität, bis Drosselung auftritt.
 */
const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
const LAENDER = ["us","de","fr","gb","br","it","ca","in","au","nl"];
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function eine(land, seite) {
  const u = new URL(`https://api.adzuna.com/v1/api/jobs/${land}/search/${seite}`);
  u.searchParams.set("app_id", id); u.searchParams.set("app_key", key);
  u.searchParams.set("results_per_page", "50"); u.searchParams.set("content-type", "application/json");
  const r = await fetch(u, { signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!r) return { status: 0, n: 0 };
  if (!r.ok) return { status: r.status, n: 0 };
  const d = await r.json().catch(() => null);
  return { status: 200, n: d?.results?.length ?? 0 };
}

console.log("Ströme  Pause   ok  gedrosselt  Anzeigen/s   hochgerechnet je Stunde");
for (const [stroeme, pause] of [[2,400],[4,300],[8,250],[12,200]]) {
  let ok = 0, ged = 0, anz = 0;
  const ende = Date.now() + 30000;
  await Promise.all(Array.from({ length: stroeme }, async (_, i) => {
    let seite = 1 + i * 40;
    while (Date.now() < ende) {
      const r = await eine(LAENDER[i % LAENDER.length], seite++);
      if (r.status === 200) { ok++; anz += r.n; } else if (r.status === 429) ged++;
      await warte(pause);
    }
  }));
  const proS = anz / 30;
  console.log(
    `${String(stroeme).padStart(6)}  ${String(pause).padStart(5)}  ${String(ok).padStart(3)}  ` +
    `${String(ged).padStart(10)}  ${proS.toFixed(0).padStart(10)}  ${Math.round(proS*3600).toLocaleString("de-DE").padStart(22)}`);
  if (ged > ok * 0.1) { console.log("  → Drosselung erreicht, hier ist die Grenze."); break; }
  await warte(5000);
}
process.exit(0);
