# Matching und Bewertung

Alles hier steht in `packages/matching` und ist durch Unit-Tests
abgesichert. Wer die Regeln ändert, ändert die Tests mit — sie sind der
eigentliche Vertrag.

## Der Grundsatz: Unbekanntes ist neutral

Das ist die wichtigste Entscheidung im ganzen Bewertungssystem.

Ein Faktor ohne Daten wird **nicht** als 0 gewertet. Sein Gewicht wird
anteilig auf die bekannten Faktoren verteilt (`weighted.ts`). Das Fehlen
schlägt sich ausschließlich in der **Abdeckung** nieder, und die fließt
in die **Confidence**, nie in den Fit.

```
Alle Faktoren bekannt (je 0.8, je 50 %)   → Wert 0.8, Abdeckung 1.0
Einer unbekannt (0.8 bekannt, 50 %)       → Wert 0.8, Abdeckung 0.5
```

Warum das zählt: Stellenanzeigen sind fast immer unvollständig. Würde
Unbekanntes als 0 zählen, wäre die Rangfolge vor allem eine Rangfolge der
Anzeigenqualität — nicht der Passung.

## Reihenfolge der Prüfung

```
1. Harte Bedingungen        → eligible | uncertain | blocked
2. Fit                      → 0–100 oder ein Band
3. Confidence               → 0–100, getrennt vom Fit
4. Job Quality              → 0–100 oder "nicht beurteilbar"
5. AI Transition            → Kategorie plus Szenarien
6. Listing Confidence       → 0–100
7. Gesamtranking            → nur wenn genug bekannt ist
```

## 1. Harte Bedingungen

Geprüft werden Arbeitserlaubnis, Pflichtlizenzen, Sprache, Arbeitsmodell,
Arbeitsweg, Mindestgehalt, Schichtarbeit, Reiseanteil, Vertragsart,
Arbeitszeit und Startdatum.

Drei Ausgänge, und der mittlere ist der wichtigste:

| Ergebnis | Bedeutung |
|---|---|
| `eligible` | Die Stelle erfüllt die Bedingung nachweislich |
| `uncertain` | Die Anzeige sagt nichts dazu — **kein Ausschluss** |
| `blocked` | Die Stelle widerspricht der Bedingung nachweislich |

`uncertain` wird nie zu `blocked` hochgestuft. Eine Anzeige ohne
Gehaltsangabe fliegt nicht raus; sie erzeugt eine vorbereitete Rückfrage.

Beim Gehalt zählt die Obergrenze der Spanne: erreicht sie das Minimum,
ist Verhandlung möglich, und die Stelle bleibt sichtbar.

## 2. Fit

Sieben Faktoren, Startgewichtung als begründete Annahme:

| Faktor | Gewicht |
|---|---|
| Belegte Fähigkeiten und Qualifikationen | 30 % |
| Tätigkeiten, die Energie geben | 20 % |
| Arbeitsweise und Umfeld | 15 % |
| Werte und Motive | 10 % |
| Entwicklungspotenzial | 10 % |
| Umsetzbarkeit | 10 % |
| Ausdrückliches Interesse | 5 % |

Regeln:

- Muss-Anforderungen wiegen dreifach gegenüber Kann-Anforderungen.
- Nur **bestätigte** Evidenz zählt. Eine unbestätigte KI-Hypothese trägt
  nichts bei — `isConfirmedFact()` entscheidet das an einer Stelle.
- Gewichte lassen sich in festgelegten Grenzen verschieben
  (`WEIGHT_BOUNDS`), danach wird auf Summe 1 normalisiert.
- Unter 55 % Abdeckung erscheint keine Zahl, sondern ein Band:
  „hohe", „mittlere", „explorative" Passung oder „Datenbasis zu dünn".

Jedes Ergebnis trägt einen **topReason** und einen **topReservation** —
letzteren immer, auch bei guter Passung.

## 3. Confidence

Steht neben dem Fit, nie darin.

| Faktor | Gewicht |
|---|---|
| Profilabdeckung | 35 % |
| Vollständigkeit der Anzeige | 30 % |
| Quellenqualität und Aktualität | 20 % |
| Externe Unternehmensinformationen | 15 % |

`reducedBy` listet in ganzen Sätzen, was die Sicherheit senkt — damit der
Mensch weiß, was er dagegen tun kann.

## 4. Job Quality

Sechs Dimensionen, nach der mehrdimensionalen Sicht auf Jobqualität
(siehe [RESEARCH_RATIONALE.md](RESEARCH_RATIONALE.md)):

| Dimension | Gewicht |
|---|---|
| Einkommensqualität und Fairness | 20 % |
| Arbeitsbelastung und Arbeitsumfeld | 20 % |
| Beschäftigungssicherheit | 15 % |
| Arbeitszeit und Flexibilität | 15 % |
| Führung, Kultur, soziale Bedingungen | 15 % |
| Entwicklung und Lernmöglichkeiten | 15 % |

Unter 50 % Abdeckung: `insufficientData: true` und `score: null`. Die
Oberfläche schreibt dann „nicht ausreichend beurteilbar" — nicht eine
niedrige Zahl, die wie ein Urteil aussieht.

## 5. AI Transition Radar

Bewertet werden **Aufgaben**, nicht Berufstitel. Derselbe Titel kann zu
70 % aus standardisierbarer Informationsarbeit bestehen oder zu 70 % aus
Aushandlung mit Menschen.

Je Aufgabe: Automatisierungsexposition, Augmentationspotenzial,
menschlicher Kern, wahrscheinliche Veränderung.

Vier Kategorien: `strongly_augmentable`, `partly_transformable`,
`relatively_robust`, `unclear_data`.

Ausgegeben werden **Szenarien**, nie eine Prognose mit Jahreszahl. Ohne
beschriebene Aufgaben lautet das Ergebnis `unclear_data` — und die
Oberfläche sagt das, statt zu raten.

## 6. Listing Confidence

Originalquelle, Arbeitgeberidentität, Alter, Frist, letzter Linkcheck,
Wiederveröffentlichung, Vollständigkeit. Unbekanntes zählt halb, nicht
null.

Das Wort **Fake** kommt nicht vor. Aus der Ferne lässt sich Betrug nicht
feststellen — wohl aber, dass eine Anzeige alt, unvollständig oder nicht
mehr erreichbar ist. Genau das wird gesagt.

## 7. Gesamtranking

| Bestandteil | Gewicht |
|---|---|
| Fachliche Passung | 60 % |
| Jobqualität | 20 % |
| Entwicklung durch KI | 10 % |
| Vertrauen in die Anzeige | 10 % |

Zwei Fälle ohne Gesamtwert:

1. **Blockierte Stelle.** „72 von 100, aber du darfst dort nicht
   arbeiten" ist eine sinnlose Zahl.
2. **Abdeckung unter 50 %.** Lieber keine Zahl als eine, die Sicherheit
   vortäuscht.

Beim Sortieren landen Stellen ohne Wert hinten statt vorn — `null` wird
nirgends als 0 behandelt. Blockierte Stellen stehen immer am Ende,
unabhängig vom Sortierkriterium.

## Was diese Werte nicht sind

**Keine Einstellungswahrscheinlichkeit.** Wer eingeladen wird, hängt am
Bewerberfeld, am Zeitpunkt, an internen Kandidatinnen — an Dingen, die
dieses System nicht kennt und nicht kennen kann.

## Grenzen

- Der Abgleich zwischen Anforderung und Erfahrung arbeitet mit
  Wortüberlappung. Nachvollziehbar, aber grob: eine anders formulierte,
  gleichbedeutende Erfahrung kann übersehen werden. Semantische Suche
  über `pgvector` ist vorgesehen, aber nicht umgesetzt.
- Reisezeiten kommen aus einer kleinen Tabelle, nicht aus einem
  Routendienst. Unbekannte Verbindungen liefern `null`, keine geratene
  Zahl.
- Die AI-Transition-Einordnung beruht auf Merkmalen des Aufgabentexts,
  nicht auf einer validierten Studie zur konkreten Rolle.
