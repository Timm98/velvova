-- Einbettungsvektoren fuer die semantische Kandidatensuche.
--
-- ══════════════════════════════════════════════════════════════
-- Warum jsonb und nicht pgvector
-- ══════════════════════════════════════════════════════════════
--
-- `vector` 0.8.2 ist in dieser Supabase-Instanz verfuegbar und NICHT
-- installiert. Das ist eine bewusste Entscheidung und keine Luecke:
--
--   Der Kandidatenpool sind analysierte Stellen, aktuell 1.215. Eine
--   Kosinusrechnung ueber ein paar tausend Vektoren im Prozess kostet
--   Millisekunden. Eine Erweiterung in der Produktionsdatenbank
--   kostet dauerhaft Betrieb -- und sie liesse sich in der
--   Testumgebung nicht nachbauen, weil dort PGlite im Speicher laeuft.
--
-- Sobald der analysierte Bestand in die Hunderttausende geht, gehoert
-- hier eine `vector`-Spalte mit HNSW-Index hin. Der Zeitpunkt ist
-- messbar: wenn die Auswahlrunde spuerbar laenger dauert als der
-- Modellaufruf danach.
--
-- ══════════════════════════════════════════════════════════════
-- Warum Modell und Fassung dabeistehen
-- ══════════════════════════════════════════════════════════════
--
-- Zwei Vektoren verschiedener Modelle sind nicht vergleichbar, und
-- die Kosinusrechnung sagt trotzdem eine Zahl. Ohne diese beiden
-- Spalten liesse sich ein Modellwechsel nicht durchfuehren, ohne
-- stillschweigend Unsinn zu rechnen.

CREATE TABLE IF NOT EXISTS "job_einbettungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,

  -- Der Fingerabdruck des eingebetteten Textes. Aendert sich die
  -- Anzeige nicht wesentlich, wird nicht neu eingebettet.
  "text_schluessel" text NOT NULL,

  "modell" text NOT NULL,
  "dimensionen" integer NOT NULL,
  -- Die Zahlen als jsonb-Array. Siehe oben.
  "vektor" jsonb NOT NULL,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_einbettungen_unique" ON "job_einbettungen" ("job_id", "modell")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_einbettungen_modell_idx" ON "job_einbettungen" ("modell", "erstellt_am")
--> statement-breakpoint

-- Der Vektor einer Person.
--
-- Er entsteht aus gewuenschten Taetigkeiten, bestaetigten
-- Faehigkeiten, Berufsfeldern und weichen Vorlieben -- nicht aus
-- Gespraechsverlaeufen. Ein Vektor geht an einen Anbieter, wird
-- gespeichert und laesst sich nicht zuruecknehmen; man sieht ihm
-- nicht an, was in ihm steckt.
CREATE TABLE IF NOT EXISTS "profil_einbettungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- Zu welchem Suchauftrag der Vektor gehoert. Eine Person kann
  -- mehrere Suchen haben, und sie meinen Verschiedenes.
  "auftrag_id" uuid REFERENCES "such_auftraege"("id") ON DELETE CASCADE,
  "text_schluessel" text NOT NULL,
  "modell" text NOT NULL,
  "dimensionen" integer NOT NULL,
  "vektor" jsonb NOT NULL,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profil_einbettungen_unique"
  ON "profil_einbettungen" ("user_id", COALESCE("auftrag_id", '00000000-0000-0000-0000-000000000000'::uuid), "modell")
