import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Prüfung der Migrationen.
 *
 * Ohne laufendes Supabase lässt sich RLS nicht gegen eine echte
 * Datenbank testen — Docker ist auf diesem Rechner nicht vorhanden.
 * Was sich aber sehr wohl prüfen lässt, ist die Aussage der
 * Migrationen selbst. Und genau dort passiert der Fehler, der später
 * teuer wird: eine neue nutzerbezogene Tabelle wird angelegt und das
 * `enable row level security` vergessen.
 *
 * Diese Prüfung fängt das ab. Sie ist kein Ersatz für einen Test gegen
 * eine laufende Instanz, aber sie fängt den häufigsten Fehler — und sie
 * läuft überall.
 */

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../../../supabase/migrations");

function readAll(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
    .join("\n");
}

const sql = readAll();

/** Tabellen, die einer Person gehören. Jede braucht RLS und vier Policies. */
const OWNED = [
  "user_preferences",
  "user_consents",
  "notification_preferences",
  "interview_sessions",
  "interview_messages",
  "career_evidence",
  "career_profiles",
  "career_profile_versions",
  "user_skills",
  "role_recommendations",
  "micro_assessment_results",
  "saved_jobs",
  "job_matches",
  "applications",
  "application_events",
  "application_contacts",
  "documents",
  "document_versions",
  "document_claims",
  "application_documents",
  "coaching_sessions",
  "coaching_feedback",
  "notifications",
  "feedback_events",
  // Ninas Gedächtnis und Vorgangszustand — dieselbe Regel wie überall:
  // ohne RLS gilt eine Tabelle nicht als fertig.
  "job_search_campaigns",
  "workflow_states",
  "nina_memory_items",
  "conversation_summaries",
  "context_snapshots",
  "nina_tasks",
  "web_discovery_candidates",
];

/** Globale Tabellen: lesbar, aber nicht beschreibbar. */
const GLOBAL = ["job_providers", "companies", "jobs", "job_skills", "skills", "job_analysis"];

describe("Migrationen", () => {
  it("legt jede nutzerbezogene Tabelle an", () => {
    for (const table of OWNED) {
      expect(sql, `Tabelle ${table} fehlt`).toMatch(
        new RegExp(`create table if not exists public\\.${table}\\b`),
      );
    }
  });

  it("bindet jede nutzerbezogene Tabelle an auth.users", () => {
    for (const table of OWNED) {
      const block = sql.slice(
        sql.indexOf(`create table if not exists public.${table}`),
        sql.indexOf(`create table if not exists public.${table}`) + 3000,
      );
      expect(block, `${table} hat keinen Bezug zu auth.users`).toMatch(/references auth\.users/);
    }
  });

  it("führt jede nutzerbezogene Tabelle in einer RLS-Schleife", () => {
    // Die Schleife schaltet RLS ein und legt vier Policies an. Steht eine
    // Tabelle nicht darin, hat sie keine Policy — und ohne Policy darf
    // niemand etwas. Das fällt erst im Betrieb auf.
    //
    // Es gibt mehrere Schleifen über mehrere Migrationen; geprüft wird,
    // dass jede Tabelle in mindestens einer davon steht.
    const loops = [...sql.matchAll(/owned text\[\] := array\[([\s\S]*?)\]/g)]
      .map((m) => m[1]!)
      .join(" ");
    for (const table of OWNED) {
      expect(loops, `${table} fehlt in der RLS-Schleife`).toContain(`'${table}'`);
    }
  });

  it("erzeugt alle vier Richtungen als eigene Policy", () => {
    for (const direction of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`for ${direction} to authenticated`);
    }
    // Beim Einfügen muss die eigene Kennung erzwungen werden, sonst
    // koennte jemand eine Zeile fuer eine fremde Person anlegen.
    expect(sql).toMatch(/for insert to authenticated\s+with check \(\(select auth\.uid\(\)\) = user_id\)/);
  });

  it("schaltet RLS auch auf globalen Tabellen ein", () => {
    const block = sql.slice(sql.indexOf("global text[] := array["), sql.indexOf("foreach t in array global"));
    for (const table of GLOBAL) {
      expect(block, `${table} fehlt bei den globalen Tabellen`).toContain(`'${table}'`);
    }
  });

  it("gibt globalen Tabellen keine Schreib-Policy", () => {
    // Stellen werden ausschliesslich vom serverseitigen Lauf mit dem
    // Dienstschluessel geschrieben. Gaebe es hier eine Insert-Policy,
    // koennte jede angemeldete Person eine Stellenanzeige anlegen.
    const globalBlock = sql.slice(
      sql.indexOf("global text[] := array["),
      sql.indexOf("-- ── Nur serverseitig"),
    );
    expect(globalBlock).not.toMatch(/for (insert|update|delete)/);
  });

  it("legt ausschließlich private Buckets an", () => {
    const bucketInsert = sql.slice(sql.indexOf("insert into storage.buckets"));
    const publicFlags = [...bucketInsert.matchAll(/'[\w-]+',\s*'[\w-]+',\s*(true|false)/g)].map(
      (m) => m[1],
    );
    expect(publicFlags.length).toBeGreaterThanOrEqual(3);
    expect(publicFlags.every((f) => f === "false")).toBe(true);
  });

  it("bindet jeden Dateizugriff an den ersten Pfadabschnitt", () => {
    expect(sql).toMatch(/storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  });
});

describe("Geheimnisse", () => {
  it("stellt den Dienstschlüssel niemals öffentlich bereit", () => {
    // NEXT_PUBLIC_ landet im Client-Bundle. Der Dienstschluessel umgeht
    // RLS - er dort hineinzugeben waere der schwerste denkbare Fehler.
    const config = readFileSync(path.resolve(import.meta.dirname, "config.ts"), "utf8");
    expect(config).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE");
    expect(config).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
  });
});
