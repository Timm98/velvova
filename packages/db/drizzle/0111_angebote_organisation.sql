-- ══════════════════════════════════════════════════════════════════
-- Ein Angebot gehoert einer Organisation, nicht einer Firma
-- ══════════════════════════════════════════════════════════════════
--
-- In 0110 hing `angebote` an `companies` -- dem Eintrag im
-- Stellenindex. Das war falsch, und zwar an der Stelle, an der es
-- weh tut: Der Zeilenschutz dieser Anwendung kennt zwei Anker, und
-- `company_id` ist keiner davon.
--
--   `user_id`           die Eigentuemerregel: user_id = app_current_user_id()
--   `organization_id`   die Mitgliedsregel:  app_is_org_member(organization_id)
--
-- Ein Angebot gehoert keinem einzelnen Menschen und auch nicht einem
-- Eintrag im Stellenindex, sondern dem registrierten Arbeitgeber --
-- also der Organisation. Erst damit gilt: Wer Mitglied ist, sieht die
-- Angebote seines Hauses; alle anderen sehen keine Zeile.
--
-- Aufgefallen ist es beim Anwenden von 0110: Die Richtlinie liess sich
-- nicht anlegen ("column user_id does not exist"). Das war kein
-- Hindernis, sondern der Hinweis, dass die Tabelle am falschen Anker
-- hing.
--
-- ── Warum `company_id` bleibt und nullbar wird ──────────────────
--
-- Die Verbindung zum Stellenindex ist trotzdem wertvoll: Sie
-- beantwortet "wie viele Kandidaten liegen ueber eurer letzten
-- Anzeige". Aber sie ist nicht die Eigentumsfrage. Und ein Betrieb,
-- der noch nie eine Anzeige geschaltet hat, hat keinen Eintrag im
-- Stellenindex -- genau der Betrieb ist die Zielgruppe von Modul E.

alter table angebote
  add column if not exists organization_id uuid references organizations(id) on delete cascade;
--> statement-breakpoint

alter table angebote
  alter column company_id drop not null;
--> statement-breakpoint

create index if not exists angebote_organisation_idx
  on angebote (organization_id, status);
