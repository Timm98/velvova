import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { JoobleAdapter } = await import("../packages/jobs/src/sources/jooble.ts");
try { await new JoobleAdapter({ country: "de" }).fetchListings({ limit: 3 }); }
catch (e) { console.log(String(e instanceof Error ? e.message : e)); }
process.exit(0);
