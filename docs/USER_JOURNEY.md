# User Journey

Der vollständige Ablauf, mit den Stellen, an denen das Produkt bewusst
bremst.

## 1. Landing Page → `/`

In fünf Sekunden muss klar sein: hier wird vor der Jobbörse angesetzt und
bis nach der Bewerbung begleitet.

Zwei gleichwertige Einstiege — sprechen oder schreiben. Kein erfundenes
Kundenlogo, kein Testimonial, keine Erfolgsquote. Das gezeigte Match ist
als **Beispiel** beschriftet.

## 2. Registrieren → `/register`

E-Mail und Passwort, mindestens zwölf Zeichen. Magic Link als Alternative.
Fehler stehen am Feld **und** als Zusammenfassung.

## 3. Einwilligung und Grundeinstellungen → `/setup`

Sprache, Land, Standort, Arbeitsmodell — und **fünf getrennte
Einwilligungen**, nicht ein Sammelhaken:

| Einwilligung | Standard |
|---|---|
| Karriereprofil erstellen | erforderlich |
| Unterlagen auswerten | aus |
| Spracheingabe | aus |
| Transkript speichern | aus |
| Externer KI-Anbieter | aus |

Ist kein externer Anbieter verbunden, steht das dort — nicht als
Werbeversprechen, sondern als Zustand.

## 4. Gespräch mit Nina → `/app/nina`

Nina steht im Mittelpunkt, nicht eine Formularwand.

- **Eine Hauptfrage** je Schritt, mit „Warum diese Frage?" zum Aufklappen
- Text- und Sprachmodus jederzeit wechselbar
- Im Sprachmodus: ruhiger Kern, Live-Mitschrift, Pause, Fortsetzen
- Fortschritt als **Themen** („3 von 11 verstanden"), nie als scheingenaue
  Prozentzahl
- Jede Frage überspringbar, jede Sitzung pausierbar
- Rechts sichtbar: was bereits bestätigt ist, was noch Vermutung ist

**Der entscheidende Punkt:** Jede Antwort wird als *unbestätigte* Angabe
gespeichert. Sie zählt nirgends, bis der Mensch sie bestätigt hat. Das
ist der Unterschied zu einem Chatprofil.

## 5. Profil prüfen → `/app/profile`

Der Karrierekompass in verständlicher Sprache, darunter jede Aussage
einzeln mit ihrer Herkunft.

Vier gleichrangige Handlungen je Eintrag: **bestätigen, bearbeiten,
ablehnen, löschen**. Kein hervorgehobenes „Bestätigen" — das Produkt
drängt nicht in eine Richtung, die im Bewerbungsgespräch zurückfällt.

Abgelehntes bleibt sichtbar und zählt nie wieder.

## 6. Richtungen entdecken → `/app/roles`

Drei bis fünf Rollencluster, nach Art getrennt:

- **naheliegend** — was die Erfahrung direkt trägt
- **angrenzend** — ein Schritt daneben
- **weniger naheliegend** — was der Mensch selbst nicht genannt hätte

Jedes mit Begründung, Belegen, Lücken, kritischen Bedingungen,
Einstiegsrealismus und **einem konkreten nächsten Schritt zur
Überprüfung**. Eine Richtung bestätigt sich durch Ausprobieren, nicht
durch eine Berechnung.

## 7. Der Riegel

Personalisierte Jobvorschläge erscheinen erst, wenn:

1. die Pflichtthemen des Gesprächs abgedeckt sind **und**
2. der Mensch das Profil bestätigt hat.

Durchgesetzt in `loadGate()`, nicht nur angezeigt. Vorher wären es
Zufallstreffer — und die schaden mehr, als sie nützen.

## 8. Jobliste → `/app/jobs`

„Ninas Auswahl für dich", nicht „Alle Jobs".

Je Karte: Rolle, Unternehmen, Ort, Arbeitsmodell, Pendelhinweis, Gehalt
**oder „nicht angegeben"**, fünf getrennte Bewertungen, ein Grund, ein
Vorbehalt.

Sieben Sortierungen. Ausgeschlossene Stellen erscheinen nicht in der
Auswahl — sind aber auf Wunsch sichtbar, **mit konkretem Grund**.

## 9. Job Intelligence → `/app/jobs/[id]`

Keine kopierte Stellenanzeige. Sechs Bereiche:

| Bereich | Inhalt |
|---|---|
| Überblick | Tatsächliche Kernaufgaben, vollständige Beschreibung |
| Dein Match | Muss/Kann getrennt, Faktoren aufgeschlüsselt, jede Bedingung einzeln geprüft |
| Jobqualität | Sechs Dimensionen — oder „nicht ausreichend beurteilbar" |
| Zukunft & KI | Aufgabenebene, Szenarien, keine Jahreszahl |
| Unternehmen | Quellenarten **getrennt**, mit Stichprobe, Zeitraum, Auswahllogik |
| Quellen | Herkunft, Alter, Linkcheck, „Im Original öffnen" |

Dazu: Fragen für das Gespräch, abgeleitet aus dem, was in der Anzeige
**fehlt**.

## 10. Bewerbung vorbereiten → `/app/applications/[id]`

Drei Spalten: Anforderungen links, Dokument in der Mitte, Prüfung rechts.

Die rechte Spalte ist die wichtigste. Jede prüfbare Aussage wird gegen
die bestätigte Evidenz gehalten:

- **belegt** — eine bestätigte Erfahrung trägt sie
- **abgeschwächt** — nur teilweise gedeckt
- **nicht belegt** — **die Freigabe ist gesperrt**

Eine Bearbeitung setzt die Freigabe zurück. Was freigegeben wurde, muss
das sein, was auch versendet wird.

## 11. Versand

Zwei getrennte Riegel:

1. Das Dokument ist freigegeben.
2. Der Mensch hat den Versand ausdrücklich bestätigt.

Fehlt eines, passiert nichts. Standardweg ist ein Entwurf zum
Herunterladen — es wird nichts automatisch versendet, und es gibt keinen
Massenversand.

## 12. Verfolgen → `/app/applications`

Neun Stufen, drei Ansichten (Tafel, Liste, Termine).

Darunter der **Funnel Debugger** — der ausdrücklich schweigt, solange die
Stichprobe zu klein ist. Aus drei Bewerbungen ohne Antwort lässt sich
kein Muster lesen.

Und er empfiehlt nie „bewirb dich mehr".

## 13. Gespräch vorbereiten → `/app/coaching/[id]`

Fragen aus **dieser** Stelle und **diesem** Unternehmen, jeweils mit
Herkunftsangabe. Rückmeldung zu Bezug, Aufbau, konkreten Belegen,
Verständlichkeit und dem, was fehlt.

STAR-Geschichten ausschließlich aus bestätigter Evidenz.

**Nicht bewertet:** Stimme, Gesicht, Akzent, Wirkung, Ehrlichkeit.

## 14. Angebote vergleichen → `/app/offers`

Nicht nur das Grundgehalt — auch Bonus, Stunden, Remote-Anteil, Urlaub,
Probezeit, Frist. Das Grundgehalt bestimmt selten den Alltag.

## 15. Nach dem Start → `/app/check-ins`

Nach 30, 60 und 90 Tagen: Hält die Stelle, was die Anzeige versprochen
hat? Aufgaben und Energie, Führung und Team, Lernen.

Diese Antworten bleiben **privat**. Sie gehen nicht an Arbeitgeber, nicht
an Partner, nicht in Auswertungen — es sei denn, der Mensch gibt sie
ausdrücklich frei. Das ist kein Überwachungswerkzeug.

## Ninas nächste beste Handlung

Auf jeder Seite höchstens **eine** — und sie ist wegklickbar. Keine
Pop-ups.

Die Reihenfolge ist die Rangfolge: fehlendes Profil vor anstehendem
Termin vor bester Möglichkeit.
