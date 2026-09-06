# Velvova — Designumbau und Nina-Führung

Erteilt am 4.9.2026. Ausdrückliche Reihenfolge des Auftraggebers:

> „bau alles schritt für schritt damit du nicht durcheinander kommst —
> erst das design, und sobald wir damit zufrieden sind, kommen wir zur
> sprach- oder schreibsteuerung. währenddessen immer weiter die jobs
> auch upgraden, damit wir das maximale rausholen."

Also: **A Design zuerst**, danach **B Nina-Führung**. Der Stellenbestand
wächst durchgehend weiter.

---

## A · Design

### A1 Schrift und Farben (Grundlage, alles andere baut darauf)

- **Komplett andere Schrift** für die ganze Seite, ausdrücklich auch
  für Zahlen.
- Heller Modus: dasselbe leicht dunkle Blau wie bisher weiterverwenden.
- Dunkler Modus: dasselbe Blau, aber der **Hintergrund dunkleres Blau**
  — Vorbild Chrono24, also tiefes Marineblau statt Grau/Schwarz.

### A2 Kopfzeile

Ein durchgehender Kopf über der ganzen Anwendung:

- **Links:** grosses Velvova-Logo.
- **Mitte:** Suchleiste, beschriftet in der Art „Finde <Zahl> Jobs mit
  Hilfe von Nina". Führt auf die Stellenseite. Dort kann man tippen
  **oder** hineinsprechen.
- **Rechts, auf Höhe des Logos:** Profil und Glocke für
  Benachrichtigungen.
- **Unten mittig im Kopf:** die Abschnitte als **Symbol + Text**.
- **Unter dem Kopf:** Nina mit „Sprich weiter mit Nina". Der Core
  bewegt sich, der Knopf blinkt leicht auf beziehungsweise wird heller,
  und die Sucheingabe oben bekommt ebenfalls eine dezente
  Daueranimation, damit sie auffällt.

### A3 Ankündigung

„Die Velvova App kommt bald" gehört **in die Mitte der Seite**, nicht
an den Rand.

### A4 Fusszeile

- Der Hinweistext unter den Zahlungsarten: **grösser und etwas dicker**.
- **Newsletter** mit E-Mail-Eingabe: Benachrichtigung bei neuen
  Angeboten, die zum Nutzer passen. Zusätzlich optional die
  Telefonnummer.
- **Region, Sprache und Währung** — Sprache in **jeder Weltsprache**.

### A5 Währung

**Jedes Gehalt** wird in die Währung des Ortes umgerechnet, an dem der
Nutzer sich gerade befindet.

### A6 Stellenbilder

Bilder immer in ihrem echten Seitenverhältnis, damit sie nicht
abgeknickt oder gequetscht wirken.

### A7 Stellenliste

- Gehalt **immer hervorheben** — grüner Hintergrund oder dickere
  Schrift. Wichtige Angaben grundsätzlich stärker auszeichnen als den
  Rest.
- „Keine Stelle verpassen" unten **entfernen**.
- Statt „mit den meisten offenen Stellen" lieber **Stellen mit den
  besten Zukunftschancen**.
- Dort die Möglichkeit, **Nina um andere Auswertungen zu bitten** —
  etwa „welche Stellen haben die besten Einstellungschancen" oder „wo
  verdient man am meisten".
- **Sonst nichts** auf dieser Seite ergänzen.

### A8 Stellendetail — vollständig neu, in dieser Reihenfolge

1. Ganz oben links die Grundinformationen.
2. Direkt darunter die wichtigen Knöpfe.
3. Das Ranking, wie gut die Stelle passt, samt Einschätzung von Nina.
4. Die Jobprognose für die nächsten Jahre — wie stabil die Stelle ist.
5. Gehalts- und Routenrechner.
6. Weitere Informationen zur Stelle.
7. Eine Funktion, Nina etwas zu dieser Stelle zu fragen — per Sprache
   oder kurz geschrieben.

### A9 Bewerbungsseite — vollständig neu

- Dokumente hochladen, tippen **oder** hineinsprechen: kurz sagen, was
  erstellt werden soll.
- **Beispiele zeigen**, was für eine hohe Erfolgschance wichtig ist.
- Erzeugen lassen, angepasst auf den jeweiligen Beruf.

### A10 Startseite — vollständig neu

- Mit **News**: ein Element, das man anklickt und dann weitergeleitet
  wird, um mehr Nachrichten zu sehen.
- **Keine dubiosen News.** Nichts Erfundenes, keine unbelegten Quellen.

### A11 Nina im Rahmen

- **Links unten** beim Chatbot: Hilfe und Kontakt — dort muss aber
  immer Nina sein.
- Von dort kommen später auch Ninas Nachrichten, wenn man nicht mehr
  auf ihrer Seite ist.
- „Willkommen zurück" soll den Nutzer **immer namentlich** ansprechen.

---

## B · Nina-Führung (erst nach Abnahme des Designs)

- Unten auf jeder Seite fragt Nina nach oder meldet, was gerade
  geschieht. Auf eine Nachricht kann man **direkt unten** antworten.
- Im Sprachmodus liegt unten durchgehend ein **Mikrofon mit Animation**;
  man kann jederzeit mit Nina sprechen.
- Nina erklärt die ganze Seite, vor allem beim ersten Besuch.
- Zuerst das **Interview**, in dem man sich für Sprechen oder Schreiben
  entscheidet — **jederzeit änderbar**.
- Nach dem Interview **automatisch auf die Stellenseite**, mit sanftem
  Übergang: Dinge erscheinen, Deckkraft ändert sich.
- Dort wird alles erklärt. Das gerade erklärte Element bekommt eine
  **bläuliche Umrandung**, leuchtet auf oder wird grösser — solange es
  erklärt wird. Knöpfe dürfen heller sein.
- Ist alles erklärt und eine Stelle gewählt, führt Nina in die weiteren
  Abschnitte — gleiches Prinzip.
- **Nur beim ersten Login** mit Hervorhebung und Nachfragen. Danach
  leitet Nina weiter, aber ohne Auszeichnung und ohne Rückfragen.
- Nina **merkt sich** über die ganze Seite hinweg, worum es gerade geht.

Diese Ausbaustufe ist zusätzlich an
`docs/auftraege/nina-interaction-system.md` gebunden; die dortige
Trennung von Sprach- und Textmodus gilt unverändert.

---

## Arbeitsstand

- [x] A1 Schrift und Farben
- [x] A2 Kopfzeile
- [x] A3 Ankündigung mittig
- [~] A4 Fusszeile: Abstände, Märkte ausklappbar, Region/Sprache/Währung 19 Länder, Socials unten · offen: Newsletter
- [ ] A5 Währungsumrechnung
- [ ] A6 Stellenbilder
- [ ] A7 Stellenliste
- [ ] A8 Stellendetail
- [ ] A9 Bewerbungsseite
- [x] A10 Startseite: News-Teaser, Kundenstimmen, Nina-Einstieg
- [~] A11 Nina: Streifen entfernt, Core gross auf der Startseite · offen: Farbe und Dauerbewegung
- [ ] B Nina-Führung
