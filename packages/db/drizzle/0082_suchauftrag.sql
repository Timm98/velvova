-- „Nina sucht für dich weiter" — Suchauftrag, Treffer, Zusammenfassung, Versand.
--
-- ══════════════════════════════════════════════════════════════
-- Warum drei getrennte Dinge und nicht ein Feld mehr an `job_alarme`
-- ══════════════════════════════════════════════════════════════
--
-- `job_alarme` gibt es schon: Name, Filterzeichenkette, Adresse, aktiv.
-- Das ist eine gespeicherte Suche, und als solche richtig. Was fehlt,
-- ist die Unterscheidung, an der der ganze Auftrag hängt:
--
--   Das Karriereprofil  gilt für die Person.
--   Der Suchauftrag     gilt für eine Suche — und es darf mehrere geben.
--   Die Benachrichtigung ist eine dritte Entscheidung.
--
-- Ohne diese Trennung überschreibt eine vorübergehende Recherche
-- („nur diese Woche auch Hamburg") das Profil. Und eine Person, die
-- zwei Suchen laufen hat, bekäme zwei fast gleiche Mails.
--
-- ══════════════════════════════════════════════════════════════
-- Warum die Filter nicht als Zeichenkette weitergeführt werden
-- ══════════════════════════════════════════════════════════════
--
-- `job_alarme.filter` ist die Abfragezeichenkette der Stellenseite.
-- Reproduzierbar, aber nicht prüfbar: Man kann ihr nicht ansehen, ob
-- „Teilzeit" ein Muss oder ein Wunsch war, woher es kam und ob es
-- jemand bestätigt hat. Genau das entscheidet aber, ob eine Stelle
-- ausgeschlossen werden darf.
--
-- Deshalb steht jedes Kriterium einzeln, mit Stärke, Herkunft,
-- Beleg und Bestätigungsstand.

CREATE TABLE IF NOT EXISTS "such_auftraege" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,

  -- entwurf · aktiv · pausiert · beendet
  --
  -- `entwurf` ist der Zustand nach einem Vorschlag. Er sucht nicht und
  -- versendet nicht. Schweigen lässt ihn dort stehen — Abschnitt 2:
  -- „Keine Reaktion auf einen Vorschlag aktiviert nichts."
  "status" text NOT NULL DEFAULT 'entwurf',

  -- einmalig · fortlaufend
  --
  -- Ein einmaliger Auftrag endet auch ohne Treffer. Das ist der
  -- Unterschied zur Versandbedingung „nur bei Treffern", die nur sagt,
  -- ob eine Mail rausgeht.
  "laufzeit" text NOT NULL DEFAULT 'fortlaufend',
  "endet_am" timestamptz,

  -- nur_app · app_und_email
  "kanal" text NOT NULL DEFAULT 'nur_app',
  -- taeglich · woechentlich
  "rhythmus" text NOT NULL DEFAULT 'taeglich',
  -- nur_bei_treffern · immer
  "versandbedingung" text NOT NULL DEFAULT 'nur_bei_treffern',

  -- Die Ortszeit, zu der die Zusammenfassung ankommen soll, und die
  -- Zeitzone, in der diese Uhrzeit gilt.
  --
  -- Beides getrennt, weil „08:00" ohne Zone keine Uhrzeit ist. Eine
  -- pauschale Berlin-Annahme wäre für jede Person ausserhalb
  -- Mitteleuropas schlicht die falsche Tageszeit.
  "sendezeit_lokal" text NOT NULL DEFAULT '08:00',
  "zeitzone" text NOT NULL DEFAULT 'Europe/Berlin',
  -- 1 (Montag) bis 7 — nur bei woechentlich.
  "wochentag" smallint,

  -- Für wen gesucht wird und wie lange die Angaben gelten.
  --
  -- „Ich suche für meinen Bruder" darf keine Präferenz der Person
  -- werden. Das steht hier, nicht im Profil.
  "geltungsbereich" jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- chat · voice · suchergebnisse · vorschlag
  "herkunft" text NOT NULL DEFAULT 'chat',

  -- Die Profilfassung, mit der gerade gesucht wird. Fremdschlüssel
  -- folgt weiter unten — die Tabelle gibt es hier noch nicht.
  "aktive_profil_version" uuid,

  -- Ob seit dem letzten Kompilieren neue Signale eingegangen sind.
  -- Der Nachhollauf arbeitet genau diese Aufträge ab.
  "aktualisierung_noetig" boolean NOT NULL DEFAULT true,

  "zuletzt_geprueft" timestamptz,
  -- Wann das nächste Versandfenster fällig ist — in UTC gerechnet.
  "naechste_faelligkeit" timestamptz,
  "bestaetigt_am" timestamptz,
  "beendet_am" timestamptz,
  -- endzeit · nutzer · konto_geloescht · fehlende_zustimmung
  "abschlussgrund" text,
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "aktualisiert_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "such_auftraege_user_idx" ON "such_auftraege" ("user_id", "status")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "such_auftraege_faellig_idx" ON "such_auftraege" ("status", "naechste_faelligkeit")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "such_auftraege_offen_idx" ON "such_auftraege" ("aktualisierung_noetig", "status")
--> statement-breakpoint

-- Eine unveränderliche Fassung des kompilierten Suchprofils.
--
-- Warum unveränderlich: Ein Treffer verweist auf die Fassung, mit der
-- er berechnet wurde. Änderte sich die Fassung nachträglich, stünde in
-- der Mail eine Begründung, die zu keiner gespeicherten Angabe passt.
--
-- Warum Entwurf und aktiv getrennt: Zwei Geräte, ein verspäteter
-- Modelllauf — und ein älteres Ergebnis überschreibt ein neueres.
-- Ein Entwurf wird erst aktiv, wenn das Backend ihn freigibt.
CREATE TABLE IF NOT EXISTS "such_profile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "auftrag_id" uuid NOT NULL REFERENCES "such_auftraege"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  -- entwurf · aktiv · ersetzt · verworfen
  "zustand" text NOT NULL DEFAULT 'entwurf',
  -- Was das Modell vorgeschlagen hat, unverändert. Der Vergleich
  -- zwischen Vorschlag und übernommenen Kriterien ist der Nachweis,
  -- dass das Backend und nicht das Modell entschieden hat.
  "vorschlag" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "konflikte" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "offene_punkte" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "rueckfrage" text,
  "bestaetigungstext" text,
  "prompt_fassung" text NOT NULL DEFAULT 'suchprofil-1',
  "modellkonfiguration" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "aktiviert_am" timestamptz
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "such_profile_version_idx" ON "such_profile" ("auftrag_id", "version")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "such_profile_user_idx" ON "such_profile" ("user_id", "zustand")
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "such_auftraege"
    ADD CONSTRAINT "such_auftraege_profil_fk"
    FOREIGN KEY ("aktive_profil_version") REFERENCES "such_profile"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$
--> statement-breakpoint

-- Ein einzelnes Kriterium einer Profilfassung.
--
-- ── Warum `gruppe` ────────────────────────────────────────────
--
-- „Stuttgart oder vollständig remote" sind zwei Zeilen mit derselben
-- Gruppe. Verschiedene Gruppen gelten zusammen (UND), gleiche Gruppe
-- sind Alternativen (ODER).
--
-- Ohne dieses Feld würden aus einer Alternative zwei gleichzeitig
-- zwingende Standortbedingungen — und die Suche fände nichts.
--
-- ── Warum `staerke` und `bestaetigungsstatus` getrennt sind ───
--
-- „Homeoffice wäre schön" ist eine ausdrückliche Aussage und trotzdem
-- kein Muss. Bestätigt heisst: die Person hat es so bestätigt.
-- Muss heisst: es darf eine Stelle ausschliessen. Das ist nicht
-- dasselbe, und ein gemeinsames Feld hätte aus jedem bestätigten
-- Wunsch einen Ausschluss gemacht.
CREATE TABLE IF NOT EXISTS "such_kriterien" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profil_id" uuid NOT NULL REFERENCES "such_profile"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- Der stabile Schlüssel, etwa „arbeitsort" oder „mindestgehalt".
  "kriterium" text NOT NULL,
  "wert" jsonb NOT NULL,
  "einheit" text,
  -- gleich · mindestens · hoechstens · enthaelt · einer_von · nicht
  "operator" text NOT NULL DEFAULT 'gleich',
  -- muss · wunsch · interesse
  "staerke" text NOT NULL DEFAULT 'wunsch',
  -- Alternativen teilen sich eine Gruppe. NULL heisst: steht für sich.
  "gruppe" text,
  -- auftrag · profil · befristet
  "geltungsbereich" text NOT NULL DEFAULT 'auftrag',
  -- nutzer_aussage · uebernommener_filter · nutzerfakt · verhalten · nina_ableitung
  "herkunft" text NOT NULL,
  "signal_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "beobachtet_am" timestamptz,
  "bestaetigt_am" timestamptz,
  -- bestaetigt · offen · abgelehnt
  "bestaetigungsstatus" text NOT NULL DEFAULT 'offen',
  -- Befristete Zusätze („nur heute auch Hamburg") und verfallende
  -- Verhaltenssignale. NULL heisst: gilt bis zur Änderung.
  "gueltig_bis" timestamptz,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "such_kriterien_profil_idx" ON "such_kriterien" ("profil_id", "staerke")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "such_kriterien_user_idx" ON "such_kriterien" ("user_id")
--> statement-breakpoint

-- Neue Signale, aus denen ein Profil kompiliert wird.
--
-- ── Warum eine eigene Tabelle und nicht „die Chats von gestern" ─
--
-- Täglich alle bisherigen Gespräche erneut auszuwerten kostet bei
-- jedem Lauf dasselbe Geld und liefert dasselbe Ergebnis. Hier steht,
-- was seit dem letzten Profilstand hinzugekommen ist — mehr braucht
-- der Compiler nicht.
--
-- ── Warum `ereignis_schluessel` eindeutig ist ─────────────────
--
-- Dieselbe Nachricht darf nicht zweimal zu einem Signal werden, wenn
-- der Browser die Aktion wiederholt oder ein Worker neu startet.
CREATE TABLE IF NOT EXISTS "profil_signale" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "auftrag_id" uuid REFERENCES "such_auftraege"("id") ON DELETE CASCADE,
  "ereignis_schluessel" text NOT NULL,
  -- nachricht · filter_uebernommen · gespeichert · abgelehnt ·
  -- beworben · einstellung · auftrag_geaendert
  "art" text NOT NULL,
  "inhalt" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- chat · voice · ui_filter · feedback · einstellungen
  "quelle" text NOT NULL,
  "nachricht_id" uuid,
  -- Ob die Person das ausdrücklich gesagt hat, oder ob es beobachtet
  -- wurde. Beobachtetes darf kein Muss erzeugen.
  "ausdruecklich" boolean NOT NULL DEFAULT false,
  "beobachtet_am" timestamptz NOT NULL DEFAULT now(),
  "verarbeitet_am" timestamptz,
  -- Verhaltenssignale verfallen. Was bestätigt wurde, steht als
  -- Kriterium und verfällt nicht mit dem Signal.
  "verfaellt_am" timestamptz,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profil_signale_ereignis_idx" ON "profil_signale" ("user_id", "ereignis_schluessel")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profil_signale_offen_idx" ON "profil_signale" ("user_id", "verarbeitet_am")
--> statement-breakpoint

-- Wohin Benachrichtigungen gehen — und ob überhaupt.
--
-- Getrennt vom Auftrag, weil eine Person mehrere Aufträge und einen
-- Posteingang hat. Und getrennt von `users.email`: Eine verifizierte
-- Anmeldeadresse ist kein Einverständnis mit Jobmails.
CREATE TABLE IF NOT EXISTS "benachrichtigung_einstellungen" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "email_aktiv" boolean NOT NULL DEFAULT false,
  "email_adresse" text,
  -- Der Nachweis des Double-Opt-in. Ohne ihn geht nichts hinaus.
  "adresse_bestaetigt_am" timestamptz,
  "doi_token_hash" text,
  "doi_gesendet_am" timestamptz,
  "zeitzone" text NOT NULL DEFAULT 'Europe/Berlin',
  "sendezeit_lokal" text NOT NULL DEFAULT '08:00',
  -- Eine Pause ist etwas anderes als ein Ende. „Heute Nacht nicht"
  -- setzt nur einen Lauf aus und steht deshalb am Auftrag.
  "pausiert_bis" timestamptz,
  "zuletzt_aktiv_am" timestamptz,
  "hinweis_fassung" text,
  "aktualisiert_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint

-- Ein persönlicher Treffer: diese Stelle, für diesen Auftrag,
-- mit dieser Profilfassung, nach dieser Regelfassung.
--
-- ── Warum neben `job_matches` ─────────────────────────────────
--
-- `job_matches` ist der Match einer Person mit einer Stelle, wie ihn
-- die Stellenliste zeigt: eine Zeile je (Person, Stelle). Ein
-- Suchauftrag braucht die Zuordnung zum Auftrag und zur Profilfassung
-- — sonst liesse sich nicht sagen, WELCHER Auftrag diese Stelle
-- gefunden hat und mit welchen Kriterien.
--
-- Die Zahlen kommen aus demselben Matchingservice. Es gibt hier keine
-- zweite Gewichtung und keinen nächtlichen Sonderscore.
CREATE TABLE IF NOT EXISTS "auftrag_treffer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "auftrag_id" uuid NOT NULL REFERENCES "such_auftraege"("id") ON DELETE CASCADE,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  -- Dieselbe Stelle über mehrere Portale. Zeigt auf die Stelle, die
  -- als Original gilt; bei einer Einzelstelle auf sich selbst.
  "kanonische_job_id" uuid NOT NULL,
  "profil_id" uuid NOT NULL REFERENCES "such_profile"("id") ON DELETE CASCADE,
  "analyse_id" uuid REFERENCES "job_analysen"("id") ON DELETE SET NULL,
  "analyse_fassung" integer,
  "matching_fassung" text NOT NULL,
  "karriereprofil_stand" timestamptz,

  -- Aus dem gemeinsamen Matchingservice. `fit_score` bleibt NULL,
  -- wenn das Profil zu dünn ist — eine erfundene Zahl wäre schlimmer
  -- als keine.
  "fit_score" integer,
  "fit_abdeckung" double precision,

  -- eligible · ineligible · needs_clarification
  --
  -- Eine unbekannte Muss-Angabe ist nicht erfüllt und nicht verletzt.
  -- Sie zu „erfüllt" zu runden ist der Fehler, den Abschnitt 7
  -- ausdrücklich verbietet.
  "zulaessigkeit" text NOT NULL DEFAULT 'needs_clarification',
  -- empfohlen · zurueckgestellt · ausgeschlossen
  "empfehlungsstatus" text NOT NULL DEFAULT 'zurueckgestellt',
  "empfehlungsgruende" jsonb NOT NULL DEFAULT '[]'::jsonb,

  "kriterien_ergebnisse" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "gruende" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "offene_punkte" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "caveat" text,

  -- Fingerabdruck der Angaben, die eine erneute Mail rechtfertigen:
  -- Gehalt, Vertrag, Arbeitszeit, Ort, Titel. Ein neuer
  -- Analysezeitstempel gehört nicht dazu.
  "materielle_fassung" text NOT NULL,

  -- offen · ausgewaehlt · benachrichtigt · verfallen · ungueltig
  --
  -- Ein freigegebener, aber nicht ausgewählter Treffer bleibt `offen`
  -- und verschwindet nicht am Versandstichtag.
  "zustand" text NOT NULL DEFAULT 'offen',
  "ungueltig_grund" text,
  "berechnet_am" timestamptz NOT NULL DEFAULT now(),
  "verfaellt_am" timestamptz
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auftrag_treffer_unique" ON "auftrag_treffer" ("auftrag_id", "job_id")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auftrag_treffer_auswahl_idx" ON "auftrag_treffer" ("auftrag_id", "zustand", "empfehlungsstatus")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auftrag_treffer_user_idx" ON "auftrag_treffer" ("user_id", "zustand")
--> statement-breakpoint

-- Was dieser Person zu welcher Stelle schon gemeldet wurde.
--
-- Nutzerweit, nicht je Auftrag: Wer zwei Suchen laufen hat, soll
-- dieselbe Stelle nicht zweimal als Entdeckung bekommen.
CREATE TABLE IF NOT EXISTS "job_benachrichtigungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kanonische_job_id" uuid NOT NULL,
  -- Der Stand, in dem die Stelle gemeldet wurde. Nur eine Änderung
  -- daran rechtfertigt eine zweite Meldung.
  "materielle_fassung" text NOT NULL,
  "anzahl" integer NOT NULL DEFAULT 1,
  "zuerst_am" timestamptz NOT NULL DEFAULT now(),
  "zuletzt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_benachrichtigungen_unique" ON "job_benachrichtigungen" ("user_id", "kanonische_job_id")
--> statement-breakpoint

-- Die Zusammenfassung eines Versandfensters.
--
-- ── Warum ein Fensterschlüssel ────────────────────────────────
--
-- Ein Cron, der zweimal läuft, darf keine zweite Mail erzeugen. Der
-- Schlüssel ist stabil aus Person, lokalem Datum und Rhythmus
-- gebildet; die Eindeutigkeit steht in der Datenbank und nicht in der
-- Hoffnung, dass der Scheduler sich benimmt.
--
-- ── Warum mehrere Aufträge eine Zusammenfassung teilen ────────
--
-- Sonst bekäme jemand mit drei Suchen drei fast gleiche Mails.
CREATE TABLE IF NOT EXISTS "zusammenfassungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "fensterschluessel" text NOT NULL,
  "fenster_beginn" timestamptz NOT NULL,
  -- entwurf · freigegeben · versendet · uebersprungen
  "zustand" text NOT NULL DEFAULT 'entwurf',
  -- keine_treffer · keine_zustimmung · unterdrueckt · budget · anbieter_fehlt
  "uebersprungen_grund" text,
  -- „Bestätigter Suchauftrag vom …" — serverseitig erzeugt, nicht vom
  -- Modell behauptet.
  "basis_label" text,
  "betreff" text,
  "einleitung" text,
  "abschluss" text,
  "text_fassung" text NOT NULL DEFAULT 'zusammenfassung-1',
  "modell" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "freigegeben_am" timestamptz
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zusammenfassungen_fenster_idx" ON "zusammenfassungen" ("user_id", "fensterschluessel")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "zusammenfassung_posten" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "zusammenfassung_id" uuid NOT NULL REFERENCES "zusammenfassungen"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "treffer_id" uuid NOT NULL REFERENCES "auftrag_treffer"("id") ON DELETE CASCADE,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "kanonische_job_id" uuid NOT NULL,
  "materielle_fassung" text NOT NULL,
  "grund" text,
  "caveat" text,
  -- neu · aktualisierung
  "art" text NOT NULL DEFAULT 'neu',
  "position" smallint NOT NULL DEFAULT 0
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zusammenfassung_posten_unique" ON "zusammenfassung_posten" ("zusammenfassung_id", "kanonische_job_id")
--> statement-breakpoint

-- Der Versandausgang.
--
-- ── Warum die Mail hier steht und nicht direkt rausgeht ───────
--
-- Ein Anbieteraufruf kann nach der Annahme in eine Zeitüberschreitung
-- laufen. Ohne Ausgang wüsste danach niemand, ob die Mail draussen
-- ist — und der bequeme Ausweg wäre, sie noch einmal zu schicken.
--
-- `accepted` heisst: Der Anbieter hat sie angenommen. Nicht: sie liegt
-- im Postfach. Das sind zwei verschiedene Aussagen, und nur eine
-- davon können wir belegen.
CREATE TABLE IF NOT EXISTS "mail_ausgang" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "zusammenfassung_id" uuid REFERENCES "zusammenfassungen"("id") ON DELETE SET NULL,
  -- Bleibt über Wiederholungen gleich. Ein neuer Schlüssel bei einem
  -- Retry wäre eine zweite Mail mit anderem Namen.
  "idempotenz_schluessel" text NOT NULL,
  "an" text NOT NULL,
  "betreff" text NOT NULL,
  "html" text NOT NULL,
  "text" text NOT NULL,
  -- queued · sending · accepted · delivered · failed · suppressed · unknown
  "zustand" text NOT NULL DEFAULT 'queued',
  "anbieter" text,
  "anbieter_id" text,
  "versuche" smallint NOT NULL DEFAULT 0,
  "naechster_versuch" timestamptz,
  "fehler" text,
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "gesendet_am" timestamptz,
  "aktualisiert_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_ausgang_idempotenz_idx" ON "mail_ausgang" ("idempotenz_schluessel")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_ausgang_offen_idx" ON "mail_ausgang" ("zustand", "naechster_versuch")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "zustell_ereignisse" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ausgang_id" uuid REFERENCES "mail_ausgang"("id") ON DELETE CASCADE,
  -- Die Kennung des Anbieters. Webhooks kommen doppelt und verspätet;
  -- ohne sie liesse sich ein Ereignis nicht zweimal erkennen.
  "anbieter_ereignis_id" text,
  "art" text NOT NULL,
  "nutzlast" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ereignis_am" timestamptz,
  "empfangen_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zustell_ereignisse_anbieter_idx" ON "zustell_ereignisse" ("anbieter_ereignis_id")
--> statement-breakpoint

-- Adressen, an die nichts mehr geht.
--
-- Ohne Nutzerbezug: Eine Adresse, die hart abprallt, bleibt auch dann
-- gesperrt, wenn sie später zu einem anderen Konto gehört. Genau
-- deshalb steht hier keine `user_id`.
CREATE TABLE IF NOT EXISTS "unterdrueckungen" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  -- hard_bounce · beschwerde · abgemeldet · manuell
  "grund" text NOT NULL,
  "quelle" text,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unterdrueckungen_email_idx" ON "unterdrueckungen" (lower("email"))
--> statement-breakpoint

-- Abmeldung ohne Anmeldung.
--
-- Das Token erlaubt genau eine Sache: abmelden. Es ist kein Login und
-- öffnet keine Profilansicht. Gespeichert wird nur der Hash — wer die
-- Datenbank liest, kann sich damit nicht abmelden.
CREATE TABLE IF NOT EXISTS "abmelde_token" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  -- abmelden · bestaetigen
  "zweck" text NOT NULL DEFAULT 'abmelden',
  "erstellt_am" timestamptz NOT NULL DEFAULT now(),
  "verwendet_am" timestamptz,
  "gueltig_bis" timestamptz
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "abmelde_token_hash_idx" ON "abmelde_token" ("token_hash")
--> statement-breakpoint

-- Wo ein Auftrag stehengeblieben ist.
--
-- ── Warum nicht `created_at > last_digest_at` ─────────────────
--
-- Weil eine Analyse verspätet fertig wird. Die Stelle wurde gestern
-- importiert, heute analysiert — und fällt aus jedem Zeitfenster, das
-- am Importdatum hängt. Ein Fortschrittsstand je Auftrag und Art
-- merkt sich, was tatsächlich verarbeitet wurde.
CREATE TABLE IF NOT EXISTS "verarbeitungs_fortschritt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "auftrag_id" uuid NOT NULL REFERENCES "such_auftraege"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- profil · suche · matching · zusammenfassung
  "art" text NOT NULL,
  "stand" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Bis zu welchem Analysezeitpunkt gearbeitet wurde. Verspätete
  -- Analysen liegen danach und werden im nächsten Lauf gefunden.
  "analyse_bis" timestamptz,
  "letzter_lauf" timestamptz,
  "aktualisiert_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verarbeitungs_fortschritt_unique" ON "verarbeitungs_fortschritt" ("auftrag_id", "art")

--> statement-breakpoint

-- Drei neue Einwilligungsarten.
--
-- Getrennt, weil es drei getrennte Entscheidungen sind: im Hintergrund
-- suchen, dafür Gesprächs- und Verhaltenssignale auswerten, und
-- Ergebnisse per Mail bekommen. Wer nur das erste will, muss das
-- zweite nicht mitgeben — die Suche funktioniert mit ausdrücklich
-- bestätigten Angaben allein.
ALTER TYPE "consent_kind" ADD VALUE IF NOT EXISTS 'background_search'
--> statement-breakpoint
ALTER TYPE "consent_kind" ADD VALUE IF NOT EXISTS 'behaviour_signals'
--> statement-breakpoint
ALTER TYPE "consent_kind" ADD VALUE IF NOT EXISTS 'job_digest_email'
