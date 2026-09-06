-- Der dritte Plan und die fehlenden Abrechnungsfelder.
--
-- „max" kommt zum Enum hinzu, nicht als freier Text. Ein Plan, den die
-- Datenbank nicht kennt, ist ein Tippfehler, der erst beim Abrechnen
-- auffällt.
--
-- Postgres erlaubt ADD VALUE seit 12 auch innerhalb einer Transaktion,
-- solange der neue Wert danach nicht im selben Befehl benutzt wird.
-- Deshalb steht er allein.

ALTER TYPE "plan_key" ADD VALUE IF NOT EXISTS 'max';
--> statement-breakpoint

-- Der Beginn des Zeitraums fehlte. Ohne ihn lässt sich „seit wann
-- läuft das" nicht beantworten und eine anteilige Erstattung nicht
-- rechnen — beides steht in der Abrechnung, nicht im Rateraum.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;
--> statement-breakpoint

-- Das Ende einer Testphase. Getrennt vom Zeitraum, weil eine Testphase
-- endet, ohne dass etwas abgebucht wird — das ist ein anderer Vorgang
-- als ein Abrechnungszeitraum, der ausläuft.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trial_end" timestamp with time zone;
