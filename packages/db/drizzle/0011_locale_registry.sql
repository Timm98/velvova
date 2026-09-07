-- Mondays Sprachen (V7 §20.2).
--
-- Der Aufzählungstyp `locale` kannte genau zwei Werte: 'de' und 'en'.
-- Für die OBERFLÄCHE reicht das auch weiterhin — mehr Sprachen gibt es
-- dort erst, wenn ihre Texte übersetzt sind, und das misst die
-- Registry selbst.
--
-- Für das GESPRÄCH und für BEWERBUNGSUNTERLAGEN reicht es nicht.
-- Mondays Antworten entstehen im Modell und brauchen keinen Katalog; wer
-- lieber auf Türkisch über seine Laufbahn spricht, soll das können,
-- während die Oberfläche deutsch bleibt. Genau diese Trennung steht in
-- §20.1, und ohne die zusätzlichen Werte liesse sie sich nicht
-- speichern.
--
-- Rein additiv: bestehende Zeilen bleiben unberührt, kein Wert wird
-- entfernt, keine Spalte geändert. PostgreSQL kann Werte eines
-- Aufzählungstyps allerdings NICHT wieder löschen — diese Migration ist
-- deshalb praktisch einseitig. Sie fügt genau die zwölf Sprachen aus
-- §20.2 hinzu und sonst nichts.
--
-- `IF NOT EXISTS` macht sie wiederholbar: ein zweiter Lauf tut nichts.

ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'fr';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'es';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'it';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'nl';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'pl';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'pt';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'tr';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'uk';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'ar';
--> statement-breakpoint
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'ru';
