# Statusbericht V5.1 — Decision Intelligence

Stand: 30. August 2026. Branch `feature/legal-global-metasearch`.
Checkpoint vor diesem Durchgang: `checkpoint-before-v5-production-rebuild`.

---

## Der Gap-Abgleich, um den du gebeten hast

**Vollständig vorhanden** (aus früheren Durchgängen): Source Registry und
Policy Engine, kanonischer Stellen-Graph mit `job_source_links`, Modell-Router,
Mondays persistentes Gedächtnis mit Wiederaufnahme, Belegabgleich für
Bewerbungsaussagen, Betrugssignale, SSRF-gehärteter Link-Import,
Arbeitgeberboards, Partnerplatzhalter, Lightcast.

**Nur teilweise**: Freshness (Felder da, `activity_risk` fehlt), Jobqualität
(sechs Dimensionen statt zehn).

**Vollständig gefehlt** — alle dreizehn Addendum-Punkte. Kein einziger Treffer
im Code für `search_space_snapshots`, `experience_equivalencies`,
`application_effort`, `candidate_passport`, `hiring_process_templates`,
`target_companies`, `research_evidence_registry`, `requirement_type`,
`networking`.

Umgesetzt wurden davon in diesem Durchgang: Migration und Schema für **alle
dreizehn**, plus die Engines und Oberflächen für sechs davon.

---

## Kurzfassung

| | |
| --- | --- |
| Unit-Tests | 462, grün |
| E2E-Tests | 335, grün (5 übersprungen: nur mobil) |
| Evaluationsfälle | 50 von 50 |
| Typecheck / Build | fehlerfrei |
| Barrierefreiheit | 0 schwere Verstösse, beide Themen |
| Tabellen mit RLS | 46 von 78, **0 Lücken** |
| Migrationen | 6, davon 0005 neu (16 Tabellen) |
| Echte Stellen | ~260 im Bestand, live von Arbeitnow |
| Produktivbetrieb | **nein** |

---

## Was gebaut wurde

### Chancenfunnel (`/app/opportunities`)

Mit echten Daten gerade:

```
260  gefundene Quelleneinträge
260  eindeutige Stellen
260  aktuell bestätigt
125  erfüllen deine harten Bedingungen      ← 135 fallen hier weg
 26  für dein Erfahrungsniveau realistisch  ←  99 fallen hier weg
 26  mit belegter Passung
 26  entscheidungsbereit
```

Jede Zahl ist **gezählt**, keine geschätzt. Unter fünf Rohtreffern schweigt der
Trichter, statt Genauigkeit zu behaupten.

Der Engpass wird benannt — und die Handlungsempfehlung sagt nie „gib deine
Bedingungen auf". Eine harte Bedingung hat meist einen Grund, den die Person
nicht erzählt hat: Kinderbetreuung, Pflege, Gesundheit. Sie zu übergehen heisst,
den Grund zu übergehen. Ein Test hält das fest.

### Anforderungsklassifikation

„Führerschein Klasse C", „zwei Jahre Erfahrung" und „Teamgeist" stehen in
derselben Aufzählung und sind drei verschiedene Dinge:

- eine **formale Sperre** — ohne geht es nicht, aber sie lässt sich erwerben
- eine **verhandelbare Anforderung** — oft anders belegbar
- **Werbetext** — nichts, woran man scheitern könnte

Besonders: der Halbsatz „oder vergleichbare Qualifikation" wird erkannt und
ausgewiesen. Er wird überlesen, und er entscheidet oft darüber, ob sich jemand
überhaupt bewirbt.

### Überqualifikation

Wird **benannt, nicht gefiltert**. Filtern nimmt der Person die Möglichkeit;
benennen gibt ihr die Gelegenheit, den Punkt selbst anzusprechen.

Kein „du bist zu gut dafür" (Schmeichelei), kein „die nehmen dich nicht"
(Prognose, die wir nicht treffen können). Stattdessen: „Dein Erfahrungsniveau
liegt über der ausgeschriebenen Seniorität. Das kann erklärungsbedürftig sein."
Plus vier Fragen, um die Motivation zu belegen statt sie zu erfinden.

### Bewerbungsaufwand

Vor der Entscheidung, nicht danach. Workday 30–60 Min., Greenhouse 8–20,
Bewerbung per E-Mail 15–30. Anschreiben, Screening-Fragen, Arbeitsproben und
beizulegende Nachweise werden aufgeschlagen.

**Unbekannt bleibt unbekannt.** Eine erfundene Schätzung wäre schlimmer als
keine, weil die Person ihre Woche danach plant.

### Bedingungsmatrix

Drei Fächer: bestätigt (mit Fundstelle), unklar, Konflikt. Das mittlere ist das
wichtigste — ein Produkt, das Unbekanntes als unproblematisch behandelt,
verschiebt die böse Überraschung nur ins vierte Gespräch.

Höchstens fünf Rückfragen. Mehr liest niemand und merkt sich niemand.

### Entscheidungsvorlage auf der Jobdetailseite

Fünf getrennte Werte nebeneinander sind vollständig und trotzdem keine Hilfe.
Die Vorlage fasst sie zu einer Empfehlung zusammen — und trennt dabei
ausdrücklich „möglicher Haken" von „noch unklar": etwas nicht zu wissen ist
kein Nachteil der Stelle, sondern eine Lücke in unserer Kenntnis.

Ein harter Konflikt schlägt jede gute Passung. Ihn abzuwägen hiesse, die
Bedingung der Person zu überstimmen.

### Belegqualität

Ein Forenbeitrag erzeugt eine Hypothese, eine amtliche Statistik trägt eine
Aussage. Keine Zahl ohne Datum und Region. Unternehmensstudien werden als
interessengefärbt gekennzeichnet. Widersprechen sich Quellen um mehr als 25 %,
wird die **Spannweite** gezeigt statt einer ausgewählten Zahl.

Der subtilste Fall ist eigens behandelt: eine allgemeine Studie als
individuellen Beweis zu verwenden („Studien zeigen X, also solltest du X tun")
ist ein unzulässiger Schluss von der Verteilung auf den Einzelfall — und er
klingt überzeugend. Er bekommt eine ausdrückliche Einschränkung.

### Networking

Perspektivwechsel ohne Antwortquote: „Über die eigene Arbeit gefragt zu werden
ist für viele eher angenehm als lästig." Kein Prozentsatz — den wüssten wir
nicht, und er wäre der Anfang einer Manipulation.

Jeder Entwurf endet mit einem einfachen Ausweg. Das ist kein Höflichkeitsfloskel,
sondern der Grund, warum die Bitte keine Verpflichtung erzeugt. Warnungen bei
„dauert nur kurz", vorauseilender Dankbarkeit, direkter Jobbitte im Erstkontakt
und eigener Dringlichkeit als Argument.

### Keine Demo-Antworten in Produktion

`/api/nina/stream` antwortet in Produktion mit 503 statt mit einer
Beispielantwort. Eine Antwort, die aussieht wie eine Antwort von Monday, ist eine
Lüge über das, was das Produkt gerade kann — und die teuerste Sorte, weil die
Person darauf Entscheidungen über ihre Bewerbung stützt. In der Entwicklung
läuft der Demo-Anbieter weiter, sonst könnte niemand ohne Schlüssel arbeiten.

---

## Was ich kaputt gefunden habe

**Drei deutsche Sprachfallen**, alle mit echten Formulierungen aufgedeckt:

- „Teamleitung" — ein Kompositum. `\bleitung\b` findet „Leitung Logistik", aber
  nicht „Teamleitung", und die zweite Schreibweise ist die häufigere.
- „keine Schichtarbeit" wurde als Schichtarbeit gelesen. Das erzeugte einen
  Konflikt, den es nicht gab — in einer Anzeige, die ausdrücklich das Gegenteil
  sagt.
- „Reisebereitschaft … 40 %" — der Prozentwert steht *hinter* dem Wort. Das faule
  Muster mit optionaler Gruppe hörte davor auf, und der Konflikt fiel nie auf.

**Zwei Regeln für dieselbe Frage.** Im Anforderungsklassifikator prüfte das
Datenfeld „Ersatzqualifikation möglich" mit einem breiteren Muster als der
erklärende Satz daneben. Ergebnis: „Alternative möglich" im Feld, „steht nicht
dabei" im Text.

**Das deutsche Anführungszeichen im String.** `"„Dauert nur kurz"` — das
schliessende Zeichen ist ein gewöhnliches `"` und beendete das Literal. Die
Datei liess sich nicht übersetzen.

**`/api/nina/stream` konnte in Produktion Demo-Text ausliefern.** Es gab keinen
Riegel dagegen.

---

## Was nicht läuft — und warum

### Fehlende Zugangsdaten, keine Fehler im Code

| | Zustand | Fehlende Variable |
| --- | --- | --- |
| Monday antwortet über echte KI | **nein** | `OPENAI_API_KEY` |
| Supabase als Datenbank | **nein** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| Adzuna liefert Stellen | **nein** | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |
| Jooble liefert Stellen | **nein** | `JOOBLE_API_KEY_DE` |
| Lightcast | **nein** | Vertrag + `LIGHTCAST_ENABLED=true` |

Das sind **keine Bugs**. Der Code läuft; es fehlen Schlüssel. Die drei Punkte
aus deiner Fehlerliste — „Monday zeigt Demo-Anbieter", „Jobs aus Mock-Daten",
„nicht verbunden" — haben genau hier ihre Ursache. Setz die Werte in
`.env.local`, dann verschwinden sie.

Was ich stattdessen geändert habe: der Zustand wird jetzt ehrlich benannt statt
mit einer Beispielantwort überspielt.

### Nicht umgesetzt

**Die Designsprache „Future Editorial / Luminous Intelligence"** ist **nicht**
umgesetzt. Die Anwendung läuft weiter auf „Obsidian & Ice" aus V3: dunkel als
Standard, Indigo `#7182FF` statt Electric Violet `#665CFF`, Geist statt Inter
als Textschrift. V5 verlangt Light Mode als Standard und eine andere Palette.
Das ist ein grosser, eigenständiger Umbau — ich habe die Funktionslücken des
Addendums vorgezogen, weil sie im Produkt mehr bewegen. **Offen und bewusst so.**

**Root-404 reproduziert nicht.** `/` liefert für anonyme Besucher 200, mit
ungültigem Cookie 200, angemeldet 307 auf `/app`. In der Entwicklung und im
Produktionsbuild. Wenn du es weiterhin siehst: sag mir Browser und ob du
angemeldet warst.

**Safari-Reload reproduziert nicht** — ich habe keinen Safari zum Testen. Die
gemessene Ursache für Speicherprobleme war eine Seite mit 12.706 Knoten
(`/app/settings`), die im letzten Durchgang auf 413 gefallen ist.

**Sieben Addendum-Punkte haben Tabellen, aber noch keine Oberfläche:**
Candidate Passport, Hiring Process Transparency, Smart Follow-up, Company
Watchtower, Search Channel Portfolio, Search Project Planner,
Experience-Equivalency-Speicherung.

**Weiterhin offen aus V5:** ESCO, Hybrid Search mit pgvector/FTS/RRF, Employer
Portal mit Domainverifikation, Ratenlimit, Verschlüsselung schutzbedürftiger
Freitexte, Auftragsverarbeitungsverträge, Penetrationstest.

---

## Befehle

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev                 # http://127.0.0.1:3000
                         # Anmeldung: /api/dev/login

pnpm typecheck
pnpm test                # 462 Unit-Tests
pnpm test:e2e            # 335 E2E-Tests
pnpm build

node scripts/generate-source-docs.mjs
node scripts/generate-rls-doc.mjs
node scripts/generate-ai-routing-doc.mjs
SCHEME=dark node scripts/axe-detail.mjs /app /app/jobs /app/opportunities
```

---

## Das Muster

Fast jeder Fehler in diesem Durchgang war lautlos.

Ein Muster, das „keine Schichtarbeit" als Schichtarbeit liest, meldet einen
Konflikt, den es nicht gibt — und niemand merkt es, weil ein Konflikt plausibel
aussieht. Zwei Regeln für dieselbe Frage widersprechen sich erst, wenn jemand
beide Ausgaben nebeneinander sieht. Eine Demo-Antwort ist von einer echten nicht
zu unterscheiden; das ist ihr ganzer Zweck.

**Wo etwas falsch sein kann, ohne dass etwas fehlschlägt, gehört ein Test hin.**
Deshalb prüfen die Tests hier fast überall die Gegenrichtung: dass nichts
erfunden wird, dass Unbekanntes unbekannt bleibt, dass keine Zahl ohne Quelle
erscheint und dass kein Satz der Person die Entscheidung abnimmt.
