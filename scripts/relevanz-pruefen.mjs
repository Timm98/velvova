import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Findet die Kandidatenauswahl, wonach jemand sucht?
 *
 * ── Der Fehler, den das misst ─────────────────────────────────
 *
 * Bewertet werden 2.000 Stellen statt 823.429 — sonst stirbt der
 * Server am Arbeitsspeicher. Ohne Suchbegriff sind das die neuesten,
 * und dann steckt von einem bestimmten Beruf fast nichts drin:
 *
 *   Zerspanungsmechaniker  2.907 vorhanden ·  14 in der Auswahl
 *   Data Engineer            996 vorhanden ·   0
 *
 * Wer suchte, bekam eine leere Liste — und die sieht aus wie ein
 * leerer Arbeitsmarkt, nicht wie ein Fehler.
 */
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { kandidatenBedingung, KANDIDATEN_REIHENFOLGE } = await import("../apps/web/src/lib/kandidaten.ts");
const { UserConstraintsSchema } = await import("../packages/domain/src/index.ts");
const db = await getDb();

const LEER = UserConstraintsSchema.parse({
  minSalaryPerYear: null, baseLocation: null, maxCommuteMinutes: null,
  weeklyHoursMin: null, weeklyHoursMax: null, maxTravelPercent: null,
});

console.log("Beruf                     im Bestand   ohne Suche   mit Suche");
console.log("─".repeat(64));
for (const beruf of ["Zerspanungsmechaniker", "Erzieher", "Steuerberater", "Data Engineer", "Pflegefachkraft"]) {
  const gesamt = Number((await db.execute(sql`
    select count(*)::int n from jobs where is_demo = false and title ilike ${'%' + beruf + '%'}`)).rows[0].n);

  const ohne = (await db.select({ t: schema.jobs.title }).from(schema.jobs)
    .where(kandidatenBedingung(LEER)).orderBy(KANDIDATEN_REIHENFOLGE).limit(2000))
    .filter((z) => z.t.toLowerCase().includes(beruf.toLowerCase())).length;

  const mit = (await db.select({ t: schema.jobs.title }).from(schema.jobs)
    .where(kandidatenBedingung(LEER, beruf)).orderBy(KANDIDATEN_REIHENFOLGE).limit(2000)).length;

  console.log(
    `${beruf.padEnd(24)} ${String(gesamt).padStart(9)} ${String(ohne).padStart(12)} ${String(mit).padStart(11)}`,
  );
}
process.exit(0);
