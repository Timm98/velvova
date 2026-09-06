import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { chromium } = await import("@playwright/test");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const mail = `e2e-loesch-${Date.now()}@example.invalid`;
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
const [u] = (await db.execute(sql`select id from users where email = ${mail}`)).rows;

/* Unbestätigt: nur dort zeigt die Liste die Handlungen. Und ein
   Profil, sonst steht die Seite auf ihrem Leerzustand. */
await db.execute(sql`insert into career_profiles (user_id) values (${u.id}::uuid)`);
await db.execute(sql`
  insert into evidence_items (user_id, type, statement, source_type, source_ref, confidence, user_confirmed)
  values (${u.id}::uuid, 'skill', 'Prüfaussage zum Löschen', 'ai_hypothesis', 'nina:v3:skills:0', 0.8, false)`);

await s.goto(`${BASIS}/app/career`);
await s.waitForLoadState("networkidle");
const loeschen = s.getByRole("button", { name: /Löschen|Entfernen/i }).first();
console.log("Löschknopf gefunden:", await loeschen.count() > 0);
if (await loeschen.count()) {
  await loeschen.click();
  await s.waitForTimeout(3000);
}
const [e] = (await db.execute(sql`
  select count(*)::int n from evidence_items where user_id = ${u.id}::uuid and deleted_at is not null`)).rows;
const [p] = (await db.execute(sql`
  select count(*)::int n, max(kind::text) k from privacy_requests where user_id = ${u.id}::uuid`)).rows;
console.log("gelöscht:", e.n, "| Protokolleinträge:", p.n, p.k ?? "");
await b.close();
