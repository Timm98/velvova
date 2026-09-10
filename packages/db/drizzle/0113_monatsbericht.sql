-- ══════════════════════════════════════════════════════════════════
-- Der Monatsbericht -- ein Lauf je Organisation und Berichtsmonat
-- ══════════════════════════════════════════════════════════════════
--
-- ── Warum die Aktivierung eine eigene Tabelle ist ───────────────
--
-- Weil ein Monatsbericht eine wiederkehrende Ansprache ist und
-- niemand sie ungefragt bekommen soll. `aktiv` steht auf false, und
-- nur eine ausdrueckliche Handlung setzt es. Ein Bericht, den ein
-- Betrieb nicht bestellt hat, ist Werbung -- auch wenn er stimmt.
--
-- ── Warum der eindeutige Schluessel so aussieht ─────────────────
--
--   unique (organization_id, berichtsmonat) where art = 'monatslauf'
--
-- Ein Cron-Ausloeser allein ist keine zuverlaessige Monatsverarbeitung:
-- Er feuert, und niemand sieht nach, ob etwas ankam. Wird er zweimal
-- ausgeloest -- durch einen Neustart, durch zwei Regionen, durch eine
-- Wiederholung nach einem Fehler --, dann scheitert das zweite
-- INSERT an diesem Index. Kein zweiter Bericht, kein zweiter Versand.
--
-- Der Teilindex `where art = 'monatslauf'` laesst manuelle Analysen
-- daneben zu. Sie tragen eigene Laufkennungen und duerfen mehrfach
-- im selben Monat stehen -- sie sind etwas anderes als der Bericht.
--
-- ── Warum die Staende mitgespeichert werden ─────────────────────
--
-- `staende` haelt fest, was zum Berichtszeitpunkt dastand. Der
-- naechste Monat vergleicht gegen diese Zeile und nicht gegen den
-- heutigen Bestand: Sonst schriebe eine spaetere Aenderung die
-- Vergangenheit um, und ein Bericht, den jemand gelesen hat, saehe
-- beim zweiten Oeffnen anders aus.
--
-- ── Was hier NICHT steht ────────────────────────────────────────
--
-- Keine Spalte fuer eine Verbesserung in Prozent. Der Bericht
-- vergleicht Staende und benennt, was sich geaendert hat; eine
-- Prozentzahl daraus waere eine Wirkung, die niemand gemessen hat.

create table if not exists monatsbericht_einstellungen (
  organization_id uuid primary key references organizations(id) on delete cascade,

  -- Aus. Und bleibt aus, bis jemand es einschaltet.
  aktiv boolean not null default false,

  -- Der Monatswechsel haengt daran. UTC waere am Monatsersten um
  -- 00:30 Ortszeit der falsche Monat.
  zeitzone text not null default 'Europe/Berlin',

  -- Wer den Bericht bekommt. Leer heisst: niemand, er liegt nur in
  -- der Anwendung.
  empfaenger jsonb not null default '[]'::jsonb,

  -- Welcher Ausschnitt betrachtet wird. Aendert er sich, ist der
  -- Vergleich mit dem Vormonat ausgesetzt.
  umfang text not null default 'alle_vorgaenge',

  -- Ein Name, keine Rolle: Wer im Betrieb dafuer geradesteht.
  zustaendig text,

  aktiviert_am timestamptz,
  aktiviert_von uuid references users(id) on delete set null,
  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint

create table if not exists monatsberichte (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Der erste Tag des Berichtsmonats, in der Zeitzone der Einstellung.
  berichtsmonat date not null,
  zeitzone text not null default 'Europe/Berlin',
  umfang text not null default 'alle_vorgaenge',

  -- monatslauf · manuell
  art text not null default 'monatslauf',
  -- Damit sich zwei Laeufe in Protokollen auseinanderhalten lassen.
  lauf_kennung text not null,

  -- laeuft · fertig · abgebrochen
  zustand text not null default 'laeuft',
  begonnen_am timestamptz not null default now(),
  fertig_am timestamptz,
  fehler text,

  -- Der Stand zum Berichtszeitpunkt und der Vergleich dazu.
  staende jsonb not null default '[]'::jsonb,
  veraenderungen jsonb not null default '[]'::jsonb,

  -- stand · kein_neuer_stand
  lage text not null default 'kein_neuer_stand',
  grund text,

  -- Getrennt vom Fertigwerden: Ein Bericht kann fertig sein und
  -- trotzdem nirgends hingegangen.
  versandt_am timestamptz
);
--> statement-breakpoint

create unique index if not exists monatsberichte_ein_lauf_idx
  on monatsberichte (organization_id, berichtsmonat)
  where art = 'monatslauf';
--> statement-breakpoint

create index if not exists monatsberichte_organisation_idx
  on monatsberichte (organization_id, berichtsmonat desc);
