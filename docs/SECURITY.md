# Sicherheit

Was tatsächlich implementiert ist, und wo die Grenzen liegen. Kein Punkt hier
ist eine Absichtserklärung; wo etwas fehlt, steht es als fehlend da.

## Das Bedrohungsmodell

Die Daten hier sind unangenehmer als sie klingen. Ein Karriereprofil enthält
Gehaltsvorstellungen, Kündigungsgründe, gesundheitliche Einschränkungen als
harte Bedingung, Familiensituation über Pendelgrenzen. Wer das liest, kann eine
Person unter Druck setzen — und der wahrscheinlichste Leser ist nicht ein
Angreifer von aussen, sondern ein Fehler im eigenen Code.

Nach Schadenshöhe geordnet:

1. **Ein Nutzer sieht die Daten eines anderen.** Der teuerste Fall, und der,
   der am leisesten passiert.
2. **Ein Arbeitgeber sieht ein Profil ungefragt.** Zerstört die Grundlage des
   Produkts.
3. **Ein Modellanbieter bekommt mehr als nötig.** Auch ohne Missbrauch ein
   Bruch der Zusage.
4. **Ein Geheimnis liegt im Browserpaket.** Kostet Geld und Vertrauen.
5. **Eine Sitzung wird übernommen.** Schlimm, aber begrenzt und erkennbar.

## Mandantentrennung

Zwei Schichten, weil eine allein irgendwann versagt.

**Anwendungsschicht.** Jede Datenbankanfrage läuft durch `withUser(db, userId,
…)`. Die Kennung kommt aus der Serversitzung, nie aus einem Anfragekörper.

**Datenbankschicht.** Row Level Security auf 33 Tabellen. `SET LOCAL ROLE
paycheck_app` plus `set_config('app.user_id', …, true)` in derselben
Transaktion.

Drei Dinge, die dabei leicht falsch gehen:

- **Superuser umgeht RLS.** `FORCE ROW LEVEL SECURITY` ändert daran nichts. Der
  erste RLS-Test ist genau daran gescheitert: die Richtlinien waren richtig und
  wirkten nicht. Deshalb die eigene, eingeschränkte Rolle.
- **RLS muss eingeschaltet sein.** Eine Richtlinie ohne aktives RLS steht in der
  Datenbank und filtert nichts. Drei Tabellen — `auth_accounts`, `memberships`,
  `ai_runs` — trugen eine `user_id` und hatten keinen Zeilenfilter. Gefunden hat
  das der Generator für `RLS_POLICIES.md`, nicht ein Mensch beim Lesen.
- **Ohne Kennung sieht man nichts.** `app_current_user_id()` liefert dann NULL,
  und `user_id = NULL` ist niemals wahr. Ein vergessenes `withUser()` führt zu
  einer leeren Liste, nicht zu fremden Daten — ein Ausfall statt eines Lecks.

Geprüft in `packages/db/src/db.test.ts`, `packages/db/src/rls-coverage.test.ts`
und `apps/web/src/lib/nina/context/build-context-envelope.test.ts`.

## Sitzungen

Zufälliges Token, gespeichert wird nur sein SHA-256-Hash. Cookie `httpOnly`,
`sameSite=lax`, in Produktion `secure`. Eine Datenbankkopie enthält keine
gültigen Sitzungen. Sitzungen sind einzeln widerrufbar, mit Gerätebezeichnung
und Zeitpunkt.

## Modellaufrufe

Der Kontext-Umschlag entscheidet, was ein Modell sieht:

- `authenticatedUserId` ist ein **Aufrufparameter aus der Sitzung**. Es gibt
  kein Feld, über das eine fremde Kennung hereinkäme — auch nicht über einen
  manipulierten Gesprächsverlauf.
- Werkzeugaufrufe laufen serverseitig. Kein Werkzeugschema enthält eine
  Nutzerkennung; `runTool(userId, name, input)` bekommt sie als Parameter.
- Jeder Werkzeugaufruf wird gegen sein Schema geprüft, bevor er ausgeführt wird.
- An das Modell geht die verdichtete Zusammenfassung und die letzten Züge, nicht
  der vollständige Verlauf.
- `minimiseForExternalProvider()` entfernt, was ein externer Anbieter nicht
  braucht.

## Geheimnisse

`.env.local` ist in `.gitignore`. `.env.example` enthält nur leere Platzhalter.
Zwei Prüfungen laufen als Test:

- keine Client-Komponente liest eine Umgebungsvariable ohne `NEXT_PUBLIC_`
- die gebauten Browserbündel enthalten keine schlüsselartigen Zeichenketten
  (`sk-…`, `service_role`, JWT mit Nutzlast, Postgres-URL mit Passwort)

Die zweite ist die, die zählt: sie schaut auf das, was tatsächlich ausgeliefert
wird.

## Ausgehende Verbindungen

Content Security Policy mit Nonce, gesetzt in `src/middleware.ts`. Kein
`unsafe-inline`. Stellenquellen werden über die Registry angesprochen; eine
Adresse ausserhalb der eingetragenen Domänen erreicht keinen Abruf, weil die
Policy Engine für eine unbekannte Domäne `pending_review` entscheidet.

## Was fehlt

Ehrlich benannt, nicht beschönigt:

- **Kein Ratenlimit** auf Anmeldung und Gesprächsendpunkten. Vor Produktion
  nötig.
- **Keine Verschlüsselung ruhender Daten auf Feldebene.** Das Feld
  `statementEncrypted` existiert, wird aber nicht befüllt.
- **Kein Audit-Log** im Sinne einer manipulationssicheren Kette. Es gibt
  Ereignisse, aber sie sind vom Anwendungscode überschreibbar.
- **Keine Zwei-Faktor-Authentisierung.**
- **Kein Penetrationstest.** Was hier steht, ist durch Tests belegt, nicht durch
  eine unabhängige Prüfung.
- **Keine Schlüsselrotation** ausser von Hand.

## Eine Schwachstelle melden

Bis eine Adresse veröffentlicht ist: über den Repository-Betreuer. Bitte keine
funktionsfähigen Angriffswege in öffentlichen Meldungen — die Klasse des
Problems und ein Reproduktionsweg reichen.
