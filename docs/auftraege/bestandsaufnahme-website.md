# Bestandsaufnahme: Website, Einstiege, Versprechen

Auftrag A aus „Velvova: Website, Produktstruktur und Marketing".
Gemessen am 10.09.2026 gegen die Produktionsdatenbank (PostgreSQL 17.6,
Supabase — nicht PGlite) und gegen den Stand von `main` bei `428daef`.

Dieses Dokument beschreibt, **was ist**. Es entscheidet nichts.

---

## 1. Die Zahlen, die entscheiden, welcher Satz auf die Website darf

| Was | Zeilen |
| --- | ---: |
| `angebote` gesamt | **0** |
| `angebote` mit Status `aktiv` | **0** |
| `nachweise` | **0** |
| `nachweise` geteilt | **0** |
| `projekte` (die „Vorhaben") | **0** |
| `organizations` | 15 |
| `job_postings` veröffentlicht | 9 |
| `users` | 1.027 |
| `profile_skills` | 28 |
| `evidence_items` bestätigt | 142 |
| Absichten (Stufe 0, 10.09.2026) | 13 |

Daraus folgt unmittelbar, und ohne Spielraum:

- **„Morgens liegen Angebote da, nicht Anzeigen"** ist der zentrale Satz
  des Marketingdokuments. Er steht auf null Zeilen. Der Weg, der
  Angebote anlegt, ist gebaut (`/business/bedarf` →
  `lib/arbeitgeber/wunschprofil.ts`), aber ihn hat noch niemand
  benutzt. Der Satz darf nicht auf die Website.
- **„Ihr belegter Beitrag passt dazu"** — die Personenseite von
  Dokument 2 — steht ebenfalls auf null: `nachweise` ist leer. Was es
  gibt, sind 142 bestätigte Belege und 28 abgeleitete Fähigkeiten;
  das ist Selbstauskunft plus Ableitung, kein bestätigter
  Projektbeitrag.
- **„Vorhaben"** ist in Dokument 2 einer von drei Kernbereichen der
  Anwendung. Die Tabelle existiert, die Route `/app/projekte`
  existiert, die Zeilenzahl ist 0, und in keiner der beiden
  Navigationen kommt das Wort vor.

---

## 2. Was heute in der Kopfzeile steht

`apps/web/src/components/shell/TopNav.tsx:140–146` (öffentlich):

| Beschriftung | Ziel | Datei vorhanden |
| --- | --- | --- |
| Lösungen | `/product` | ja — `app/(redaktion)/product/page.tsx` |
| Warum Velvova | `/how-it-works` | ja |
| Für Unternehmen | `/for-business` | ja — `app/for-business/page.tsx` |
| Ressourcen | `/help` | ja |
| Sicherheit | `/security` | ja |

`TopNav.tsx:62–93` (angemeldet): Monday `/app/monday`, Jobs
`/app/jobs`, Bewerbungen `/app/applications`, Ausprobieren
`/app/proben`, FAQ `/app/faq`.

`shell/seitenleiste-eintraege.ts:82–103`: Heute Nacht `/app/morgen`,
Jobs & Checks, Was du kannst, Wie du arbeitest, Bewerbungen,
Dokumente, Plugins.

**Kein toter Link.** Alle fünf öffentlichen Ziele existieren als
Datei.

**Aber:** Von den beiden Einstiegen aus Dokument 2 — „Arbeit finden"
und „Unterstützung finden" — steht keiner in der Kopfzeile, und
„Preise" auch nicht. „Für Unternehmen" ist der einzige der beiden
Einstiege, der überhaupt vorkommt, und er führt auf eine
Marketingseite, nicht auf eine Handlung.

---

## 3. Die Startseite

`apps/web/src/app/page.tsx:364`

> Dein nächster Job.
> Mit mehr Klarheit.

Untertitel (`page.tsx:389`): „Monday hilft dir, Stellen zu verstehen,
Möglichkeiten zu vergleichen und deinen nächsten Schritt
vorzubereiten."

Der Kommentar darüber sagt ausdrücklich, warum: *„Er nennt nur, was
die Anwendung heute tut … Kein Versprechen über Passgenauigkeit."*

Das ist strenger als beide neuen Dokumente und heute richtig. Was
fehlt, ist der zweite Halbsatz: **Aufträge und Selbstständige kommen
auf der Startseite nicht vor.** Dokument 2 verlangt „Dein nächster
Job. Dein nächster Auftrag." — und dieser Satz wäre heute schon halb
gedeckt, denn Aufträge als Form gibt es im Datenmodell (`angebote.art`
kennt `wunschprofil`, `dauerbedarf`, `nachfolge`), nur eben mit null
Zeilen.

Die CTAs stehen in `components/marketing/Einstieg.tsx`: der Hauptknopf
auf die Monday-Anwendung, daneben `/business` (angemeldet) bzw.
`/firma` (abgemeldet).

---

## 4. Tote Knöpfe und uneingelöste Versprechen

### 4.1 „Preise ansehen" führte in eine Anmeldung — behoben am 10.09.2026

`app/for-business/page.tsx` verlinkte `/pricing`, und
`app/(public)/pricing/page.tsx` war eine Weiterleitung auf
`/app/settings/abo` hinter der Anmeldung. Derselbe Verweis stand im
Fuss **jeder** Seite.

Seither liegt die Seite unter `app/pricing/page.tsx` und zeigt
`Abomodell` aus `lib/billing/preismodell.ts` — nach Person und
Unternehmen getrennt, mit dem Vorbehalt an jeder Karte, die noch
nicht buchbar ist. Für Angemeldete steht der Weg ins eigene Konto
oben auf der Seite statt an ihrer Stelle.

`flags.pricingPage` in `packages/config/src/flags.ts:34` steht weiter
auf `false` — und wird von keiner einzigen Zeile gelesen. Das Flag ist
selbst ein Fall von Schema ohne Verdrahtung; angefasst wurde es nicht,
weil es eine Produktionseinstellung ist und nichts bewirkt.

`oeffentliche-ziele.test.ts` hält den Fall fest: Kein öffentlicher
Verweis darf auf eine Seite zeigen, die nur weiterleitet.

### 4.2 Zwei Unternehmenswelten mit ähnlichem Namen

`/for-business` ist die Marketingseite, `/business/*` die Anwendung
(15 Unterseiten, u. a. `bedarf`, `matches`, `stellen`, `analysen`).
Der Unterschied ist ein Bindestrich. Dokument 2 will genau einen
erkennbaren zweiten Einstieg mit der Hauptaktion „Unterstützung
finden"; diese Beschriftung kommt im Bestand nirgends vor.

### 4.3 Die Diagnose, die es noch nicht gibt

`/business/analysen/page.tsx` existiert. Was Dokument 1 des
Masterprompts unter Unternehmensdiagnose beschreibt — Beobachtung,
Hypothese, Gegenbeleg, bestätigter Befund, Lösungswege — gibt es seit
`428daef` als geprüfte Domänenlogik (`packages/domain/src/`
`bedarfsebenen.ts`, `befundlage.ts`, `quellenfreigabe.ts`), aber es
gibt keine Tabelle dafür und keine Oberfläche. Verdrahtet ist bisher
genau eine Stelle: Wer unter `/business/bedarf` eine Lage statt einer
Stelle beschreibt, bekommt drei Rückfragen statt eines
Angebotsentwurfs.

---

## 5. Zuordnung: Inhalt → Zielaufgabe → Funktion → Einstieg

| Heutiger Inhalt | Zielaufgabe (Dok. 2) | Tatsächliche Funktion | Einstieg |
| --- | --- | --- | --- |
| `/` (Startseite) | Arbeit finden | Suche, Fit, Morgenbericht | vorhanden, ohne Aufträge |
| `/product` „Lösungen" | So funktioniert's | Erklärseite | vorhanden, falsch benannt |
| `/how-it-works` | So funktioniert's | Erklärseite | doppelt zu `/product` |
| `/for-business` | Für Unternehmen | Erklärseite | vorhanden, CTA fehlt |
| `/unterstuetzung` | Unterstützung finden | Einstieg mit zwei Wegen | seit 10.09.2026 vorhanden |
| `/business/bedarf` | Unterstützung finden | Modul E, schreibt `angebote` | über `/unterstuetzung`, Firmenkonto nötig |
| `/business/analysen` | Unternehmensanalyse | Seite vorhanden, Diagnose fehlt | intern |
| `/pricing` | Preise | zeigt `preismodell.ts`, Person und Unternehmen | Fuss, Unternehmensseite, Startseite |
| `/security`, `/ai-transparency`, `/privacy` | Vertrauen und Kontrolle | vorhanden | im Fuss und in der Kopfzeile |
| `/app/morgen` | erstes Ergebnis | Morgenbericht, liest `angebote` | vorhanden |
| `/app/projekte` | Vorhaben | Route vorhanden, 0 Zeilen | **in keiner Navigation** |
| — | Nachrichten | existiert nicht als Bereich | fehlt |
| `/app/belege`, `/app/bruecke` | Können belegen | 142 Belege, 28 Fähigkeiten | vorhanden |
| `/app/proben` | Nachweise | `nachweise`: 0 Zeilen | vorhanden, ungenutzt |

---

## 6. Widersprüche zwischen den beiden Dokumenten

| Frage | Dokument 1 (Marketing) | Dokument 2 (Struktur) | Bestand |
| --- | --- | --- | --- |
| Kernsatz | „Morgens liegen Angebote da, nicht Anzeigen" | „Dein nächster Job. Dein nächster Auftrag." | „Dein nächster Job. Mit mehr Klarheit." |
| Menü | Kurs, Ehrlich, Wissen, Preise, Für Betriebe, Für Freelancer | Arbeit finden, Für Unternehmen, So funktioniert's, Preise | Lösungen, Warum Velvova, Für Unternehmen, Ressourcen, Sicherheit |
| Freelancer | eigener Menüpunkt | ausdrücklich **kein** dritter Einstieg | kommt nicht vor |
| Startmarkt | eine Stadt, ein Beruf (Pflege) | Kundenprozesse, CRM-nahe Aufgaben | Nutzer sind Lager/Logistik (gemessen 10.09.) |
| Ring | Station im Kreis, öffentlich erzählt | Statusdarstellung, kein Produkt | Animation vorhanden, `nacht_laeufe` verdrahtet |

Dokument 2 ist das jüngere und sagt selbst, dass es widersprechende
ältere Stellen ersetzt. Für die Umsetzung gilt Dokument 2; Dokument 1
liefert die Sprache für die Stationen, sobald sie Zeilen haben.

**Der Startmarkt ist der teuerste Widerspruch.** Dokument 1 setzt auf
Pflege, Dokument 2 auf CRM-nahe Aufgaben — und am 10.09.2026 hatten
0 von 142 bestätigten Belegen einen Pflegebezug. Die Menschen, die
heute im Bestand sind, arbeiten in Lager und Logistik. Ein Startmarkt,
der weder zu den vorhandenen Menschen noch zu den vorhandenen
Arbeitgebern passt, beginnt bei null, obwohl 1.027 Konten dastehen.

---

## 7. Offene Punkte

1. **Name.** Dokument 1 nennt die offene Entscheidung Monday oder
   Nina. Im Code heisst die Komponente `Nina*` (`NinaStreifen`,
   `nina_*`-Tabellen), sichtbar heisst sie Monday
   (`brand.assistantName`). Bis das entschieden ist, wird keine
   Umbenennung angefasst.
2. **Buchbar ist nur die kostenlose Stufe.** Die Preisseite steht,
   aber alles mit `nochNicht` in `preismodell.ts` — Begleitung Plus
   und Pro, Arbeitsraum Basis und Team — führt zu keiner Zahlung.
   Kontingente, Zählweise, Ablauffristen und der Zahlungsweg brauchen
   eine Freigabe, keinen Code.
3. **`FLAG_PRICING_PAGE`** steht auf `false` und wird nirgends
   gelesen. Entweder verdrahten oder streichen — beides ist eine
   Entscheidung, keine Aufräumarbeit.
4. **Die Kopfzeile trägt „Preise" nicht.** Der Weg führt über den
   Fuss, die Unternehmensseite und den Preisblock der Startseite. Die
   fünf Einträge oben sind ausdrücklich als fünf angelegt; ein
   sechster ist eine Gestaltungsentscheidung.
5. **Diagnose-Tabellen.** `bedarfsebenen.ts` und `befundlage.ts`
   rechnen heute ohne Speicher. Damit ein Befund einen Monat später
   noch dasteht, braucht es eine Migration; die ist nicht
   geschrieben und nicht freigegeben.
