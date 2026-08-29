# Entscheidungen und offene Punkte

Architekturentscheidungen mit ausführlicher Begründung stehen in
[adr/](adr/). Hier: die kleineren Festlegungen, die Annahmen dahinter,
und vor allem — was **fehlt**.

## Getroffene Festlegungen

| Entscheidung | Begründung |
|---|---|
| TypeScript 7.0.2 | `latest`-Tag, Kompatibilität geprüft ([ADR 0002](adr/0002-typescript-7.md)) |
| PGlite lokal | Echtes Postgres ohne Docker ([ADR 0003](adr/0003-pglite-als-lokaler-treiber.md)) |
| Eigene Auth | Kleiner Umfang, RLS-Integration ([ADR 0004](adr/0004-eigene-authentifizierung.md)) |
| Kein Queue-System | Alle Aufgaben idempotent ([ADR 0006](adr/0006-worker-ohne-queue.md)) |
| Keine Komponentenbibliothek | Eigenes Designsystem; geteilt werden Tokens und Darstellungsregeln, nicht Komponenten |
| `.ts`-Endungen in Importen | Trägt Nodes Type-Stripping **und** Bundler; `.js` trägt nur Bundler |
| Keine Parameter-Properties | Nodes `--experimental-strip-types` unterstützt sie nicht |
| Datenbankgriff an `globalThis` | Next lädt Pakete in mehreren Modul-Graphen; eine Modulvariable wäre mehrfach vorhanden |
| Nonce-CSP statt `unsafe-inline` | Sicherheit ohne Aufweichung ([siehe unten](#drei-fehler-die-tests-gefunden-haben)) |
| Fit-Gewichte als Managementannahme | Keine Messung — steht so auf `/methodology` |
| Wortüberlappung statt Semantik | Nachvollziehbar und ohne Netzzugriff; die Grenze ist dokumentiert |

## Drei Fehler, die Tests gefunden haben

Sie stehen hier, weil sie zeigen, wogegen die Tests wirklich helfen.

**1. Row Level Security war wirkungslos.**
Der erste Anlauf setzte `ENABLE` und `FORCE ROW LEVEL SECURITY`. Beides
greift **nicht** gegen einen Superuser — das ist Postgres-Verhalten. Zwei
Testnutzer sahen gegenseitig alles. Jetzt legt die Migration die Rolle
`paycheck_app` an, und `withUser()` legt vor jeder Anfrage die erhöhten
Rechte ab.

**2. Die eigene CSP legte die gesamte Interaktivität lahm.**
`default-src 'self'` ohne `script-src` blockierte Nexts Inline-Skripte.
React hydrierte nie — **jeder Knopf der Anwendung war tot**. Das
serverseitig gerenderte HTML sah dabei vollständig korrekt aus, weshalb
es lange nicht auffiel. Erst ein E2E-Test, der auf die *Wirkung* eines
Klicks wartete, hat es aufgedeckt.

**3. Sieben Barrierefreiheitsverstöße.**
Kontrast nur gegen die hellste Fläche geprüft, Zustände über Deckkraft
signalisiert, Links nur an der Farbe erkennbar, weiße Schrift auf hellem
Akzent im Dunkelmodus, die untere Navigation überdeckte Schaltflächen,
scrollbare Bereiche waren per Tastatur unerreichbar, und die Sprungmarke
machte die Seite seitlich scrollbar. Alle sieben in
[ACCESSIBILITY.md](ACCESSIBILITY.md) beschrieben.

Der fünfte ist der lehrreichste: eine sticky Navigation am unteren Rand
ist ein verbreitetes Muster, und der Inhalt dahinter fällt niemandem
auf, der scrollen kann. Behoben nicht durch Abschalten der Regel,
sondern durch ein Rasterlayout, in dem die Navigation neben dem Inhalt
liegt statt darüber.

Dazu zwei Fehler in der eigenen Arbeit: die Freischaltung hing an einer
einzelnen Gesprächssitzung statt an der Person (ein zweites Gespräch
hätte das Profil entwertet), und die gesamte Oberfläche war in Umschrift
geschrieben — „Jobqualitaet" statt „Jobqualität".

## Offene Punkte

### Wichtig

- **Semantische Suche.** `pgvector` ist verfügbar, aber nicht eingebunden.
  Der Abgleich zwischen Anforderung und Erfahrung läuft über
  Wortüberlappung; eine anders formulierte, gleichbedeutende Erfahrung
  kann übersehen werden. Das ist die größte fachliche Lücke.
- **Rate Limiting.** Nicht umgesetzt. Vor einem Betrieb zwingend.
- **Uploads.** Die Schnittstellen stehen (MIME-Prüfung, Malware-Scan,
  signierte Links), aber es ist kein Speicher angebunden und keine
  Dokumentextraktion umgesetzt.
- **Wiederherstellungstest.** Sicherungen sind beschrieben, ein
  Wiederherstellungslauf hat nicht stattgefunden.

### Mittel

- Nutzerbezogene API-Endpunkte folgen mit der nativen App. Der Vertrag in
  `packages/api-contracts` beschreibt heute nur, was die API auch hält.
- Die native App ist ein tragfähiger Anfang: sichere Tokenablage,
  gemeinsame Tokens und Typen, ehrliche Zustandsanzeige. Die Kernabläufe
  fehlen.
- MFA ist vorbereitet (`auth_accounts`), nicht aktiv.
- OAuth-Anbieter sind gekapselt vorgesehen, nicht angebunden.
- Feldverschlüsselung hat eine Spalte, aber keinen aktiven Schlüsselpfad.
- Micro-Work-Samples sind als Daten und Regeln vorhanden, aber noch nicht
  in den Gesprächsablauf eingebunden.
- Angebote und Check-ins haben Ansichten und Tabellen, aber noch keine
  Eingabemasken.

### Klein

- Der Linkcheck prüft nur den Statuscode, nicht die Erreichbarkeit der
  konkreten Anzeige.
- Reisezeiten kommen aus einer kleinen Tabelle statt aus einem
  Routendienst.
- `/pricing` liegt hinter einem Feature Flag, bis das Geschäftsmodell
  entschieden ist.
- Der visuell gestaltete Lebenslauf ist als Art vorgesehen, aber nur die
  ATS-Fassung wird erzeugt.

## Was ausdrücklich nicht behauptet wird

- **Keine wissenschaftliche Validierung.** Weder der Bewertungslogik noch
  der Kurzaufgaben. Keine DIN-33430-Konformität.
- **Keine Konformitätsbewertung** nach dem EU-Rechtsrahmen für KI. Die
  Dokumentation ist eine Vorbereitung darauf.
- **Kein externer Sicherheitstest.**
- **Kein Test mit Screenreader-Nutzenden.**

## Nachgetragen in der zweiten Ausbaustufe

- [ADR 0007](adr/0007-postgres-statt-supabase-sdk.md) — Postgres mit
  Drizzle statt des Supabase-SDK. Abweichung vom Auftrag, begründet:
  die vorhandene Sicherheitsschicht ist geprüft, das SDK hätte drei
  Schichten gleichzeitig ersetzt.
- [ADR 0008](adr/0008-openai-als-erster-echter-anbieter.md) — OpenAI über
  die Responses-API, Modellname konfigurierbar, kein stiller Wechsel auf
  ein Ersatzmodell.
- [ADR 0009](adr/0009-echte-stellen-nur-aus-offenen-quellen.md) — echte
  Stellen ausschließlich aus Quellen, die sie selbst offen anbieten.

## Die nächsten fünf Schritte

1. **Semantische Suche einbinden.** `pgvector`, Embeddings über einen
   echten Anbieter, Abgleich über Bedeutung statt Wortgleichheit. Das hebt
   die Qualität des Matchings am deutlichsten.
2. **Weitere Stellenquellen.** Arbeitnow liefert echte Anzeigen, aber
   keine Gehälter und wenig Struktur. Adzuna und EURES sind rechtlich
   nutzbar und passen in dieselbe Schnittstelle; beide brauchen einen
   Schlüssel.
3. **Uploads fertigstellen.** Speicher anbinden, Dokumentextraktion,
   Malware-Scan. Der Lebenslauf ist für viele der natürliche Einstieg.
4. **Rate Limiting und ein Wiederherstellungstest.** Beides ist vor einem
   Betrieb mit echten Daten nicht verhandelbar.
5. **Die nutzerbezogenen API-Endpunkte und die native App.** Erst damit
   wird aus der Architektur ein zweites nutzbares Frontend.
