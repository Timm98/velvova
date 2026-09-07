import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wird ein erreichter Interviewstand tatsächlich vermerkt?
 *
 * Der Zustand wird künstlich auf „ready" gebracht — die Belege, die
 * `bestandAufnehmen` zählt, plus Ort, Remote-Wunsch, Rollenhypothese
 * und Zustimmung. Danach eine echte Anfrage an die Chat-Route.
 *
 * Geprüft wird nur der Vermerk, nicht die Antwort des Modells: Der
 * Aufruf von `markInterviewCompleted` steht VOR dem Modellaufruf.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { chromium } = await import("@playwright/test");
const db = await getDb();

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const mail = `e2e-fertig-${Date.now()}@example.invalid`;
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
const [u] = (await db.execute(sql`select id from users where email = ${mail}`)).rows;

const FELDER = [
  ["goals", 1], ["career_evidence", 2], ["skills", 2], ["preferred_tasks", 2],
  ["disliked_tasks", 1], ["work_style_preferences", 2], ["values", 2], ["constraints", 1],
];
for (const [feld, n] of FELDER) {
  for (let i = 0; i < n; i++) {
    await db.execute(sql`
      insert into evidence_items (user_id, type, statement, source_type, source_ref, confidence, user_confirmed)
      values (${u.id}::uuid, 'preference', ${`Prüfsatz ${feld} ${i}`}, 'user_stated',
              ${`nina:v3:${feld}:${i}`}, 0.8, true)`);
  }
}
await db.execute(sql`
  insert into nina_role_hypotheses (user_id, role, group_kind, based_on)
  values (${u.id}::uuid, 'Prüfrolle', 'nah', 'Prüfgrund')`);
await db.execute(sql`
  update user_settings set base_location = 'Hamburg', job_market_country = 'DE',
    remote_preference = 'hybrid' where user_id = ${u.id}::uuid`);
await db.execute(sql`
  update workflow_states set agreed_to_see_jobs = true where user_id = ${u.id}::uuid`);

const vorher = (await db.execute(sql`
  select career_interview_status st from workflow_states where user_id = ${u.id}::uuid`)).rows[0];
console.log("vorher:", vorher.st);

const antwort = await s.evaluate(async () => {
  const r = await fetch("/api/nina/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Zeig mir passende Stellen.", route: "/app/monday", kind: "career_interview" }),
  });
  return r.status;
});
console.log("Chat-Route antwortete:", antwort);
await s.waitForTimeout(3000);

const nachher = (await db.execute(sql`
  select career_interview_status st, current_workflow_step sc, career_interview_completed_at at
  from workflow_states where user_id = ${u.id}::uuid`)).rows[0];
console.log("nachher:", nachher.st, "|", nachher.sc, "|", nachher.at ? "Zeitpunkt gesetzt" : "kein Zeitpunkt");
await b.close();
