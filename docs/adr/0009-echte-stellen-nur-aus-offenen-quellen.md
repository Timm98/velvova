# ADR 0009 — Echte Stellen nur aus offen angebotenen Quellen

**Datum:** 2026-08-29
**Status:** angenommen

## Zusammenhang

Das Produkt braucht echte Stellenanzeigen. Die großen Portale —
Indeed, LinkedIn, StepStone, Monster — untersagen das automatische
Auslesen in ihren Nutzungsbedingungen.

## Entscheidung

Erste Quelle ist **Arbeitnow** über die öffentlich angebotene
Schnittstelle `https://www.arbeitnow.com/api/job-board-api`.

Der Unterschied zu einem Abruf, den man sich nimmt, ist entscheidend:
Diese Quelle bietet ihre Anzeigen selbst zum Abruf an, ohne Schlüssel und
ohne Anmeldung. Es wird nichts umgangen, kein Zugriffsschutz überwunden,
kein Vertrag verletzt. Jede Anzeige trägt ihre Herkunft und ihren
Abrufzeitpunkt und verlinkt auf das Original.

Bewerbungen laufen nie über uns, sondern immer über die Originalseite.

## Grenzen im Code, nicht nur im Vorsatz

- Höchstens fünf Seiten je Lauf, als Schleifenbedingung. Eine Obergrenze,
  die nur im Aufrufer steht, wird bei einem Fehler in der Schleife zum
  Massenabruf.
- Eine Quelle mit `licenseStatus: "unclear"` wird nicht aktiviert — die
  Prüfung steht in der Registrierung, nicht im Aufrufer.
- Der Lauf ist wiederholbar: der Inhaltshash entscheidet, ob sich etwas
  geändert hat. Zweimal ausgeführt entsteht nichts doppelt.

## Nichts wird geraten

Arbeitnow überträgt keine Gehälter. Es wird keines geschätzt und keines
als "0" ausgewiesen: nicht offengelegt heißt nicht offengelegt. Ebenso
bei der Vertragsart — "Teilzeit" ist eine Arbeitszeit, keine
Vertragsart, und wird nicht dazu gemacht.

Ein geratener Wert wäre schlimmer als ein fehlender, weil er später wie
eine gesicherte Angabe aussieht und in die Passung eingeht.

## Der Abruf läuft im Serverprozess

`POST /api/jobs/refresh`, nicht als Skript daneben. Grund: die
eingebettete Entwicklungsdatenbank läuft in genau einem Prozess. Ein
Abruf aus einem zweiten Prozess schreibt in dieselbe Ablage, aber der
laufende Server sieht davon nichts. Genau daran haben in der Entwicklung
50 von 80 abgerufenen Stellen gefehlt, und der Fehler war an der falschen
Stelle gesucht.

Im Betrieb mit eigenständigem Postgres gilt die Einschränkung nicht mehr;
derselbe Endpunkt kann dann aus einem Zeitplan aufgerufen werden,
abgesichert über `JOBS_REFRESH_SECRET`.

## Vorgesehen, noch nicht umgesetzt

Adzuna und EURES sind rechtlich nutzbar und passen in dieselbe
Adapterschnittstelle. Beide brauchen einen Zugangsschlüssel und sind
deshalb noch nicht aktiviert.
