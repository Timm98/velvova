# Jobquellen und Bewertungen

## Was nicht passiert

**Kein unautorisiertes Scraping.** Kein Umgehen von
Nutzungsbedingungen, Robots-Regeln, CAPTCHAs oder Zugriffssperren. Kein
Massenabruf ohne Lizenz.

Das ist keine Vorsichtsformel: eine Quelle ohne geklärte Rechtslage wird
technisch nicht aktiviert. `job_sources.license_status` muss gesetzt
sein, sonst bleibt `enabled` auf `false`.

## Erlaubte Wege

| Art | Grundlage |
|---|---|
| `licensed_api` | Vertrag mit dem Anbieter |
| `employer_feed` | Der Arbeitgeber veröffentlicht selbst |
| `partner` | Partnerdaten mit Vereinbarung |
| `user_url` | Der Mensch bringt eine URL selbst mit |
| `user_text` | Der Mensch fügt eine Beschreibung selbst ein |
| `seed` | Synthetische Demo-Daten |

Der Nutzerimport ist der einzige Weg, auf dem eine Anzeige aus einer
Quelle ohne Vertrag ins System kommt — und er ist zulässig, weil der
Mensch sie selbst mitbringt. Es wird nichts abgerufen, was er nicht
selbst geöffnet hat.

## Normalisierung

Jede Quelle wird auf dieselbe Form gebracht: Titel, Unternehmen, Ort,
Arbeitsmodell, Gehalt, Vertrag, Arbeitszeit, Erfahrungsniveau, Aufgaben,
Muss- und Kann-Anforderungen, Benefits, Bewerbungsweg,
Veröffentlichungs-, Abruf- und Ablaufdatum, Original-URL, Lizenzstatus.

**Der wichtigste Punkt:** Ein fehlendes Gehalt ist `disclosed: false` —
nicht `0`. Der Unterschied entscheidet darüber, ob eine Stelle für eine
Eigenschaft ihrer Anzeige bestraft wird.

Anforderungen ohne erkennbares Signal werden als **Muss** eingestuft. Der
Fehler in diese Richtung ist harmloser: eine zu streng gewertete
Anforderung senkt den Fit, eine zu lax gewertete täuscht Passung vor.

## Deduplizierung

Über einen Inhaltshash aus Titel, Unternehmen, Ort und Beschreibung —
bewusst nicht über die ganze Anzeige, weil Datum und Kennung sich bei
einer Wiederveröffentlichung ändern, der Text aber nicht.

Gleicher Inhalt heißt **nicht** wegwerfen: die neuere Anzeige bleibt, die
früheren werden als Vorgeschichte vermerkt. So kann die Oberfläche sagen
„das gab es schon einmal", statt still eine Version verschwinden zu
lassen.

`job_snapshots` behält die Rohfassung je Abruf.

## Bewertungen: die Quellenarten

Sechs Arten, **sichtbar getrennt**:

| Art | Was sie sagt |
|---|---|
| `employee_reviews` | Etwas über die Arbeit |
| `customer_reviews` | Etwas über Produkt oder Standort — **nicht über die Kultur** |
| `employer_statement` | Die Selbstdarstellung. Wichtig, aber eine Partei |
| `official_registry` | Harte Fakten wie Rechtsform und Sitz |
| `journalistic` | Recherche Dritter |
| `regulatory` | Behördliche Feststellungen |

Google-Bewertungen sind überwiegend Kunden- und Standortbewertungen. Sie
als Aussage über die Mitarbeiterkultur zu behandeln wäre schlicht falsch
— die Oberfläche schreibt das ausdrücklich dazu.

## Regeln für externe Bewertungsquellen

Für Google, Kununu, Glassdoor und ähnliche gilt ausnahmslos:

- nur lizenzierte API, zulässige Einbettung oder externer Deep Link
- keine ungeprüfte Volltextkopie, kein Bulk-Abruf
- vorgeschriebene Attribution und Autorinformationen anzeigen
- Quellenname, Datum, **Stichprobengröße**, Standort- und Rollenkontext
  zeigen
- die Auswahl- und Sortierlogik der Quelle nicht verschleiern
- immer „Im Original öffnen" anbieten

## KI-Zusammenfassungen

Wo eine Zusammenfassung erscheint, steht auch dabei, dass sie von einem
Sprachmodell stammt — nie das eine ohne das andere.

- positive, negative und widersprüchliche Themen zeigen
- Aktualität und Abdeckung angeben
- **kleine Stichproben nicht verallgemeinern**
- keine anonyme Einzelbehauptung als Tatsache übernehmen
- Quellenlink je Thema erhalten

Bei weniger als 15 Stimmen erscheint ein ausdrücklicher Hinweis:
einzelne Beiträge wiegen dann stark, eine Verallgemeinerung wäre nicht
zulässig.

## Job Reality Check

Vergleicht, was die Anzeige verspricht, mit dem, was aus externen Quellen
wiederkehrt — und benennt, was **fehlt**. Daraus entstehen die Fragen für
das Gespräch.

## Listing Confidence

Originalquelle vorhanden, Arbeitgeberidentität nachvollziehbar, Alter,
Frist, letzter Linkcheck, Wiederveröffentlichung, Vollständigkeit.
Unbekanntes zählt halb, nicht null.

**Das Wort „Fake" kommt nicht vor.** Aus der Ferne lässt sich Betrug
nicht feststellen — wohl aber, dass eine Anzeige alt, unvollständig oder
nicht mehr erreichbar ist. Genau das wird gesagt.

Der Linkcheck im Worker holt ausschließlich den Statuscode per HEAD. Kein
Inhalt wird abgerufen, nichts gespeichert. Demo-Stellen zeigen auf
`.invalid` und werden übersprungen.

## Demo-Daten

Ausschließlich synthetisch. Sieben erfundene Unternehmen mit erkennbaren
Fantasienamen, alle Domains auf `.invalid`, alle Datensätze mit
`is_demo = true`.

**Keine reale Firma bekommt erfundene Bewertungen.** Das wäre
rufschädigend und schlicht falsch.

Der Datensatz ist absichtlich uneinheitlich, damit die Oberfläche ihre
ehrlichen Zustände zeigen muss: fehlendes Gehalt, fehlende Aufgaben, eine
veraltete Anzeige, ein Repost, eine Stelle, die an einer harten
Bedingung scheitert, eine winzige Bewertungsstichprobe.

## Was fehlt

- Es ist keine lizenzierte Job-API angebunden.
- Der Nutzerimport nimmt Text entgegen; das Abrufen einer URL ist
  vorbereitet, aber nicht umgesetzt.
- ESCO und KldB sind als Adapter vorgesehen; mitgeliefert ist eine kleine
  interne Taxonomie, ausdrücklich als `internal` gekennzeichnet.
