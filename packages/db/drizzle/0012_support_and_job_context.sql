-- Zwei weitere Gesprächsarten (V7 §24.3 und §16).
--
-- `support`     — Hilfe und FAQ. Monday antwortet dort aus der
--                 Produktdokumentation, nicht aus dem Karriereprofil.
--                 Die eigene Art ist der Grund, warum sich diese
--                 Trennung überhaupt durchsetzen lässt: eine
--                 Supportfrage darf nie in den Karrierekontext geraten
--                 und umgekehrt (§29).
--
-- `job_context` — Kurzfragen direkt auf einer Stellenseite. Sie gehören
--                 zu genau dieser Anzeige und nicht ins Hauptgespräch.
--
-- Rein additiv. Bestehende Zeilen bleiben unberührt, kein Wert wird
-- entfernt. `IF NOT EXISTS` macht die Migration wiederholbar.

ALTER TYPE "nina_conversation_kind" ADD VALUE IF NOT EXISTS 'support';
--> statement-breakpoint
ALTER TYPE "nina_conversation_kind" ADD VALUE IF NOT EXISTS 'job_context';
