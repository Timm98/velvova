import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Der geschlossene Kreis: Stellenantritt → Erinnerung → Check-in →
 * Career Twin → Bilanz.
 *
 * Ohne Anstoss füllt niemand einen Check-in aus. Ohne Check-ins lernt
 * der Outcome Loop nichts. Diese Prüfung hält die ganze Kette fest.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

const [u] = (await db.execute(sql`
  insert into users (email) values (${`erin-${Date.now()}@example.invalid`}) returning id`)).rows;
const [j] = (await db.execute(sql`select id from jobs where is_demo=false limit 1`)).rows;
const [a] = (await db.execute(sql`
  insert into applications (user_id, job_id, stage) values (${u.id}, ${j.id}, 'accepted') returning id`)).rows;

const { checkInsPlanen, faelligeCheckIns, checkInAbgehakt } =
  await import("../apps/web/src/lib/erinnerungen.ts");

await checkInsPlanen(u.id, a.id);
let r = (await db.execute(sql`
  select kind, label, due_at from reminders where user_id=${u.id} order by due_at`)).rows;
const checkIn = r.filter((x) => x.kind === "check_in");
const zusagen = r.filter((x) => x.kind === "zusagen_pruefung");

zeile(checkIn.length === 3, `Drei Check-in-Termine (${checkIn.length})`);
zeile(checkIn.map((x) => x.label).join(" ").includes("180"), "Check-in: 30, 90 und 180 Tage");

/*
 * Der Promise Lock prüft früher — und das ist Absicht.
 *
 * Der Check-in fragt nach Zufriedenheit, die braucht Zeit. Eine
 * gebrochene Zusage fällt früher auf: Wer nach vierzehn Tagen keine
 * Einarbeitung hat, hat keine.
 */
zeile(zusagen.length === 3, `Drei Termine für die Zusagenprüfung (${zusagen.length})`);
zeile(zusagen.map((x) => x.label).join(" ").includes("14"), "Zusagen: 14, 30 und 90 Tage");
zeile(!checkIn.map((x) => x.label).join(" ").includes("14"),
  "Die beiden Marken werden nicht vermischt");

/* Ein zweites `accepted` darf keine zwölf Termine machen. */
await checkInsPlanen(u.id, a.id);
r = (await db.execute(sql`select id from reminders where user_id=${u.id}`)).rows;
zeile(r.length === 6, `Ein zweiter Antritt legt nichts doppelt an (${r.length})`);

/* Fällig ist erst, was fällig ist. */
let f = await faelligeCheckIns(u.id);
zeile(f.length === 0, "Nichts ist fällig, solange die Frist läuft");

await db.execute(sql`
  update reminders set due_at = now() - interval '1 day'
  where user_id=${u.id} and kind = 'check_in' and label like '%30 Tagen%'`);
f = await faelligeCheckIns(u.id);
zeile(f.length === 1, `Nach dreissig Tagen ist genau eine fällig (${f.length})`);
zeile(Boolean(f[0]?.titel && f[0]?.firma), "Mit Stelle und Firma — sonst weiss niemand, welche gemeint ist");

/* Der Check-in hakt genau die eine ab. */
await checkInAbgehakt(u.id, a.id, 30);
f = await faelligeCheckIns(u.id);
zeile(f.length === 0, "Der Check-in hakt sie ab");
const offen = (await db.execute(sql`
  select count(*)::int n from reminders
  where user_id=${u.id} and kind='check_in' and completed_at is null`)).rows[0].n;
zeile(offen === 2, `Die anderen beiden Check-ins bleiben stehen (${offen})`);
const zusOffen = (await db.execute(sql`
  select count(*)::int n from reminders
  where user_id=${u.id} and kind='zusagen_pruefung' and completed_at is null`)).rows[0].n;
zeile(zusOffen === 3, `Die Zusagentermine bleiben unberührt (${zusOffen})`);

await db.execute(sql`delete from users where id=${u.id}`);
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
