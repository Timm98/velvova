-- ═══════════════════════════════════════════════════════════════
-- Ninas Gedächtnis und der Zustand des Vorgangs
-- ═══════════════════════════════════════════════════════════════
--
-- Der Zustand liegt in der Datenbank, nicht im Prompt und nicht im
-- Browser. Das ist der Unterschied zwischen „die Assistenz erinnert
-- sich" und „der Verlauf war zufällig noch im Kontextfenster".
--
-- Jede Zeile hier gehört genau einer Person. Die Nutzerkennung kommt
-- aus der Sitzung; sie steht in keinem Werkzeugschema und kann von
-- keinem Gespräch beeinflusst werden.

-- ── Kampagne ──────────────────────────────────────────────────
-- Der aktive Suchkontext. Wer parallel „Wechsel in die Pflege" und
-- „Werkstudium nebenbei" verfolgt, führt zwei Kampagnen — sonst
-- vermischen sich Ziele, Regionen und Rollencluster zu einem Brei.
create table if not exists public.job_search_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid references public.career_profiles(user_id) on delete set null,
  name text not null,
  goal text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived', 'succeeded')),
  target_start_date date,
  countries text[] not null default '{}',
  regions text[] not null default '{}',
  role_cluster_ids uuid[] not null default '{}',
  search_preferences_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists job_search_campaigns_user_idx
  on public.job_search_campaigns (user_id, status, updated_at desc);

create trigger job_search_campaigns_touch
  before update on public.job_search_campaigns
  for each row execute function public.touch_updated_at();

-- ── Zustand des Vorgangs ──────────────────────────────────────
-- Version ist Pflicht: zwei Geräte, die gleichzeitig weiterschalten,
-- dürfen sich nicht gegenseitig überschreiben.
create table if not exists public.workflow_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.job_search_campaigns(id) on delete cascade,
  conversation_id uuid,
  application_id uuid references public.applications(id) on delete set null,

  stage text not null default 'ACCOUNT_SETUP' check (stage in (
    'ACCOUNT_SETUP', 'CAREER_INTERVIEW', 'PROFILE_REVIEW', 'ROLE_DISCOVERY',
    'JOB_SEARCH', 'JOB_REVIEW', 'APPLICATION_PREP', 'APPLICATION_REVIEW',
    'APPLY_REDIRECT', 'APPLICATION_TRACKING', 'INTERVIEW_COACHING',
    'OFFER_REVIEW', 'HIRED', 'CAREER_MODE'
  )),
  last_completed_action text,
  current_action text,
  pending_action text,
  next_recommended_action text,
  selected_job_ids uuid[] not null default '{}',
  state_json jsonb not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workflow_states_user_campaign_idx
  on public.workflow_states (user_id, coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid));

create trigger workflow_states_touch
  before update on public.workflow_states
  for each row execute function public.touch_updated_at();

-- ── Gedächtnis ────────────────────────────────────────────────
-- Nach Geltungsbereich getrennt. In einen Modellaufruf geht nur der
-- Bereich, der zur Aufgabe gehört — nicht das ganze Leben der Person.
create table if not exists public.nina_memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  scope_type text not null
    check (scope_type in ('account', 'career_profile', 'campaign', 'application', 'conversation')),
  scope_id uuid,

  memory_type text not null check (memory_type in (
    'fact', 'preference', 'constraint', 'goal', 'evidence',
    'decision', 'open_question', 'task', 'summary'
  )),
  content_json jsonb not null,

  source_type text not null default 'user_stated',
  source_id uuid,
  confidence double precision not null default 0.5,
  -- Was das Modell ableitet, ist unbestätigt. Auf bestätigt setzt
  -- ausschließlich ein Mensch.
  user_confirmed boolean not null default false,
  sensitivity_level text not null default 'normal'
    check (sensitivity_level in ('normal', 'sensitive', 'special_category')),

  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  embedding extensions.vector(1536),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists nina_memory_scope_idx
  on public.nina_memory_items (user_id, scope_type, scope_id)
  where deleted_at is null;

create index if not exists nina_memory_confirmed_idx
  on public.nina_memory_items (user_id, memory_type, user_confirmed)
  where deleted_at is null;

create trigger nina_memory_items_touch
  before update on public.nina_memory_items
  for each row execute function public.touch_updated_at();

-- ── Verdichteter Gesprächsverlauf ─────────────────────────────
-- Geht an das Modell statt des vollständigen Verlaufs: weniger
-- Kontext, weniger übermittelte Daten, gleiche Qualität.
create table if not exists public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null,
  covered_until_message_id uuid,
  facts_json jsonb not null default '[]',
  open_questions_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_summaries_conv_idx
  on public.conversation_summaries (conversation_id, created_at desc);

create trigger conversation_summaries_touch
  before update on public.conversation_summaries
  for each row execute function public.touch_updated_at();

-- ── Reproduzierbarer Kontext eines Laufs ──────────────────────
-- Nur Verweise, keine Volltexte: damit lässt sich später sagen, WORAUF
-- eine Antwort beruhte, ohne das Gespräch zu archivieren.
create table if not exists public.context_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.job_search_campaigns(id) on delete set null,
  conversation_id uuid,
  application_id uuid references public.applications(id) on delete set null,
  task_type text not null,
  career_profile_version integer,
  workflow_version integer,
  memory_item_ids uuid[] not null default '{}',
  job_ids uuid[] not null default '{}',
  schema_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists context_snapshots_user_idx
  on public.context_snapshots (user_id, created_at desc);

create table if not exists public.nina_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.job_search_campaigns(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'dropped')),
  priority integer not null default 3,
  due_at timestamptz,
  created_by text not null default 'nina' check (created_by in ('user', 'nina', 'system')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nina_tasks_user_status_idx
  on public.nina_tasks (user_id, status, priority);

create trigger nina_tasks_touch
  before update on public.nina_tasks
  for each row execute function public.touch_updated_at();

-- ── Feldgenaue Herkunft einer Stellenangabe ───────────────────
create table if not exists public.job_field_provenance (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_source_link_id uuid,
  field_name text not null,
  source_value_hash text,
  normalized_value_json jsonb,
  transform_type text not null check (transform_type in (
    'verbatim_allowed', 'normalized', 'ai_summary', 'inferred', 'unknown'
  )),
  -- Woraus eine Zusammenfassung oder Ableitung entstand. Leer ist bei
  -- ai_summary und inferred nicht zulässig; die Anwendung weist das ab.
  derived_from text[] not null default '{}',
  source_url text,
  fetched_at timestamptz,
  confidence double precision not null default 1,
  display_allowed boolean not null default true,
  citation_label text,
  created_at timestamptz not null default now()
);

create unique index if not exists job_field_provenance_unique_idx
  on public.job_field_provenance (job_id, field_name);

-- ── Entdeckte, noch nicht bewertete Adressen ──────────────────
-- Ausdrücklich kurzlebig. Dies ist kein Schattenindex fremder
-- Jobbörsen, sondern eine Warteschlange für Entscheidungen.
create table if not exists public.web_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid references public.job_search_campaigns(id) on delete cascade,
  discovered_url text not null,
  domain text not null,
  discovery_provider text not null,
  discovered_at timestamptz not null default now(),
  source_registry_id text,
  policy_decision text not null check (policy_decision in (
    'approved', 'link_only', 'private_import', 'blocked', 'pending_review'
  )),
  policy_reason text not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists web_discovery_candidates_expiry_idx
  on public.web_discovery_candidates (expires_at);

-- ── Row Level Security ────────────────────────────────────────
do $$
declare
  t text;
  owned text[] := array[
    'job_search_campaigns', 'workflow_states', 'nina_memory_items',
    'conversation_summaries', 'context_snapshots', 'nina_tasks',
    'web_discovery_candidates'
  ];
begin
  foreach t in array owned loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format($p$
      create policy %I on public.%I
        for select to authenticated using ((select auth.uid()) = user_id)
    $p$, t || '_select_own', t);

    execute format($p$
      create policy %I on public.%I
        for insert to authenticated with check ((select auth.uid()) = user_id)
    $p$, t || '_insert_own', t);

    execute format($p$
      create policy %I on public.%I
        for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $p$, t || '_update_own', t);

    execute format($p$
      create policy %I on public.%I
        for delete to authenticated using ((select auth.uid()) = user_id)
    $p$, t || '_delete_own', t);
  end loop;
end $$;

-- Herkunftsangaben gehören zur Stelle, nicht zur Person: lesbar für
-- Angemeldete, geschrieben ausschließlich vom serverseitigen Lauf.
alter table public.job_field_provenance enable row level security;
create policy job_field_provenance_select_all on public.job_field_provenance
  for select to authenticated using (true);
