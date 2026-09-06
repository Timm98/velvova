/**
 * Welches Bewerbersystem verlinkt ein Arbeitgeber auf seiner Seite?
 *
 * Der Bezeichner kommt damit vom Arbeitgeber, nicht von uns. Wer
 * nichts verlinkt, liefert nichts — das ist die richtige Antwort und
 * keine Lücke.
 *
 *   node scripts/board-finden.mjs muster.de [weitere.de ...]
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { findeArbeitgeberBoards } = await import("../packages/jobs/src/sources/ats/verifizierung.ts");

const domains = process.argv.slice(2);
if (domains.length === 0) {
  console.log("Aufruf: node scripts/board-finden.mjs <domain> [<domain> ...]");
  process.exit(1);
}

for (const d of domains) {
  const funde = await findeArbeitgeberBoards(d, { pauseMs: 300 });
  if (funde.length === 0) {
    console.log(`  ${d.padEnd(26)} kein Board im ausgelieferten HTML gefunden`);
    continue;
  }
  for (const f of funde) {
    console.log(`  ${d.padEnd(26)} ${f.board}/${f.boardToken}   (auf ${f.fundstelle})`);
  }
}
