# Landingpage — Umbau

Stand: 2. September 2026

## Was neu ist

| | vorher | jetzt |
|---|---|---|
| Hero-Visual | 3 lose Karten + schwebende Kugel | **eine** Komposition: Signale → Nina → Treffer, auf einer Bahn |
| Headline | „Finde einen Job, der wirklich zu dir passt." | „Du suchst keinen Job. Nina findet den richtigen für dich." |
| Business | fehlte vollständig | Kopfzeile, Hero-CTA, eigener Abschnitt, eigene Seite, Fusszeilenspalte |
| Hintergründe | durchgehend hellgrau | Canvas · Weiss · Lavendel · **Dunkel** · Vollbild |
| Bilder | keine | acht Flächen, ganzflächig und in Split-Sektionen |
| Abschnitte | 7 | 14 |

## Der Nina Core

Drei Stationen auf einer durchgehenden Bahn — was jemand sagt, Nina, was
dabei herauskommt. Die Bahn ist der Punkt: Sie behauptet einen
Zusammenhang, und der Zusammenhang ist die Produktidee.

Reines CSS, kein Canvas, kein JavaScript. **Das Markup ist der
Endzustand** — ohne Stylesheet, ohne Skript oder mit
`prefers-reduced-motion: reduce` steht dasselbe Bild da. Eine
E2E-Prüfung hält das fest.

Auf dem Telefon quadratisch statt 5:4 und zwei statt drei Zeilen: Bei 390
Pixeln blieben von 5:4 nur 280 Pixel für sechs Elemente.

## Die Bilder — offen gesagt

Der Auftrag verlangt Fotografie: echte Menschen, Tageslicht, echte
Arbeitsumgebungen. **Fotos kann ich nicht herstellen**, und fremde
Bilder ohne geklärte Lizenz auf eine Landingpage zu legen wäre kein
Kompromiss, sondern ein Rechtsverstoss.

Drei Anläufe mit gezeichneten Menschen sahen aus wie das, wovor der
Auftrag ausdrücklich warnt — generische Illustration. Eine mittelmässige
Zeichnung eines Menschen ist schlechter als gar keine: Sie macht eine
Seite billig, deren ganzer Zweck Charakter ist.

Was jetzt drinsteht: **Räume und Licht**, keine Menschen. Architektur,
Tiefe, Material, Korn. Das sieht absichtlich aus und konkurriert nicht
mit einem Foto, sondern wartet auf eines.

**Ein Foto einsetzen dauert Minuten** — Datei mit gleicher Kennung in
`public/arbeitswelt/` legen, Endung in `Arbeitswelt.tsx` ändern. Welches
Motiv wohin gehört, steht in `public/arbeitswelt/BILDER.md`.

Das ist die einzige Stelle, an der diese Seite unfertig ist.

## Beispiele sind als Beispiele benannt

Die Seite zeigt jetzt echte Produktflächen — anders ist nicht zu
erkennen, was das Produkt tut. Damit gilt die schärfere Regel: Jede
Fläche, die wie eine Stellenanzeige aussieht, trägt sichtbar
„Beispiel", und es kommt **kein erfundenes Unternehmen** vor. Eine
E2E-Prüfung erzwingt beides.

## Beide Seiten, überall erreichbar

- Kopfzeile: „Für Unternehmen"
- Hero: „Ich suche Mitarbeiter" neben dem Hauptknopf, ohne Scrollen
- Eigener dunkler Abschnitt mit Arbeitgeberoberfläche
- `/for-business` — eigene Landingpage mit eigener Kopfzeile
- `/business/signup` — funktionierende Weiche
- Fusszeile: eigene Spalte

`/business/signup` ist ein **Route Handler**, keine Seite: Als Seite lag
sie unter `app/business/`, dessen Rahmen `requireUser()` aufruft — jeder
Klick auf „Unternehmen registrieren" landete auf `/login`. Der Code war
richtig, er kam nur nie an die Reihe.

Die Absicht reist durch die Registrierung (`?absicht=unternehmen`,
verstecktes Feld `weiter`). Die Serveraktion prüft das Ziel streng:
nur ein Pfad auf dieser Anwendung, kein Schema, kein Host — sonst wäre
es eine offene Weiterleitung und damit ein fertiger Phishing-Bauplan.

## Bekannte Lücke

**Die Landingpage gibt es nur auf Deutsch.** Die Texte stammen wörtlich
aus dem Auftrag und liegen nicht übersetzt vor. Der Rest der Anwendung
schaltet weiter um. Festgehalten als `test.fixme` in `journey.spec.ts` —
sichtbar in jedem Testbericht, statt durch eine gelöschte Prüfung aus
der Welt geschafft.

## Geprüft

- **1.162 Unit-Tests**, **465 E2E** über fünf Viewports
- axe ohne Verstösse auf `/`, `/for-business`, `/register?absicht=unternehmen`
- **15 Browser-Prüfungen** (`scripts/landing-pruefung.mjs`): kein toter
  Verweis unter 24 internen Zielen, beide CTA-Wege, Fünf-Sekunden-Test
- Bilder: `landing-desktop-{top,discovery,life-fit,business}.png`,
  `landing-mobile-{top,business}.png`, `business-landing*.png`,
  `register-choice.png`

---

# Nachtrag: Landeserkennung

## Ja, das geht — ohne Dialog

Nicht über die Browser-Standortabfrage: Die braucht eine ausdrückliche
Erlaubnis, öffnet ein Fenster und liefert Koordinaten auf zehn Meter
genau. Für „welches Land?" ist das unverhältnismässig, und der Dialog
kostet auf einer Landingpage mehr Besucher, als die Anpassung bringt.

Stattdessen der **Ländercode, den das CDN ohnehin berechnet** und als
Kopfzeile mitschickt. Er ist vor unserem Code da, kostet nichts, braucht
kein JavaScript und keinen Dialog.

Gelesen werden `x-vercel-ip-country`, `cf-ipcountry`, `x-country-code`,
`fastly-client-country`, `x-appengine-country` — mehrere, damit ein
Hosterwechsel keine stille Verschlechterung ist.

**Reihenfolge:** eigene Wahl → CDN-Kopfzeile → Region aus der
Spracheinstellung (`de-AT` → AT) → Deutschland.

## Was NICHT passiert

Die IP-Adresse wird nicht gelesen, nicht gespeichert, nicht
protokolliert. Was ankommt, sind zwei Buchstaben, und sie entscheiden
über die Sätze auf der Seite. Nichts davon verlässt die Anfrage.

**Keine Stadt, keine Region, keine Koordinaten** — obwohl manche
Anbieter sie mitschicken. Ein Land beantwortet die Frage, die dieses
Produkt hat. Eine Stadt beantwortet sie nicht besser und wäre erheblich
aufdringlicher.

`XX` (Cloudflare: unbekannt) und `T1` (Tor) gelten nicht als Land — beide
sind eine Auskunft über die Verbindung, nicht über den Menschen.

## Was sich ändert — und was nicht

**Angepasst wird nur, was überprüfbar anders ist:**

| Land | Stellen | Nettorechnung | Was auf der Seite steht |
|---|---|---|---|
| DE | ja | ja | kein Hinweis, alle Versprechen gelten |
| AT, CH | ja | **nein** | Band nennt die fehlende Nettorechnung; das Netto-Versprechen wird durch einen ehrlichen Satz ersetzt |
| alle übrigen | nein | nein | Band sagt, dass die Suche hier nichts findet — und nennt trotzdem den Weg über eigene Stellenlinks |

**Nicht angepasst werden Beispielzahlen.** Aus „53.000 €" würde
„53.000 CHF" — dieselbe Zahl, ein anderes Zeichen, und damit eine
Behauptung über das Schweizer Lohnniveau, die niemand geprüft hat. Ein
Wechselkurs wäre auch keine Lösung: Löhne folgen keinem Wechselkurs. Ein
Test hält fest, dass hier keine Umrechnung entsteht.

## Sichtbar und korrigierbar

Eine Seite, die sich stillschweigend anpasst, ist schlechter als eine,
die es nicht tut: Man merkt die Anpassung nicht, kann sie also nicht
korrigieren.

Deshalb steht im Band, **woher die Annahme stammt** („anhand deiner
Verbindung angenommen" / „aus deiner Spracheinstellung geschlossen" /
„von dir gewählt") und daneben ein Weg, sie richtigzustellen. Im Fuss
steht der Schalter auch dann, wenn oben nichts steht.

Die Umschaltung ist ein **gewöhnlicher Verweis** auf `/api/land`, kein
`<Link>` und keine Serveraktion — sie funktioniert damit ohne
JavaScript. Erste Fassung nutzte `<Link>`: Das Cookie wurde gesetzt, die
Seite aber aus dem Router-Zwischenspeicher gezeichnet. Man klickte, und
nichts änderte sich.

Gespeichert werden zwei Buchstaben, ein Jahr, ohne Kennung.

## Geprüft

- **12 Unit-Tests** für `landeslage.ts`
- **20 Browser-Prüfungen** (`scripts/herkunft-pruefung.mjs`) mit echten
  CDN-Kopfzeilen — Vercel und Cloudflare, `XX`/`T1`, Sprachfallback,
  Wahl schlägt Kopfzeile, Wahl hält über das Neuladen
- axe ohne Verstösse auf `/` **mit** Länderband
- Bilder: `landing-schweiz.png`, `landing-schweiz-lifefit.png`
