-- Beiträge: was gerade am Arbeitsmarkt passiert.
--
-- ── Warum das zu diesem Produkt gehört ───────────────────────
--
-- Nicht als Nachrichtenportal. Sondern weil die Zahlen, die in diesem
-- Bestand liegen, Aussagen tragen, die sonst niemand macht: Wie viele
-- Ausbildungsplätze sind in einer Region unbesetzt? In welchem Beruf
-- ist der Median gefallen? Wo werden mehr Stellen ausgeschrieben als
-- im Vorjahr?
--
-- Das sind Auskünfte aus eigenen Daten, nicht aus einer Presseagentur.
--
-- ── Warum jeder Beitrag eine Quelle trägt ────────────────────
--
-- `belegAbfrage` hält fest, WORAUS eine Aussage stammt — als lesbare
-- Beschreibung, nicht als ausführbarer Code. Ein Beitrag ohne
-- nachvollziehbare Grundlage wäre eine Behauptung, und davon gibt es
-- genug.
create table if not exists beitraege (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  -- Ein Satz. Er steht in der Übersicht und trägt die Aussage allein.
  kernaussage text not null,
  text text not null default '',
  -- krise · markt · beruf · ratgeber
  art text not null default 'markt',
  -- Der Kurzname aus der Fotobibliothek. Kein Pfad: Die Bibliothek
  -- entscheidet über Grössen und Dateinamen, nicht die Beitragstabelle.
  bild_slug text,
  -- Die KldB-Hauptgruppe, wenn der Beitrag einen Beruf betrifft.
  kldb_hauptgruppe text,
  -- Woraus die Aussage stammt. Lesbar, nicht ausführbar.
  beleg text not null default '',
  veroeffentlicht_am timestamptz,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists beitraege_veroeffentlicht_idx
  on beitraege (veroeffentlicht_am desc) where veroeffentlicht_am is not null;
