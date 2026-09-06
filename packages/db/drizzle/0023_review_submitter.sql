-- Die Absenderkennung gehört nicht in die Moderationsnotiz.
--
-- Beim ersten Anlauf stand die Kennung für die Ratenbegrenzung in
-- `moderation_note`. Das war praktisch und falsch: die Notiz gehört
-- einem Menschen, der etwas über die Bewertung festhält. Eine
-- Prüfsumme darin macht sie unlesbar und würde beim ersten
-- Moderationsvorgang überschrieben — und damit die Begrenzung
-- unwirksam, ohne dass es auffiele.

ALTER TABLE "platform_reviews" ADD COLUMN IF NOT EXISTS "submitter_hash" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "platform_reviews_submitter_idx"
  ON "platform_reviews" ("submitter_hash", "created_at" DESC);
