# Datenschutz und Sicherheit

## Der wichtigste Satz

**Eine eigene Datenbank bedeutet nicht automatisch, dass keine Daten
einen externen KI-Anbieter erreichen.**

Das wird oft verwechselt, manchmal absichtlich. Deshalb steht der
tatsächliche Zustand nicht in einer Broschüre, sondern wird zur Laufzeit
aus der Konfiguration gelesen und auf `/privacy` und in den Einstellungen
angezeigt. Ist kein Anbieter verbunden, steht das da. Ist einer
verbunden, steht das ebenfalls da — mit Zweck und Region.

## Einwilligungen

Sieben getrennte Einwilligungen, jede mit eigenem Zweck, eigener Fassung
und eigenem Schalter:

| Einwilligung | Standard | Zweck |
|---|---|---|
| `career_profile` | erforderlich | Erstellung und Pflege des Profils |
| `document_analysis` | aus | Auswertung hochgeladener Unterlagen |
| `voice_input` | aus | Spracheingabe im Gespräch |
| `transcript_storage` | aus | Speicherung gesprochenen Textes |
| `external_ai_processing` | aus | Verarbeitung durch externen Anbieter |
| `model_training` | **aus** | Training von Modellen |
| `partner_sharing` | **aus** | Weitergabe an institutionelle Partner |

Der Unterschied zwischen einer Einwilligung und einem Haken ist, dass man
sie einzeln zurücknehmen kann. Wer nur die Dokumentanalyse ablehnen will,
muss nicht alles ablehnen.

Ein Widerruf löscht die Zeile nicht, sondern setzt `revokedAt` — sonst
wäre später nicht nachvollziehbar, was wann galt.

## Zugriffskontrolle

Row Level Security über eine eingeschränkte Anwendungsrolle.

```sql
CREATE ROLE paycheck_app NOLOGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO paycheck_app;
```

Jede Anfrage im Namen eines Menschen läuft durch `withUser()`:

```ts
await tx.execute(sql`SET LOCAL ROLE paycheck_app`);      // Rechte ablegen
await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
```

Beides auf die Transaktion begrenzt, damit kein Zustand in die nächste
Anfrage sickert.

**Ohne diesen Rahmen sind keine Nutzerdaten sichtbar.** Der sichere Fall
ist der Standardfall: wer `withUser()` vergisst, sieht nichts statt
fremder Daten.

### Warum die eigene Rolle nötig ist

Der erste Anlauf war wirkungslos. RLS greift **nicht** gegen einen
Superuser — auch `FORCE ROW LEVEL SECURITY` ändert daran nichts, das ist
Postgres-Verhalten. Der Test in `packages/db/src/db.test.ts` hat das
aufgedeckt: zwei Nutzer angelegt, beide sahen alles.

Der Test prüft heute vier Dinge:

- jeder sieht nur die eigene Evidenz
- ein Schreibversuch unter fremder Kennung schlägt fehl
- ein Löschversuch fremder Daten bleibt wirkungslos
- ohne gesetzte Kennung sind gar keine Nutzerdaten sichtbar

## Authentifizierung

- **Passwörter:** scrypt mit zufälligem Salt, Vergleich in konstanter
  Zeit. Mindestens zwölf Zeichen — Länge schützt besser als erzwungene
  Zeichenklassen, die vorhersehbare Muster erzeugen.
- **Sitzungen:** im Cookie ein zufälliges Token, in der Datenbank nur
  dessen SHA-256-Hash. Wer die Datenbank liest, kann sich damit nicht
  anmelden.
- **Zeitausgleich:** bei unbekannter Adresse wird dieselbe Arbeit
  geleistet wie im Erfolgsfall. Die Antwortzeit verrät nicht, ob ein
  Konto existiert.
- **Magic Links:** einmal verwendbar, 20 Minuten gültig, nur der Hash
  gespeichert.
- **Geräte:** jede Sitzung einzeln widerrufbar, mit Zeitpunkt des letzten
  Zugriffs.

## Datenminimierung vor externer Verarbeitung

`minimiseForExternalProvider()` entfernt E-Mail-Adressen,
Telefonnummern, IBANs und Profillinks. Der fachliche Inhalt bleibt
unangetastet — geprüft in `packages/ai/src/ai.test.ts`.

## Aufbewahrung und Löschung

Jede Angabe trägt eine `retention_class`:

| Klasse | Bedeutung |
|---|---|
| `session_only` | Nur bis Sitzungsende |
| `profile` | Solange das Karriereprofil besteht |
| `legal_minimum` | Solange eine Aufbewahrungspflicht besteht |

Löschung läuft zweistufig: Soft Delete macht Inhalte sofort
unzugänglich, `apps/worker/src/tasks/retention.ts` entfernt sie nach 30
Tagen endgültig.

Die Oberfläche sagt das so. „Sofort und unwiederbringlich" zu behaupten
wäre unwahr — die Frist existiert, damit ein Versehen korrigierbar
bleibt.

## Export

Vollständig, als JSON, im Browser erzeugt. Enthält Konto,
Einstellungen, Einwilligungen, Profil, Belege, Bedingungen,
Rollencluster, Gesprächsverlauf, Bewerbungen, Ereignisse, Dokumente und
gemerkte Stellen.

**Nicht enthalten:** Passworthash und Sitzungstoken. Das sind
Geheimnisse, keine Inhalte.

## Sicherheitsmaßnahmen im Überblick

| Maßnahme | Zustand |
|---|---|
| TLS | in Produktion vorausgesetzt |
| Sichere Cookies | httpOnly, SameSite=Lax, secure in Produktion |
| CSP und Sicherheits-Header | umgesetzt in `next.config.ts` |
| Row Level Security | umgesetzt und getestet |
| Feldverschlüsselung sensibler Freitexte | Spalte vorhanden, nicht aktiv |
| Signierte Upload-Links | vorgesehen |
| MIME- und Größenprüfung | vorgesehen |
| Schadsoftware-Scan | Schnittstelle vorhanden, kein Dienst angebunden |
| Rate Limiting | **nicht umgesetzt** |
| PII-Redaction in Logs | umgesetzt in `apps/api` |
| Audit Logs | Tabelle vorhanden, Break-glass-Feld vorgesehen |
| MFA | Struktur vorbereitet, nicht aktiv |
| Backup- und Restore-Test | **steht aus** |
| Externer Sicherheitstest | **hat nicht stattgefunden** |

Die letzten Zeilen stehen hier, weil eine Sicherheitsübersicht ohne
offene Punkte unglaubwürdig ist.

## KI im Beschäftigungskontext

Das Produkt ist als kandidatenkontrollierte Assistenz ausgelegt. Die
Entscheidung trifft ein Mensch.

**Ausdrücklich nicht Teil des Produkts:**

- Ranking von Personen für Arbeitgeber
- automatische Ablehnung
- automatisierte Auswahlentscheidungen
- biometrische oder emotionale Bewertung
- Ableitung besonderer Kategorien personenbezogener Daten

Zweckbestimmung, Grenzen, menschliche Aufsicht, Datenquellen,
Bewertungslogik, Testfälle und bekannte Risiken sind dokumentiert
(siehe [AI_GUARDRAILS.md](AI_GUARDRAILS.md) und
[MATCHING.md](MATCHING.md)).

**Eine Konformitätsbewertung hat nicht stattgefunden.** Diese
Dokumentation ist eine Vorbereitung darauf, keine Bestätigung.

## Secrets

`.env` ist ignoriert, nur `.env.example` ist versioniert. Kein
Schlüsselwert erscheint in einem Commit, einer Protokollzeile oder
einer Fehlermeldung. Zugangsdaten für Integrationen liegen verschlüsselt
in `integrations.credentials_encrypted`.
