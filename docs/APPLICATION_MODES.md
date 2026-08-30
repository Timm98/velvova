# Bewerbungswege

Wie eine Bewerbung das Haus verlässt — und warum an drei Stellen etwas
dazwischen steht.

## Die Regel

**Nichts geht ohne ausdrückliche Freigabe eines Menschen hinaus, und nichts
Unbelegtes wird freigegeben.** Zwei getrennte Riegel, weil beide für sich
versagen könnten.

## Die Wege

| Weg | Was passiert | Wer bestätigt |
| --- | --- | --- |
| **Verweis** | Die Person bewirbt sich beim Anbieter selbst | niemand — wir versenden nichts |
| **Vorbereitet** | Wir erzeugen die Unterlagen, die Person versendet | die Person, ausserhalb des Produkts |
| **Versand** | Wir versenden nach Freigabe | die Person, ausdrücklich, je Bewerbung |

Ein vierter Weg fehlt bewusst: **automatische Bewerbung**. Es gibt keinen
Codepfad, der ohne Bestätigung versendet, und es soll keinen geben. Massenversand
schadet der Person doppelt — er kostet ihren Ruf beim Arbeitgeber und ihre Zeit.

## Der Weg durch die Riegel

**1. Erzeugen.** Anschreiben oder Lebenslaufteil entstehen aus dem bestätigten
Profil. Das erzeugte Dokument ist zunächst `approvedByUser: false`.

**2. Prüfen.** Jeder Satz wird gegen die bestätigten Belege gehalten
(`analyseClaims`). Drei Ergebnisse:

| Zustand | Bedeutung | Folge |
| --- | --- | --- |
| `supported` | durch eine bestätigte Erfahrung gedeckt | frei |
| `needs_confirmation` | nur teilweise gedeckt | Hinweis, prüfen |
| `unsupported` | kein Beleg | **sperrt die Freigabe** |

Der letzte Zustand ist hart. Eine Warnung klickt man weg; eine gesperrte
Freigabe zwingt zur Entscheidung — belegen oder abschwächen. Für den zweiten Weg
schlägt `suggestSofterWording()` eine vorsichtigere Formulierung vor, statt den
Satz zu löschen: „lösch den Satz“ ist selten der richtige Rat.

Der Name des mittleren Zustands hiess einmal `weakened`. Das beschrieb den
Befund. `needs_confirmation` beschreibt die Handlung — und in einem Dokument,
das verschickt wird, zählt die Handlung.

**3. Freigeben.** `approveArtifact()` prüft `checkApproval()` erneut. Wird der
Text danach geändert, fällt die Freigabe zurück auf `false`: was freigegeben
wurde, muss das sein, was versendet wird.

**4. Versenden.** `sendApplication()` prüft `approvedByUser` und verlangt eine
zusätzliche Bestätigung. Ist kein Versandweg verbunden, wird der Vorschautext
erzeugt und ehrlich gesagt, dass nichts hinausgegangen ist.

## Was die Person sieht

Zu jedem Satz die Herkunft: welcher Beleg ihn trägt. Ein Anschreiben ohne diese
Rückbindung wäre ein hübscher Text mit unbekanntem Wahrheitsgehalt — und die
Person müsste im Vorstellungsgespräch dafür geradestehen, nicht wir.

## Nachverfolgung

`applications.stage` bildet den tatsächlichen Verlauf ab: `saved`, `preparing`,
`sent`, `acknowledged`, `interview`, `offer`, `rejected`, `withdrawn`,
`accepted`. `rejected` und `withdrawn` sind abgeschlossen — Nina drängt dort
nicht zum Weitermachen, sondern schlägt weitere Möglichkeiten vor.

## Was fehlt

- Kein Versandweg ist verbunden. Der Zustand ist im Produkt als „nicht
  verbunden“ ausgewiesen, nicht versteckt.
- Der Abgleich Aussage gegen Beleg arbeitet mit Wortüberlappung. Er ist eher zu
  streng als zu lax — bei einem Text, der an einen Arbeitgeber geht, ist das
  die richtige Richtung.
