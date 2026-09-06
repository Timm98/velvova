-- Der Pfad zum Profilbild.
--
-- Nur der Pfad, nicht das Bild: Ein `bytea` in `user_settings` würde
-- bei jeder Abfrage mitgelesen, auch wenn nur die Region gebraucht
-- wird. Die Datei liegt in derselben Ablage wie die
-- Bewerbungsunterlagen.
--
-- `null` heisst „kein Bild"; dann steht weiterhin der
-- Anfangsbuchstabe im Kontomenü.
alter table user_settings add column if not exists avatar_pfad text;
