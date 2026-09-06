import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die zweite Meinung mit echten Modellen.
 *
 * Zwei Fälle: einer, bei dem die Lage klar ist — da darf nichts
 * Zweites laufen. Und einer, bei dem sie es nicht ist.
 *
 * Aufruf: node --experimental-strip-types scripts/zweitemeinung-probe.mjs
 */

const { selectProvider, tiefeAnalyse, ultraVerfuegbar, modellFuer } = await import(
  "../packages/ai/src/index.ts"
);
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
const { z } = await import("../packages/ai/node_modules/zod/index.js");

const cfg = loadRuntimeConfig();
const provider = await selectProvider(cfg);

console.log(
  `DEEP  ${modellFuer(cfg, "DEEP").modell}\n` +
    `ULTRA ${modellFuer(cfg, "ULTRA").modell}  (eingerichtet: ${ultraVerfuegbar(cfg)})\n`,
);

const SCHEMA = z.object({
  empfehlung: z.enum(["wechseln", "bleiben", "unklar"]),
  zuversicht: z.number().min(0).max(1),
  begruendung: z.string().max(300),
});

const ANWEISUNG =
  "Du beurteilst eine Karrierefrage. Stütze dich nur auf die Angaben. " +
  "Was nicht dasteht, ist unbekannt — erfinde nichts. " +
  "`zuversicht` sagt, wie sicher du dir bist.";

const FAELLE = [
  {
    name: "klare Lage",
    fakten:
      "Person: 8 Jahre Pflegefachkraft, Examen, will in der Pflege bleiben, " +
      "sucht nur einen näheren Arbeitsweg. Keine Widersprüche.",
    last: { optionen: 1 },
  },
  {
    name: "widersprüchliche Lage",
    fakten:
      "Person: 4 Jahre Erfahrung im Einzelhandel. Will die Branche wechseln, " +
      "mindestens 70.000 € brutto, wenig Stress, keine Schichtarbeit, kein Studium, " +
      "keine IT-Kenntnisse. Hat fünf Angebote verworfen, alle wegen Gehalt. " +
      "Sagt gleichzeitig, Geld sei ihr nicht so wichtig.",
    last: { optionen: 5, widersprueche: 3 },
  },
];

for (const fall of FAELLE) {
  console.log(`══ ${fall.name}`);
  const b = await tiefeAnalyse({
    cfg,
    provider,
    aufgabe: "career_transition_analysis",
    anweisung: ANWEISUNG,
    fakten: fall.fakten,
    schema: SCHEMA,
    schemaName: "karrierefrage",
    last: fall.last,
    konfidenzAus: (e) => e.zuversicht,
  });

  console.log(`  erst  ${b.modell.padEnd(14)} ${b.erst.empfehlung} (${b.erst.zuversicht})`);
  if (b.zweitLief) {
    console.log(`  zweit ${b.zweitmodell.padEnd(14)} ${b.zweit.empfehlung} (${b.zweit.zuversicht})`);
    console.log(`  einig: ${b.einig}`);
    if (!b.einig) {
      for (const a of b.abweichungen) console.log(`    ${a.feld}: ${a.erst} vs ${a.zweit}`);
      console.log(`  an die Person: „${b.hinweis}"`);
    }
  } else {
    console.log(`  keine zweite Meinung — ${b.grund}`);
  }
  console.log(`  ${b.msGesamt} ms\n`);
}
process.exit(0);
