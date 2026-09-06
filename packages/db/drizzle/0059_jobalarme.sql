-- Suchaufträge: gespeicherte Suchen, die benachrichtigen sollen.
--
-- ── Warum eine eigene Tabelle und kein Newsletter ─────────────
--
-- „Newsletter abonnieren" mit einer Erfolgsmeldung, hinter der nichts
-- passiert, ist eine Lüge mit Häkchen. Hier wird eine Suche wirklich
-- gespeichert — mit den Filtern, die gerade gesetzt sind.
--
-- Der Versand ist ein zweiter Schritt und steht noch aus. Deshalb sagt
-- die Oberfläche, was tatsächlich geschieht: Die Suche ist gemerkt,
-- Benachrichtigungen kommen, sobald der Versand steht. Kein „Danke,
-- du erhältst ab jetzt Stellen".
create table if not exists job_alarme (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  /* Der Name, den der Mensch der Suche gibt. */
  name text not null,
  /* Die Filter als Abfragezeichenkette — dieselbe Form wie in der
     Adresse der Stellenseite. Damit ist der Auftrag reproduzierbar:
     Man kann ihn öffnen und sieht genau die Suche. */
  filter text not null,
  aktiv boolean not null default true,
  /* Wann zuletzt geprüft wurde. `null` heisst: noch nie. */
  zuletzt_geprueft timestamptz,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists job_alarme_user_idx on job_alarme (user_id, aktiv);
