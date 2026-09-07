# Lokale Einrichtung

Ziel: von `git clone` zu einer laufenden Anwendung mit echten Stellen, ohne
einen einzigen Zugangsschlüssel.

Das ist Absicht. Ein Projekt, das ohne Schlüssel gar nicht startet, zwingt
jeden Neuen dazu, sich zuerst Zugangsdaten zu besorgen — und dann liegen sie
in einem Chatverlauf, einem Screenshot oder einer Datei, die versehentlich
committet wird. Hier läuft alles ohne, nur eben ehrlich beschriftet.

## Voraussetzungen

| | Version | Warum diese |
| --- | --- | --- |
| Node | ≥ 24 | `--experimental-strip-types` für die Werkzeugskripte |
| pnpm | 11.24 | Workspaces; die Version ist in `package.json` festgeschrieben |

Keine Datenbank installieren. PGlite ist eingebettetes Postgres als
WebAssembly und liegt unter `.data/pglite`.

## In vier Schritten

```bash
pnpm install
pnpm db:migrate     # legt das Schema an
pnpm db:seed        # Demo-Persona "Lea" und Beispieldaten
pnpm dev            # http://127.0.0.1:3000
```

Anmelden ohne Passwort: `http://127.0.0.1:3000/api/dev/login`. Der Endpunkt
antwortet mit 404, sobald `NODE_ENV=production` oder ein anderer Treiber als
PGlite eingestellt ist.

## Echte Stellen holen

```bash
curl -X POST http://127.0.0.1:3000/api/jobs/refresh
```

Arbeitnow ist die einzige Quelle, die ohne Zugangsdaten läuft, und liefert
rund 100 echte Anzeigen pro Abruf.

**Der Abruf läuft über den Server, nicht über ein Skript.** PGlite ist eine
Einzelprozess-Datenbank: ein zweiter Prozess öffnet dasselbe Verzeichnis, sieht
die Schreibvorgänge des ersten aber nicht. Genau das ist einmal passiert — ein
Ingest-Skript meldete 80 geschriebene Stellen, die Anwendung zeigte 30. Der
Fehler war unsichtbar, weil beide Seiten recht hatten.

Die Antwort nennt auch, was **nicht** abgerufen wurde und warum:

```json
{ "skipped": [{ "key": "jooble_de", "reason": "Kein Schlüssel hinterlegt (JOOBLE_API_KEY_DE)." }] }
```

## Was ohne Schlüssel anders ist

| Bereich | Ohne Schlüssel | Wie es sichtbar ist |
| --- | --- | --- |
| Mondays Antworten | lokaler Demo-Anbieter | Badge „Demo-Anbieter“, Hinweiskarte im Gespräch |
| Sprachmodus | nicht verfügbar | Knopf deaktiviert, mit Begründung |
| Adzuna, Jooble | kein Abruf | im Abrufbericht unter `skipped`, mit dem fehlenden Variablennamen |
| Bewerbungsversand | kein Versand | „nicht verbunden“, der Vorschautext wird trotzdem erzeugt |

Die Bewertungslogik braucht kein Sprachmodell. Passung, Zuversicht,
Anzeigenqualität und die harten Bedingungen werden regelbasiert gerechnet und
stimmen auch im Demo-Betrieb.

## Schlüssel hinzufügen

```bash
cp .env.example .env.local
```

`.env.example` enthält ausschliesslich leere Platzhalter. In `.env.local`
gehören die Werte — die Datei ist in `.gitignore` und bleibt es.

Ein Schlüssel, der je in einem Chat, einem Screenshot oder einem Prompt
aufgetaucht ist, gilt als kompromittiert und wird nicht verwendet, sondern
rotiert.

## Prüfen

```bash
pnpm typecheck        # tsc --noEmit über alle Pakete
pnpm test             # Vitest, Wurzelkonfiguration
pnpm test:e2e         # Playwright, startet den Server selbst
pnpm build
node scripts/axe-detail.mjs /app /app/jobs     # Barrierefreiheit, SCHEME=dark|light
```

`pnpm test` läuft bewusst aus der Wurzel und nicht je Paket über Turbo. Die
Turbo-Fassung war grün und hat null Testdateien gefunden: die Muster in der
Vitest-Konfiguration sind wurzelrelativ, und in einem Paketverzeichnis passt
darauf nichts. Ein grüner Balken, der nichts geprüft hat, ist schlimmer als
ein roter.

## Häufige Stolperstellen

**„Another next dev server is already running“** — ein Entwicklungsserver hält
`.data/pglite`. `lsof -ti:3000 | xargs kill -9`, dann neu starten.

**Migration wirkt nicht** — `pnpm db:migrate` schreibt in dasselbe Verzeichnis,
das ein laufender Server geöffnet hat. Erst den Server beenden.

**Leere Stellenliste nach dem Abruf** — die Demo-Daten verschwinden, sobald
mindestens eine echte Anzeige vorliegt. Ist die Liste danach leer, waren alle
echten Anzeigen durch harte Bedingungen ausgeschlossen; `?blocked=1` zeigt sie
mit Begründung.
