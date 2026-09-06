import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { JoobleAdapter } = await import("../packages/jobs/src/sources/jooble.ts");
const a = new JoobleAdapter({ country: "de" });
console.log("key:", a.key, "| eingerichtet:", a.isConfigured());
try {
  const l = await a.fetchListings({ limit: 5 });
  console.log("Treffer:", l.length);
  for (const j of l.slice(0, 3)) console.log("  -", j.title, "|", j.company, "|", j.location);
} catch (e) { console.log("Fehler:", e.message); }
