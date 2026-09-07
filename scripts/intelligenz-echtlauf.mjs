import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Der Weg von Belegen zur Karriereanalyse — mit echten Modellen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was echt ist
 * ══════════════════════════════════════════════════════════════
 *
 *   echt        Sol, Astra, die Prompts, die Datenbank, die Regeln
 *   synthetisch die Person und ihre Belege
 *
 * Die Belege müssen erfunden sein: Es gibt keinen Menschen, der für
 * einen Test durch Mondays Gespräch geht. Sie sind gekennzeichnet —
 * `@example.invalid`, und jeder trägt seine Quelle.
 *
 * Aufruf: node --experimental-strip-types scripts/intelligenz-echtlauf.mjs [--konto N]
 */

const { getDb, schema, withSystem, withUser } = await import("../packages/db/src/index.ts");
const { eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
const ai = await import("../packages/ai/src/index.ts");
const j = await import("../packages/jobs/src/index.ts");

const db = await getDb();
const cfg = loadRuntimeConfig();
const provider = await ai.selectProvider(cfg);

const nr = (() => {
  const i = process.argv.indexOf("--konto");
  return i > 0 ? (process.argv[i + 1] ?? "1") : "1";
})();
const ADRESSE = `nina-intelligenz-${nr}@example.invalid`;
const trenner = (t) => console.log(`\n${"═".repeat(64)}\n${t}\n${"═".repeat(64)}`);

/* ── 1. Konto und Belege ──────────────────────────────────── */
trenner("1. Synthetische Person");

let [person] = await withSystem(db, (tx) =>
  tx.select().from(schema.users).where(eq(schema.users.email, ADRESSE)).limit(1),
);
if (!person) {
  [person] = await withSystem(db, (tx) =>
    tx.insert(schema.users).values({ email: ADRESSE, displayName: "Intelligenz-Probe" }).returning(),
  );
}
console.log(`${ADRESSE}\n${person.id}`);

const BELEGE = [
  ["Ich habe vier Jahre im Einzelhandel gearbeitet, zuletzt als Schichtleitung", "document_extract", 0.9, "experience_episode"],
  ["Kassensysteme und Warenwirtschaft, täglich im Einsatz", "document_extract", 0.85, "skill"],
  ["Ich möchte die Branche wechseln", "user_stated", 0.9, "motive"],
  ["Mindestens 45.000 Euro brutto im Jahr", "user_stated", 0.95, "constraint"],
  ["Ich wohne in Karlsruhe und würde bis 40 km pendeln", "user_stated", 0.95, "constraint"],
  ["Wenig Stress ist mir wichtig", "user_stated", 0.9, "preference"],
  ["Ich möchte keine Führungsverantwortung mehr", "user_stated", 0.9, "preference"],
  ["Sales Director Stelle angesehen", "external_source", 0.5, "preference"],
  ["Head of Sales gemerkt", "external_source", 0.5, "preference"],
  ["Vertriebsleitung angesehen", "external_source", 0.5, "preference"],
  ["Account Executive gemerkt", "external_source", 0.5, "preference"],
  ["könnte an Kundenkontakt interessiert sein", "ai_hypothesis", 0.92, "preference"],
];

const vorhanden = await withUser(db, person.id, (tx) =>
  tx.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.userId, person.id)),
);
if (vorhanden.length === 0) {
  await withUser(db, person.id, (tx) =>
    tx.insert(schema.evidenceItems).values(
      BELEGE.map(([statement, sourceType, confidence, type]) => ({
        userId: person.id,
        type,
        statement,
        sourceType,
        confidence,
      })),
    ),
  );
  console.log(`${BELEGE.length} Belege angelegt (synthetisch).`);
} else {
  console.log(`${vorhanden.length} Belege vorhanden.`);
}

/* ── 2. Der Belegstand ────────────────────────────────────── */
trenner("2. Belegstand — mit gedeckelter Konfidenz");
const stand = await j.belegstandLaden(db, person.id);
for (const b of stand.belege.slice(0, 12)) {
  console.log(`  ${b.art.padEnd(11)} ${b.konfidenz.toFixed(2)}  ${b.aussage.slice(0, 56)}`);
}
console.log(`\nFingerabdruck: ${stand.stand}`);

/* ── 3. Klärungen ohne Modell ─────────────────────────────── */
trenner("3. Klärungen — ohne Modellaufruf");
const ohneModell = await j.profilsynthese(db, { userId: person.id });
console.log(`Synthese: ${ohneModell.grund}`);
for (const k of ohneModell.klaerungen) {
  console.log(`  [${k.art}${k.staerke ? ` ${k.staerke.toFixed(2)}` : ""}] ${k.frage}`);
}

/* ── 4. Profilsynthese mit Sol ────────────────────────────── */
trenner("4. Profilsynthese — echter Aufruf");
const solModell = ai.modellFuer(cfg, "DEEP").modell;

const syntheseRufer = async (fakten) => {
  const a = await provider.structuredGenerate({
    system: ai.PROFILSYNTHESE_ANWEISUNG,
    schema: ai.ProfilsyntheseSchema,
    schemaName: "profilsynthese",
    messages: [{ role: "user", content: fakten }],
    tier: "deep",
    temperature: 0,
  });
  return { ergebnis: a.data, modell: a.usage.model, konfidenz: a.data.confidence };
};

const s = await j.profilsynthese(db, {
  userId: person.id,
  rufer: syntheseRufer,
  promptFassung: ai.PROFILSYNTHESE_FASSUNG,
  frisch: true,
});
const syn = s.synthese;
console.log(`Modell: ${s.modell} · Zuversicht ${syn.confidence}`);
console.log(`\nBelegt (${syn.demonstratedSkills.length}):`);
for (const x of syn.demonstratedSkills) console.log(`  · ${x.aussage}  [${x.belege.length} Belege]`);
console.log(`\nMöglich, unbewiesen (${syn.possibleSkills.length}):`);
for (const x of syn.possibleSkills) console.log(`  · ${x.aussage}`);
console.log(`\nWidersprüche:`);
for (const x of syn.contradictions) console.log(`  · ${x}`);
console.log(`\nWas fehlt:`);
for (const x of syn.missingInformation.slice(0, 4)) console.log(`  · ${x}`);

/* ── 5. Karriereanalyse, ggf. mit Astra ───────────────────── */
trenner("5. Karriereanalyse — Sol, bei Bedarf Astra");
const ultra = ai.modellFuer(cfg, "ULTRA");

const analyseRufer = (modell) => async (fakten) => {
  const a = await provider.structuredGenerate({
    system: ai.KARRIEREANALYSE_ANWEISUNG,
    schema: ai.KarriereanalyseSchema,
    schemaName: "karriereanalyse",
    messages: [{ role: "user", content: fakten }],
    tier: "deep",
    temperature: 0,
    ...(modell ? { modell } : {}),
  });
  return { ergebnis: a.data, modell: a.usage.model, konfidenz: a.data.confidence };
};

const k = await j.karriereanalyse(db, {
  userId: person.id,
  rufer: analyseRufer(null),
  zweitrufer: analyseRufer(ultra.modell),
  zweitmeinungMoeglich: ai.ultraVerfuegbar(cfg),
  vergleichen: (a, b) => ai.vergleichen(a, b),
  promptFassung: ai.KARRIEREANALYSE_FASSUNG,
  frisch: true,
});

console.log(`${k.grund}`);
console.log(`erst: ${k.modell}${k.zweitmodell ? ` · zweit: ${k.zweitmodell} · einig: ${k.einig}` : ""}`);

const a = k.analyse;
console.log(`\nLage: ${a.currentSituation}`);
console.log(`\nRichtungen:`);
for (const r of a.directions) {
  console.log(`  ${r.einschaetzung.padEnd(28)} ${r.role}`);
  if (r.evidenceAgainst.length > 0) console.log(`      dagegen: ${r.evidenceAgainst[0]}`);
  if (r.missingRequirements.length > 0) console.log(`      fehlt:   ${r.missingRequirements[0]}`);
}
console.log(`\nWidersprüche:`);
for (const x of a.contradictions) console.log(`  · ${x}`);
if (k.hinweis) console.log(`\nAn die Person: „${k.hinweis}"`);
if (k.naechsteFrage) console.log(`\nNächste Frage: „${k.naechsteFrage}"`);

/* ── 6. Verbrauch ─────────────────────────────────────────── */
trenner("6. Verbrauch");
const f = await j.syntheseFaellig(db, person.id);
console.log(`Nächste Synthese fällig: ${f.faellig} (${f.anlass})`);
console.log(`Modelle: DEEP ${solModell} · ULTRA ${ultra.modell}`);
process.exit(0);
