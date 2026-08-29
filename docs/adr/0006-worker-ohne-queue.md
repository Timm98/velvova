# ADR 0006: Worker ohne Queue-Infrastruktur

**Status:** angenommen · **Datum:** 2026-08-29

## Zusammenhang

Es gibt Hintergrundarbeit: Aufbewahrungsfristen durchsetzen, Links
prüfen, Erinnerungen anlegen. Der Auftrag empfiehlt eine abstrahierte,
im MVP datenbankgestützte Warteschlange.

## Entscheidung

Kein Queue-System. Der Worker läuft periodisch alle 15 Minuten und führt
jede Aufgabe aus; `--once` erlaubt denselben Code aus einem Cron.

## Begründung

Alle heutigen Aufgaben sind idempotent, zeitgesteuert und vertragen
einen Neustart. Keine braucht Reihenfolge, Wiederholungssemantik oder
Sichtbarkeitsfenster — also genau die Eigenschaften, für die eine
Warteschlange da ist. Sie einzuführen hieße, Infrastruktur zu betreiben,
die heute nichts löst.

`Promise.allSettled` sorgt dafür, dass eine fehlgeschlagene Aufgabe die
anderen nicht verhindert.

## Folgen

- Aufgaben, die auf ein Ereignis reagieren müssen (etwa Dokumentanalyse
  direkt nach einem Upload), passen nicht in dieses Muster. Dann wird
  eine Warteschlange nötig — die Aufgaben sind so geschnitten, dass sie
  sich einzeln umziehen lassen.
- Zwei Worker gleichzeitig würden dieselbe Arbeit doppelt tun. Bei
  idempotenten Aufgaben ist das folgenlos, aber es skaliert nicht.
