# Runbook: Ausfall einer Stellenquelle

Für den Fall, dass eine Quelle nicht mehr liefert, falsch liefert oder aus
rechtlichen Gründen sofort stehen muss.

Grundsatz: **Die Anwendung bleibt benutzbar, und sie sagt, was fehlt.** Eine
Liste, die stillschweigend kürzer wird, ist schlimmer als ein Hinweis, dass
eine Quelle gerade nicht antwortet — die Person trifft sonst Entscheidungen auf
einer Datenlage, deren Lücke sie nicht kennt.

## 1. Sofort stoppen (Not-Aus)

Für den rechtlichen Fall — eine Quelle widerruft die Erlaubnis, eine
Nutzungsbedingung ändert sich, eine Abmahnung kommt.

In `apps/web/src/lib/sources/source-registry.ts` beim betroffenen Eintrag:

```ts
enabled: false,
killSwitchReason: "Erlaubnis am 2026-08-30 widerrufen, Vorgang XY",
```

Wirkung, ohne Neustart der Logik:

- `decideForProvider()` liefert `link_only` statt `approved`
- `ingestFromAdapter()` bricht **vor dem ersten Netzzugriff** ab
- `/api/jobs/refresh` führt die Quelle unter `skipped` mit dem Grund auf
- `/admin/sources` zeigt die geänderte Entscheidung

Geprüft in `packages/jobs/src/kill-switch.test.ts`: der Zähler für
Netzzugriffe bleibt auf null. Ein Abruf, der erst hinterher als unzulässig
erkannt wird, hat stattgefunden — die Daten liegen dann schon da.

**Bereits eingelesene Daten** werden dadurch nicht entfernt. Ist auch das
verlangt, zusätzlich:

```sql
DELETE FROM job_source_links WHERE source_id = (SELECT id FROM job_sources WHERE key = '<key>');
DELETE FROM jobs WHERE source_id = (SELECT id FROM job_sources WHERE key = '<key>');
```

Stellen, die über `job_source_links` noch eine andere Fundstelle haben, sollten
zuerst auf diese umgehängt werden, statt sie zu löschen.

## 2. Technischer Ausfall

**Erkennen.** `job_sources.last_run_ok = false`, dazu `last_run_error`. Sichtbar
unter `/admin`.

**Einordnen.**

| Meldung | Ursache | Reaktion |
| --- | --- | --- |
| Zeitüberschreitung, 5xx | Anbieter ist unten | abwarten, nächster Lauf |
| 401, 403 | Schlüssel abgelaufen oder gesperrt | Schlüssel rotieren, `.env.local` |
| 429 | Grenze überschritten | Abrufrate senken |
| Feld fehlt, Typfehler | Antwortformat geändert | Adapter anpassen, Vertragstest ergänzen |

**Handeln.** Für a) bis c) reicht `enabled: false`, bis es behoben ist. Für d)
ist der Adapter zu ändern — und der Fall gehört als Testdatei in die
Adaptertests, sonst kommt er wieder.

## 3. Falsche Daten

Der unangenehmste Fall, weil nichts rot leuchtet.

Anzeichen: sprunghaft mehr Dubletten (`/admin` zählt sie), auffällig viele
Anzeigen ohne Gehaltsangabe, Titel mit Markierungsresten wie „(m/w/d)“ im
kanonischen Schlüssel.

Vorgehen: eine betroffene Anzeige im Rohzustand ansehen
(`job_snapshots` bewahrt die Fassung je Abruf auf), den Fall als Testdatei in
`packages/jobs/src/` ablegen, dann die Normalisierung anpassen. Erst der Test,
dann die Korrektur — sonst ist nach dem nächsten Anbieterwechsel unklar, warum
die Regel so aussieht, wie sie aussieht.

## 4. Was die Person sieht

Fällt eine Quelle aus, ändert sich die Aussage über die Reichweite, und sie
steht in `coverageStatement()`. Das Produkt behauptet nie, „alle Jobs im
Internet“ zu durchsuchen; es nennt die Quellen, die es tatsächlich abgefragt
hat. Fällt eine weg, wird die Aussage kürzer — automatisch, weil sie aus den
gezählten Entscheidungen gebaut wird und nicht aus einem festen Text.

## 5. Danach

Nach jedem Ausfall: Eintrag in `docs/LEGAL_SOURCE_REGISTER.md` prüfen
(`node scripts/generate-source-docs.mjs`), `reviewDueAt` im Registry-Eintrag
neu setzen. Ein überfälliges Prüfdatum setzt die Quelle von selbst auf
`pending_review` — das ist kein Versehen, sondern der Zweck.
