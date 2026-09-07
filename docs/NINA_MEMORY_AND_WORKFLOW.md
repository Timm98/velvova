# Mondays Gedächtnis und der Vorgangszustand

## Warum das nicht im Prompt liegen darf

Ein Sprachmodell „erinnert" sich nur, solange etwas im Kontextfenster
steht. Das ist kein Gedächtnis, das ist Zufall mit Ablaufdatum. Wer nach
drei Tagen zurückkommt, hat ein neues Kontextfenster — und eine
Assistenz, die so tut, als wüsste sie noch, wo man war, behauptet etwas,
das sie nicht weiß.

Deshalb: **die Datenbank ist die Wahrheit.** Der Prompt bekommt einen
Ausschnitt daraus, nicht umgekehrt.

## Die fünf Geltungsbereiche

| Bereich | Was dort liegt | Lebensdauer |
|---|---|---|
| `account` | Sprache, Land, dauerhafte Präferenzen | dauerhaft |
| `career_profile` | bestätigte Fähigkeiten, Evidenz, Werte, Bedingungen | dauerhaft, versioniert |
| `campaign` | Ziel, Regionen, Rollencluster, Suchstrategie | je Suchkampagne |
| `application` | Stelle, Dokumentfassungen, Antworten, Stand | je Bewerbung |
| `conversation` | kurzfristiger Dialog, offene Frage | je Gespräch |

In einen Modellaufruf geht **nur der Bereich, der zur Aufgabe gehört.**
Nicht das ganze Leben der Person. Das ist Datenminimierung als
Architektur, nicht als Absichtserklärung.

## Was gespeichert wird — und was bestätigt

```
Aussage der Person
  → Kandidat mit Confidence und Herkunft
  → Bestätigung, wenn es zählt
  → bestätigtes Gedächtnis
```

Was das Modell ableitet, entsteht als **unbestätigt**. Auf „bestätigt"
setzt ausschließlich ein Mensch. Das steht nicht im Prompt, sondern im
Schema: `create_or_update_evidence` kennt kein `status`-Feld, das ein
Modell setzen könnte.

## Der Zustandsautomat

`lib/nina/workflow/state-machine.ts` — reine Logik, keine Datenbank.
Der Zustand kommt herein, der nächste geht heraus. Dadurch ist der
Ablauf testbar, ohne eine Datenbank zu starten, und die Regeln stehen an
einer Stelle statt verteilt über Route Handler.

Vierzehn Stufen von `ACCOUNT_SETUP` bis `CAREER_MODE`.

Zwei Eigenschaften sind wichtiger als Eleganz:

**Idempotenz.** Dieselbe Handlung zweimal gemeldet führt nicht zwei
Schritte weiter. Ein doppelt abgeschickter Klick ist der Normalfall.

**Kein Rückschritt durch Zufall.** Ein verzögertes Ereignis aus einem
früheren Schritt wirft den Vorgang nicht zurück. Wer zurück will, sagt
das ausdrücklich — `USER_JUMPED_BACK` ist der einzige Weg.

## Wiederaufnahme

`resumeMessage()` bildet den Satz, mit dem Monday ein Gespräch aufnimmt —
aus gespeicherten Ereignissen. Liegt kein Ereignis vor, behauptet sie
nichts:

```
ohne Vorgeschichte:  „Lass uns anfangen. …"
mit Vorgeschichte:   „Zuletzt: Bewerbung begonnen. Offen ist: …"
```

Der Test dazu heißt `behauptet nichts, wofür kein Ereignis vorliegt` —
und das ist der Punkt.

## Trennung zwischen Personen

`user_id` kommt **ausschließlich** aus der Supabase-Sitzung. Sie steht
in keinem Werkzeugschema und in keinem Prompt-Feld, das ein Gespräch
beeinflussen könnte. Ein manipulierter Verlauf kann keine fremde Kennung
unterschieben, weil es keinen Weg gibt, über den sie hereinkäme.

RLS auf jeder Tabelle, vier getrennte Policies, `force row level
security`. Der Migrationstest prüft, dass keine neue Tabelle ohne diese
Absicherung durchrutscht.

## Was noch fehlt

- Der Kontext-Umschlag (`build-context-envelope.ts`) ist entworfen, aber
  noch nicht an die Streaming-Route angeschlossen: Monday liest den
  Vorgangszustand noch nicht.
- Das Abrufen relevanter Gedächtniseinträge über pgvector braucht ein
  Einbettungsmodell — also einen OpenAI-Schlüssel.
- Die Oberfläche „Was Monday über mich weiß" fehlt.

Diese drei Punkte sind der nächste Schritt, nicht ein erledigter.
