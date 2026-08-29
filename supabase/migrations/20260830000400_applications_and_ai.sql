-- ═══════════════════════════════════════════════════════════════
-- Bewerbungen, Dokumente, Coaching, KI-Protokolle
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  stage text not null default 'saved'
    check (stage in ('saved','preparing','ready','applied','interview','offer','rejected','withdrawn')),
  next_step text,
  due_at timestamptz,
  applied_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_user_stage_idx
  on public.applications (user_id, stage, updated_at desc);

create trigger applications_touch
  before update on public.applications
  for each row execute function public.touch_updated_at();

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists application_events_user_type_idx
  on public.application_events (user_id, type, occurred_at desc);

create table if not exists public.application_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  name text,
  role text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger application_contacts_touch
  before update on public.application_contacts
  for each row execute function public.touch_updated_at();

-- ── Dokumente ─────────────────────────────────────────────────
-- Hier stehen nur Metadaten. Die Datei liegt in einem privaten Bucket
-- unter {user_id}/{document_id}/{filename} und ist ausschließlich über
-- kurzlebige signierte Links erreichbar.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'other',
  filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  storage_bucket text not null default 'career-documents',
  storage_path text not null,
  sha256 text,
  malware_scan_status text not null default 'pending',
  malware_scan_at timestamptz,
  extracted_text text,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists documents_user_idx on public.documents (user_id)
  where deleted_at is null;

create trigger documents_touch
  before update on public.documents
  for each row execute function public.touch_updated_at();

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  kind text not null,
  locale text not null default 'de',
  version integer not null default 1,
  content text not null,
  -- Ohne diese Freigabe verlässt nichts das System.
  approved_by_user boolean not null default false,
  approved_at timestamptz,
  prompt_version text,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists document_versions_app_idx
  on public.document_versions (application_id, kind, version);

-- Jede Tatsachenbehauptung in einer erzeugten Bewerbung braucht einen
-- Beleg — oder die ausdrückliche Bestätigung der Person. Diese Tabelle
-- ist die Durchsetzung dieser Regel, nicht ihre Dokumentation.
create table if not exists public.document_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  claim_text text not null,
  evidence_id uuid references public.career_evidence(id) on delete set null,
  status text not null default 'user_confirmation_required'
    check (status in ('evidenced', 'rephrased', 'from_listing', 'user_confirmation_required')),
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists document_claims_version_idx
  on public.document_claims (document_version_id);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists application_documents_unique_idx
  on public.application_documents (application_id, document_version_id);

create table if not exists public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  mode text not null default 'text',
  kind text not null default 'general',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger coaching_sessions_touch
  before update on public.coaching_sessions
  for each row execute function public.touch_updated_at();

create table if not exists public.coaching_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  question text not null,
  question_origin text,
  answer text,
  -- Bewertet werden Struktur, Belege und Klarheit. NICHT: Stimme,
  -- Akzent, Ehrlichkeit, Auftreten. Das ist keine Auslassung, das ist
  -- die Regel.
  feedback jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists coaching_feedback_session_idx
  on public.coaching_feedback (session_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'in_app',
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

-- ── KI und Qualität ───────────────────────────────────────────
create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version text not null,
  content_hash text not null,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists prompt_versions_key_version_idx
  on public.prompt_versions (key, version);

-- Nur Kennungen, Modell, Token-Zahlen und Fehlerklassen. Keine
-- Lebensläufe, keine Gespräche, keine Dokumenttexte: Protokolle werden
-- gelesen, und dort haben Volltexte nichts zu suchen.
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  purpose text not null,
  provider text not null,
  model text not null,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  ok boolean not null default true,
  error_class text,
  created_at timestamptz not null default now()
);

create index if not exists ai_runs_user_idx on public.ai_runs (user_id, created_at desc);

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_kind text not null,
  subject_id uuid,
  verdict text not null,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  subject text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_events_user_idx
  on public.audit_events (user_id, created_at desc);
