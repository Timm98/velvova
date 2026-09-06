import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Bundesagentur über Postleitzahlen ernten.
 *
 * ── Warum nicht über Städte ───────────────────────────────────
 *
 * Gemessen, bevor ich das gebaut habe:
 *
 *   Berlin, Stichprobe 100    →   1 unbekannt
 *   Prenzlau, Stichprobe 44   →  30 unbekannt
 *   Wittenberge, Stichprobe 100 → 62 unbekannt
 *
 * Die fehlenden 233.311 Anzeigen liegen nicht in den Grossstädten —
 * die sind abgeerntet. Sie liegen in der Fläche. Eine Liste der 84
 * grössten Städte war deshalb genau die falsche Achse; der erste Lauf
 * holte 459 Anzeigen aus Berlin und schrieb null neue.
 *
 * ── Warum Postleitzahlen und keine Ortsnamen ──────────────────
 *
 * Eine vollständige Liste deutscher Kleinstädte müsste ich pflegen.
 * Die Postleitzahlen decken die Fläche von selbst ab und liegen dort
 * dichter, wo mehr Menschen wohnen — also auch mehr Anzeigen stehen.
 * Über zehn Stichproben quer durchs Land: 32 % unbekannt.
 *
 * Aufruf: node --experimental-strip-types scripts/ba-plz.mjs
 */
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { decideForProvider } = await import("../packages/sources/src/index.ts");

/*
 * Dreistellige Bereiche, mit „00" aufgefüllt.
 *
 * 010 bis 999 sind 990 Punkte. Bei Umkreis 50 überlappen sie
 * grosszügig — und Überlappung ist hier das kleinere Übel: Eine
 * doppelt geholte Anzeige führt der Import zusammen, eine nie geholte
 * fehlt für immer.
 */
const BEREICHE = [];
for (let p = 10; p <= 999; p++) BEREICHE.push(String(p).padStart(3, "0") + "00");

const p = decideForProvider("bundesagentur");
console.log(`Freigabe: ${p.decision} · ${BEREICHE.length} Postleitzahlbereiche\n`);

const t0 = Date.now();
let neu = 0, leer = 0, fehler = 0;
for (const [i, plz] of BEREICHE.entries()) {
  try {
    const e = await ingestFromAdapter(
      /* Ohne Suchbegriff: Der Ort ist die Eingrenzung, ein Begriff
         verengt nur zusätzlich. */
      new BundesagenturAdapter({ orte: [plz], abfragen: [""] }),
      { limit: 400, policy: p },
    );
    neu += e.inserted ?? 0;
    if ((e.fetched ?? 0) === 0) leer++;
  } catch (e) {
    fehler++;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if ((i + 1) % 10 === 0) {
    console.log(
      `  ${String(i + 1).padStart(3)}/${BEREICHE.length} · zuletzt ${plz} · neu gesamt ${String(neu).padStart(6)} · ` +
      `${leer} leer · ${fehler} Fehler · ${((Date.now() - t0) / 60000).toFixed(0)} min`,
    );
  }
}
console.log(`\nFertig: ${neu} neue Stellen von der Bundesagentur.`);
process.exit(0);
