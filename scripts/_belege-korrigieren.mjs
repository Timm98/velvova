import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Nimmt die Belege zurück, die aus unbewerteten Textaufgaben entstanden.
 *
 * Sie standen als `beobachtet` da, obwohl nur eine Selbstauskunft
 * dahinterstand. Kein Löschen: `deleted_at` gesetzt, die Zeile bleibt
 * nachvollziehbar.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const r = await db.execute(sql`
  update evidence_items e set deleted_at = now()
  where e.source_type = 'work_sample' and e.deleted_at is null
    and exists (
      select 1 from probendurchlaeufe d
      join aufgabenproben p on p.id = d.probe_id
      where d.user_id = e.user_id and 'probe:' || p.titel = e.source_ref
        and d.richtig is null)
  returning e.id`);
console.log("zurückgenommen:", (r.rows ?? []).length);
