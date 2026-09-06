-- Der Double-Opt-in als Regel der Datenbank, nicht als Sorgfalt im Code.
--
-- ══════════════════════════════════════════════════════════════
-- Warum das nicht in der Anwendungsschicht bleibt
-- ══════════════════════════════════════════════════════════════
--
-- `email_aktiv = true` ohne `adresse_bestaetigt_am` heisst: An diese
-- Adresse geht Post, ohne dass jemand sie bestaetigt hat. Genau das
-- soll der Double-Opt-in verhindern.
--
-- Im Code steht die Regel an drei Stellen -- beim Anmelden, beim
-- Aktivieren eines Auftrags und unmittelbar vor der Uebergabe an den
-- Anbieter. Drei Stellen sind drei Gelegenheiten, sie beim naechsten
-- Umbau zu verlieren, und der Verlust faellt nicht auf: Es geht ja
-- etwas hinaus.
--
-- Als Bedingung an der Tabelle gibt es keinen Weg daran vorbei. Auch
-- kein Skript, kein Backfill, keine Migration von morgen.
--
-- Die umgekehrte Richtung ist ausdruecklich erlaubt: bestaetigt und
-- trotzdem aus. Das ist der Zustand nach „E-Mails aus, Suche weiter" --
-- der Nachweis bleibt, der Versand ruht.
DO $$
BEGIN
  ALTER TABLE "benachrichtigung_einstellungen"
    ADD CONSTRAINT "benachrichtigung_doi_pflicht"
    CHECK (NOT "email_aktiv" OR "adresse_bestaetigt_am" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$
