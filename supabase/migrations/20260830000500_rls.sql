-- ═══════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════
--
-- Zwei Arten von Tabellen, zwei Regeln:
--
--   Nutzerbezogen  → nur die eigene Zeile, in allen vier Richtungen.
--   Global         → für Angemeldete lesbar, schreiben darf nur der
--                    serverseitige Prozess mit dem Dienstschlüssel.
--
-- RLS wird auf JEDER Tabelle eingeschaltet, auch auf den globalen. Ohne
-- passende Policy heißt das: niemand darf etwas. Das ist die richtige
-- Voreinstellung — eine vergessene Policy fällt sofort auf, ein
-- vergessenes „enable" niemals.
--
-- Der Dienstschlüssel umgeht RLS grundsätzlich. Er gehört ausschließlich
-- auf den Server und niemals in ein Client-Bundle.

-- ── Nutzerbezogene Tabellen ───────────────────────────────────
do $$
declare
  t text;
  owned text[] := array[
    'user_preferences', 'user_consents', 'notification_preferences',
    'interview_sessions', 'interview_messages',
    'career_evidence', 'career_profiles', 'career_profile_versions',
    'user_skills', 'role_recommendations', 'micro_assessment_results',
    'saved_jobs', 'job_matches',
    'applications', 'application_events', 'application_contacts',
    'documents', 'document_versions', 'document_claims', 'application_documents',
    'coaching_sessions', 'coaching_feedback',
    'notifications', 'feedback_events'
  ];
begin
  foreach t in array owned loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    -- Vier getrennte Policies statt einer für ALL: so steht sichtbar da,
    -- dass auch das Einfügen an die eigene Kennung gebunden ist. Eine
    -- gemeinsame Policy verdeckt genau diesen Punkt.
    execute format($p$
      create policy %I on public.%I
        for select to authenticated
        using ((select auth.uid()) = user_id)
    $p$, t || '_select_own', t);

    execute format($p$
      create policy %I on public.%I
        for insert to authenticated
        with check ((select auth.uid()) = user_id)
    $p$, t || '_insert_own', t);

    execute format($p$
      create policy %I on public.%I
        for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $p$, t || '_update_own', t);

    execute format($p$
      create policy %I on public.%I
        for delete to authenticated
        using ((select auth.uid()) = user_id)
    $p$, t || '_delete_own', t);
  end loop;
end $$;

-- ── Profil ────────────────────────────────────────────────────
-- Sonderfall: der Schlüssel heißt hier id, nicht user_id.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- ── Globale Tabellen ──────────────────────────────────────────
-- Lesen ja, schreiben nein. Es gibt bewusst KEINE Insert- oder
-- Update-Policy: der Synchronisationsprozess läuft mit dem
-- Dienstschlüssel und umgeht RLS. Damit kann keine angemeldete Person
-- eine Stellenanzeige anlegen oder verändern.
do $$
declare
  t text;
  global text[] := array[
    'job_providers', 'companies', 'jobs', 'job_skills',
    'skills', 'micro_assessments', 'company_sources', 'job_analysis'
  ];
begin
  foreach t in array global loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$
      create policy %I on public.%I
        for select to authenticated using (true)
    $p$, t || '_select_all', t);
  end loop;
end $$;

-- ── Nur serverseitig ──────────────────────────────────────────
-- Importläufe, Prompt-Fassungen, KI-Protokolle und Prüfspuren gehen
-- niemanden im Browser etwas an. RLS an, keine Policy: niemand darf
-- etwas, außer dem Dienstschlüssel.
do $$
declare
  t text;
  server_only text[] := array['job_import_runs', 'prompt_versions', 'audit_events'];
begin
  foreach t in array server_only loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- KI-Protokolle: die eigene Person darf sehen, was zu ihr gelaufen ist.
-- Das ist keine Höflichkeit, sondern Teil der Auskunftspflicht.
alter table public.ai_runs enable row level security;
create policy ai_runs_select_own on public.ai_runs
  for select to authenticated using ((select auth.uid()) = user_id);
