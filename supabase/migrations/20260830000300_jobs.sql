-- ═══════════════════════════════════════════════════════════════
-- Stellen: Anbieter, Unternehmen, kanonisches Schema, Import
-- ═══════════════════════════════════════════════════════════════
--
-- Diese Tabellen tragen KEINE Nutzerzuordnung. Sie sind für angemeldete
-- Personen lesbar; geschrieben wird ausschließlich vom serverseitigen
-- Synchronisationsprozess mit dem Dienstschlüssel.

create table if not exists public.job_providers (
  key text primary key,
  display_name text not null,
  -- Eine Quelle ohne geklärte Rechtslage wird nicht aktiviert.
  license_status text not null default 'unclear',
  attribution_required boolean not null default false,
  attribution_text text,
  terms_url text,
  enabled boolean not null default false,
  last_run_at timestamptz,
  last_run_ok boolean,
  last_run_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger job_providers_touch
  before update on public.job_providers
  for each row execute function public.touch_updated_at();

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  domain text,
  website text,
  industry text,
  size_band text,
  headquarters text,
  -- Nur true, wenn aus einem offiziellen Register bestätigt. Ein Haken
  -- ohne Prüfung wäre eine Behauptung.
  registry_verified boolean not null default false,
  registry_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companies_normalized_name_idx
  on public.companies (normalized_name);

create trigger companies_touch
  before update on public.companies
  for each row execute function public.touch_updated_at();

-- ── Kanonisches Stellenschema ─────────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.job_providers(key),
  external_id text not null,
  source_url text not null,
  apply_url text,

  title_raw text not null,
  title_normalized text not null,
  company_id uuid references public.companies(id) on delete set null,
  company_name text not null,
  company_domain text,

  location_text text not null default 'Nicht angegeben',
  country_code text,
  city text,
  latitude double precision,
  longitude double precision,

  remote_type text check (remote_type in ('on_site', 'hybrid', 'remote')),
  employment_type text,
  seniority text,

  -- Gehalt bleibt leer, wenn die Quelle keines nennt. Es wird nie
  -- geschätzt und nie als 0 ausgewiesen: nicht offengelegt heißt nicht
  -- offengelegt.
  salary_min integer,
  salary_max integer,
  salary_currency text,
  salary_period text,
  salary_is_estimate boolean not null default false,

  description_html_sanitized text,
  description_text text not null default '',
  responsibilities text[] not null default '{}',
  requirements_must text[] not null default '{}',
  requirements_nice text[] not null default '{}',
  benefits text[] not null default '{}',
  skills text[] not null default '{}',
  language text,

  posted_at timestamptz,
  expires_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,

  source_attribution text,
  -- Erkennt dieselbe Anzeige über Anbieter hinweg.
  content_hash text not null,
  embedding extensions.vector(1536),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ein Anbieter, eine externe Kennung: das ist die Identität einer
-- Anzeige. Der Upsert hängt an genau diesem Index.
create unique index if not exists jobs_provider_external_idx
  on public.jobs (provider, external_id);

create index if not exists jobs_content_hash_idx on public.jobs (content_hash);
create index if not exists jobs_active_posted_idx
  on public.jobs (is_active, posted_at desc nulls last);
create index if not exists jobs_company_idx on public.jobs (company_id);
create index if not exists jobs_country_city_idx on public.jobs (country_code, city);

-- Volltextsuche über Titel, Unternehmen und Beschreibung.
create index if not exists jobs_fts_idx on public.jobs
  using gin (
    to_tsvector(
      'simple',
      coalesce(title_raw, '') || ' ' || coalesce(company_name, '') || ' ' ||
      coalesce(location_text, '') || ' ' || coalesce(description_text, '')
    )
  );

-- Ähnlichkeitssuche für Titel, damit „Kundenbetreuung" auch
-- „Kundenbetreuer:in" findet.
create index if not exists jobs_title_trgm_idx on public.jobs
  using gin (title_normalized extensions.gin_trgm_ops);

-- Bedeutungssuche. Der Index lohnt erst ab einigen tausend Zeilen, steht
-- aber von Anfang an, damit später keine Migration unter Last nötig ist.
create index if not exists jobs_embedding_idx on public.jobs
  using hnsw (embedding extensions.vector_cosine_ops);

create trigger jobs_touch
  before update on public.jobs
  for each row execute function public.touch_updated_at();

create table if not exists public.job_skills (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  raw_label text not null,
  requirement_kind text not null default 'must' check (requirement_kind in ('must', 'nice')),
  created_at timestamptz not null default now()
);

create index if not exists job_skills_job_idx on public.job_skills (job_id);

-- Jeder Lauf wird protokolliert. Ein stiller Teilausfall sieht sonst aus
-- wie Erfolg.
create table if not exists public.job_import_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.job_providers(key),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  unchanged integer not null default 0,
  deactivated integer not null default 0,
  failed integer not null default 0,
  first_error text,
  created_at timestamptz not null default now()
);

create index if not exists job_import_runs_provider_idx
  on public.job_import_runs (provider, started_at desc);

create table if not exists public.company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_kind text not null,
  source_name text not null,
  source_url text,
  license_status text not null default 'public_link_only',
  attribution_text text,
  -- Bewertungstexte werden nicht gespeichert, wenn die Bedingungen der
  -- Quelle das nicht erlauben. Was bleibt, ist der Verweis.
  rating_average double precision,
  rating_scale_max double precision,
  sample_size integer,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists company_sources_company_idx
  on public.company_sources (company_id);

-- ── Nutzerbezogenes rund um Stellen ───────────────────────────
create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists saved_jobs_user_job_idx
  on public.saved_jobs (user_id, job_id);

-- ── Matches ───────────────────────────────────────────────────
-- Auditierbar: gespeichert werden nicht nur der Wert, sondern auch die
-- Fassungen, gegen die gerechnet wurde. Ohne sie lässt sich ein alter
-- Score später nicht erklären und nicht nachrechnen.
create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,

  score integer not null check (score between 0 and 100),
  breakdown jsonb not null default '{}',
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  confidence_score integer,
  -- Verletzte harte Bedingungen. Eine davon führt zu „blocked" — sie
  -- wird nicht gegen weiche Stärken aufgerechnet.
  blockers jsonb not null default '[]',
  reasons jsonb not null default '[]',
  risks jsonb not null default '[]',
  missing_information jsonb not null default '[]',
  explanation text,

  profile_version integer,
  job_updated_at timestamptz,
  algorithm_version text not null,
  model text,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists job_matches_user_job_idx
  on public.job_matches (user_id, job_id);
create index if not exists job_matches_user_score_idx
  on public.job_matches (user_id, score desc);

create table if not exists public.job_analysis (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  data_as_of date,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create unique index if not exists job_analysis_job_kind_idx
  on public.job_analysis (job_id, kind);
