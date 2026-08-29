# Architektur

## Der Leitgedanke

Vier Anwendungen, eine Fachlogik. Was eine Bewertung bedeutet, steht an
genau einer Stelle — sonst laufen zwei Fassungen desselben Scores
auseinander, und niemand merkt es.

```
apps/web ─┐
apps/api ─┼─→ packages/domain, matching, db, ai, documents, jobs
apps/worker ─┤
apps/mobile ─┘
```

## Datenfluss einer Jobempfehlung

```
Gespräch  →  Evidence (unbestätigt)
                    ↓  Mensch bestätigt
             Evidence (bestätigt)
                    ↓
   ┌────────────────┴────────────────┐
   │  checkConstraints()             │  harte Bedingungen zuerst
   │      blocked → kein Score       │
   ├─────────────────────────────────┤
   │  computeFit()                   │  Unbekanntes ist neutral
   │  computeConfidence()            │  getrennt vom Fit
   │  computeJobQuality()            │  eigener Wert
   │  computeAiTransition()          │  auf Aufgabenebene
   │  computeListingConfidence()     │  über die Anzeige selbst
   ├─────────────────────────────────┤
   │  computeOverall()               │  nur bei genug Datenlage
   └────────────────┬────────────────┘
                    ↓
              sortJobs()   blockierte immer ans Ende
```

Die Bewertung läuft bei **jeder Anfrage neu**. Ändert der Mensch eine
Bedingung oder bestätigt eine Evidenz, wirkt das sofort. Die Ergebnisse
werden zusätzlich in `job_matches` und `match_factors` fortgeschrieben —
nicht als Cache, sondern damit ein später angezeigter Wert erklärbar
bleibt, mitsamt der Fassung der Logik, die ihn erzeugt hat.

## Zugriffskontrolle

Zwei Ebenen, weil eine allein versagen kann:

1. **Anwendungscode** — jede Abfrage filtert nach `userId`.
2. **Datenbank** — Row Level Security über die Rolle `paycheck_app`.

`withUser()` legt vor jeder Anfrage die erhöhten Rechte ab und setzt die
Kennung, beides auf die Transaktion begrenzt. Wer den Rahmen vergisst,
sieht **nichts** statt fremder Daten.

## Datenbank

PostgreSQL ist die Quelle der Wahrheit. Zwei Treiber, ein SQL:

| Umgebung | Treiber | Warum |
|---|---|---|
| lokal | PGlite (WASM) | Echtes Postgres ohne Docker und ohne Server |
| Produktion | node-postgres | Ein echter Server |

Dieselben Migrationen, dieselben RLS-Richtlinien. Siehe
[ADR 0003](adr/0003-pglite-als-lokaler-treiber.md).

**Eine Eigenheit, die man kennen muss:** PGlite ist ein
Einzelprozess-System. Der Datenbankgriff hängt deshalb an `globalThis` —
Next lädt Pakete in mehreren Modul-Graphen, und eine Modulvariable wäre
mehrfach vorhanden. Jede Kopie würde eine eigene PGlite-Instanz auf
dasselbe Verzeichnis öffnen und die Schreibvorgänge der anderen nicht
sehen. Das ist tatsächlich passiert und hat einen E2E-Test gekostet.

## KI-Schicht

```
Fachcode  →  AiProvider (Schnittstelle)
                  ├── MockAiProvider    deterministisch, lokal, ohne Netz
                  └── AnthropicProvider  nur mit Schlüssel
```

Kein Anbietername und kein Modellname steht im Fachcode. Die Auswahl
trifft `selectProvider()` — und ein Anbieter gilt nur als verfügbar, wenn
er **wirklich benutzbar** ist. Wer `AI_PROVIDER=anthropic` setzt, aber
keinen Schlüssel hinterlegt, bekommt den lokalen Anbieter und einen
Hinweis, nicht einen Fehler beim ersten Klick.

Strukturierte Ausgaben laufen über Tool Use mit erzwungenem Schema und
werden **danach noch einmal** gegen dasselbe Zod-Schema geprüft. Zwei
Prüfungen, weil die erste beim Anbieter liegt.

## Web-Anwendung

Next.js App Router. Server Components lesen direkt aus der Datenbank,
Server Actions schreiben. Kein Netzwerkumweg über eine API für Wege, die
ohnehin auf dem Server liegen.

Route-Gruppen:

| Gruppe | Inhalt |
|---|---|
| `(public)` | Methodik, Sicherheit, Datenschutz, So funktioniert es |
| `(auth)` | Anmelden, Registrieren, Passwort vergessen |
| `app/` | Alles hinter der Anmeldung |
| `api/dev/` | Demo-Anmeldung, nur außerhalb von Produktion |

## API

Fastify, für die native App und spätere Partner. Sie nutzt dieselben
Pakete wie die Web-App — es gibt keine zweite Fachlogik. Siehe
[ADR 0005](adr/0005-api-neben-route-handlern.md).

Protokolle redigieren Autorisierung, Cookies, Passwörter und Freitexte.

## Worker

Alle 15 Minuten: Aufbewahrungsfristen durchsetzen, Links prüfen,
abgelaufene Anzeigen markieren, Erinnerungen anlegen. `--once` für Cron.

Keine Queue — alle Aufgaben sind idempotent und zeitgesteuert. Siehe
[ADR 0006](adr/0006-worker-ohne-queue.md).

`Promise.allSettled` sorgt dafür, dass eine fehlgeschlagene Aufgabe die
anderen nicht verhindert.

## Zustandsdarstellung

Ein Grundsatz zieht sich durch die ganze Oberfläche: **Was nicht
funktioniert, sagt das.**

`integrationStatus()` liest den tatsächlichen Zustand aus der
Konfiguration. Die Oberfläche zeigt „nicht verbunden", wo nichts
verbunden ist — auf der Datenschutzseite, in den Einstellungen, im
Gespräch, im Studio. Es gibt keinen Zustand, in dem etwas
funktionsfähig aussieht und es nicht ist.

## Was fehlt

- `pgvector` ist in der Datenbank verfügbar, aber nicht eingebunden.
  Semantische Suche läuft heute über Wortüberlappung.
- Die nutzerbezogenen API-Endpunkte folgen mit der nativen App.
- Rate Limiting ist nicht umgesetzt.
- Objektspeicher ist als Schnittstelle vorhanden, Uploads sind noch
  nicht angebunden.
