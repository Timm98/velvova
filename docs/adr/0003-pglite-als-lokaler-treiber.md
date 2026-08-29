# ADR 0003: PGlite als lokaler Datenbanktreiber

**Status:** angenommen · **Datum:** 2026-08-29

## Zusammenhang

PostgreSQL ist die Quelle der Wahrheit. Lokal fehlt auf der
Entwicklungsmaschine sowohl Docker als auch ein Postgres-Server. Der
Auftrag verlangt, dass ein neuer Entwickler mit dokumentierten Befehlen
starten kann — ohne dass fehlende Zugänge den Bau blockieren.

## Entscheidung

Zwei Treiber, ein SQL: `@electric-sql/pglite` lokal, `node-postgres` in
Produktion. Die Auswahl trifft `DATABASE_DRIVER`.

## Begründung

PGlite ist echtes PostgreSQL, nach WebAssembly übersetzt und in den
Prozess eingebettet. Entscheidend: es ist dieselbe Engine, nicht eine
Nachbildung. Dieselben Migrationen, dieselben Typen, dieselben
Row-Level-Security-Richtlinien.

Die naheliegenden Alternativen scheitern an genau diesem Punkt:
- **SQLite lokal, Postgres produktiv** — zwei SQL-Dialekte, zwei
  Migrationspfade, und RLS gibt es in SQLite gar nicht. Die
  Zugriffskontrolle wäre lokal ungetestet.
- **Docker Compose voraussetzen** — funktioniert hier nicht und ist eine
  Einstiegshürde für jeden ohne Docker.
- **Gemockte Datenbankschicht** — testet die Abfragen nicht.

Der Beleg: die RLS-Tests in `packages/db/src/db.test.ts` laufen gegen
PGlite und haben einen echten Fehler aufgedeckt — dass eine Verbindung
als Superuser RLS vollständig umgeht. Gegen eine Nachbildung wäre das
nicht aufgefallen.

## Folgen

- Relative Datenpfade werden gegen die Repo-Wurzel aufgelöst, nicht
  gegen das Arbeitsverzeichnis. Sonst legt derselbe Befehl je nach
  Aufrufort eine andere Datenbank an.
- PGlite läuft einprozessig. Für Lasttests braucht es einen echten
  Server; `DATABASE_DRIVER=pg` ist dafür vorgesehen.
- `pgvector` ist in PGlite als Erweiterung verfügbar, aber noch nicht
  eingebunden — semantische Suche steht aus.
