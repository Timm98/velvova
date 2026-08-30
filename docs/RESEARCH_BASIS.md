# Forschungsgrundlage

Worauf die Bewertungslogik beruht — und worauf ausdrücklich nicht.

## Die ehrliche Vorbemerkung

**Dieses Produkt ist nicht wissenschaftlich validiert, und es behauptet das
nirgends.** Die Bewertungslogik ist begründet, offengelegt und nachvollziehbar.
Das ist etwas anderes als geprüft.

Der Unterschied ist wichtig, weil in diesem Marktsegment gern das eine gesagt
wird, wenn nur das andere vorliegt. Ein Passungswert mit zwei Nachkommastellen
sieht nach Messung aus. Er ist eine gewichtete Summe begründeter Annahmen.

## Woran sich die Entscheidungen anlehnen

**Verhaltensbasiertes Fragen.** Die Idee, nach konkreten Situationen zu fragen
statt nach Selbsteinschätzungen, ist Standard in der Eignungsdiagnostik. Sie
liegt dem Gesprächsaufbau zugrunde: „Erzähl mir von einer Situation, in der…“
statt „Bist du…?“.

Belastbar ist daran der Grundgedanke. Nicht belastbar ist eine Aussage darüber,
wie gut **diese konkrete** Fragenreihe funktioniert. Zwölf Themen sind eine
Setzung.

**Kompetenz aus Tätigkeiten.** Berufe werden über Tätigkeiten beschreibbar, und
Tätigkeiten sind zwischen Berufen übertragbar — die Grundlage jedes
Wechselvorschlags. ESCO und O*NET arbeiten so. Eine Anbindung an ESCO ist
vorgesehen, aber **nicht umgesetzt**; die Rollenzuordnung ist derzeit
regelbasiert und gröber.

**Unsicherheit getrennt ausweisen.** Dass eine Schätzung und ihre Verlässlichkeit
zwei verschiedene Zahlen sind, ist keine Erfindung dieses Produkts. Es ist der
Grund, warum es fünf getrennte Werte gibt und keinen Gesamtscore: ein Mischwert
aus Passung und Datenlage ist in beide Richtungen nicht interpretierbar.

**Unbekanntes ist neutral.** Fehlende Angaben werden nicht als Null behandelt,
sondern ihr Gewicht wird umverteilt. Das folgt aus dem Umgang mit fehlenden
Werten in der Statistik — und aus einer Fairnessüberlegung: eine Anzeige, die
schweigt, darf die Person nicht schlechter dastehen lassen.

## Was ausdrücklich nicht behauptet wird

- **Keine Vorhersage über Einstellungserfolg.** Es gibt keine Kalibrierung an
  tatsächlichen Ergebnissen. Ein Passungswert sagt, wie gut ein Profil zu einer
  Anzeige passt — nicht, ob jemand genommen wird.
- **Keine Persönlichkeitsmessung.** Kein Fünf-Faktoren-Modell, kein Typenmodell,
  keine Ableitung stabiler Eigenschaften aus Freitext.
- **Keine Aussage über geschützte Merkmale.** Nicht geschätzt, nicht abgeleitet,
  nicht als Faktor benutzt.
- **Keine deterministische Zukunftsaussage.** Die Einschätzung zum KI-Wandel
  eines Berufs ist eine Einordnung mit Datum und Unsicherheit.
- **Keine Emotions-, Gesichts-, Akzent- oder Ehrlichkeitsanalyse.** Es gibt
  keinen Codepfad dafür, und es soll keinen geben.

## Die Gewichte

Die Faktorgewichte in `packages/domain/src/scoring.ts` sind begründet und
dokumentiert (`docs/MATCHING.md`), aber **nicht empirisch bestimmt**. Sie
stammen aus Überlegungen dazu, was für eine suchende Person zählt — nicht aus
Daten darüber, was zu Einstellungen führt.

Jedes Ergebnis wird mit der Fassung der Bewertungslogik fortgeschrieben, die es
erzeugt hat. Ändern sich die Gewichte, bleibt ein früher angezeigter Wert
erklärbar. Das ist die Mindestvoraussetzung dafür, die Gewichte später
überhaupt kalibrieren zu können.

## Was eine Validierung bräuchte

Damit hier eines Tages mehr stehen kann als „begründet“:

- Ergebnisdaten: welche Bewerbung führte wozu, über genug Fälle
- eine Kontrollgruppe oder mindestens ein Vergleich gegen eine einfache
  Grundlinie
- eine Prüfung auf ungleiche Wirkung zwischen Gruppen
- eine unabhängige Stelle, die das prüft

Nichts davon liegt vor. Bis dahin gilt der erste Absatz.
