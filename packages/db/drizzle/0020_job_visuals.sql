-- Wo Jobbilder herkommen, wenn sie nicht gerechnet sind.
--
-- Heute entsteht jedes Bild aus der Berufsgruppe: ein SVG unter einem
-- Kilobyte, als data-URI im HTML, ohne Netzaufruf und ohne Datenbank.
-- Das reicht und kostet nichts.
--
-- Diese Tabellen sind für den Fall danach: ein Arbeitgeber gibt ein
-- Bild frei, ein Partnervertrag erlaubt ein Logo, oder es wird einmal
-- ein Motiv erzeugt und dauerhaft abgelegt. Dann braucht es drei
-- Auskünfte, die ein data-URI nicht geben kann:
--
--   Woher stammt das Bild und unter welcher Lizenz?
--   Hat eine Maschine es gemacht — und mit welchem Modell?
--   Welcher Stelle ist es zugeordnet, und warum dieser?
--
-- Ohne diese Angaben lässt sich später nicht mehr klären, ob ein Bild
-- gezeigt werden darf. Deshalb stehen sie hier, bevor das erste Bild
-- existiert, und nicht danach.

CREATE TABLE IF NOT EXISTS "job_visual_categories" (
  "key" text PRIMARY KEY,
  "label" text NOT NULL,
  -- Die Erkennungsregel steht im Code (lib/jobs/visuals.ts), nicht hier:
  -- ein regulärer Ausdruck in der Datenbank wäre eine zweite Wahrheit.
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_visual_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "category_key" text REFERENCES "job_visual_categories"("key") ON DELETE SET NULL,
  -- employer_supplied | partner_licensed | generated_illustration | computed_gradient
  "source_type" text NOT NULL,
  -- Was der Lizenzgeber erlaubt. Freitext, weil Lizenzen Freitext sind.
  "license" text,
  /*
   * Ob eine Maschine das Bild gemacht hat.
   *
   * Nicht ableitbar aus `source_type`, weil ein Arbeitgeber auch ein
   * erzeugtes Bild einreichen kann. Und nicht optional: ohne diese
   * Angabe lässt sich die Kennzeichnung „Illustration" nicht
   * begründen, und eine unbegründete Kennzeichnung ist keine.
   */
  "is_ai_generated" boolean NOT NULL DEFAULT false,
  "model_reference" text,
  "prompt_version" text,
  "storage_path" text,
  "alt_text" text NOT NULL,
  -- Damit dasselbe Bild nicht zweimal abgelegt wird.
  "content_hash" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "job_visual_assets_hash_idx"
  ON "job_visual_assets" ("content_hash") WHERE "content_hash" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_visual_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "asset_id" uuid NOT NULL REFERENCES "job_visual_assets"("id") ON DELETE CASCADE,
  -- Warum dieses Bild zu dieser Stelle: category_match | employer_direct | manual
  "reason" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Eine Stelle hat höchstens ein Titelbild. Zwei wären eine Frage, die
-- beim Anzeigen niemand beantworten kann.
CREATE UNIQUE INDEX IF NOT EXISTS "job_visual_assignments_job_idx"
  ON "job_visual_assignments" ("job_id");
