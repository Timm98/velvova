# Infrastruktur

## Für die Entwicklung nicht nötig

Das Projekt läuft ohne Docker. PGlite bringt ein vollwertiges PostgreSQL
in den Prozess, der E-Mail-Weg erzeugt Entwürfe statt zu versenden, und
Uploads liegen lokal.

```bash
pnpm setup                        # installieren, migrieren, Seed laden
pnpm --filter @paycheck/web dev   # fertig
```

## Wann diese Dienste sinnvoll sind

| Dienst | Wofür |
|---|---|
| `postgres` | Gegen einen echten Server entwickeln, Nebenläufigkeit prüfen, Lasttests |
| `mailpit` | Den Versandweg tatsächlich ausprobieren, ohne dass eine Nachricht jemanden erreicht |
| `minio` | Uploads gegen einen S3-kompatiblen Speicher testen |

```bash
docker compose -f infra/docker-compose.yml up -d
```

Danach in `.env`:

```
DATABASE_DRIVER=pg
DATABASE_URL=postgres://paycheck:nur-lokal-nicht-produktiv@localhost:5432/paycheck
MAIL_PROVIDER=mailpit
SMTP_URL=smtp://localhost:1025
STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=paycheck
```

Dann `pnpm db:migrate && pnpm db:seed`. Dieselben Migrationen, dasselbe
Schema — der Wechsel ändert nur den Treiber.

Mailpit-Oberfläche: http://localhost:8025 · MinIO: http://localhost:9001

## Die Zugangsdaten hier

Sie stehen absichtlich im Klartext und heißen `nur-lokal-nicht-produktiv`.
Diese Datei beschreibt eine Entwicklungsumgebung auf dem eigenen Rechner.
Für einen Betrieb gehören Zugangsdaten in eine Secret-Verwaltung, nicht
in eine Compose-Datei.

## Was für den Betrieb noch fehlt

- Reverse Proxy mit TLS
- Sicherung und ein **getesteter** Wiederherstellungslauf
- Rate Limiting
- Zentrale Protokollsammlung mit PII-Redaktion
- Secret-Verwaltung
