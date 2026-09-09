-- ══════════════════════════════════════════════════════════════════
-- Stille Chancen: Arbeitgeber ohne passende Anzeige
-- ══════════════════════════════════════════════════════════════════
--
-- Drei Tabellen, und die dritte ist die, die man beim ersten Entwurf
-- vergisst.
--
--   arbeitgeber_chancen        Was wir ueber einen Arbeitgeber wissen,
--                              bezogen auf genau einen Menschen.
--   arbeitgeber_kontakte       Was tatsaechlich hinausgegangen ist.
--   arbeitgeber_kontaktsperre  Wer nicht mehr angeschrieben werden will.
--
-- Die Sperre traegt bewusst KEINE Nutzerkennung. Wenn ein Arbeitgeber
-- schreibt "bitte nicht mehr kontaktieren", gilt das ihm gegenueber und
-- nicht gegenueber der einen Person, die zufaellig gefragt hat. Eine
-- Sperre je Nutzer waere aus seiner Sicht keine Sperre: Der naechste
-- Mensch schriebe morgen wieder.
--
-- Gespeichert wird dabei nur die Tatsache und der Zeitpunkt -- nicht
-- der Wortlaut der Antwort. Der gehoert dem Menschen, der sie bekommen
-- hat, und darf anderen nicht als Auskunft ueber den Arbeitgeber
-- erscheinen.

create table if not exists arbeitgeber_chancen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,

  -- 'stille_chance' oder 'bestaetigte_moeglichkeit'.
  --
  -- 'oeffentliche_stelle' steht hier NICHT und darf es nie: Eine
  -- ausgeschriebene Stelle ist ein Job und gehoert in `jobs`. Sie hier
  -- zuzulassen waere der eine Weg, auf dem eine Vermutung und eine
  -- Anzeige in derselben Liste landen.
  art text not null default 'stille_chance',
  status text not null default 'entdeckt',

  -- Die zwei Zahlen aus `arbeitgeberpassung`. Getrennt, weil eine 90
  -- aus einem Datenpunkt keine 90 ist.
  punkte integer,
  belegdichte numeric(3,2),

  initiativlage text not null default 'unbekannt',
  arbeitgeberart text not null default 'privat',

  karriereseite_url text,
  karriereseite_geprueft_am timestamptz,

  -- Belegte Kontaktwege. Jeder Eintrag traegt seine Fundstelle mit;
  -- ohne sie ist er geraten und wird beim Lesen verworfen.
  kanaele jsonb not null default '[]'::jsonb,
  -- Warum diese Chance besteht, mit Quelle und Datum.
  belege jsonb not null default '[]'::jsonb,

  sicherheit text not null default 'niedrig',

  -- Was der Arbeitgeber selbst gesagt hat. Nur diese Felder duerfen
  -- `art` auf 'bestaetigte_moeglichkeit' heben.
  bestaetigt_am timestamptz,
  bestaetigte_rolle text,
  erwarteter_zeitraum text,

  vom_nutzer_ausgeschlossen boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
--> statement-breakpoint

-- Eine Chance je Mensch und Arbeitgeber.
--
-- Ohne diese Regel entstehen bei jedem Suchlauf neue Zeilen fuer
-- denselben Arbeitgeber, und die Abkuehlfrist aus der Kontaktlogik
-- findet die vorherige nicht mehr -- der Duplikatschutz haenge dann an
-- der Sorgfalt des Aufrufers statt an der Datenbank.
create unique index if not exists arbeitgeber_chancen_person_firma_unique
  on arbeitgeber_chancen (user_id, company_id);
--> statement-breakpoint

create index if not exists arbeitgeber_chancen_person_idx
  on arbeitgeber_chancen (user_id, punkte desc);
--> statement-breakpoint

create table if not exists arbeitgeber_kontakte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  chance_id uuid references arbeitgeber_chancen(id) on delete set null,

  -- 'stellenanfrage' oder 'initiativbewerbung'.
  anfrageart text not null,
  kanal_art text not null,
  kanal_ziel text not null,
  -- Wo dieser Kontaktweg stand. Pflicht, damit spaeter nachvollziehbar
  -- ist, warum diese Adresse benutzt wurde.
  kanal_beleg_url text not null,

  -- pending | freigegeben | laeuft | zugestellt | fehlgeschlagen | unklar
  --
  -- 'unklar' ist kein Zwischenzustand, sondern ein Ergebnis: Der
  -- Versand wurde abgeschickt und die Bestaetigung ging verloren. Wer
  -- diesen Fall als 'fehlgeschlagen' fuehrt, sendet erneut -- und der
  -- Arbeitgeber bekommt dieselbe Anfrage zweimal.
  status text not null default 'pending',

  -- Der Schutz gegen doppelten Versand, in der Datenbank und nicht im
  -- Aufrufer. Ein Wiederholungsversuch mit demselben Schluessel legt
  -- keine zweite Zeile an.
  idempotenz_schluessel text not null,

  -- Der Text selbst steht NICHT hier.
  --
  -- Er gehoert zum Entwurf, den der Mensch freigegeben hat, und dort
  -- ist er auch loeschbar. Hier steht nur sein Fingerabdruck -- genug,
  -- um zu pruefen, ob nach der Freigabe noch etwas geaendert wurde,
  -- und zu wenig, um ein zweites Archiv persoenlicher Texte zu sein.
  nachricht_hash text not null,

  gesendet_am timestamptz,
  antwort_am timestamptz,
  -- Die Einordnung der Antwort. Nicht ihr Wortlaut.
  antwortart text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
--> statement-breakpoint

create unique index if not exists arbeitgeber_kontakte_idempotenz_unique
  on arbeitgeber_kontakte (idempotenz_schluessel);
--> statement-breakpoint

-- Die Abfrage, die vor jeder Anfrage laeuft: Wann hatte dieser Mensch
-- zuletzt mit diesem Arbeitgeber zu tun?
create index if not exists arbeitgeber_kontakte_person_firma_idx
  on arbeitgeber_kontakte (user_id, company_id, created_at desc);
--> statement-breakpoint

create table if not exists arbeitgeber_kontaktsperre (
  company_id uuid primary key references companies(id) on delete cascade,
  -- 'arbeitgeber_wunsch' | 'zustellung_dauerhaft_fehlgeschlagen' | 'beschwerde'
  grund text not null,
  gesetzt_am timestamptz not null default now(),
  -- Keine Nutzerkennung, kein Wortlaut, keine Nachricht.
  -- Absichtlich: Die Sperre schuetzt den Arbeitgeber und darf dafuer
  -- nicht offenlegen, wer ihn angeschrieben hat.
  notiz text
);
