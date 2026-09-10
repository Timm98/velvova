-- ══════════════════════════════════════════════════════════════════
-- Die Verbindung zwischen freigegebenem Bedarf und einem Menschen
-- ══════════════════════════════════════════════════════════════════
--
-- ── Warum das aufgeschrieben wird und nicht nur gerechnet ───────
--
-- Weil eine Empfehlung veralten kann, ohne dass man es ihr ansieht.
-- Ein Vorschlag, der auf einem Bedarf von vor drei Monaten und einem
-- Profil von vor sechs Wochen beruht, ist keine Aussage ueber heute --
-- er sieht aber genauso aus wie ein frischer. `grundlage` haelt die
-- Versionsstaende fest, aus denen er entstanden ist; stimmen sie
-- nicht mehr, wird er als veraltet gezeigt.
--
-- Festgehalten werden Versionsstaende, keine Inhalte. Verglichen wird,
-- OB sich etwas geaendert hat, nicht was.
--
-- ── Warum die Person diese Zeile nicht liest ────────────────────
--
-- Der Zeilenschutz haengt allein an `organization_id`. Das ist eine
-- Vorschau fuer den Betrieb: Sie loest keine Nachricht aus, und der
-- Mensch erfaehrt von ihr nichts -- weil es noch nichts zu erfahren
-- gibt. Erst wenn der Betrieb tatsaechlich anfragt, entsteht etwas,
-- das ihn angeht, und dann gehoert es ihm gezeigt.
--
-- Dieselbe Bauart wie `posting_candidates`, aus demselben Grund.
--
-- Die Kehrseite steht hier, damit sie nicht vergessen wird: Solange
-- diese Tabelle nur der Organisation gehoert, gibt es keine Ansicht,
-- in der ein Mensch nachsieht, wem er vorgeschlagen wurde. Das ist
-- eine Schuld, kein Entwurf.
--
-- ── Was hier NICHT steht ────────────────────────────────────────
--
-- Keine Gehaltsuntergrenze der Person. Was jemand als Minimum
-- hinterlegt hat, erfaehrt die Gegenseite nicht -- auch dann nicht,
-- wenn es passt. Ein ueberlappendes Preisband ist keine vereinbarte
-- Verguetung, und eine Zahl, die einmal drueben steht, laesst sich
-- nicht zurueckholen.

create table if not exists bedarfstreffer (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vorgang_id uuid not null references bedarfsvorgaenge(id) on delete cascade,

  -- Der Mensch. Ohne `auffindbar = true` kommt er hier nie an.
  user_id uuid not null references users(id) on delete cascade,

  -- 0 bis 100, aus derselben Rechnung wie ueberall. `null` heisst:
  -- nicht ermittelbar, und das ist etwas anderes als null Punkte.
  passung integer,
  -- 0 bis 1. Ohne sie ist die Passung eine Zahl ohne Aussage.
  abdeckung real,

  -- Je harte Bedingung: erfuellt, nicht_erfuellt oder unbekannt.
  bedingungen jsonb not null default '[]'::jsonb,
  -- Die Saetze, die neben dem Vorschlag stehen.
  offene_punkte jsonb not null default '[]'::jsonb,
  -- Nur, was der Mensch zur Weitergabe freigegeben hat.
  freigegebene_nachweise jsonb not null default '[]'::jsonb,

  -- Der Fingerabdruck der Staende, aus denen der Vorschlag entstand.
  grundlage text not null,

  -- vorschau · angefragt · zurueckgezogen
  --
  -- Startet auf `vorschau` und bleibt es, bis ein Mensch im Betrieb
  -- etwas anderes tut. Ein Modell erreicht diesen Uebergang nicht.
  zustand text not null default 'vorschau',

  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint

-- Ein zweiter Lauf aktualisiert, er verdoppelt nicht.
create unique index if not exists bedarfstreffer_paar_idx
  on bedarfstreffer (vorgang_id, user_id);
--> statement-breakpoint

create index if not exists bedarfstreffer_organisation_idx
  on bedarfstreffer (organization_id, vorgang_id);
