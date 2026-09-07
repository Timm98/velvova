-- Wer das Ereignis ausgeloest hat.
--
-- ══════════════════════════════════════════════════════════════
-- Der Kreis, den diese Spalte verhindert
-- ══════════════════════════════════════════════════════════════
--
-- Monday merkt eine Stelle vor, weil sie Interesse vermutet. Wuerde
-- daraus ein Ereignis entstehen, das wie eine Nutzerhandlung
-- aussieht, bestaetigte Monday ihre eigene Vermutung -- und beim
-- naechsten Lauf staerker, und beim uebernaechsten noch staerker.
--
-- Am Ende stuende in `verhaltenssignale` ein sehr starkes Signal,
-- dessen Belege ausschliesslich Mondays eigene Handlungen sind. Von
-- aussen sieht das aus wie ein Mensch mit klarem Interesse.
--
-- Nur `user` verstaerkt. Alles andere wird beobachtet, gezaehlt und
-- angezeigt -- aber es zaehlt nicht als Aussage ueber die Person.
ALTER TABLE "nutzer_ereignisse" ADD COLUMN IF NOT EXISTS "urheber" text NOT NULL DEFAULT 'user'
--> statement-breakpoint
ALTER TABLE "nutzer_ereignisse" DROP CONSTRAINT IF EXISTS "nutzer_ereignisse_urheber_gueltig"
--> statement-breakpoint
ALTER TABLE "nutzer_ereignisse" ADD CONSTRAINT "nutzer_ereignisse_urheber_gueltig"
  CHECK ("urheber" IN ('user', 'nina', 'system'))
--> statement-breakpoint
-- Die Signalableitung liest nur `user`. Der Index deckt genau das.
CREATE INDEX IF NOT EXISTS "nutzer_ereignisse_urheber_idx"
  ON "nutzer_ereignisse" ("user_id", "urheber", "geschehen_am")
