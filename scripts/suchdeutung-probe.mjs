import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Suchdeutung mit echtem Modell.
 *
 * Echt: der Prompt, das Schema, das Modell. Synthetisch: die Sätze.
 * Aufruf: node --experimental-strip-types scripts/suchdeutung-probe.mjs
 */

const ai = await import("../packages/ai/src/index.ts");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
const cfg = loadRuntimeConfig();
const provider = await ai.selectProvider(cfg);

const FAELLE = [
  { eingabe: "bayern nicht länger als 170 min auto", sicher: "pendelzeit=170", bestehend: "keine Filter gesetzt", verlauf: "keiner" },
  { eingabe: "bayern", sicher: "nichts", bestehend: "keine Filter gesetzt", verlauf: "keiner" },
  { eingabe: "lagerhelfer karlsruhe max 30 min", sicher: "pendelzeit=30", bestehend: "keine Filter gesetzt", verlauf: "keiner" },
  { eingabe: "nicht in der pflege", sicher: "nichts", bestehend: "keine Filter gesetzt", verlauf: "keiner" },
  { eingabe: "doch lieber näher dran", sicher: "nichts", bestehend: '{"ort":"karlsruhe","umkreisKm":"80"}', verlauf: "Person: karlsruhe\nNina: sucht im Umkreis von 80 km" },
  { eingabe: "egal wo", sicher: "nichts", bestehend: '{"ort":"karlsruhe"}', verlauf: "keiner" },
  { eingabe: "irgendwas mit menschen aber ohne stress", sicher: "nichts", bestehend: "keine Filter gesetzt", verlauf: "keiner" },
];

for (const f of FAELLE) {
  const fakten = [
    `EINGABE: ${f.eingabe}`,
    `SICHER: ${f.sicher}`,
    `BESTEHEND: ${f.bestehend}`,
    `VERLAUF: ${f.verlauf}`,
  ].join("\n");

  const t = Date.now();
  try {
    const a = await provider.structuredGenerate({
      system: ai.SUCHDEUTUNG_ANWEISUNG,
      schema: ai.SuchdeutungSchema,
      schemaName: "suchdeutung",
      messages: [{ role: "user", content: fakten }],
      tier: "fast",
      temperature: 0,
      timeoutMs: 20_000,
    });
    const gesetzt = Object.entries(a.data.filter).filter(([, v]) => v !== null);
    console.log(`\n„${f.eingabe}"  (${Date.now() - t} ms, ${a.usage.model})`);
    console.log(`  Filter:     ${gesetzt.map(([k, v]) => `${k}=${v}`).join(" · ") || "—"}`);
    if (a.data.entfernen.length) console.log(`  entfernen:  ${a.data.entfernen.join(", ")}`);
    console.log(`  Erklärung:  ${a.data.erklaerung}`);
    console.log(`  unklar:     ${a.data.unklar ?? "—"}`);
    console.log(`  Rückfrage:  ${a.data.rueckfrage ? `[${a.data.rueckfrage.schluessel}] ${a.data.rueckfrage.frage}` : "keine"}`);
  } catch (e) {
    console.log(`\n„${f.eingabe}"  FEHLER nach ${Date.now() - t} ms: ${String(e.message).slice(0, 100)}`);
  }
}
process.exit(0);
