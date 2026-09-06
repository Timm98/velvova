-- Gehaltsherkunft „employer" und Bewerbungsweg „internal".
--
-- Ein Gehalt, das der Arbeitgeber selbst einträgt, ist die
-- verlässlichste Herkunft im ganzen Index — verlässlicher als die
-- Angabe eines Portals, unvergleichlich viel verlässlicher als eine aus
-- dem Text gelesene Zahl. Ohne eigenen Wert müsste sie als „provider"
-- durchgehen und wäre von einer Portalangabe nicht mehr zu
-- unterscheiden.
--
-- Und der Bewerbungsweg: Eine selbst eingestellte Stelle führt nicht auf
-- ein fremdes Portal, sondern bleibt hier. Das ist der einzige Fall, in
-- dem wir überhaupt wissen, was mit einer Bewerbung passiert.
ALTER TYPE salary_provenance ADD VALUE IF NOT EXISTS 'employer'
--> statement-breakpoint
ALTER TYPE apply_method ADD VALUE IF NOT EXISTS 'internal'
