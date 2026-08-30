# Datenschutz-Folgenabschätzung (Entwurf)

**Das hier ist ein Entwurf, keine Bewertung.** Er sammelt, was aus dem Code
belegbar ist, damit eine verantwortliche Person nicht bei null anfängt. Er
ersetzt weder eine Rechtsberatung noch die Zeichnung durch die Verantwortliche.

## Warum eine Folgenabschätzung nötig ist

Drei Merkmale, die je für sich schon Anlass geben:

- systematische und umfangreiche Bewertung persönlicher Aspekte auf
  automatisierter Grundlage
- besondere Kategorien personenbezogener Daten, die im Freitext eines
  Karrieregesprächs unvermeidlich auftauchen — eine gesundheitliche
  Einschränkung als harte Bedingung, eine Familiensituation hinter einer
  Pendelgrenze
- ein Kontext mit strukturellem Machtgefälle: wer Arbeit sucht, steht unter
  Druck und stimmt eher zu

## Verarbeitungen

| Zweck | Daten | Grundlage | Aufbewahrung |
| --- | --- | --- | --- |
| Karrieregespräch führen | Freitextantworten | Vertrag | bis zur Löschung |
| Profil ableiten | Aussagen mit Herkunft | Vertrag | bis zur Löschung |
| Stellen bewerten | Profil + Anzeigendaten | Vertrag | Ergebnis fortgeschrieben |
| Bewerbungen erzeugen | Profil + Anzeige | Vertrag | bis zur Löschung |
| Modellaufrufe | Auszug des Profils | Einwilligung, widerruflich | kein Anbietergedächtnis |
| Betriebskennzahlen | Kennzahlen **ohne Inhalt** | berechtigtes Interesse | 90 Tage |

Die Zeile „Modellaufrufe“ steht auf Einwilligung und nicht auf Vertrag, weil
die Bewertungslogik ohne Modell funktioniert. Ein Widerruf kostet das Gespräch,
nicht das Produkt — und nur deshalb ist die Einwilligung freiwillig im Sinne
des Wortes.

## Risiken und was dagegen steht

**Ein Nutzer sieht fremde Daten.**
Sehr hoher Schaden, geringe Wahrscheinlichkeit.
RLS auf 33 Tabellen, eigene eingeschränkte Datenbankrolle, Nutzerkennung
ausschliesslich aus der Serversitzung. Geprüft mit echtem Postgres und zwei
Nutzern. Ohne gesetzte Kennung ist das Ergebnis leer, nicht vollständig.
*Restrisiko: getragen.*

**Ein Arbeitgeber sieht ein Profil ungefragt.**
Sehr hoher Schaden, sehr geringe Wahrscheinlichkeit.
Es gibt keinen Codepfad. `memberships.can_see_individual_profiles` steht auf
`false` und wird nirgends gelesen.
*Restrisiko: getragen.*

**Ein Modellanbieter bekommt mehr als nötig.**
Mittlerer Schaden, mittlere Wahrscheinlichkeit.
Der Kontext-Umschlag begrenzt auf bestätigte Fakten, offene Vermutungen, harte
Bedingungen und die letzten zehn Züge. Kein Name, keine E-Mail-Adresse, kein
vollständiger Verlauf.
*Restrisiko: getragen, solange ein Auftragsverarbeitungsvertrag besteht.*
**Offen: der Vertrag.**

**Eine falsche Aussage im Profil führt zu einer falschen Bewerbung.**
Hoher Schaden für die Person, hohe Wahrscheinlichkeit ohne Gegenmassnahme.
Jede abgeleitete Aussage ist unbestätigt und zählt nicht. Jeder Satz in einem
Dokument wird gegen die Belege gehalten; eine unbelegte Aussage sperrt die
Freigabe.
*Restrisiko: getragen.*

**Eine Zuschreibung geschützter Merkmale.**
Sehr hoher Schaden, geringe Wahrscheinlichkeit.
Ausgabeprüfung verwirft solche Antworten, statt sie zu bereinigen. Keine
Emotions-, Gesichts-, Akzent- oder Ehrlichkeitsanalyse im Code.
*Restrisiko: getragen.*

**Besondere Kategorien im Freitext.**
Hoher Schaden, hohe Wahrscheinlichkeit — die Person erzählt sie beiläufig.
`sensitivity_level` und `retention_class` je Aussage; das Feld
`statementEncrypted` ist vorgesehen.
*Restrisiko: **nicht getragen.** Die Verschlüsselung ist nicht implementiert.*

**Eine Sitzung wird übernommen.**
Mittlerer Schaden, geringe Wahrscheinlichkeit.
Nur der Token-Hash gespeichert, Cookie httpOnly/sameSite, Sitzungen einzeln
widerrufbar.
*Restrisiko: **teilweise getragen.** Kein Ratenlimit, keine
Zwei-Faktor-Authentisierung.*

## Rechte der betroffenen Person

Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch sind im Produkt
umgesetzt (`/app/settings/privacy`). Der Widerspruch gegen die Modellnutzung
ist wirksam, weil die Bewertung ohne Modell weiterläuft.

Löschen bedeutet Löschen: wird ein Beleg entfernt, verlieren die darauf
gestützten Aussagen ihre Grundlage.

## Offen vor Produktivbetrieb

- [ ] Auftragsverarbeitungsvertrag mit jedem Modellanbieter
- [ ] Verschlüsselung besonders schutzbedürftiger Freitexte
- [ ] Ratenlimit auf Anmeldung und Gesprächsendpunkten
- [ ] Zeichnung durch die verantwortliche Person
- [ ] Prüfung der Einstufung nach KI-Verordnung durch eine Juristin
- [ ] Aufbewahrungsfristen technisch durchgesetzt, nicht nur dokumentiert
