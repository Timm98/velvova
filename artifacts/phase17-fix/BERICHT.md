# Phase 17 — Header, Job-Core, Währung

01.09.2026. 1.015 Tests grün, Typecheck 17/17, Produktionsbau grün.

## HEADER

**Ursache:** Nicht der Header. Auf der Monday-Seite lag ein radialer
Verlauf (`--glow-nina`) über die **volle Seitenbreite**, 420 px hoch, ab
24 px oberhalb des Bereichs. Weil der Header durchsichtig ist
(`bg-page/85 backdrop-blur-xl`), lag der Verlauf teilweise HINTER ihm —
es sah aus, als leuchte die Kopfzeile nach unten.

**Fix:** Die Fläche ist entfernt. Mondays eigener Schein bleibt, wo er
hingehört: `inset-[-18%]` um ihre Kugel. Der Landing-Schein bleibt
ebenfalls — er ist auf 880 px begrenzt und liegt mitten auf der Seite
hinter Karten, nicht unter dem Header.

## JOB CORE

**Liste:** Ein Signal je Zeile statt zwei. „Gehalt nicht angegeben" ist
als Marke entfallen — es stand in derselben Karte schon in der
Metazeile. In der Praxis standen vorher fast immer zwei Warnungen
untereinander; was bei jeder Zeile steht, unterscheidet keine Zeile.

**Zahlen:** „1.447 Roh-Treffer" ist raus. Jetzt „1.428 Stellen geprüft ·
658 erfüllen deine Bedingungen". Die Roh-Zahl beschrieb unseren
Abrufvorgang, nicht die Auswahl.

**Entfernte technische Meldungen:** Die beiden Absätze unter der Liste
(„19 Anzeigen sind abgelaufen …", „770 Stellen verletzen …") sind durch
einen Link ersetzt: „Warum sehe ich diese Auswahl?" Die Zahlen werden
weiterhin berechnet und stehen im Trichter unter Chancenraum.

**Bilder:** 36,4 % der Stellen bekamen gar kein Motiv. Die Lücken waren
benennbar — ~29× „Kaufleute für Büromanagement", 18× „Projektleiter",
„Account Executive", „IT Administrator". Muster erweitert, Abdeckung
**63,6 % → 76,5 %** (186 Stellen mehr).

## SALARY

**Der Fehler:** Eine Stelle in Frankfurt, Land DE, stand mit
`salaryCurrency = GBP` in der Datenbank. TheirStack hatte es so
geliefert, der Adapter reichte es durch:
`salaryCurrency: s.salary_currency ?? "EUR"`. Plausible Zahl, plausibles
Kürzel — zusammen ein um rund 15 % falscher Betrag, in die Richtung, die
eine Stelle attraktiver aussehen lässt.

**Auflösung:** `packages/jobs/src/waehrung.ts`. Der Anbieter hat
Vorrang, aber kein Vetorecht: Widerspricht seine Angabe dem Land der
Stelle und bestätigt der Gehaltstext sie nicht, gilt das Land. ISO-4217
Ländertabelle, Symbolerkennung, `$` nur mit Land auflösbar. Ohne
Grundlage `null` statt „EUR". Jede Entscheidung trägt eine Herkunft
(`provider | raw_string | location_fallback | manual_repair`).

**Zentral, nicht je Adapter:** verdrahtet in `gehaltFuer()` in
`adapter.ts` — der Punkt, durch den jede Anzeige läuft.

**Backfill:** `scripts/waehrung-reparieren.mjs`, Trockenlauf als
Voreinstellung. 1.447 Stellen geprüft, **1 richtiggestellt**, 1.446
unberührt. Gegenprobe: keine Nicht-EUR-Währung mehr im Bestand.

**Formatierung:** `apps/web/src/lib/jobs/geld.ts`. Vorher stand an zwei
Stellen `Intl.NumberFormat("de-DE")` fest eingetragen — die Liste hängte
das Kürzel an, das Detail setzte das Symbol davor, und beide schrieben
jede Währung deutsch. Jetzt eine Funktion, Gebietsschema aus der
Währung: `60.000 €`, `CHF 90'000`, `£60,000`, `$120,000`.

## NET SALARY

Der Rechner prüfte das Land, nicht die Währung. Eine deutsche Stelle mit
GBP-Betrag hätte deutsche Steuern auf einen Pfundbetrag gerechnet.
Jetzt: Passt die Währung nicht zum Land, wird nicht gerechnet und der
Grund genannt. Die Länderprüfung samt Rückfallmeldung gab es bereits.

## TESTS

- Währungsauflösung: 21 Tests (Frankfurt-Fall, DE/CH/GB/US/CA/AU/PL/SE/DK/CZ,
  Dollarzeichen nur mit Land, nichts erfinden)
- Geldformatierung: 8 Tests
- Bildzuordnung: 5 neue Tests für die gemessenen Lücken
- Listensignale: auf ein Signal je Zeile umgestellt

## SCREENSHOTS

artifacts/phase17-fix/header-fixed.png
artifacts/phase17-fix/jobs-core-fixed.png
artifacts/phase17-fix/salary-germany.png
artifacts/phase17-fix/salary-unknown.png

## OFFEN

- **Keine CHF-/GBP-/USD-Screenshots.** Nach der Reparatur enthält der
  Bestand ausschliesslich EUR-Stellen — es gibt keine ausländische
  Stelle zum Fotografieren. Die Formatierung ist durch Tests belegt,
  nicht durch ein Bild. Einen Job zu erfinden, nur um ihn zu
  fotografieren, wäre das Gegenteil dessen, worum es hier geht.
- §4 Kartenhierarchie nur teilweise: Text reduziert, aber die
  Reihenfolge Titel/Firma/Ort/Modell/Gehalt ist nicht neu aufgebaut.
- §10 „Warum Monday ihn zeigt" noch nicht gekürzt.
- §43/§44 Spaltenbreiten unverändert.

---

# Nachtrag: Job Data Quality (01.09., Nachmittag)

1.025 Tests grün, Typecheck 17/17, Build grün.

## Gemessen statt vermutet

`scripts/quellen-zeugnis.mjs` — Abdeckung je Anbieter:

    Quelle                     Jobs  Beschr  Gehalt  Modell   Link
    Arbeitnow                  1043    100%      0%    100%   100%
    Bundesagentur für Arbeit    301    100%      2%    100%   100%
    Adzuna                       83    100%      0%    100%   100%
    JSearch                      48     96%      0%    100%   100%
    TheirStack                   25    100%      4%    100%   100%

Beschreibung, Arbeitsmodell und Link liegen bei 100 %. Das Problem ist
allein das Gehalt.

## Drei Ursachen, drei verschiedene Antworten

**1. Wir haben Gehälter angezeigt-versteckt.**
An acht Stellen stand `salary.disclosed ? … : null`. Das Feld heisst
„der Arbeitgeber hat es offengelegt" — als ANZEIGESCHALTER verwendet,
versteckte es die **70 Beträge, die aus den Stellenbeschreibungen
gelesen** wurden. Die Liste schrieb 1.446 Mal „nicht angegeben", obwohl
in siebzig Anzeigen eine Zahl stand.

Neu: `gehaltsanzeige.ts`. Angezeigt wird, was einen Betrag hat; die
Herkunft steht daneben („vom Arbeitgeber angegeben" / „aus der
Stellenbeschreibung gelesen"). Grün nur bei der Arbeitgeberangabe —
eine gelesene Zahl ist eine gute Auskunft, aber keine Zusage.

**2. Wir haben Gehälter beim Import weggeworfen.**
Die Bundesagentur liefert `gehaltsspanneVon`/`gehaltsspanneBis`. Der
Adapter las sie nie und meldete `capabilities.salary = false`. Im Code
stand sogar ausdrücklich das Gegenteil: „Die Schnittstelle nennt
JAHRESGEHALT oder STUNDENLOHN, aber keinen Betrag."

Gefunden nicht im Code, sondern beim rekursiven Durchsuchen einer echten
Antwort (`scripts/rohantwort-pruefen.mjs`). Nach der eigenen Annahme zu
programmieren heisst, ihre Lücken zu übernehmen.

**3. Die Quelle widerspricht sich selbst.**
Aus einer echten Antwort: `STUNDENLOHN` mit `60000–85000`. Verworfen
statt „korrigiert" — aus 60.000 pro Stunde 60.000 pro Jahr zu machen
wäre naheliegend und trotzdem geraten. Eine fehlende Angabe ist ehrlich;
eine sichtbar absurde Zahl beschädigt das Vertrauen in alle anderen.

## Die strukturelle Lücke dahinter

Der Nachtrag griff zuerst nicht: 248 geholt, **1 aktualisiert**.

Ursache: Der Inhalts-Hash erkennt Änderungen an der QUELLE, nicht an
UNSERER ZUORDNUNG. Blieb der Anzeigentext gleich, wurde nur `fetchedAt`
fortgeschrieben — jede Adapterverbesserung erreichte also ausschliesslich
Stellen, die danach neu eingelesen wurden. Die bestehenden blieben für
immer auf dem alten Stand, ohne dass irgendetwas fehlschlug.

Behoben: Bringt ein Lauf etwas mit, das der gespeicherte Datensatz nicht
hat, wird geschrieben. Danach 17 statt 1 aktualisiert; Anbieter-Gehälter
von 1 über 7 auf **24**.

## Das Signal, das bei jeder Zeile stand

Gemessen: **25 von 25** sichtbaren Karten trugen „Dünne Datenlage" —
alle dasselbe. Ein Hinweis bei jeder Zeile unterscheidet keine Zeile.

Die Ursache lag nicht bei den Anzeigen. `computeConfidence` mischt
`profile_coverage` (Gewicht 0,35 — Eigenschaft des NUTZERS) mit
`listing_completeness` (0,30 — Eigenschaft der STELLE). Bei leerem
Profil fällt die Sicherheit für jede Stelle unter die Schwelle. Die
Karte meldete das leere Profil, als wäre es ein Mangel der Anzeige.

Entfernt. Über 100 Stellen jetzt: **0 Warnungen, 5× „Vollständig
remote"** — das Signal lebt und trägt Information.

## Die ehrliche Obergrenze

Arbeitnow stellt 70 % des Bestands und hat **kein Gehaltsfeld**: slug,
company_name, title, description, remote, url, tags, job_types,
location, created_at. Nur 10 von 175 Anzeigen nennen einen Eurobetrag im
Text — den liest die Textextraktion bereits.

Die Gehälter fehlen dort also nicht durch unseren Fehler. Bei der
Bundesagentur schon, und dort sind sie jetzt da.

## Offen

- Adzuna, JSearch, TheirStack: Rohantworten noch nicht rekursiv geprüft.
  Dieselbe Methode, gleiche Chance auf denselben Fund.
- Ranking (§16–25) unverändert.
- Detail-Enrichment-Pipeline (§63–65) nicht gebaut.

---

# Nachtrag 2: die drei offenen Anbieter (01.09.)

1.027 Tests grün, Typecheck 17/17, Build grün, Migration 0026 angewendet.

## Adzuna warf Schätzungen weg

`salaryMin: predicted ? null : …`. Adzuna markiert eigene
Gehaltsschätzungen mit `salary_is_predicted`, und der Adapter setzte sie
auf `null`. Der Kommentar daneben behauptete, die Schätzung „wandert in
die Rohdaten und wird in der Oberfläche als solche ausgewiesen" —
**beides gab es nicht**: keine Rohdatenspalte, kein Anzeigepfad.

Dasselbe Muster wie bei der Bundesagentur: eine Absicht, die im
Kommentar steht und nirgends verdrahtet ist.

**Neu:** Herkunft `board_estimate` (Migration 0026). Der Betrag bleibt,
gilt aber nicht als offengelegt und erscheint als „Schätzung der
Jobplattform" — nicht grün, denn eine gerechnete Zahl ist keine Zusage
des Arbeitgebers.

Der Test, der das alte Wegwerfen festschrieb, wurde umgestellt statt
gestrichen: Sein Prinzip („eine Schätzung, die wie eine Zusage aussieht,
ist schlimmer als keine Angabe") gilt weiter — die neue Fassung erfüllt
es besser, weil die Zahl da ist und trotzdem nichts behauptet.

## Was der Fix hier nicht bringt

Ein Direktabruf gegen Adzuna DE: 20 Anzeigen, **null Gehaltsfelder** —
auch keine geschätzten. Die Korrektur ist richtig und greift, sobald
Adzuna welche liefert; im deutschen Bestand holt sie nichts zurück.

## JSearch, TheirStack, Jooble

Alle drei bilden Gehalt bereits ab (`job_min_salary`,
`min_annual_salary`, Freitextlesung). Kein zweiter Bundesagentur-Fall im
Code. Live-Abrufe habe ich nicht gemacht: JSearch rechnet je Anfrage ab,
TheirStack meldete zuletzt 402.

## Stand der Gehaltsabdeckung

    1.500 Stellen
       99 mit Betrag
       24 vom Anbieter   (vorher 1)
       75 aus dem Text

Die Obergrenze bleibt strukturell: Arbeitnow stellt 70 % des Bestands
und hat kein Gehaltsfeld.
