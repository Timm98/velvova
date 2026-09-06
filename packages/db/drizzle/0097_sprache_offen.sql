-- Sprache: „nicht gesagt" von „deutsch gewaehlt" unterscheidbar machen.
--
-- ══════════════════════════════════════════════════════════════
-- Das Problem
-- ══════════════════════════════════════════════════════════════
--
-- Die drei Sprachspalten standen auf `not null default 'de'`. Beim
-- Anlegen eines Kontos entsteht die Einstellungszeile mit diesen
-- Vorgaben — und danach ist nicht mehr zu erkennen, ob jemand
-- deutsch GEWAEHLT hat oder ob es nie zur Sprache kam.
--
-- Gemessen am 7. September 2026: 1.001 Einstellungszeilen, davon
-- 1.001 mit `locale = 'de'`. Genau eine weicht bei Assistenz und
-- Dokumenten ab. Es hat also praktisch niemand etwas gewaehlt — und
-- alle bekamen deutsch, auch wer aus Zuerich oder London kam.
--
-- ══════════════════════════════════════════════════════════════
-- Was diese Migration tut
-- ══════════════════════════════════════════════════════════════
--
-- `null` wird erlaubt und heisst: nicht gesagt. Wer nichts gesagt
-- hat, bekommt die Sprache aus seiner Anfrage — `Accept-Language`,
-- sonst der Laendercode des CDN.
--
-- ── Und warum bestehende Zeilen zurueckgesetzt werden ────────
--
-- Weil sie sonst fuer immer als Wahl gelten wuerden. Eine Spalte,
-- die nur fuer kuenftige Konten ehrlich ist, aendert fuer 1.000 von
-- 1.024 Menschen nichts.
--
-- Zurueckgesetzt wird nur, wo ALLE DREI auf 'de' stehen: Wer eine
-- der drei verstellt hat, war im Einstellungsdialog und hat die
-- anderen beiden dort gesehen. Dessen Wahl bleibt.
--
-- Der Preis: Wer bewusst deutsch gewaehlt hat, ohne je etwas anderes
-- anzufassen, und mit englischem Browser unterwegs ist, sieht die
-- Seite kuenftig englisch. Er kann sie in den Einstellungen wieder
-- umstellen -- und dann steht dort eine echte Wahl.
ALTER TABLE user_settings ALTER COLUMN locale DROP NOT NULL
--> statement-breakpoint
ALTER TABLE user_settings ALTER COLUMN locale DROP DEFAULT
--> statement-breakpoint
ALTER TABLE user_settings ALTER COLUMN assistant_locale DROP NOT NULL
--> statement-breakpoint
ALTER TABLE user_settings ALTER COLUMN assistant_locale DROP DEFAULT
--> statement-breakpoint
ALTER TABLE user_settings ALTER COLUMN document_locale DROP NOT NULL
--> statement-breakpoint
ALTER TABLE user_settings ALTER COLUMN document_locale DROP DEFAULT
--> statement-breakpoint
UPDATE user_settings
   SET locale = NULL, assistant_locale = NULL, document_locale = NULL
 WHERE locale = 'de' AND assistant_locale = 'de' AND document_locale = 'de'
