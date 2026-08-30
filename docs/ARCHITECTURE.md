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

## Die Quellenschicht

Zwischen „eine Stellenquelle gibt es“ und „ihre Daten stehen in der Liste“
liegen fünf getrennte Schritte. Sie sind getrennt, weil an jedem eine andere
Frage hängt und ein einzelner Riegel für alle fünf keine davon richtig
beantwortet.

```
Entdeckung  →  Zugriff  →  Einlesen  →  Umformung  →  Anzeige  →  Bewerbung
    │            │            │            │            │            │
 Registry    Policy Engine  Ingest    Provenienz    canPublish   Freigabe
```

**Source Registry** (`apps/web/src/lib/sources/source-registry.ts`) — was wir
über eine Quelle wissen: Zugriffsmodus, Rechtsgrundlage, erlaubte Operationen,
erlaubte Felder, Prüffrist.

**Policy Engine** (`policy-engine.ts`) — die einzige Stelle, an der entschieden
wird. Unbekannte Quelle → `pending_review`. Abgelaufene Prüffrist →
`pending_review`. Abgeschaltet → `link_only`. Der Riegel steht **vor** dem
ersten Netzzugriff, nicht dahinter.

Dass es genau eine solche Stelle gibt, ist die Lehre aus einem konkreten
Fehler: `activeAdapters()` filterte einmal nach `isConfigured()`, bevor die
Policy Engine gefragt wurde. Eine nicht eingerichtete Quelle erreichte den
rechtlichen Riegel nie und tauchte in keinem Bericht auf. **Wo zwei
Mechanismen dieselbe Frage beantworten, gewinnt stillschweigend der
schwächere.**

**Provenienz** (`provenance.ts`) — feldgenaue Herkunft. Eine
Modellzusammenfassung ohne Angabe, woraus sie entstand, ist schema-widrig und
wird abgelehnt.

Ausführlich: `docs/JOB_PROVIDER_GUIDE.md`, `docs/LEGAL_SOURCE_REGISTER.md`
(erzeugt), `docs/SOURCE_COMPLIANCE_MATRIX.md` (erzeugt).

## Der kanonische Stellen-Graph

Dieselbe offene Stelle steht oft auf drei Portalen. In der Datenbank ist sie
ein Datensatz in `jobs` mit je einer Zeile in `job_source_links` pro Fundstelle.

Der Abgleich (`packages/jobs/src/canonical.ts`) läuft über Titel, Unternehmen
und Ort — nicht über den Volltext. Portale kürzen denselben Text
unterschiedlich; ein Hash darüber findet solche Dubletten nie.

Im Zweifel wird getrennt. Zusammenwerfen verschluckt eine echte Möglichkeit und
ist unsichtbar; trennen macht die Liste länger und ist sichtbar.

## Ninas Gedächtnis

Der Vorgangszustand liegt in der Datenbank, nicht im Kontextfenster eines
Modells. Deshalb überlebt er einen Neustart, einen Gerätewechsel und drei Tage
Pause.

**Zustandsautomat** (`lib/nina/workflow/state-machine.ts`) — vierzehn Stufen,
reine Logik ohne Datenbank. Ereignisse beschreiben, was **geschehen ist**;
`advanceTo()` geht nie zurück, und ohne Ereignis wird nichts behauptet.

**Kontext-Umschlag** (`lib/nina/context/`) — was ein Modellaufruf sehen darf.
`authenticatedUserId` ist ein Aufrufparameter aus der Serversitzung. Es gibt
kein Feld, über das eine fremde Kennung hereinkäme — auch nicht über einen
manipulierten Gesprächsverlauf.

**Geltungsbereich** — bestätigte Fakten, offene Vermutungen, harte Bedingungen,
verworfene Aussagen und die letzten zehn Züge. Nicht der vollständige Verlauf.

## Der Modell-Router

Welche Aufgabe auf welcher Leistungsstufe läuft, steht an genau einer Stelle
(`packages/ai/src/router.ts`). Die Stufennamen TERRA, SOL, LUNA und REALTIME
beschreiben Verhalten, nicht Modelle: im Fachcode steht nirgends ein
Modellname, sonst wäre ein Anbieterwechsel ein Umbau statt einer Einstellung.

Erzeugt daraus: `docs/AI_ROUTING.md`.

## Erzeugte Dokumentation

Vier Dokumente werden aus dem Code erzeugt, weil eine von Hand gepflegte
Tabelle irgendwann etwas anderes beschreibt, als der Code tut:

| Datei | Skript | Quelle der Wahrheit |
| --- | --- | --- |
| `LEGAL_SOURCE_REGISTER.md` | `generate-source-docs.mjs` | Source Registry |
| `SOURCE_COMPLIANCE_MATRIX.md` | `generate-source-docs.mjs` | Source Registry |
| `AI_ROUTING.md` | `generate-ai-routing-doc.mjs` | Modell-Router |
| `RLS_POLICIES.md` | `generate-rls-doc.mjs` | **Datenbankkatalog** |

Die letzte Zeile ist die interessante. Der erste Anlauf las die SQL-Dateien mit
einem regulären Ausdruck und fand 4 von 33 Richtlinien — sie entstehen in einer
PL/pgSQL-Schleife, die kein Parser sieht. Ein Dokument aus einem solchen Abzug
ist schlimmer als keines: es behauptet Vollständigkeit und liefert eine
Stichprobe. Die Katalogabfrage fand dann drei Tabellen mit Nutzerkennung ohne
Zeilenfilter.

## Was fehlt

- `pgvector` ist in der Datenbank verfügbar, aber nicht eingebunden.
  Semantische Suche läuft heute über Wortüberlappung.
- Die nutzerbezogenen API-Endpunkte folgen mit der nativen App.
- Rate Limiting ist nicht umgesetzt.
- Objektspeicher ist als Schnittstelle vorhanden, Uploads sind noch
  nicht angebunden.
- ESCO ist als Grundlage der Rollenzuordnung vorgesehen, aber nicht
  angebunden. Die Zuordnung ist heute regelbasiert und gröber.
- Die Zusammenführung über Anbieter hinweg ist implementiert und
  geprüft, aber nicht im Betrieb belegt: nur eine Quelle ist
  freigegeben, und innerhalb einer Quelle greift bereits die Eindeutigkeit
  über (Quelle, externe Kennung).
- Die Evaluationsfälle decken 19 Situationen ab. Das Ziel sind 50.

## Alle Dokumente

**Aufbau** ARCHITECTURE · DATA_MODEL · DECISIONS · adr/

**Produkt** PRODUCT · USER_JOURNEY · MATCHING · CAREER_EVIDENCE ·
NINA_INTERVIEW_SPEC · APPLICATION_MODES

**KI** AI_ARCHITECTURE · AI_ROUTING* · AI_GUARDRAILS · AI_SYSTEM_CARD ·
RESEARCH_BASIS · RESEARCH_RATIONALE

**Quellen** DATA_SOURCES · JOB_SOURCES_AND_REVIEWS · JOB_PROVIDER_GUIDE ·
LEGAL_SOURCE_REGISTER* · SOURCE_COMPLIANCE_MATRIX*

**Sicherheit und Recht** SECURITY · PRIVACY_SECURITY · PRIVACY_DATA_FLOW ·
RLS_POLICIES* · DPIA_DRAFT · DATA_PROCESSING_REGISTER ·
LEGAL_REVIEW_CHECKLIST · privacy-architecture

**Betrieb** LOCAL_SETUP · PRODUCTION_CHECKLIST · RUNBOOK_PROVIDER_OUTAGE ·
ACCESSIBILITY

**Berichte** BERICHT-V2 · BERICHT-V3 · BERICHT-V4

\* wird aus dem Code erzeugt — nicht von Hand ändern.
