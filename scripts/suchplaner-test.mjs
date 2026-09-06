/**
 * Der eigentliche Prüfstein: ein Profil ohne Jobtitel.
 *
 * Niemand sagt hier, wie der gesuchte Beruf heisst. Es steht nur da,
 * was jemand getan hat und was ihm liegt. Ob daraus brauchbare
 * Suchrichtungen entstehen — und ob die echten Anbieter darauf echte
 * Stellen liefern — entscheidet, ob Paycheck etwas anderes ist als
 * eine Jobbörse mit hübscher Oberfläche.
 *
 *   node scripts/suchplaner-test.mjs
 */
process.loadEnvFile?.(".env.local");
const { suchrichtungen, suchbegriffe } = await import("../packages/matching/src/suchrichtungen.ts");
const { TheirStackAdapter, JSearchAdapter, fuehreZusammen } = await import("../packages/jobs/src/index.ts");
const { UserConstraintsSchema } = await import("../packages/domain/src/index.ts");

const jetzt = new Date("2026-01-01T00:00:00Z");
const sagt = (t, i) => ({
  id: `e${i}`, userId: "u", type: "experience_episode", statement: t,
  sourceType: "user_stated", sourceRef: "t", confidence: 0.9, userConfirmed: true,
  userRejected: false, sensitivityLevel: "normal", retentionClass: "profile",
  createdAt: jetzt, updatedAt: jetzt, deletedAt: null,
});

const c = (o) => UserConstraintsSchema.parse({
  minSalaryPerYear: null, baseLocation: null, maxCommuteMinutes: null,
  weeklyHoursMin: null, weeklyHoursMax: null, maxTravelPercent: null, ...o,
});

const PROFILE = [
  {
    name: "D — Quereinstieg, kein Jobtitel genannt",
    saetze: [
      "Ich habe zehn Jahre im Lager gearbeitet und dort auch Bestellungen erfasst.",
      "Ich kann gut mit Menschen, Kundenkontakt macht mir nichts aus.",
      "Mit Excel und dem Warenwirtschaftssystem komme ich gut zurecht.",
    ],
    auslaugend: ["Keine körperliche Arbeit mehr, kein schweres Heben"],
    constraints: c({ baseLocation: "Karlsruhe", hardNoGos: ["Kaltakquise"] }),
  },
  {
    name: "A — Büro/Operations Karlsruhe",
    saetze: [
      "Ich habe Termine koordiniert, Unterlagen verwaltet und das Sekretariat organisiert.",
      "Ich habe Projekte begleitet und zwischen den Abteilungen abgestimmt.",
    ],
    auslaugend: [],
    constraints: c({ baseLocation: "Karlsruhe", minSalaryPerYear: 45000 }),
  },
];

for (const p of PROFILE) {
  const r = suchrichtungen({
    evidence: p.saetze.map(sagt),
    energisingTasks: [],
    drainingTasks: p.auslaugend,
    statedInterests: [],
    constraints: p.constraints,
  }, 5);

  console.log(`\n══ ${p.name} ══`);
  if (r.length === 0) { console.log("  Keine Suchrichtung ableitbar."); continue; }
  for (const x of r) {
    console.log(`  ${x.begriff.padEnd(26)} Stärke ${x.staerke.toFixed(2)}`);
    console.log(`      weil: ${x.belege[0]?.slice(0, 72) ?? "—"}`);
  }

  const begriffe = suchbegriffe(r, p.constraints);
  console.log(`\n  Suchbegriffe: ${begriffe.join(" | ")}`);

  const eingang = [];
  const ts = new TheirStackAdapter({ titel: r.map((x) => x.begriff) });
  const js = new JSearchAdapter({ abfragen: begriffe.slice(0, 3) });
  for (const [name, a] of [["theirstack", ts], ["jsearch", js]]) {
    if (!a.isConfigured()) continue;
    try {
      const l = await a.fetchListings({ limit: 8 });
      for (const x of l) eingang.push({ provider: name, herkunft: "aggregator", listing: x,
        domain: typeof x.raw?.companyDomain === "string" ? x.raw.companyDomain : null });
    } catch (e) { console.log(`  ${name}: FEHLER ${String(e.message).slice(0, 80)}`); }
  }
  const z = fuehreZusammen(eingang);
  console.log(`  → ${eingang.length} roh, ${z.length} nach Zusammenführung`);
  for (const s of z.slice(0, 8)) console.log(`      ${s.listing.title.slice(0, 74)}`);
}
console.log("");
