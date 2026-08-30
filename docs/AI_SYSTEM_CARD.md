# KI-Systemkarte

Was das System tut, was es ausdrücklich nicht tut, und woran man merken würde,
dass es falsch liegt.

## Zweck

Paycheck unterstützt Menschen bei der Arbeitssuche: es führt ein
Karrieregespräch, leitet daraus belegte Aussagen ab, vergleicht sie mit echten
Stellenanzeigen und hilft beim Bewerben. Die Person entscheidet; das System
begründet.

## Einordnung

Beschäftigung ist nach der KI-Verordnung ein Bereich mit hohem Risiko. Die
Einstufung dieses Systems hängt daran, wer es einsetzt: **hier bewertet es
Bewerbende nicht für einen Arbeitgeber, sondern hilft der suchenden Person
selbst.** Das ist ein anderer Anwendungsfall als eine Vorauswahl im
Einstellungsverfahren — aber die Grenze ist nicht selbsterklärend, und sie
gehört von einer Juristin geprüft, nicht hier entschieden.

Unabhängig davon gelten die Zusagen unten.

## Was das System tut

| Aufgabe | Wie | Modell beteiligt |
| --- | --- | --- |
| Gespräch führen, nachfragen | Sprachmodell mit Werkzeugen | ja |
| Aussagen aus Antworten ableiten | Sprachmodell, Ergebnis als **unbestätigt** | ja |
| Profil zusammenfassen | Sprachmodell | ja |
| Passung, Zuversicht, Anzeigenqualität rechnen | **regelbasiert** | nein |
| Harte Bedingungen prüfen | **regelbasiert** | nein |
| Bewerbungsaussagen gegen Belege halten | **regelbasiert**, Formulierungsvorschlag vom Modell | teilweise |
| Anschreiben entwerfen | Sprachmodell, jede Aussage geprüft | ja |

Die Zeile mit „nein“ ist die wichtigste: **die Bewertung ist keine
Modellausgabe.** Sie ist gerechnet, nachvollziehbar und auch ohne
Modellanbieter richtig. Wer die Modellnutzung ablehnt, verliert das Gespräch,
nicht die Bewertung.

## Was das System nicht tut

Diese Liste ist im Code durchgesetzt, nicht nur formuliert:

- **Keine Einstellungswahrscheinlichkeit.** Kein Wert wird als solche
  dargestellt. Ein Passungswert sagt, wie gut ein Profil zu einer Anzeige passt
  — nicht, ob jemand genommen wird.
- **Keine Aussage über geschützte Merkmale.** Herkunft, Geschlecht, Alter,
  Religion, Behinderung, sexuelle Orientierung, Gesundheit. Eine Ausgabe, die
  so etwas zuschreibt, wird **verworfen, nicht bereinigt** (`checkOutput()`).
- **Keine Emotions-, Gesichts-, Akzent- oder Ehrlichkeitsanalyse.** Es gibt
  keinen Codepfad dafür.
- **Keine automatische Bewerbung.** Kein Massenversand. Ohne ausdrückliche
  Freigabe geht nichts hinaus, und ohne Beleg gibt es keine Freigabe.
- **Keine deterministische Zukunftsaussage.** Die Einschätzung zur Entwicklung
  eines Berufs ist eine Einordnung mit Datum und Unsicherheit, keine Prognose.
- **Keine Behauptung wissenschaftlicher Validierung.** Die Bewertungslogik ist
  begründet und offengelegt (`docs/MATCHING.md`), nicht validiert.

## Die fünf Werte

Getrennt, weil sie verschiedene Fragen beantworten und ein Mischwert alle
verwischen würde:

| Wert | Frage |
| --- | --- |
| Passung | Wie gut passt das Profil zu dieser Anzeige? |
| Zuversicht | Wie gut ist die Datenlage für diese Aussage? |
| Anzeigenqualität | Wie brauchbar ist diese Anzeige als Angebot? |
| KI-Wandel | Wie stark verändert sich dieser Beruf? |
| Anzeigenvertrauen | Wie verlässlich ist diese Anzeige als Quelle? |

**Unbekanntes ist neutral.** Fehlt ein Faktor, wird sein Gewicht auf die
übrigen verteilt. Das senkt die Zuversicht, nicht die Passung — eine Anzeige,
die schweigt, macht die Person nicht schlechter.

## Woran man merkt, dass es falsch liegt

Ehrlicher als eine Genauigkeitszahl, die es nicht gibt:

- Eine Aussage im Profil, die die Person nicht wiedererkennt. Deshalb steht
  jede zunächst als **unbestätigt** da und zählt nicht.
- Ein hoher Passungswert bei einer Anzeige, die offensichtlich nicht passt.
  Deshalb steht neben jedem Wert eine Begründung in einem Satz — eine falsche
  Begründung erkennt man, eine falsche Zahl nicht.
- Ein Anschreiben, das etwas behauptet, das nicht stimmt. Deshalb wird jeder
  Satz gegen die bestätigten Belege gehalten, und eine unbelegte Aussage
  **sperrt die Freigabe**, statt eine Warnung anzuzeigen. Eine Warnung klickt
  man weg.

## Modelle

Im Fachcode steht kein Modellname. Aufgaben laufen über Leistungsstufen
(TERRA, SOL, LUNA, REALTIME), die Zuordnung steht in
`packages/ai/src/router.ts` und ist in `docs/AI_ROUTING.md` abgebildet. Welches
Modell hinter einer Stufe steht, ist Konfiguration — auch, damit für besonders
schutzbedürftige Verarbeitung ein selbst betriebener Pfad möglich bleibt.

## Menschliche Aufsicht

- Jede abgeleitete Aussage ist unbestätigt, bis die Person sie bestätigt.
- Jede Aussage ist einzeln änderbar, ablehnbar, löschbar.
- Vor personalisierten Vorschlägen steht ein Riegel: ohne bestätigtes Profil
  gibt es keine.
- Kein Dokument verlässt das Haus ohne Sichtung und Freigabe.

## Bekannte Schwächen

- Der Abgleich Aussage gegen Beleg arbeitet mit Wortüberlappung, nicht
  semantisch. Er übersieht belegte Aussagen mit anderem Wortschatz — der Fehler
  geht also in Richtung „zu streng“, was hier die richtige Richtung ist.
- Die Zusammenführung gleicher Stellen über Portale hinweg trennt im Zweifel.
  Die Liste wird dadurch länger als nötig.
- Die Bewertungsgewichte sind begründet, aber nicht empirisch kalibriert.
- Die Evaluationsfälle decken 19 Situationen ab. Das ist zu wenig; das Ziel
  sind 50.

## Stand

Kein Produktivbetrieb. Kein unabhängiges Audit. Was hier steht, ist durch Tests
belegt, nicht durch eine externe Prüfung.
