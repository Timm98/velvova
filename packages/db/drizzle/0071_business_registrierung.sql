-- Was ein Unternehmen ausmacht — und wie weit die Prüfung ist.
--
-- ── Warum ein eigener Prüfstand neben `verified_at` ────────────
--
-- `verified_at` beantwortet eine Ja-Nein-Frage: bestätigt oder nicht.
-- Dazwischen liegen aber Tage, in denen jemand wissen will, woran es
-- gerade hängt — läuft die Domainprüfung, wartet eine E-Mail, sieht
-- ein Mensch drauf, fehlt eine Angabe.
--
-- Ohne diesen Zustand steht auf der Oberfläche „noch nicht bestätigt",
-- und das ist für jemanden, der seit drei Tagen wartet, keine Auskunft,
-- sondern eine Wiederholung.
alter table organizations add column if not exists rechtsname text;
--> statement-breakpoint
alter table organizations add column if not exists domain text;
--> statement-breakpoint
alter table organizations add column if not exists branche text;
--> statement-breakpoint
alter table organizations add column if not exists groesse text;
--> statement-breakpoint
alter table organizations add column if not exists hauptsitz text;
--> statement-breakpoint
alter table organizations add column if not exists handelsregister text;
--> statement-breakpoint
alter table organizations add column if not exists ust_id text;
--> statement-breakpoint

-- domain_pruefung · bestaetigung_gesendet · manuelle_pruefung
-- bestaetigt · angaben_fehlen
alter table organizations add column if not exists pruefstand text not null default 'angaben_fehlen';
--> statement-breakpoint
alter table organizations add column if not exists pruefstand_seit timestamptz;
--> statement-breakpoint

-- Die Domain ist der Schlüssel zum „wird bereits verwaltet".
--
-- Ohne Index wäre die Frage „gibt es dieses Unternehmen schon" ein
-- Durchlauf über alle Organisationen, und zwar bei jedem Tastendruck
-- im Registrierungsformular.
create index if not exists organizations_domain_idx on organizations (domain) where domain is not null;
--> statement-breakpoint

-- Die Funktion im Unternehmen — nicht die Berechtigung.
--
-- `memberships.role` sagt, was jemand DARF: owner, admin, recruiter,
-- viewer. `funktion` sagt, was jemand IST: Geschäftsführung,
-- Personalabteilung, Fachbereich. Beides in eine Spalte zu legen hiesse,
-- dass eine Beförderung Rechte ändert und eine Rechteänderung eine
-- Beförderung behauptet.
alter table memberships add column if not exists funktion text;
