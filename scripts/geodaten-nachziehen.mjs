import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Koordinaten für den analysierten Bestand nachtragen.
 *
 * Läuft gegen `geo_referenz` und fragt keinen fremden Dienst. Ein Lauf
 * verarbeitet einen Stapel, schreibt ihn und macht weiter, bis nichts
 * mehr offen ist oder die Obergrenze erreicht ist.
 *
 * Aufruf: node --experimental-strip-types scripts/geodaten-nachziehen.mjs [stapel] [maxstapel]
 */
const { geodatenNachziehen, geoAbdeckung } = await import("../packages/jobs/src/geodaten.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const db = await getDb();

const stapel = Number(process.argv[2] ?? 400);
const maxRunden = Number(process.argv[3] ?? 50);

const vorher = await geoAbdeckung(db, { nurAnalysierte: true });
console.log(`Vorher: ${vorher.aufgeloest}/${vorher.bestand} aufgelöst, ${vorher.offen} offen\n`);

const gesamt = {};
let runden = 0;
let gelesen = 0;
for (let i = 0; i < maxRunden; i++) {
  const b = await geodatenNachziehen(db, { stapel, nurAnalysierte: true });
  if (b.gelesen === 0) break;
  runden++;
  gelesen += b.gelesen;
  for (const [k, v] of Object.entries(b.nachStatus)) gesamt[k] = (gesamt[k] ?? 0) + v;
  process.stdout.write(`\r  Runde ${runden}: ${gelesen} Stellen`);
}
process.stdout.write("\n\n");

console.log("Ergebnis dieses Laufs:");
for (const [k, v] of Object.entries(gesamt).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(24)} ${String(v).padStart(6)}`);
}

const nachher = await geoAbdeckung(db, { nurAnalysierte: true });
console.log(
  [
    "",
    "Abdeckung im analysierten Bestand:",
    `  Bestand            ${nachher.bestand}`,
    `  aufgelöst          ${nachher.aufgeloest}  (${(nachher.anteilAufgeloest * 100).toFixed(1)} %)`,
    `  mehrdeutig         ${nachher.mehrdeutig}`,
    `  nicht gefunden     ${nachher.nichtGefunden}`,
    `  remote, kein Ort   ${nachher.remote}`,
    `  noch offen         ${nachher.offen}`,
  ].join("\n"),
);
process.exit(0);
