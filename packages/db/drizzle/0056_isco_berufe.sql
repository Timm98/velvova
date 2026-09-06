-- Die ISCO-08-Berufsgruppen mit Zukunftsbewertung.
--
-- 436 Unit Groups in zehn Hauptgruppen — die internationale
-- Berufsklassifikation der ILO. Jeder Beruf weltweit gehört genau
-- einer dieser Gruppen an.
--
-- ── Warum ISCO neben KldB ─────────────────────────────────────
--
-- Die KldB ist deutsch und liegt an 73,5 Prozent unserer Stellen.
-- ISCO ist international und trägt die Zukunftsbewertung. Beide
-- nebeneinander zu führen ist kein Doppel: Die KldB sagt, was die
-- Bundesagentur zu einer konkreten Anzeige meint; ISCO sagt, was über
-- diese Berufsgruppe weltweit bekannt ist.
--
-- ── Was die Bewertungsfelder sind — und was nicht ─────────────
--
-- Die Quelle nennt ihre Grenzen selbst: „synthetisierte Einschätzung
-- auf Basis der genannten Studien – keine Messwerte". Deshalb stehen
-- `quelle`, `stand` und `methodik` in der Tabelle und müssen überall
-- mitgezeigt werden, wo eine dieser Zahlen erscheint.
create table if not exists isco_berufe (
  code text primary key,
  hauptgruppe text not null,
  hauptgruppe_nummer smallint not null,
  beruf_de text not null,
  beruf_en text not null,
  beispielberufe text not null default '',
  qualifikationsniveau text,
  /* 1 = stark gefährdet … 5 = sehr sicher. */
  zukunftssicherheit smallint,
  ki_exposition text,
  automatisierungsart text,
  nachfrage text,
  lohnaussicht text,
  haupttreiber text,
  plus text,
  kontra text,
  langzeit text,
  kernargument text,
  empfehlung text,
  /* Herkunft — gehört an jede Zahl, die daraus angezeigt wird. */
  quelle text not null,
  stand date not null,
  importiert_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists isco_berufe_hauptgruppe_idx on isco_berufe (hauptgruppe_nummer);
--> statement-breakpoint
-- Suche über die Beispielberufe: Dort stehen über 1.300 konkrete
-- Bezeichnungen, und genau darüber findet ein Stellentitel seine Gruppe.
create index if not exists isco_berufe_beispiele_idx on isco_berufe using gin (to_tsvector('german', beispielberufe));
