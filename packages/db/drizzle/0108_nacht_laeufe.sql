-- ══════════════════════════════════════════════════════════════════
-- Der Nachtlauf bekommt einen Beleg
-- ══════════════════════════════════════════════════════════════════
--
-- Velvova sucht bereits nachts. `durchlaufAusfuehren` zieht
-- Einbettungen nach, holt die faelligen Auftraege, prueft harte
-- Kriterien, rechnet die semantische Runde, laesst Belege schreiben
-- und legt Treffer in `auftrag_treffer` ab.
--
-- Nur weiss der Mensch, fuer den gesucht wurde, davon nichts.
--
-- Die Zahlen dieses Laufs gehen als `Durchlaufbericht` an den
-- Zeitplan-Aufruf zurueck und sterben dort. Morgens laesst sich
-- deshalb nicht sagen, wie viele Anzeigen angesehen wurden, wie viele
-- an der Gehaltsgrenze scheiterten oder ob ueberhaupt alle Quellen
-- erreichbar waren. Genau diese Saetze sind aber der Moment:
--
--   "Ich habe heute Nacht 143 Stellen geprueft. 61 erfuellten deine
--    Mindestanforderungen. Diese fuenf wuerde ich mir zuerst ansehen."
--
-- Ohne festgehaltene Zahlen ist dieser Satz eine Erfindung.
--
-- ── Warum keine zweite Suchkette ────────────────────────────────
--
-- Diese Tabelle rechnet nichts. Sie haelt fest, was `auftragslaufRunde`
-- ohnehin zurueckgibt (geprueft, empfohlen, zurueckgestellt,
-- ausgeschlossen, grund). Dieselbe Ueberlegung wie bei 0105: zwei
-- Ketten, die dasselbe rechnen, laufen auseinander -- und dann steht
-- im Morgenbericht eine andere Zahl als in der Trefferliste, und
-- niemand kann sagen, welche stimmt.
--
-- ── Warum ein Nachtschluessel ───────────────────────────────────
--
-- Derselbe Gedanke wie bei `zusammenfassungen.fensterschluessel`: Der
-- Zeitplan laeuft stuendlich, weil "08:00" die Ortszeit der Person
-- ist. Zweimal im selben Fenster zu laufen darf keinen zweiten Lauf
-- erzeugen. Die Eindeutigkeit steht in der Datenbank und nicht in der
-- Hoffnung, dass der Scheduler sich benimmt.
--
-- ── Warum `gesehen_am` ──────────────────────────────────────────
--
-- Ein Bericht, den niemand geoeffnet hat, ist kein zugestellter
-- Bericht. Ohne dieses Feld liesse sich nie beantworten, ob der
-- Morgenmoment ueberhaupt stattfindet -- und das ist die Frage, an der
-- das ganze Vorhaben haengt.
--
-- ── Warum die Zaehler nicht nullbar sind ────────────────────────
--
-- `null` hiesse "nicht gezaehlt", und genau das darf es hier nicht
-- geben: Was nicht gezaehlt wurde, ist 0, und ein Lauf, der gar nicht
-- lief, hat keine Zeile. Widersprueche zwischen den Zaehlern faengt
-- `bilanzPruefen()` im Domaenenpaket ab, bevor daraus ein Satz wird.

create table if not exists nacht_laeufe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  auftrag_id uuid not null references such_auftraege(id) on delete cascade,

  -- Stabil aus Person, lokalem Datum und Auftrag gebildet.
  nacht_schluessel text not null,

  -- ruhe · verstehen · sammeln · entdoppeln · pruefen · bewerten ·
  -- tiefenanalyse · stiller_markt · bericht · bereit · fehler
  -- Geprueft wird in `nachtlauf.ts`, nicht per enum: Eine neue Phase
  -- soll eine Codeaenderung sein, kein Datenbankeingriff.
  phase text not null default 'ruhe',

  -- Gezaehlt, nicht geschaetzt. Siehe Kopf.
  gefunden integer not null default 0,
  nach_filtern integer not null default 0,
  geprueft integer not null default 0,
  empfohlen integer not null default 0,
  zurueckgestellt integer not null default 0,
  ausgeschlossen integer not null default 0,
  stille_chancen integer not null default 0,

  -- Namen der Quellen, die nicht antworteten. Ein Lauf mit
  -- ausgefallenen Quellen ist kein gescheiterter Lauf, aber auch kein
  -- vollstaendiger -- und der Unterschied gehoert in den Bericht.
  quellen_fehler jsonb not null default '[]'::jsonb,

  -- kein_aktives_profil · keine_kriterien · keine_kandidaten · fehler
  grund text,

  begonnen_am timestamptz not null default now(),
  beendet_am timestamptz,
  gesehen_am timestamptz
);
--> statement-breakpoint

-- Ein Lauf je Person, Auftrag und Nacht.
create unique index if not exists nacht_laeufe_schluessel_idx
  on nacht_laeufe (user_id, auftrag_id, nacht_schluessel);
--> statement-breakpoint

-- "Was war letzte Nacht" -- die einzige Abfrage der Morgenansicht.
create index if not exists nacht_laeufe_user_idx
  on nacht_laeufe (user_id, begonnen_am desc);
--> statement-breakpoint

alter table nacht_laeufe enable row level security;
