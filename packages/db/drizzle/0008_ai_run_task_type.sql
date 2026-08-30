-- Warum ein Modellaufruf welche Stufe bekam.
--
-- `purpose` sagt, wo im Produkt er herkam. Das reicht nicht, um die
-- Frage zu beantworten, die eine Rechnung aufwirft: lief die teure
-- Stufe zu Recht? Dafür braucht es die Aufgabe, die der Router gesehen
-- hat, und die Stufe, für die er sich entschieden hat.
ALTER TABLE "ai_runs" ADD COLUMN IF NOT EXISTS "task_type" text;
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD COLUMN IF NOT EXISTS "tier" text;
--> statement-breakpoint
-- Ein Modell, das plausibel antwortet und trotzdem das Schema verfehlt,
-- verschwindet sonst in der Erfolgsquote: der Aufruf war "ok", das
-- Ergebnis unbrauchbar. NULL heißt "keine Struktur verlangt".
ALTER TABLE "ai_runs" ADD COLUMN IF NOT EXISTS "structured_output_valid" boolean;
