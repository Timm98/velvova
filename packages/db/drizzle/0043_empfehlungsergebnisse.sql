-- Die Vorhersage einfrieren, damit sie später prüfbar ist.
--
-- ── Warum eine eigene Tabelle ────────────────────────────────
--
-- `job_matches` hält die Bewertung je Nutzer und Stelle — mit einem
-- eindeutigen Index auf beide und `onConflictDoUpdate`. Jede
-- Neuberechnung überschreibt sie. Das ist für die Anzeige richtig: dort
-- soll der aktuelle Wert stehen.
--
-- Für die Auswertung ist es tödlich. Trifft ein Ergebnis vier Monate
-- später ein, steht in `job_matches` längst eine andere Zahl — womöglich
-- aus einer anderen Fassung der Bewertungslogik. Die Frage „hat unsere
-- Empfehlung getaugt?" liesse sich dann nicht mehr beantworten, und
-- rückwirkend erzeugen kann man diese Daten nicht.
--
-- Deshalb hier eine Zeile je Empfehlung, die zu einer Entscheidung
-- geführt hat. Die Vorhersagefelder werden EINMAL geschrieben und nie
-- wieder angefasst. Nur die Ergebnisfelder wachsen mit der Zeit.
create table if not exists empfehlungs_ergebnisse (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,

  -- ── Die Vorhersage, wie sie im Moment der Entscheidung stand ──
  -- Unveränderlich. Wer sie aktualisiert, zerstört den Vergleich.
  fit_score integer,
  fit_band text not null,
  fit_coverage double precision not null default 0,
  confidence_score integer not null default 0,
  constraint_verdict text not null,
  overall_score integer,
  top_reason text not null default '',
  top_reservation text not null default '',
  -- Ohne die Fassung ist ein Vergleich über Zeit wertlos: Eine
  -- Verschlechterung könnte auch eine geänderte Rechnung sein.
  scoring_version text not null,
  vorhergesagt_am timestamptz not null default now(),

  -- ── Das Ergebnis, wie es eintrifft ──
  beworben_am timestamptz,
  antwort_am timestamptz,
  interview_am timestamptz,
  angebot_am timestamptz,
  angenommen_am timestamptz,
  abgelehnt_am timestamptz,

  -- ── Ob es die richtige Entscheidung war ──
  -- Aus den Check-ins. `null` heisst „noch nicht gefragt", nicht
  -- „unzufrieden" — die Unterscheidung entscheidet über jede Auswertung.
  zufriedenheit_30 integer,
  zufriedenheit_90 integer,
  zufriedenheit_180 integer,

  aktualisiert_am timestamptz not null default now()
);
--> statement-breakpoint
create unique index if not exists empfehlungs_ergebnisse_unique
  on empfehlungs_ergebnisse (user_id, job_id);
--> statement-breakpoint
-- Die Auswertung fragt nach Band und Sicherheit, nicht nach Nutzern.
create index if not exists empfehlungs_ergebnisse_band_idx
  on empfehlungs_ergebnisse (fit_band, scoring_version);
