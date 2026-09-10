-- ══════════════════════════════════════════════════════════════════
-- Die Uhr starten, und ein Angebot ist kein Anzeigentext
-- ══════════════════════════════════════════════════════════════════
--
-- Zwei Tabellen, die nichts miteinander zu tun haben ausser dem Ziel:
-- Angebote in den Nachtlauf zu bringen, die in keiner Jobboerse
-- stehen.
--
-- ══════════════════════════════════════════════════════════════════
-- 1 · bedarfs_schnappschuss -- der Teil, den man nicht nachholen kann
-- ══════════════════════════════════════════════════════════════════
--
-- Echten Dauerbedarf erkennt man daran, dass derselbe Arbeitgeber
-- dieselbe Rolle am selben Ort wieder und wieder ausschreibt. Dafuer
-- braucht es eine eigene Beobachtung ueber Zeit.
--
-- Gemessen am 10.09.2026: `job_source_links` reicht elf Tage zurueck
-- (30.08. bis 10.09.). Das `published_at` der Anzeigen reicht zwar
-- zwoelf Monate zurueck, ist aber das Datum des Arbeitgebers aus dem
-- Feed -- nicht Velvovas Beobachtung. Ob eine Stelle NEU ausgeschrieben
-- wurde, laesst sich daraus nicht sagen.
--
-- ── Warum das dringend ist und nichts anderes ───────────────────
--
-- Jeder Tag ohne Aufzeichnung ist ein Tag Historie, der sich nicht
-- herstellen laesst. In 90 Tagen hat die Einstufung etwas zu pruefen,
-- in zwoelf Monaten die Datenbasis, die das Konzept voraussetzt. Es
-- gibt keinen Weg, das spaeter aufzuholen.
--
-- ── Warum der Ort zur Zaehlung gehoert ──────────────────────────
--
-- Die Messung, die zu dieser Tabelle gefuehrt hat, ergab an der
-- Spitze: Netto 9.140 Anzeigen fuer Verkauf, Lidl 7.317, Randstad
-- 3.840 fuer Lager. In jeder Zeile war `anzeigen = stellen`: getrennte
-- Anzeigen je Filiale, keine Wiederausschreibungen.
--
-- Ohne den Ort ist ein Filialnetz von echtem Dauerbedarf nicht zu
-- unterscheiden. Mit ihm schon: Dauerbedarf heisst dieselbe Rolle am
-- SELBEN Ort, immer wieder.
--
-- ── Warum keine RLS ─────────────────────────────────────────────
--
-- Keine Nutzerdaten -- eine Auszaehlung ueber den oeffentlichen
-- Stellenbestand, dieselbe Bauart wie `standzeit_referenz`.

create table if not exists bedarfs_schnappschuss (
  -- Der Tag der Beobachtung, nicht der Veroeffentlichung.
  tag date not null,
  company_id uuid not null references companies(id) on delete cascade,
  -- Die ersten vier Stellen der KldB: die Berufsgattung.
  beruf text not null,
  -- Kleingeschrieben und beschnitten, damit "Berlin" und "berlin "
  -- nicht zwei Orte sind.
  ort text not null,
  -- Wie viele Stellen an diesem Tag offen standen.
  stellen integer not null,
  primary key (tag, company_id, beruf, ort)
);
--> statement-breakpoint

-- "Wie oft hat dieser Arbeitgeber diese Rolle hier ausgeschrieben" --
-- die einzige Frage, fuer die es diese Tabelle gibt.
create index if not exists bedarfs_schnappschuss_paar_idx
  on bedarfs_schnappschuss (company_id, beruf, ort, tag);
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
-- 2 · angebote -- eine Zahl, fuer die jemand geradesteht
-- ══════════════════════════════════════════════════════════════════
--
-- Der Unterschied zu `jobs` ist kein technischer, sondern der ganze
-- Punkt: Eine Anzeige beschreibt, was sich jemand vorgestellt hat. Ein
-- Angebot ist bindend, sobald beide Seiten aufdecken.
--
-- ── Warum `verbindlich_bestaetigt_am` und nicht ein Flag ─────────
--
-- Weil der Zeitpunkt der Beleg ist. Ein boolean sagt "ja", ein
-- Zeitstempel sagt "am 11.09. um 14:22 hat ein verifizierter Kontakt
-- bestaetigt, dass diese Zahlen gelten". Nur das zweite traegt, wenn
-- es jemand spaeter bestreitet.
--
-- ── Warum ein Modell den Status nie auf aktiv setzen kann ────────
--
-- `status` startet auf 'entwurf'. Aktiv wird ein Angebot nur ueber
-- eine eigene Route, die einen eingeloggten, verifizierten
-- Firmenkontakt verlangt. Ein Sprachmodell, das ein Transkript
-- verarbeitet, kann nichts verbindlich machen -- auch dann nicht, wenn
-- im Transkript steht, es solle das tun.
--
-- ── Warum `gestrichen` gespeichert wird ─────────────────────────
--
-- "Nicht ueber fuenfzig" wird aus einem Angebot entfernt. Dass es
-- entfernt wurde, bleibt stehen: als Nachweis nach AGG und damit die
-- Firma es liest, statt es beim naechsten Mal wieder zu sagen.

create table if not exists angebote (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- Wer es hinterlegt hat. Ohne verifizierten Kontakt kein Angebot.
  angelegt_von uuid references users(id) on delete set null,

  -- stelle · dauerbedarf · nachfolge · wunschprofil · vorvakanz
  art text not null default 'wunschprofil',
  -- dashboard · sprachnachricht · kandidatenbrief · nachfolge_planer ·
  -- insider · partner
  herkunft text not null default 'dashboard',
  -- entwurf · aktiv · pausiert · abgelaufen · besetzt
  status text not null default 'entwurf',

  rollenprofil jsonb not null default '{}'::jsonb,
  konditionen jsonb not null default '{}'::jsonb,
  plaetze integer not null default 1,
  -- Bei Nachfolge und Vor-Vakanz: frühester und spätester Start.
  start_von date,
  start_bis date,
  gueltig_bis date not null,

  -- "Träger im Osten der Stadt, ca. 400 Betten" -- was Kandidaten vor
  -- dem Aufdecken sehen. Ohne diese Zeile kein Angebot im Markt.
  anonym_beschreibung text not null default '',
  -- Fachliche Rueckfragen, die Nina beantworten darf.
  erlaubte_rueckfragen jsonb not null default '[]'::jsonb,

  -- Was noch fehlt, damit daraus ein Angebot wird.
  offene_punkte jsonb not null default '[]'::jsonb,
  -- Gestrichene Wuensche mit Begruendung. Nachweis nach AGG.
  gestrichen jsonb not null default '[]'::jsonb,
  -- Anweisungen im Fremdtext, die als Daten behandelt wurden.
  auffaelligkeiten jsonb not null default '[]'::jsonb,

  verbindlich_bestaetigt_am timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint

create index if not exists angebote_firma_idx on angebote (company_id, status);
--> statement-breakpoint

-- Der Nachtlauf fragt: was ist aktiv und noch gueltig?
create index if not exists angebote_aktiv_idx
  on angebote (status, gueltig_bis) where status = 'aktiv';
--> statement-breakpoint

alter table angebote enable row level security;
