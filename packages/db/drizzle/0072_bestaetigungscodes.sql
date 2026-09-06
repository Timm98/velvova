-- Der sechsstellige Bestätigungscode.
--
-- ══════════════════════════════════════════════════════════════
-- Warum das nicht über `magic_links` läuft
-- ══════════════════════════════════════════════════════════════
--
-- Ein Anmeldelink trägt 43 zufällige Zeichen. Ein Code trägt sechs
-- Ziffern — eine Million Möglichkeiten, und die durchprobiert ein
-- Skript in Minuten. Beide in derselben Tabelle zu führen hiesse,
-- dieselben Schutzmassnahmen für zwei sehr verschiedene Geheimnisse
-- zu wählen.
--
-- Dieser Code braucht deshalb, was ein Link nicht braucht:
--
--   `versuche`  — nach fünf Fehlversuchen ist der Code verbrannt,
--                 nicht der Zugang gesperrt. Wer den richtigen Code
--                 hat, fordert einen neuen an; wer rät, fängt bei
--                 jedem Versuch von vorn an.
--
--   kurze Gültigkeit — zwanzig Minuten. Ein Code, der eine Woche gilt,
--                 hat eine Woche Zeit, erraten zu werden.
--
-- Gespeichert wird nur der Hash. Wer die Datenbank liest, kann sich
-- damit nichts bestätigen.
create table if not exists bestaetigungscodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- Die Adresse, an die gesendet wurde. Sie kann von `users.email`
  -- abweichen: Wer im zweiten Schritt seine Adresse korrigiert,
  -- bestätigt die neue, bevor sie ins Konto wandert.
  email text not null,
  code_hash text not null,
  -- Wofür der Code gilt. Heute nur `business_email`; die Spalte steht
  -- da, damit ein zweiter Zweck später keine zweite Tabelle braucht.
  zweck text not null default 'business_email',
  versuche smallint not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
--> statement-breakpoint

-- Der jüngste offene Code je Person und Zweck ist der gültige.
create index if not exists bestaetigungscodes_offen_idx
  on bestaetigungscodes (user_id, zweck, created_at desc)
  where consumed_at is null;
