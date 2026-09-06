-- Was Nina über einen Menschen weiss, als Ergebnis festgehalten.
--
-- ══════════════════════════════════════════════════════════════
-- Warum das gespeichert wird und nicht bei jedem Aufruf entsteht
-- ══════════════════════════════════════════════════════════════
--
-- Eine Profilsynthese mit dem tiefen Modell dauert Sekunden und
-- kostet Geld. Sie bei jeder Gespraechsnachricht neu zu rechnen
-- hiesse, den Nutzer fuer eine Auskunft warten zu lassen, die sich
-- seit gestern nicht geaendert hat.
--
-- Gespeichert wird das ERGEBNIS, nicht die Belege -- die stehen
-- weiter in `evidence_items`. Diese Tabelle ist eine Ableitung und
-- darf jederzeit verworfen und neu gerechnet werden.
CREATE TABLE IF NOT EXISTS "profil_synthesen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- profilsynthese | karriereanalyse
  "art" text NOT NULL,
  "ergebnis" jsonb NOT NULL,
  -- Welche Belege eingeflossen sind. Aendert sich die Menge, ist die
  -- Synthese veraltet -- und das laesst sich vergleichen, statt es
  -- an einem Zeitstempel zu raten.
  "beleg_stand" text NOT NULL,
  "beleg_anzahl" integer NOT NULL,
  "modell" text NOT NULL,
  "prompt_fassung" text NOT NULL,
  -- Wie tragfaehig das Ergebnis ist, 0 bis 1.
  "konfidenz" double precision NOT NULL,
  -- Ob eine zweite Meinung eingeholt wurde und was dabei herauskam.
  "zweitmodell" text,
  "zweit_ergebnis" jsonb,
  "einig" boolean,
  "abweichungen" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
-- Je Art die neueste zuerst.
CREATE INDEX IF NOT EXISTS "profil_synthesen_user_idx"
  ON "profil_synthesen" ("user_id", "art", "erstellt_am" DESC)
--> statement-breakpoint

-- Die naechste Frage und die erkannten Widersprueche.
--
-- Getrennt von der Synthese, weil sie einen anderen Lebenszyklus
-- haben: Eine Frage ist beantwortet oder nicht, ein Widerspruch
-- aufgeloest oder nicht. Beides aendert sich durch eine Antwort der
-- Person, nicht durch einen neuen Modelllauf.
CREATE TABLE IF NOT EXISTS "profil_klaerungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- frage | widerspruch
  "art" text NOT NULL,
  -- Welches Wissensfeld beziehungsweise welcher Gegensatz.
  "schluessel" text NOT NULL,
  "frage" text NOT NULL,
  "grund" text,
  -- Die Belege, auf die sich das stuetzt.
  "belege" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "staerke" double precision,
  -- offen | beantwortet | uebergangen
  "zustand" text NOT NULL DEFAULT 'offen',
  -- Was die Person geantwortet hat -- als Beleg-ID, nicht als Text.
  "antwort_beleg" uuid,
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "entschieden_am" timestamptz
)
--> statement-breakpoint
-- Je Schluessel hoechstens eine offene Klaerung. Zweimal dieselbe
-- Frage ist keine Nachfrage, sondern ein Fehler.
CREATE UNIQUE INDEX IF NOT EXISTS "profil_klaerungen_offen_unique"
  ON "profil_klaerungen" ("user_id", "art", "schluessel")
  WHERE "zustand" = 'offen'
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profil_klaerungen_user_idx"
  ON "profil_klaerungen" ("user_id", "zustand", "erstellt_am")
