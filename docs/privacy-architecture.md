# Datenschutzarchitektur

Wohin welche Daten fließen, wer sie verarbeitet, und was das für den
Betrieb bedeutet.

Der Satz „unsere Daten liegen in unserer Datenbank" reicht nicht. Er ist
wahr und trotzdem irreführend: für jede Antwort der Assistenz verlässt
Text das Haus. Dieses Dokument sagt, welcher.

---

## 1. Datenklassen

| Klasse | Beispiele | Wohin sie geht |
|---|---|---|
| **Identität** | E-Mail, Anzeigename, Sitzungstoken | ausschließlich eigene Datenbank |
| **Karriereinhalt** | Interviewantworten, Evidenz, Stärken, Bedingungen | Datenbank; Ausschnitte an den Modellanbieter |
| **Dokumente** | Lebenslauf, Zeugnisse, erzeugte Unterlagen | Dateiablage; extrahierter Text kann an den Modellanbieter gehen |
| **Sprachaufnahmen** | Mikrofonaufnahmen | zum Abtippen an den Sprachanbieter, danach standardmäßig gelöscht |
| **Betriebsdaten** | Modellläufe, Token-Zahlen, Fehler | Datenbank, redigiert |
| **Ereignisse** | Onboarding begonnen, Bewerbung versendet | Datenbank, pseudonym |

## 2. Die Trennlinie

An das Sprachmodell geht **Karriereinhalt**, nie **Identität**.

Konkret: Der Kontext für ein Interview enthält bisherige Antworten,
bestätigte Evidenz und die Stufe des Gesprächs. Er enthält nicht die
E-Mail-Adresse, nicht den Anzeigenamen, nicht die Anschrift und nicht
die Nutzerkennung aus der Datenbank. Wo eine Kennung nötig ist, wird eine
interne, pseudonyme verwendet.

Das ist keine vollständige Anonymisierung — ein Lebenslauf ist seinem
Wesen nach identifizierend. Es ist Datenminimierung: es geht nur, was der
Schritt braucht.

## 3. Anbieter

| Rolle | Anbieter | Auswahl über | Status |
|---|---|---|---|
| Sprachmodell | OpenAI, Anthropic oder selbst betrieben | `AI_PROVIDER` | ohne Schlüssel: lokaler Demo-Anbieter |
| Spracherkennung | derselbe Anbieter | `VOICE_PROVIDER` | nicht eingerichtet |
| Dateiablage | lokal oder S3-kompatibel | `STORAGE_DRIVER` | lokal |
| E-Mail | Entwurf, SMTP, später Gmail/Graph | `MAIL_PROVIDER` | nur Entwurf |
| Stellenquellen | Arbeitnow, später weitere | `JOB_SOURCES` | Arbeitnow aktiv |

Der Anbieter ist austauschbar, weil der Fachcode ihn nicht kennt: er
spricht mit `AiProvider`, nicht mit einem SDK. Das ist kein Selbstzweck.
Für besonders schutzbedürftige Verarbeitung muss ein selbst betriebener
Weg offenstehen, ohne dass das Produkt umgebaut wird — dafür gibt es
`AI_PROVIDER=self_hosted` mit einem OpenAI-kompatiblen Endpunkt.

## 4. Was vor dem Betrieb zu klären ist

Diese Punkte sind **nicht** erledigt und dürfen vor einem öffentlichen
Betrieb nicht übersehen werden:

1. **Auftragsverarbeitungsvertrag** mit jedem Anbieter, der
   personenbezogene Daten verarbeitet — mindestens Modellanbieter,
   Sprachanbieter, Objektspeicher, E-Mail-Versand.
2. **Verarbeitungsort.** Für den EU-Betrieb ist ein Anbieter mit
   EU-Verarbeitung zu wählen oder ein Übermittlungsmechanismus nach
   Kapitel V DSGVO zu dokumentieren.
3. **Kein Training mit Kundendaten.** Bei OpenAI ist das für
   API-Verkehr die Voreinstellung; es ist dennoch vertraglich zu
   bestätigen und im Verzeichnis der Verarbeitungstätigkeiten
   festzuhalten.
4. **Verzeichnis der Verarbeitungstätigkeiten** nach Art. 30 DSGVO.
5. **Datenschutz-Folgenabschätzung.** Sie ist hier wahrscheinlich
   erforderlich: umfangreiche Verarbeitung, teils sensible Angaben,
   automatisierte Bewertung mit Wirkung auf berufliche Chancen.
6. **Löschfristen** je Datenklasse, technisch durchgesetzt statt nur
   dokumentiert.

## 5. Was im Produkt bereits gilt

- **Einwilligungen einzeln**, mit Zweck, Fassung und Zeitpunkt.
  Widerruf wirkt sofort und wird in derselben Zeile protokolliert.
- **Training mit Nutzerdaten ist aus**, als Voreinstellung, und braucht
  eine eigene ausdrückliche Zustimmung.
- **Weitergabe an Partner ist aus.** Ohne Zustimmung sehen
  institutionelle Partner ausschließlich aggregierte Zahlen, nie ein
  Profil.
- **Sprachaufnahmen werden nach dem Abtippen gelöscht**, als
  Voreinstellung. Eine Aufnahme ist ein biometrisches Datum; sie ohne
  Not aufzubewahren wäre eine Sammlung ohne Zweck.
- **Export** liefert alles, was zu einer Person gespeichert ist — ohne
  Passworthash und ohne Sitzungstoken, weil beides Geheimnisse sind und
  im Export nichts zu suchen haben.
- **Löschung** entfernt das Konto samt abhängiger Daten.
- **Row Level Security** auf jeder nutzerbezogenen Tabelle, durchgesetzt
  über eine eingeschränkte Rolle. Ein Test prüft das; er hat bereits
  einen echten Fehler gefunden.
- **Protokolle sind redigiert.** In `ai_runs` stehen Kennungen, Modell,
  Token-Zahlen und Fehlerklassen — keine Lebensläufe, keine Gespräche.

## 6. Was ausdrücklich nicht stattfindet

Nicht abgeleitet, nicht gespeichert, nicht bewertet:

- geschützte Merkmale (Herkunft, Religion, Gesundheit, Orientierung,
  Gewerkschaftszugehörigkeit, Familienstand) — auch nicht mittelbar aus
  Name, Stimme oder Schreibstil,
- Emotionen, Ehrlichkeit, Akzent, Gesicht,
- psychologische Diagnosen,
- eine Einstellungswahrscheinlichkeit. Der Passungswert ist eine Aussage
  über Übereinstimmung mit belegten Angaben, nicht über das Verhalten
  eines Arbeitgebers.
