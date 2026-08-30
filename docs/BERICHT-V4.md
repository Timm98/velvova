# Statusbericht — Legal Global Metasearch (V4)

Branch `feature/legal-global-metasearch`, Stand 30. August 2026.

---

## ⚠️ Zuerst: vier Schlüssel sind kompromittiert

In deiner Nachricht standen im Klartext:

| Anbieter | Variable | Was zu tun ist |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | **Sofort widerrufen**, neuen Projektschlüssel erzeugen, Usage und Billing auf Fremdnutzung prüfen |
| Jooble | `JOOBLE_API_KEY_DE` | Widerrufen bzw. neu ausstellen lassen |
| Adzuna | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | In der Developer-Konsole neu erzeugen |
| Supabase | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Öffentlicher Schlüssel — unkritisch, aber prüfen, dass RLS greift, bevor produktive Daten hineingehen |

**Ich habe keinen davon verwendet, gespeichert oder in eine Datei
geschrieben.** Neue Schlüssel gehören in `.env.local` — die Datei ist
ignoriert und wird nie eingecheckt.

### Ergebnis des Audits

```
Git-Historie              keine Schlüsselmuster
Arbeitsverzeichnis        keine Schlüssel außerhalb ignorierter Dateien
.gitignore                .env und .env.* ignoriert, nur .env.example versioniert
Gesetzte Anbieterschlüssel  keine
```

Checkpoint: `chore/checkpoint-before-metasearch-platform`, Sicherung
unter `~/projekt-sicherungen/paycheck-v3-final-*.bundle`.

---

## Was gebaut wurde

### Source Registry und Policy Engine — das Kernstück

Eine Sperre im Code, nicht eine Beschreibung davon.

```
apps/web/src/lib/sources/
  decision-types.ts      Begriffe: Rechtsgrundlage, Zugangsart, Vorgang
  source-registry.ts     15 Quellen — auch und gerade die gesperrten
  policy-engine.ts       die Entscheidung, und assertAllowed() wirft
  provenance.ts          feldgenaue Herkunft, mit Validierung
  web-discovery.ts       Kandidaten mit Entscheidung, niemals Inhalt
app/admin/sources/       die berechneten Entscheidungen, sichtbar
```

**Was durchgesetzt wird:**

| Regel | Wie |
|---|---|
| Unbekannte Domain | → `ungeprüft`, keine Vorgänge. Nicht „vermutlich in Ordnung". |
| LinkedIn, Indeed, StepStone, Monster, XING, kununu, Glassdoor, Google | → `nur Verweis`. Kein Abruf, kein Cache, kein Embedding, kein Ranking. **Unterdomains inbegriffen** — sonst wäre die Sperre mit `de.linkedin.com` zu umgehen. |
| Umformulieren als Umgehung | → unmöglich: **kein `Summarize` ohne `FetchDetails`**. Wer nicht lesen darf, darf auch nicht zusammenfassen. |
| Stelle ohne Original-Link | → wird nicht veröffentlicht. |
| Abgelaufene Prüfung | → Quelle wechselt selbsttätig auf `ungeprüft`. |
| Kill Switch | → wirkt **vor** dem ersten Netzzugriff. |
| `ai_summary` ohne Herkunftsfelder | → Validierungsfehler, nicht Schönheitsfehler. |
| Reichweitenaussage | → aus gezählten Entscheidungen gebildet; „das gesamte Internet" ist strukturell ausgeschlossen. |

**31 Tests** sichern das ab, darunter jeder gesperrte Anbieter einzeln.

Die Engine sitzt im echten Abrufpfad. Dabei kam ein Fehler heraus: Die
Prüfung auf „eingerichtet" lief **vor** der Policy-Prüfung und verdeckte
sie — eine nicht eingerichtete Quelle erreichte die Rechtsprüfung nie und
tauchte im Bericht nicht auf. Zwei Filter für dieselbe Frage sind einer
zu viel; der schwächere gewinnt dann stillschweigend.

Live nachgewiesen:

```json
"skipped": [
  { "key": "adzuna_de", "reason": "… nicht in Betrieb: Keine Zugangsdaten
     hinterlegt (ADZUNA_APP_ID, ADZUNA_APP_KEY). Der Verweis auf die
     Originalquelle bleibt möglich." },
  { "key": "jooble_de", "reason": "… Kein Schlüssel hinterlegt
     (JOOBLE_API_KEY_DE). …" }
]
```

### Ninas Gedächtnis und Vorgangszustand (§15B)

Migration mit `job_search_campaigns`, `workflow_states`,
`nina_memory_items`, `conversation_summaries`, `context_snapshots`,
`nina_tasks`, `job_field_provenance`, `web_discovery_candidates` — alle
mit RLS und vier getrennten Policies.

Der Zustandsautomat ist **reine Logik ohne Datenbank**: vierzehn Stufen,
testbar ohne laufendes Postgres.

- **Idempotent** — dieselbe Stelle zweimal gemerkt bleibt einmal
  gemerkt. Ein doppelter Klick ist der Normalfall.
- **Kein Rückschritt durch Zufall** — ein verzögertes Ereignis aus einem
  früheren Schritt wirft den Vorgang nicht zurück.
- `resumeMessage()` **behauptet nichts, wofür kein Ereignis vorliegt.**

### Dokumentation, die nicht auseinanderlaufen kann

`LEGAL_SOURCE_REGISTER.md` und `SOURCE_COMPLIANCE_MATRIX.md` werden von
`scripts/generate-source-docs.mjs` aus derselben Datei erzeugt, die die
Policy Engine benutzt. Von Hand gepflegte Compliance-Tabellen laufen
auseinander — diese kann es nicht.

---

## Prüfergebnisse

| Prüfung | Ergebnis |
|---|---|
| `pnpm typecheck` | 16 / 16 |
| `pnpm lint` | 16 / 16 |
| `pnpm test` | **216 Tests**, 17 Dateien |
| `pnpm eval` | 19 / 19 |
| `pnpm build` | 4 / 4 |
| `pnpm test:e2e` | **305 Tests**, fünf Breitenpunkte |
| axe, beide Themes | 0 Verstöße |

---

## Ehrlicher Stand gegen die Definition of Done

| Punkt | Stand |
|---|---|
| Keine Secrets im Repository oder Client-Bundle | ✅ auditiert |
| RLS getestet | ✅ Migrationstest + PGlite-RLS-Test |
| Mindestens ein erlaubter Provider funktioniert | ✅ Arbeitnow, 150 Stellen |
| Kanonische eigene Jobtabelle | ✅ |
| Quellen, Attribution, Aktualität sichtbar | ✅ |
| Keine erfundenen Gehälter | ✅ |
| Provider über Kill Switch abschaltbar | ✅ |
| Kein blockierter Anbieter wird durch Umformulieren umgangen | ✅ **getestet** |
| Reichweitenaussage nicht überzogen | ✅ strukturell |
| Feldgenaue Provenienz | ✅ Schema + Validierung |
| Workflow setzt nach Reload fort | ⚠️ Automat fertig und getestet, **noch nicht an die Route angeschlossen** |
| Nina führt echte OpenAI-Calls aus | ❌ **Schlüssel fehlt** |
| Jeder AI-Task über den Router zum vorgesehenen Modell | ⚠️ Router steht, drei Stufen verdrahtet; Realtime fehlt |
| Dubletten über mehrere Quellen zusammengeführt | ⚠️ Inhaltshash je Quelle vorhanden, quellenübergreifend noch nicht |
| ESCO-Integration | ❌ noch nicht begonnen |
| Bewerbungs-Claim-Map | ⚠️ Schema in der Migration, Erzwingung im Studio fehlt |

---

## Was du jetzt tun musst

1. **Die vier Schlüssel widerrufen.** Zuerst den OpenAI-Schlüssel — er
   kostet Geld, wenn ihn jemand findet.
2. Neue Schlüssel erzeugen und lokal eintragen:

```bash
cd ~/paycheck-rebuild
cp .env.example .env.local
$EDITOR .env.local      # OPENAI_API_KEY, JOOBLE_API_KEY_DE,
                        # ADZUNA_APP_ID, ADZUNA_APP_KEY,
                        # NEXT_PUBLIC_SUPABASE_* , SUPABASE_SERVICE_ROLE_KEY
```

3. Danach sind ohne weitere Codeänderung freigeschaltet:
   - Nina antwortet mit einem echten Modell (Router, Werkzeuge,
     Streaming und Protokollierung sind gebaut und getestet)
   - Jooble und Adzuna liefern Stellen — die Policy Engine lässt sie
     dann durch, weil `enabled` und Zugangsdaten zusammenkommen
   - Supabase übernimmt Anmeldung, Datenbank und Ablage

**Ich frage nicht nach den Werten und will sie nicht sehen.**

---

## Nächster konkreter Schritt

Den Kontext-Umschlag an `/api/nina/stream` anschließen, damit Nina den
Vorgangszustand liest und nach einem Neustart an der richtigen Stelle
fortsetzt. Der Automat ist fertig und geprüft; es fehlt die Verbindung.

---

## Keine Rechtsberatung

Das ist eine technische Risikosteuerung mit dokumentierten
Quellenentscheidungen. Vor einem öffentlichen Betrieb, großflächiger
Metasuche, Bewertungsaggregation oder nativer Bewerbung muss eine auf
Datenbank-, Wettbewerbs-, Urheber-, Datenschutz- und Plattformrecht
spezialisierte Kanzlei die konkreten Verträge, Länder und Datenflüsse
prüfen.
