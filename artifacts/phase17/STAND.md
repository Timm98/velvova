# Phase 17 — Zwischenstand

Stand: 01.09.2026, 09:10 Uhr. Arbeitsbaum nicht committet (wie vereinbart).

## Basis, gemessen

- Typecheck: 17/17 sauber
- Unit-Tests: **981 grün** (Ausgangswert 944), 94 Dateien
- Routen: **45 von 45 in Ordnung, 0 kaputt.** 39 liefern 200, 4 Admin-
  Seiten geben für ein gewöhnliches Konto korrekt 404, 6 zeigen geprüfte
  Leerzustände (Bewerbungen, Karriere, Angebote, Rollen, Bewertungen)
- Jobbestand: **1.447 echte Stellen** aus 5 Quellen
- Flow 1 (Registrierung → Monday antwortet → Jobs → Detail → Begründung):
  vollständig grün, 0 JS-Fehler, 0 HTTP-5xx
- Flow 4 (Job → Bewerbung vorbereiten → Brücke → Paketstatus): grün

## P0 gefunden und behoben

**Zwei Admin-Seiten ohne Berechtigungsprüfung.**
`/admin/providers` und `/admin/sources` antworteten jedem angemeldeten
Konto mit 200 — inklusive Anbieterzuständen, Quellenentscheidungen und
Nutzungszahlen. Die Geschwisterseiten `/admin` und `/admin/reviews`
prüften seit jeher korrekt.

Gefunden nicht beim Lesen des Codes, sondern beim Abgehen aller 45
Routen mit einem frisch angelegten Konto. Beim Lesen sieht eine Seite
ohne Prüfung aus wie eine, die keine braucht.

Behoben durch dieselbe Wache wie bei den Geschwisterseiten (404, nicht
403 — ein 403 bestätigt die Existenz). Abgesichert durch
`apps/web/src/app/admin/wache.test.ts`, in beide Richtungen geprüft.

Kein Secret war betroffen: Beide Seiten geben ausdrücklich keine
Schlüssel aus. Client-Bundle zusätzlich auf 8 Secret-Muster geprüft —
sauber.

## Bilder: von keinem auf fünfzehn

Das Projekt hatte **zwei Bilddateien** (Icon, Monday-GLB). Ursache: Stufe 3
des Bildsystems wartete auf eine Bibliothek, die niemand angelegt hatte,
also fiel jede Stelle auf den gerechneten Verlauf durch.

- `scripts/illustrationen-bauen.mjs` — eine Bildsprache, 15 Ausprägungen
- `apps/web/public/berufsbilder/*.svg` — je ~1,4 KB
- Zwei parallele Bildsysteme auf eines zusammengeführt
- Miniaturen von 44 px quadratisch (schnitt das Motiv weg) auf 2:1
- Alternativtexte beschrieben noch die Vorgängermotive — korrigiert

## Weitere Korrekturen

- **§6 temporär vs. dauerhaft**: `apps/web/src/lib/nina/geltung.ts`,
  8 Tests. „Zeig mir heute mal Berlin" wurde bis dahin wie eine
  dauerhafte Präferenz behandelt. Noch **nicht** in die Oberfläche
  verdrahtet.
- **Landing**: graue Platzhalterbalken durch echten Beispiel-Match
  ersetzt; Gehalt grün, starker Fit violett, fehlende Angabe kursiv.
- **Landing**: Monday war eine dunkle Scheibe — der fast deckende
  Hintergrund ist für das 3D-Modell gedacht, wurde aber auch unter dem
  Ersatzbild gemalt. Jetzt an die Szene gebunden.
- **Monday-Seite**: leerer Gesprächszustand war oben mit 500 px Leere
  darunter; jetzt zentriert.
- **Mobile Jobs**: ~190 px Vorspann und Vorschläge eingespart.

## Live Voice — geprüft, soweit ohne Mikrofon möglich

`scripts/voice-pruefung.mjs`:

- unangemeldet → 307 zur Anmeldung
- angemeldet, ohne Sprach-Einwilligung → 403 `voice_consent_missing`.
  **Das ist richtig, nicht kaputt**: Die Einwilligung zum Sprachmodus ist
  von der allgemeinen KI-Nutzung getrennt und widerrufbar.
- kein langlebiger Schlüssel in der Antwort; das kurzlebige Geheimnis
  kommt über `/v1/realtime/client_secrets` vom Anbieter
- Zustandsmaschine vollständig (verbinden, sprache_beginnt,
  teiltranskript, redebeitrag_fertig, denkt, spricht, ton_verweigert …)

Ob Monday hörbar spricht und ob die Unterbrechung greift:
**MANUAL_TEST_REQUIRED** — dafür braucht es ein echtes Mikrofon.

## Bildzuordnung repariert

Auf Today trugen zwei von drei Karten dasselbe Codefenster, darunter
eine Vertriebsstelle. Ursache: `berufsgruppe()` verband Titel und
Aufgaben zu einer Zeichenkette, sodass ein beliebiges Aufgabenwort einen
eindeutigen Titel überstimmen konnte — „Kundenbetreuung" machte aus
Vertrieb Kundenservice, „Geschäftsentwicklung" machte daraus Software.

Jetzt: Titel zuerst, Aufgaben nur als Rückfall. Die ursprüngliche
Absicht bleibt („eine Entwicklerin in einer Klinik entwickelt"), 4 neue
Tests.

## Dreimal beinahe einen Nicht-Fehler gemeldet

Der Vollständigkeit halber, weil es etwas über die Prüfmethode sagt:

1. „Bewerbung vorbereiten führt nirgendwohin" — mein Test erwartete die
   falsche Adresse; der Weg führt bewusst über eine Brücke.
2. „Voice-Endpunkt antwortet unangemeldet mit 200" — Playwright folgt
   Weiterleitungen; es sind 307.
3. „403 bei Voice ist ein Fehler" — es ist die fehlende Einwilligung,
   also das gewünschte Verhalten.

Jedes Mal war das Prüfwerkzeug falsch, nicht das Produkt.

## Zwei Fehler am Fortschrittsmaß (01.09.)

Aufgefallen an einem Verhältnis, das nicht sein kann: **326 Belege in der
Datenbank, 0 Karriereprofile.**

**1. Die Abdeckung wurde berechnet und weggeworfen.**
`recomputeCoverage()` läuft bei jeder Belegänderung, zählte korrekt — und
schrieb das Ergebnis nur, wenn schon eine Profilzeile existierte. Eine
solche Zeile entstand aber ausschliesslich beim Klick auf „Profil
bestätigen", also ganz am Ende. Bis dahin las die Oberfläche
`profile?.coverage ?? 0` und zeigte null Prozent, egal wie viel jemand
beantwortet hatte.

Jetzt legt die Funktion die Zeile selbst an — mit `confirmedByUser:
false`, denn eine Messung ist keine Zustimmung.

**2. Die Abdeckung kannte das falsche Benennungsschema.**
In der Datenbank stehen zwei nebeneinander:

    interview:experience_episodes:solved_problem   (älter, 115 Belege)
    nina:v3:career_evidence:current_situation      (aktuell, 180 Belege)

Gezählt wurde nur das erste — also genau jenes, das die heutige Monday
NICHT schreibt. Wer heute ein Gespräch führte, sammelte Belege, die für
den Fortschritt nicht zählten.

Neu: `apps/web/src/lib/profil-bereiche.ts` versteht beide, mit 4 Tests.

**Gemessen, nicht behauptet.** `scripts/abdeckung-simulieren.mjs` rechnet
die Zuordnung gegen alle vorhandenen Belege: über 61 Konten steigt die
mögliche Abdeckung von **3,3 % auf 28,7 %**; 54 Konten profitieren.
Im Browser bestätigt (`scripts/abdeckung-pruefung.mjs`): nach dem
Bestätigen von vier Belegen springt die Anzeige von 0 % auf 33 %.
Die Datei liegt getrennt, weil `profile.ts` eine `"use server"`-Datei ist
und dort alle Exporte async sein müssen — der Typecheck liess die
synchrone Funktion durch, der Build nicht.

**3. Ein Bereich war nie erreichbar.**
`location_and_logistics` gehörte zu den sieben gezählten Bereichen und
hatte in 326 Belegen keinen einzigen Eintrag — die Abdeckung konnte
also nie über 86 Prozent steigen. Der Bereich ist jetzt draussen; Ort
und Pendelweg stehen als harte Bedingungen in `user_constraints`.

## „Nur für diese Suche" ist fertig verdrahtet

Das lose Ende vom Vorabend. `geltung.ts` war geprüfte Logik ohne
Anschluss — genau das Muster, das ich am Projekt kritisiert hatte.

Jetzt: dritter Knopf an der Bedingungskarte, Sitzungskeks (endet mit dem
Fenster, kein `maxAge`), Überlagerung im Abgleich, sichtbar und
rücknehmbar. Sieben Browserprüfungen grün, darunter: Jobliste trägt die
Bedingung, Profil bleibt unverändert.

Dabei fiel ein Fehler auf, den ich selbst eingebaut hatte: Die Karte
verschwand im selben Augenblick, in dem sie bestätigen sollte — die
Sitzungsbedingung erzeugt bewusst keine dauerhafte Karte, und die
Komponente blendete sich mangels Inhalt aus. Geklickt, und nichts sagte,
dass etwas passiert war.

## Eine Regression, die ich selbst verursacht hatte

Beim Nachholen der nie gelaufenen E2E-Reihe: **10 Fehlschläge**, alle
Barrierefreiheit auf der Startseite, über alle fünf Bildschirmbreiten.

Ursache war meine eigene Änderung vom Vorabend. Für die „Starker
Fit"-Marke in der Produktvorschau hatte ich eigene Klassen erfunden —
`bg-accent/12 text-accent`: zwölf Prozent der Akzentfarbe, gemischt mit
dem bläulichen Grund der Karte, und darauf die ROHE Akzentfarbe statt
der textsicheren Variante. Gemessen 3,64:1, gefordert 4,5.

Nicht gesehen habe ich es, weil ich Typprüfung, Unit-Tests und
Bildschirmfotos hatte — aber die Barrierefreiheitsreihe nie laufen
liess. Ein Bildschirmfoto zeigt keinen Kontrastwert.

Behoben mit den dafür vorgesehenen Klassen (`bg-accent-soft` /
`text-accent-text`, 5,20:1). **430 bestanden, 0 fehlgeschlagen.**

## Jetzt vollständig durchgelaufen

| Prüfung | Ergebnis |
|---|---|
| Typecheck | 17/17 |
| Unit-Tests | 977 |
| E2E (5 Breiten) | 430 bestanden, 0 fehlgeschlagen |
| KI-Auswertung | 50/50 Fälle |
| Routen | 45, davon 0 kaputt |
| Produktionsbau | grün |

## Der Abruf sucht jetzt nach dem, was gebraucht wird

**Korrektur an meiner eigenen Aussage vom Vortag.** Ich hatte gemeldet,
`search_plans` sei die tote Phase-4-Tabelle. Falsch: `search_plans` ist
ein Wochenplan (Stunden, Zielzahl Bewerbungen, Pausentage) und hat mit
Suchrichtungen nichts zu tun. Ich hatte von einem Tabellennamen auf
einen Inhalt geschlossen.

Die Suchrichtungslogik existiert sehr wohl —
`packages/matching/src/suchrichtungen.ts`, 271 Zeilen, aus Belegen statt
aus Jobtiteln abgeleitet, ohne Sprachmodell und mit Begründung je
Richtung.

**Der echte Befund war ein anderer:** Sie wurde nur *angezeigt*. Die
Bundesagentur wurde mit fünf fest eingetragenen Begriffen befragt —
Sachbearbeitung, Kundenbetreuung, Disposition, Büromanagement,
Vertriebsinnendienst. Der Adapter nimmt `abfragen` seit jeher im
Konstruktor entgegen, und sein Kommentar nennt ausdrücklich „die
Suchrichtungen aus ihrem Profil". Übergeben hat sie nur nie jemand.

Folge: Der Bestand wuchs in genau fünf Richtungen. Wer in eine sechste
wollte, fand nichts — nicht weil es nichts gibt, sondern weil nie jemand
gefragt hatte. Und weil die Jobseite danach ehrlich „1.428 Stellen
geprüft" meldete, sah es nach gründlicher Suche aus.

**Ergänzen statt ersetzen — aus einer Messung, nicht aus einer
Vermutung.** Der erste Entwurf hätte die Standardliste durch die
abgeleiteten Begriffe ersetzt. `scripts/suchbegriffe-zeigen.mjs` zeigte:
Über 63 Konten überschreiten nur **drei** Richtungen die Schwelle. Ein
Austausch hätte den Bestand von fünf auf drei Richtungen **verengt**.

**Im echten Abruf belegt** (`scripts/abfrage-beweis.mjs`): Der
zusätzliche Begriff „Personalsachbearbeitung" bringt **15 Anzeigen**,
die es ohne ihn nicht gab.

**Mit einer gemessenen Grenze.** Die Abrufschleife bricht ab, sobald das
Limit voll ist — hintere Begriffe kommen dann gar nicht mehr dran. Bei
Limit 20 und sechs Begriffen holte der sechste nichts. Beim produktiven
Limit 100 kam jeder der zwölf zum Zug, der letzte noch mit einem
Treffer. Wer die Begriffszahl erhöht, muss das Limit mit erhöhen.

## Offen — ehrlich

- **Nicht erledigt**: der Großteil der 28 Bereiche aus deiner Matrix.
  Belegt sind inzwischen Auth, Career Profile, Monday, Jobs, Matching,
  Bewerbung, Einstellungen, Abrechnung, Sicherheit, Mobile, Live Voice
  (bis zur Mikrofongrenze) und Career Coach.

- **Company Intelligence, ehrlich eingeordnet**: Firmen*daten* sind breit
  integriert — die `companies`-Tabelle wird von zwölf Nicht-Test-Dateien
  benutzt (Abgleich, Import, Bewerbungen, Angebote, Monday-Chat), und die
  Coresignal-Anreicherung existiert. Firmen*intelligenz* im Sinn von
  Phase 12 — Einstellungssignale, Vertrauensschicht, verdeckte Chancen —
  ist **nicht gebaut**: Die Tabellen `company_signals` und
  `hidden_opportunities` existieren nicht. `/app/opportunities` ist etwas
  anderes: der ehrliche Trichter, der zeigt, was auf jeder Stufe
  weggefallen ist.
- **Tot, aber vorhanden**: `search_plans` und `application_packages`
  werden von keiner Nicht-Test-Datei benutzt.
- `geltung.ts` ist geprüfte Logik ohne Anschluss an die Oberfläche.
- Live Voice: MANUAL_TEST_REQUIRED (kein echtes Mikrofon verfügbar).

## Werkzeuge, die bleiben

- `scripts/routen-rundgang.mjs` — alle Routen abgehen
- `scripts/flow-neuer-nutzer.mjs`, `scripts/flow-bewerbung.mjs`
- `scripts/schau.mjs` — Screenshots, eine Anmeldung
- `scripts/illustrationen-bauen.mjs`
