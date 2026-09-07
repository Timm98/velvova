import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die ganze Kette: Gesprächsantwort → Career Twin → Stellenvergleich.
 *
 * Der Twin ist der Angelpunkt — Passung, Alltagsvergleich und
 * Rollenkarte hängen daran. Er war leer, bis jemand zehn Regler bewegte.
 */
const { dimensionenAusAntwort } = await import("../packages/ai/src/dimensionslesen.ts");
const { zusammenfassen } = await import("../packages/domain/src/arbeitsprofil.ts");
const { stellenDimensionen, dimensionenVergleichen, alltagsPassung } =
  await import("../packages/matching/src/arbeitsdimensionen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

/* 1. Was jemand Monday sagt. */
const antworten = [
  ["own_decisions", "Ich möchte am liebsten freie Hand haben, ohne Rücksprache für jede Kleinigkeit."],
  ["avoided_tasks", "Telefonate mit Kunden vermeide ich, wo es geht — das laugt mich aus."],
  ["responsibility_wanted", "Ich will fachlich bleiben und keine Führung übernehmen."],
];
const gelesen = antworten.flatMap(([k, a]) =>
  dimensionenAusAntwort(k, a).map((g) => ({ ...g, herkunft: "gespraech", erfasstAm: new Date() })));
zeile(gelesen.length >= 3, `Aus drei Antworten werden ${gelesen.length} Achsenwerte gelesen`);
for (const g of gelesen) console.log(`       ${g.dimension.padEnd(14)} ${g.wert}  ${g.beleg.slice(0, 54)}`);

/* 2. Der zusammengefasste Twin. */
const twin = new Map();
for (const d of new Set(gelesen.map((g) => g.dimension))) {
  const z = zusammenfassen(gelesen.filter((g) => g.dimension === d));
  if (z) twin.set(d, z);
}
zeile(twin.has("kundenkontakt") && twin.get("kundenkontakt").wert < 0.5,
  "Der Twin weiss: will wenig Kundenkontakt");
zeile(twin.has("autonomie") && twin.get("autonomie").wert > 0.5,
  "Und viel Autonomie");
zeile([...twin.values()].every((v) => v.gewicht < 0.6),
  "Aus dem Gespräch allein bleibt das Gewicht niedrig — noch nichts beobachtet");

/* 3. Eine Stelle, die dagegensteht. */
const [zeileStelle] = (await db.execute(sql`
  select * from jobs
  where is_demo=false and description_tokens ~* 'kundenbetreuung|kundenkontakt' limit 1`)).rows;
zeile(Boolean(zeileStelle), "Eine Stelle mit viel Kundenkontakt gefunden");
if (zeileStelle) {
  const job = {
    id: String(zeileStelle.id), title: String(zeileStelle.title),
    descriptionTokens: String(zeileStelle.description_tokens ?? ""),
    coreTasks: zeileStelle.core_tasks ?? [], benefits: zeileStelle.benefits ?? [],
    contractType: zeileStelle.contract_type, shiftWork: zeileStelle.shift_work,
    experienceLevel: zeileStelle.experience_level,
  };
  const stelle = stellenDimensionen(job);
  const v = dimensionenVergleichen(twin, stelle);
  const kk = v.find((x) => x.dimension === "kundenkontakt");
  zeile(Boolean(kk), "Der Vergleich findet die Achse Kundenkontakt");
  zeile((kk?.abstand ?? 0) > 0.5, `Und meldet einen deutlichen Abstand (${kk?.abstand.toFixed(2)})`);
  const p = alltagsPassung(v);
  zeile(p !== null && p.wert < 0.6, `Die Alltagspassung fällt entsprechend aus (${p?.wert.toFixed(2)})`);
  zeile(v[0]?.dimension === "kundenkontakt", "Die grösste Abweichung steht vorn");
}

/* 4. Ohne Profil bleibt es still. */
zeile(dimensionenVergleichen(new Map(), stellenDimensionen({
  id: "x", title: "Test", descriptionTokens: "kundenkontakt", coreTasks: [], benefits: [],
  contractType: null, shiftWork: null, experienceLevel: null,
})).length === 0, "Ohne Profil gibt es keinen Vergleich — und keinen erfundenen");

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
