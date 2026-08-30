# Statusbericht V5 — Global Job Metasearch

Stand: 30. August 2026. Branch `feature/legal-global-metasearch`.
Checkpoint vor diesem Durchgang: `checkpoint-before-metasearch-platform`.

---

## Kurzfassung

| | |
| --- | --- |
| Unit-Tests | 364, grün |
| E2E-Tests | 305, grün (5 übersprungen: nur mobil) |
| Evaluationsfälle | 50 von 50 |
| Typecheck / Build | fehlerfrei |
| Barrierefreiheit | 0 schwere Verstösse, beide Themen |
| Quellen im Verzeichnis | 21, davon 5 freigegeben |
| Echte Stellen | rund 175 von Arbeitnow, live |
| Produktivbetrieb | **nein** |

---

## Phase 0 — Sicherheit

Checkpoint gesetzt, `.gitignore` um Schlüsselmaterial ergänzt
(`*.pem`, `*.key`, `*.p12`, `*.pfx`, `secrets/`).

Secret-Scan über Arbeitsbaum **und Historie**: kein Treffer ausser einem
ausdrücklich als lokal gekennzeichneten Platzhalter in `infra/README.md`. Von
den `.env`-Dateien wurde nur `.env.example` je versioniert.

**Du musst die vier Schlüssel rotieren**, die in früheren Nachrichten standen.
Sie gelten als kompromittiert, auch wenn sie niemand benutzt hat.

---

## Was in diesem Durchgang entstanden ist

### Job-Link analysieren (Tier E)

Der Weg, auf dem eine Anzeige aus einer Quelle ins System kommt, mit der wir
keinen Vertrag haben — zulässig, weil die Person sie selbst mitbringt.

Drei Antworten, nicht zwei. Von einer nicht freigegebenen Quelle wird **nichts
abgerufen**; die Adresse wird ein privates Lesezeichen, und die Person kann den
Text einfügen. Kein „leider fehlgeschlagen", das nach einem technischen Problem
klingt.

Die SSRF-Prüfung läuft zweistufig, und die zweite zählt: geprüft wird **jede
aufgelöste Adresse**, verbunden wird zu genau der. Ein Name, der auf
93.184.216.34 und 127.0.0.1 zeigt, ist der Rebinding-Angriff. Weiterleitungen
werden nicht verfolgt — ein 302 auf 127.0.0.1 hebelt sonst alles aus.

Live geprüft: `169.254.169.254` (Metadatendienst), `file:///etc/passwd`,
`localhost:5432`, Zugangsdaten in der URL, Bruchstücke — alle abgewiesen.

Gelesen wird nur JSON-LD, kein HTML-Fliesstext. Was der Arbeitgeber selbst als
maschinenlesbare Beschreibung veröffentlicht, ist dafür da.

### Arbeitgeberboards (§4.5–4.8)

Greenhouse, Lever, Ashby, SmartRecruiters. **Ein Board pro Arbeitgeber, kein
globaler Feed.**

Darin liegt die Versuchung: die Endpunkte antworten jedem, der den Firmennamen
errät. Ein Skript, das Namen durchprobiert, baut aus Arbeitgeberboards ein
Verzeichnis, das der Anbieter nie angeboten hat. Deshalb steht der
Board-Bezeichner in `employer_boards` mit Pflichtfeldern für Art, Beleg und
Zeitpunkt der Autorisierung — und nirgends sonst. Rechtsgrundlage ist
`employer_authorization`, nicht `official_api_terms`.

**Die Tabelle ist leer.** Kein Board ist registriert, also wird keines
abgerufen. Die Parser sind trotzdem gegen die Live-Formate geprüft: 671
Anzeigen von drei öffentlichen Demo-Boards korrekt gelesen, nichts gespeichert.

### Partnerquellen ohne Vertrag

LinkedIn, Indeed, StepStone, EURES, Bundesagentur existieren als Adapter — und
rufen nichts ab. Sie **werfen** beim Versuch, statt eine leere Liste zu
liefern: eine leere Liste sähe aus wie „keine Stellen gefunden" und erschiene
im Bericht als erfolgreicher Abruf.

Warum sie überhaupt existieren: fehlt der Adapter, sieht die Betriebsansicht
aus, als gäbe es LinkedIn nicht — und die nächste Person schreibt einen
Scraper, statt nach einem Vertrag zu fragen.

### Lightcast

Vollständig vorbereitet, mit **zwei** Riegeln. Zugangsdaten allein schalten
nichts ein: `LIGHTCAST_ENABLED` muss ausdrücklich gesetzt sein. Wer einen
Schlüssel zum Ausprobieren einträgt, soll damit keinen kostenpflichtigen Abruf
auslösen, dessen Anzeigerechte niemand geprüft hat.

Das Parsen ist ausgelagert und gegen eine Fixture geprüft. Ein Adapter, dessen
Auslegung des Formats erst am Tag der Vertragsunterschrift zum ersten Mal
läuft, ist ein Adapter ohne Aussage.

### Jooble je Land

Eigener Schlüssel, eigener Adapter, eigener Verzeichniseintrag für DE, CH, AT.
Ausdrücklich **ohne** Rückfall vom Schweizer auf den deutschen Schlüssel — das
wäre ein Vertragsbruch, den niemand bemerkt.

### Sprachsitzung (§14.4)

Kurzlebiges Sitzungsgeheimnis vom Server. Der Projektschlüssel geht nie in eine
Antwort. Drei Riegel in dieser Reihenfolge: angemeldet, eingewilligt, Anbieter
verbunden. Live geprüft: ohne Einwilligung 403 mit Begründung.

### Betrugssignale (§13.2)

Der Teil, in dem es nicht um Passung geht, sondern um Schaden. Vorschusszahlung,
Bankdaten vor dem Gespräch, Finanzagenten- und Paketagentenmaschen,
Messenger-only, unrealistische Verdienstversprechen.

Drei Regeln: **das Wort „Betrug" fällt nie**, **kein Modell entscheidet**, und
zu jedem Signal steht **die Fundstelle im Text**. Ein Hinweis, den die Person
nicht prüfen kann, ist eine Behauptung.

Gegen 175 echte Anzeigen: null Fehlalarme.

---

## Was ich kaputt gefunden habe

**`/app/settings` war 160.685 Pixel hoch.** 12.706 Knoten, 2.101 bedienbare
Elemente. `listSessions()` gab jede nicht widerrufene Sitzung zurück — ohne
Obergrenze und **ohne das Ablaufdatum zu prüfen**. 2.071 längst abgelaufene
Sitzungen standen unter „angemeldete Geräte". Das ist keine lange Liste, das
ist eine falsche Aussage über die Sicherheit des Kontos. Jetzt 2.537 Pixel,
413 Knoten, 52 bedienbare Elemente.

**`.env.example` und der Code sprachen verschiedene Sprachen.** Dokumentiert
war `OPENAI_MODEL_DEFAULT`, gelesen wurde `OPENAI_MODEL_INTERACTIVE`. Wer dem
Beispiel folgte, setzte eine Variable, die niemand las, und bekam
stillschweigend den Standardwert. Elf weitere standen dokumentiert und
ungelesen im Beispiel. Ein Test prüft das jetzt in beide Richtungen.

**Ein `null` in einer Jobliste liess alle vier ATS-Parser stürzen.** Kommt bei
jedem Anbieter vor — und hätte statt neunundvierzig guten Anzeigen einen
Absturz geliefert. Von den Vertragstests gegen Fixtures sofort gefunden.

**Schlüsseldrift, zweimal.** Der Nutzerimport-Adapter hiess `user_text`, der
Verzeichniseintrag `user_private_import`. Die Partneradapter hiessen
`linkedin`, das Verzeichnis `linkedin_partner_pending`. Beide Male fail-closed
mit der **falschen Begründung** — ein Fehler, der sich hinter korrektem
Verhalten versteckt.

**Trennbare Verben.** „Du empfängst Gelder und leitest sie weiter" — die
Vorsilbe wandert im Deutschen ans Satzende. Ein Muster, das nur
„weiterleiten" kennt, findet genau die Formulierung nicht, die benutzt wird.

**Parameter-Properties** (`private readonly` im Konstruktor) lassen Dateien
unter Nodes `--experimental-strip-types` scheitern — wovon die Skripte zur
Dokumentationserzeugung abhängen.

**Ein doppelter Punkt** in jeder Antwort des Import-Endpunkts: „keine
schriftliche Freigabe.. Der Verweis". Kein Test bemerkt das, jede Person sieht
es.

---

## Was nicht läuft

**ESCO ist nicht angebunden** (Phase 3). Die Rollenzuordnung ist regelbasiert
und gröber. Nicht begonnen.

**Hybrid Search fehlt** (§12.1). `pgvector` ist in den Supabase-Migrationen
vorgesehen, aber die laufende Suche arbeitet mit Wortüberlappung — kein FTS,
keine Embeddings, kein RRF.

**Kein Employer Portal** (Tier D). Die Tabelle `employer_boards` existiert und
wird gelesen; die Selbstregistrierung mit Domainverifikation nicht.

**Supabase ist nicht verbunden.** Die Migrationen liegen unter
`supabase/migrations/`, angewendet ist die eingebettete Datenbank. Die
Oberfläche sagt das ausdrücklich.

**Kein Ratenlimit**, **keine Verschlüsselung schutzbedürftiger Freitexte**,
**kein Auftragsverarbeitungsvertrag**, **kein Versandweg**, **kein
Penetrationstest**. Alles in `docs/PRODUCTION_CHECKLIST.md` und
`docs/DPIA_DRAFT.md` als offen geführt.

**`/app/jobs` ist auf dem Telefon 23.889 Pixel hoch** bei 4.967 Knoten. Das ist
eine Liste und damit erklärbar, aber es ist viel. Nicht angefasst.

---

## Das Muster, das sich durchzieht

Fast jeder gefundene Fehler war lautlos.

Eine Sitzungsliste ohne Ablaufprüfung sieht aus wie eine Sitzungsliste. Eine
dokumentierte Variable, die niemand liest, führt zu einem Standardwert statt zu
einer Fehlermeldung. Ein Adapter mit falschem Schlüssel wird korrekt gesperrt —
mit der falschen Begründung. Ein leeres Array sieht aus wie „nichts gefunden".

Deshalb wirft ein nicht autorisierter Anbieter, statt leer zurückzugeben.
Deshalb prüft ein Test beide Richtungen zwischen `.env.example` und Code.
Deshalb steht zu jedem Betrugssignal ein Zitat aus der Anzeige.

**Wo etwas fehlschlagen kann, ohne dass etwas fehlschlägt, gehört ein Test hin.**
