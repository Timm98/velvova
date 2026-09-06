import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { arbeitswegBerechnen } = await import("../apps/web/src/lib/geo/arbeitsweg.ts");
const b = await arbeitswegBerechnen("Karlsruhe", "Hamburg, Hamburg");
console.log(JSON.stringify(b, null, 2).slice(0, 600));
process.exit(0);
