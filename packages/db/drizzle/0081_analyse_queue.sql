-- Die Warteschlange für Analyseaufträge.
--
-- Getrennt von 0080, weil `pgmq.create` die Erweiterung braucht und
-- eine Migration in Postgres nicht garantiert sieht, was eine frühere
-- Anweisung derselben Transaktion angelegt hat.
--
-- `pgmq.create` ist idempotent — ein zweiter Aufruf legt nichts an und
-- wirft nicht. Damit läuft diese Migration auf einer frischen und auf
-- einer bestehenden Datenbank gleich.
-- Ebenfalls bedingt: Ohne die Erweiterung gibt es das Schema `pgmq`
-- nicht, und ein Verweis darauf schlägt schon beim Parsen fehl.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgmq') THEN
    PERFORM pgmq.create('job_analyse');
  END IF;
END $$;
