# KI-Routing

<!-- Erzeugt aus packages/ai/src/router.ts.
     Nicht von Hand ändern: `node scripts/generate-ai-routing-doc.mjs`. -->

Welche Aufgabe auf welcher Leistungsstufe läuft, steht an genau einer Stelle im Code.
Dieses Dokument ist ein Abzug davon, kein zweiter Datenbestand.

Die Stufennamen sind **keine Modellnamen**. Sie beschreiben ein Verhalten; welches
Modell dahintersteht, ist Konfiguration. Im Fachcode steht nie ein Modellname —
sonst wäre ein Anbieterwechsel ein Umbau statt einer Einstellung.

## Die Stufen

| Stufe | Bild | Wofür | Aufgaben |
| --- | --- | --- | --- |
| **TERRA** | Boden | Klassifizieren, extrahieren, normalisieren. Hohe Menge, geringe Tiefe. | 6 |
| **SOL** | Tageslicht | Das Gespräch. Tempo vor Tiefe — ein Mensch wartet. | 3 |
| **LUNA** | Nachtarbeit | Synthese, Urteil, Bewerbungstexte. Darf dauern, muss stimmen. | 6 |
| **REALTIME** | Sprache | Eigener Pfad, eigene Zugangsdaten, kurze Lebensdauer. | 1 |

## Die Zuordnung

| Aufgabe | Stufe | Begründung | Abbruch nach | Rückfall |
| --- | --- | --- | --- | --- |
| `interview_turn` | SOL | Ein Mensch wartet auf die nächste Frage. | 20 s | TERRA |
| `interview_followup` | SOL | Rückfrage im laufenden Gespräch. | 20 s | TERRA |
| `nina_chat` | SOL | Gespräch mit Werkzeugaufrufen; das Tempo trägt das Erlebnis. | 60 s | TERRA |
| `evidence_extraction` | TERRA | Aussagen aus Text herauslösen. Menge statt Tiefe. | 30 s | — (kein Rückfall) |
| `language_detection` | TERRA | Einfache Klassifikation. Ein grosses Modell wäre Verschwendung. | 10 s | — (kein Rückfall) |
| `job_normalisation` | TERRA | Formatangleich über viele Datensätze. | 30 s | — (kein Rückfall) |
| `requirement_extraction` | TERRA | Anforderungen aus einer Anzeige lesen. | 30 s | — (kein Rückfall) |
| `review_theme_clustering` | TERRA | Wiederkehrende Themen in Bewertungen bündeln. | 45 s | — (kein Rückfall) |
| `profile_synthesis` | LUNA | Aus vielen Belegen wird ein Bild. Fehler hier tragen weit. | 120 s | SOL |
| `role_suggestion` | LUNA | Rollenvorschläge müssen begründbar sein, nicht nur plausibel. | 90 s | SOL |
| `job_fit_explanation` | LUNA | Die Begründung wird der Person gezeigt und muss standhalten. | 60 s | SOL |
| `career_transition_analysis` | LUNA | Ein Wechselpfad über Jahre. Der teuerste Rat im Produkt. | 120 s | SOL |
| `cover_letter_draft` | LUNA | Der Text geht an einen Arbeitgeber. Er trägt einen Namen. | 90 s | SOL |
| `cv_section_draft` | LUNA | Wie beim Anschreiben: das Ergebnis verlässt das Haus. | 90 s | SOL |
| `application_claim_check` | TERRA | Abgleich Satz gegen Beleg. Die eigentliche Prüfung ist regelbasiert; das Modell schlägt nur eine vorsichtigere Formulierung vor. | 30 s | — (kein Rückfall) |
| `voice_session` | REALTIME | Sprache in beide Richtungen, eigener Pfad und eigene Zugangsdaten. | 15 s | SOL |

## Warum manche Aufgaben keinen Rückfall haben

Ein Rückfall ist nur dann richtig, wenn das schwächere Ergebnis noch dieselbe Frage
beantwortet. Bei einer Klassifikation ist das so. Bei einer Profilsynthese nicht: ein
Ergebnis vom schnellen Modell sähe aus wie ein Urteil, wäre aber keines — und niemand
könnte es an der Ausgabe erkennen. Dort ist Scheitern die ehrlichere Antwort.

Stand: 16 Aufgaben, 4 belegte Stufen. Geprüft in `packages/ai/src/router.test.ts`.
