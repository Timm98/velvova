-- Die öffentliche Unternehmensseite.
--
-- ── Warum eine eigene Tabelle und keine Spalten an `organizations` ──
--
-- `organizations` trägt, wer wer ist: Name, Slug, Zugehörigkeit,
-- Prüfstand. Das sind Angaben, an denen Rechte hängen — wer sie ändert,
-- ändert, wer im Namen dieses Unternehmens sprechen darf.
--
-- Das Profil ist das Gegenteil: erzählender Text, den ein Team laufend
-- überarbeitet, oft im Entwurf, oft unvollständig. Beides in eine
-- Tabelle zu legen hiesse, bei jedem Tippfehler in der Beschreibung
-- eine Zeile anzufassen, an der die Zugriffsrechte hängen.
--
-- ── Warum fast alles optional ist ──────────────────────────────
--
-- Ein Profil entsteht über Wochen. Pflichtfelder erzwängen entweder
-- erfundene Angaben oder einen Entwurf, den man nicht speichern kann.
-- Was fehlt, steht auf der öffentlichen Seite als „vom Unternehmen
-- noch nicht angegeben" — das ist eine ehrlichere Auskunft als ein
-- ausgeblendeter Abschnitt, denn eine fehlende Angabe ist selbst eine.
create table if not exists unternehmensprofile (
  organization_id uuid primary key references organizations(id) on delete cascade,

  -- ── Grundlagen ──────────────────────────────────────────────
  logo_pfad text,
  titelbild_pfad text,
  kurzbeschreibung text,
  beschreibung text,
  branche text,
  gruendungsjahr smallint,
  groesse text,
  hauptsitz text,
  weitere_standorte text,
  arbeitssprachen text,

  -- ── Arbeitsrealität ─────────────────────────────────────────
  arbeitsmodell text,
  wochenstunden text,
  gleitzeit text,
  kernarbeitszeit text,
  schichtarbeit text,
  reisetaetigkeit text,
  ueberstunden text,
  meetingkultur text,
  entscheidungswege text,
  fuehrungsstil text,
  teamgroessen text,
  arbeitsmittel text,

  -- ── Kultur und Entwicklung ──────────────────────────────────
  --
  -- Die Werte liegen als JSON, nicht als drei Spaltenpaare: Zu jedem
  -- Wert gehört ein Beispiel, und ein Wert ohne Beispiel ist eine
  -- Behauptung. Als Paar gespeichert lässt sich genau das prüfen.
  werte jsonb not null default '[]'::jsonb,
  feedback_rhythmus text,
  weiterbildung text,
  weiterbildungsbudget text,
  karrierewege text,
  interne_wechsel text,
  onboarding text,
  barrierefreiheit text,

  -- ── Leistungen ──────────────────────────────────────────────
  urlaubstage text,
  homeoffice text,
  bonusmodell text,
  altersvorsorge text,
  mobilitaet text,
  gesundheit text,
  ausstattung text,
  elternzeit text,
  weitere_leistungen text,

  -- ── Bewerbungsprozess ───────────────────────────────────────
  ansprechperson text,
  antwortzeit text,
  anzahl_gespraeche text,
  beteiligte_rollen text,
  prozessdauer text,
  probearbeit text,
  unterlagen text,
  anpassungen text,

  -- ── Zustand ─────────────────────────────────────────────────
  --
  -- `entwurf` und `veroeffentlicht` sind zwei Stände desselben
  -- Profils, nicht zwei Profile. Wer nach der Veröffentlichung
  -- weiterschreibt, ändert den Entwurf; die öffentliche Seite bleibt
  -- stehen, bis jemand sie ausdrücklich erneuert.
  veroeffentlicht_am timestamptz,
  aktualisiert_am timestamptz not null default now(),
  aktualisiert_von uuid references users(id) on delete set null
);
--> statement-breakpoint

-- Die öffentliche Seite wird über den Slug gefunden. Ohne Index wäre
-- das ein Durchlauf über alle Organisationen je Aufruf.
create index if not exists organizations_slug_idx on organizations (slug) where slug is not null;
