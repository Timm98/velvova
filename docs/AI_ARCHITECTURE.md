# KI-Architektur

## Provider-Abstraktion

```ts
interface AiProvider {
  readonly name: string;
  readonly isLocal: boolean;       // laeuft ohne Netz?
  chatStream(options): AsyncIterable<string>;
  structuredGenerate<T>(options): Promise<StructuredResult<T>>;
  embed(texts): Promise<number[][]>;
  transcribe(audio, locale): AsyncIterable<TranscriptChunk>;
  synthesize(text, locale): Promise<ArrayBuffer>;
  realtimeSession?(): Promise<{ close(): Promise<void> }>;
}
```

**Kein Anbietername und kein Modellname steht im Fachcode.** Das ist
keine Stiluebung: fuer besonders schutzbeduerftige Verarbeitung muss ein
selbst betriebener Pfad moeglich bleiben, ohne das Produkt umzubauen.

Nicht unterstuetzte Faehigkeiten werfen einen klaren Fehler
(`AiCapabilityError`), statt stillschweigend etwas anderes zu tun.

## Anbieterauswahl

```
AI_PROVIDER=mock       → MockAiProvider
AI_PROVIDER=anthropic  → mit Schluessel: AnthropicProvider
                         ohne Schluessel: MockAiProvider + Hinweis
```

Der Grundsatz: **ein Anbieter gilt nur als verfuegbar, wenn er wirklich
benutzbar ist.** Wer `anthropic` waehlt, aber keinen Schluessel
hinterlegt, bekommt den lokalen Anbieter und eine ehrliche Anzeige —
nicht einen Fehler beim ersten Klick und nicht die Illusion echten
Betriebs.

## Der lokale Anbieter

Kein Platzhalter, sondern der Standardweg. Zwei Gruende:

1. Ein neuer Entwickler muss ohne Zugangsdaten arbeiten koennen.
2. Tests brauchen reproduzierbare Antworten — ein echtes Modell liefert
   bei gleichem Eingang nicht zweimal dasselbe.

Er erzeugt aus einem Zod-Schema ein **schema-gueltiges** Objekt und
antwortet im Gespraech themenbezogen. Er gibt sich nie als echtes Modell
aus: `name` ist `"mock"`, und die Oberflaeche zeigt das an jeder Stelle.

Seine Embeddings sind Hashes ohne Semantik — aehnliche Texte liegen
nicht beieinander. Auch das steht in der Oberflaeche.

## Modellstrategie

| Stufe | Wofuer |
|---|---|
| `strong` | Karriere-Synthese, schwierige Rueckfragen, Match-Erklaerung, Dokumentpruefung |
| `fast` | Extraktion, Klassifikation, einfache Zusammenfassungen |
| `embed` | Semantische Suche (vorgesehen, nicht aktiv) |

Die Zuordnung zu konkreten Modellen ist **Konfiguration**
(`AI_MODEL_STRONG`, `AI_MODEL_FAST`), nicht Code.

Budgets fuer Tokens, Zeit und Kosten stehen in der Laufzeitkonfiguration.
Jeder Lauf wird in `ai_runs` mit Zustand, Tokens, Kosten und Dauer
festgehalten — ohne Inhalt.

## Strukturierte Ausgaben

Zwei Pruefungen, weil die erste beim Anbieter liegt:

1. Tool Use mit **erzwungener** Werkzeugauswahl und JSON-Schema
2. Danach noch einmal gegen dasselbe Zod-Schema

```ts
const parsed = options.schema.safeParse(toolUse.input);
if (!parsed.success) throw new Error(...);
```

**Keine Modellantwort wird ungeprueft zur Wahrheit in der Datenbank.**

## Prompts

Versioniert im Repository: `packages/ai/src/prompts/nina.ts`, Fassung
`2026.08.1`. Die Fassung wird zu jedem Lauf gespeichert
(`prompt_versions`), damit ein Ergebnis spaeter erklaerbar bleibt.

Der Systemprompt traegt drei getrennte Bloecke:

```
BESTAETIGTE FAKTEN (nur diese sind gesichert)
OFFENE HYPOTHESEN (als Vermutung kennzeichnen)
HARTE BEDINGUNGEN (nie aufweichen)
```

Dazu, wenn zutreffend, ein Block mit abgelehnten Aussagen — damit sie
nicht wiederkehren.

Der Name der Assistenz kommt aus der zentralen Konfiguration, nicht aus
dem Prompttext. Beide Namen sind vorlaeufig.

## Gespraechsfuehrung

Die Interview-Maschine ist adaptiv: was sicher bekannt ist, wird nicht
noch einmal gefragt. Wer im Lebenslauf zwei Jahre Kundenservice stehen
hat, soll nicht gefragt werden, ob er Berufserfahrung hat — das ist der
haeufigste Grund, warum solche Gespraeche sich wie Formulare anfuehlen.

Ein Thema gilt als abgedeckt, wenn etwas **Verwertbares** vorliegt, nicht
wenn eine Frage gestellt wurde. Fuer Erfahrungsepisoden heisst das:
mindestens zwei bestaetigte Episoden.

30 Fragen, alle nach Situation-Handlung-Ergebnis gebaut, mit eigener
Variante fuer Menschen ohne Berufserfahrung.

## Sprache

| Weg | Zustand |
|---|---|
| Browser-Spracherkennung | aktiv, wo der Browser sie bietet |
| Serverseitiger Anbieter | vorgesehen, **nicht verbunden** |
| Textweg | immer vollstaendig verfuegbar |

Live-Mitschrift sichtbar, Pause und Fortsetzen, Audio wird
standardmaessig nicht gespeichert, Transkriptspeicherung ist eine eigene
Einwilligung.

**Aus Stimme wird ausschliesslich Text.** Keine Stimmbiometrie, keine
Emotions- oder Akzentbewertung — weder umgesetzt noch geplant.

## RAG und Quellen

Taxonomie- und Marktdaten werden getrennt von Nutzerdaten indiziert. Jede
externe Aussage traegt Quelle, Datum, Land und Lizenz
(`source_citations`).

**Quellen werden nie erfunden.** Liegt keine verlaessliche Quelle vor,
zeigt die Oberflaeche „nicht ausreichend belegt".

## Schutzmechanismen

Ausfuehrlich in [AI_GUARDRAILS.md](AI_GUARDRAILS.md). Kurz:

- Externe Texte werden sichtbar gekapselt, die Regel steht vor **und**
  nach dem Inhalt
- Ausgaben mit Zuschreibung geschuetzter Merkmale werden **verworfen**,
  nicht bereinigt
- Direkte Identifikatoren werden vor externer Verarbeitung entfernt
- Keine gespeicherten Gedankengaenge, nur kurze nachvollziehbare
  Begruendungen

## Was fehlt

- Circuit Breaker und Wiederholungsstrategie sind als Budget angelegt,
  aber nicht umgesetzt
- Embeddings laufen ueber den lokalen Anbieter und tragen keine Semantik
- `realtimeSession` ist in der Schnittstelle vorgesehen, von keinem
  Anbieter umgesetzt
