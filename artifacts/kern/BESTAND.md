# Warum 2.000 Stellen — und was daraus wurde

## Die Frage

> „warum haben wir nur 2.000 jobs und linkedin 20 millionen"

## Die kurze Antwort

Nicht wegen einer Sperre und nicht wegen einer Schnittstelle. Wegen **fünf
Wörtern.**

In `bundesagentur.ts` stand eine Liste mit fünf Suchbegriffen —
„Sachbearbeitung", „Kundenbetreuung", „Disposition", „Büromanagement",
„Vertriebsinnendienst". Der Adapter fand, wonach er fragte, und gefragt hat er
nach fünf Dingen. Dazu holte er je Begriff **genau eine Seite**.

Die Jobbörse der Bundesagentur führt **999.398 Anzeigen**. Wir hatten 327
davon.

## Was gesperrt bleibt

LinkedIn, Indeed, StepStone, XING, Glassdoor, Kununu: kein Scraper, keine
Umgehung von Sperren. Daran ändert sich nichts, und keine der folgenden
Änderungen berührt sie.

Es war auch nie nötig. Die Bundesagentur ist eine offene, dokumentierte
Schnittstelle mit öffentlicher Kennung — dieselbe, über die dieses Produkt
ohnehin Stellen bezieht.

## Was geändert wurde

**Blättern statt einer Seite.** Gemessen: `size=100` wird bedient, `page` trägt
bis 100, ab 200 kommt ein 400. Also 10.000 Anzeigen je Suchbegriff statt 50.

**Reihum, nicht ein Begriff bis zum Anschlag.** Erst Seite 1 für alle Begriffe,
dann Seite 2 für alle. Wird ein Lauf abgebrochen, enthält der Zwischenstand
alle Berufe und nicht zehntausend Elektroniker.

**Der Wortschatz kommt aus der Datenbank.** Die 236 amtlichen
Berufsbezeichnungen aus `beruf_zuordnung` — das eigene Vokabular der Jobbörse,
mit dem sie jede Anzeige verschlagwortet. Ein selbst ausgedachter Wortschatz
hätte dieselbe Schwäche in grösser: Er bildet ab, woran der Autor gedacht hat.

**Vier Detailabrufe gleichzeitig.** Jede Anzeige braucht ihren Volltext; einzeln
nacheinander waren das 0,43 Sekunden pro Anzeige. Keine Umgehung einer
Taktgrenze — `holJson` staffelt bei 429 von selbst zurück. Ergebnis: 4,2 statt
0,9 Anzeigen je Sekunde.

**Adzuna blätterte gar nicht.** Die Adresse endete auf `/search/1`. Ein Abruf
mit Limit 400 holte 50 Anzeigen, der nächste dieselben 50. Mit Blättern: 500
neue in einem Lauf.

## Drei Fehler, die dabei sichtbar wurden

**Stundenlöhne fielen still aus dem Bestand.** `salary_min` war eine
Ganzzahlspalte, und Stundenlöhne sind krumm — der Mindestlohn ist 12,82 €.
Jede solche Anzeige scheiterte mit „invalid input syntax for type integer".
Gefunden an zwei von 400 Anzeigen eines echten Laufs. Migration 0034.

**Der Aufbaulauf holte dreimal dasselbe.** Jeder Abschnitt begann wieder bei
Suchwort 1, Seite 1. Abschnitt 1 brachte 1.598 neue Stellen, Abschnitt 2 genau
drei, Abschnitt 3 genau zwei — und jeder meldete „1.999 geholt". Zwanzig
Minuten für fünf Anzeigen, und nichts sah nach einem Fehler aus.

**Die Stellenliste lud den ganzen Bestand — je Aufruf und je Person.**

## Der Fund, der am meisten wog

Gemessen im laufenden Server:

    [messung] 5425 Stellen · Abfragen 6578 ms · Bewerten 107 ms

Das Bewerten war nie das Problem. Es war die Menge, die über die Leitung ging:
`description_tokens` allein sind 10 MB, und `computeFit` braucht sie wirklich.

Diese Zeilen hängen von keiner Person ab — es sind für jede angemeldete Person
dieselben. Der bestehende Zwischenspeicher lag eine Ebene zu hoch, nämlich
hinter der Bewertung, und war deshalb je Person eigen.

Jetzt: ein gemeinsamer Bestandsspeicher, zwei Minuten Frist, und der
abgelaufene Stand geht sofort raus, während daneben nachgeladen wird. Sonst
träfe die volle Ladezeit genau eine Person — die, die zufällig als erste nach
Ablauf kommt.

| | vorher | nachher |
|---|---:|---:|
| erster Aufruf nach Serverstart | 8,6 s | 5,4 s |
| jeder weitere Nutzer | 8,6 s | **1,2 s** |
| Abfragen je Aufruf | 6.578 ms | **3 ms** |

## Was nicht ich lösen kann

- **Jooble** antwortet mit 403 — der Schlüssel gilt nicht mehr.
- **TheirStack** antwortet mit 402: „Team has no api credits left".

Beides sind Kontosachen. Ich melde sie und rühre sie nicht an.

**Arbeitnow ist wirklich erschöpft**, nicht gedeckelt: Der Feed endet vor Seite
25, geprüft bis Seite 200.

---

# Nachtrag: der Wortschatz war der Zirkelschluss

## Der Befund

Die Suchbegriffe für die Jobbörse stammten aus `beruf_zuordnung` — also
aus den Berufen, die unser Bestand **schon enthielt**. Wir fanden nur, wonach
wir suchten, und wir suchten nur nach dem, was wir schon gefunden hatten.

Gemessen über alle 236 so gewonnenen Bezeichnungen:

| | |
|---|---:|
| Treffer aufsummiert | 808.309 |
| davon erreichbar (10.000 je Begriff) | 573.662 |
| Gesamtbestand der Jobbörse | 999.398 |

Über 400.000 Anzeigen lagen hinter Begriffen, nach denen nie jemand gefragt
hatte. Nichts daran sah nach einem Fehler aus — ein kleinerer Bestand sieht
aus wie ein Arbeitsmarkt mit wenig Angebot.

## Der Weg, den ich nicht gegangen bin

Das amtliche Verzeichnis direkt zu laden wäre kürzer gewesen. Der
Klassifikationsserver des Statistischen Bundesamts verbietet den
Download-Pfad aber in seiner `robots.txt`:

```
Disallow: /klassService/thyme/variant/download/
```

Sperren werden hier nicht umgangen, auch nicht für einen guten Zweck. Liegt
die Datei einmal von Hand daneben, liest `beruf_wortschatz` sie mit
`quelle = 'kldb'` ein.

## Der Weg, der ging

Jede Anzeige der Jobbörse trägt `hauptberuf` **und** `alleBerufe` — Begriffe
aus der Klassifikation der Berufe, mit denen die Jobbörse ihren eigenen
Bestand verschlagwortet. Wer blätternd liest, sammelt sie ein.

| Schritt | Bezeichnungen |
|---|---:|
| aus dem eigenen Bestand (vorher) | 236 |
| 700 Anzeigen ohne Suchwort gelesen | 413 |
| 100 Seiten breit gelesen | 1.733 |
| eine Abschlussrunde (400 Begriffe nachgefragt) | **2.629** |

Zwei Durchgänge: breit lesen findet, was häufig ist; den Abschluss bilden
erreicht die Nischen, die im breiten Lesen nie vorkommen. Ende, wenn eine
Runde nichts Neues bringt.

## Eine Zahl, die ich zurückgenommen habe

Das Skript meldete zunächst „Erreichbar: 23.511.862 Anzeigen". Das ist die
Summe der Trefferzahlen über alle Begriffe — und dieselbe Anzeige zählt unter
jedem ihrer Berufe mit. Der gesamte Bestand der Jobbörse sind 999.398.

Die Zahl stand formatiert und mit Tausenderpunkten da und war um das
Dreiundzwanzigfache falsch. Sie sagt trotzdem etwas: Solange die Summe den
Gesamtbestand weit übersteigt, ist nicht der Wortschatz der Engpass.

## Reihenfolge nach Ergiebigkeit

`beruf_wortschatz.anzeigen` hält fest, wie viele Anzeigen die Jobbörse zu
einem Begriff kennt. Die Importe bekommen die grössten zuerst — gleicher
Aufwand je Anfrage, mehr Ertrag, und ein abgebrochener Lauf hat trotzdem die
ergiebigen Begriffe erwischt.
