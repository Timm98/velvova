-- ══════════════════════════════════════════════════════════════════
-- Ein Projekt bekommt seine Suche
-- ══════════════════════════════════════════════════════════════════
--
-- Bis hierher war ein Projekt ein Ordner: `ziel` als ein Satz Freitext
-- und Stellen, die jemand von Hand hineinlegt. Ein Satz laesst sich
-- nicht gegen 3,5 Mio. Anzeigen pruefen, also blieb die Liste leer,
-- bis jemand sie fuellte.
--
-- ── Warum keine zweite Trefferkette ─────────────────────────────
--
-- Die naheliegende Loesung waere `projekt_treffer` gewesen: eine
-- Tabelle, die Stellen an Projekte haengt, mit eigenem Abgleich.
-- Daneben laeuft aber bereits eine, die genau das tut —
-- `such_auftraege` mit `such_profile`, `such_kriterien` und
-- `auftrag_treffer`, stuendlich, mit Fit, Zulaessigkeit und
-- Begruendungen.
--
-- Zwei Ketten, die dasselbe rechnen, laufen auseinander. Nicht
-- irgendwann, sondern beim ersten Mal, wenn eine von beiden eine
-- Regel bekommt, die die andere nicht hat — und dann steht unter dem
-- Projekt eine andere Stellenliste als unter dem Suchauftrag, aus dem
-- es entstanden ist. Welche stimmt, kann niemand mehr sagen.
--
-- Deshalb eine Spalte statt einer Tabelle. Der Weg ist danach:
-- Projekt → Suchauftrag → auftrag_treffer → Stellen.
--
-- ── Warum an `such_auftraege` und nicht an `projekte` ───────────
--
-- Weil ein Vorhaben mehr als eine Suche haben kann: "Projektleitung
-- in Zuerich" und "dasselbe remote" sind zwei Auftraege mit
-- verschiedenen Kriterien und einem gemeinsamen Ziel. Umgekehrt waere
-- es eine Spalte auf `projekte` und damit genau ein Auftrag.
--
-- ── Warum nullbar und `set null` ────────────────────────────────
--
-- Suchauftraege gab es vor den Projekten, und es soll sie weiter
-- ohne geben. Wer ein Projekt loescht, will das Vorhaben loswerden —
-- nicht seine laufende Suche samt Benachrichtigungen. Dieselbe
-- Entscheidung wie bei den drei Zuordnungen in 0104.

alter table such_auftraege
  add column if not exists projekt_id uuid references projekte(id) on delete set null;
--> statement-breakpoint

-- Teilindex: Auftraege ohne Projekt sind der haeufige Fall und
-- gehoeren nicht in einen Index, der die Frage "was gehoert zu diesem
-- Projekt" beantworten soll.
create index if not exists such_auftraege_projekt_idx
  on such_auftraege (projekt_id) where projekt_id is not null;
