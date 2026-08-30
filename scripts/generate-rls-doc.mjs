import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * RLS_POLICIES.md aus dem Datenbankkatalog erzeugen.
 *
 * Der erste Anlauf hat die SQL-Dateien mit einem regulären Ausdruck
 * gelesen und vier Tabellen gefunden statt dreissig — die Richtlinien
 * entstehen in einer PL/pgSQL-Schleife, die kein Parser sieht. Ein
 * Dokument, das aus einem solchen Abzug entsteht, ist schlimmer als
 * keines: es behauptet Vollständigkeit und liefert eine Stichprobe.
 *
 * Deshalb läuft hier eine echte Datenbank an, die Migrationen werden
 * angewandt, und gefragt wird der Katalog. Was dort steht, ist genau
 * das, was Postgres durchsetzt.
 *
 *   node scripts/generate-rls-doc.mjs
 */

// Die Datei liegt in packages/db, nicht im Wurzelverzeichnis: pnpm
// verlinkt Abhängigkeiten strikt, und drizzle-orm ist von der Wurzel
// aus nicht auflösbar.
const tmp = "packages/db/src/.rls-doc.tmp.ts";
writeFileSync(
  tmp,
  `
import { createInMemoryDb } from "./client.ts";
import { runMigrations } from "./migrate.ts";
import { sql } from "drizzle-orm";

const { db, close } = await createInMemoryDb();
await runMigrations(db);

const tabellen = await db.execute(sql\`
  SELECT c.relname AS tabelle, c.relrowsecurity AS rls, c.relforcerowsecurity AS erzwungen
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
\`);

const richtlinien = await db.execute(sql\`
  SELECT tablename AS tabelle, policyname AS name, cmd AS operation,
         qual AS lesebedingung, with_check AS schreibbedingung
  FROM pg_policies WHERE schemaname = 'public'
  ORDER BY tablename, policyname
\`);

const spalten = await db.execute(sql\`
  SELECT table_name AS tabelle FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'user_id'
\`);

console.log(JSON.stringify({
  tabellen: tabellen.rows, richtlinien: richtlinien.rows,
  mitUserId: [...new Set(spalten.rows.map((r) => r.tabelle))],
}));
await close();
`,
);

let daten;
try {
  const out = execFileSync("node", ["--experimental-strip-types", tmp], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  daten = JSON.parse(out.trim().split("\n").at(-1));
} finally {
  unlinkSync(tmp);
}

const richtlinienJeTabelle = new Map();
for (const r of daten.richtlinien) {
  const list = richtlinienJeTabelle.get(r.tabelle) ?? [];
  list.push(r);
  richtlinienJeTabelle.set(r.tabelle, list);
}

const mitRls = daten.tabellen.filter((t) => t.rls);
const ohneRls = daten.tabellen.filter((t) => !t.rls);
const mitUserId = new Set(daten.mitUserId);

// Der gefährliche Fall: eine Tabelle trägt eine Nutzerkennung, aber
// niemand filtert danach. Sie sieht aus wie geschützt und ist es nicht.
const luecken = daten.tabellen
  .filter((t) => mitUserId.has(t.tabelle) && !t.rls)
  .map((t) => t.tabelle);

const zeilen = [];
zeilen.push("# RLS-Richtlinien");
zeilen.push("");
zeilen.push("<!-- Erzeugt aus dem Datenbankkatalog einer frisch migrierten Datenbank.");
zeilen.push("     Nicht von Hand ändern: `node scripts/generate-rls-doc.mjs`. -->");
zeilen.push("");
zeilen.push(
  "Row Level Security ist der Ort, an dem „niemand sieht fremde Daten“ durchgesetzt wird.",
  "Der Anwendungscode kann sich irren; die Datenbank nicht.",
);
zeilen.push("");
zeilen.push("Drei Dinge machen das wirksam, und alle drei sind leicht zu übersehen:");
zeilen.push("");
zeilen.push(
  "1. **Die Verbindung darf kein Superuser sein.** RLS gilt für Superuser nicht, und",
  "   `FORCE ROW LEVEL SECURITY` ändert daran nichts. Der erste Anlauf des RLS-Tests ist",
  "   genau daran gescheitert: die Richtlinien waren richtig und wirkten trotzdem nicht.",
  "   Jede Anfrage läuft deshalb über die eingeschränkte Rolle `paycheck_app`.",
  "2. **RLS muss eingeschaltet sein.** Eine Richtlinie auf einer Tabelle ohne",
  "   `ENABLE ROW LEVEL SECURITY` steht in der Datenbank, sieht beruhigend aus und",
  "   filtert nichts.",
  "3. **Ohne gesetzte Kennung sieht eine Sitzung nichts.** `app_current_user_id()` liefert",
  "   dann NULL, und `user_id = NULL` ist niemals wahr. Ein vergessenes `withUser()` führt",
  "   zu einer leeren Liste, nicht zu fremden Daten.",
);
zeilen.push("");
zeilen.push(
  `Stand dieser Datei: **${mitRls.length} von ${daten.tabellen.length} Tabellen** mit aktivem RLS, ` +
    `**${daten.richtlinien.length} Richtlinien**.`,
);
zeilen.push("");

zeilen.push("## Tabellen mit Row Level Security");
zeilen.push("");
zeilen.push("| Tabelle | erzwungen | Richtlinien | Bedingung |");
zeilen.push("| --- | --- | --- | --- |");
for (const t of mitRls) {
  const rs = richtlinienJeTabelle.get(t.tabelle) ?? [];
  const bedingung = rs[0]?.lesebedingung ?? rs[0]?.schreibbedingung ?? "—";
  zeilen.push(
    `| \`${t.tabelle}\` | ${t.erzwungen ? "✓" : "—"} | ${rs.length} | \`${String(bedingung).replace(/\|/g, "\\|")}\` |`,
  );
}
zeilen.push("");

zeilen.push("## Tabellen ohne Row Level Security");
zeilen.push("");
zeilen.push(
  "Diese Tabellen enthalten keine personenbezogenen Zeilen: Stellenanzeigen, Unternehmen,",
  "Quellen, Nachschlagewerte. Sie sind für alle gleich, und eine Zeilenfilterung hätte",
  "nichts zu filtern.",
);
zeilen.push("");
zeilen.push(ohneRls.map((t) => `\`${t.tabelle}\``).join(", ") || "— keine —");
zeilen.push("");

zeilen.push("## Prüfung auf Lücken");
zeilen.push("");
if (luecken.length === 0) {
  zeilen.push(
    "Keine Tabelle trägt eine Spalte `user_id`, ohne dass RLS aktiv ist. Das ist die",
    "Prüfung, die zählt: eine nutzerbezogene Tabelle ohne Zeilenfilter sieht geschützt",
    "aus und ist es nicht.",
  );
} else {
  zeilen.push(
    `**${luecken.length} Tabelle(n) tragen eine \`user_id\`, haben aber kein aktives RLS:** ` +
      luecken.map((t) => `\`${t}\``).join(", ") +
      ". Das ist eine Lücke und muss geschlossen werden.",
  );
}
zeilen.push("");

// Supabase läuft nicht in diesem Prozess. Was hier steht, ist deshalb
// eine Auszählung der Migrationsdateien, keine Katalogabfrage — und das
// gehört dazugesagt.
const migDir = "supabase/migrations";
let migDateien = [];
try {
  migDateien = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
} catch {
  /* Verzeichnis fehlt */
}
if (migDateien.length > 0) {
  const sql = migDateien.map((f) => readFileSync(path.join(migDir, f), "utf8")).join("\n");
  const enableCount = (sql.match(/ENABLE ROW LEVEL SECURITY/gi) ?? []).length;
  const policyCount = (sql.match(/CREATE POLICY/gi) ?? []).length;

  zeilen.push("## Supabase (Produktion)");
  zeilen.push("");
  zeilen.push(
    `${migDateien.length} Migrationsdateien unter \`${migDir}\`. Darin ${enableCount} mal`,
    `\`ENABLE ROW LEVEL SECURITY\` und ${policyCount} \`CREATE POLICY\`-Anweisungen — teils`,
    "innerhalb von Schleifen, die pro Tabelle mehrere Richtlinien erzeugen.",
  );
  zeilen.push("");
  zeilen.push(
    "**Diese Zahlen sind gezählt, nicht abgefragt.** Ohne laufende Supabase-Instanz gibt es",
    "keinen Katalog, den man fragen könnte. Sobald eine Instanz erreichbar ist, gehört an",
    "diese Stelle dieselbe Katalogabfrage wie oben — bis dahin ist der Abschnitt eine",
    "Zählung von Absichten, kein Nachweis von Wirkung.",
  );
  zeilen.push("");
  zeilen.push(
    "Geprüft wird stattdessen die Aussage der Migrationen selbst: jede neue nutzerbezogene",
    "Tabelle braucht Richtlinien (`apps/web/src/lib/supabase/migrations.test.ts`).",
  );
  zeilen.push("");
}

zeilen.push("---");
zeilen.push("");
zeilen.push(
  "Geprüft in `packages/db/src/db.test.ts` (echtes Postgres, zwei Nutzer, gegenseitige",
  "Unsichtbarkeit) und `apps/web/src/lib/nina/context/build-context-envelope.test.ts`",
  "(kein fremder Kontext im Modellaufruf).",
);
zeilen.push("");

writeFileSync("docs/RLS_POLICIES.md", zeilen.join("\n"));
console.log(
  `docs/RLS_POLICIES.md erzeugt — ${mitRls.length}/${daten.tabellen.length} Tabellen mit RLS, ` +
    `${daten.richtlinien.length} Richtlinien, ${luecken.length} Lücken.`,
);
