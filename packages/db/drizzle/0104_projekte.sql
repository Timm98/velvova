-- ══════════════════════════════════════════════════════════════════
-- Projekte: ein Suchvorhaben mit allem, was dazugehoert
-- ══════════════════════════════════════════════════════════════════
--
-- Ein Mensch sucht nicht "einen Job". Er sucht Projektmanagement in
-- Zuerich — und daneben, halb ernst, etwas ganz anderes in Berlin.
-- Beides in einem Faden zu fuehren heisst, dass jede Frage zur einen
-- Suche die andere mitschleppt.
--
-- Ein Projekt buendelt: das Gespraech, die gemerkten Stellen, die
-- Bewerbungen. Es ist kein Ordner, sondern der Zusammenhang, in dem
-- diese Dinge stehen.
--
-- ── Was das Gedaechtnis NICHT tut ───────────────────────────────
--
-- Es zerfaellt nicht. Was Monday ueber den Menschen weiss —
-- bestaetigte Fakten, harte Bedingungen, verworfene Aussagen — haengt
-- an `user_id` und nicht am Gespraech. Es folgt deshalb in JEDES
-- Projekt, ohne dass hier etwas dafuer noetig waere.
--
-- Getrennt ist nur der VERLAUF: `nina_conversations.summary` und die
-- Zuege haengen an der Gespraechskennung. Genau diese Trennung war
-- die Anforderung — die KI soll merken, dass es ein anderes Projekt
-- ist, und trotzdem wissen, wer vor ihr sitzt.
--
-- Deshalb ist `projekt_id` ueberall NULLBAR. Alles, was es heute
-- gibt, gehoert zu keinem Projekt und funktioniert weiter; ein
-- Projekt ist etwas, das dazukommt, nicht etwas, das man haben muss.

create table if not exists projekte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  -- Wie es in der Seitenleiste steht. Kurz, vom Menschen bestaetigt.
  name text not null,
  -- Was gesucht wird, in einem Satz. Aus dem Gespraech, in dem das
  -- Projekt entstand.
  ziel text,

  -- aktiv | ruht | abgeschlossen
  --
  -- `ruht` ist nicht dasselbe wie geloescht: Eine Suche, die man
  -- pausiert, will man wiederfinden. Ein Projekt verschwindet nur,
  -- wenn jemand es loescht.
  status text not null default 'aktiv',

  -- Die Reihenfolge in der Seitenleiste. Kleiner steht weiter oben.
  -- Ohne eigene Ordnung waere sie das Anlagedatum, und das ist selten
  -- die Reihenfolge, in der jemand seine Vorhaben sieht.
  ordnung integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
--> statement-breakpoint

create index if not exists projekte_person_idx
  on projekte (user_id, status, ordnung);
--> statement-breakpoint

-- Ein Name je Mensch. Zwei Projekte "Zuerich" nebeneinander sind in
-- einer Seitenleiste nicht auseinanderzuhalten.
create unique index if not exists projekte_person_name_unique
  on projekte (user_id, lower(name));
--> statement-breakpoint

-- ── Die drei Zuordnungen ────────────────────────────────────────
--
-- `on delete set null` und NICHT cascade: Wer ein Projekt loescht,
-- will das Vorhaben loswerden — nicht seine Bewerbungen. Eine
-- Bewerbung, die mit dem Ordner verschwindet, in dem sie zufaellig
-- lag, ist ein Datenverlust, den niemand erwartet.

alter table nina_conversations
  add column if not exists projekt_id uuid references projekte(id) on delete set null;
--> statement-breakpoint

create index if not exists nina_conversations_projekt_idx
  on nina_conversations (projekt_id) where projekt_id is not null;
--> statement-breakpoint

alter table saved_jobs
  add column if not exists projekt_id uuid references projekte(id) on delete set null;
--> statement-breakpoint

create index if not exists saved_jobs_projekt_idx
  on saved_jobs (projekt_id) where projekt_id is not null;
--> statement-breakpoint

alter table applications
  add column if not exists projekt_id uuid references projekte(id) on delete set null;
--> statement-breakpoint

create index if not exists applications_projekt_idx
  on applications (projekt_id) where projekt_id is not null;
