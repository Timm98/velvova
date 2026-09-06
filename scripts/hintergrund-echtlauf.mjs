import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Der Hintergrundlauf mit echtem Modell — gegen ein synthetisches Konto.
 *
 * ══════════════════════════════════════════════════════════════
 * Was echt ist
 * ══════════════════════════════════════════════════════════════
 *
 *   echt        Zeitplan, Anspruch, Budget, Sol, die Datenbank
 *   synthetisch die Person und ihre Belege
 *
 * `--nur` begrenzt den Lauf auf dieses eine Konto. Ein Lauf ohne
 * Begrenzung würde echte Profile anfassen, und dafür gibt es hier
 * keinen Auftrag.
 *
 * Aufruf: node --experimental-strip-types scripts/hintergrund-echtlauf.mjs [--konto N]
 */

const { getDb, schema, withSystem } = await import("../packages/db/src/index.ts");
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

const [person] = await withSystem(db, (tx) =>
  tx.select().from(schema.users).where(eq(schema.users.email, ADRESSE)).limit(1),
);
if (!person) {
  console.error(`Kein Konto ${ADRESSE}. Erst scripts/intelligenz-echtlauf.mjs laufen lassen.`);
  process.exit(1);
}

/*
 * `--beleg "..."` legt einen neuen synthetischen Beleg an.
 *
 * Ohne eine Änderung an den Belegen rechnet der Lauf zu Recht nicht:
 * Dieselbe Eingabe ergibt dieselbe Ausgabe. Für die Probe braucht es
 * also etwas Neues — und es ist ehrlicher, das sichtbar zu machen,
 * als die Prüfung für den Test abzuschalten.
 */
const iBeleg = process.argv.indexOf("--beleg");
if (iBeleg > 0 && process.argv[iBeleg + 1]) {
  const { withUser } = await import("../packages/db/src/index.ts");
  await withUser(db, person.id, (tx) =>
    tx.insert(schema.evidenceItems).values({
      userId: person.id,
      type: "preference",
      statement: process.argv[iBeleg + 1],
      sourceType: "user_stated",
      confidence: 0.95,
    }),
  );
  console.log(`Neuer synthetischer Beleg: „${process.argv[iBeleg + 1]}"`);
}

const { tafel, hinterlegt } = ai.preistafel();
console.log(`Konto: ${ADRESSE}`);
console.log(`Preise: ${hinterlegt ? "hinterlegt" : "geschätzt (Vorgabe)"}\n`);

const befund = await j.hintergrundSynthese(db, {
  nurProfile: [person.id],
  ausdruecklich: true,
  modellaufrufeMax: 1,
  promptFassung: ai.PROFILSYNTHESE_FASSUNG,
  rufer: async (fakten) => {
    const a = await provider.structuredGenerate({
      system: ai.PROFILSYNTHESE_ANWEISUNG,
      schema: ai.ProfilsyntheseSchema,
      schemaName: "profilsynthese",
      messages: [{ role: "user", content: fakten }],
      tier: "deep",
      temperature: 0,
    });
    const k = ai.kostenCent(a.usage.inputTokens ?? null, a.usage.outputTokens ?? null, tafel, hinterlegt);
    return {
      ergebnis: a.data,
      modell: a.usage.model,
      konfidenz: a.data.confidence,
      kostenCent: k.cent,
    };
  },
});

console.log("── Befund ──────────────────────────────────────────");
for (const [k, v] of Object.entries(befund)) {
  if (k === "zurueckgehalten") continue;
  console.log(`  ${k.padEnd(16)} ${v}`);
}
console.log(`  zurueckgehalten  ${JSON.stringify(befund.zurueckgehalten)}`);

console.log("\n── Protokoll ───────────────────────────────────────");
for (const l of await j.laeufeLesen(db, person.id, 5)) {
  console.log(`  ${l.zustand.padEnd(12)} ${l.anlass.padEnd(18)} Versuch ${l.versuch}  ${l.fehler ?? ""}`);
}

process.exit(0);
