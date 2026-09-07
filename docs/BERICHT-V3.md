# Abschlussbericht — Paycheck / Monday, Future OS V3

Branch `feature/paycheck-future-os-v3`, Stand 30. August 2026.

---

## 1. Was tatsächlich geändert wurde

### Designsystem vollständig ersetzt
Nicht umgefärbt — ausgetauscht. `tokens.css` wurde neu geschrieben,
`globals.css` ebenfalls. **Kein Orange, kein Coral, kein Kupfer mehr im
Projekt** (der einzige Treffer im Quelltext ist der Kommentar, der es
verbietet).

| | vorher | nachher |
|---|---|---|
| Voreinstellung | hell, warmes Porzellan | **Obsidian** `#06080F`, dunkel |
| Helle Fassung | — | **Polar** `#F5F7FC` |
| Marke | Kupfer-Coral `#D9623E` | **Indigo** `#7182FF` / `#5868F6` |
| Signale | — | Cyan `#67D8FF`, Violett `#A68CFF` |
| Überschriften | Fraunces (Serif) | **Manrope** |
| Oberfläche | Geist Sans | Geist Sans |
| Zahlen | — | **Geist Mono**, tabellarisch |
| Radius | 12–22 px, viele Karten | **14 px**, Flächen und Linien |

Der Signalverlauf erscheint an **genau vier** Stellen: Mondays aktiver
Zustand, die eine primäre Handlung, die Faktorbalken, der Hero-Lichthof.

### Monday hat eine eigene Identität
`NinaSignal` ersetzt jedes Chatbot-Symbol: ein feiner Außenring, ein
versetzter Bogen als Bewegungsspur, ein Kern. Vier Zustände — `idle`,
`active`, `thinking`, `speaking` — ausschließlich über Licht
unterschieden. Reines SVG und CSS, mit Textalternative für
Vorlesesoftware.

Kein Gesicht, keine Sprechblase: Monday ist eine Analysefähigkeit, kein
Gegenüber, und ein menschelndes Symbol würde genau das versprechen, was
das Produkt nicht einlöst.

### Navigation reduziert
- **Rail statt Sidebar**: 76 px, ausklappbar auf 240.
- **Vier Bereiche**: Home, Entdecken, Bewerbungen, Karriere.
- **Monday ist eine Handlung**: Knopf in der Topbar, auf schmalen Geräten
  zentral über der unteren Navigation.
- **Nicht in der Topbar**: Sprache, Darstellung, Einstellungen,
  Abmelden. Alles im Kontomenü.

---

## 2. Neue und geänderte Routen

**Neu**
```
/terms                          Nutzungsbedingungen
/app/career                     Karriereprofil (früher /app/profile)
/app/documents                  Dokumente
/app/settings/profile           Konto
/api/nina/stream                Mondays Gespräch als Ereignisstrom
```

**Weitergeleitet**
```
/app/profile  →  /app/career    dauerhaft (308)
```

**Grundlegend umgebaut**
```
/                Landing: eigene Komposition je Abschnitt, echte Stellen im Hero
/app/jobs        geteilte Ansicht, Liste links, Auswahl rechts
/app/monday        zweispaltig, klebende Signals-Spalte
/app/career      Karriereprofil im neuen System
```

---

## 3. Datenbank und Migrationen

**Docker ist auf diesem Rechner nicht vorhanden**, ein lokales Supabase
kann also nicht starten. §18.1 sieht genau das vor: die Migrationen
gehören ins Repository, die lokale Datenbank muss weiter vollständig
funktionieren. Beides ist erfüllt.

`supabase/migrations/` — sechs Dateien, 1050 Zeilen SQL, **37 Tabellen**:

| Datei | Inhalt |
|---|---|
| `…000100_extensions_and_identity` | pgvector, pg_trgm, profiles, user_preferences, user_consents, Auslöser für neue Konten |
| `…000200_career` | interview_sessions, interview_messages, career_evidence, career_profiles, career_profile_versions, skills, role_recommendations, micro_assessments |
| `…000300_jobs` | job_providers, companies, **kanonisches jobs-Schema** mit 40 Feldern, FTS-Index, Trigram-Index, HNSW-Vektorindex, job_matches, job_analysis |
| `…000400_applications_and_ai` | applications, documents, document_versions, **document_claims**, coaching, ai_runs, audit_events |
| `…000500_rls` | Row Level Security |
| `…000600_storage` | drei private Buckets |

### RLS

**Nutzerbezogene Tabellen (24):** RLS an, `force row level security`, und
**vier getrennte Policies** statt einer für `ALL` — so steht sichtbar da,
dass auch das Einfügen an die eigene Kennung gebunden ist:

```sql
for insert to authenticated with check ((select auth.uid()) = user_id)
```

**Globale Tabellen (8):** lesbar für Angemeldete, **keine Schreib-Policy**.
Der Stellenabruf läuft mit dem Dienstschlüssel, der RLS umgeht. Damit
kann keine angemeldete Person eine Stellenanzeige anlegen.

**Nur serverseitig (3):** `job_import_runs`, `prompt_versions`,
`audit_events` — RLS an, gar keine Policy. Ohne Policy darf niemand
etwas, und das ist die richtige Voreinstellung.

**Ablage:** drei private Buckets. Der Zugriff hängt am ersten
Pfadabschnitt (`{user_id}/…`), also an der Datenbankregel und nicht an
einer Prüfung im Anwendungscode, die man vergessen kann.

**Neun Tests** prüfen genau das: dass keine nutzerbezogene Tabelle ohne
RLS bleibt, dass globale Tabellen keine Schreib-Policy haben, dass alle
Buckets privat sind, und dass der Dienstschlüssel nie unter
`NEXT_PUBLIC_` steht.

---

## 4. KI

### Modelle
Vier Stufen statt eines Modells — die Aufteilung ist nicht kosmetisch:
ein Gespräch braucht Tempo, eine Profilsynthese braucht Tiefe, eine
Klassifikation braucht beides nicht.

```
OPENAI_MODEL_INTERACTIVE=gpt-5.6-terra   Gespräch, Rückfragen
OPENAI_MODEL_DEEP=gpt-5.6-sol            Profilsynthese, Rollenvergleich
OPENAI_MODEL_FAST=gpt-5.6-luna           Klassifikation, Normalisierung
OPENAI_REALTIME_MODEL=gpt-realtime-2.1   Sprache
OPENAI_TRANSCRIBE_MODEL=gpt-live-transcribe
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
```

### Werkzeuge
**Zwölf Werkzeuge mit Zod-Schema.** Das ist die vollständige Liste
dessen, was Monday verändern darf — alles andere kann sie nicht, weil es
kein Werkzeug dafür gibt. Ein Prompt ist eine Bitte; ein fehlendes
Werkzeug ist eine Wand.

Drei Regeln, jede durch Tests abgesichert:

1. **Die Nutzerkennung steht in keinem Werkzeugschema.** Sie kommt aus
   der Sitzung — also kann kein Gespräch sie beeinflussen.
2. **Was das Modell ableitet, entsteht als „inferred".** Auf
   „confirmed" setzt ausschließlich ein Mensch.
3. **Änderungen an Bedingungen brauchen eine Begründung**, die der
   Person angezeigt wird, bevor sie greift.

### Streaming
`POST /api/nina/stream` liefert Server-Sent Events: `meta`, `text`,
`tool_start`, `tool_done`, `tool_error`, `done`. Der Werkzeugzustand ist
sichtbar — „Profil wird ergänzt", „Stellen werden durchsucht". Eine
Wartezeit ohne Aussage wirkt doppelt so lang.

Der Verlauf liegt in unserer Datenbank; an das Modell geht nur der
Kontext des aktuellen Schritts.

---

## 5. Stellen

| Anbieter | Zustand |
|---|---|
| **Arbeitnow** | **in Betrieb, 150 echte Stellen** |
| Adzuna | Adapter fertig, braucht `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` |
| Jooble | Adapter fertig, braucht `JOOBLE_API_KEY` |

**Regel aus §0 durchgesetzt:** Sobald eine echte Anzeige vorliegt,
verschwinden die Demo-Datensätze aus der Produktoberfläche. Die Regel ist
bewusst datenabhängig statt konfigurierbar — ein Schalter würde
irgendwann falsch stehen, und dann stünden erfundene Unternehmen neben
echten.

**Nichts wird geraten.** Arbeitnow überträgt keine Gehälter: es wird
keines geschätzt. Adzuna kennzeichnet Schätzungen: sie wandern in die
Rohdaten, nicht ins Gehaltsfeld. Jooble liefert Freitext: der Parser
erkennt deutsche Tausenderpunkte und Stundensätze mit Komma und lässt
Floskeln und Jahreszahlen liegen.

---

## 6. Prüfergebnisse

| Prüfung | Ergebnis |
|---|---|
| `pnpm typecheck` | 16 von 16 Paketen |
| `pnpm lint` | 16 von 16 |
| `pnpm test` | **176 Tests**, 15 Dateien |
| `pnpm eval` | 19 von 19 Fällen |
| `pnpm build` | 4 von 4 |
| `pnpm test:e2e` | **305 Tests** über fünf Breitenpunkte |
| axe, beide Themes, neun Seiten | **0 Verstöße** |
| `pnpm verify` | grün |

### Fehler, die die Prüfung gefunden hat

1. **Neun Kontrastverstöße** in der Vorgabe-Palette. `--text-tertiary`
   erreichte hell 2,92:1 auf `--surface-2`, dunkel 4,35:1 auf
   `--surface-3`. Cyan als Schrift: 2,55:1. Weiß auf dem hellen Indigo:
   4,44:1. Gelöst wie bei der Marke — die Fläche behält ihre Farbe, die
   Schrift bekommt eine eigene Fassung.
2. **Passung und Einstufung hingen an zwei verschiedenen Schwellen.**
   Eine Stelle konnte als „hohe Passung" gelten, während die Zahl daneben
   verweigert wurde. Der Fehler war die ganze Zeit da und wurde erst
   sichtbar, als sich die Gewichte änderten.
3. **Stundensätze mit Komma** wurden im Gehaltsparser gar nicht erkannt.
4. **Die geteilte Ansicht wählte auch auf schmalen Geräten vor** — man
   sah die erste Stelle statt der Liste, und die Liste war versteckt,
   obwohl niemand ausgewählt hatte.
5. **Das Markenzeichen in der Kopfzeile** war 20 px hoch: ein schönes
   Logo und ein schlechtes Berührungsziel.
6. **Überschriftensprung** von `h1` auf `h3` in der Stellenliste.

---

## 7. Definition of Done

| Punkt | Stand |
|---|---|
| Design klar unterscheidbar | ✅ |
| Keine orange Markenfarbe | ✅ |
| Fonts erneuert | ✅ Manrope, Geist Sans, Geist Mono |
| Header reduziert | ✅ |
| Sprache/Theme nicht im Header | ✅ |
| Registrierung und Login | ✅ |
| Sprache und Region gespeichert | ✅ geprüft mit Neuladen |
| Interview-Session persistent | ✅ |
| Echte OpenAI-Antwort gestreamt | ⚠️ Code vollständig, **Schlüssel fehlt** |
| Structured Output in DB-Felder | ✅ über Werkzeuge |
| Echte Jobs in eigener Datenbank | ✅ 150 |
| Keine Fake-Jobs in der Produktansicht | ✅ |
| Quelle und Aktualität sichtbar | ✅ |
| Match Score und Confidence getrennt | ✅ |
| Job speichern | ✅ |
| Bewerbung starten und persistent | ✅ |
| RLS verhindert Cross-User-Zugriff | ✅ getestet |
| Mobile Kernjourney | ✅ |
| Lint, Typecheck, Tests, Build | ✅ |

---

## 8. Fehlende Zugangsdaten

Ohne diese Werte läuft alles Übrige; die Oberfläche zeigt den Zustand
unter **Einstellungen → Verbundene Dienste** ungeschönt an.

```bash
# KI — ohne dies läuft der lokale Anbieter, gekennzeichnet
OPENAI_API_KEY=

# Supabase — ohne dies läuft die eingebettete Datenbank
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Weitere Stellenquellen
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JOOBLE_API_KEY=

# Planmäßiger Stellenabruf
JOBS_REFRESH_SECRET=

# Optional
GOOGLE_PLACES_API_KEY=
```

---

## 9. Startbefehle

```bash
corepack enable pnpm
pnpm install
cp .env.example .env
pnpm db:migrate && pnpm db:seed
pnpm --filter @paycheck/web dev
```

`http://localhost:3000` · Demo-Persona: `/api/dev/login`

Echte Stellen laden: **Einstellungen → Verbundene Dienste → Stellen jetzt
abrufen**. Der Abruf läuft im Serverprozess, weil die eingebettete
Datenbank ein Einzelprozess ist.

Mit Docker zusätzlich:
```bash
supabase start && supabase db reset
```

---

## 10. Bekannte Grenzen

**Monday antwortet noch nicht mit einem echten Modell.** Provider,
Werkzeuge, Streaming und Protokollierung sind gebaut und getestet — es
fehlt der Schlüssel. Ohne ihn läuft der lokale Anbieter, der seine
Antworten selbst als Beispiele kennzeichnet und **keine Werkzeuge
aufruft**: ein Demo-Anbieter, der so tut, als schriebe er Daten, wäre
schlimmer als gar keiner.

**Supabase läuft nicht lokal** — kein Docker. Migrationen und Policies
sind vollständig und über `supabase db push` einsetzbar. Bis dahin
arbeitet die Anwendung gegen die eingebettete Datenbank, deren RLS
ebenfalls getestet ist.

**Die Career Map (§11)** ist noch nicht gebaut. Das Karriereprofil zeigt
die Listenansicht, die der Auftrag ohnehin als Pflicht neben der
Visualisierung nennt.

**Voice** ist vorbereitet, aber nicht angeschlossen: Realtime braucht
Schlüssel und kurzlebige Tokens.

**Kein ESLint** — `typescript-eslint` unterstützt TypeScript 7 nicht.
Begründung in ADR 0002.

**Die Demo-Persona hat Demo-Bewerbungen.** Sie tragen „(Demo)" im
Firmennamen. Ein echtes Konto sieht sie nie: der Seed läuft nur für die
Entwicklungsanmeldung.

---

## 11. Bildschirmfotos

```
docs/screenshots/vorher-v3/        Stand vor dieser Ausbaustufe
docs/screenshots/nachher-v3/       Obsidian, 1440 / 1280 / 390
docs/screenshots/nachher-v3-polar/ Polar, dieselben Größen
```
