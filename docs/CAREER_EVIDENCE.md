# Belegte Erfahrung

Wie aus einem beiläufigen Satz eine Aussage wird, die eine Bewerbung tragen
kann — und wo die Kette reisst, wenn ein Glied fehlt.

## Warum überhaupt Belege

Ein Lebenslauf besteht aus Behauptungen. Wer sie gut formuliert, kommt weiter —
unabhängig davon, ob sie stimmen. Das benachteiligt systematisch Menschen, die
ihre eigene Arbeit nicht in Bewerbungssprache übersetzen können, und es
belohnt, wer es kann.

Die Antwort hier ist nicht bessere Sprache, sondern Rückbindung: **jede
Aussage hängt an etwas, das die Person erzählt und bestätigt hat.** Ein
Anschreiben, das etwas behauptet, wofür kein Beleg existiert, kann nicht
freigegeben werden.

## Die Kette

```
Erzählung          "Ich hab da mal 'ne Eskalation übernommen."
   ↓  Monday fragt nach dem Konkreten
Episode            was genau, über welchen Zeitraum, mit welchem Ergebnis
   ↓  daraus abgeleitet
Aussage            "Führt Eskalationen bis zur Lösung"      [unbestätigt]
   ↓  die Person bestätigt
Beleg              dieselbe Aussage                          [bestätigt]
   ↓  fliesst ein
Bewertung          zählt in der Passung
   ↓  trägt
Bewerbungssatz     darf so im Anschreiben stehen
```

Jeder Pfeil ist eine Stelle, an der etwas verloren gehen darf — aber keine, an
der etwas dazukommen darf.

## Die Bausteine

**`evidence_items`** — eine Aussage mit Herkunft, Zuversicht und Zustand.

| Herkunft | Bedeutung |
| --- | --- |
| `user_stated` | die Person hat es gesagt |
| `user_confirmed` | die Person hat eine Ableitung bestätigt |
| `document_extract` | aus einem hochgeladenen Dokument |
| `ai_hypothesis` | abgeleitet, **zählt nicht** |
| `external_source` | aus einer externen Quelle |
| `work_sample` | aus einer kurzen Aufgabe |

**`evidence_edges`** — welche Aussage worauf beruht. Das macht die Kette
rückwärts begehbar: wird ein Beleg gelöscht, verlieren die darauf gestützten
Aussagen ihre Grundlage. Sie bleiben nicht als schöner Satz ohne Fundament
zurück.

**`experiences`** — die Episoden selbst, mit Zeitraum und Kontext.

## Die eine Regel

`isConfirmedFact()` entscheidet, ob eine Aussage in der Bewertung vorkommt. Nur
bestätigt und nicht verworfen zählt. Es gibt keinen zweiten Weg, auf dem eine
unbestätigte Aussage in eine Empfehlung gerät.

Das kostet etwas: ein frisches Profil ist dünn, und die ersten Empfehlungen
sind vorsichtig. Der Preis ist richtig herum bezahlt — ein Produkt, das aus
drei Sätzen ein vollständiges Berufsbild ableitet, hat es erfunden.

## Zuversicht statt Vollständigkeit

**Unbekanntes ist neutral.** Fehlt ein Faktor, wird sein Gewicht auf die
übrigen verteilt. Das senkt die **Zuversicht**, nicht die **Passung**.

Der Unterschied ist entscheidend: eine Anzeige, die zum Gehalt schweigt, macht
die Person nicht schlechter. Sie macht die Aussage über sie unsicherer. Ein
System, das fehlende Angaben als Null behandelt, bestraft die Person für die
Nachlässigkeit eines Arbeitgebers.

## Belegabgleich in der Bewerbung

Jeder Satz eines erzeugten Dokuments wird gegen die bestätigten Belege
gehalten:

| Zustand | Bedeutung | Folge |
| --- | --- | --- |
| `supported` | belegt | frei |
| `needs_confirmation` | nur teilweise belegt | prüfen |
| `unsupported` | kein Beleg | **sperrt die Freigabe** |

Der Abgleich arbeitet mit Wortüberlappung, nicht semantisch. Er übersieht
belegte Aussagen mit anderem Wortschatz — der Fehler geht also in Richtung „zu
streng“. Bei einem Text, für den die Person im Gespräch geradestehen muss, ist
das die richtige Richtung.

## Was das nicht ist

Kein Wahrheitsbeweis. Eine bestätigte Aussage ist eine Aussage, zu der die
Person steht — nicht eine überprüfte Tatsache. Das Produkt verhindert, dass
**es selbst** etwas erfindet. Es kann nicht verhindern, dass jemand über sich
selbst etwas Falsches sagt, und behauptet das auch nicht.
