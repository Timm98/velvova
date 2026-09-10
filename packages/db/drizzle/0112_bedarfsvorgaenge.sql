-- ══════════════════════════════════════════════════════════════════
-- Die Diagnose bekommt ein Gedaechtnis
-- ══════════════════════════════════════════════════════════════════
--
-- `bedarfsebenen.ts` und `befundlage.ts` rechnen seit dem 10.09.2026
-- richtig und speichern nichts. Wer unter /business/bedarf eine Lage
-- beschreibt, bekommt drei Rueckfragen -- und beim naechsten Besuch
-- ist alles weg. Ein Befund, der eine Sitzung nicht ueberlebt, kann
-- weder geprueft noch widerrufen noch einen Monat spaeter verglichen
-- werden.
--
-- ── Warum vier Tabellen und nicht eine ──────────────────────────
--
--   bedarfsvorgaenge   Der Vorgang. Traegt die Ebene -- und nur diese
--                      eine Zeile darf sie tragen, sonst gaebe es zwei
--                      Wahrheiten darueber, wie weit die Klaerung ist.
--   bedarfsquellen     Woraus geschlossen wird. Mit Zweck, Zeitraum
--                      und den drei getrennten Voraussetzungen.
--   bedarfsbefunde     Was daraus geworden ist -- mit den
--                      Alternativerklaerungen und den Gegenbelegen,
--                      ohne die es kein Befund werden darf.
--   bedarfsschritte    Jeder versuchte Aufstieg, auch der abgelehnte.
--
-- Der letzte Punkt ist der wichtigste. Ohne ihn steht am Ende eine
-- Ebene da, und niemand kann sagen, warum. Mit ihm laesst sich Zeile
-- fuer Zeile nachlesen, was vorlag -- und was gefehlt hat, als es
-- nicht weiterging.
--
-- ── Warum `organization_id` ueberall steht ──────────────────────
--
-- Auch in den drei Untertabellen, obwohl sie am Vorgang haengen. Der
-- Zeilenschutz dieser Anwendung kennt zwei Anker, `user_id` und
-- `organization_id`; eine Richtlinie ueber einen Verbund waere eine
-- dritte Bauart, die bei der naechsten Tabelle vergessen wird. Die
-- Lehre aus 0110/0111, diesmal vorher gezogen.
--
-- ── Was hier NICHT steht ────────────────────────────────────────
--
-- Keine Spalte fuer eine Ursachenwahrscheinlichkeit. Keine Punktzahl
-- fuer die "Schwere" eines Problems. Kein Geldbetrag. Zeit bleibt
-- Zeit, und `zeitschaetzung()` gibt Stunden zurueck -- frei werdende
-- Zeit ist kein eingespartes Geld, und eine Spalte dafuer waere die
-- Einladung, es doch so zu rechnen.
--
-- Und keine Spalte fuer Beschaeftigte. Untersucht werden Ablaeufe,
-- nicht Menschen.

create table if not exists bedarfsvorgaenge (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  angelegt_von uuid references users(id) on delete set null,

  -- Wie der Vorgang in der Liste steht. Vom Menschen, nicht vom Modell.
  titel text not null,
  -- Der Satz, mit dem alles anfing. Unveraendert, als Beleg.
  ausgangslage text not null,

  -- beduerfnis · beobachtung · hypothese · bestaetigtes_problem
  -- · loesungsbedarf · freigegebene_moeglichkeit
  ebene text not null default 'beduerfnis',

  -- Einer aus LOESUNGSWEGE. `null` heisst: noch nicht gewaehlt --
  -- und das ist etwas anderes als "keine Loesung noetig", was als
  -- `erst_messen` oder `vorerst_beobachten` dasteht.
  weg text,

  -- Wer Umfang und Bedingungen freigegeben hat. Ein Name, kein Flag:
  -- "freigegeben" ohne die Person dahinter ist keine Freigabe.
  freigabe_von text,
  freigabe_am timestamptz,

  -- Wird der Vorgang zu einem Angebot, steht hier die Verbindung.
  -- Nullbar und bleibt es meistens: Die haeufigste richtige Antwort
  -- auf ein bestaetigtes Problem ist keine neue Stelle.
  angebot_id uuid references angebote(id) on delete set null,

  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint

create index if not exists bedarfsvorgaenge_organisation_idx
  on bedarfsvorgaenge (organization_id, ebene, erstellt_am desc);
--> statement-breakpoint

create table if not exists bedarfsquellen (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vorgang_id uuid not null references bedarfsvorgaenge(id) on delete cascade,

  art text not null,
  eigentuemer text not null,

  -- bewerbungsversand · unternehmensanalyse · faehigkeitsnachweis
  -- · abrechnung. Ein Zweck deckt keinen anderen.
  zweck text,

  zeitraum text,
  alter_tage integer,
  sichtbar_fuer jsonb not null default '[]'::jsonb,

  -- Die drei getrennten Voraussetzungen. Eine verbundene
  -- Gmail-Adresse fuer den Bewerbungsversand ist keine betriebliche
  -- Berechtigung fuer eine Unternehmensanalyse, und keine von beiden
  -- ist eine Rechtsgrundlage.
  technisch_verbunden boolean not null default false,
  betrieblich_berechtigt boolean not null default false,
  rechtsgrundlage text,

  -- Ob die Quelle Vorgaenge beschreibt statt Personen.
  auf_vorgangsebene boolean not null default true,

  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint

create index if not exists bedarfsquellen_vorgang_idx
  on bedarfsquellen (vorgang_id);
--> statement-breakpoint

create table if not exists bedarfsbefunde (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vorgang_id uuid not null references bedarfsvorgaenge(id) on delete cascade,

  -- Was beobachtet wurde. Keine Ursache, kein Urteil.
  beobachtung text not null,

  -- Die Quellen als Kennungsfeld statt als Verbundtabelle.
  --
  -- Bewusst: Eine fuenfte Tabelle fuer eine Liste von zwei bis drei
  -- Kennungen kostet mehr Aufmerksamkeit, als sie einbringt. Der
  -- Preis ist, dass die Datenbank die Verweise nicht prueft -- wer
  -- eine Quelle loescht, laesst hier eine tote Kennung stehen. Das
  -- Lesen filtert sie heraus.
  quellen_ids uuid[] not null default '{}',

  -- Ohne mindestens eine festgehaltene Gegenerklaerung wird daraus
  -- kein Befund. Ein Signal ist keine Ursache.
  alternativen jsonb not null default '[]'::jsonb,
  gegenbelege jsonb not null default '[]'::jsonb,
  gegenbelege_geprueft boolean not null default false,
  vom_unternehmen_bestaetigt boolean not null default false,

  -- bestaetigt · hypothese · verworfen · kein_befund
  --
  -- Beim Schreiben aus `befundPruefen()` gerechnet und mitgespeichert.
  -- Nicht, weil man es nicht neu rechnen koennte, sondern damit ein
  -- spaeter geaenderter Massstab einen frueheren Bericht nicht still
  -- umschreibt.
  stand text not null default 'kein_befund',

  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint

create index if not exists bedarfsbefunde_vorgang_idx
  on bedarfsbefunde (vorgang_id, stand);
--> statement-breakpoint

create table if not exists bedarfsschritte (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vorgang_id uuid not null references bedarfsvorgaenge(id) on delete cascade,
  wer uuid references users(id) on delete set null,

  von_ebene text not null,
  nach_ebene text not null,

  -- Auch der abgelehnte Versuch steht hier.
  --
  -- Nur die gelungenen aufzuzeichnen hiesse, eine Geschichte zu
  -- fuehren, in der nie etwas gefehlt hat. Der Grund einer Ablehnung
  -- ist die nuetzlichste Zeile im ganzen Vorgang: Er sagt, was zu
  -- besorgen ist.
  erlaubt boolean not null,
  grund text,

  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint

create index if not exists bedarfsschritte_vorgang_idx
  on bedarfsschritte (vorgang_id, erstellt_am);
