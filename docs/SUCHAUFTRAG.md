# Monday sucht für dich weiter — Betrieb

Der persönliche Suchauftrag: Hintergrundsuche, nachvollziehbares
Matching, persönliche Zusammenfassung. Dieses Dokument beschreibt, was
läuft, was noch nicht läuft und was zum Einschalten fehlt.

## Die Kette

```
Import ──▶ Stellenanalyse ──▶ Suchauftrag ──▶ Treffer ──▶ Zusammenfassung ──▶ Versand
          (job_analysen)     (such_auftraege)  (auftrag_    (zusammen-        (mail_
                                                treffer)     fassungen)        ausgang)
```

Jeder Pfeil ist ein eigener Zustand in der Datenbank. Es gibt keinen
Schritt, dessen Ergebnis nur im Speicher eines Prozesses steht — ein
Worker, der stirbt, verliert Arbeit, keine Ergebnisse.

## Was wann läuft

| Dienst | Aufruf | Was er tut |
| --- | --- | --- |
| Stellenanalyse | `node --experimental-strip-types scripts/analyse-worker.mjs` | arbeitet `pgmq`-Warteschlange `job_analyse` ab |
| Nachtrag Bestand | `scripts/analyse-nachtragen.mjs` | reiht Altbestand in Stapeln ein, mit Obergrenze |
| Suchauftrag | `scripts/suchauftrag-worker.mjs` | fällige Aufträge, Treffer, Zusammenfassungen, Versand |

Umgebungsvariablen des Suchauftrag-Workers:

| Variable | Vorgabe | Bedeutung |
| --- | --- | --- |
| `SUCHAUFTRAG_TROCKEN` | – | `1`: alles bis zur fertigen Mail, kein Versand |
| `SUCHAUFTRAG_STAPEL` | 20 | wie viele Aufträge je Lauf |
| `SUCHAUFTRAG_JETZT` | – | mit einem anderen Zeitpunkt rechnen (Trockenlauf) |
| `APP_BASE_URL` | `https://velvova.de` | Basis der Links in der Mail |

### Fälligkeit steht in der Datenbank, nicht in der Warteschlange

`such_auftraege.naechste_faelligkeit` ist die Wahrheit. Die
Warteschlangen (`suchauftrag_profil`, `suchauftrag_suche`,
`suchauftrag_versand`) sind ein Transportweg.

Der Unterschied zählt, wenn ein Worker zwischen Lesen und Löschen
stirbt: Die Nachricht ist weg, der Auftrag bleibt fällig, der nächste
Lauf holt ihn.

### Zeitplan

`.github/workflows/suchauftrag.yml`, stündlich zur Minute 7. Er ruft
`POST /api/intern/suchauftrag` mit `JOBS_REFRESH_SECRET` auf — dasselbe
Verfahren wie der Stellenabruf.

**Stündlich, nicht nachts**, weil „08:00" die Ortszeit der Person ist:
Ein einzelner nächtlicher Lauf träfe das Fenster für Mitteleuropa und
für sonst niemanden. Doppelt zu laufen schadet nicht — der
Fensterschlüssel ist in der Datenbank eindeutig.

**Kein `pg_cron`.** Es kann nur SQL und bräuchte zusätzlich `pg_net`
und einen Endpunkt — also genau den, der ohnehin existiert, nur mit
einer Erweiterung mehr in der Produktionsdatenbank.

Zwei Secrets in GitHub: `PAYCHECK_BASE_URL` und `JOBS_REFRESH_SECRET`.
Fehlt eines, überspringt sich der Lauf mit einer Meldung, statt rot zu
blinken.

### Arbeitsteilung Skript / Endpunkt

| | Skript | Endpunkt |
| --- | --- | --- |
| sucht, bewertet, baut die Zusammenfassung | ja | ja |
| versendet | **nein** | ja |
| ruft ein Modell | **nein** | ja |

Der Grund ist technisch und war ein echter Fehler: `versand.ts` und
`modellrufer.ts` tragen `import "server-only"`, und Next liefert dieses
Modul mit — aus einem gewöhnlichen Node-Prozess ist es nicht
auffindbar. Die erste Fassung hatte dafür ein `catch`, das den
Importfehler in „Anbieter nicht angebunden" verwandelte. Der
Versandweg des Workers war nie erreichbar, und die Ausgabe hat jedes
Mal etwas anderes behauptet.

## Zustände

### Suchauftrag

`entwurf` → `aktiv` ⇄ `pausiert` → `beendet`

Ein Entwurf sucht nicht und versendet nicht. Schweigen lässt ihn dort
stehen. Nur `auftragAktivieren` macht daraus einen laufenden Auftrag.

### Treffer

`offen` → `ausgewaehlt` → `benachrichtigt`, daneben `verfallen` und
`ungueltig`.

Ein freigegebener, aber nicht ausgewählter Treffer bleibt `offen` und
verschwindet nicht am Versandstichtag.

### Versand

`queued` → `sending` → `accepted` → `delivered`,
daneben `failed`, `suppressed`, `unknown`.

`accepted` heisst Providerannahme, nicht Postfachzustellung.
`unknown` heisst: Zeitüberschreitung nach möglicher Annahme — es wird
**nicht** wiederholt, bis ein Webhook oder eine Nachfrage es klärt.

## Was den echten Versand heute verhindert

1. **Kein Mailanbieter für Digests.** `MAIL_PROVIDER` steht auf
   `draft`; ein funktionierender Login-Mailversand belegt keinen
   eingerichteten Digest-Versand. Der Adapter ist gebaut, der
   Trockenlauf funktioniert.
   Ausserdem fehlen `PAYCHECK_BASE_URL` und `JOBS_REFRESH_SECRET` in
   GitHub — ohne sie überspringt sich der Zeitplan.
2. **Keine bestätigte Adresse.** Ohne Double-Opt-in
   (`benachrichtigung_einstellungen.adresse_bestaetigt_am`) fällt ein
   Auftrag auf `nur_app` zurück.
3. **Keine Zustimmung.** `consents` kennt seit 0082
   `background_search`, `behaviour_signals`, `job_digest_email` — drei
   getrennte Entscheidungen.
4. **Rechtliche Prüfung.** § 7 UWG ist nicht geprüft; die Einordnung
   von Jobmails ist nicht pauschal zu treffen.

Die Prüfung läuft unmittelbar vor der Übergabe an den Anbieter noch
einmal (`versandHindernis`): Sperrliste, Kontostatus, Zustimmung,
Adressgleichheit, Pause, aktiver Auftrag.

## Anmeldung und Abmeldung

### Double-Opt-in

- `/app/suchauftraege` → Adresse eintragen → Bestätigungsmail.
- `GET /benachrichtigung/bestaetigen?t=…` zeigt eine Seite mit Knopf.
  **Bestätigt nichts** — ein Virenscanner, der den Link öffnet, würde
  sonst eine Adresse bestätigen, deren Besitzer nie geklickt hat.
- Erst das POST setzt `adresse_bestaetigt_am`, `email_aktiv` und
  schreibt die Einwilligung `job_digest_email` ins Ledger.
- Ein Token gilt sieben Tage. Wer zwischendurch eine andere Adresse
  einträgt, entwertet den alten Link — er könnte sonst eine Adresse
  bestätigen, die in seiner Mail nie stand.

Die Regel steht zusätzlich als Bedingung an der Tabelle
(Migration 0085): `email_aktiv` ist nur wahr, wenn
`adresse_bestaetigt_am` gesetzt ist. Im Code steht sie an drei
Stellen; an der Tabelle steht sie einmal und lässt sich nicht
verlieren.

## Abmeldung

- `GET /abmelden?t=…` zeigt eine Bestätigungsseite. **Speichert
  nichts** — Virenscanner klicken Links.
- `POST /api/abmelden` meldet ab. Derselbe Endpunkt bedient den
  Ein-Klick-Weg nach RFC 8058.
- Die Mail trägt `List-Unsubscribe` und `List-Unsubscribe-Post`.
  Beide zusammen, sonst rufen Anbieter den Link per GET ab.
- Das Token erlaubt nur diese eine Sache. Gespeichert wird nur der
  Hash.
- Abmelden ≠ Suche beenden. Die Treffer bleiben in Velvova.

## Zustellereignisse

`POST /api/webhooks/mail` nimmt die Ereignisse des Anbieters an.

- **Signatur** nach dem Svix-Verfahren (`svix-id`, `svix-timestamp`,
  `svix-signature`), Geheimnis in `MAIL_WEBHOOK_SECRET`. Ohne
  Geheimnis: 401. Ein unsignierter Endpunkt liesse sich von jedem
  beschicken — ein gefälschtes `bounced` sperrt eine fremde Adresse.
- **Zeitfenster** fünf Minuten gegen Wiedereinspielen.
- **Entdoppelung** über `zustell_ereignisse.anbieter_ereignis_id`.
- **Reihenfolge**: Zustände sind geordnet, ein Ereignis darf nur nach
  vorne schieben. Ein verspätetes `delivered` hebt keinen Bounce auf.
- Die Nutzlast des Anbieters wird **nicht** gespeichert — sie trägt
  die Empfängeradresse und wird für die Zustandsführung nicht
  gebraucht.

## Modellaufrufe

Verdrahtet sind **Systemprompt 1** und **3**. Prompt 2
(Matchingbelege) ist geschrieben, mit Schema und Nachprüfung, und noch
nicht gerufen.

### Systemprompt 2 — Matchingbelege

Läuft nach der deterministischen Prüfung, für höchstens fünf
Kandidaten je Runde und nur für die, bei denen keine Muss-**Gruppe**
verletzt ist.

| Prüfung | Was sie abfängt |
| --- | --- |
| `matchbelegePruefen` | fremde Stellen, fremde Kriterien, erfundene Belegkennungen |
| Belegpflicht | „erfüllt" ohne Jobbeleg → `unknown` |
| `belegeVerschmelzen` | Modell überstimmt kein berechnetes Urteil |

**Wer bei Widerspruch gewinnt:** Bei allem Rechenbaren der Code, ohne
Ausnahme. Das Modell darf nur bei `taetigkeit`, `berufsfeld` und
`taetigkeit_ausschluss` bewegen — und dort nur mit einer Belegkennung
aus der Anzeige. Der umgekehrte Weg wäre bequemer und würde eine
Bedingung aufheben, die eine Person ausdrücklich gesetzt hat.

**Übertragbare Fähigkeiten** in drei Stufen:

| Stufe | Darf in den Fit? |
| --- | --- |
| `direct_skill_match` | ja |
| `transferable_skill_match` | ja |
| `unverified_possible_transfer` | **nein** — wird eine Rückfrage |

Ein Transfer ohne Profilbeleg wird serverseitig zur dritten Stufe
herabgestuft. „Gastronomie" beweist keine Kundenbetreuungskompetenz.

### Semantische Kandidatensuche

Ein **Recall-Schritt**, kein Urteil. Ablauf:

```
harte Struktur (Land, Gehalt, Arbeitsmodell)
  ├── Stichwort/Titel  ──┐
  └── Semantik ──────────┴──▶ Kandidatenpool ──▶ volle Muss-Prüfung ──▶ Fit
```

Die Semantik läuft über **denselben** Strukturfilter, nur ohne die
Stichwörter — sie soll finden, was anders *heisst*, nicht was anders
bezahlt oder woanders liegt.

Eingebettet wird ein kompakter Text: Titel, Aufgaben, Anforderungen,
Berufseinordnung. **Nicht** die ganze Anzeige — sonst misst man die
Ähnlichkeit von Werbetexten, und zwei Anzeigen desselben
Personaldienstleisters ähneln sich stark, auch wenn die eine einen
Lageristen und die andere einen Pfleger sucht.

Vom Profil: gewünschte Tätigkeiten, bestätigte Fähigkeiten,
Berufsfelder, weiche Vorlieben. **Kein** Gesprächsverlauf.

Wiederverwendet über einen Fingerabdruck des Textes: Ein Vektor hängt
am Text, nicht am Datum. Modell und Dimensionen stehen daneben —
Vektoren verschiedener Modelle sind nicht vergleichbar, und die
Kosinusrechnung sagt trotzdem eine Zahl.

**Gemessen an 200 echten Anzeigen** (`text-embedding-3-small`), gegen
ein Lagerprofil:

| Ähnlichkeit | Stelle | Stichwort „lager" findet sie |
| --- | --- | --- |
| 0.696 | Fachkraft für Lagerlogistik | ja |
| 0.542 | Staplerfahrer:in | **nein** |
| 0.520 | Versandmitarbeiter | **nein** |
| 0.508 | Paketzusteller | **nein** |
| 0.483 | Produktionshelfer DruckService | — |
| 0.470 | Schlosser / Mechaniker | — |

Die Schwelle steht deshalb bei **0.50**. Die erste Fassung stand bei
0.62 und hätte nur zugelassen, was die Stichwortsuche ohnehin fand —
ein Recall-Schritt, der nichts Neues findet, ist keiner.

**Kein pgvector.** `vector` 0.8.2 ist verfügbar und nicht installiert:
Die Kosinusrechnung läuft im Prozess über den strukturell gefilterten
Pool (Obergrenze 2.000). Der Zeitpunkt für den Wechsel ist messbar —
wenn die Auswahlrunde länger dauert als der Modellaufruf danach.

### Ort, Umkreis, Remote

| Fall | Verhalten |
| --- | --- |
| Karlsruhe ODER remote | eine ODER-Gruppe; eine erfüllte Alternative genügt |
| Karlsruhe UND hybrid | zwei Gruppen; beide müssen stimmen |
| 30 km um Stuttgart | `umkreis` mit Luftlinie — **ohne Koordinaten `unbekannt`** |
| Remote nur in DE | `arbeitsland` gegen `jobs.country` |
| Hybrid 200 km weg | Arbeitsmodell erfüllt, Umkreis nicht — beide zählen |
| Stuttgart oder Karlsruhe | eine Werteliste, ODER innerhalb |
| „heute auch Hamburg" | eigene Gruppe mit Frist, überschreibt nichts |

**Der Umkreis ist kein Vorfilter.** Elf von 1.215 analysierten
Anzeigen tragen Koordinaten; ein Bounding-Box-Filter entfernte 99
Prozent des Bestands — und zwar genau die, für die die feine Prüfung
„unbekannt" gesagt hätte.

### Systemprompt 1 — aus einem Satz ein Auftrag

„Monday, such für mich weiter nach Lagerstellen in Karlsruhe oder
komplett remote, mindestens 32.000, keine Nachtschicht."

Der Einstieg aus Chat, Sprache und dem Feld unter „Suchaufträge". Das
Modell schlägt Kriterien vor; `verdichten` entscheidet, was gilt. Am
Ende steht ein **Entwurf**, nie ein laufender Auftrag.

Vier Prüfungen zwischen Vorschlag und Entwurf:

| Prüfung | Was sie abfängt |
| --- | --- |
| Taxonomie | ein Kriterium, für das es keine Prüfung gibt |
| Operator und Stärke | erfundene Werte |
| `verdichten` | fehlende Belege, Beobachtetes als Muss, Befristung ohne Frist |
| `ortUndModellTrennen` | „remote" in einer Ortsliste — und Ort plus Remote ohne gemeinsame Gruppe |
| `taetigkeitStamm` | „lagerstellen" statt „lager" |

Die letzte kam aus einem echten Aufruf: Das Modell lieferte
`arbeitsort: ["Karlsruhe", "remote"]`. Das sieht richtig aus und wäre
stillschweigend nie erfüllt gewesen — die Ortsprüfung vergleicht mit
`jobs.location`, dort steht nie „remote". Jetzt werden daraus zwei
Kriterien **einer** Gruppe: „oder", nicht „und".

Beim zweiten Aufruf kamen Ort und Arbeitsmodell **getrennt**, beide
ohne Gruppe. Zwei Muss-Kriterien ohne Gruppe sind ein UND: „in
Karlsruhe UND vollständig remote" findet fast nichts. Nur `remote`
wird zusammengefasst — bei `hybrid` und `on_site` ist das UND die
richtige Lesart.

Beim dritten: `taetigkeit: ["lagerstellen"]`. Die Prüfung vergleicht am
Wortanfang; „lagerstellen" ist kein Präfix von „Lagerhelfer". Der
Auftrag hätte im ganzen Bestand nichts gefunden — und eine leere Liste
sieht aus wie ein leerer Arbeitsmarkt. `taetigkeitStamm` streicht
Endungen, die ausdrücklich „Stelle" bedeuten, und lässt Berufe in Ruhe.
Derselbe Stamm gilt für den Filterweg: Wer „Lagerstellen" eintippt,
meint Lager.

Aus dem ersten Aufruf: `arbeitsatmosphaere: gut`. Der Taxonomiewächter
hat es verworfen, und die Person erfährt es — ein Kriterium, das
stillschweigend wegfällt, lässt sie auf etwas warten, das nie
gespeichert wurde.

Die Eingabe nennt zu jedem Kriterium die erwartete Werteform. Nur die
Schlüssel zu nennen hat nicht gereicht: In zwei Läufen liess das Modell
die Tätigkeit ganz weg und machte sie zur Rückfrage — die Anweisung
„Berufskennungen ausschliesslich aus der vorhandenen Taxonomie" liest
sich ohne mitgelieferte Taxonomie wie ein Verbot.

### Was zwischen Läufen schwankt

Derselbe Satz ergibt nicht jedes Mal dieselbe Einstufung: In einem Lauf
wurden Ort und Tätigkeit `muss`, im nächsten `wunsch`. Die Wächter
greifen in beiden Fällen, und aktiviert wird ohnehin nichts ohne
Zustimmung — aber der Entwurf sieht verschieden aus.

Das ist der Grund, warum der Bestätigungssatz aus dem gespeicherten
Stand gebaut wird und nicht aus der Modellantwort. Was die Person
liest, ist, was in der Datenbank steht.

Was das Modell **nicht** liefert: den Namen des Auftrags und den
Bestätigungssatz. Beides baut der Code aus dem, was tatsächlich
gespeichert wurde. Ein Satz, der etwas anderes aufzählt als in der
Datenbank steht, wäre die schlimmste Sorte Bestätigung.

### Keine Modellaufrufe in offenen Transaktionen

`zusammenfassungBauen` und `suchprofilAusText` laufen in drei Phasen:
lesen (Transaktion), Modell (**ohne**), schreiben (Transaktion).

Die erste Fassung hatte alles in einer. Aufgefallen ist es an einer
Testumgebung mit genau einer Verbindung — dort ist derselbe Aufbau
kein Ressourcenproblem, sondern ein Stillstand. In Produktion wäre es
eine offene Transaktion je Person, die auf ein fremdes Netz wartet.

Was das Modell hier darf: formulieren und je Stelle einen der bereits
validierten Gründe **auswählen**. Titel, Arbeitgeber, Gehalt, Ort,
Link und Empfänger gehen gar nicht erst durch diesen Weg.

Dreifach geprüft:

| Prüfung | Wo | Was sie abfängt |
| --- | --- | --- |
| Schema | beim Aufruf, Zod | die Form |
| Auswahl | `mailtextPruefen` | hinzugefügte oder weggelassene Stellen, erfundene Gründe, erfundene Vorbehalte |
| Zahl | `betreffZahlStimmt` | „5 neue Stellen" bei drei |

Eine geänderte Auswahl macht den **ganzen** Text unbrauchbar — sie
heisst, dass das Modell eine Entscheidung getroffen hat, die ihm nicht
zusteht. Ein falscher Betreff fällt einzeln zurück.

Das `basis_label` des Modells wird verworfen, nicht verglichen: Ob ein
Auftrag bestätigt oder ein Filter übernommen wurde, weiss der Code.

### Grenzen und Protokoll

Jeder Aufruf schreibt nach `ai_runs` — Zweck, Modell, Tokens, Kosten,
Dauer, Status. **Kein** Inhalt: kein Profil, kein Anzeigentext, keine
Begründung im Wortlaut.

| Grenze | Wert | Ort |
| --- | --- | --- |
| je Person und Tag | 50 Cent | `BUDGET.proNutzerTagCent` |
| insgesamt und Tag | 20 Euro | `BUDGET.gesamtTagCent` |

Gezählt wird über dieselbe Tabelle, in die geschrieben wird. Bei
erreichter Grenze wird nicht gerechnet und nicht geraten — es läuft der
deterministische Ersatztext, und `budget_exceeded` steht im Protokoll.

Kein Aufruf bei null Empfehlungen. Kein Aufruf ohne eingerichtetes
Modell. Jeder Fehler fällt auf den Ersatztext zurück: Die Person für
einen technischen Fehler zu bestrafen, indem sie ihre Zusammenfassung
nicht bekommt, wäre die falsche Reihenfolge.

**Preise sind Konfiguration**: `AI_PREIS_INPUT_CENT_PRO_MTOKEN` und
`AI_PREIS_OUTPUT_CENT_PRO_MTOKEN`. Ohne sie gilt eine bewusst hohe
Vorgabe, und jeder Eintrag ist als geschätzt gekennzeichnet. Ein
Budget mit veralteten Preisen hält nicht, was es verspricht.

## Rückmeldungen

Aus einem Muster wird eine Frage, kein Filter.

- Ab drei Ablehnungen **mit genanntem Grund** innerhalb von 60 Tagen
  erscheint eine Klärungsfrage. Ablehnungen ohne Grund zählen nicht
  mit: „nicht relevant" heisst diese Stelle, nicht solche Stellen.
- Die Antwort „passt generell nicht" wird ein **weiches** Kriterium.
  Ein Muss darf nur aus einer ausdrücklichen Bedingung entstehen.
- Nach 60 Tagen ohne App-Aktivität ruhen die Benachrichtigungen
  (`versandHindernis` → `ruhend:<tage>`). Nicht abgemeldet:
  Inaktivität ist kein Widerruf.
- Gemessen wird der Besuch der Anwendung, **kein Öffnungspixel**. Der
  misst Postfacheinstellungen, nicht Interesse.

## Zugriffstrennung

Alle vierzehn neuen Tabellen tragen RLS mit `FORCE`. Zwölf davon über
die Eigentümerregel (`user_id = app_current_user_id()`).

`unterdrueckungen` und `zustell_ereignisse` haben keine `user_id` —
absichtlich: Eine Adresse bleibt gesperrt, auch wenn sie später zu
einem anderen Konto gehört. Beide bekommen deshalb eine ausdrückliche
Verweigerung für die Anwendungsrolle; der Versanddienst arbeitet über
die Systemverbindung.

## Produktregeln, die kalibriert werden müssen

Alle Startwerte sind Entscheidungen, keine Messergebnisse:

| Regel | Wert | Ort |
| --- | --- | --- |
| Empfehlungsschwelle | 70 / 100 | `EMPFEHLUNG_V1.schwelle` |
| Mindestabdeckung | 0,55 | `EMPFEHLUNG_V1.mindestAbdeckung` |
| Stellen je Mail | 5 | `AUSWAHL_V1.hoechstens` |
| Je Arbeitgeber | 2 | `AUSWAHL_V1.jeArbeitgeber` |
| Kandidaten je Runde | 30 | `KANDIDATEN_JE_RUNDE` |
| Verfall Verhaltenssignale | 21 Tage | `VERHALTEN_VERFALL_TAGE` |
| Versandzeit | 08:00 Ortszeit | `such_auftraege.sendezeit_lokal` |
| Klärungsfrage ab | 3 Ablehnungen | `KLAERUNG_AB` |
| Zählfenster | 60 Tage | `KLAERUNG_FENSTER_TAGE` |
| Ruhe nach | 60 Tagen | `RUHEND_NACH_TAGEN` |
| Modellbudget je Person | 50 Cent/Tag | `BUDGET.proNutzerTagCent` |
| Modellbudget gesamt | 20 Euro/Tag | `BUDGET.gesamtTagCent` |
| Belege je Runde | 5 Kandidaten | `BELEGE_JE_LAUF` |
| Ähnlichkeitsschwelle | 0,50 | `AEHNLICHKEIT_SCHWELLE` |
| Semantikpool | 2.000 Stellen | `SEMANTIK_POOL` |
| Einbettungen je Lauf | 200 | `EINBETTUNG_JE_LAUF` |

Es gibt keinen Goldstandard, gegen den diese Werte geprüft wären. Die
Schwelle von 70 ist keine Erfolgswahrscheinlichkeit.

## Abnahme

- `packages/jobs/src/suchauftrag/abnahme.test.ts` — Fälle A, B, C, E,
  F, G, H, I, J, K, L, N gegen eine echte Postgres-Instanz
- `packages/matching/src/suchkriterien.test.ts` — Fall D, kein false
  pass
- `packages/jobs/src/versandfenster.test.ts` — Zeitzonen und
  Sommerzeit
- `packages/matching/src/modellpruefung.test.ts` — fremde Kennungen,
  erfundene Gründe, falsche Trefferzahl
- `packages/matching/src/rueckmeldungsregeln.test.ts` — Klärungsfrage
  und Ruhestand
- `apps/web/src/lib/suchauftrag/webhooksignatur.test.ts` — Signatur,
  Wiedereinspielen, Schlüsselwechsel
- `packages/jobs/src/suchauftrag/mailtext.test.ts` — was mit einer
  Modellantwort geschieht, die etwas Unerlaubtes enthält
- `packages/ai/src/preise.test.ts` — Kostenrechnung und Vorgabepreise
- `packages/jobs/src/suchauftrag/abnahme17.test.ts` — die sechs
  Stellen aus Abschnitt 17 und die ganze Kette bis zur Mailvorschau
- `packages/matching/src/vektor.test.ts` — Kosinus, Schwelle,
  Einbettungstexte
- `packages/matching/src/skilltaxonomie.test.ts` — Adapter und der
  `unmapped`-Zustand
- `packages/jobs/src/suchauftrag/suchprofil.test.ts` — was der Code an
  einem Vorschlag zurückweist
