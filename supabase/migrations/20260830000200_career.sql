-- ═══════════════════════════════════════════════════════════════
-- Karriereanalyse: Gespräch, Evidenz, Profil, Rollen
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'text',
  locale text not null default 'de',
  stage text not null default 'consent_and_goal',
  completed_stages text[] not null default '{}',
  skipped_stages text[] not null default '{}',
  status text not null default 'active',
  -- Verdichtete Fassung des bisherigen Gesprächs. Sie geht an das
  -- Modell statt des vollständigen Verlaufs: weniger Kontext, weniger
  -- übermittelte Daten, gleiche Qualität.
  summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_sessions_user_idx
  on public.interview_sessions (user_id, updated_at desc);

create trigger interview_sessions_touch
  before update on public.interview_sessions
  for each row execute function public.touch_updated_at();

create table if not exists public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seq integer not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  stage text,
  question_key text,
  content text not null,
  from_voice boolean not null default false,
  -- Welcher Prompt und welches Modell diese Antwort erzeugt haben.
  -- Ohne diese beiden Felder lässt sich später nicht sagen, warum eine
  -- Antwort so ausfiel.
  prompt_version text,
  model text,
  created_at timestamptz not null default now()
);

create unique index if not exists interview_messages_session_seq_idx
  on public.interview_messages (session_id, seq);

-- ── Evidenz ───────────────────────────────────────────────────
-- Der Kern des Produkts. Jede Aussage trägt ihren Status, und nur
-- „confirmed" zählt in Empfehlungen hinein.
create table if not exists public.career_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  statement text not null,
  kind text not null default 'strength',
  status text not null default 'inferred'
    check (status in ('confirmed', 'inferred', 'needs_evidence', 'rejected')),

  -- Situation, Aufgabe, Handlung, Ergebnis. Getrennte Felder, weil eine
  -- Stärke ohne Handlung und Ergebnis keine Stärke ist, sondern eine
  -- Behauptung.
  situation text,
  task text,
  action text,
  result text,

  source_type text not null default 'user_stated',
  source_ref text,
  source_document_id uuid,
  occurred_at date,
  -- Wie sicher die Ableitung ist, 0 bis 1. Nicht als Prozentzahl
  -- anzeigen: das wäre eine Genauigkeit, die es nicht gibt.
  confidence double precision not null default 0.5,
  embedding extensions.vector(1536),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists career_evidence_user_status_idx
  on public.career_evidence (user_id, status) where deleted_at is null;

create trigger career_evidence_touch
  before update on public.career_evidence
  for each row execute function public.touch_updated_at();

create table if not exists public.career_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  career_compass text,
  coverage double precision not null default 0,
  confirmed_by_user boolean not null default false,
  confirmed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger career_profiles_touch
  before update on public.career_profiles
  for each row execute function public.touch_updated_at();

-- Jede bestätigte Fassung bleibt erhalten. Ein Match verweist auf die
-- Profilfassung, gegen die er gerechnet wurde — sonst lässt sich ein
-- alter Score später nicht mehr erklären.
create table if not exists public.career_profile_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists career_profile_versions_user_version_idx
  on public.career_profile_versions (user_id, version);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label_de text not null,
  label_en text not null,
  -- Standardisierte Grundlage, damit Fähigkeiten über Rollen hinweg
  -- vergleichbar bleiben. Die eigenen Worte der Person werden zusätzlich
  -- gespeichert, damit das Profil menschlich bleibt.
  esco_uri text,
  category text not null default 'other',
  created_at timestamptz not null default now()
);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  raw_label text not null,
  level text,
  evidence_id uuid references public.career_evidence(id) on delete set null,
  status text not null default 'inferred'
    check (status in ('confirmed', 'inferred', 'needs_evidence', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_skills_user_idx on public.user_skills (user_id);

create trigger user_skills_touch
  before update on public.user_skills
  for each row execute function public.touch_updated_at();

create table if not exists public.role_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'obvious' check (kind in ('obvious', 'adjacent', 'niche')),
  rationale text not null,
  gaps text[] not null default '{}',
  critical_constraints text[] not null default '{}',
  entry_realism text not null default 'unclear',
  next_validation_step text,
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists role_recommendations_user_idx
  on public.role_recommendations (user_id);

create trigger role_recommendations_touch
  before update on public.role_recommendations
  for each row execute function public.touch_updated_at();

-- ── Freiwillige Kurzaufgaben ──────────────────────────────────
-- Ausdrücklich kein Persönlichkeitstest: arbeitsnahe Übungen, jederzeit
-- überspringbar, Ergebnis ist ein zusätzlicher Hinweis und kein Urteil.
create table if not exists public.micro_assessments (
  key text primary key,
  title_de text not null,
  title_en text not null,
  purpose_de text not null,
  purpose_en text not null,
  duration_minutes integer not null default 5,
  observes text[] not null default '{}'
);

create table if not exists public.micro_assessment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_key text not null references public.micro_assessments(key) on delete cascade,
  response jsonb not null default '{}',
  observation text,
  evidence_id uuid references public.career_evidence(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists micro_assessment_results_user_idx
  on public.micro_assessment_results (user_id);
