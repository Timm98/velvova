-- ══════════════════════════════════════════════════════════════════
-- Nachweise: was jemand nachweislich getan hat
-- ══════════════════════════════════════════════════════════════════
--
-- Ein randomisiertes Feldexperiment hat den Unterschied gemessen, um
-- den es hier geht: Teilbare Kompetenznachweise erhoehten die
-- Beschaeftigungswahrscheinlichkeit um 5,2 Prozentpunkte. Rein
-- privates Feedback -- jemandem sagen, dass er gut ist -- bewirkte
-- nichts.
--
-- Deshalb diese Tabelle. „Monday haelt dich fuer geeignet" ist
-- wertlos; ein Zeugnis, das ein Mensch weitergeben kann, ist es nicht.
--
-- ── Was hier NICHT steht, und warum ────────────────────────────
--
-- Es gibt keine Spalte fuer Versuche, keine fuer Misserfolge, keine
-- Punktzahl und kein Gesamturteil.
--
-- Ein misslungener Versuch hinterlaesst keine Spur -- kein Eintrag,
-- keine Zaehlung, auch nicht die Anzahl der Versuche, die dieselbe
-- Information waere, nur schwerer zu erkennen. Der Grund ist nicht
-- Freundlichkeit, sondern Brauchbarkeit: Ein System, in dem Ueben
-- aktenkundig wird, ist ein System, in dem niemand uebt. Und eine
-- gespeicherte Misserfolgsquote waere die verdeckte Negativliste, die
-- ein Kompetenznachweis nie werden darf.
--
-- Die Regel steht in `wirdFestgehalten()` in @paycheck/domain und
-- wird hier durch das Schema gestuetzt: Was es nicht gibt, laesst
-- sich auch nicht versehentlich schreiben.
--
-- ── Warum fuenf Pflichtangaben ─────────────────────────────────
--
-- Ein Zeugnis ist nur wert, was es beschreibt. Ohne Bedingungen ist
-- das Ergebnis nicht einzuordnen: „hat alle vier gefunden" heisst
-- etwas anderes mit Nachschlagewerk als ohne. Ohne Aussteller steht
-- niemand dafuer ein. Alle fuenf sind `not null`.

create table if not exists nachweise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  -- Welche Taetigkeit geprueft wurde. Ohne sie ist das Zeugnis
  -- spaeter nicht einzuordnen: „hat eine Aufgabe geloest" sagt
  -- niemandem etwas.
  taetigkeit text not null,
  -- Was konkret bearbeitet wurde.
  aufgabe text not null,
  -- Unter welchen Bedingungen: Zeit, Hilfsmittel, Umgebung.
  bedingungen text not null,
  -- Was dabei herauskam, als Beobachtung statt als Urteil.
  ergebnis text not null,
  -- Wer dafuer einsteht.
  aussteller text not null,

  -- Fuer welche Stelle der Nachweis entstand. Nullbar und
  -- `set null`: Ein Zeugnis ueberlebt die Anzeige, aus der seine
  -- Aufgabe abgeleitet wurde -- sonst verfiele es mit ihr.
  job_id uuid references jobs(id) on delete set null,

  ausgestellt_am timestamptz not null default now(),
  -- Bis wann die Aussage traegt. Was jemand vor sechs Jahren konnte,
  -- sagt ueber heute wenig; ohne Ende wird ein Nachweis mit der Zeit
  -- zur Behauptung.
  gueltig_bis timestamptz,

  -- Ob der Mensch ihn weitergegeben hat. Die Entscheidung gehoert
  -- ihm, nicht dem System: Ein Nachweis, der ungefragt sichtbar wird,
  -- ist kein Nachweis, sondern eine Akte.
  geteilt boolean not null default false,
  geteilt_am timestamptz
);
--> statement-breakpoint

create index if not exists nachweise_person_idx
  on nachweise (user_id, ausgestellt_am desc);
--> statement-breakpoint

-- Ein Nachweis je Person und Taetigkeit. Wer dieselbe Sache erneut
-- belegt, ersetzt den alten Eintrag -- zwei Zeugnisse ueber dieselbe
-- Taetigkeit nebeneinander laden dazu ein, sich das guenstigere
-- auszusuchen.
create unique index if not exists nachweise_person_taetigkeit_unique
  on nachweise (user_id, lower(taetigkeit));
