/**
 * Prüft die Zugriffstrennung gegen die ECHTE Datenbank.
 *
 * `withUser()` setzt Rolle und Nutzerkennung inzwischen in einem
 * einzigen Netzweg statt in zweien — eine Optimierung, die genau an der
 * Stelle ansetzt, an der die Zugriffstrennung hängt. Deshalb dieses
 * Skript: es beweist an lebenden Daten, dass ein Konto die Daten eines
 * anderen weder sehen noch ändern kann und die Rolle nach der
 * Transaktion zurückfällt.
 *
 * Ein Unit-Test kann das nicht — RLS lebt in Postgres, nicht im Code.
 *
 *   set -a && . ./.env.local && set +a
 *   node --experimental-strip-types scripts/rls-pruefen.ts
 */
import { loadRuntimeConfig } from "@paycheck/config";
import { getDbHandle } from "../packages/db/src/client.ts";
import { withUser } from "../packages/db/src/session.ts";
import { sql } from "drizzle-orm";

const { db, close } = await getDbHandle(loadRuntimeConfig());

const nutzer: any = (await db.execute(
  sql`SELECT id, email FROM users ORDER BY created_at DESC LIMIT 2`,
) as any).rows;
if (nutzer.length < 2) { console.log("Zu wenige Nutzer für die Prüfung."); await close(); process.exit(0); }
const [a, b] = nutzer;

// 1. Rolle wirklich gewechselt?
const rolle = await withUser(db, a.id, async (tx: any) =>
  (await tx.execute(sql`SELECT current_user::text AS r, current_setting('app.user_id', true) AS u`)).rows[0]);
console.log(`Rolle in der Transaktion: ${rolle.r}, Kennung gesetzt: ${rolle.u === a.id}`);

// 2. Sieht A die Einstellungen von B?
const fremd = await withUser(db, a.id, async (tx: any) =>
  (await tx.execute(sql`SELECT count(*)::int n FROM user_settings WHERE user_id = ${b.id}`)).rows[0]);
console.log(`A sieht Einstellungen von B: ${fremd.n} Zeilen  ${fremd.n === 0 ? "→ getrennt" : "→ LECK!"}`);

// 3. Sieht A die eigenen?
const eigen = await withUser(db, a.id, async (tx: any) =>
  (await tx.execute(sql`SELECT count(*)::int n FROM user_settings WHERE user_id = ${a.id}`)).rows[0]);
console.log(`A sieht eigene Einstellungen: ${eigen.n} Zeilen  ${eigen.n > 0 ? "→ ok" : "→ zu streng"}`);

// 4. Kann A Daten von B ändern?
let geaendert = -1;
try {
  geaendert = await withUser(db, a.id, async (tx: any) => {
    const r: any = await tx.execute(sql`UPDATE user_settings SET locale='en' WHERE user_id=${b.id}`);
    return r.rowCount ?? 0;
  });
} catch { geaendert = 0; }
console.log(`A ändert Daten von B: ${geaendert} Zeilen  ${geaendert === 0 ? "→ blockiert" : "→ LECK!"}`);

// 5. Sickert die Rolle in die nächste Anfrage?
const danach: any = (await db.execute(sql`SELECT current_user::text AS r`) as any).rows[0];
console.log(`Rolle nach der Transaktion: ${danach.r} ${danach.r !== "paycheck_app" ? "→ zurückgesetzt" : "→ SICKERT!"}`);

await close();
