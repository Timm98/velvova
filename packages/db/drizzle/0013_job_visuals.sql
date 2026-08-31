-- Das visuelle Jobsystem (V7 §21).
--
-- Der Zweck ist, dass eine Stellenliste nicht wie eine Tabelle
-- aussieht, OHNE dafür Bilder zu erfinden, die es nicht gibt. Die
-- Trennung in drei Tabellen bildet genau diese Vorsicht ab:
--
--   categories  — die Berufsgruppe. Endlich viele, etwa zwei Dutzend.
--   assets      — die Bilder dazu. Mit Herkunft, Lizenz und der Angabe,
--                 ob eine Maschine sie gemacht hat.
--   assignments — welche Stelle welches Bild bekommt, und warum.
--
-- Warum nicht einfach eine Spalte `image_url` an `jobs`? Weil dann
-- niemand mehr sagen könnte, woher ein Bild stammt und ob es gezeigt
-- werden darf. Genau diese Frage muss beantwortbar bleiben — bei einem
-- Firmenlogo ebenso wie bei einer Illustration, die nach einem echten
-- Büro aussieht und keines ist.
--
-- Rein additiv: drei neue Tabellen, keine bestehende wird verändert.

CREATE TABLE IF NOT EXISTS "job_visual_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stabiler Schlüssel wie "software_data". Er steht im Code, während
  -- die UUID nur in der Datenbank lebt.
  "key" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  -- Die ESCO-Berufsgruppe, aus der die Zuordnung stammt, soweit bekannt.
  "esco_group" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_visual_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "category_id" uuid REFERENCES "job_visual_categories"("id") ON DELETE CASCADE,

  -- Woher das Bild kommt. Kein Standardwert: wer ein Bild einträgt,
  -- muss die Herkunft benennen.
  "origin" text NOT NULL,
  "license" text NOT NULL,
  "attribution" text,

  -- Hat eine Maschine es erzeugt? Entscheidet über die sichtbare
  -- Kennzeichnung „Illustration" (§21.2).
  "ai_generated" boolean NOT NULL DEFAULT false,
  -- Nur intern. Steht hier, damit ein Bild reproduzierbar bleibt und
  -- man später sagen kann, womit es entstanden ist.
  "generator_model" text,
  "generator_prompt" text,

  -- Pflicht. Ein Bild ohne Alternativtext ist für einen Teil der
  -- Menschen schlicht nicht vorhanden.
  "alt_text" text NOT NULL,

  "url" text NOT NULL,
  "width" integer,
  "height" integer,
  -- Erkennt dasselbe Bild wieder, auch unter anderem Namen, und
  -- verhindert Dubletten in der Bibliothek.
  "content_hash" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,

  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "job_visual_assets_hash_idx"
  ON "job_visual_assets" ("content_hash");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_visual_assignments" (
  "job_id" uuid PRIMARY KEY REFERENCES "jobs"("id") ON DELETE CASCADE,
  "asset_id" uuid NOT NULL REFERENCES "job_visual_assets"("id") ON DELETE CASCADE,

  -- Welche Stufe der Reihenfolge aus §21.1 gegriffen hat:
  -- company_logo, employer_cover, role_family, gradient.
  -- Sie steht hier, damit sichtbar bleibt, ob ein Bild etwas über den
  -- Arbeitgeber aussagt oder nur eine Fläche füllt.
  "reason" text NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "job_visual_assignments_asset_idx"
  ON "job_visual_assignments" ("asset_id");
