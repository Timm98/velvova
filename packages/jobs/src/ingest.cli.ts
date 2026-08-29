import { ArbeitnowAdapter } from "./sources/arbeitnow.ts";
import { ingestFromAdapter } from "./ingest.ts";

/**
 * Echte Stellen abrufen.
 *
 * Aufruf: `pnpm jobs:refresh [anzahl]`
 *
 * Der Lauf ist wiederholbar — zweimal ausgeführt entsteht nichts doppelt.
 * Er wird deshalb bewusst von Hand oder vom Arbeiter angestoßen und nicht
 * beim Start der Anwendung: ein Abruf, der bei jedem Neustart losläuft,
 * wird schnell zur Belästigung der Quelle.
 */
const limit = Number(process.argv[2] ?? 100);

const result = await ingestFromAdapter(new ArbeitnowAdapter(), { limit });

const duration = Math.round((result.finishedAt.getTime() - result.startedAt.getTime()) / 100) / 10;

console.log(`Quelle:      ${result.sourceKey}`);
console.log(`Abgerufen:   ${result.fetched}`);
console.log(`Neu:         ${result.inserted}`);
console.log(`Aktualisiert:${result.updated}`);
console.log(`Unverändert: ${result.unchanged}`);
console.log(`Fehlerhaft:  ${result.failed}`);
console.log(`Dauer:       ${duration} s`);

for (const error of result.errors.slice(0, 5)) console.error(`  ! ${error}`);

process.exit(result.fetched === 0 && result.failed > 0 ? 1 : 0);
