# ADR 0008 — OpenAI als erster echter Modellanbieter

**Datum:** 2026-08-30
**Status:** angenommen

## Zusammenhang

Die Assistenz braucht ein Sprachmodell. Der Auftrag nennt OpenAI über die
Responses-API mit einem konfigurierbaren Modellnamen und verlangt
zusätzlich Adaptergerüste für Anthropic und einen selbst betriebenen,
OpenAI-kompatiblen Endpunkt.

## Entscheidung

`AI_PROVIDER` kennt vier Werte:

| Wert | Bedeutung |
|---|---|
| `mock` | lokal, ohne Netz. Antworten sind gekennzeichnete Beispiele. |
| `openai` | Responses-API, Modell aus `OPENAI_PRIMARY_MODEL` |
| `anthropic` | Messages-API mit erzwungener Werkzeugauswahl |
| `self_hosted` | OpenAI-kompatibler Endpunkt unter eigener Kontrolle |

Strukturierte Ausgaben laufen bei OpenAI über `text.format` mit
`type: "json_schema"` und `strict: true`. Die Antwort wird danach **noch
einmal** gegen dasselbe Zod-Schema geprüft, bevor sie irgendwo landet:
das Format kann stimmen und der Inhalt trotzdem außerhalb der erlaubten
Werte liegen.

## Zwei Regeln, die wichtiger sind als die Anbieterwahl

**Kein vorgetäuschter Betrieb.** Fehlt der Schlüssel, läuft der lokale
Anbieter — und die Oberfläche sagt das an jeder Stelle, an der es
zählt. Es gibt keinen Bildschirm, auf dem eine Antwort wie Modellarbeit
aussieht und keine ist.

**Kein stiller Modellwechsel.** Hat das Konto keinen Zugriff auf den
eingetragenen Modellnamen, antwortet der Provider mit einer
Konfigurationsmeldung (`OpenAiConfigurationError`) und nennt die
Umgebungsvariable, die zu ändern ist. Auf ein anderes Modell
auszuweichen wäre bequem und falsch: die Ausgabe eines Modells ist nicht
die Ausgabe eines anderen, und niemand würde den Unterschied bemerken.

## Wiederholungen

Wiederholt wird nur, was sich zu wiederholen lohnt: Zeitüberschreitung,
429, 5xx, Netzabbruch. Ein 400 wird nicht besser, wenn man ihn dreimal
schickt. Ein 404 oder 403 auf den Modellnamen schlägt sofort als
Konfigurationsfehler durch, statt dreimal zu warten.

## Datenfluss

An das Modell geht nur der Kontext, den der jeweilige Schritt braucht.
Name, Anschrift und Kontaktdaten gehören nicht dazu. Details in
`docs/PRIVACY_SECURITY.md`.
