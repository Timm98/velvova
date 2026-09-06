-- Der Promise Lock: was zugesagt wurde, und ob es gehalten wurde.
--
-- ── Warum das die wichtigste Tabelle des Produkts sein könnte ─
--
-- Die meisten schlechten Jobentscheidungen entstehen nicht, weil der
-- Beruf falsch war. Sie entstehen, weil die Arbeit nicht dem entsprach,
-- was im Bewerbungsprozess versprochen wurde.
--
-- Der vorhandene Outcome Loop misst etwas anderes: ob UNSERE Vorhersage
-- stimmte. Das ist eine Frage über uns. Diese hier ist eine Frage über
-- den Arbeitgeber — und sie beantwortet, was keine Sternebewertung
-- beantwortet: Hält dieses Unternehmen bei DIESER Rolle, was es
-- Bewerbern verspricht?
--
-- ── Warum jede Zusage einzeln steht ──────────────────────────
--
-- „Der Job war anders als beschrieben" ist keine Auskunft. „Zwei
-- Homeoffice-Tage wurden zugesagt, es ist einer" ist eine. Nur einzeln
-- festgehaltene Zusagen lassen sich einzeln prüfen — und nur daraus
-- entsteht eine Quote.
--
-- `check_ins.promise_vs_reality` gab es schon: ein Freitextfeld ohne
-- Gegenstück. Es fragte nach dem Vergleich und hielt nie fest, womit
-- verglichen werden sollte.
create table if not exists zusagen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,

  -- Einer der festen Punkte: aufgaben, homeoffice, arbeitszeit,
  -- einarbeitung, vorgesetzter, gehalt, ziele_90, entscheidungsfreiheit,
  -- weiterbildung, aufstieg, reise_schicht, ressourcen
  punkt text not null,
  -- Was genau zugesagt wurde. In den Worten des Menschen.
  zusage text not null,

  -- ── Woher die Zusage stammt ──
  -- anzeige · gespraech · vertrag · arbeitgeber_bestaetigt
  --
  -- Die Herkunft entscheidet, wie belastbar sie ist. Was in der Anzeige
  -- steht, ist eine Werbeaussage; was der Arbeitgeber auf Nachfrage
  -- bestätigt hat, ist eine Zusage.
  herkunft text not null default 'gespraech',
  -- Die Fundstelle: Zitat aus der Anzeige, Datum des Gesprächs.
  beleg text not null default '',

  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists zusagen_bewerbung_idx on zusagen (application_id);
--> statement-breakpoint
-- Ob eine Zusage gehalten wurde. Eine Zeile je Zusage und Zeitpunkt.
--
-- Getrennt von der Zusage, weil dieselbe Zusage nach 14 Tagen anders
-- dastehen kann als nach 90. Eine fehlende Einarbeitung in der ersten
-- Woche ist ein Anlaufproblem; nach drei Monaten ist sie ein Bruch.
create table if not exists zusagen_pruefungen (
  id uuid primary key default gen_random_uuid(),
  zusage_id uuid not null references zusagen(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  -- 14, 30 oder 90
  tagesmarke integer not null,
  -- gehalten · teilweise · gebrochen · zu_frueh
  --
  -- `zu_frueh` ist kein Ausweichen, sondern eine Auskunft: „Zwei
  -- Homeoffice-Tage nach dem ersten Monat" lässt sich nach 14 Tagen
  -- nicht beurteilen, und ein „gebrochen" wäre dort schlicht falsch.
  stand text not null,
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  unique (zusage_id, tagesmarke)
);
