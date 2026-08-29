-- ═══════════════════════════════════════════════════════════════
-- Paycheck — Grundlagen: Erweiterungen, Identität, Einstellungen
-- ═══════════════════════════════════════════════════════════════
--
-- Grundsatz für alle folgenden Migrationen:
--
--   * Jede nutzerbezogene Tabelle trägt user_id → auth.users und hat
--     Row Level Security AN, mit ausformulierten Policies.
--   * Globale Tabellen (jobs, companies, skills) tragen KEINE
--     Nutzerzuordnung und sind für angemeldete Personen lesbar. Schreiben
--     darf nur der serverseitige Synchronisationsprozess.
--   * Ohne Policy kein Zugriff. RLS ohne Policy heißt: niemand darf
--     etwas — das ist die richtige Voreinstellung.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "vector" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- Zeitstempel fortschreiben, ohne es in jeder Anwendung zu wiederholen.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Profil ────────────────────────────────────────────────────
-- Eine Zeile je Konto. Hängt an auth.users, damit die Anmeldung
-- vollständig bei Supabase liegt und wir keine zweite Wahrheit über
-- Identität führen.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Einstellungen ─────────────────────────────────────────────
-- Drei getrennte Sprachen, weil es drei getrennte Entscheidungen sind:
-- Oberfläche, Gespräch mit der Assistenz, Bewerbungsunterlagen.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  ui_locale text not null default 'de',
  assistant_locale text not null default 'de',
  document_locale text not null default 'de',

  country_code text not null default 'DE',
  job_market_country text not null default 'DE',
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Berlin',
  distance_unit text not null default 'km',

  location_text text,
  latitude double precision,
  longitude double precision,
  search_radius_km integer,
  max_commute_minutes integer,
  commute_mode text not null default 'public_transport',
  relocation_willingness text not null default 'no',

  remote_preference text not null default 'no_preference',
  employment_types text[] not null default '{}',
  -- Leer heißt „nicht gesagt". Eine 0 wäre eine Aussage, und zwar eine
  -- falsche.
  desired_salary_min integer,
  desired_salary_period text not null default 'year',

  theme_preference text not null default 'system',
  voice_autoplay boolean not null default false,
  voice_captions boolean not null default true,
  voice_speed double precision not null default 1,
  delete_audio_after_transcript boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_touch
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();

-- ── Einwilligungen ────────────────────────────────────────────
-- Jede einzeln, mit Zweck, Fassung und Zeitpunkt. Der Widerruf steht in
-- derselben Zeile, damit die Geschichte nachvollziehbar bleibt.
create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  granted boolean not null,
  policy_version text not null,
  purpose text not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_consents_user_kind_idx
  on public.user_consents (user_id, kind);

create trigger user_consents_touch
  before update on public.user_consents
  for each row execute function public.touch_updated_at();

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email boolean not null default true,
  push boolean not null default false,
  -- Was hier bewusst fehlt: tägliche Erinnerungen und Serien. Eine
  -- Benachrichtigung braucht einen Anlass, keinen Zeitplan.
  deadline_reminders boolean not null default true,
  interview_reminders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

-- ── Neue Konten vorbereiten ───────────────────────────────────
-- Legt Profil, Einstellungen und Benachrichtigungen an, sobald jemand
-- sich registriert. Ohne diesen Auslöser müsste jede Anwendung daran
-- denken — und eine würde es vergessen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
