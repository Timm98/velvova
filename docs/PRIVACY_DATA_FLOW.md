# Datenflüsse

Wo personenbezogene Daten entstehen, wohin sie gehen und was sie nie verlässt.

## Die Grundregel

**Die Person besitzt ihr Profil.** Nichts davon geht an einen Arbeitgeber, an
eine Organisation oder an ein anderes Konto, ohne dass sie es einzeln freigibt.
Das ist keine Einstellung, die man umlegen kann — es gibt keinen Weg im Code,
der ein individuelles Profil ohne Freigabe herausgibt.

## Was entsteht

| Woher | Was | Wo es liegt |
| --- | --- | --- |
| Karrieregespräch | Freitextantworten | `interview_turns` |
| daraus abgeleitet | Aussagen mit Beleg oder Vermutung | `evidence_items` |
| Angaben der Person | harte Bedingungen | `user_constraints` |
| Verhalten in der App | gemerkte Stellen, Bewerbungen | `saved_jobs`, `applications` |
| Erzeugung | Anschreiben, Lebenslaufteile | `generated_artifacts` |
| Betrieb | Kennzahlen je Modellaufruf, **ohne Inhalt** | `ai_runs` |

`evidence_items` trägt immer eine Herkunft: `user_stated`, `user_confirmed`,
`document_extract`, `ai_hypothesis`, `external_source`, `work_sample`. Eine
Vermutung zählt nicht, bevor die Person sie bestätigt hat — sie steht in der
Oberfläche sichtbar getrennt.

## Was hinausgeht

**An den Modellanbieter** — bei jedem Gespräch:

- der Systemprompt
- bestätigte Fakten, offene Vermutungen, harte Bedingungen, verworfene Aussagen
- die letzten zehn Gesprächszüge
- die Werkzeugschemata

Nicht: der vollständige Gesprächsverlauf, Dokumentinhalte, E-Mail-Adresse,
Name, Kennungen anderer Personen.

Ohne Schlüssel läuft der lokale Demo-Anbieter, und es geht überhaupt nichts
hinaus. Der Zustand ist im Gespräch sichtbar beschriftet, nicht in einer
Fussnote.

**An die Stellenquelle** — nur Suchbegriffe, nie Profildaten. Eine Suche nach
„Pflegefachkraft Hamburg“ enthält keinen Hinweis darauf, wer sucht.

**An den Arbeitgeber** — nur, was die Person nach Sichtung freigegeben hat, und
nur über einen Weg, den sie ausdrücklich bestätigt. Kein Massenversand, keine
automatische Bewerbung.

## Was nie hinausgeht

- der vollständige Gesprächsverlauf
- Dokumentinhalte an einen Modellanbieter, wenn ein selbst betriebener Pfad
  konfiguriert ist
- individuelle Profile an eine Organisation. `memberships.can_see_individual_profiles`
  steht auf `false` und wird von keinem Codepfad benutzt.
- Anzeigentexte oder Gesprächsinhalte in Protokolle. `ai_runs` speichert
  Kennzahlen und die Fehlermeldung, nie die Anfrage.

## Aufbewahrung

`evidence_items.retention_class` steuert, wie lange etwas bleibt. Ein Löschen
ist ein Löschen: wird ein Beleg entfernt, verlieren die Aussagen, die darauf
beruhten, ihre Grundlage — sie bleiben nicht als hübsch formulierter Satz ohne
Fundament zurück.

Kontolöschung verlangt eine Tippbestätigung und läuft über `privacy_requests`
mit einem nachvollziehbaren Zustand. `deletedAt` ist zunächst ein weiches
Löschen; der harte Lauf räumt kontrolliert nach.

## Rechte der Person

| Recht | Wo im Produkt |
| --- | --- |
| Auskunft | `/app/settings/privacy`, Export der eigenen Daten |
| Berichtigung | jede Aussage im Profil ist einzeln änderbar |
| Löschung | Kontolöschung mit Tippbestätigung |
| Einschränkung | Einwilligungen einzeln widerrufbar |
| Widerspruch | Modellnutzung abwählbar, Bewertung läuft regelbasiert weiter |

Der letzte Punkt ist der wichtigste: **die Bewertungslogik braucht kein
Sprachmodell.** Wer der Modellnutzung widerspricht, verliert das Gespräch, aber
nicht das Produkt.

## Grenzen

Was hier steht, beschreibt den Code. Es ersetzt keine Datenschutz-Folgen­abschätzung
(`docs/DPIA_DRAFT.md` ist ein Entwurf) und keine Rechtsberatung.
