-- Job-Simulationen: die Arbeit ausprobieren, bevor man sich bewirbt.
--
-- ── Was sie beantworten, was ein Lebenslauf nicht kann ────────
--
-- Ein Lebenslauf sagt, was jemand getan hat. Eine Selbstauskunft sagt,
-- was er zu mögen glaubt. Beides sind Behauptungen über Vergangenheit
-- und Absicht.
--
-- Eine kurze Aufgabe sagt zwei andere Dinge, und sie sind die
-- eigentlich interessanten: Kann er es? Und — die wichtigere Frage —
-- gibt es ihm Energie oder kostet es welche?
--
-- ── Warum beide Werte getrennt gespeichert werden ────────────
--
-- „Du bist gut darin" und „das macht dich wahrscheinlich glücklich"
-- sind verschiedene Aussagen und gehen oft auseinander. Wer sie in
-- einer Zahl zusammenfasst, verliert genau den Fall, um den es geht:
-- jemand, der eine Arbeit beherrscht und daran zugrunde geht.
create table if not exists aufgabenproben (
  id uuid primary key default gen_random_uuid(),
  -- An welche Berufshauptgruppe sie sich richtet (KldB, zwei Ziffern).
  -- `null` heisst: für alle geeignet.
  kldb_hauptgruppe text,
  titel text not null,
  -- Was zu tun ist. Kurz genug, dass es niemanden abschreckt.
  aufgabe text not null,
  -- auswahl · reihenfolge · text
  art text not null default 'auswahl',
  -- Die Optionen bei 'auswahl' und 'reihenfolge'.
  optionen jsonb not null default '[]'::jsonb,
  -- Die richtige Antwort. Bei 'text' leer — dort wird nichts bewertet,
  -- nur die Energie erfragt.
  loesung jsonb not null default '[]'::jsonb,
  -- Warum diese Antwort richtig ist. Wird nach dem Versuch gezeigt;
  -- eine Aufgabe ohne Erklärung ist eine Prüfung, keine Probe.
  erklaerung text not null default '',
  -- Geschätzte Dauer in Sekunden. Steht vorher da.
  dauer_sekunden integer not null default 60,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists aufgabenproben_gruppe_idx on aufgabenproben (kldb_hauptgruppe) where aktiv;
--> statement-breakpoint
create table if not exists probendurchlaeufe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  probe_id uuid not null references aufgabenproben(id) on delete cascade,
  -- Was geantwortet wurde. Bleibt beim Menschen.
  antwort jsonb not null default '[]'::jsonb,
  -- Ob es stimmte. `null` bei Textaufgaben — dort wird nichts bewertet.
  richtig boolean,
  -- 1 bis 5: Wie es sich angefühlt hat. Die eigentliche Auskunft.
  energie integer,
  -- Wie lange gebraucht. Sagt etwas über Mühe, nicht über Güte.
  dauer_sekunden integer,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists probendurchlaeufe_user_idx on probendurchlaeufe (user_id, erstellt_am);
