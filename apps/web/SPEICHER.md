# Warum der Webserver mehr Speicher bekommt

`start` setzt `--max-old-space-size=6144`. Das ist keine Vorsichtsmassnahme,
sondern die Folge einer Messung.

## Was passiert ist

Bei 147.706 bewerteten Stellen starb der Prozess:

```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

Und weil er beim Hochfahren erneut lud, starb er wieder. Von aussen sah es
aus wie eine defekte Detailseite — jede Anfrage lief in die Zeitgrenze.

## Die vier Ursachen, in der Reihenfolge ihres Fundes

**1. Die Wortmengen.** `description_tokens` sind 82 der 111 MB je
Ladevorgang. Gebraucht werden sie nur für zwei der sieben Passungsdimensionen
— Arbeitsstil und Werte — und beide laufen nur, wenn die Person entsprechende
Angaben gemacht hat. Jetzt werden sie erst bei Bedarf geholt.

**2. Sie wurden für ALLE Stellen geladen.** Auch nach Fund 1 lud
`wortmengen()` den ganzen Bestand statt nur das Bewertungsfenster: bei
741.059 Stellen rund ein Gigabyte in einem Zug. Ein einziger Aufruf reichte
für den Absturz.

**3. Das Nachführen hielt sich an keine Grenze.** Die Obergrenze galt beim
Vollladen; das Nachführen hängte an, was sich geändert hatte:

```
[bestand] 52829 Stellen vollständig geladen
[bestand] 35335 geänderte Stellen nachgeführt (Bestand 81251)
```

Bei laufenden Importen sind das über 20.000 Zeilen alle zwei Minuten. Die
Grenze hob sich also selbst auf, und jeder einzelne Schritt sah dabei
vernünftig aus.

**4. Der Bewertungsspeicher räumte nie auf.** Er hatte eine Frist von 45
Sekunden, aber kein Aufräumen: Jede Person hinterliess dauerhaft eine
vollständige Kopie aller bewerteten Stellen. Rückgerechnet wiegt ein
bewerteter Datensatz rund **11 KB**.

## Was jetzt gilt

| | |
|---|---:|
| Bewertete Stellen insgesamt | 150.000 |
| davon je Land | Budget geteilt durch Länder, 4.000–40.000 |
| Nachgeführt je Runde | höchstens 10.000 |
| Bewertungsspeicher | 80.000 Stellen (~900 MB) |
| Heapgrenze | 6.144 MB |

Gemessen: fünf vollständige Prüfläufe hintereinander, 33 von 33 Prüfungen
grün, Speicher bei 3,4 GB stabil.

## Was das nicht löst

Nichts davon macht den Ansatz tragfähig. Für jede Person den ganzen Bestand
zu bewerten und im Speicher zu halten kostet rund 11 KB je Stelle — bei
58.351 Stellen sind das 640 MB je gleichzeitiger Bewertung.

Die Lösung ist, nur zu bewerten, was gezeigt wird: grob vorsortieren in der
Datenbank, dann die oberen fünfzig genau rechnen. Bis dahin sind die Zahlen
oben Notbremsen — sie verhindern den Absturz und rechnen dafür öfter neu.
