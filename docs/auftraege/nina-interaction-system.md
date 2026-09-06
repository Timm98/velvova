# Nina Interaction System — globale Produkt- und Architekturregel

Erteilt am 4.9.2026. **Noch nicht umzusetzen** — der Nutzer hat
ausdrücklich gesagt: als dauerhafte Projektregel speichern, das System
aber noch nicht überall implementieren. Die Kurzregel steht in
`CLAUDE.md` und gilt ab sofort für jede Planung.

Nina ist kein Chatbot, sondern die zentrale Assistenz-, Erklärungs-,
Navigations- und Steuerungsebene. Jede Funktion muss in **zwei**
Bedienarten arbeiten.

## 1 Grundregel

Ein globales Nina Interaction System, verfügbar auf allen Seiten:
Landingpage, Interview/Analyse, Nina Hub, Jobübersicht, Job-Detail,
gespeicherte Jobs, Bewerbungsbereich, Application Hub,
Dokumentenerstellung, Coaching, Profil, Einstellungen und alle
künftigen Seiten. **Nicht pro Seite neu bauen** — ein System oberhalb
der Anwendung. Der gewählte Modus überlebt jeden Seitenwechsel.

## 2 Die beiden Modi

**Sprachmodus — Nina führt.** Sprechen, verstehen, Seiten öffnen,
navigieren, scrollen, hervorheben, Jobs öffnen, Filter ändern,
vergleichen, erklären, Formulare schrittweise füllen, nächsten Schritt
vorschlagen, nach Zustimmung ausführen. Liegt ein Element ausserhalb
des Sichtbereichs: Seite wechseln → Laden abwarten → scrollen →
hervorheben → weitererklären. Gesprochenes erscheint **gleichzeitig
unten als Text**. Unterbrechbar mit „Stopp", „Pause", „Zurück",
„Wiederholen", „Überspringen", „Zeig mir das", „Öffne den Job", „Geh zu
meinen Bewerbungen", „Vergleiche die beiden Stellen", „Wechsle zum
Textmodus". Sichtbarer Zustand: bereit, hört zu, verarbeitet, spricht,
pausiert, Mikrofon blockiert, Fehler. Jederzeit erreichbarer Knopf zum
Pausieren oder Abschalten des Mikrofons.

**Textmodus — Nina erklärt, der Nutzer steuert.** Ruhige
Nachrichtenleiste am unteren Rand: Erklärungen, Hinweise, Fragen, Quick
Replies, Empfehlungen. **Kein** selbsttätiges Navigieren, Scrollen,
Öffnen, Filtern, Ausfüllen, Absenden oder Ändern. Sichtbare Elemente
darf Nina sanft hervorheben; für Unsichtbares zeigt sie einen Knopf
(„Zum Match-Score", „Job ansehen", „Zu den Bewerbungen", „Filter
öffnen", „Dokument prüfen"), den der Nutzer selbst klickt.

## 3 Erster Start

Vor dem ersten Gespräch die Wahl erklären — Überschrift „Wie möchtest
du Velvova nutzen?", zwei Knöpfe („Sprachsteuerung aktivieren", „Im
Textmodus starten"), Hinweis „Das Mikrofon wird erst nach deiner
Zustimmung verwendet." Sprache **nie** ohne Einwilligung aktivieren.
Bei Ablehnung: kein technischer Fehlerbildschirm, sauber in den
Textmodus, Hinweis auf spätere Freigabe in den Einstellungen,
Plattform bleibt voll nutzbar. Wahl im Nutzerprofil speichern.

## 4 Interview

Fokus auf dem Nutzer: keine Tutorials, kein Blinken, keine mehrfachen
Hinweise, keine automatischen Seitenwechsel. Inhaltlich in beiden Modi
gleichwertig — die Bedienart darf die Qualität der Analyse nicht
verändern. Gesammelt werden Erfahrungen, Fähigkeiten, Interessen,
gewünschte Tätigkeiten, Arbeitsweise, Gehaltsvorstellung, Standort und
Pendelbereitschaft, Arbeitszeit, Remote/Präsenz, Prioritäten,
Ausschlusskriterien, Entwicklungsziele.

## 5 Übergang zur Jobseite

Kein abruptes Ende. Nina leitet über („Ich glaube, ich habe jetzt ein
gutes Bild von dir …"). Ruhige Transition: kein harter Reload, kein
weisses oder schwarzes Zwischenbild, keine übertriebene 3D-Animation;
der Nina-Core darf sich weiterentwickeln, die Joboberfläche baut sich
schrittweise auf. `prefers-reduced-motion` respektieren. Die Jobs
müssen geladen sein, **bevor** Nina erklärt.

## 6 Erste geführte Job-Erfahrung

Einmalig, ausgelöst durch den **ersten abgeschlossenen Analyseprozess
mit Ergebnissen** — nicht durch den ersten Login. Zustände:
`hasCompletedInterview`, `hasCompletedInitialJobsGuide`,
`currentGuideStep`. Fortsetzbar nach Verlassen; nach Abschluss oder
bewusstem Überspringen nicht erneut automatisch starten.

Fünf Schritte im Sprachmodus (Job-Matches → Match-Score → Gehalt,
Entfernung, persönliche Kriterien nacheinander → empfohlene Karte →
Knopf), immer **genau ein** hervorgehobenes Element, Untertitel
gleichzeitig, jederzeit unterbrechbar. Am Ende fragt Nina „Soll ich die
Stelle für dich öffnen?" und öffnet erst nach Zustimmung.

Im Textmodus dieselben Erklärungen als Nachrichten, Hervorhebung nur
für Sichtbares, sonst ein Knopf zum Selbstklicken.

**Progressiv, keine zehnminütige Tour:** je Seite eine kurze,
einmalige, kontextbezogene Einführung. Pro Nutzer speichern:
`seenPageGuides: { jobs, jobDetail, applications, documents, coaching,
profile }`.

## 7 Wiederkehrende Nutzer

Keine Tour, direkt auf die normale Oberfläche. Nur eine kompakte,
relevante Begrüssung („Seit deinem letzten Besuch habe ich sechs neue
passende Stellen gefunden."). Modus bleibt gespeichert. Vollständige
Tour nur auf ausdrücklichen Wunsch.

## 8 Globaler Bereich am unteren Rand

Eine globale Komponente oberhalb des Routers, die bei Seitenwechsel
**nicht** neu erzeugt oder zurückgesetzt wird. Sprachmodus: Status,
Mikrofonstatus, Untertitel, letzte Nutzeräusserung, Pause, Stopp,
Wechsel zu Text, optionales Texteingabefeld. Textmodus: Nachrichten,
Eingabe, Quick Replies, vorgeschlagene Aktionen, Wechsel zu Sprache,
Minimieren, ungelesene Hinweise. Darf keine Knöpfe verdecken, auf
Mobilgeräten nicht über die Navigation ragen, muss Safe Areas achten.

## 9 Moduswechsel jederzeit

Auf jeder Seite möglich, klarer aber unaufdringlicher Umschalter. Beim
Wechsel darf **nichts** verloren gehen: Seite, offener Job,
Tour-Fortschritt, Gesprächskontext, Eingaben, Filter, Bewerbungsschritt,
Nachrichten. Nina setzt den Kontext fort und fängt nie bei null an.

## 10 Modus-Erinnerungen

Drei Ebenen: sichtbarer Umschalter, einmalige Erklärung beim Start,
gelegentlicher kontextbezogener Hinweis. Höchstens ein aktiver Hinweis,
nach dem Onboarding höchstens einmal je Sitzung, nur bei echtem
Vorteil, nach „Nicht mehr erinnern" dauerhaft aus, nie mitten in einer
Eingabe oder Bewerbung.

## 11 Action- und Intent-System

**Keine fest verdrahteten Sprachbefehle je Seite.** Jede bedienbare
Funktion registriert eine semantische Aktion:

```ts
interface NinaAction {
  id: string
  label: string
  aliases: string[]
  route?: string
  targetId?: string
  category: "navigation" | "information" | "filter" | "selection"
          | "form" | "application" | "account"
  requiresConfirmation: boolean
  isAvailable: (context) => boolean
  execute: (context, payload) => Promise<void>
  describeResult?: (result) => string
}
```

IDs u. a.: `navigation.openJobs`, `navigation.openApplications`,
`navigation.openProfile`, `navigation.goBack`, `jobs.openRecommended`,
`jobs.openByIndex`, `jobs.save`, `jobs.unsave`, `jobs.filterSalary`,
`jobs.filterDistance`, `jobs.filterRemote`, `jobs.sortByMatch`,
`jobs.compare`, `jobDetail.showMatchReasons`,
`jobDetail.showConcerns`, `jobDetail.showSalary`,
`jobDetail.showRoute`, `application.start`,
`application.openDocuments`, `application.optimizeResume`,
`application.createCoverLetter`, `application.review`,
`application.send`, `coaching.startInterview`,
`settings.switchInteractionMode`.

Bei Unklarheit fragt Nina nach („Meinst du den empfohlenen Job mit 91
Prozent Match oder die zweite Stelle?") und wählt **nie** beliebig.

## 12 Ablauf einer Sprachaktion

Eingabe erfassen → Absicht und Parameter bestimmen → Verfügbarkeit
prüfen → bei Unklarheit nachfragen → bei sensiblen Aktionen bestätigen
lassen → kurz ankündigen → ggf. Route wechseln → Laden abwarten →
scrollen → hervorheben → ausführen → Ergebnis verbal und schriftlich
bestätigen → nächsten Schritt anbieten. Bei Fehlern schweigt Nina
nicht.

## 13 Kritische Aktionen

Ausdrückliche Bestätigung zwingend bei: Bewerbung absenden, E-Mail
versenden, Dokument endgültig übermitteln, Daten löschen, Account
löschen, kostenpflichtige Buchung, Abo abschliessen oder ändern,
persönliche Daten extern weitergeben, Termin verbindlich bestätigen,
Bewerbung zurückziehen. Nur eindeutige Antworten zählen; bei „Ja, sieht
gut aus" fragt Nina konkret nach.

## 14 Hervorhebungen

Immer nur **ein** primäres Element. Keine fünf blinkenden Bereiche,
keine aggressiven Pulseffekte, kein abgedunkelter Bildschirm, keine
seitenlangen Pfeile, kein „Weiter, Weiter, Weiter", keine abrupten
Sprünge, keine bedeutungslosen Dauer-Animationen. Erlaubt: sanfter
Rand, leichter Glow, dezente Hintergrundanhebung, kurze Skalierung,
ruhiger Fokuszustand, kleine Bewegung des Knopfs. Nach der Erklärung
wird die Hervorhebung entfernt.

Ziele über stabile Attribute, **nicht** über `nth-child`:
`data-nina-target="job-match-score"`, `"recommended-job"`,
`"salary-information"`, `"route-information"`, `"start-application"`.
Fehlt ein Ziel auf einer Bildschirmgrösse: Alternativziel oder Schritt
überspringen. Desktop, Tablet, Smartphone, Tastatur, Screenreader und
`prefers-reduced-motion` berücksichtigen.

## 15 Nächster sinnvoller Schritt

Nach jeder wichtigen Aktion berechnet Nina den nächsten Schritt aus dem
tatsächlichen Nutzerzustand — keine immer gleiche Standardaktion. Im
Sprachmodus fragt sie „Soll ich dich dorthin führen?", im Textmodus
zeigt sie einen Knopf.

## 16 Globaler Zustand

```ts
type InteractionMode = "voice" | "text"

interface NinaExperienceState {
  interactionMode: InteractionMode
  microphonePermission: "unknown" | "granted" | "denied" | "unavailable"
  voiceStatus: "idle" | "listening" | "processing" | "speaking" | "paused" | "error"
  hasCompletedInterview: boolean
  hasCompletedInitialJobsGuide: boolean
  currentGuideId?: string
  currentGuideStep?: number
  seenPageGuides: Record<string, boolean>
  dismissedModeReminder: boolean
  lastSuggestedAction?: string
  activeHighlightTarget?: string
  activeRoute?: string
}
```

Für angemeldete Nutzer serverseitig im Profil speichern, damit der
Zustand Login und Gerätewechsel übersteht. Local Storage nur als
schneller Rückfall, **nicht** als einzige Quelle. Beim Abmelden
sensible Gesprächsdaten entfernen. Ein Reload darf niemanden zurück ins
Onboarding werfen.

## 17 Browser und Mikrofon

Nie behaupten, das Mikrofon sei aktiv, wenn der Browser blockiert. Bei
clientseitigen Seitenwechseln bleibt der Sprachmodus bestehen. Verlangt
der Browser nach einem Reload eine neue Nutzergeste: kompakte Meldung
„Sprachsteuerung fortsetzen", ein Klick genügt — der Nutzer bleibt
logisch im Sprachmodus, der Umschalter zeigt **nicht** fälschlich Text.
Mikrofonaktivität immer sichtbar. Kein dauerhaftes Speichern von Audio
ohne transparente Zustimmung.

## 18 Bausteine

`NinaProvider`/`NinaExperienceProvider`, `NinaGlobalStore`, `NinaDock`,
`NinaModeSwitcher`, `NinaVoiceSession`, `NinaTranscript`,
`NinaIntentResolver`, `NinaCommandRegistry`, `NinaActionExecutor`,
`NinaGuidanceEngine`, `NinaHighlighter`, `NinaSuggestionEngine`,
`NinaRouteObserver`. Namen an die vorhandene Architektur anpassen;
wichtiger ist die saubere Trennung.

Führungen deklarativ:

```ts
interface NinaGuideStep {
  id: string
  targetId?: string
  route?: string
  voiceText: string
  textMessage: string
  actionLabel?: string
  suggestedActionId?: string
  condition?: (context) => boolean
}
```

## 19 Pflichtregel

Steht in `CLAUDE.md` und gilt ab sofort — mit den zwölf Fragen, die
eine Funktion beantworten muss, bevor sie als vollständig gilt.

## 20 Ausdrücklich unerwünscht

Nina als schwebender Chatbot ohne Seitenkontext; getrennte Nina-Logik
je Seite; Sprachmodus, der nur Sprache in Text wandelt; Sprachmodus
ohne echte Steuerung; Textmodus, der selbsttätig navigiert; volles
Tutorial bei jedem Login; Mikrofon ohne Einwilligung; mehrere blinkende
Elemente; nicht überspringbare Touren; kritische Aktionen ohne
Bestätigung; instabile DOM-Selektoren; Kontextverlust beim
Seitenwechsel; Fortschrittsverlust beim Moduswechsel; Mockups ohne
Funktion; Neuaufbau des bestehenden Designs ohne Not.

## 21 Testszenarien

A neuer Nutzer im Sprachmodus · B neuer Nutzer im Textmodus · C Wechsel
Text → Sprache mitten auf einer Detailseite · D Wechsel Sprache → Text
im Bewerbungsprozess · E wiederkehrender Nutzer ohne Tour · F
Mikrofonberechtigung abgelehnt · G kritische Aktion mit Bestätigung ·
H Unterbrechung mit „Stopp" und späterem „Weiter".

## 22 Vorgehen

Erst die vorhandene Struktur analysieren (Router, globaler Zustand,
Authentifizierung, Sprachdienst, bestehende Nina-Komponenten,
vorhandene Sprach-, Chat-, Tour- und Highlight-Funktionen), Brauchbares
wiederverwenden. Dann das globale Grundsystem, danach Interview und
Jobseite, dann Job-Detail und Application Hub, dann der Rest. Echte
Zustände statt Demo-Daten. Typecheck, Lint, Tests, Build. Um einen
vorhandenen Sprachdienst eine Adapterschicht legen, damit die Logik
nicht an einem Anbieter hängt. Funktionierende Bereiche nicht unnötig
ändern, bestehende Funktionen nicht entfernen, sondern integrieren.

## 23 Zielbild

Im Sprachmodus sagt der Nutzer, was er will; Nina versteht die Absicht,
führt ihn hin, hebt hervor, erklärt und schlägt den nächsten Schritt
vor. Im Textmodus schreibt sie ruhig unten, weist hin und schlägt vor —
gesteuert wird selbst. Der Wechsel kostet keinen Kontext. Neue Nutzer
werden schrittweise geführt, wiederkehrende nicht belästigt.

> Nicht Nina spricht mit dem Nutzer — die gesamte Velvova-Plattform
> versteht und reagiert auf Nina.
