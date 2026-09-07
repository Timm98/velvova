import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Der geschlossene Kreis gegen die echte Datenbank.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Probe zeigt, das ein Test nicht zeigt
 * ══════════════════════════════════════════════════════════════
 *
 * Die Tests laufen gegen PGlite. Diese Probe läuft gegen den echten
 * Postgres — mit `job_matches`, `match_factors`, den echten Indizes
 * und den echten Zeilenfiltern. Eine handgeschriebene Abfrage, die
 * in PGlite durchgeht, kann hier an einem Detail scheitern.
 *
 * Konto: synthetisch. Modell: keins — dieser Weg kommt ohne aus.
 *
 * Aufruf: node --experimental-strip-types scripts/kreislauf-echtlauf.mjs [--konto N]
 */

const { getDb, schema, withSystem, withUser } = await import("../packages/db/src/index.ts");
const { eq, and } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const j = await import("../packages/jobs/src/index.ts");

const db = await getDb();
const nr = (() => {
  const i = process.argv.indexOf("--konto");
  return i > 0 ? (process.argv[i + 1] ?? "3") : "3";
})();
const ADRESSE = `nina-kreislauf-${nr}@example.invalid`;
const trenner = (t) => console.log(`\n${"═".repeat(64)}\n${t}\n${"═".repeat(64)}`);

let [person] = await withSystem(db, (tx) =>
  tx.select().from(schema.users).where(eq(schema.users.email, ADRESSE)).limit(1),
);
if (!person) {
  [person] = await withSystem(db, (tx) =>
    tx.insert(schema.users).values({ email: ADRESSE, displayName: "Kreislauf-Probe" }).returning(),
  );
}

/* Alles aus einem früheren Lauf weg — die Probe soll von vorn beginnen. */
await withSystem(db, async (tx) => {
  await tx.delete(schema.ninaHandlungen).where(eq(schema.ninaHandlungen.userId, person.id));
  await tx.delete(schema.profilKlaerungen).where(eq(schema.profilKlaerungen.userId, person.id));
  await tx.delete(schema.profilSynthesen).where(eq(schema.profilSynthesen.userId, person.id));
  await tx.delete(schema.profilLaeufe).where(eq(schema.profilLaeufe.userId, person.id));
  await tx.delete(schema.evidenceItems).where(eq(schema.evidenceItems.userId, person.id));
});

trenner("1. Was die Person gesagt hat — und was ihr Verhalten dagegensetzt");

await withUser(db, person.id, (tx) =>
  tx.insert(schema.evidenceItems).values([
    { userId: person.id, type: "preference", statement: "Ich möchte keinen Vertrieb.", sourceType: "user_stated", confidence: 0.95 },
    ...Array.from({ length: 8 }, (_, i) => ({
      userId: person.id,
      type: "preference",
      statement: `Sales Stelle ${i} gemerkt`,
      sourceType: "external_source",
      confidence: 0.5,
    })),
    { userId: person.id, type: "preference", statement: "könnte an Vertrieb interessiert sein", sourceType: "ai_hypothesis", confidence: 0.92 },
  ]),
);
console.log('  gesagt:    „Ich möchte keinen Vertrieb."           user_stated  0.95');
console.log("  dagegen:   8 gemerkte Vertriebsstellen             external     0.50");
console.log("  vermutet:  könnte an Vertrieb interessiert sein    hypothesis   0.92 → gedeckelt");

trenner("2. Der Widerspruch — ohne Modellaufruf");
await j.profilsynthese(db, { userId: person.id });
for (const k of await j.offeneKlaerungen(db, person.id)) {
  console.log(`  [${k.art}${k.staerke ? ` ${k.staerke.toFixed(2)}` : ""}] ${k.frage.slice(0, 100)}`);
}

trenner("3. Die Proaktiv-Engine entscheidet");
const b = await j.proaktivLauf(db, person.id, { sitzungId: "probe-1" });
console.log(`  Gelegenheiten ${b.gelegenheiten} · vorgeschlagen ${b.vorgeschlagen} · ausgeführt ${b.ausgefuehrt}`);
console.log(`  zurückgehalten ${JSON.stringify(b.zurueckgehalten)}`);

const handlungen = await withUser(db, person.id, (tx) =>
  tx.select().from(schema.ninaHandlungen).where(eq(schema.ninaHandlungen.userId, person.id)),
);
for (const h of handlungen) {
  console.log(`  ${h.handlung.padEnd(22)} ${h.klasse.padEnd(14)} ${h.zustand}`);
  if (h.nachricht) console.log(`    „${h.nachricht.slice(0, 96)}"`);
}

trenner("4. Monday sagt es — genau einmal");
const n1 = await j.naechsteNachricht(db, person.id);
console.log(`  erste Abfrage:  ${n1 ? `„${n1.text.slice(0, 80)}"` : "nichts"}`);
const n2 = await j.naechsteNachricht(db, person.id);
console.log(`  zweite Abfrage: ${n2 ? `„${n2.text.slice(0, 80)}"` : "nichts — schon gesagt"}`);

trenner("5. Die Antwort wird ein Beleg");
const offen = (await j.offeneKlaerungen(db, person.id)).find((k) => k.art === "widerspruch");
const antwort = await j.klaerungAntwort(
  db,
  person.id,
  offen.schluessel,
  "Direkter Verkauf gefällt mir nicht, aber Beratung mit Kundenkontakt schon.",
);
console.log(`  Beleg angelegt: ${antwort.belegId}`);
console.log(`  Klärung geschlossen: ${antwort.geschlossen}`);
console.log(`  Synthese fällig: ${antwort.faelligkeit.faellig} (${antwort.faelligkeit.anlass})`);

trenner("6. Die alte Vermutung verliert — ohne gelöscht zu werden");
const stand = await j.belegstandLaden(db, person.id);
const neu = stand.belege.find((x) => x.aussage.includes("Beratung"));
const vermutung = stand.belege.find((x) => x.quelle === "ai_hypothesis");
console.log(`  neu:       ${neu.konfidenz.toFixed(2)}  ${neu.quelle.padEnd(14)} ${neu.aussage.slice(0, 50)}`);
console.log(`  vermutet:  ${vermutung.konfidenz.toFixed(2)}  ${vermutung.quelle.padEnd(14)} ${vermutung.aussage.slice(0, 50)}`);
console.log(`  vermutung steht noch da: ${vermutung !== undefined}`);

trenner("7. Und die Frage kommt nicht wieder");
await j.profilsynthese(db, { userId: person.id });
const danach = await j.offeneKlaerungen(db, person.id);
console.log(`  offene Widersprüche: ${danach.filter((k) => k.art === "widerspruch").length}`);
const zweiter = await j.proaktivLauf(db, person.id, { sitzungId: "probe-1" });
console.log(`  zweiter Lauf: vorgeschlagen ${zweiter.vorgeschlagen}, zurückgehalten ${JSON.stringify(zweiter.zurueckgehalten)}`);

process.exit(0);
