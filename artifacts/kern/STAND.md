# Phase 17 — Core Completion

Stand: 2. September 2026

## Was jetzt im Browser funktioniert

**33 von 33 Browser-Prüfungen grün** (`scripts/kern-pruefung.mjs`) — geklickt,
nicht behauptet.

### Unbekannt ist nicht mehr rot

Ein Modul (`lib/jobs/befundton.ts`) für vier Zustände, überall benutzt:

| Zustand | Farbe | Wann |
|---|---|---|
| POSITIV | grün | belegt erfüllt |
| TEILWEISE | violett | teilweise erfüllt |
| OFFEN | neutral | unbekannt, ungeprüft |
| KONFLIKT | **rot** | belegt verletzt |

`befundAusSicherheit()` kann **strukturell kein Rot erreichen** — ein Test hält
das fest. Vorher war `bg-critical` die Farbe für „niedrige Sicherheit", und auf
einer frischen Trefferliste war damit jede Zeile rot markiert: für eine Lücke
im eigenen Profil.

Gemessen: **0 rote Elemente** in der Liste und auf einem Job ohne Gehalt.

Auch gefunden und behoben: „Arbeitgeber nachvollziehbar: ✕" in Rot. Es hiess,
die Anzeige kam über einen Sammeldienst — und stand als Vorwurf gegen ein
Unternehmen, das nichts gemacht hat.

### Sprache

| vorher | jetzt |
|---|---|
| „Passung nicht berechenbar" | „Passung noch offen" |
| „Datenbasis zu dünn" | „Passung noch offen" |
| „Noch keine belegte Passung — dafür fehlen bestätigte Angaben." | „Sieht interessant aus — für eine belastbare Einschätzung kennt Nina dich noch nicht gut genug." |
| „Es liegen noch keine bestätigten Belege vor, an denen sich die Anforderungen messen liessen." | „Nina weiss noch nicht, was du kannst — dafür fehlt das Gespräch." |

### Netto-Rechner — im Job-Detail, aufklappbar

Zugeklappt steht sofort **Brutto → Netto**. Bei einer Spanne umschaltbar
zwischen unten, Mitte und oben. Aufgeklappt: Steuerklasse, Bundesland, Kinder,
Zusatzbeitrag, Kirchensteuer — und **acht Kostenfelder**, die live zu
„Dir bleiben ungefähr X €" führen.

Gemessen an einer echten Stelle: 110.000 € → **5.104 €** netto, nach 1.380 €
Fixkosten **3.724 €**.

### Arbeitsweg — echte Fahrzeit

Geocoding (Nominatim) und Routing (OSRM) hinter einer Provider-Abstraktion,
mit **Zwischenspeicher in der Datenbank** — eine Strecke wird genau einmal
erfragt. Gemessen: Karlsruhe → Waiblingen **77 Min., 94 km, 56 Std. im Monat**.

**Nur Auto.** Beim Testen fiel auf: Der öffentliche OSRM antwortet auf jedes
Profil mit derselben Autoroute — Karlsruhe → Stuttgart ergab dreimal „64
Minuten, 79,8 km" für Auto, Rad und zu Fuss. „Fahrrad: 64 Minuten" für achtzig
Kilometer hätte in der Oberfläche gestanden wie eine Auskunft. Rad und ÖPNV
erscheinen, sobald `ROUTING_URL` auf einen Dienst zeigt, der sie kann.

Ohne Wohnort steht ein Knopf, nicht nichts.

### Life Fit — Dimensionen, keine Note

Netto-Unterschied, Arbeitsmodell, Pendelzeit, Wochenstunden, Urlaubstage —
jeweils mit Vorzeichen. **Kein Prozentwert:** Er entstünde aus Gewichten, die
niemand gewählt hat.

### Liste

- **Ein** Knopf unten: „Weitere 25 Stellen". Keine Seitenzahl, kein Zurück,
  kein „25 von 719". Die Adresse trägt die ANZAHL — die Liste wächst, statt zu
  blättern, und die Scrollposition bleibt.
- **Dedup beim Lesen**: 1.489 → 1.428 Zeilen. Der Import dedupliziert gut, kommt
  aber nur an das, was durch ihn läuft.
- **„989 passende Stellen"** gross, die Rohzahlen klein daneben.
- **Filter-Chips** mit X zum Einzeln-Zurücknehmen.

### Quick Input

Eine kurze Eingabe ist ein Filter, kein Gespräch:

- Filter gesetzt · Feld geleert · kleine Bestätigung, die nach 4 s verschwindet
- **Kein Seitenchat** — der öffnet nur noch auf „Mit Nina besprechen"
- Der erledigte Vorschlag verschwindet, andere rücken nach
- Bei Unklarheit eine kleine Rückfrage an derselben Stelle

**Ein echter Fehler dabei gefunden:** Ein entprellter Effekt navigierte 350 ms
nach jeder Textänderung. Zusammen mit „Feld leeren" hiess das: Filter gesetzt,
Feld geleert, 350 ms später Effekt mit leerem Text → Filter wieder weg. Im
Browser: „Hab ich notiert: ab 45.000 €" und eine unveränderte Liste.

## Gehalt

### Die Kernursache

Jeder Adapter speicherte nur ein **handverlesenes Fragment** der Anbieterantwort.
Ein Feld, das niemand kannte, war damit unsichtbar — genau daran war die
Bundesagentur-Auswertung schon einmal gescheitert.

Jetzt speichert jeder Adapter die **vollständige Antwort**;
`scripts/gehalt-rohdaten.mjs` sucht darin rekursiv nach 25 Feldnamen und nach
Beträgen im Freitext.

### Was die Messung ergab

An 2.506 echten Anzeigen: **113 nannten einen Eurobetrag, den der Erkenner nicht
fasste.** Die häufigste Ursache war nicht das Zahlenmuster, sondern die Liste der
Gehaltswörter — sie kannte „Gehalt" und „Vergütung", aber nicht **„brutto"**,
das in deutschen Anzeigen am häufigsten dasteht:

```
„4.000 € BIS 5.000 € BRUTTO PRO MONAT"
„Was wir zahlen: 55.000 bis 75.000 EUR brutto im Jahr"
```

Ergänzt um `brutto`, `verdienst`, `bezahlung`. Die Gegenrichtung ist mit Tests
abgesichert: Prämie, Ticketzuschuss und betreutes Budget bleiben abgelehnt.

**Ergebnis: 6,5 % → 7,6 % Abdeckung**, 26 Anzeigen nachgetragen. Text ist mit
Abstand die ergiebigste Quelle — **155 von 190** Gehältern stammen daraus, nicht
aus Anbieterfeldern.

## Was NICHT umgesetzt ist — und warum

**Indeed- und StepStone-Anreicherung (§10, §11).** Beide laufen über
Apify-Actors, und die stehende Anweisung lautet: „Erstelle keine Scraper für
LinkedIn, Indeed, StepStone, Monster, XING, Glassdoor, Kununu,
Google-Suchergebnisse." Die Registry sperrt sie entsprechend
(`Apify: not allowed`). Dass dort Gehälter stehen, stimmt — abrufen darf ich sie
nicht. Das ist eine Freigabe-, keine Technikfrage.

**Marktspanne (§64).** Braucht lizenzierte Gehaltsdaten. Ohne sie wäre jede
„Marktspanne" eine erfundene Zahl neben einer echten.

**ÖPNV-Zeiten (§23).** Brauchen Fahrpläne (GTFS). Eine Autozeit mal Faktor wäre
eine erfundene Zahl an genau der Stelle, an der jemand entscheidet, ob er den
Weg täglich fährt.

## Geprüft

- **1.189 Unit-Tests**, **470 E2E** über fünf Viewports
- **33 Browser-Prüfungen** des laufenden Produkts
- Bilder: `jobs-core-final.png`, `jobs-salary.png`, `jobs-unknown-neutral.png`,
  `salary-calculator.png`, `commute-calculator.png`, `life-fit.png`,
  `quick-input-confirmation.png`, `load-more.png`

---

# Nachtrag: Herkunft der Gehaltszahl

## Warum das nötig war

„75.000 €" und „75.000 €" sehen gleich aus. Das eine hat ein Arbeitgeber in
seine Anzeige geschrieben, das andere hat ein Portal aus Stellentitel und
Region geschätzt. Wer mit der zweiten Zahl in eine Verhandlung geht,
verhandelt gegen etwas, das niemand zugesagt hat.

## Der Fehler, der dabei gefunden wurde

Die Zuordnung las `salary.disclosed ? "arbeitgeber" : …` — und `disclosed`
wird gesetzt, sobald irgendein ANBIETER ein Gehaltsfeld liefert. Damit bekam
jede Portalangabe das Etikett **„vom Arbeitgeber angegeben"**: die stärkste
Aussage, die dieses Produkt über eine Zahl machen kann, vergeben an eine Zahl
aus zweiter Hand.

Betroffen: **27 von 190** Gehältern.

## Die fünf Stufen

| Herkunft | im Detail | in der Liste | Zusage? | grün? |
|---|---|---|---|---|
| `employer` | vom Arbeitgeber angegeben | vom Arbeitgeber | ja | **ja** |
| `text` | in der Anzeige genannt | aus der Anzeige | ja | nein |
| `provider` | vom Stellenportal übernommen | laut Portal | nein | nein |
| `board_estimate` | vom Stellenportal geschätzt — keine Zusage | geschätzt | nein | nein |
| — | Herkunft unklar | Herkunft unklar | nein | nein |

**`text` zählt als Angabe, nicht als Schätzung.** Den Anzeigentext hat der
Arbeitgeber geschrieben — das ist etwas anderes als eine Portalschätzung. Grün
bekommt sie trotzdem nicht: gelesen ist nicht dasselbe wie zugesagt.

## Wo es steht

**In der Trefferliste** direkt an der Zahl, in zwei Wörtern:

```
63.000 € – 95.000 €  laut Portal
```

Nicht als eigene Zeile — die Herkunft gehört zu diesem Betrag und zu keinem
anderen. Nicht in Signalfarbe — eine Schätzung ist kein Fehler, nur eine
schwächere Auskunft. Zugesagte Zahlen bekommen einen leicht grünen Grund,
alles andere einen neutralen.

**Im Job-Detail** in der Überschrift über der Zahl, plus — nur bei einer Zahl
ohne Zusage — ein Satz darunter:

> Diese Zahl hat ein Stellenportal geschätzt — der Arbeitgeber hat sie nicht
> genannt. Nimm sie als Grössenordnung, nicht als Grundlage für eine
> Verhandlung.

Wo der Arbeitgeber selbst spricht, steht dort **nichts**. Ein Vorbehalt unter
jeder Zahl wäre nach der dritten Stelle unsichtbar.

## Geprüft

- **8 Unit-Tests** für die Zuordnung, darunter der Rückfall: eine Portalangabe
  darf nie „vom Arbeitgeber" heissen
- **8 Browser-Prüfungen** (`scripts/herkunft-gehalt-pruefung.mjs`) — je eine
  echte Stelle mit `employer`, `text` und `provider`
- Bilder: `gehalt-herkunft-liste.png`, `gehalt-herkunft-detail.png`

## Ein Hinweis zur Datenlage

`board_estimate` ist in den aktuellen Daten **nicht belegt** — Adzuna liefert
gerade fast keine Gehälter (1 von 133). Die Stufe ist umgesetzt und getestet,
aber im Bestand steht heute keine Zeile darauf. Ich habe keine erfunden, um
das Etikett vorführen zu können.

---

# Nachtrag: Ranking und Gehaltsschätzung

## Warum nichts rankte

`computeJobQuality` bezog vier seiner sechs Dimensionen ausschliesslich aus
**Mitarbeiterstimmen** — Belastung, Kultur, Entwicklung, Flexibilität. Die
haben wir für fast keine Stelle. Die höchste ohne sie erreichbare Abdeckung lag
bei **0,45**, die Schwelle bei **0,5**. Die Gesamtnote konnte also *strukturell
nie* zustande kommen, egal wie viel in einer Anzeige stand.

Gemessen an 1.200 echten Stellen: **1,5 % beurteilbar**. Und weil der
Gesamtwert die Passung mit 60 % gewichtet — ohne Profil ebenfalls `null` —
sortierte `cmpNullable` gar nichts. Die Liste stand in der Reihenfolge da, in
der die Datenbank sie lieferte. Für eine Seite namens „Deine besten
Möglichkeiten" die schlechteste denkbare Eigenschaft.

## Was jetzt zählt

Die Anzeige selbst — sie sagt mehr über Langfristigkeit, als sie durfte:

| Dimension | vorher | jetzt | Quelle |
|---|---|---|---|
| Offenheit der Anzeige | — | **0,15** | Gehalt, Stunden, Vertrag, Leistungen genannt? |
| Beschäftigungssicherheit | 0,15 | **0,20** | Vertragsart, ersatzweise Altersvorsorge |
| Arbeitszeit & Flexibilität | 0,15 | **0,20** | Arbeitsmodell, Schicht, Leistungen |
| Entwicklung | 0,15 | 0,15 | Stimmen, ersatzweise Weiterbildung |
| Einkommen | 0,20 | 0,10 | wie bisher |
| Belastung / Kultur | 0,40 | **0,20** | nur Stimmen |

Mitarbeiterstimmen behalten Vorrang, wo es sie gibt. Wo nicht, tritt die
Anzeige ein — mit **gedämpftem Wert** (0,5–0,8 statt 0–1), weil eine
Selbstauskunft weniger wert ist als eine Erfahrung. **Kultur bleibt bei den
Stimmen**: „Wir sind ein tolles Team" steht in jeder zweiten Anzeige und sagt
nichts.

**Ergebnis: 1,5 % → 69,4 % beurteilbar**, Spanne 43–87, Median 60,
Quartile 53/69.

## Und die Liste zeigt es

Ohne Profil stand bei jeder Stelle derselbe Strich. Jetzt trägt die
**Jobqualität** die Zahl, solange die Passung fehlt — mit eigenem Etikett
darunter („Qualität" / „Passung"), damit niemand beides verwechselt.

Die Sortierung fällt in einer Kette zurück: Gesamtwert → Jobqualität →
Aktualität. Jede Stufe ist eine echte Aussage, nur eine schwächere als die
davor. Im Browser geprüft: 87, 81, 80, 78, 77 — absteigend.

## Gehaltsschätzung: was geht und was nicht

**Der offizielle Weg ist zu.** Der Entgeltatlas der Bundesagentur hätte echte
Zahlen je Berufsgattung und Region. Er antwortet auf unsere Kennung mit **403**
und braucht eigene Zugangsdaten. Wenn du sie besorgst, ersetzt das diese
Schätzung durch amtliche Statistik — die Schnittstelle bleibt gleich.

**Was ohne sie geht:** ein Vergleichswert aus unserem eigenen Bestand, je
Berufsgruppe, aus den 190 Stellen, die eine Zahl nennen.

Zwei Regeln machen den Unterschied zwischen Auskunft und Rauschen:

**Höchstens zwei Werte je Arbeitgeber.** Ohne diese Kappung bestimmte ein
einziger Personalvermittler eine ganze Gruppe: 48 gleichlautende Anzeigen
„Steuerberater … mindestens 90.000 €" ergaben für `finance` einen Median von
110.000 € bei einer Quartilsspanne von **exakt null**. Jeder Buchhalter hätte
110.000 € geschätzt bekommen. Mit Kappung: sechs unabhängige Werte, Median
90.000, Spanne 50.000–110.000 — unschärfer und richtig.

**Kein Vollzeitvergleich für Werkstudium, Praktikum, Ausbildung.** Die
Berufsgruppe sagt, WAS jemand tut, nicht auf welcher Stufe. „Werkstudent
Vertrieb" bekam die Spanne der Vollzeitstellen im Vertrieb: 50.000–77.500 €.
Im Browser gefunden, bevor es jemand geglaubt hätte.

**Mindestens fünf unabhängige Angaben**, sonst steht nichts. Ein Median aus
drei Werten ist ein Zufallswert mit Nachkommastellen.

**Abdeckung: 71,4 %** der Stellen liegen in einer Gruppe mit tragfähiger Basis.
Für die übrigen steht „nicht angegeben" — kein erfundener Ersatz.

Angezeigt wird eine **Spanne** (mittlere Hälfte), nie ein Punktwert, immer mit
der Zahl der Vergleichsstellen und dem Satz: *„Das ist kein Gehalt dieser
Stelle, sondern eine Grössenordnung für das Gespräch."* Neben einer echten
Angabe erscheint sie **nicht** — dort wäre sie Lärm und lüde zur Verwechslung
ein.

## Geprüft

- **1.191 Unit-Tests**, **470 E2E**, **33/33 Kern-Prüfungen**
- **11 Browser-Prüfungen** für Vergleichswert und Ranking
- Bilder: `gehalt-vergleichswert.png`, `jobs-core-final.png`

---

# Nachtrag: die restlichen 28 %

## Was ich versucht habe

Beide amtlichen Quellen sind zu — geprüft am 2.9.2026, nicht vermutet:

| Quelle | Antwort |
|---|---|
| BA Entgeltatlas (mit Jobsuche-Kennung) | **403** |
| BA Entgeltatlas (ohne Kennung) | **403** |
| BA OAuth `gettoken_cc` | **403** |
| Destatis GENESIS `catalogue/tables` (GAST) | HTML statt Daten |
| Destatis GENESIS `data/table` (GAST) | HTML statt Daten |
| Destatis GENESIS `helloworld/whoami` | 200 — der Host stimmt, der Gastzugang ist abgeschaltet |

Beide sind kostenlos und registrierungspflichtig. Ich erfinde keine
Zugangsdaten und keine Zahlen.

## Was trotzdem besser wurde

**Monats- und Stundenangaben zählen jetzt mit.** Die erste Fassung nahm nur
Jahresangaben und warf damit 61 von 190 Gehältern weg — 46 monatliche und 15
stündliche. Ein Monatsgehalt mal zwölf ist keine Schätzung, sondern dieselbe
Zahl in anderer Einheit.

| Gruppe | Werte vorher | jetzt |
|---|---|---|
| administration | 5 | **16** |
| operations | 13 | **16** |
| sales | 12 | **15** |
| customer_success | 7 | **11** |
| logistics | 7 | **10** |

Ein Median aus fünf Werten ist ein Zufall mit Nachkommastellen; einer aus
sechzehn ist eine Aussage. Die **Abdeckung bleibt bei 71,4 %** — die dünnen
Gruppen bleiben dünn —, aber die vorhandenen Werte sind deutlich belastbarer.

Stundenlöhne ohne Wochenstundenangabe werden verworfen, nicht hochgerechnet:
Mit vierzig zu unterstellen läge bei einer Teilzeitstelle um die Hälfte daneben.

## Der Weg zu 100 % ist gebaut

`lib/jobs/entgeltatlas.ts` ist ein **vollständiger Client**, kein Platzhalter:
OAuth-Token mit Zwischenspeicher, Abfrage je Berufsgattung, Umrechnung aufs
Jahr, dieselbe Rückgabeform wie die eigene Statistik. Keine Zugangsdaten im
Protokoll — nur Statuscodes.

Er schaltet sich ein, sobald zwei Werte in `.env.local` stehen:

```
ENTGELTATLAS_CLIENT_ID=
ENTGELTATLAS_CLIENT_SECRET=
```

Registrierung: kostenlos über die Bundesagentur (Link steht in
`.env.example`). Danach gibt es Medianentgelte für praktisch jeden Beruf,
Region und Altersgruppe — die eigene Statistik bleibt als Rückfall.

**Das ist der einzige Schritt, den ich nicht selbst gehen kann.**

## Was bis dahin dasteht

Für die 28,6 % ohne Basis **keine Zahl**, sondern der Grund:

> Für diese Art von Stelle liegen uns noch zu wenige Gehaltsangaben vor, um
> eine Grössenordnung zu nennen. Sobald mehr Anzeigen dieser Berufsgruppe eine
> Zahl nennen, steht sie hier — geschätzt wird nichts.

Der Satz sagt beides: dass wir nichts haben, und dass es an der Datenmenge
liegt und nicht an der Stelle. Und er ist selbstheilend — mit jedem Import,
der neue Gehälter mitbringt, überschreiten weitere Gruppen die Schwelle.

## Geprüft

- **14 Browser-Prüfungen** (`scripts/vergleich-pruefung2.mjs`), darunter je
  eine Stelle mit Vergleichswert, ohne Basis, mit eigener Angabe und ein
  Werkstudium
- **1.191 Unit-Tests**, **470 E2E**, **33/33 Kern-Prüfungen**

---

# Nachtrag II: der Atlas, ganz ausgebaut

Der vorige Nachtrag endete bei: *„Der Weg ist gebaut, es fehlt nur ein
Schlüssel."* Das stimmte — und war trotzdem zu wenig. Ein Client, den niemand
aufruft, weil niemand ihm einen Berufsschlüssel liefert, ist genau die Sorte
unverdrahteter Absicht, die dieses Projekt sonst überall aufräumt.

## Was beim Nachsehen herauskam

Nicht vermutet, sondern die Schnittstellen einmal gefragt
(`scripts/quellen-pruefung.mjs`, jederzeit wiederholbar):

| Quelle | Antwort |
|---|---|
| Jobsuche — Stellen | **200, JSON** |
| Jobsuche — Berufsvorschläge | 403 |
| Entgeltatlas — Entgelte, Token | 403 |
| Berufenet | 404 |
| GENESIS — Gastzugang | 200, aber HTML statt Daten |

Die amtlichen Statistiken bleiben zu. Aber die **offene Jobsuche derselben
Behörde** beantwortet beide Fragen, die der Atlas beantwortet hätte:

1. Jede Anzeige trägt `hauptberuf` — die **amtliche Berufsbezeichnung**.
   Unser Bestand hat 2.092 verschiedene freie Titel; darauf lässt sich nichts
   vergleichen. Amtliche Bezeichnungen sind wenige hundert.
2. **29 % ihrer Anzeigen tragen ein echtes Gehalt** (233 von 800 gemessen).

Damit ist die Lücke ohne Zugangsdaten zu schliessen — mit echten Angaben
echter Arbeitgeber, aggregiert, nie einzeln gezeigt.

## Was gebaut wurde

**Ein übersehenes Feld.** Der BA-Adapter las nur `gehaltsspanneVon/Bis`. Die
Jobbörse kennt einen zweiten Weg: `artDerVerguetung: "FESTGEHALT"` mit einer
Zahl in `festgehalt`. Gemessen an 80 Anzeigen mit Betrag: 55 Spannen, **25
Festbeträge** — knapp ein Drittel fiel still weg.

**Titel → amtlicher Beruf** (`berufsregeln.ts`, `berufsreferenz.ts`). Die
Übersetzung macht die Suchmaschine der Jobbörse, nicht eine Wortliste. Mit
Stufenleiter von genau nach allgemein: „finanzbuchhalter - memmingen" fand
fünf Anzeigen, „finanzbuchhalter" findet 98 von 100. Trefferquote dadurch von
50 % auf **72 %**.

**Referenz je Beruf** (`beruf_entgelt`). Quartile über echte Angaben,
höchstens zwei je Arbeitgeber, mindestens acht Werte — sonst nichts.

**Drei Quellen, in dieser Reihenfolge:** Entgeltatlas (sobald Zugangsdaten da
sind) → Referenz nach amtlichem Beruf → eigener Bestand nach grober
Berufsgruppe. Fällt alles aus, steht nichts da.

**Die Herkunft steht dabei.** Ein amtlicher Median und eine Auswertung aus
elf Anzeigen sind nicht dasselbe. Beide als „Vergleichbare Stellen" zu zeigen
hiesse, den Unterschied zu verstecken.

**In der Liste, nicht nur im Detail.** Wer eine Liste überfliegt, überfliegt
sie nach Zahlen. Eine Sammelabfrage für die sichtbaren Zeilen, kein Aufruf je
Zeile — und die Spanne trägt „Marktspanne", damit sie nicht wie eine Zusage
aussieht.

**Der Worker hält es frisch.** Zwölf Titel und drei Berufe je Durchlauf, alle
fünfzehn Minuten. Neue Anzeigen sind binnen Stunden abgedeckt, ohne dass
jemand etwas anstösst. Eine Abdeckung, die nur am Einrichtungstag stimmt, ist
keine.

**Der Schlüssel für den Atlas** (`berufsschluesselFuer`). Er fragt nach
„43414", nicht nach „Softwareentwickler/in". Übersetzen kann nur er selbst —
eine öffentliche Umschlüsselung gibt es nicht. Zwei plausible Pfade werden
versucht, beide Misserfolge still hingenommen, das Ergebnis behalten. Welcher
Pfad richtig ist, lässt sich hinter einem 403 nicht feststellen; das steht so
im Code und nicht als Zusicherung.

## Ein Fehler, der nebenbei auffiel

Die Sperre gegen Vollzeitspannen für Werkstudenten war auf Deutsch
geschrieben und begann mit `\b`. Beides hat gekostet:

- **54 Stellen rutschten durch** — die meisten heissen „Working Student". Der
  Bestand ist zweisprachig, die Sperre war es nicht. Dazu jedes
  „Pflichtpraktikum" (`\bpraktik` greift nicht in der Wortmitte) und jedes
  „Werkstudium".
- Umgekehrt fing `master` echte Vollzeitstellen: „Scrum Master", „Master Data
  Specialist", „Masterplaner Logistik".

Gefunden nicht beim Lesen, sondern beim Messen gegen alle 2.506 Titel.

## Gemessen, nachdem alles lief

Der Sammellauf hat 1.653 Titel aufgelöst (**1.088 zugeordnet**, 66 %) und für
**132 von 233 Berufen** eine Referenz gebildet. 2.092 freie Titel wurden zu
**236 amtlichen Berufen** — das ist der Grund, warum es überhaupt funktioniert.

| | Stellen | Anteil |
|---|---:|---:|
| Gehalt in der Anzeige | 190 | 7,6 % |
| Referenz nach amtlichem Beruf | 1.021 | 40,7 % |
| Vergleich nach eigener Berufsgruppe | 636 | 25,4 % |
| **mit Grössenordnung** | **1.847** | **73,7 %** |
| studentisch — bewusst keine | 319 | 12,7 % |
| ohne Grundlage | 340 | 13,6 % |

**Von den nicht-studentischen Stellen: 84,5 %.** Vorher gab es für diese
Stellen nur die grobe Berufsgruppe, und die reichte in 28,6 % der Fälle nicht.

Die Streuung ist das beste Argument dafür, dass die Zahlen stimmen — eine
kaputte Aggregation erzeugt sie nicht:

| Beruf | Q1 | Median | Q3 | n |
|---|---:|---:|---:|---:|
| Verkäufer/in | 28.125 | 28.200 | 29.460 | 14 |
| Telefonist/in | 28.106 | 29.460 | 30.625 | 17 |
| Zweiradmechaniker/in | 31.960 | 33.426 | 34.500 | 14 |
| Speditionskaufmann/-frau | 33.765 | 39.000 | 43.200 | 28 |
| Softwareentwickler/in | 52.000 | 56.500 | 62.000 | 11 |
| Vertriebsingenieur/in | 57.500 | 65.000 | 80.000 | 18 |
| Wirtschaftsinformatiker/in | 65.000 | 73.000 | 80.000 | 10 |
| Steuerberater/in | 82.500 | 90.000 | 92.500 | 9 |

Die verbleibenden 13,6 % sind grösstenteils englische oder sehr breite Titel
(„head of finance data", „sales and market support"): Die Jobbörse findet
hundert Treffer, aber keinen überwiegenden Beruf. Dort steht weiterhin der
Grund statt einer Zahl — eine falsche Zuordnung wäre teurer als eine Lücke.

## Was noch offen ist

Der Entgeltatlas bleibt der bessere Wert — amtliche Beschäftigungsstatistik
statt Auswertung von Anzeigen. Er braucht `ENTGELTATLAS_CLIENT_ID` und
`ENTGELTATLAS_CLIENT_SECRET` in `.env.local`. **Das ist der einzige Schritt,
den ich nicht selbst gehen kann.** Alles davor und danach ist gebaut.
