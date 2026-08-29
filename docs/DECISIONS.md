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

**3. Vier Barrierefreiheitsverstöße.**
Kontrast nur gegen die hellste Fläche geprüft, Zustände über Deckkraft
signalisiert, Links nur an der Farbe erkennbar, weiße Schrift auf hellem
Akzent im Dunkelmodus. Alle vier in
[ACCESSIBILITY.md](ACCESSIBILITY.md) beschrieben.

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

## Die nächsten fünf Schritte

1. **Semantische Suche einbinden.** `pgvector`, Embeddings über einen
   echten Anbieter, Abgleich über Bedeutung statt Wortgleichheit. Das hebt
   die Qualität des Matchings am deutlichsten.
2. **Eine lizenzierte Jobquelle anbinden.** Der Adapter steht; es fehlt
   der Vertrag. Ohne echte Stellen bleibt alles Demo.
3. **Uploads fertigstellen.** Speicher anbinden, Dokumentextraktion,
   Malware-Scan. Der Lebenslauf ist für viele der natürliche Einstieg.
4. **Rate Limiting und ein Wiederherstellungstest.** Beides ist vor einem
   Betrieb mit echten Daten nicht verhandelbar.
5. **Die nutzerbezogenen API-Endpunkte und die native App.** Erst damit
   wird aus der Architektur ein zweites nutzbares Frontend.
