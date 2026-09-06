import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wird ein langes Gespräch tatsächlich verdichtet?
 *
 * Erst eine echte Anfrage — damit die Route ihr Gespräch selbst
 * anlegt. Dann dieses Gespräch künstlich verlängern und ein zweites
 * Mal fragen. Der erste Anlauf schlug fehl, weil ich ein eigenes
 * Gespräch angelegt hatte, das die Route gar nicht benutzte.
 */
const { chromium } = await import("@playwright/test");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const mail = `e2e-verdicht-${Date.now()}@example.invalid`;
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(mail);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
const [u] = (await db.execute(sql`select id from users where email = ${mail}`)).rows;

const frage = async (text) =>
  await s.evaluate(async (t) => {
    const r = await fetch("/api/nina/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: t, route: "/app/nina", kind: "career_interview" }),
    });
    const leser = r.body?.getReader();
    while (leser) { const { done } = await leser.read(); if (done) break; }
    return r.status;
  }, text);

console.log("erste Anfrage:", await frage("Ich habe zwölf Jahre in der Pflege gearbeitet."));
await s.waitForTimeout(6000);

const [g] = (await db.execute(sql`
  select id from nina_conversations where user_id = ${u.id}::uuid order by created_at desc limit 1`)).rows;
const [m] = (await db.execute(sql`
  select coalesce(max(index),0)::int i from nina_messages where conversation_id = ${g.id}::uuid`)).rows;
console.log("Gespräch der Route:", g.id, "| höchster Index:", m.i);

const saetze = [
  "Die Nächte haben mir am meisten zugesetzt, ich habe zwei Kinder, sieben und zehn.",
  "Also feste Zeiten. Wie weit könntest du fahren?",
  "Höchstens zwanzig Minuten, ich habe kein Auto.",
  "Verstanden. Was möchtest du auf keinen Fall mehr?",
];
let idx = Number(m.i);
for (let k = 0; k < 24; k++) {
  idx++;
  await db.execute(sql`
    insert into nina_messages (conversation_id, user_id, role, content, index)
    values (${g.id}::uuid, ${u.id}::uuid, ${k % 2 === 0 ? "user" : "assistant"},
            ${saetze[k % saetze.length]}, ${idx})`);
}
console.log("auf Index", idx, "verlängert");

console.log("zweite Anfrage:", await frage("Was weisst du bisher über mich?"));
await s.waitForTimeout(12000);

const [n] = (await db.execute(sql`
  select summary, summarised_through_index d from nina_conversations where id = ${g.id}::uuid`)).rows;
console.log("verdichtet bis:", n.d);
console.log("Zusammenfassung:", n.summary ? n.summary.slice(0, 400) : "KEINE");
await b.close();
