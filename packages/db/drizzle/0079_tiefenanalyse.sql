-- Ninas tiefe Analyse einer Stelle.
--
-- ══════════════════════════════════════════════════════════════
-- Warum eine eigene Tabelle
-- ══════════════════════════════════════════════════════════════
--
-- Die Analyse liest Anzeige, Profil, Belege und Bedingungen zusammen
-- und braucht dafür mehrere Modellrunden — Minuten, nicht Sekunden.
-- Ein Ergebnis, das nur im Speicher der Seite lebt, wäre beim ersten
-- Wechsel weg, und die Person startete sie erneut.
--
-- `generated_artifacts` wäre der naheliegende Ort und geht nicht: Die
-- Tabelle verlangt eine `application_id`. Eine Analyse entsteht aber
-- VOR der Entscheidung, sich zu bewerben — das ist ihr Zweck.
--
-- ══════════════════════════════════════════════════════════════
-- Warum der Zustand mitgeschrieben wird
-- ══════════════════════════════════════════════════════════════
--
-- Ohne `zustand` liesse sich „läuft noch" nicht von „ist
-- fehlgeschlagen" unterscheiden, und beides sähe aus wie „gibt es
-- nicht". Die Person bekäme einen Knopf angeboten, der längst gedrückt
-- ist, und startete dieselbe teure Arbeit ein zweites Mal.
CREATE TABLE IF NOT EXISTS "job_tiefenanalysen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  -- laeuft · fertig · fehlgeschlagen
  "zustand" text NOT NULL DEFAULT 'laeuft',
  -- Der Text der Analyse. Leer, solange sie läuft.
  "inhalt" text,
  -- Warum sie fehlschlug. Für die Person lesbar, nicht der Stacktrace.
  "fehler" text,
  -- Die Fassung der Bewertungslogik, mit der sie entstand. Eine
  -- Analyse von vor zwei Wochen ist keine Analyse von heute.
  "logikfassung" text,
  "begonnen_am" timestamp with time zone DEFAULT now() NOT NULL,
  "beendet_am" timestamp with time zone
);
--> statement-breakpoint
-- Eine Analyse je Person und Stelle. Ein zweiter Start ersetzt die
-- alte, statt eine Liste anzulegen, aus der niemand die gültige
-- heraussuchen kann.
CREATE UNIQUE INDEX IF NOT EXISTS "job_tiefenanalysen_user_job_idx"
  ON "job_tiefenanalysen" ("user_id", "job_id");
