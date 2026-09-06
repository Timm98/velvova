-- Anmeldung über Supabase Auth: Google und Telefonnummer.
--
-- ── Warum die E-Mail-Adresse optional wird ──────────────────────
--
-- Wer sich mit einer Telefonnummer anmeldet, hat keine E-Mail-Adresse.
-- Bisher war `email` Pflicht, und der bequeme Ausweg wäre gewesen,
-- eine zu erfinden — etwa "+491701234567@telefon.velvova.de". Das wäre
-- eine Adresse in der Datenbank, an die niemand schreiben kann, und
-- spätestens beim ersten Versand fällt es auf.
--
-- Stattdessen darf die Spalte leer sein. Der eindeutige Index bleibt:
-- Postgres lässt in einem UNIQUE-Index beliebig viele NULL-Werte zu,
-- aber keine zwei gleichen Adressen.
alter table users alter column email drop not null;
--> statement-breakpoint

-- Die Telefonnummer, immer im E.164-Format (+491701234567).
--
-- Eindeutig, damit dieselbe Nummer nicht zu zwei Konten führt. Auch
-- hier gilt: viele NULL, keine Dublette.
alter table users add column if not exists phone text;
--> statement-breakpoint

-- Wann die SMS bestätigt wurde.
--
-- Fehlte beim ersten Anlauf, obwohl die Spalte im Drizzle-Schema stand:
-- Die Anwendung schrieb `phone_verified_at`, die Datenbank kannte es
-- nicht, und jedes `insert into users` scheiterte mit „column does not
-- exist". Ein Schema ohne die zugehörige Migration ist keine halbe
-- Änderung, sondern eine kaputte.
alter table users add column if not exists phone_verified_at timestamptz;
--> statement-breakpoint

create unique index if not exists users_phone_unique on users (phone);
--> statement-breakpoint

-- Mindestens eine Kennung muss dastehen.
--
-- Ohne diese Bedingung wäre ein Konto möglich, das weder Adresse noch
-- Nummer hat — anlegbar, aber nie wieder erreichbar. Die Datenbank ist
-- die richtige Stelle dafür: Sie gilt auch für Wege, die es heute noch
-- nicht gibt.
alter table users add constraint users_kennung_vorhanden
  check (email is not null or phone is not null);
--> statement-breakpoint

-- Das Profilbild von einem Fremdanbieter.
--
-- `avatar_pfad` zeigt auf eine hochgeladene Datei in unserer Ablage.
-- Ein Google-Bild liegt bei Google; es hier herunterzuladen hiesse,
-- ohne Anlass eine Kopie eines Personenbildes anzulegen. Also die
-- Adresse, und die hochgeladene Datei hat weiterhin Vorrang.
alter table user_settings add column if not exists avatar_url text;
