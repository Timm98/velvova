# Produkt

## Der Produktsatz

Paycheck ist ein kandidatenkontrolliertes, evidenzbasiertes
KI-Karriere-Betriebssystem für qualifizierte Berufseinsteiger und junge
Jobwechsler. Es erstellt aus realen Erfahrungen ein nachvollziehbares
Karriereprofil und begleitet von passenden Berufsfeldern über reale
Stellen bis zu Bewerbung, Interview, Angebot und gutem Job.

Beide Namen — Paycheck und Monday — sind vorläufig und stehen in
`packages/config/src/brand.ts`.

## Das Herzstück

Die Karriereanalyse. Jobmatching, Dokumente und Coaching bauen **nicht**
auf einem Chatverlauf auf, sondern auf einem bestätigten, editierbaren
**Career Evidence Graph**.

Der Unterschied ist nicht kosmetisch. Ein Chatprofil kann nicht sagen,
worauf eine Empfehlung beruht. Ein Evidence Graph kann es — jede Aussage
trägt Herkunft, Sicherheit und den Zustand ihrer Bestätigung.

## Für wen

- 22 bis 29 Jahre, mindestens 18
- abgeschlossene oder fast abgeschlossene qualifizierte Ausbildung,
  Bachelor oder Master
- null bis fünf Jahre Berufserfahrung
- sucht die erste oder nächste qualifizierte Stelle
- **kann keine zwei bis drei realistischen Zielrollen begründen** oder
  hat rund zehn Bewerbungen ohne Gespräch verschickt
- kann eigene Erfahrungen nicht gut in Fähigkeiten, Ergebnisse und
  Arbeitgebernutzen übersetzen
- hat konkrete Grenzen bei Gehalt, Ort, Pendelzeit, Remote-Anteil,
  Arbeitszeit, Reisen oder Schichtarbeit

### Die Demo-Persona

**Lea, 25.** BWL-Bachelor, zwei Jahre Kundenservice und Operations. Sucht
uneinheitlich zwischen Marketing, Projektmanagement und Customer
Success. 14 Bewerbungen, ein kurzes Telefoninterview.

No-Gos: unter 42.000 Euro, mehr als 45 Minuten Pendelzeit, reine
Kaltakquise, dauerhafte Schichtarbeit.

Sie steht in den Seed-Daten (`packages/db/src/seed/lea.ts`) und ist der
Maßstab für jede Entscheidung: Wenn eine Funktion Lea nicht hilft,
gehört sie nicht ins MVP.

## Das Problem, das gelöst wird

Nicht „Jobs finden". Eine Kette:

1. unklare berufliche Richtung
2. schlecht übersetzte Erfahrungen
3. zu enge oder falsche Jobtitel
4. unklare Muss- und Kann-Anforderungen
5. fehlende Transparenz über tatsächliche Jobqualität
6. generische Bewerbungen
7. Ghosting ohne Lernschleife
8. Unsicherheit über die Entwicklung einer Rolle durch KI
9. fehlende Begleitung zwischen Suche, Bewerbung, Gespräch, Angebot und
   Jobstart

## Was ausdrücklich nicht gebaut wird

- eine weitere überladene Jobbörse
- eine endlose Anzeigenliste
- Massen-Auto-Apply oder ein unkontrollierter Bewerbungs-Bot
- Black-Box-Persönlichkeitsdiagnose
- Lügendetektion
- Emotions-, Gesichts- oder Akzentbewertung
- deterministische Aussagen wie „Dieser Beruf verschwindet in fünf Jahren"
- ein Score, der als Einstellungswahrscheinlichkeit ausgegeben wird
- automatische Arbeitgeberentscheidungen über Bewerber
- ungeprüftes Kopieren bestehender Marken

## Die zehn Differenzierungsmerkmale

Viele Einzelmerkmale existieren am Markt. Eine KI, die Jobs empfiehlt,
Lebensläufe anpasst und Interviews simuliert, ist für sich genommen keine
Differenzierung. Diese zehn sind es:

| # | Merkmal | Wogegen |
|---|---|---|
| 1 | **Career Evidence Graph** | statt bloßem Chatverlauf |
| 2 | **Adjacent & Niche Role Explorer** | statt nur bekannter Standardberufe |
| 3 | **Erklärbares Matching plus getrennte Confidence** | statt eines Prozentwerts, der Unsicherheit verschluckt |
| 4 | **Eigener Job-Quality-Score** | statt nur fachlicher Passung |
| 5 | **AI Transition Radar auf Aufgabenebene** | statt Angst-Score für ganze Berufe |
| 6 | **Listing Confidence & Freshness** | statt stiller Reposts und toter Anzeigen |
| 7 | **Source-linked Job Reality Check** | statt Bewertungen ohne Kontext |
| 8 | **Application Funnel Debugger** | statt „bewirb dich mehr" |
| 9 | **Kandidatenkontrolliertes Gedächtnis** | statt undurchsichtiger Profilbildung |
| 10 | **30/60/90-Tage-Jobstart-Loop** | statt Ende nach Vertragsunterschrift |

## Die zehn Produktprinzipien

**1. Interview vor personalisierter Jobsuche.** Empfehlungen erst nach
bestätigtem Mindestprofil. Technisch durchgesetzt in `loadGate()`.

**2. Progressive Disclosure.** Eine Hauptaktion je Bildschirm, höchstens
drei große Bereiche über der Falz, Details aufklappbar.

**3. Weniger, bessere Optionen.** Eine begründete Auswahl statt
hunderter Anzeigen.

**4. Evidence before eloquence.** Eine schön formulierte Behauptung ist
wertlos, wenn sie nicht belegt ist. Ohne Beleg keine Freigabe.

**5. Fakten, Ableitungen und externe Informationen trennen.** Jede
Aussage ist als Nutzerfakt, Hypothese oder externe Quelle erkennbar.

**6. Unbekannt ist nicht schlecht.** Fehlende Daten gehen nie als
negativer Wert in einen Score ein.

**7. Unsicherheit sichtbar machen.** Score und Confidence getrennt.

**8. Der Mensch bleibt Entscheider.** Monday empfiehlt, erklärt, fragt nach
und bereitet vor. Sie sendet und entscheidet nicht.

**9. Keine unnötige Datensammlung.** Jede Kategorie braucht Zweck,
Einwilligung, Aufbewahrungsregel und Löschmöglichkeit.

**10. Design für Menschen unter Stress.** Ruhig, verständlich, kein
Gamification-Druck, keine Countdowns. Wer Arbeit sucht, steht ohnehin
unter Druck.

## Nordstern-Kennzahl

**Qualifizierte Fortschrittsereignisse pro aktiviertem Menschen** —
bestätigte Zielrolle, gespeicherte Stelle mit hoher Passung, hochwertige
Bewerbung, Gespräch, Angebot, positiver 90-Tage-Fit.

Ausdrücklich **nicht**: tägliche Nutzungszeit, Bewerbungsmenge,
Sitzungslänge. Das Produkt soll nicht länger genutzt werden als nötig.

## Was gute Muster übernimmt

Ohne visuelle oder textliche Kopie: natürliche Sprache für die Suche,
sichtbare Gehalts- und Standortinformationen, ein wiederverwendbares
Profil, schnelle Bewerbung bei geeigneten Stellen, Statusverfolgung,
CV-Optimierung, Interviewtraining, verständliche Match-Erklärungen,
mobile Nutzbarkeit, wenig Reibung, klare nächste Schritte.
