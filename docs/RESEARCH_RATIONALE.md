# Forschungsgrundlage

Diese Datei trennt drei Dinge, die sonst gern verschwimmen:

- **Forschung** — was in der Literatur belastbar erscheint
- **Produktannahme** — was wir daraus gemacht haben, mit Begründung
- **Offene Hypothese** — was noch zu validieren wäre

Marketingversprechen entstehen daraus keine. Wo eine Aussage nicht belegt
ist, steht das hier so.

---

## 1. Gute Jobsuche ist mehr als Bewerbungsmenge

**Forschung.** Der Erfolg einer Jobsuche hängt nicht allein an der Zahl
der Bewerbungen, sondern auch an Suchqualität, Selbstregulation,
Zielklarheit und daran, ob aus Ergebnissen gelernt wird.

**Produktannahme.** Die Nordstern-Kennzahl misst *qualifizierte
Fortschrittsereignisse* pro aktiviertem Menschen — bestätigte Zielrolle,
gespeicherte Stelle mit hoher Passung, hochwertige Bewerbung, Gespräch,
Angebot, positiver 90-Tage-Fit. Nicht die Bewerbungszahl.

Der Funnel Debugger empfiehlt deshalb nie „bewirb dich mehr". Bei vielen
Bewerbungen ohne Gespräch schlägt er vor, Zielrollen, Seniorstufe und
Unterlagen zu prüfen — in dieser Reihenfolge.

**Offene Hypothese.** Ob unser Gesprächsformat die Zielklarheit
tatsächlich erhöht, ist nicht gemessen. Dafür bräuchte es eine
Längsschnittstudie mit Kontrollgruppe.

---

## 2. Jobqualität ist mehrdimensional

**Forschung.** Die OECD fasst Jobqualität über mindestens drei
Dimensionen: Einkommensqualität, Beschäftigungssicherheit und
Arbeitsumfeld. Ein Gehalt allein beschreibt einen Arbeitsplatz nicht.

**Produktannahme.** Ein eigener Job-Quality-Score über sechs Dimensionen,
**getrennt** vom Fit. Eine Stelle kann fachlich perfekt passen und ein
schlechter Arbeitsplatz sein — beides in eine Zahl zu rühren würde genau
die Information zerstören, die zählt.

Die Gewichtung (20/20/15/15/15/15) ist eine begründete Annahme, keine
Messung. Sie steht offen auf `/methodology`.

**Offene Hypothese.** Ob unsere sechs Dimensionen die für diese
Zielgruppe entscheidenden sind, ist nicht validiert. Für
Berufseinsteiger könnten Einarbeitung und Lernumfeld schwerer wiegen als
angenommen.

---

## 3. KI verändert Aufgabenbündel, nicht Berufe

**Forschung.** Die ILO arbeitet mit einem Index für die
Aufgabenexposition von Berufen gegenüber generativer KI. Die
fachlich tragfähigen Kategorien sind **Transformation** und
**Augmentation** — nicht pauschale Berufsersetzung.

**Produktannahme.** Das AI Transition Radar bewertet die Aufgaben der
konkreten Rolle. Derselbe Jobtitel kann zu 70 % aus standardisierbarer
Informationsarbeit bestehen oder zu 70 % aus Aushandlung mit Menschen.

Ausgegeben werden Szenarien, nie eine Prognose mit Jahreszahl. Eine
Jahreszahl klingt konkret und ist geraten — sie beeinflusst eine
Lebensentscheidung auf einer Grundlage, die es nicht gibt.

**Offene Hypothese.** Unsere Einordnung beruht auf Merkmalen des
Aufgabentexts, nicht auf einer validierten Studie zur konkreten Rolle.
Das ist eine Heuristik. Sie steht als solche in
[MATCHING.md](MATCHING.md) unter „Grenzen".

---

## 4. Skills brauchen standardisierte Taxonomien

**Forschung.** ESCO (europäisch) und KldB 2010 (Deutschland) bilden
Berufe, Tätigkeiten und Fähigkeiten strukturiert ab. Ohne solche
Abbildung bleibt jede Suche an Jobtiteln hängen — und Jobtitel sind
uneinheitlich.

**Produktannahme.** Adapter für ESCO und KldB sind vorgesehen. Die
mitgelieferte Taxonomie ist **klein und als `internal` gekennzeichnet**;
die offiziellen Datensätze unterliegen eigenen Nutzungsbedingungen und
müssen aus der Quelle geladen werden.

**Offene Hypothese.** Der heutige Abgleich arbeitet mit
Wortüberlappung. Eine anders formulierte, gleichbedeutende Erfahrung kann
übersehen werden. Semantische Suche über `pgvector` ist vorgesehen, aber
nicht umgesetzt — das ist die wichtigste offene Lücke im Matching.

---

## 5. Eignungsdiagnostik braucht Validierung

**Forschung.** DIN 33430 stellt Anforderungen an berufsbezogene
Eignungsbeurteilung: transparente Anforderungen, nachvollziehbare
Auswertung, geprüfte Verfahren.

**Produktannahme.** Die Micro-Work-Samples sind **freiwillig**, zeigen
Zweck und Bewertungsraster **vorher**, dauern drei bis fünf Minuten und
lassen sich ablehnen oder löschen. Ausgewertet wird entlang offen
gezeigter Kriterien: Struktur, Begründung, Verständlichkeit, Umgang mit
Unsicherheit.

**Was ausdrücklich nicht behauptet wird.** Keine DIN-33430-Konformität,
keine wissenschaftliche Validierung, keine diagnostische Aussage. Das
Ergebnis ist ein Gesprächsanlass, keine Eignungsfeststellung — und es
steht so in der Oberfläche.

---

## 6. Bewerbungsunterlagen brauchen Zuschnitt und Belege

**Forschung.** Die Bundesagentur für Arbeit empfiehlt Unterlagen, die auf
die Stelle zugeschnitten und durch konkrete Erfahrungen belegt sind.

**Produktannahme.** Der Grundsatz *Evidence before eloquence*: jede
prüfbare Aussage in einem erzeugten Dokument hängt an bestätigter
Evidenz. Ohne Beleg wird sie markiert, und die Freigabe ist **gesperrt**
— nicht gewarnt.

Anschreiben werden nur vorgeschlagen, wenn die Stelle eines verlangt oder
es erkennbar hilft. Eines zu schreiben, das niemand verlangt hat, kostet
Zeit.

---

## 7. Barrierefreiheit gilt auf allen Geräten

**Forschung.** WCAG 2.2 AA, einschließlich der neueren Kriterien zu
Zielgröße und Accessible Authentication.

**Produktannahme.** Vollständige Tastaturbedienung, sichtbare
Fokuszustände, semantische Überschriften, Beschriftungen, ausreichende
Kontraste in beiden Darstellungen, Reduced Motion, Beruhrungsziele von
mindestens 44 Pixeln, Fehler am Feld **und** als Zusammenfassung.

Automatisch geprüft mit axe über alle Hauptseiten; Tastaturbedienung,
Überschriftenhierarchie und Zielgrößen zusätzlich in eigenen Tests.

**Offene Hypothese.** axe findet einen Teil der Verstöße. Ein Test mit
Screenreader-Nutzenden hat nicht stattgefunden. Siehe
[ACCESSIBILITY.md](ACCESSIBILITY.md).

---

## 8. Datenschutz verlangt Zweckbindung und Kontrolle

**Forschung.** Die DSGVO verlangt Zweckbindung, Datenminimierung,
Nutzerkontrolle und Transparenz über externe Verarbeitung.

**Produktannahme.** Sieben getrennte Einwilligungen, vollständiger
Export, zweistufige Löschung mit benannter Frist, Row Level Security in
der Datenbank, Datenminimierung vor jeder externen Verarbeitung.

Und der Satz, der oft fehlt: **eine eigene Datenbank bedeutet nicht
automatisch, dass keine Daten einen externen Anbieter erreichen.** Der
tatsächliche Zustand wird zur Laufzeit gelesen und angezeigt.

---

## 9. KI im Beschäftigungskontext braucht Governance

**Forschung.** Der EU-Rechtsrahmen für KI behandelt den
Beschäftigungskontext gesondert. Menschliche Kontrolle,
Zweckbestimmung und Dokumentation sind zentral.

**Produktannahme.** Positionierung als kandidatenkontrollierte
Assistenz. Nicht Teil des Produkts: Ranking von Personen für Arbeitgeber,
automatische Ablehnung, automatisierte Auswahl, biometrische oder
emotionale Bewertung, Ableitung besonderer Kategorien.

Dokumentiert sind Zweckbestimmung, Grenzen, menschliche Aufsicht,
Datenquellen, Bewertungslogik, Testfälle und bekannte Risiken.

**Was nicht behauptet wird.** Eine Konformitätsbewertung hat nicht
stattgefunden. Diese Dokumentation ist eine Vorbereitung darauf.

---

## Referenzen zur Nachprüfung

Diese Quellen sind der Ausgangspunkt. Sie wurden im Rahmen dieses Baus
**nicht abgerufen** — die Prinzipien oben stammen aus dem Auftrag und
sind hier eingeordnet, nicht daraus zitiert.

- OECD, Job Quality — https://www.oecd.org/en/topics/job-quality.html
- ILO, Generative AI and Jobs — https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure
- ESCO — https://esco.ec.europa.eu/en/about-esco/what-esco
- KldB 2010 — https://statistik.arbeitsagentur.de/DE/Navigation/Grundlagen/Klassifikationen/Klassifikation-der-Berufe/KldB2010-Fassung2020/KldB2010-Fassung2020-Nav.html
- DIN 33430 — https://www.dinmedia.de/de/norm/din-33430/254909784
- Bundesagentur für Arbeit, Bewerbungsunterlagen — https://www.arbeitsagentur.de/bildung/bewerbung/bewerbungsunterlagen
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- DSGVO — https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32016R0679
- EU-Rechtsrahmen für KI — https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- Google Places, Richtlinien — https://developers.google.com/maps/documentation/places/web-service/policies
