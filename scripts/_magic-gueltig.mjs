import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
import { randomBytes, createHash } from "node:crypto";
const db = await getDb();

const [n] = (await db.execute(sql`
  select email from users where email like 'e2e-magic-%' order by created_at desc limit 1`)).rows;

/*
 * Das Token hier selbst erzeugen statt `createMagicLink` zu rufen:
 * das Modul zieht `next/headers` nach und läuft nur im Server-Rahmen.
 * Der Hash muss derselbe sein wie in `auth.ts`.
 */
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
await db.execute(sql`
  insert into magic_links (email, token_hash, purpose, expires_at)
  values (${n.email}, ${hash}, 'login', now() + interval '20 minutes')`);
console.log("Token für", n.email, "erzeugt");

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/magic?token=${encodeURIComponent(token)}`);
await s.waitForLoadState("networkidle");
console.log("nach Einlösen →", new URL(s.url()).pathname);

/* Zweites Mal: muss scheitern. Ein Link gilt einmal. */
await s.context().clearCookies();
await s.goto(`${BASIS}/magic?token=${encodeURIComponent(token)}`);
console.log("zweites Einlösen →", new URL(s.url()).pathname + new URL(s.url()).search);
await b.close();
