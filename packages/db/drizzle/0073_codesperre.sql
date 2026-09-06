-- Sperre und Begrenzung für Bestätigungscodes.
--
-- ── Warum die IP als Hash ─────────────────────────────────────
--
-- Eine Begrenzung nur nach Adresse hilft gegen den Tippfehler, nicht
-- gegen den Angriff: Wer raten will, nimmt tausend Adressen. Nach IP
-- begrenzt trifft die Sperre den Absender statt das Opfer.
--
-- Gespeichert wird der Hash, nicht die Adresse. Eine IP ist ein
-- personenbezogenes Datum; für „wie viele Anfragen kamen von hier"
-- reicht ein Hash, und mehr braucht diese Tabelle nicht zu wissen.
-- Dieselbe Entscheidung wie bei `sessions.ip_hash`.
alter table bestaetigungscodes add column if not exists ip_hash text;
--> statement-breakpoint

-- Bis wann die Eingabe gesperrt ist.
--
-- Nach fünf Fehlversuchen war der Code bisher verbraucht — wer riet,
-- forderte einfach den nächsten an und hatte wieder fünf. Die Sperre
-- gilt deshalb der Person, nicht dem Code: Sie überlebt einen neuen
-- Code und läuft nach fünfzehn Minuten von selbst ab.
alter table bestaetigungscodes add column if not exists gesperrt_bis timestamptz;
--> statement-breakpoint

create index if not exists bestaetigungscodes_ip_idx
  on bestaetigungscodes (ip_hash, created_at desc)
  where ip_hash is not null;
