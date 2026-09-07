-- Das Monday-Onboarding: Angaben mit Herkunft.
--
-- ══════════════════════════════════════════════════════════════
-- Warum jede Angabe eine eigene Zeile bekommt
-- ══════════════════════════════════════════════════════════════
--
-- Der naheliegende Entwurf wäre ein grosses JSON-Dokument je Gespräch:
-- ein Feld, alles drin, fertig. Er scheitert an der Anforderung, die
-- dieses Onboarding von einem Chatbot unterscheidet — jede Angabe
-- trägt, woher sie kommt und wie sicher sie ist.
--
-- In einem Dokument müsste diese Herkunft neben jedem Wert stehen,
-- als verschachteltes Objekt, das keine Abfrage lesen kann. Die Frage
-- „welche Angaben hat Monday von der Website und sind noch nicht
-- bestätigt" wäre dann ein Durchlauf durch JSON statt eine Abfrage —
-- und genau diese Frage stellt die Oberfläche auf jeder Seite.
--
-- Eine Zeile je Angabe kostet Zeilen und spart genau das.
--
-- ══════════════════════════════════════════════════════════════
-- Die fünf Zustände
-- ══════════════════════════════════════════════════════════════
--
--   bestaetigt       ein Mensch hat es geprüft und bestätigt
--   gefunden         Monday hat es gefunden — Website, Dokument
--   abgeleitet       aus dem Gespräch geschlossen, nicht gesagt
--   unklar           widersprüchlich oder mehrdeutig
--   nicht_angegeben  ausdrücklich als fehlend vermerkt
--
-- Der letzte ist kein leerer Wert, sondern eine Aussage: „danach wurde
-- gefragt und es kam nichts". Das ist etwas anderes als eine Zeile,
-- die es nie gab — und nur so lässt sich später sagen, ob eine Frage
-- schon gestellt wurde.
create table if not exists onboarding_gespraeche (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- Die Stelle, um die es geht. Null, solange nur das Unternehmen
  -- besprochen wird — ein Gespräch kann mit dem Unternehmen anfangen
  -- und später zu einer Stelle führen.
  posting_id uuid references job_postings(id) on delete set null,

  -- entwurf · abgeschlossen
  status text not null default 'entwurf',
  -- Die Eingabeart, mit der zuletzt gearbeitet wurde: text · sprache
  letzter_modus text not null default 'text',

  begonnen_von uuid references users(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists onboarding_gespraeche_org_idx
  on onboarding_gespraeche (organization_id, aktualisiert_am desc);
--> statement-breakpoint

-- Der Gesprächsverlauf.
--
-- Getrennt von den Angaben, weil beides verschiedene Lebensdauern hat:
-- Eine Angabe wird korrigiert und behält ihre Kennung; eine Nachricht
-- ist ein Ereignis und ändert sich nie. In einer Tabelle müsste man
-- bei jeder Korrektur entscheiden, ob der alte Satz mitgeht.
create table if not exists onboarding_nachrichten (
  id uuid primary key default gen_random_uuid(),
  gespraech_id uuid not null references onboarding_gespraeche(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  -- nina · mensch
  rolle text not null,
  text text not null,
  -- Bei Spracheingabe: das Transkript, bevor es jemand korrigiert hat.
  -- Es bleibt stehen, damit sich eine Fehlerkennung später nachvollziehen
  -- lässt.
  transkript_roh text,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists onboarding_nachrichten_idx
  on onboarding_nachrichten (gespraech_id, erstellt_am);
--> statement-breakpoint

create table if not exists onboarding_angaben (
  id uuid primary key default gen_random_uuid(),
  gespraech_id uuid not null references onboarding_gespraeche(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Der Datenbereich: unternehmen · kultur · stelle · aufgaben ·
  -- muss · wunsch · erlernbar · bedingungen · gehalt · standort ·
  -- entwicklung · bewerbung · matching · freigaben
  bereich text not null,
  feld text not null,

  -- Als JSON, weil ein Wert eine Zahl, ein Text oder eine Liste sein
  -- kann. Eine Spalte je Typ wäre drei Spalten, von denen immer zwei
  -- leer sind.
  wert jsonb not null,

  -- gespraech · website · dokument · nutzer
  quelle text not null,
  -- Wo genau: die Adresse der Seite, der Dateiname, die Nachricht.
  -- Ohne diese Angabe ist „von der Website" nicht überprüfbar.
  quelle_detail text,

  -- 0 bis 100. Bei `quelle = nutzer` immer 100: Was ein Mensch
  -- eingetragen hat, ist keine Schätzung.
  konfidenz smallint not null default 50,

  -- bestaetigt · gefunden · abgeleitet · unklar · nicht_angegeben
  status text not null default 'gefunden',

  erfasst_am timestamptz not null default now(),
  bestaetigt_am timestamptz,
  bestaetigt_von uuid references users(id) on delete set null
);
--> statement-breakpoint

-- Ein Feld je Bereich und Gespräch genau einmal.
--
-- Ohne diese Bedingung entstünde bei jeder Korrektur eine zweite Zeile
-- zum selben Feld, und die Oberfläche zeigte beide — mit
-- verschiedenen Werten und ohne erkennbare Ordnung.
create unique index if not exists onboarding_angaben_unique
  on onboarding_angaben (gespraech_id, bereich, feld);
--> statement-breakpoint
create index if not exists onboarding_angaben_status_idx
  on onboarding_angaben (organization_id, status);
