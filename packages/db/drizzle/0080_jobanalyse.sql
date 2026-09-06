-- Die nutzerunabhängige Analyse einer Stelle.
--
-- ══════════════════════════════════════════════════════════════
-- Was bisher fehlte
-- ══════════════════════════════════════════════════════════════
--
-- Bewertet wurde beim Seitenaufbau, je Nutzer und Stelle, und in
-- `job_matches` abgelegt. Es gab keine Analyse der Stelle SELBST:
-- keine Fassung, keine Belegreferenzen, keinen Quellen-Snapshot, keinen
-- Grund, wenn eine Zahl fehlt.
--
-- Damit liess sich weder nachvollziehen, wie eine Einschätzung
-- zustande kam, noch feststellen, welche Analysen nach einer
-- Regeländerung veraltet sind.
--
-- ══════════════════════════════════════════════════════════════
-- Warum getrennt von `job_matches`
-- ══════════════════════════════════════════════════════════════
--
-- Die Analyse gehört zur Stelle und ist für alle gleich. Der Match
-- gehört zur Person. Eine Profiländerung entwertet den Match, nicht
-- die Analyse; eine neue Analyse entwertet die betroffenen Matches.
--
-- In einer Tabelle wäre beides dasselbe, und jede Profiländerung
-- löste eine Neuanalyse der Stelle aus.
CREATE TABLE IF NOT EXISTS "job_analysen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,

  -- Der Fingerabdruck der Eingabe. Enthält Titel, Text, Gehalt, Ort,
  -- Vertrag, Arbeitszeit und Arbeitsmodell — nicht `last_seen_at`.
  -- Siehe `packages/jobs/src/analyseschluessel.ts`.
  "eingabe_schluessel" text NOT NULL,

  -- Schema, Prompt und Bewertungsregeln als eine Zahl. Steigt sie,
  -- sind alle älteren Analysen veraltet.
  "fassung" integer NOT NULL,

  -- laeuft · fertig · fehlgeschlagen · unzureichende_daten
  --
  -- `unzureichende_daten` ist ausdrücklich KEIN Fehler: Der Lauf war
  -- technisch erfolgreich, die Anzeige gab zu wenig her. Ohne diese
  -- Unterscheidung sähe eine dünne Anzeige aus wie ein Absturz.
  "status" text NOT NULL DEFAULT 'laeuft',

  -- Die extrahierten Fakten mit ihren Belegstellen.
  "extraktion" jsonb,
  -- Kriterien, Teilwerte und Endwerte aus dem Code — nicht aus dem Modell.
  "bewertung" jsonb,
  -- Warum eine Zahl fehlt. Maschinenlesbar, je Dimension.
  "gruende" jsonb,

  -- Welche Referenzquellen in dieser Analyse steckten.
  "referenz_snapshot" text,
  "modellkonfiguration" text,

  "fehler" text,
  "begonnen_am" timestamp with time zone DEFAULT now() NOT NULL,
  "beendet_am" timestamp with time zone
);
--> statement-breakpoint
-- Eine gültige Analyse je Stelle und Eingabestand.
--
-- Verhindert, dass zwei gleichzeitig laufende Worker zwei Analysen
-- desselben Stands anlegen. Ändert sich die Anzeige, entsteht eine
-- neue Zeile mit neuem Schlüssel — die alte bleibt als Historie.
CREATE UNIQUE INDEX IF NOT EXISTS "job_analysen_job_eingabe_idx"
  ON "job_analysen" ("job_id", "eingabe_schluessel", "fassung");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_analysen_job_idx"
  ON "job_analysen" ("job_id", "begonnen_am" DESC);
--> statement-breakpoint
-- Die dauerhafte Warteschlange.
--
-- `pgmq` ist in diesem Projekt verfügbar (1.5.1) und war nicht
-- installiert. Eine eigene Outbox wäre möglich und wäre mehr Code für
-- dieselbe Zusage: Ein Browser-Request oder eine flüchtige
-- Hintergrundfunktion genügt nicht, weil der Auftrag verlorenginge,
-- sobald der Prozess endet.
-- Bedingt, weil die Tests gegen PGlite im Speicher laufen und dort
-- keine Erweiterungen installierbar sind. Ein hartes CREATE EXTENSION
-- liess die gesamte Testsuite an einer Zeile scheitern, die mit dem
-- Getesteten nichts zu tun hat.
--
-- In Produktion ist `pgmq` verfügbar und wird angelegt; wo nicht,
-- bleibt die Warteschlange aus und der Aufrufer muss das erkennen —
-- nicht die Migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgmq') THEN
    CREATE EXTENSION IF NOT EXISTS pgmq;
  END IF;
END $$;
