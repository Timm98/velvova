# Datenquellen

Wie Paycheck an Stellen kommt — und wie ausdrücklich nicht.

> Erzeugte Übersichten: [LEGAL_SOURCE_REGISTER.md](LEGAL_SOURCE_REGISTER.md)
> und [SOURCE_COMPLIANCE_MATRIX.md](SOURCE_COMPLIANCE_MATRIX.md). Beide
> entstehen aus derselben Datei, die die Policy Engine benutzt, und können
> deshalb nicht von ihr abweichen.

## Das Produktversprechen, korrekt formuliert

Paycheck durchsucht **freigegebene Partnerquellen, lizenzierte Jobdaten,
autorisierte Arbeitgeberseiten und vom Nutzer privat hinzugefügte
Stellen.** Nina vereinheitlicht, prüft, bewertet und rankt diese
Möglichkeiten und führt mit einem vorbereiteten Bewerbungspaket zur
autorisierten Originalquelle.

Was hier bewusst **nicht** steht: „durchsucht jede Jobplattform im
Internet". Diese Behauptung wäre nicht nur falsch, sie ist im Code
strukturell ausgeschlossen — `coverageStatement()` bildet die Reichweite
aus gezählten Entscheidungen, nicht aus einer Formulierung.

## Die vier Wege

| Weg | Was passiert | Beispiel |
|---|---|---|
| **Licensed Index** | Abruf nach Vertrag bzw. API-Bedingungen, nur erlaubte Felder | Arbeitnow, später Jooble, Adzuna, Lightcast |
| **Arbeitgeber / ATS** | Je Arbeitgeber, nach Domainverifikation | Greenhouse, Lever, Ashby, SmartRecruiters |
| **Nur Verweis** | Kein Abruf, keine Kopie, kein Index — nur ein Link, den eine Person selbst öffnet | LinkedIn, Indeed, StepStone, Monster, XING |
| **Privater Import** | Die Person bringt Link oder Text selbst ein; bleibt privat | beliebige Stelle |

## Die Trennung, auf die alles hinausläuft

```
Discovery   →  eine Websuche findet eine Adresse
Access      →  die Policy Engine entscheidet, ob der Inhalt zugänglich ist
Ingestion   →  nur erlaubte Felder werden geladen
Transform   →  erlaubte Fakten werden zusammengefasst, Ableitung wird markiert
Display     →  Quelle, Aktualität, Attribution und Original bleiben sichtbar
Apply       →  vorbereitet; übermittelt nur autorisiert und nach Bestätigung
```

**Entdeckung ist keine Erlaubnis.** Dass eine Suchmaschine eine Stelle
findet, sagt nichts darüber, ob ihr Inhalt kopiert werden darf.

## Umformulieren ist keine Rechtsgrundlage

Der wichtigste Satz dieses Dokuments. Eine Anzeige, die nicht abgerufen
werden darf, darf auch nicht abgerufen und dann anders formuliert
werden. Deshalb entscheidet die Engine über den **Zugriff**, nicht über
die Darstellung — und deshalb gibt es keinen Weg, `Summarize` zu
erhalten, ohne `FetchDetails` zu haben.

Geprüft in `policy-engine.test.ts`:

```
it("lässt eine Zusammenfassung nicht durch, wo das Lesen verboten ist")
```

## Was fehlt, bleibt leer

- Kein Gehalt in der Quelle → **„Nicht angegeben"**. Keine Schätzung.
- Kein Arbeitsmodell → **unbekannt**.
- Keine Vertragsart → **nicht angegeben**.

Adzuna kennzeichnet geschätzte Gehälter. Die Schätzung wandert in die
Rohdaten, nicht ins Gehaltsfeld: eine Schätzung, die wie eine Zusage
aussieht, ist schlimmer als keine Angabe.

## Kill Switch

Jede Quelle lässt sich über `source_registry.enabled` abschalten — ohne
Auslieferung. Die Prüfung sitzt **vor** dem ersten Netzzugriff. Ein
Abruf, der erst hinterher als unzulässig erkannt wird, hat bereits
stattgefunden.

Eine Quelle, deren dokumentierte Prüfung fällig ist
(`nextLegalReviewAt` in der Vergangenheit), wechselt selbsttätig auf
`ungeprüft`. Eine Freigabe, die niemand mehr ansieht, ist keine
Freigabe.

## Keine Rechtsberatung

Dies ist eine technische Risikosteuerung. Vor einem öffentlichen
Betrieb, großflächiger Metasuche, Bewertungsaggregation oder nativer
Bewerbung muss eine spezialisierte Kanzlei die konkreten Verträge,
Länder und Datenflüsse prüfen.
