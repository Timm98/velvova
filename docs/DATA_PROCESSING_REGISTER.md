# Verzeichnis von Verarbeitungstätigkeiten

Entwurf nach Art. 30 DSGVO. Zu ergänzen sind die Angaben zur verantwortlichen
Stelle, sobald sie feststehen.

## Verantwortliche Stelle

| Feld | Wert |
| --- | --- |
| Name | *offen* |
| Anschrift | *offen* |
| Datenschutzbeauftragte | *offen* |

## 1 — Konto und Anmeldung

**Zweck** Zugang zum eigenen Konto.
**Kategorien** E-Mail, Anzeigename, Sitzungen (nur Token-Hash), externe
Kontoverknüpfungen.
**Betroffene** Nutzende.
**Empfänger** keine.
**Drittland** nein.
**Frist** bis zur Löschung; Sitzungen laufen nach 30 Tagen ab.
**Massnahmen** RLS, Token nur als Hash, httpOnly-Cookie.

## 2 — Karrieregespräch

**Zweck** Erfahrungen erheben und in belegte Aussagen überführen.
**Kategorien** Freitextantworten, abgeleitete Aussagen mit Herkunft und
Zuversicht, Gesprächsfortschritt.
**Besondere Kategorien** im Freitext möglich: Gesundheit, Familienstand,
Weltanschauung. Nicht erhoben, aber nicht auszuschliessen.
**Empfänger** Modellanbieter, nur in Auszügen, nur mit Einwilligung.
**Frist** bis zur Löschung.
**Massnahmen** RLS, Kontextbegrenzung, Herkunft je Aussage, Ausgabeprüfung.

## 3 — Bedingungen und Vorlieben

**Zweck** Stellen ausschliessen, die nicht in Frage kommen.
**Kategorien** Mindestgehalt, Pendelgrenze, Arbeitsmodell, Verfügbarkeit.
**Empfänger** keine. Diese Daten gehen nicht an Stellenquellen.
**Frist** bis zur Löschung.

## 4 — Stellenbewertung

**Zweck** Passung, Zuversicht, Anzeigenqualität berechnen.
**Kategorien** Profil, Anzeigendaten, Ergebnis mit Fassung der Bewertungslogik.
**Empfänger** keine.
**Frist** Ergebnis wird fortgeschrieben, damit ein angezeigter Wert später
erklärbar bleibt.
**Massnahmen** regelbasiert, ohne Modellbeteiligung; jeder Wert mit Begründung.

## 5 — Bewerbungen

**Zweck** Unterlagen erzeugen, Verlauf nachhalten.
**Kategorien** Anschreiben, Lebenslaufteile, Bewerbungszustand, Belegabgleich
je Aussage.
**Empfänger** Arbeitgeber — **nur nach ausdrücklicher Freigabe**, einzeln.
**Frist** bis zur Löschung.
**Massnahmen** zwei getrennte Riegel: keine Freigabe bei unbelegter Aussage,
kein Versand ohne Freigabe.

## 6 — Modellaufrufe

**Zweck** Gespräch, Ableitung, Textentwürfe.
**Kategorien** Systemprompt, Auszug des Profils, letzte zehn Gesprächszüge.
**Empfänger** der konfigurierte Modellanbieter.
**Drittland** möglich — abhängig vom Anbieter. **Zu klären vor Produktivbetrieb.**
**Frist** kein Gedächtnis beim Anbieter; der Verlauf bleibt bei uns.
**Massnahmen** Datenminimierung vor Versand, kein Name, keine E-Mail-Adresse,
kein vollständiger Verlauf.

## 7 — Betrieb und Kosten

**Zweck** Verfügbarkeit und Kosten überwachen.
**Kategorien** Kennzahlen je Modellaufruf: Anbieter, Modell, Zeitdauer,
Tokenzahl, Status, Fehlermeldung. **Keine Inhalte.**
**Frist** 90 Tage.
**Massnahmen** Fehlermeldungen ohne Anzeigentext und ohne Gesprächsinhalt.

## 8 — Stellendaten

**Zweck** Anzeigen abrufen und darstellen.
**Kategorien** Anzeigendaten, Unternehmensdaten, Quellenverweise. **Kein
Personenbezug zu Nutzenden.**
**Empfänger** Stellenquellen erhalten Suchbegriffe, keine Profildaten.
**Massnahmen** Source Registry und Policy Engine entscheiden vor jedem Abruf;
feldgenaue Herkunft je Datenpunkt.

## Auftragsverarbeiter

| Wer | Wofür | Vertrag |
| --- | --- | --- |
| Modellanbieter | Gespräch, Textentwürfe | **offen** |
| Datenbankbetrieb | Speicherung | **offen** |

Ohne diese Verträge ist kein Produktivbetrieb möglich.
