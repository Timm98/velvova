# Paycheck

Ein kandidatenkontrolliertes, evidenzbasiertes Karriere-Betriebssystem.
Die Assistenz heißt **Nina**. Beide Namen sind vorläufig und stehen an
genau einer Stelle: `packages/config/src/brand.ts`.

> **Demo-Modus.** Ohne einen einzigen Zugangsschlüssel läuft das Projekt
> vollständig — mit einem lokalen Demo-Anbieter für die KI, synthetischen
> Stellen und ohne jeden echten E-Mail-Versand. Was nicht verbunden ist,
> sagt das in der Oberfläche.

## Was das Produkt tut

Es setzt vor der Jobbörse an. Statt mit einem Jobtitel zu beginnen,
beginnt es mit einem Gespräch über konkrete Situationen — und übersetzt
sie in ein **Career Evidence Profile**: einzelne, belegte Aussagen, die
der Mensch bestätigt, ändert, ablehnt oder löscht. Erst daraus entstehen
Rollenvorschläge, Stellenempfehlungen und Bewerbungsunterlagen.

Die fünf Bewertungen stehen bewusst nebeneinander, nicht ineinander:

| Wert | Frage |
|---|---|
| Fit | Passt die Tätigkeit fachlich? |
| Confidence | Wie belastbar ist diese Aussage? |
| Job Quality | Wie gut ist die Stelle als Arbeitsplatz? |
| AI Transition | Wie verändern sich die Aufgaben? |
| Listing Confidence | Wie vertrauenswürdig ist die Anzeige? |

**Keiner davon ist eine Einstellungswahrscheinlichkeit.**

## Schnellstart

Voraussetzung: Node 22.12 oder neuer. Sonst nichts — kein Docker, kein
Postgres-Server, keine API-Schlüssel.

```bash
corepack enable pnpm
pnpm install
cp .env.example .env          # läuft auch unverändert
pnpm db:migrate
pnpm db:seed
pnpm --filter @paycheck/web dev
```

Danach `http://localhost:3000` öffnen. Für die Demo-Persona ohne
Registrierung: `http://localhost:3000/api/dev/login` aufrufen — der
Endpunkt existiert nur außerhalb von Produktion und nur mit dem lokalen
Treiber.

### Alle Befehle

| Befehl | Wirkung |
|---|---|
| `pnpm setup` | Installieren, migrieren, Seed laden — in einem Schritt |
| `pnpm db:migrate` | Migrationen anwenden, RLS-Richtlinien setzen |
| `pnpm db:seed` | Demo-Persona Lea, 7 Firmen, 10 Stellen |
| `pnpm db:reset` | Lokale Datenbank löschen (verweigert gegen einen Server) |
| `pnpm --filter @paycheck/web dev` | Web-App auf Port 3000 |
| `pnpm --filter @paycheck/api dev` | API auf Port 3001 |
| `pnpm --filter @paycheck/worker dev` | Hintergrundaufgaben alle 15 Minuten |
| `pnpm --filter @paycheck/worker once` | Hintergrundaufgaben einmal |
| `pnpm test` | Unit- und Integrationstests |
| `pnpm eval` | AI-Eval: prüft die Schutzmechanismen |
| `pnpm test:e2e` | Playwright über fünf Breitenpunkte |
| `pnpm test:e2e:a11y` | axe plus Tastaturprüfungen |
| `pnpm typecheck` | TypeScript über alle Pakete |
| `pnpm build` | Produktionsbuild |
| `pnpm verify` | Alles nacheinander |

## Aufbau

```
apps/
  web/      Next.js App Router, PWA, Server Actions
  api/      Fastify, für die native App und Partner
  worker/   Aufbewahrung, Linkcheck, Erinnerungen
  mobile/   Expo, iOS und Android
packages/
  config/         Marke, Feature Flags, validierte Laufzeitkonfiguration
  domain/         Evidence Graph, Bedingungen, alle Bewertungstypen
  matching/       Constraint-Prüfung, Fit, Confidence, Quality, AI, Ranking
  ai/             Provider-Abstraktion, Ninas Prompt, Guardrails, Eval
  db/             Drizzle-Schema, Migrationen, RLS, Seed
  jobs/           Quellenadapter, Normalisierung, Deduplizierung
  documents/      Claim-Provenienz, Lebenslauf, Versandwege
  i18n/           Deutsch und Englisch
  design-tokens/  Farben, Abstände, Typografie für Web und Mobile
docs/       Produkt, Architektur, Datenschutz, ADRs
tests/e2e/  Playwright
infra/      Docker Compose für optionale Dienste
```

## Konfiguration

`.env.example` listet jede Variable mit Erklärung. Kurz:

| Variable | Standard | Wirkung |
|---|---|---|
| `NEXT_PUBLIC_BRAND_NAME` | `Paycheck` | Produktname überall |
| `NEXT_PUBLIC_ASSISTANT_NAME` | `Nina` | Name der Assistenz |
| `PAYCHECK_DEMO_MODE` | `demo` | `live` schaltet echte Adapter frei |
| `DATABASE_DRIVER` | `pglite` | `pg` für einen echten Server |
| `AI_PROVIDER` | `mock` | `anthropic` braucht `ANTHROPIC_API_KEY` |
| `MAIL_PROVIDER` | `draft` | Erzeugt Entwürfe, versendet nichts |
| `JOB_SOURCES` | `seed` | Nur synthetische Stellen |

Fehlt ein Schlüssel, fällt der Adapter auf den Demo-Pfad zurück **und
die Oberfläche sagt es**. Es gibt keinen Zustand, in dem etwas
funktionsfähig aussieht und es nicht ist.

## Was hier bewusst nicht passiert

- Keine Bewertung von Stimme, Gesicht, Akzent, Emotion oder Ehrlichkeit
- Keine Ableitung von Gesundheit, Herkunft, Religion, Orientierung
- Kein Score, der als Einstellungswahrscheinlichkeit ausgegeben wird
- Keine Aussage, ein Beruf verschwinde in einer bestimmten Zeit
- Kein Massenversand, kein Versand ohne ausdrückliche Bestätigung
- Kein Scraping, kein Umgehen von Nutzungsbedingungen
- Keine erfundenen Firmen, Bewertungen, Logos oder Erfolgsquoten

Diese Punkte sind nicht nur dokumentiert, sondern getestet — siehe
`pnpm eval` und `packages/ai/src/eval/cases.ts`.

## Weiterlesen

- [Produkt](docs/PRODUCT.md) — Vision, Zielgruppe, Differenzierung
- [User Journey](docs/USER_JOURNEY.md) — der vollständige Ablauf
- [Architektur](docs/ARCHITECTURE.md) — Aufbau und Datenfluss
- [Datenmodell](docs/DATA_MODEL.md) — alle Tabellen
- [Matching](docs/MATCHING.md) — wie die Werte entstehen
- [KI-Architektur](docs/AI_ARCHITECTURE.md) — Provider und Modelle
- [KI-Schutzmechanismen](docs/AI_GUARDRAILS.md) — was verhindert wird und wie
- [Datenschutz und Sicherheit](docs/PRIVACY_SECURITY.md)
- [Jobquellen und Bewertungen](docs/JOB_SOURCES_AND_REVIEWS.md)
- [Barrierefreiheit](docs/ACCESSIBILITY.md)
- [Forschungsgrundlage](docs/RESEARCH_RATIONALE.md)
- [Entscheidungen](docs/DECISIONS.md) und [ADRs](docs/adr/)
- [Sicherung der Altprojekte](BACKUP_REFERENCE.md)

## Stand

Eine lauffähige vertikale Produktscheibe: Registrierung, Einwilligung,
Gespräch, Profil, Rollencluster, Jobliste, Job Intelligence, Bewerbung,
Studio mit Claim-Prüfung, Coaching, Privacy Center. Was fehlt oder nur
vorbereitet ist, steht in [docs/DECISIONS.md](docs/DECISIONS.md) unter
„Offene Punkte" — nicht versteckt.
