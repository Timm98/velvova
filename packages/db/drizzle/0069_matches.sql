-- Vorschläge, die Nina von sich aus macht — und die Einwilligung dazu.
--
-- ══════════════════════════════════════════════════════════════
-- 1 · Auffindbarkeit
-- ══════════════════════════════════════════════════════════════
--
-- Die Voreinstellung ist `false`, und das ist die wichtigste Zeile
-- dieser Migration.
--
-- Ein Vorschlag ist etwas anderes als eine Bewerbung: Bei der
-- Bewerbung hat sich ein Mensch entschieden, beim Vorschlag entscheidet
-- ein System über ihn. Wer davon erfasst wird, muss vorher zugestimmt
-- haben — sonst ist die ganze Einwilligungskette dahinter eine
-- Formalie, die auf einer Annahme aufbaut.
--
-- `true` als Vorgabe wäre bequemer für den Bestand: 1000 Konten wären
-- sofort auffindbar. Genau deshalb nicht.
alter table user_settings
  add column if not exists auffindbar boolean not null default false;
--> statement-breakpoint
alter table user_settings
  add column if not exists auffindbar_seit timestamptz;
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════
-- 2 · Die Vorschläge
-- ══════════════════════════════════════════════════════════════
--
-- ── Warum die Bewertung mitgespeichert wird ─────────────────
--
-- Sie liesse sich bei jedem Aufruf neu rechnen. Dann änderte sich aber
-- die Zahl unter der Hand: Ein Profil wird ergänzt, eine Anzeige
-- überarbeitet — und der Wert, über den ein Team gestern gesprochen
-- hat, ist heute ein anderer, ohne dass jemand es merkt.
--
-- Gespeichert ist die Bewertung ein Befund mit Datum. Ändert sich die
-- Grundlage, entsteht ein neuer Befund; der alte bleibt nachlesbar.
create table if not exists stellen_matches (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references job_postings(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  candidate_user_id uuid not null references users(id) on delete cascade,

  -- Der Gesamtwert und die drei Teilwerte. `null`, wenn die Datenbasis
  -- keine Zahl hergibt — dann steht das Band dafür.
  fit_gesamt smallint,
  fit_fachlich smallint,
  fit_persoenlich smallint,
  fit_langfristig smallint,
  band text not null default 'insufficient_data',
  -- Anteil der Kriterien, für die überhaupt Daten vorlagen (0..100).
  datenbasis smallint not null default 0,

  -- Die Begründung, aufgeteilt in die vier Arten von Aussage.
  -- Als JSON, weil die Anzahl je Match schwankt und eine eigene
  -- Tabelle für vier Textlisten mehr Verwaltung als Nutzen wäre.
  belegt jsonb not null default '[]'::jsonb,
  offen jsonb not null default '[]'::jsonb,
  entwickelbar jsonb not null default '[]'::jsonb,
  ausschluss jsonb not null default '[]'::jsonb,

  gehalt_ueberschneidung text,
  verfuegbarkeit text,

  -- Die neun Zustände der Einwilligungskette.
  zustand text not null default 'anonym_erkannt',
  freigabe_angefragt_am timestamptz,
  freigabe_erteilt_am timestamptz,
  freigabe_widerrufen_am timestamptz,
  interesse_unternehmen_am timestamptz,
  interesse_person_am timestamptz,
  kontakt_offen_am timestamptz,
  abgelehnt_am timestamptz,
  abgelehnt_von text,
  ablauf_am timestamptz,

  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint

-- Ein Mensch erscheint je Stelle genau einmal. Ohne diese Bedingung
-- entstünde bei jedem Lauf ein zweiter Vorschlag für dieselbe Person,
-- und das Team sähe sie doppelt — mit zwei verschiedenen Zahlen.
create unique index if not exists stellen_matches_unique
  on stellen_matches (posting_id, candidate_user_id);
--> statement-breakpoint
create index if not exists stellen_matches_org_idx
  on stellen_matches (organization_id, zustand, fit_gesamt desc nulls last);
--> statement-breakpoint
create index if not exists stellen_matches_person_idx
  on stellen_matches (candidate_user_id, zustand);
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════
-- 3 · Die Automatisierung
-- ══════════════════════════════════════════════════════════════
--
-- Eine Zeile je Stelle, oder eine je Organisation als Vorgabe
-- (`posting_id is null`).
--
-- ── Warum Stufe 1 die Vorgabe ist ───────────────────────────
--
-- Stufe 1 heisst „nur Vorschläge": Nina rechnet, ein Mensch
-- entscheidet. Wer mehr will, schaltet es ein und weiss dann, dass er
-- es eingeschaltet hat. Eine höhere Vorgabe hiesse, dass Nachrichten
-- an Menschen herausgehen, weil niemand die Einstellung gelesen hat.
create table if not exists match_regeln (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  posting_id uuid references job_postings(id) on delete cascade,

  -- 1 nur Vorschläge · 2 Freigaben automatisch anfragen · 3 automatisch verbinden
  stufe smallint not null default 1,
  min_fit smallint not null default 80,
  -- Weitere Bedingungen, die erfüllt sein müssen. Frei erweiterbar,
  -- aber immer sichtbar: Was hier steht, wird in der Oberfläche
  -- angezeigt, sonst wäre die Regel nicht erklärbar.
  bedingungen jsonb not null default '{}'::jsonb,

  pausiert_am timestamptz,
  geaendert_von uuid references users(id) on delete set null,
  geaendert_am timestamptz not null default now()
);
--> statement-breakpoint
create unique index if not exists match_regeln_unique
  on match_regeln (organization_id, coalesce(posting_id, '00000000-0000-0000-0000-000000000000'::uuid));
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════
-- 4 · Das Protokoll
-- ══════════════════════════════════════════════════════════════
--
-- Jede automatische Handlung wird festgehalten — wer sie ausgelöst
-- hat (ein Mensch oder eine Regel), auf welchen Match sie sich bezog
-- und unter welcher Bedingung.
--
-- Ohne dieses Protokoll wäre „jederzeit widerrufbar" nicht prüfbar:
-- Man könnte eine Automatisierung abschalten, aber nicht mehr
-- feststellen, was sie vorher getan hat.
create table if not exists match_protokoll (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  match_id uuid references stellen_matches(id) on delete set null,
  -- 'regel' oder eine Nutzerkennung als Text.
  ausgeloest_von text not null,
  handlung text not null,
  begruendung text not null default '',
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists match_protokoll_org_idx
  on match_protokoll (organization_id, erstellt_am desc);
