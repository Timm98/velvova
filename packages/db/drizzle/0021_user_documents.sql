-- Dokumente, die eine Person selbst mitbringt.
--
-- Lebenslauf, Zeugnisse, eine Stellenanzeige als PDF, eine alte
-- Bewerbung, eine Absage. Es sind die persönlichsten Daten im ganzen
-- Produkt: darin stehen Namen, Adressen, Geburtsdaten, Krankheiten,
-- Kündigungsgründe. Deshalb liegt hier mehr Struktur als bei anderen
-- Tabellen — nicht aus Ordnungsliebe, sondern weil jede Spalte eine
-- Frage beantwortet, die im Ernstfall gestellt wird.
--
--   Wem gehört die Datei?          user_id, und RLS darauf.
--   Was steht drin?                document_extractions, getrennt.
--   Was leiten wir daraus ab?      document_claims, mit Fundstelle.
--   Wofür darf es verwendet werden? document_permissions.
--
-- Die Trennung von Original, Text und Behauptung ist der Kern. Eine
-- Behauptung ohne Fundstelle im Originaltext ist eine Erfindung, und
-- eine Erfindung über den Lebenslauf einer Person ist der teuerste
-- Fehler, den dieses Produkt machen kann.

CREATE TABLE IF NOT EXISTS "user_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  /*
   * Wofür die Person die Datei hält — ihre Angabe, nicht unsere
   * Erkennung. Was wir erkennen, steht in `document_extractions.kind`.
   * Die beiden auseinanderzuhalten erlaubt die Rückfrage: „Du hast das
   * als Zeugnis hochgeladen, ich lese einen Lebenslauf — welches ist
   * es?"
   */
  "declared_kind" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "storage_bucket" text NOT NULL,
  "storage_path" text NOT NULL,
  "content_hash" text,
  /*
   * Wie weit die Verarbeitung ist.
   *
   * pending | scanning | extracting | ready | rejected | failed
   *
   * `scanning` ist ein eigener Schritt und kein Detail von
   * `extracting`: eine Datei, die die Prüfung nicht besteht, wird nie
   * gelesen. Das ist der Unterschied zwischen einer Ablehnung und
   * einem Vorfall.
   */
  "status" text NOT NULL DEFAULT 'pending',
  "rejected_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_documents_user_idx" ON "user_documents" ("user_id");
--> statement-breakpoint

-- Dieselbe Datei nicht zweimal ablegen. Personen laden ihren Lebenslauf
-- erfahrungsgemäss mehrfach hoch.
CREATE UNIQUE INDEX IF NOT EXISTS "user_documents_hash_idx"
  ON "user_documents" ("user_id", "content_hash")
  WHERE "content_hash" IS NOT NULL AND "deleted_at" IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "user_documents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "storage_path" text NOT NULL,
  "byte_size" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "document_versions_unique"
  ON "document_versions" ("document_id", "version");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_extractions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "user_documents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  /** Was wir zu erkennen glauben: cv | cover_letter | reference | certificate | job_ad | rejection | other */
  "kind" text NOT NULL,
  /** Der reine Text. Getrennt vom Original, damit das Original unberührt bleibt. */
  "plain_text" text,
  "page_count" integer,
  "language" text,
  "extractor" text NOT NULL,
  "extractor_version" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "document_extractions_doc_idx" ON "document_extractions" ("document_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "extraction_id" uuid NOT NULL REFERENCES "document_extractions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  /** skill | role | employer | period | qualification | tool | achievement */
  "kind" text NOT NULL,
  "statement" text NOT NULL,
  /*
   * Wo im Text es steht.
   *
   * Ohne Fundstelle darf keine Behauptung entstehen. Sie ist das, was
   * eine Ableitung von einer Erfindung unterscheidet — und das, was die
   * Person nachlesen kann, bevor sie etwas bestätigt.
   */
  "source_start" integer,
  "source_end" integer,
  "source_quote" text,
  "confidence" double precision NOT NULL DEFAULT 0.5,
  /*
   * Nichts wird automatisch bestätigt.
   *
   * Ein hochgeladener Lebenslauf ist eine Behauptung der Person über
   * sich selbst, kein Beleg. Er wird zur bestätigten Evidenz, wenn sie
   * ihn bestätigt — und nicht, weil eine Datei angekommen ist.
   */
  "user_confirmed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "document_claims_extraction_idx" ON "document_claims" ("extraction_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "user_documents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  /*
   * Wie weit die Datei reichen darf — die Wahl der Person.
   *
   * chat_only          nur in diesem Gespräch
   * application        für eine bestimmte Bewerbung
   * career_profile     dauerhaft ins Profil
   * none               gar nicht speichern
   *
   * Voreinstellung ist die engste. Wer nichts wählt, hat nicht
   * zugestimmt.
   */
  "scope" text NOT NULL DEFAULT 'chat_only',
  "conversation_id" uuid,
  "application_id" uuid,
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "document_permissions_doc_idx" ON "document_permissions" ("document_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_processing_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "user_documents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "step" text NOT NULL,
  "status" text NOT NULL,
  "detail" text,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "document_runs_doc_idx" ON "document_processing_runs" ("document_id");
