# Auftrag: Produktionsreife — nach dem Umbau

Erteilt am 4.9.2026, ausdrücklich **nach** allem anderen. Kein weiterer
Redesign-Durchgang: Velvova-Gestaltung, Monday, Stellensuche, Matching,
Profile, Bewerbungen, Geschäftskundenteil, bestehende Anbindungen und
Hell/Dunkel bleiben funktionsfähig.

**Vor dem Umsetzen den Bestand ansehen.** Nichts neu bauen, was es gibt.
Keine funktionierende Serverlogik durch Attrappen ersetzen. Keine
Firmen- oder Rechtsangaben erfinden.

## 30 Punkte

1. **Rechtsteil im Fuss**, auf jeder öffentlichen und passenden
   angemeldeten Seite: Impressum, Datenschutz, AGB, Widerrufsbelehrung,
   Cookie-Einstellungen, Barrierefreiheit. `info@velvova.com` und
   `support@velvova.com`. Restliche „Paycheck"-Fundstellen im ganzen
   Repo ersetzen. Fehlende Pflichtangaben (Firma, Rechtsform, Anschrift,
   Geschäftsführung, Register, USt-IdNr., Telefon) als deutlich
   gekennzeichnete Platzhalter — **niemals still erfinden**.
2. **Rechtsseiten** `/impressum`, `/datenschutz`, `/agb`, `/widerruf`,
   `/barrierefreiheit`. Lesbar, mit Inhaltsverzeichnis bei langen
   Texten, hell und dunkel, mobil. Nicht behaupten, der Text sei
   juristisch geprüft; so aufbauen, dass geprüfter Text ihn ersetzen kann.
3. **Einwilligung** echt, nicht als Banner, der beim Klick verschwindet.
   Kategorien: notwendig, Analyse, Marketing, Personalisierung. Nicht
   Notwendiges lädt **erst nach** Einwilligung. Zustand dauerhaft
   speichern, später über Fuss → Cookie-Einstellungen änderbar,
   Widerruf verhindert künftige Initialisierung. Keine Dark Patterns.
4. **Analyse datenschutzgerecht**: vorhandene Tracker suchen (GA, GTM,
   Meta, TikTok, LinkedIn, Hotjar, Clarity …) und an die Einwilligung
   koppeln, nicht blind entfernen. Notwendige Betriebstelemetrie und
   optionale Marketinganalyse getrennt behandeln und dokumentieren.
5. **Barrierefreiheit** WCAG 2.1 AA als Grundlinie: Semantik,
   Überschriftenfolge, Tastaturbedienung, sichtbarer Fokus,
   Beschriftungen, ARIA nur wo nötig, Fokusfalle und -rückgabe in
   Dialogen, Alternativtexte, Kontrast, Fehler- und Ladeansagen,
   Sprunglink. **Sichtbaren Fokus nicht entfernen.**
6. **Monday-Core barrierefrei**: `prefers-reduced-motion` respektieren.
   Der Core darf nicht die einzige Auskunft über Mondays Zustand sein —
   Textentsprechungen „Monday hört zu / denkt nach / spricht".
7. **Responsiv** bei 320, 375, 390, 430, 768, 1024, 1280, 1440+ px.
   Kein Querlauf, nichts abgeschnitten. Echtes mobiles Verhalten, nicht
   die geschrumpfte Desktopfassung.
8. **Leistung**: Bilder, Logos, Flaggen, Zahlungsbilder, Monday-GLB,
   Schriften, Bündel, Routenladen. Moderne Bildformate wo sinnvoll,
   Vektor wo besser. Lazy Loading, Code-Aufteilung, dynamische Importe.
   Die grosse Monday-Umgebung nur laden, wo sie gebraucht wird; kein
   doppeltes Three.js.
9. **Schriftladen** ohne Layoutsprung; `font-display`, Preload nur wenn
   begründet, Rückfallkette, keine überflüssigen Schnitte.
10. **Above the fold**: Suche ohne Scrollen sichtbar, Hauptaktion „Jobs
    finden", zweite „Mit Monday suchen". Keine generische KI-Marketingseite.
11. **Aktionshierarchie** primär/sekundär/tertiär/destruktiv, keine
    zwei gleich dominanten Knöpfe nebeneinander.
12. **Formulare** durchgehend: Beschriftungen, Prüfung im Browser und
    auf dem Server, Lade-, Erfolgs-, Fehler-, Sperrzustand, kein
    doppeltes Absenden. Keine rohen Serverfehler anzeigen.
13. **Newsletter** funktionsfähig — und **keinen Erfolg vortäuschen**,
    solange kein Anbieter angebunden ist: Schnittstelle bauen, Lücke
    dokumentieren.
14. **Vertrauensabzeichen** nur mit Beleg im Bestand. Ohne Daten kein
    Abzeichen. Komponenten und Datenmodell so bauen, dass sie später
    gefüllt werden können.
15. **Transparenz je Stelle**: Unternehmen, Ort, Gehalt, Arbeitsmodell,
    Art, Datum, Quelle, Bewerbungsweg, Prüfstand, Monday-Passung und
    deren Sicherheit. Fehlendes nicht erfinden.
16. **Sozialer Beleg** nur mit echten Daten — keine erfundenen
    Bewertungen, Nutzerzahlen, Arbeitgeberzahlen, Erfolgsquoten.
17. **Leere Zustände** mit Handlung statt leerer Fläche.
18. **Ladezustände** mit Skeletten statt Sprüngen und Spinnern.
19. **Fehlerzustände** für Dienstausfall, entfallene Stelle, Zeitablauf,
    Monday nicht erreichbar, Bewerbung fehlgeschlagen, Anmeldung,
    Zahlung — je mit Weg zurück, `support@velvova.com`.
20. **404 und 500** in Velvova-Gestalt, ohne Stacktrace.
21. **Sicherheit**: keine Geheimnisse im Frontend, keine Schlüssel im
    Repo, kein `dangerouslySetInnerHTML` ohne Not, XSS, CSRF, offene
    Weiterleitungen, Sitzungsspeicher, Konsolenausgaben.
22. **HTTPS und Produktionskonfiguration**: sichere Cookies, SameSite,
    Secure, Rückrufadressen, CORS, OAuth-Ziele, kein Mischinhalt, kein
    fest verdrahtetes localhost.
23. **SEO**: Titel, Beschreibung, Canonical, Open Graph, robots,
    Sitemap. `JobPosting`-Auszeichnung nur mit gültigen Daten, nie mit
    erfundenem Gehalt, Arbeitgeber oder Datum. Private Bereiche nicht
    indizieren.
24. **Profilsichtbarkeit** ausdrücklich; Privates bleibt privat.
25. **Themen** beide erhalten. Core hell = Orange, dunkel = Blau; das
    Thema bestimmt die Farbe, der Zustand die Animation.
26. **Zahlungsdarstellung**: vorhandene Bilder benutzen, nichts neu
    erzeugen; „gezeigtes Bild" und „tatsächlich eingerichtetes
    Verfahren" auseinanderhalten.
27. **Flaggen** aus dem vorhandenen Bestand `flaggen`, keine Emoji, keine
    Doppel-Downloads.
28. **App-Hinweis** „Die Velvova App kommt bald." mit klickbarem „Jetzt
    entdecken"; keine Store-Verfügbarkeit vortäuschen.
29. **Protokolle**: Entwicklungsausgaben raus, sinnvolle Serverfehler
    bleiben. Niemals Passwörter, Token, Schlüssel, ganze Profile,
    Lebensläufe oder Unterhaltungen protokollieren.
30. **Abnahme** nach der Prüfliste des Auftrags (Branding, Recht,
    Einwilligung, Barrierefreiheit, Responsivität, Leistung, Sicherheit,
    UX, Datenwahrheit, Technik).

**Schlussregel:** nicht so *aussehen* lassen, als sei es produktionsreif,
sondern das Verhalten produktionsreif machen. Wo Angaben, juristische
Prüfung, Zugangsdaten oder Serverfunktionen fehlen: richtige Struktur
bauen und die Lücke ausdrücklich dokumentieren, nichts vortäuschen.

## Ein Widerspruch im Auftrag, der zu klären ist

Punkt 10 nennt als Überschrift „Entdecke über 20.000.000 Jobs mit
Velvova". Punkt 16 und die Abnahmeliste verbieten erfundene Statistiken.
Der Bestand liegt bei rund 2,37 Mio. aktiven Stellen — die 20 Millionen
wären um das Achtfache zu hoch und stünden als erste Aussage der Seite.
Umgesetzt ist deshalb die echte, stündlich nachgezählte Zahl
(`apps/web/src/lib/jobs/bestandszahl.ts`). Auf Ansage wird daraus eine
Zeile mit 20 Millionen.
