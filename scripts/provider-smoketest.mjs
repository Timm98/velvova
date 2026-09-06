/**
 * Was die Anbieter wirklich tun, wenn man sie fragt.
 *
 * Echte Anfragen mit den echten Schlüsseln aus `.env.local`. Kein Mock,
 * keine Aufzeichnung, kein Ersatzergebnis — die Frage ist ja gerade,
 * ob es funktioniert.
 *
 * Der Bericht sagt bei jedem Anbieter, WELCHE Anfrage scheitert und mit
 * welchem Code, statt nur „nicht verbunden". Ein 403 auf einen
 * bestimmten Pfad ist eine Aussage über den Plan; „failed" ist keine.
 *
 * Ausgegeben wird nie ein Schlüssel — auch nicht gekürzt. Ein Präfix
 * genügt, um einen Schlüssel in einem Leck wiederzuerkennen, und dieser
 * Bericht ist zum Weiterschicken gedacht.
 *
 *   node scripts/provider-smoketest.mjs
 */

process.loadEnvFile?.(".env.local");

const { JSearchAdapter, TheirStackAdapter, BrightDataAdapter, ApifyAdapter, CoresignalEnrichment } =
  await import("../packages/jobs/src/index.ts");

const SUCHEN = ["Customer Success Karlsruhe", "Büromanagement Karlsruhe", "Vertrieb Karlsruhe"];
const berichte = [];

/** Welche Felder tatsächlich ankamen — nicht welche das Modell vorsieht. */
function gelieferteFelder(listen) {
  const zaehler = new Map();
  for (const l of listen) {
    for (const [k, v] of Object.entries(l)) {
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      if (k === "raw") continue;
      zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
    }
  }
  return [...zaehler.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} (${n}/${listen.length})`);
}

async function pruefe(name, konfiguriert, fehltText, lauf) {
  const start = Date.now();
  if (!konfiguriert) {
    berichte.push({ name, zustand: "nicht eingerichtet", detail: fehltText, jobs: 0, felder: [] });
    return;
  }
  try {
    const e = await lauf();
    berichte.push({ name, zustand: "verbunden", ms: Date.now() - start, ...e });
  } catch (e) {
    berichte.push({
      name,
      zustand: "fehlgeschlagen",
      ms: Date.now() - start,
      status: e?.status ?? null,
      detail: e?.verdacht ? `${e.verdacht} — ${String(e.message).slice(0, 240)}` : String(e?.message ?? e).slice(0, 240),
      jobs: 0,
      felder: [],
    });
  }
}

// ── TheirStack ────────────────────────────────────────────────
{
  const a = new TheirStackAdapter({ titel: ["Customer Success", "Büromanagement", "Vertrieb"] });
  await pruefe("THEIRSTACK", a.isConfigured(), "THEIRSTACK_API_KEY fehlt", async () => {
    const l = await a.fetchListings({ limit: 10 });
    return { jobs: l.length, felder: gelieferteFelder(l), beispiel: l[0]?.title ?? null };
  });
}

// ── JSearch ───────────────────────────────────────────────────
{
  const a = new JSearchAdapter({ abfragen: SUCHEN });
  await pruefe("JSEARCH", a.isConfigured(), "RAPIDAPI_KEY fehlt", async () => {
    const l = await a.fetchListings({ limit: 10 });
    return { jobs: l.length, felder: gelieferteFelder(l), beispiel: l[0]?.title ?? null };
  });
}

// ── Bright Data ───────────────────────────────────────────────
{
  const a = new BrightDataAdapter();
  await pruefe("BRIGHT DATA", a.hatSchluessel(), "BRIGHT_DATA_API_KEY fehlt", async () => {
    // Zuerst: welche Datensätze hat dieser Account überhaupt?
    const { nutzbar, gesperrt } = await a.nutzbareDatensaetze();
    const lage =
      `${nutzbar.length} verwendbare Stellendatensätze` +
      (gesperrt.length > 0
        ? `, ${gesperrt.length} gesperrt (${[...new Set(gesperrt.map((g) => g.quelle))].join(", ")})`
        : "");
    if (!a.isConfigured()) {
      return { jobs: 0, felder: [], detail: `Schlüssel gültig. ${lage}. BRIGHT_DATA_DATASET_ID nicht gesetzt — kein Abruf.` };
    }
    const l = await a.fetchListings({ limit: 5 });
    return { jobs: l.length, felder: gelieferteFelder(l), detail: lage };
  });
}

// ── Apify ─────────────────────────────────────────────────────
{
  const a = new ApifyAdapter();
  await pruefe("APIFY", a.hatToken(), "APIFY_TOKEN fehlt", async () => {
    const k = await a.konto();
    const actors = a.erlaubteActors();
    const gesperrt = a.gesperrteActors();
    if (actors.length === 0) {
      return {
        jobs: 0,
        felder: [],
        detail:
          `Token gültig (Konto ${k.username ?? "?"}, Plan ${k.plan ?? "?"}). ` +
          (gesperrt.length > 0
            ? `Eingetragen, aber GESPERRT: ${gesperrt.map((g) => `${g.actor} → ${g.ziel}`).join(", ")}. ` +
              `Diese Quellen dürfen nicht automatisiert ausgelesen werden. Kein Abruf.`
            : `APIFY_ACTORS ist leer — kein Actor freigegeben, deshalb kein Abruf. Das ist Absicht.`),
      };
    }
    const l = await a.fetchListings({ limit: 10 });
    return { jobs: l.length, felder: gelieferteFelder(l), detail: `Actors: ${actors.join(", ")}` };
  });
}

// ── Coresignal ────────────────────────────────────────────────
{
  const c = new CoresignalEnrichment();
  await pruefe("CORESIGNAL", c.isConfigured(), "CORESIGNAL_API_KEY fehlt", async () => {
    const befunde = await c.pruefeZugang();
    const offen = befunde.filter((b) => b.offen).map((b) => b.name);
    return {
      jobs: 0,
      felder: [],
      detail: befunde.map((b) => `${b.name}: HTTP ${b.status ?? "—"} ${b.hinweis}`).join(" | "),
      zusatz: offen.length > 0 ? `zugänglich: ${offen.join(", ")}` : "keine Sammlung zugänglich",
    };
  });
}

// ── Bericht ───────────────────────────────────────────────────
console.log("\n══════ RAUCHTEST JOB-ANBIETER ══════\n");
for (const b of berichte) {
  console.log(`${b.name}`);
  console.log(`  Zustand:  ${b.zustand}${b.status ? ` (HTTP ${b.status})` : ""}${b.ms ? ` · ${b.ms} ms` : ""}`);
  if (b.zustand === "verbunden") console.log(`  Stellen:  ${b.jobs}`);
  if (b.beispiel) console.log(`  Beispiel: ${b.beispiel}`);
  if (b.felder?.length) console.log(`  Felder:   ${b.felder.join(", ")}`);
  if (b.detail) console.log(`  Detail:   ${b.detail}`);
  if (b.zusatz) console.log(`  Zugang:   ${b.zusatz}`);
  console.log("");
}

const verbunden = berichte.filter((b) => b.zustand === "verbunden");
const gesamt = verbunden.reduce((s, b) => s + (b.jobs ?? 0), 0);
console.log(`${verbunden.length}/${berichte.length} Anbieter antworten · ${gesamt} echte Stellen im Test\n`);
