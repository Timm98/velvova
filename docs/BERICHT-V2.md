# Abschlussbericht — Paycheck / Monday, zweite Ausbaustufe

Branch `feature/paycheck-professional-v2`, Stand 30. August 2026.

---

## 1. Was sichtbar anders ist

**Der Kern des Problems war messbar.** Die Oberfläche bestand aus 789
Inline-Stilen gegen 49 Tailwind-Klassen. Ein Stilobjekt kann keine
Zustände ausdrücken — kein Hover, keinen Fokusring, keine Bewegung. Das
war der Grund für den billigen Eindruck, nicht die Farbwahl.

Jetzt: 321 Inline-Stile, 732 Klassen, und alles, was auf der Kernjourney
liegt, ist vollständig umgestellt.

| | vorher | nachher |
|---|---|---|
| Hero-Schlagzeile | fünf Zeilen, Wort für Wort gebrochen | zwei Zeilen, Serifenschrift |
| Kopfzeile | DE/EN + Hell/Dunkel/System + Einstellungen + Abmelden | Kontexttitel, Suche, Benachrichtigungen, Avatar |
| Stellenliste | eine Liste, sieben Sortierknöpfe | drei begründete Gruppen, Suche in normaler Sprache |
| Stellendetail | eine lange Spalte | zwei Spalten, rechts klebend die Entscheidung |
| Einstellungen | eine Seite, alles untereinander | sieben Bereiche mit eigener Navigation |
| Stellen | 10 erfundene | 150 echte plus 10 gekennzeichnete Demo-Sätze |

**Schrift.** Geist für die Oberfläche, Fraunces (variabel, mit optischer
Größenachse) ausschließlich für große Überschriften. Beide selbst
gehostet.

**Farbe.** Warmes Porzellan `#F5F2EC`, Kupfer-Coral als Marke. Zwei
Akzentwerte statt einem: weiße Schrift auf dem helleren Markenton
erreicht nur 3,7:1. Die Marke bleibt für Flächen und Symbole, die
klickbare Fläche bekommt den tieferen Kupferton mit 5,3:1.

---

## 2. Was gebaut wurde

### Navigation
- App-Shell mit einklappbarer Seitenleiste (die Wahl überlebt den
  Seitenwechsel), Kontexttitel, Befehlspalette auf `⌘K` mit echter
  Stellensuche gegen die Datenbank, Benachrichtigungen mit Zähler,
  Kontomenü.
- **Kein Sprachschalter und kein Darstellungsschalter in der Kopfzeile.**
  Beides gehört ins Onboarding und ins Kontomenü.
- **Kein dauerhaftes Demo-Warnband.** Eine Leiste, die immer da ist, wird
  nach zwei Minuten nicht mehr gesehen. Demo-Daten sind dort
  gekennzeichnet, wo sie stehen.
- Unten auf schmalen Geräten fünf Einträge, im Raster statt darüber.

### Sprache und Region
Eigener Bereich unter `/app/settings/language-region` mit **drei
getrennten Sprachen**: Oberfläche, Gespräch mit Monday,
Bewerbungsunterlagen. Dazu Wohnsitzland und Jobmarkt getrennt,
Wohnort, Suchradius, Pendelzeit, Zeitzone, Währung, Entfernungseinheit,
Umzugsbereitschaft, Arbeitsmodell, Vertragsarten, Gehaltswunsch.

Weitere Bereiche: Konto, Erscheinungsbild, Stimme & Gespräch,
Benachrichtigungen, Datenschutz & Daten, Verbundene Dienste.

### Echte Stellen
- `ArbeitnowAdapter` gegen `https://www.arbeitnow.com/api/job-board-api`.
  Kein Schlüssel, keine Anmeldung, kein umgangener Zugriffsschutz.
- Normalisierung, Inhaltshash zur Erkennung von Reposts, wiederholbarer
  Lauf, Momentaufnahme je Abruf.
- `POST /api/jobs/refresh` läuft **im Serverprozess**. Die eingebettete
  Datenbank ist ein Einzelprozess; ein Abruf von außen schreibt in
  dieselbe Ablage, aber der laufende Server sieht davon nichts. Genau
  daran haben in der Entwicklung 50 von 80 Stellen gefehlt.
- Jede Anzeige nennt Quelle und Abrufzeitpunkt und verlinkt auf das
  Original. Fehlende Angaben bleiben fehlend: Arbeitnow überträgt keine
  Gehälter, und es wird keines geschätzt.

### Matching und Stellenansicht
- Drei begründete Gruppen: beste Treffer, mutige Alternativen, neu diese
  Woche. Bei ausdrücklicher Sortierung eine einfache Rangfolge.
- Karte: Titel, Unternehmen, Ort, Arbeitsmodell, Vertrag, Gehalt (nur
  wenn genannt), Alter, Quelle — plus Passung, Sicherheit, ein Grund und
  ein Vorbehalt. Initialen statt erfundener Logos.
- Detailseite: Reality Check links, rechts klebend Bewertung und
  Handlungen, dazu eine kontextuelle Monday-Leiste mit vorbereiteten
  Fragen zur Stelle.
- Ausgeschlossene Stellen stehen in einem eigenen Abschnitt mit dem
  konkreten Grund — vorher wären sie durch die Rangfolge hinter allem
  anderen gelandet und damit unsichtbar gewesen.

### KI-Architektur
`AiProvider` mit vier Anbietern: `mock`, `openai` (Responses-API),
`anthropic`, `self_hosted` (OpenAI-kompatibler Endpunkt unter eigener
Kontrolle). Strukturierte Ausgaben über `json_schema` mit `strict: true`
und einer zweiten Prüfung gegen dasselbe Zod-Schema.

Zwei Regeln, die wichtiger sind als die Anbieterwahl:
- **Kein vorgetäuschter Betrieb.** Ohne Schlüssel läuft der lokale
  Anbieter, und die Oberfläche sagt das.
- **Kein stiller Modellwechsel.** Fehlt der Zugriff auf das eingetragene
  Modell, erscheint eine Konfigurationsmeldung mit dem Namen der
  Umgebungsvariablen — keine Ersatzantwort.

---

## 3. Datenbank, Migrationen, RLS

- 56 Tabellen, zwei Migrationsdateien, beide angewendet.
- Migration `0001` erweitert `user_settings` um 15 Spalten:
  Assistenz- und Dokumentsprache, Jobmarkt, Koordinaten, Suchradius,
  Remote-Wunsch, Vertragsarten, Gehaltswunsch, Stimmeinstellungen,
  Abschluss des Onboardings.
- **RLS auf jeder nutzerbezogenen Tabelle**, durchgesetzt über eine
  eingeschränkte Rolle `paycheck_app` (`NOLOGIN`) und `SET LOCAL ROLE`.
  Ein Test prüft das — und hat einen echten Fehler gefunden:
  `ENABLE ROW LEVEL SECURITY` wirkt gegenüber einem Superuser nicht.
- Persistenz überprüft: Sprache, Gehaltswunsch und Vertragsarten
  überstehen ein Neuladen; ein Teilformular überschreibt keine Felder,
  die es nicht enthält.

**Abweichung vom Auftrag:** kein Umstieg auf das Supabase-SDK.
Begründung in [ADR 0007](adr/0007-postgres-statt-supabase-sdk.md).
`DATABASE_URL` kann direkt auf eine Supabase-Instanz zeigen — Supabase
ist Postgres, und Migrationen wie Richtlinien laufen dort unverändert.

---

## 4. Externe Dienste — ehrlicher Stand

| Dienst | Zustand | Was fehlt |
|---|---|---|
| **Arbeitnow** | in Betrieb, 150 Stellen | nichts |
| KI-Anbieter | nicht verbunden | `OPENAI_API_KEY` |
| Sprachanbieter | nicht verbunden | `VOICE_PROVIDER`, `OPENAI_TRANSCRIBE_MODEL` |
| E-Mail | nur Entwurf | `MAIL_PROVIDER`, `SMTP_URL` |
| Dateiablage | lokal | `STORAGE_DRIVER=s3`, `S3_BUCKET` |
| Unternehmensbewertungen | nicht verbunden | `GOOGLE_PLACES_API_KEY` |

Unter Einstellungen → Verbundene Dienste steht dieselbe Tabelle im
Produkt, mit den Variablennamen daneben.

### Benötigte Schlüssel

```
AI_PROVIDER=openai
OPENAI_API_KEY=            # nötig, damit Monday mit einem echten Modell antwortet
OPENAI_PRIMARY_MODEL=gpt-5.6
OPENAI_FAST_MODEL=gpt-5.6-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_TRANSCRIBE_MODEL=   # für Spracheingabe
OPENAI_SPEECH_MODEL=       # für Sprachausgabe
DATABASE_URL=              # Supabase oder eigener Postgres
STORAGE_DRIVER=s3
S3_BUCKET=
S3_ENDPOINT=
MAIL_PROVIDER=
SMTP_URL=
JOBS_REFRESH_SECRET=       # für den planmäßigen Stellenabruf
GOOGLE_PLACES_API_KEY=     # optional, für Unternehmensbewertungen
```

---

## 5. Prüfergebnisse

| Prüfung | Ergebnis |
|---|---|
| `pnpm typecheck` | 16 von 16 Paketen |
| `pnpm lint` | 16 von 16 (siehe Grenzen) |
| `pnpm test` | 144 Tests, 13 Dateien |
| `pnpm eval` | 19 von 19 Fällen |
| `pnpm build` | 4 von 4 |
| `pnpm test:e2e` | 305 Tests über fünf Breitenpunkte |
| `pnpm verify` | grün |

### Fehler, die die Prüfung gefunden hat

1. `readLanguages` erkannte „Verhandlungssicheres Deutsch" nicht — die
   Wortgrenze hinter dem Stamm schlägt bei jeder deutschen Beugung fehl.
   Die Sprachanforderung wäre eine Stufe zu niedrig eingeschätzt worden.
2. Markenfarbe als Textfarbe: 3,2–3,6:1 auf hellen Flächen.
3. Der Kontexttitel in der Kopfzeile war ein `<h1>` — zwei je Seite.
4. `role="region"` auf einer `<ul>` nahm ihr die Listenrolle.
5. Der Titel-Link einer Jobkarte war unter 24 Pixel hoch.
6. Ausgeschlossene Stellen landeten durch die Rangfolge hinter allem
   anderen — unsichtbar genau dann, wenn man sie sehen wollte.
7. `pnpm test` lief über Turbo je Paket und fand keine einzige
   Testdatei: die Muster der Wurzelkonfiguration sind von der Wurzel aus
   gedacht. Der Befehl war grün und prüfte nichts.
8. Zwei seitliche Überläufe, beide dieselbe Ursache: Rasterzellen haben
   `min-width: auto`, ein zu breites Kind dehnt die ganze Spalte.

---

## 6. Starten

```bash
corepack enable pnpm
pnpm install
cp .env.example .env
pnpm db:migrate && pnpm db:seed
pnpm --filter @paycheck/web dev
```

`http://localhost:3000`. Demo-Persona ohne Registrierung über
`http://localhost:3000/api/dev/login`.

Echte Stellen laden: Einstellungen → Verbundene Dienste → *Stellen jetzt
abrufen*.

## 7. Produktionsbetrieb

1. Postgres bereitstellen (Supabase genügt), `DATABASE_URL` und
   `DATABASE_DRIVER=pg` setzen.
2. `AUTH_SECRET` erzeugen.
3. `pnpm db:migrate` — legt Schema und RLS-Richtlinien an.
4. Objektspeicher einrichten, `STORAGE_DRIVER=s3`.
5. `AI_PROVIDER` und Schlüssel setzen.
6. `pnpm build`, dann `pnpm --filter @paycheck/web start`.
7. Zeitplan auf `POST /api/jobs/refresh` mit
   `Authorization: Bearer $JOBS_REFRESH_SECRET`.
8. Vor öffentlichem Betrieb: die sechs Punkte in
   [privacy-architecture.md](privacy-architecture.md) §4.

---

## 8. Bekannte Grenzen

**Monday antwortet noch nicht mit einem echten Modell.** Der Provider ist
gebaut, geprüft und über eine Variable schaltbar — es fehlt der
Schlüssel. Ohne ihn läuft der lokale Anbieter, und das steht an jeder
Stelle, an der es zählt. Das ist der einzige Punkt der Definition of
Done, der offen ist, und er hängt an einer Zugangsberechtigung, nicht an
Code.

**Kein ESLint.** `next lint` gibt es seit Next 16 nicht mehr; der Ersatz
scheitert daran, dass `typescript-eslint` TypeScript 7 nicht
unterstützt. Statt auf TypeScript 6 zurückzugehen: `tsc --noEmit` als
Lint-Aufgabe und ein Nachtrag in ADR 0002. Die
Barrierefreiheitsregeln prüft die axe-Suite an der laufenden Seite —
gründlicher als es ein statischer Linter könnte.

**321 Inline-Stile** verbleiben, verteilt auf Application Studio, Setup,
Admin, Coaching und die Rechtstexte. Sie funktionieren über die
Kompatibilitätsschicht, sind aber nicht auf dem Stand der Kernjourney.

**Keine Anmeldung über Google.** Im Auftrag als optional gekennzeichnet.

**Uploads unvollständig.** Die Ablage ist lokal, es gibt keine
Schadsoftwareprüfung und keine Dokumentextraktion.

**Kein Rate Limiting**, kein Wiederherstellungstest, kein externer
Sicherheitstest.

---

## 9. Wichtigste Dateien

**Neu**
```
packages/jobs/src/sources/arbeitnow.ts       echter Stellenkonnektor
packages/jobs/src/ingest.ts                  wiederholbarer Abruf
packages/jobs/src/arbeitnow.test.ts          11 Tests
packages/ai/src/providers/openai.ts          Responses-API
apps/web/src/components/shell/AppShell.tsx   Gerüst
apps/web/src/components/shell/CommandPalette.tsx
apps/web/src/components/shell/AccountMenu.tsx
apps/web/src/components/jobs/JobCard.tsx
apps/web/src/components/marketing/EvidenceSequence.tsx
apps/web/src/app/api/jobs/refresh/route.ts
apps/web/src/app/api/search/route.ts
apps/web/src/app/app/settings/**             sieben Bereiche
apps/web/src/app/(public)/{product,pricing,imprint}/page.tsx
docs/adr/0007-0009, docs/privacy-architecture.md
scripts/screenshots.mjs, scripts/axe-detail.mjs
```

**Wesentlich geändert**
```
packages/design-tokens/src/tokens.css        Palette
apps/web/src/app/globals.css                 Tailwind-Brücke, Schrift
apps/web/src/app/page.tsx                    Landing
apps/web/src/app/app/page.tsx                Dashboard
apps/web/src/app/app/jobs/page.tsx           Matches
apps/web/src/app/app/jobs/[id]/page.tsx      Reality Check
apps/web/src/app/app/monday/**                 Gespräch
apps/web/src/app/app/profile/**              Karriereprofil
packages/i18n/src/messages/{de,en}.ts        Landing vollständig übersetzt
packages/config/src/runtime.ts               Anbieterwahl
packages/db/src/schema/identity.ts           user_settings
```

## 10. Bildschirmfotos

```
docs/screenshots/vorher-v2/     Stand vor dieser Ausbaustufe
docs/screenshots/nachher-v2/    Stand danach
```

Je 1440×1000, 1280×800 und 390×844, jeweils Landing, Produkt,
So-funktioniert-es, Login, Registrierung, Dashboard, Monday, Matches,
Stellendetail, Profil, Bewerbungen und drei Einstellungsbereiche.
