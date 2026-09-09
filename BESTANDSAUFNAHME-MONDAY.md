# Bestandsaufnahme vor dem Velvova/Monday-Umbau

Stand: 9. September 2026 · Stufe 0 nach §17 des Konzepts Fassung 3

Diese Datei hält fest, was **tatsächlich im Code steht** — nicht, was
geplant ist. Sie ist die Grundlage für jede Entscheidung darüber, was
umgebaut und was neu gebaut wird. Wo etwas fehlt, steht das hier, und
zwar bevor jemand eine Navigation dafür baut.

---

## 1. Der eine Befund, der den Umbau begründet

**Die Anwendung hat keine eigene Hülle.**

`AppShell.tsx` (415 Zeilen) rendert `TopNav` — dieselbe Kopfzeile wie
die öffentliche Website — plus `BottomNav` für schmale Geräte. Es gibt
im ganzen Projekt **keine Seitenleiste**: kein `Sidebar`, kein `aside`,
keinen Bereich für Projekte oder letzte Gespräche.

Das ist genau das, was das Konzept in §1 und §14 als Fehler benennt:
Die App trägt den Marketing-Header. Der Umbau ist damit kein
Feinschliff an einer vorhandenen Hülle, sondern deren Bau.

---

## 2. Routen

**88 Seitenrouten**, verteilt auf:

| Bereich | Anzahl | Beispiele |
|---|---:|---|
| privat (`/app/…`) | 42 | `/app/monday`, `/app/jobs`, `/app/applications` |
| Arbeitgeber (`/business/…`) | 13 | `/business/matches`, `/business/stellen` |
| öffentlich | 23 | `/`, `/product`, `/security`, `/for-business` |
| Anmeldung | 6 | `/login`, `/register`, `/firma` |
| Verwaltung | 5 | `/admin/sources`, `/admin/providers` |

**7 Layouts:** Wurzel · `(auth)` · `(public)` · `(redaktion)` · `/app` ·
`/app/settings` · `/business`

### Doppelte Namen — geprüft, nicht vermutet

`/app/nina` ist eine **16-zeilige Weiterleitung** auf `/app/monday`
(122 Zeilen). Verweise im Code: 0 auf Nina, 35 auf Monday. Der
Namenswechsel ist an dieser Stelle also bereits vollzogen; zu prüfen
bleiben `/app/settings/nina` und `/nina-einrichten`.

---

## 3. Navigation

### Öffentlich (BESUCHER)

Lösungen `/product` · Warum Velvova `/how-it-works` ·
Für Unternehmen `/for-business` · Ressourcen `/help` ·
Sicherheit `/security`

### Angemeldet (BEREICHE) — sieben Einträge

Monday `/app/monday` · Jobs `/app/jobs` · Bewerbungen
`/app/applications` · Ausprobieren `/app/proben` · FAQ `/app/faq` ·
Für Unternehmen `/for-business` · Sicherheit `/security`

Die letzten beiden sind öffentliche Marketingseiten in der
Arbeitsnavigation — nach Konzept §7 gehören sie dort nicht hin.

### Kontomenü — 13 Einträge

Gespeicherte Jobs · Suchaufträge · Karriereprofil · Dokumente · Deine
Belege · **Lösungen · So funktioniert es · Preise** · Einstellungen ·
Abo & Zahlung · Benachrichtigungen · Datenschutz · Hilfe

Die drei fett markierten sind Marketingseiten. Das Konzept verlangt
vier Einträge: Konto, Abo, Hilfe, Abmelden.

---

## 4. Datenmodell: 134 Tabellen

### Vorhanden und gefüllt

| Tabelle | Zeilen (lokal) | Bedeutung für das Zielbild |
|---|---:|---|
| `users` | 1 850 | Konto |
| `jobs` | 120 | Stellen |
| `companies` | 69 | Firmen |
| `applications` | 8 | Bewerbungen (Stufe 3) |
| `interview_turns` | 2 | Gesprächszüge |
| `career_profiles` | 1 | Profil |
| `saved_jobs` | 0 | gespeicherte Stellen |
| `documents` | 0 | Unterlagen (Stufe 3) |
| `such_auftraege` | 0 | Suchaufträge (Stufe 4) |

Dazu `nina_conversations` und `nina_messages` — **Gespräche werden
dauerhaft gespeichert**, mit `conversation_id` je Nachricht. Das ist
die Grundlage, auf der Projekte aufsetzen können.

Suchaufträge sind vollständiger als erwartet: `such_auftraege`,
`such_profile`, `such_kriterien`, `profil_signale`,
`auftrag_treffer`, `job_benachrichtigungen`, `zusammenfassungen`.

### Fehlt vollständig

**Es gibt keine Tabelle für Projekte.** Weder `projekte` noch
`projects`, und keine Zuordnungsspalte an einer der fünf Tabellen, die
ein Projekt bündeln soll. Konzept §8 führt Projekte als Stufe 2.

---

## 5. Mondays Gedächtnis — zwei Schichten

Aus `api/nina/chat/route.ts`:

| Schicht | Gebunden an | Inhalt |
|---|---|---|
| Gesprächsverlauf | `conversation_id` | `summary` (verdichtet) + letzte Züge wörtlich |
| Wissen über die Person | `user_id` | `confirmedFacts`, `hardConstraints`, `openHypotheses`, `rejectedStatements` |

**Das ist für Projekte die entscheidende Eigenschaft.** Was Monday über
den Menschen weiss, hängt am Nutzer und nicht am Gespräch — es folgt
also automatisch in jedes Projekt. Nur der Verlauf ist getrennt.

Die Anforderung „anderes Projekt erkennen, aber die Erinnerung vom
anderen behalten" braucht damit **keine Änderung am Gedächtnis**,
sondern nur einen Hinweis im Systemprompt, welches Projekt offen ist.

---

## 6. Betrieb

| | |
|---|---|
| Zugriffsschutz | `middleware.ts`, ein Matcher über fast alles |
| Preisquellen | `lib/billing/`: `plaene.ts` (abgerechnet), `preismodell.ts` (Angebot v2.0) — **zwei Quellen, absichtlich getrennt** |
| Hintergrundläufe | 5 GitHub-Workflows: `stellen-abruf` (`7,37 * * * *`), `suchauftrag` (`23 * * * *`), `geodaten` (`4,14,…`), `profilsynthese` (`7 * * * *`), `ci` |
| Tests | 3 031 in 264 Dateien, grün |
| Bau | `turbo run build`, 4 Aufgaben, ohne Warnung |
| Ablage | Supabase, Buckets `profilbilder` und `career-documents`, beide privat, Rundlauf geprüft |

---

## 7. Was das für die Umsetzung heisst

### Sofort möglich (Umbau von Vorhandenem)

- Monday-Hülle mit Seitenleiste bauen; `AppShell` löst sich von `TopNav`
- Kontomenü von 13 auf 4 Einträge kürzen
- Marketingseiten aus der Arbeitsnavigation entfernen
- Einstellungen zusammenführen (15 Unterseiten)
- „Jobs & Checks" als ein Bereich statt mehrerer gleichrangiger

### Braucht eine Freigabe

- **Projekte** — neue Tabelle plus Zuordnung an fünf gefüllten
  Tabellen. Migration auf Produktionsdaten.

### Braucht eine Entscheidung, keinen Code

- `/monday` als erste Stufe gegen `app.velvova.com` später: Die Domain
  ist nicht geprüft.
- Was mit `/app/settings/nina` und `/nina-einrichten` geschieht.

---

## 8. Offene Punkte aus dem laufenden Betrieb

- **Careerjet antwortet bei allen 32 Ländern mit 403** —
  „Unauthorized access from IP". Der Schlüssel wird akzeptiert; es ist
  eine IP-Freigabeliste. Ein Drittel aller Quellen liefert nichts.
- **Der Zähler läuft mit 12 Stellen je Sekunde** statt gemessenen 0,29.
- **`/api/jobs/refresh` antwortet lokal mit 500** in 0,2 Sekunden,
  auch ohne die letzten Änderungen. Ursache noch nicht gefunden.
