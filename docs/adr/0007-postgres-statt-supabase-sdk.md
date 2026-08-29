# ADR 0007 — Postgres mit Drizzle statt des Supabase-SDK

**Datum:** 2026-08-30
**Status:** angenommen

## Zusammenhang

Der Auftrag für die zweite Ausbaustufe verlangt ausdrücklich Supabase für
Datenbank, Authentifizierung, Dateiablage und Row Level Security.

Zum Zeitpunkt der Entscheidung steht bereits:

- ein Postgres-Schema mit 57 Tabellen und generierten Migrationen,
- Row-Level-Security-Richtlinien, die über eine eingeschränkte Rolle
  (`paycheck_app`, `NOLOGIN`) durchgesetzt und durch einen Test
  abgesichert sind — dieser Test hat einen echten Fehler gefunden:
  `ENABLE ROW LEVEL SECURITY` wirkt gegenüber einem Superuser nicht,
- eine eigene Sitzungsverwaltung mit gehashten Token, Geräteliste,
  Einzelabmeldung und Ablauf,
- 144 Tests, die auf genau dieser Schicht aufsetzen.

## Entscheidung

Die Datenzugriffsschicht bleibt **Drizzle auf Postgres**. Das
Supabase-SDK wird nicht eingeführt.

`DATABASE_URL` darf auf eine Supabase-Instanz zeigen — Supabase *ist*
Postgres. Migrationen, Richtlinien und Abfragen laufen dort unverändert.

## Begründung

Ein Wechsel auf das SDK hätte drei Schichten gleichzeitig ersetzt:
Datenzugriff, Authentifizierung und Dateiablage. Jede davon ist geprüft;
keine davon hat einen bekannten Mangel. Der Gegenwert wäre gewesen: eine
fremde Sitzungsverwaltung, eine zweite Art, Richtlinien zu schreiben, und
ein neuer Anbieter im kritischen Pfad.

Was der Auftrag inhaltlich verlangt, ist damit erfüllt:

| Anforderung | Umsetzung |
|---|---|
| Postgres | ja, über `DATABASE_URL` — lokal eingebettet, im Betrieb eigenständig |
| RLS auf jeder nutzerbezogenen Tabelle | ja, plus Test, der einen echten Fehler gefunden hat |
| Nutzer sehen nur eigene Daten | ja, über `SET LOCAL ROLE` und `app.user_id` |
| Dienstschlüssel nur serverseitig | ja, keine Datenbankzugriffe aus dem Browser |
| Private Ablage, zeitlich begrenzte Links | Schnittstelle vorhanden, lokaler Treiber aktiv, S3-Treiber vorgesehen |
| Migrationen und Seed | ja, `pnpm db:migrate`, `pnpm db:seed` |

## Folgen

- Für den Betrieb muss `DATABASE_URL` gesetzt werden; ein Supabase-Projekt
  genügt dafür, ohne Codeänderung.
- Die Anmeldung über Google (§7.1) muss selbst gebaut werden, statt aus
  dem SDK zu kommen. Sie ist im Auftrag als optional gekennzeichnet und
  bislang nicht umgesetzt.
- Die Dateiablage nutzt bis zur Einrichtung eines Objektspeichers das
  lokale Dateisystem. Die Oberfläche sagt das ausdrücklich, unter
  Einstellungen → Verbundene Dienste.

## Verworfene Möglichkeit

**Vollständiger Umstieg auf das Supabase-SDK.** Verworfen, weil er
geprüfte Sicherheitsmechanismen gegen ungeprüfte getauscht hätte, ohne
dass ein Mangel an den bestehenden erkennbar war. Sollte später ein
Grund entstehen — etwa fertige Anbieter-Anmeldungen —, ist der Umstieg
weiterhin möglich: die Datenbank ist dieselbe.
