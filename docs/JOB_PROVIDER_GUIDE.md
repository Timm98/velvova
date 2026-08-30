# Eine Stellenquelle anbinden

Diese Anleitung ist bewusst in dieser Reihenfolge geschrieben: **zuerst die
Erlaubnis, dann der Code.** Ein Adapter, der vor der Freigabe existiert, wird
irgendwann eingeschaltet.

## Schritt 1 — Der Registry-Eintrag

Ohne Eintrag in `apps/web/src/lib/sources/source-registry.ts` entscheidet die
Policy Engine `pending_review`, und es wird nichts abgerufen. Das ist der
Ausgangszustand, nicht ein Fehlerfall: eine unbekannte Quelle ist eine
ungeprüfte Quelle.

```ts
{
  key: "beispiel_de",
  displayName: "Beispiel Jobs",
  domains: ["beispiel.de"],
  accessMode: "approved",              // approved | link_only | private_import | pending_review | blocked
  legalBasis: "api_terms",             // worauf sich die Erlaubnis stützt
  legalBasisUrl: "https://beispiel.de/api/terms",
  allowedOperations: ["Search", "FetchDetails", "Cache", "PublicDisplay", "Summarize", "Embed", "Rank"],
  allowedFields: ["title", "company", "location", "salary", "description", "source_url"],
  attributionRequired: true,
  attributionText: "Stellen von Beispiel Jobs",
  reviewDueAt: new Date("2027-02-01"),
  enabled: false,                      // bis der Adapter steht
}
```

Zu `legalBasis`: **Umformulieren ist keine Rechtsgrundlage.** Eine Anzeige
durch ein Sprachmodell zu paraphrasieren macht aus fremdem Inhalt keinen
eigenen. Steht keine Erlaubnis dahinter, bleibt nur `link_only` — Titel,
Unternehmen, Ort und ein Verweis auf das Original, mehr nicht.

`reviewDueAt` ist keine Formalie. Ist das Datum überschritten, liefert die
Policy Engine `pending_review`, und der Abruf stoppt. Nutzungsbedingungen
ändern sich, und eine Freigabe ohne Verfallsdatum ist eine Freigabe, die
niemand je wieder ansieht.

## Schritt 2 — Der Adapter

`packages/jobs/src/sources/beispiel.ts`, gegen `JobSourceAdapter`:

```ts
export const beispielAdapter: JobSourceAdapter = {
  key: "beispiel_de",          // MUSS dem Registry-Schlüssel entsprechen
  displayName: "Beispiel Jobs",
  kind: "licensed_api",
  licenseStatus: "licensed",
  attributionRequired: true,
  attributionText: "Stellen von Beispiel Jobs",
  termsUrl: "https://beispiel.de/api/terms",

  isConfigured: () => Boolean(process.env.BEISPIEL_API_KEY),

  async fetchListings({ limit = 100, since } = {}) { /* ... */ },
};
```

**Der Schlüssel muss übereinstimmen.** Ein Adapter hiess einmal `adzuna`, der
Registry-Eintrag `adzuna_de`. Die Policy Engine fand nichts, entschied
`pending_review` und blockierte — richtig im Ergebnis, falsch in der
Begründung. Ein solcher Fehler versteckt sich hinter einem korrekten Verhalten.
Der Abgleich ist deshalb getestet:
`apps/web/src/lib/sources/policy-engine.test.ts`.

`isConfigured()` beschreibt **nur**, ob Zugangsdaten vorliegen. Es ist keine
zweite Freigabeprüfung. Genau das war einmal der Fall: `activeAdapters()`
filterte nach `isConfigured()`, bevor die Policy Engine überhaupt gefragt
wurde — eine nicht eingerichtete Quelle erreichte den rechtlichen Riegel nie
und tauchte in keinem Bericht auf. Wo zwei Mechanismen dieselbe Frage
beantworten, gewinnt stillschweigend der schwächere.

## Schritt 3 — Normalisierung

`normalise()` in `adapter.ts` erwartet eine `RawListing` und macht daraus einen
kanonischen Datensatz. Drei Stellen verdienen Aufmerksamkeit:

**Gehalt.** Nicht angegeben ist nicht null. `salaryDisclosed: false` heisst „die
Anzeige schweigt“ und darf nie als 0 in eine Rechnung geraten. Stundenlöhne mit
Komma („18,50 €/Std“) waren in der ersten Fassung gar nicht erkannt worden.

**Ablauf.** `expiresAt` setzen, wenn der Anbieter es liefert. Abgelaufene
Anzeigen fallen aus dem Ranking (`isStale()` in `apps/web/src/lib/matching.ts`).
Eine Bewerbung auf eine tote Anzeige kostet eine Stunde und bringt nicht einmal
eine Absage.

**Sprache.** Anforderungen wie „Verhandlungssicheres Deutsch“ müssen erkannt
werden. Die erste Fassung setzte eine Wortgrenze hinter den Wortstamm und
scheiterte an jeder deutschen Beugung.

## Schritt 4 — Zusammenführung

Nichts zu tun: `canonicalKey()` läuft im Ingest. Prüfen sollte man aber, ob die
Titel dieses Anbieters Formen enthalten, die noch nicht abgeräumt werden —
`(f/m/d)`, `[all genders]`, Umfangsangaben. Jede unerkannte Form erzeugt eine
Dublette.

Neue Fälle gehören als Testdaten nach `packages/jobs/src/canonical.test.ts`,
mit einem Kommentar, aus welcher echten Anzeige sie stammen.

## Schritt 5 — Einschalten

1. `enabled: true` im Registry-Eintrag
2. Schlüssel in `.env.local`, Name in `.env.example` als leerer Platzhalter
3. `node scripts/generate-source-docs.mjs`
4. `pnpm test`
5. `curl -X POST /api/jobs/refresh` und die Antwort lesen

Die Antwort nennt `inserted`, `updated`, `unchanged`, `merged` und `failed`.
Ein `merged` grösser null beim ersten Lauf mit zwei Quellen ist das Zeichen,
dass die Zusammenführung greift.

## Was ein Adapter niemals tut

- HTML einer Seite abrufen, die keine API anbietet
- Anmeldeschranken, Zugriffsgrenzen oder Bot-Erkennung umgehen
- `robots.txt` ignorieren
- fremde Inhalte umformulieren und als eigene anzeigen
- Daten einer Quelle abrufen, deren Entscheidung nicht `approved` lautet

Die letzten beiden setzt die Policy Engine durch. Die ersten drei setzt
niemand durch — sie stehen hier, weil sie nicht passieren dürfen.
