-- Der Hintergrundlauf der Profilsynthese -- und was ihn davon abhaelt,
-- zweimal dasselbe zu rechnen.
--
-- ══════════════════════════════════════════════════════════════
-- Warum eine Tabelle und kein Advisory Lock
-- ══════════════════════════════════════════════════════════════
--
-- Eine Synthese dauert Sekunden und liegt zwischen zwei
-- Transaktionen: laden, Modell fragen, schreiben. Ein Advisory Lock
-- muesste ueber diese Zeit auf DERSELBEN Verbindung gehalten werden.
-- Mit einem Verbindungspool ist das nicht garantiert -- die Sperre
-- wuerde auf einer Verbindung gesetzt und auf einer anderen wieder
-- freigegeben, und das schlaegt still fehl.
--
-- Diese Tabelle haelt den Anspruch als Zeile. Sie ueberlebt einen
-- Neustart, sie ist lesbar, und sie beantwortet nebenbei die Frage,
-- die man sonst nicht beantworten kann: Was hat der Hintergrund
-- gestern eigentlich getan, und was ist dabei schiefgegangen.
CREATE TABLE IF NOT EXISTS "profil_laeufe" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- profilsynthese | karriereanalyse
  "art" text NOT NULL,
  -- Warum gerechnet wurde: erste_analyse | genug_neues | zu_lange_her
  -- | wichtiges_ereignis | ausdruecklich
  "anlass" text NOT NULL,
  -- laeuft | fertig | fehler | abgebrochen | uebersprungen
  "zustand" text NOT NULL DEFAULT 'laeuft',
  -- Der wievielte Versuch. Nach drei Fehlschlaegen in Folge ruht das
  -- Profil bis zum naechsten Tag -- ein Modell, das dreimal
  -- nacheinander nicht antwortet, antwortet auch beim vierten Mal
  -- nicht, und der Versuch kostet jedes Mal Geld.
  "versuch" integer NOT NULL DEFAULT 1,
  "modell" text,
  -- Wie viele Modellaufrufe dieser Lauf verbraucht hat.
  "modellaufrufe" integer NOT NULL DEFAULT 0,
  -- Die FEHLERKLASSE, nicht die Meldung.
  --
  -- Eine Modellmeldung kann Teile des Prompts enthalten, und der
  -- Prompt enthaelt, was die Person ueber sich gesagt hat. Ein
  -- Betriebsprotokoll ist der falsche Ort dafuer.
  "fehler" text,
  "begonnen_am" timestamptz NOT NULL DEFAULT now(),
  "beendet_am" timestamptz
)
--> statement-breakpoint
-- Hoechstens ein laufender Anspruch je Profil und Art.
--
-- Zwei Arbeiter, die dasselbe Profil greifen, wuerden zweimal Sol
-- bezahlen und zwei Synthesen desselben Belegstands schreiben. Der
-- zweite bekommt hier eine Verletzung des Unique-Index und geht
-- weiter zum naechsten Profil.
CREATE UNIQUE INDEX IF NOT EXISTS "profil_laeufe_laeuft_unique"
  ON "profil_laeufe" ("user_id", "art")
  WHERE "zustand" = 'laeuft'
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profil_laeufe_user_idx"
  ON "profil_laeufe" ("user_id", "art", "begonnen_am" DESC)
--> statement-breakpoint
-- Fuer das Aufraeumen haengengebliebener Anspruecke.
CREATE INDEX IF NOT EXISTS "profil_laeufe_zustand_idx"
  ON "profil_laeufe" ("zustand", "begonnen_am")
--> statement-breakpoint

-- Woran eine Handlung haengt, wenn nicht an einer Stelle.
--
-- Die Entdopplung fragte bisher nach Handlungsart und Stellen-ID.
-- Eine Klaerung hat keine Stelle -- sie haengt an einer Aussage oder
-- an einem Wissensfeld. Ohne diese Spalte waeren zwei verschiedene
-- Widersprueche fuer die Entdopplung dasselbe, und der zweite kaeme
-- nie zur Sprache.
ALTER TABLE "nina_handlungen" ADD COLUMN IF NOT EXISTS "schluessel" text
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_handlungen_schluessel_idx"
  ON "nina_handlungen" ("user_id", "schluessel")
  WHERE "schluessel" IS NOT NULL
