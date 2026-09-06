/**
 * Ein Arbeitgeberboard eintragen — nur mit Nachweis.
 *
 * ── Warum das ein eigener Befehl ist ──────────────────────────
 *
 * Ein Eintrag in `employer_boards` ist die Erlaubnis, ein fremdes
 * Bewerbersystem abzufragen. Das ist keine Konfiguration, die man
 * nebenbei in eine Datei schreibt — es ist eine Aussage darüber, dass
 * ein Arbeitgeber uns seine Stellen zeigen will.
 *
 * Deshalb macht dieser Befehl drei Dinge in dieser Reihenfolge, und
 * bricht bei jedem Fehlschlag ab:
 *
 *   1. Prüft, ob der Arbeitgeber das Board auf seiner eigenen Seite
 *      verlinkt. Ohne diesen Nachweis passiert nichts weiter.
 *   2. Ruft das Board einmal ab — antwortet es überhaupt, und
 *      gehören die Stellen plausibel zu dieser Firma?
 *   3. Schreibt den Eintrag samt Beleg.
 *
 *   node scripts/board-registrieren.mjs <board> <token> <firma> <domain> [--schreiben]
 *
 * Beispiel:
 *   node scripts/board-registrieren.mjs greenhouse musterfirma "Muster GmbH" muster.de
 *
 * Ohne `--schreiben` wird nur geprüft und berichtet.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const [board, token, firma, domain] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const schreiben = process.argv.includes("--schreiben");

if (!board || !token || !firma || !domain) {
  console.log("Aufruf: node scripts/board-registrieren.mjs <board> <token> <firma> <domain> [--schreiben]");
  console.log("  board: greenhouse | lever | ashby | smartrecruiters");
  process.exit(1);
}

const ERLAUBT = ["greenhouse", "lever", "ashby", "smartrecruiters"];
if (!ERLAUBT.includes(board)) {
  console.log(`Unbekanntes Board "${board}". Erlaubt: ${ERLAUBT.join(", ")}`);
  process.exit(1);
}

const { pruefeArbeitgeberBoard } = await import("../packages/jobs/src/sources/ats/verifizierung.ts");
const { AtsBoardAdapter } = await import("../packages/jobs/src/index.ts");
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

console.log(`\n${firma} · ${board}/${token} · ${domain}\n`);

// ── 1. Nachweis ─────────────────────────────────────────────
console.log("1. Verlinkt der Arbeitgeber das Board selbst?");
const v = await pruefeArbeitgeberBoard(board, token, domain, { pauseMs: 300 });
if (!v.ok) {
  console.log(`   NEIN — ${v.grund}\n`);
  console.log("Es wird nichts eingetragen und nichts abgerufen.");
  process.exit(1);
}
console.log(`   Ja — gefunden auf ${v.fundstelle}\n`);

// ── 2. Antwortet das Board? ─────────────────────────────────
console.log("2. Antwortet das Board?");
const adapter = new AtsBoardAdapter(board, () => [{
  boardToken: token,
  employerName: firma,
  authorization: { kind: "verified_domain", reference: v.beleg, verifiedAt: new Date() },
}]);

let stellen = [];
try {
  stellen = await adapter.fetchListings({ limit: 5 });
} catch (e) {
  console.log(`   Fehler: ${String(e.message).slice(0, 160)}\n`);
  console.log("Es wird nichts eingetragen.");
  process.exit(1);
}
console.log(`   Ja — ${stellen.length} Stellen`);
for (const s of stellen.slice(0, 3)) console.log(`      ${s.title.slice(0, 58)}`);

/*
 * Gehören die Stellen plausibel zu dieser Firma?
 *
 * Ein letzter Blick gegen den Fall, dass Bezeichner und Domäne zwar
 * beide stimmen, aber zu verschiedenen Unternehmen gehören — etwa bei
 * einer Konzerntochter, die das Board der Mutter verlinkt.
 */
const fremde = stellen.filter((s) => s.companyName && !aehnlich(s.companyName, firma));
if (stellen.length > 0 && fremde.length === stellen.length) {
  console.log(`\n   Achtung: alle Stellen laufen auf "${stellen[0].companyName}", nicht auf "${firma}".`);
  console.log("   Das kann eine Konzernstruktur sein — oder der falsche Bezeichner. Bitte prüfen.");
}

// ── 3. Eintragen ────────────────────────────────────────────
if (!schreiben) {
  console.log("\nGeprüft, nichts geschrieben. Mit --schreiben eintragen.");
  process.exit(0);
}

const db = await getDb();
const [vorhanden] = await db
  .select({ id: schema.employerBoards.id })
  .from(schema.employerBoards)
  .where(sql`${schema.employerBoards.board} = ${board} and ${schema.employerBoards.boardToken} = ${token}`)
  .limit(1);

if (vorhanden) {
  await db.execute(sql`
    update employer_boards set enabled = true, disabled_reason = null,
      employer_name = ${firma}, employer_domain = ${domain},
      authorization_reference = ${v.beleg}, verified_at = now(), updated_at = now()
    where id = ${vorhanden.id}
  `);
  console.log("\nEintrag aktualisiert und wieder aktiviert.");
} else {
  await db.insert(schema.employerBoards).values({
    board,
    boardToken: token,
    employerName: firma,
    employerDomain: domain,
    authorizationKind: "verified_domain",
    authorizationReference: v.beleg,
    verifiedAt: new Date(),
    enabled: true,
  });
  console.log("\nEingetragen. Der nächste Abruf holt die Stellen.");
}
process.exit(0);

/** Firmennamen ohne Rechtsform vergleichen. */
function aehnlich(a, b) {
  const k = (s) => s.toLowerCase().replace(/\b(gmbh|ag|se|kg|mbh|co|inc|ltd|llc|holding|group)\b/g, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ").trim();
  const x = k(a), y = k(b);
  return x.includes(y) || y.includes(x);
}
