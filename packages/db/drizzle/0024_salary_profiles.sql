-- Steuerangaben für die Gehaltsberechnung.
--
-- Das sind sensible Finanzdaten: Steuerklasse und Kinderzahl sagen
-- etwas über die Lebensform, die Krankenkasse etwas über die
-- Gesundheit, das Bundesland über den Wohnort. Zusammen ergeben sie
-- ein Bild, das niemanden ausser die Person selbst etwas angeht.
--
-- Deshalb drei Dinge:
--
--   **Speichern ist eine Wahl.** `save_preferences` — wer nur einmal
--   rechnen will, hinterlässt nichts. Die Voreinstellung ist nicht
--   speichern.
--
--   **RLS von Anfang an.** Beide Tabellen stehen in der Liste in
--   rls.sql.
--
--   **Das Regelwerk wird mitgeschrieben.** Ein gespeichertes Ergebnis
--   ohne die Fassung der Regeln, mit denen es entstand, lässt sich
--   später nicht mehr erklären — und die Regeln ändern sich jedes Jahr.

CREATE TABLE IF NOT EXISTS "salary_calculation_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "country_code" text NOT NULL DEFAULT 'DE',
  "tax_year" integer NOT NULL,
  "tax_class" integer,
  "federal_state" text,
  "church_tax" boolean NOT NULL DEFAULT false,
  "health_insurance_type" text NOT NULL DEFAULT 'gesetzlich',
  "health_insurer_name" text,
  "health_additional_rate" double precision,
  "care_insurance_status" text,
  "children_count" integer,
  "payment_frequency" integer NOT NULL DEFAULT 12,
  /*
   * Ob diese Angaben überhaupt bleiben dürfen.
   *
   * `false` heisst: die Zeile existiert für die Dauer einer Berechnung
   * und wird danach gelöscht. Das ist kein Sonderfall, sondern die
   * Voreinstellung — wer Steuerklasse und Kinderzahl hinterlässt, soll
   * das ausdrücklich gewollt haben.
   */
  "save_preferences" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "salary_profiles_user_year_idx"
  ON "salary_calculation_profiles" ("user_id", "country_code", "tax_year");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "salary_calculation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE SET NULL,
  "gross_annual" integer NOT NULL,
  "gross_monthly" integer,
  "variable_compensation" integer NOT NULL DEFAULT 0,
  "payment_frequency" integer NOT NULL DEFAULT 12,
  "currency" text NOT NULL DEFAULT 'EUR',
  "country_code" text NOT NULL,
  "tax_year" integer NOT NULL,
  /** Mit welcher Fassung der Regeln gerechnet wurde. */
  "rule_set_version" text NOT NULL,
  "input_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "result_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "assumptions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "calculation_status" text NOT NULL DEFAULT 'ok',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "salary_runs_user_idx"
  ON "salary_calculation_runs" ("user_id", "created_at" DESC);
--> statement-breakpoint

/*
 * Welche Regelwerke es gibt und welches gilt.
 *
 * Sie stehen ausserdem im Code — dort werden sie gerechnet. Hier stehen
 * sie, damit der Betrieb sehen kann, was ausgeliefert wird, ohne den
 * Code zu lesen: welches Jahr, welche Fassung, seit wann, und vor
 * allem, ob es freigegeben ist.
 */
CREATE TABLE IF NOT EXISTS "payroll_rule_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "country_code" text NOT NULL,
  "tax_year" integer NOT NULL,
  "version" text NOT NULL,
  "source_metadata" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "valid_from" date NOT NULL,
  "valid_until" date,
  /*
   * Ohne Freigabe keine Zahl, die nach Abrechnung aussieht.
   *
   * Sie wird gesetzt, wenn das Regelwerk gegen die amtlichen Testfälle
   * geprüft ist — nicht, wenn der Code kompiliert.
   */
  "approved_for_production" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_rule_sets_unique"
  ON "payroll_rule_sets" ("country_code", "tax_year", "version");
