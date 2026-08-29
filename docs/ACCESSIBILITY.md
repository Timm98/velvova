# Barrierefreiheit

Ziel: WCAG 2.2 AA. Was geprüft ist, steht unten mit dem Prüfverfahren —
was nicht geprüft ist, ebenfalls.

## Automatisch geprüft

`pnpm test:e2e:a11y` — axe über alle Hauptseiten, öffentlich und
angemeldet, in beiden Darstellungen.

**20 von 20 Prüfungen bestehen**, davon 13 mit axe und 7 zur
Tastaturbedienung.

## Vier Verstöße, die axe gefunden hat

Sie stehen hier, weil sie zeigen, wofür ein solcher Test da ist.

**1. Kontrast nur gegen die hellste Fläche geprüft.**
`--text-muted` hielt 4.5:1 gegen `--surface-page`, fiel aber auf
`--surface-inset` auf 3.73 (hell) und 3.93 (dunkel). Ein Kontrast muss
gegen **jede** Fläche halten, auf der die Farbe erscheint. Die heutigen
Werte halten mindestens 4.66 und 4.78 auf der jeweils schwierigsten.

**2. Zustände über Deckkraft.**
Abgelehnte Belege wurden mit `opacity: 0.55` abgeblendet, ausgeschlossene
Stellen mit `0.7`. Das senkt den Kontrast unter die Schwelle **und**
macht den Zustand von der Erscheinung abhängig. Jetzt trägt ihn eine
abgesenkte Fläche plus das Etikett als Text.

**3. Links nur an der Farbe erkennbar.**
Innerhalb von Absätzen und Listen sind sie jetzt unterstrichen.
Eigenständige Links in der Navigation bleiben ohne Linie — sie sind
durch ihre Stellung erkennbar.

**4. Weiße Schrift auf hellem Akzent im Dunkelmodus.**
2.8:1. Neues Token `--accent-on`: weiß im Hellmodus (5.96:1), dunkel im
Dunkelmodus (6.48:1).

## Umgesetzt

| Kriterium | Umsetzung |
|---|---|
| Tastaturbedienung | Vollständig; Sprungmarke ist der erste Fokus |
| Sichtbarer Fokus | `:focus-visible` mit 2px Rahmen, nirgends entfernt |
| Semantische Überschriften | Genau eine `h1` je Seite, keine übersprungene Ebene — getestet |
| Kontrast | Alle Kombinationen ≥ 4.5:1 in beiden Darstellungen |
| Nicht nur Farbe | Jeder Zustand trägt Text |
| Reduced Motion | Alle Übergänge auf 0.01ms |
| Beruhrungsziele | Mindestens 24px (WCAG 2.2), Bedienelemente 44px — getestet |
| Accessible Authentication | Kein Rätsel, kein Zeitlimit, Magic Link als Alternative |
| Fehler | Am Feld **und** als Zusammenfassung, mit `role="alert"` |
| Alternative Eingaben | Sprache ist optional, Kurzaufgaben haben zugängliche Fassungen |
| Breite Inhalte | Scrollen in sich; die Seite läuft nie seitlich über — getestet |

## Getestete Breiten

360, 390, 768, 1024, 1440 Pixel. **150 Tests** über vier Breitenpunkte
bestehen.

Auf schmalen Geräten wandert die Navigation nach unten — dieselben fünf
Punkte wie oben auf dem Desktop.

## Sprachmodus

Der Textweg ist immer vollständig verfügbar. Ist keine Spracherkennung da,
sagt die Oberfläche das — statt einen Knopf anzubieten, der nichts tut.

Die Live-Mitschrift ist sichtbar und `aria-live`. Der bewegte Kern ist
`aria-hidden` und bewegt sich nur, wenn wirklich zugehört wird.

## Was nicht geprüft ist

- **Kein Test mit Screenreader-Nutzenden.** axe findet einen Teil der
  Verstöße; ob die Oberfläche sich gut *anhört*, sagt es nicht.
- Keine Prüfung mit Sprachsteuerung.
- Keine Prüfung mit starker Vergrößerung über 200 %.
- Die native App ist nicht auf Barrierefreiheit geprüft; sie setzt
  `accessibilityRole` und `accessibilityLabel`, mehr ist nicht belegt.

Diese Punkte stehen hier, weil eine Barrierefreiheitsseite ohne offene
Punkte unglaubwürdig ist.
