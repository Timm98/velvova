# ADR 0004: Eigene Authentifizierung statt Bibliothek

**Status:** angenommen · **Datum:** 2026-08-29

## Zusammenhang

Gebraucht werden E-Mail und Passwort, Magic Link, sichere
Sitzungs-Cookies, Geräteverwaltung und ein Weg zu MFA. Der Auftrag
verlangt eine stabile, selbst betreibbare oder portierbare Lösung ohne
Beta-Abhängigkeit.

## Entscheidung

Eigene Implementierung in `apps/web/src/lib/auth.ts`, etwa 250 Zeilen.

## Begründung

Der Umfang ist klein und gut verstanden. Die verbreiteten Bibliotheken
lösen vor allem OAuth-Vielfalt — genau das, was hier am wenigsten
gebraucht wird. Dafür bringen sie ein eigenes Sitzungsmodell mit, das
sich mit der Row-Level-Security in dieser Architektur reiben würde: die
Nutzerkennung muss vor jeder Abfrage in der Transaktion gesetzt sein,
und das ist einfacher, wenn man den Sitzungsweg selbst in der Hand hat.

Die umgesetzten Eigenschaften:
- scrypt mit zufälligem Salt, Vergleich in konstanter Zeit
- im Cookie ein zufälliges Token, in der Datenbank nur dessen Hash
- gleiche Antwortzeit bei unbekannter Adresse (Zeitausgleich)
- Magic Links einmalig verwendbar, 20 Minuten gültig
- jede Sitzung einzeln widerrufbar
- Mindestlänge zwölf Zeichen statt erzwungener Zeichenklassen

## Folgen

- MFA ist vorbereitet, aber nicht umgesetzt. Der Platz dafür ist die
  Tabelle `auth_accounts`.
- OAuth-Anbieter sind gekapselt vorgesehen und nicht angebunden. Die
  Oberfläche zeigt das als „nicht verbunden".
- Diese Entscheidung ist umkehrbar: die Schnittstelle ist schmal genug,
  um sie hinter eine Bibliothek zu schieben, falls OAuth-Vielfalt später
  wichtig wird.
