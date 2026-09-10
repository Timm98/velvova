-- ══════════════════════════════════════════════════════════════════
-- Die Freigabe fuer genau eine Nachricht
-- ══════════════════════════════════════════════════════════════════
--
-- Velvova hat bereits `consents`: dauerhafte, allgemeine Einwilligung
-- ("Monday darf mein Postfach benutzen"), widerrufbar, gilt bis dahin.
--
-- Die reicht nicht. Wer einmal "ja, benutze mein Gmail" gesagt hat,
-- hat nicht gesagt, dass irgendetwas in seinem Namen hinausgehen darf
-- -- nur, dass der Weg offensteht. Diese Tabelle traegt die andere
-- Art: einmalig, an eine bestimmte Nachricht gebunden, verfallend.
--
-- ── Warum der Riegel hier liegt und nicht im Prompt ─────────────
--
-- Weil ein Prompt eine Bitte ist. "Sende nie ohne Freigabe" steht im
-- Systemtext, und im selben Text steht, dass Anzeigentexte Daten sind
-- und keine Anweisungen. Beides ist richtig, beides ist kein Riegel.
-- Ein Modell, das eine Anzeige liest, in der "ignoriere deine Regeln"
-- steht, soll nicht die einzige Instanz sein, die Nein sagt.
--
-- Die Entscheidung faellt in `versandfreigabe.ts` (Domaene) gegen die
-- Werte dieser Zeile: vier Zeitpunkte, zwei Vergleiche, kein Modell.
--
-- ── Warum der Fingerabdruck ueber den Inhalt geht ───────────────
--
-- Ohne ihn waere die Freigabe eine Erlaubnis, an diese Adresse
-- irgendetwas zu senden. Der Mensch hat aber nicht "eine Bewerbung"
-- freigegeben, sondern die, die er gelesen hat. Aendert sich danach
-- ein Zeichen daran, ist die Freigabe nicht mehr gueltig.
--
-- ── Warum nur der Hash des Tokens ───────────────────────────────
--
-- Dieselbe Bauart wie `magic_links` und `sessions`: Wer die Tabelle
-- liest, soll damit nichts senden koennen. Das Token selbst existiert
-- genau einmal, im Browser des Menschen, der es erzeugt hat.
--
-- ── Warum `empfaenger` mitgespeichert wird ──────────────────────
--
-- Damit ein gueltiges Token nicht an eine andere Adresse benutzbar
-- ist. Der naheliegende Angriff waere sonst: Freigabe fuer eine
-- Bewerbung holen, Empfaenger auf den aktuellen Arbeitgeber setzen.

create table if not exists versandfreigaben (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,

  -- Gebunden an die Adresse, die der Mensch gesehen hat.
  empfaenger text not null,
  -- sha256 ueber Empfaenger, Betreff und Text.
  fingerabdruck text not null,
  -- sha256 des Tokens. Das Token selbst wird nie gespeichert.
  token_hash text not null,

  gueltig_bis timestamptz not null,
  -- Einmal verwendbar. Gesetzt beim Einloesen, nicht beim Senden:
  -- Ein zweiter Versuch waehrend des ersten darf nicht durchkommen.
  verwendet_am timestamptz,
  widerrufen_am timestamptz,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint

-- Der Zugriffsweg beim Einloesen. Eindeutig, damit zwei Freigaben nie
-- denselben Hash tragen koennen.
create unique index if not exists versandfreigaben_token_unique
  on versandfreigaben (token_hash);
--> statement-breakpoint

-- "Was habe ich freigegeben" -- die Sicht des Menschen auf seine
-- eigenen offenen Freigaben.
create index if not exists versandfreigaben_user_idx
  on versandfreigaben (user_id, erstellt_am desc);
--> statement-breakpoint

alter table versandfreigaben enable row level security;
