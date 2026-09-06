# Velvova — dauerhafte Projektregeln

Diese Datei gilt für jede Arbeit an diesem Projekt. Sie steht über
einzelnen Aufträgen im Gesprächsverlauf.

## Rangfolge bei Widersprüchen

1. Sicherheit und Datenintegrität
2. Funktionierender End-to-End-Produktflow
3. Anforderungen des laufenden Auftrags
4. Bestehende aktuelle Architektur
5. Frühere Phasen-Prompts

## Nina Interaction System — verbindlich für jede Funktion

Nina ist kein Chatbot, sondern die zentrale Assistenz-, Erklärungs-,
Navigations- und Steuerungsebene von Velvova.

> **Jede neue oder überarbeitete Velvova-Funktion muss in das globale
> Nina Interaction System integriert werden. Für jede interaktive
> Funktion ist zu prüfen, wie sie im Sprachmodus gesteuert, im
> Textmodus erklärt, visuell hervorgehoben und als sinnvoller nächster
> Schritt empfohlen werden kann.**

Eine Funktion gilt erst als vollständig, wenn diese zwölf Fragen
beantwortet sind:

1. Wie öffnet oder steuert der Nutzer sie per Sprache?
2. Welche semantische Nina-Aktion gehört dazu?
3. Wie erklärt Nina die Funktion im Textmodus?
4. Welches stabile `data-nina-target` wird verwendet?
5. Braucht die Aktion eine Bestätigung?
6. Was passiert bei mehrdeutiger Spracheingabe?
7. Was ist danach der nächste sinnvolle Schritt?
8. Muss die Funktion beim ersten Besuch erklärt werden?
9. Funktioniert der Moduswechsel während der Nutzung?
10. Funktioniert alles mobil und mit reduzierten Animationen?
11. Gibt es einen manuellen Rückfallweg?
12. Wurde das Verhalten getestet?

Der Abschlussbericht jeder Umsetzung nennt kurz, wie die Funktion mit
Sprachmodus, Textmodus, Hervorhebung, nächstem Schritt und
Moduswechsel verbunden wurde.

**Die beiden Bedienarten sind streng zu trennen:** Im Sprachmodus führt
und steuert Nina aktiv (Seitenwechsel, Scrollen, Hervorheben, Ausführen
nach Zustimmung). Im Textmodus erklärt und empfiehlt sie, der Nutzer
steuert selbst — dort keine automatische Navigation, kein automatisches
Scrollen, kein selbsttätiges Öffnen oder Filtern.

Die vollständige Spezifikation mit Architektur, Zustandsmodell,
Action-Registry und Testszenarien liegt in
`docs/auftraege/nina-interaction-system.md`. Sie ist noch **nicht**
umgesetzt; die Regel gilt trotzdem ab sofort für jede Planung.

## Der Kopfbereich ist überall derselbe

Velvova hat **einen** Kopf, und der sieht auf jeder Seite gleich aus —
angemeldet wie abgemeldet, öffentlich wie intern:

- links der Schriftzug Velvova, ohne Symbol,
- mittig die Suche mit der echten Bestandszahl,
- rechts auf Höhe des Schriftzugs Glocke und Profil (abgemeldet:
  Anmelden und Konto anlegen),
- darunter mittig die Wege als reiner Text, gleiche Abstände.

Gleiche Höhe, gleiche Schriftgrössen, gleiche Farben. Er klebt nicht
beim Scrollen.

**Keine zweite Kopfzeile.** Wer eine Seite anlegt, benutzt diesen Kopf
— auch für Rechtstexte, Hilfe und Fehlerseiten. Ein eigener, kleinerer
Kopf für „nebensächliche" Seiten tauscht mitten in der Arbeit die
Umgebung aus, und der Nutzer muss zurückfinden.

Dasselbe gilt für Nina: Der Core wird überall gleich dargestellt.

## Wahrhaftigkeit der Daten

- Keine erfundenen Stellen, Unternehmen, Gehälter, Bewertungen,
  Nutzerzahlen, Erfolgsquoten oder Prüfsiegel.
- Ein Vertrauensabzeichen erscheint nur mit Beleg im Bestand. Ohne
  Daten kein Abzeichen.
- Keine Seed-Daten in Production.
- Zahlen im Produkt kommen aus dem Bestand, nicht aus dem Code. Wird
  gerundet, dann ab-, nie aufgerundet — „über X" muss auch dann noch
  stimmen, wenn der Bestand kurz sinkt.

## Sicherheit

- API-Schlüssel ausschliesslich serverseitig. Keine Schlüssel im
  Client-Bündel, keine in Logs, keine im Bericht.
- Niemals `.env.local` oder andere Geheimnisdateien committen.
  `.env.example` nur mit leeren Platzhaltern.
- Kein Nutzer darf Daten eines anderen lesen oder ändern. Jede Tabelle
  mit `user_id` braucht eine Zeile in `packages/db/src/rls.sql`;
  `rls-coverage.test.ts` erzwingt das.
- Niemals protokollieren: Passwörter, Token, Schlüssel, vollständige
  Profile, Lebenslaufinhalte, private Nina-Unterhaltungen.

## Quellen und Bewerbungen

- Keine Scraper für LinkedIn, Indeed, StepStone, Monster, XING,
  Glassdoor, Kununu oder Google-Trefferlisten.
- Niemals umgehen: Logins, Captchas, Bot-Schutz, Rate Limits,
  Zugriffssperren, `robots.txt`.
- Keine automatische Bewerbung ohne ausdrückliche Nutzerfreigabe.
- Volltext nur wiedergeben, wo die Quelle es erlaubt
  (`volltextErlaubt` in `packages/sources/src/policy-engine.ts`).

## Umgang mit dem Repository

- Nichts löschen, überschreiben, verschieben, umbenennen, bereinigen,
  stagen, resetten oder stashen.
- Kein `git clean`, kein `git reset --hard`, kein erzwungener Checkout.
- Nichts zu einem Remote-Repository pushen.

## Wiederkehrende Fehlermuster in diesem Projekt

**Schema ohne Verdrahtung.** Der häufigste Defekt hier: ein Feld, eine
Funktion oder eine Regel existiert, ist dokumentiert — und nichts ruft
sie auf. Vor „fertig" prüfen, wer den neuen Code tatsächlich aufruft.

**Vollzählung im Seitenaufruf.** `count(*)`, `group by` oder `ilike`
über `jobs` (2,4 Mio. Zeilen) laufen in die Zeitgrenze und setzen die
Seite auf 500. Solche Zahlen gehören vorberechnet in eine eigene
Tabelle, gefüllt von `scripts/pflegelauf.mjs`.

**Stille Null.** Ein Lauf, der nichts tut und trotzdem ohne Fehler
endet, ist von einem erfolgreichen nicht zu unterscheiden. Ungültige
Eingaben müssen abbrechen, nicht durchlaufen.

**Kommentar ohne Deckung.** Ein Kommentar, der ein Verhalten
beschreibt, das der Code nicht hat, ist schlimmer als keiner.

## Sprache

Code, Kommentare, Commit-Nachrichten und Oberfläche auf Deutsch.
Kommentare erklären das *Warum* — besonders, welcher Fehler eine
Entscheidung erzwungen hat.
