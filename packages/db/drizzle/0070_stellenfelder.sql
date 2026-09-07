-- Die Angaben, nach denen im Gespräch als Erstes gefragt wird.
--
-- ── Warum sie an die Anzeige gehören und nicht ins Profil ──────
--
-- Das Unternehmensprofil beschreibt das Haus, die Anzeige die Stelle.
-- Wochenstunden, Reiseanteil und Berichtslinie unterscheiden sich
-- zwischen zwei Stellen desselben Unternehmens — im Profil stünde ein
-- Durchschnitt, der für keine der beiden stimmt.
--
-- ── Warum alles optional ist ──────────────────────────────────
--
-- Eine Anzeige entsteht in mehreren Anläufen. Pflichtfelder erzwängen
-- entweder erfundene Angaben oder einen Entwurf, den man nicht
-- speichern kann. Was fehlt, meldet die Anzeigenprüfung — und blockiert
-- dort, wo es wirklich blockieren muss.
alter table job_postings add column if not exists team text;
--> statement-breakpoint
alter table job_postings add column if not exists bereich text;
--> statement-breakpoint
alter table job_postings add column if not exists starttermin text;
--> statement-breakpoint
alter table job_postings add column if not exists aufgaben text;
--> statement-breakpoint

-- Muss und Kann getrennt — das ist der Kern.
--
-- In einer Fliesstextanzeige stehen beide in derselben Aufzählung, und
-- niemand kann sie auseinanderhalten. Getrennt gespeichert kann Monday
-- eine fehlende Kann-Fähigkeit als „entwickelbar" führen statt als
-- Ausschluss — und genau daran scheitern sonst Menschen, die die
-- Arbeit könnten.
alter table job_postings add column if not exists muss_faehigkeiten jsonb not null default '[]'::jsonb;
--> statement-breakpoint
alter table job_postings add column if not exists kann_faehigkeiten jsonb not null default '[]'::jsonb;
--> statement-breakpoint

alter table job_postings add column if not exists gewuenschte_erfahrung text;
--> statement-breakpoint
alter table job_postings add column if not exists arbeitssprache text;
--> statement-breakpoint
alter table job_postings add column if not exists reiseanteil text;
--> statement-breakpoint
alter table job_postings add column if not exists verantwortungsumfang text;
--> statement-breakpoint
alter table job_postings add column if not exists berichtslinie text;
--> statement-breakpoint
alter table job_postings add column if not exists interviewablauf text;
--> statement-breakpoint

-- Die Antwortzeit ist eine Zusage, keine Beschreibung.
--
-- Sie steht in der Anzeige, sie steht im Dashboard als Frist, und
-- Monday erinnert daran, bevor sie überschritten wird. Ohne diese Spalte
-- wäre „wir melden uns schnell" ein Satz ohne Folgen.
alter table job_postings add column if not exists antwortzeit text;
--> statement-breakpoint
alter table job_postings add column if not exists kontaktperson text;
--> statement-breakpoint

-- Die Zustände aus dem Auftrag. Bisher gab es drei; „paused" und
-- „archived" fehlten, und ohne sie wurde jede pausierte Stelle
-- geschlossen — was etwas anderes bedeutet.
comment on column job_postings.status is
  'draft · in_pruefung · published · paused · closed · archived';
