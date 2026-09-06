-- Ninas Eigeninitiative: beobachten, vermuten, handeln.
--
-- Drei Tabellen, weil es drei verschiedene Dinge sind:
--   nutzer_ereignisse    was geschehen ist      -- Tatsache
--   verhaltenssignale    was Nina daraus liest  -- Vermutung
--   nina_handlungen      was Nina getan hat     -- Rechenschaft
--
-- Sie zusammenzulegen waere bequemer und wuerde die Grenze
-- verwischen, auf die es ankommt: Ein Klick ist nachpruefbar, eine
-- Deutung nicht.
CREATE TABLE IF NOT EXISTS "nutzer_ereignisse" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "art" text NOT NULL,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE CASCADE,
  "auftrag_id" uuid REFERENCES "such_auftraege"("id") ON DELETE SET NULL,
  "sitzung_id" text,
  "geschehen_am" timestamptz NOT NULL DEFAULT now(),
  "kontext" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "quelle" text NOT NULL DEFAULT 'app',
  "ereignis_schluessel" text NOT NULL,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
-- Zwei offene Tabs senden dasselbe Ereignis zweimal. Ohne diesen
-- Schluessel wuerde daraus ein „mehrfach geoeffnet", und Nina merkte
-- eine Stelle vor, die niemand zweimal angesehen hat.
CREATE UNIQUE INDEX IF NOT EXISTS "nutzer_ereignisse_unique"
  ON "nutzer_ereignisse" ("user_id", "ereignis_schluessel")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nutzer_ereignisse_job_idx"
  ON "nutzer_ereignisse" ("user_id", "job_id", "geschehen_am")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nutzer_ereignisse_zeit_idx"
  ON "nutzer_ereignisse" ("user_id", "geschehen_am")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verhaltenssignale" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "art" text NOT NULL,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE CASCADE,
  "staerke" double precision NOT NULL,
  "belege" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "beobachtung" text NOT NULL,
  "status" text NOT NULL DEFAULT 'inferred',
  "gueltig_bis" timestamptz NOT NULL,
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "aktualisiert_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verhaltenssignale_unique"
  ON "verhaltenssignale" ("user_id", "art", "job_id")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verhaltenssignale_offen_idx"
  ON "verhaltenssignale" ("user_id", "status", "gueltig_bis")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nina_handlungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "handlung" text NOT NULL,
  "klasse" text NOT NULL,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE CASCADE,
  "auftrag_id" uuid REFERENCES "such_auftraege"("id") ON DELETE SET NULL,
  "begruendung" text NOT NULL,
  "beleg_ereignisse" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "policy_fassung" text NOT NULL,
  "zustand" text NOT NULL,
  "nachricht" text,
  "rueckgaengig_bis" timestamptz,
  "ablehnungsgrund" text,
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "entschieden_am" timestamptz
)
--> statement-breakpoint
-- Was Zustimmung braucht, ist nicht getan, bis sie da ist.
ALTER TABLE "nina_handlungen" DROP CONSTRAINT IF EXISTS "nina_handlungen_zustand_gueltig"
--> statement-breakpoint
ALTER TABLE "nina_handlungen" ADD CONSTRAINT "nina_handlungen_zustand_gueltig"
  CHECK ("zustand" IN ('vorgeschlagen','ausgefuehrt','zugestimmt','abgelehnt','rueckgaengig'))
--> statement-breakpoint
-- Eine Handlung der Klasse `explicit_only` entsteht nie aus einer
-- Beobachtung. Dass die Datenbank das erzwingt, ist keine doppelte
-- Absicherung -- es ist die Absicherung.
ALTER TABLE "nina_handlungen" DROP CONSTRAINT IF EXISTS "nina_handlungen_klasse_gueltig"
--> statement-breakpoint
ALTER TABLE "nina_handlungen" ADD CONSTRAINT "nina_handlungen_klasse_gueltig"
  CHECK ("klasse" IN ('auto_allowed','propose_first'))
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_handlungen_user_idx"
  ON "nina_handlungen" ("user_id", "erstellt_am")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_handlungen_zustand_idx"
  ON "nina_handlungen" ("user_id", "zustand", "erstellt_am")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_handlungen_job_idx"
  ON "nina_handlungen" ("user_id", "job_id")
--> statement-breakpoint

-- Ninas Vermutung -- getrennt von `saved_jobs` (was die Person bewusst
-- behalten will) und `match_feedback` (was sie ausdruecklich gesagt hat).
CREATE TABLE IF NOT EXISTS "nina_vormerkungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "art" text NOT NULL DEFAULT 'interessant',
  "handlung_id" uuid REFERENCES "nina_handlungen"("id") ON DELETE SET NULL,
  "begruendung" text NOT NULL,
  "zustand" text NOT NULL DEFAULT 'offen',
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "entschieden_am" timestamptz
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nina_vormerkungen_unique"
  ON "nina_vormerkungen" ("user_id", "job_id", "art")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_vormerkungen_offen_idx"
  ON "nina_vormerkungen" ("user_id", "zustand")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nina_eigeninitiative" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "stufe" text NOT NULL DEFAULT 'ausgeglichen',
  "abgeschaltet" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "letzte_nachricht_am" timestamptz,
  "in_sitzung" integer NOT NULL DEFAULT 0,
  "sitzung_id" text,
  "aktiv" boolean NOT NULL DEFAULT true,
  "aktualisiert_am" timestamptz NOT NULL DEFAULT now()
)
