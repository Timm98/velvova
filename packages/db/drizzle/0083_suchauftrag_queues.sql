-- Die drei Warteschlangen des Suchauftrags.
--
-- Bedingt angelegt, aus demselben Grund wie 0081: `pgmq` ist in
-- Produktion installiert und in der Testumgebung nicht -- dort laeuft
-- PGlite im Speicher, und Erweiterungen lassen sich nicht nachladen.
--
-- Ein unbedingtes `pgmq.create` liesse jeden Test im Paket `db` an
-- einer Zeile scheitern, die mit dem Getesteten nichts zu tun hat.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgmq') THEN
    PERFORM pgmq.create('suchauftrag_profil');
    PERFORM pgmq.create('suchauftrag_suche');
    PERFORM pgmq.create('suchauftrag_versand');
  END IF;
END $$
