-- ═══════════════════════════════════════════════════════════════
-- Dateiablage
-- ═══════════════════════════════════════════════════════════════
--
-- Drei private Buckets. Kein öffentlicher Lebenslauf, nirgends.
-- Der Pfad beginnt IMMER mit der Nutzerkennung — daran hängt die
-- gesamte Zugriffsregel:
--
--   {user_id}/{document_id}/{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'career-documents', 'career-documents', false, 20971520,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'image/jpeg',
      'image/png'
    ]
  ),
  (
    'application-documents', 'application-documents', false, 20971520,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  ),
  -- Sprachaufnahmen werden nur abgelegt, wenn die Person das
  -- ausdrücklich eingeschaltet hat. Die Voreinstellung ist: nach dem
  -- Abtippen löschen.
  (
    'voice-recordings', 'voice-recordings', false, 26214400,
    array['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4']
  )
on conflict (id) do nothing;

-- Der erste Pfadabschnitt ist die Nutzerkennung. Stimmt er nicht mit der
-- angemeldeten Person überein, gibt es keinen Zugriff — weder lesend
-- noch schreibend noch löschend.
do $$
declare
  b text;
  buckets text[] := array['career-documents', 'application-documents', 'voice-recordings'];
begin
  foreach b in array buckets loop
    execute format($p$
      create policy %I on storage.objects
        for select to authenticated
        using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$, b || '_select_own', b);

    execute format($p$
      create policy %I on storage.objects
        for insert to authenticated
        with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$, b || '_insert_own', b);

    execute format($p$
      create policy %I on storage.objects
        for update to authenticated
        using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$, b || '_update_own', b);

    execute format($p$
      create policy %I on storage.objects
        for delete to authenticated
        using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$, b || '_delete_own', b);
  end loop;
end $$;
