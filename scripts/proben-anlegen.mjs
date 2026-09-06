import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Legt die Arbeitsproben an.
 *
 * ── Warum echte Aufgaben und keine Fragebögen ─────────────────
 *
 * „Wie gern arbeitest du mit Zahlen?“ misst, was jemand über sich
 * glaubt. „Hier sind vier Rechnungen, welche ist falsch?“ misst, ob er
 * es kann — und die Frage danach, wie es sich angefühlt hat, misst das
 * Übrige.
 *
 * ── Warum sie kurz sind ───────────────────────────────────────
 *
 * Eine Probe, die zehn Minuten dauert, macht niemand. Eine, die
 * neunzig Sekunden dauert, machen viele — und zehn davon sagen mehr
 * als eine lange.
 *
 * Die Zuordnung erfolgt über die KldB-Hauptgruppe, dieselben zwei
 * Ziffern, die auch die Titelbilder wählen.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const PROBEN = [
  // ── 81 Medizinische Gesundheitsberufe ──
  {
    hg: "81", titel: "Was zuerst?", dauer: 75, art: "reihenfolge",
    aufgabe: "Auf Station klingeln vier Zimmer gleichzeitig. Bring die Aufgaben in die Reihenfolge, in der du sie erledigen würdest.",
    optionen: [
      "Frau K. (78) atmet schwer und wirkt verwirrt",
      "Herr M. möchte Wasser nachgefüllt haben",
      "Die Infusion in Zimmer 4 piept — Beutel fast leer",
      "Angehörige warten seit zehn Minuten auf ein Gespräch",
    ],
    loesung: [0, 2, 3, 1],
    erklaerung: "Atemnot mit Verwirrtheit geht immer vor: sie kann auf einen Notfall hindeuten. Die Infusion folgt, weil sie in Minuten leerläuft. Angehörige vor Wasser — weil Warten ohne Auskunft schlimmer ist als Warten mit.",
  },
  {
    hg: "81", titel: "Was du dokumentierst", dauer: 60, art: "auswahl",
    aufgabe: "Ein Patient sagt: „Mir ist heute Morgen schwindlig geworden, aber jetzt geht es wieder.“ Was gehört in die Dokumentation?",
    optionen: [
      "Nichts — es geht ihm ja wieder gut",
      "„Patient klagte über Schwindel“",
      "„08:15 Patient berichtet über Schwindel beim Aufstehen, aktuell beschwerdefrei, RR gemessen: 105/60“",
      "„Patient war heute etwas wackelig“",
    ],
    loesung: [2],
    erklaerung: "Zeit, Umstand, aktueller Zustand und eine Messung. Die anderen drei sind entweder gar nichts oder eine Bewertung ohne Grundlage — und beides fällt der nächsten Schicht auf die Füsse.",
  },
  // ── 26 Mechatronik, Energie, Elektro ──
  {
    hg: "26", titel: "Der Fehler in der Anlage", dauer: 90, art: "reihenfolge",
    aufgabe: "Eine Maschine bleibt stehen. Bring die Schritte in die Reihenfolge, in der du vorgehst.",
    optionen: [
      "Anlage spannungsfrei schalten und gegen Wiedereinschalten sichern",
      "Fehlerspeicher der Steuerung auslesen",
      "Sichtprüfung: lose Kabel, Gerüche, Anzeigen",
      "Bauteil tauschen",
    ],
    loesung: [0, 2, 1, 3],
    erklaerung: "Erst Sicherheit, dann sehen, dann messen, dann tauschen. Wer mit dem Tausch beginnt, wechselt oft ein heiles Teil — und findet den Fehler beim zweiten Stillstand wieder.",
  },
  // ── 62 Verkauf ──
  {
    hg: "62", titel: "Die Kundin ist unzufrieden", dauer: 60, art: "auswahl",
    aufgabe: "Eine Kundin bringt ein Gerät zurück, das seit zwei Wochen kaputt ist. Sie ist laut. Was sagst du zuerst?",
    optionen: [
      "„Haben Sie den Kassenbon dabei?“",
      "„Das kann eigentlich nicht sein, das Gerät ist sehr zuverlässig.“",
      "„Zwei Wochen ohne funktionierendes Gerät — das ärgert mich auch. Erzählen Sie mir, was passiert ist.“",
      "„Da müssen Sie sich an den Hersteller wenden.“",
    ],
    loesung: [2],
    erklaerung: "Erst die Lage anerkennen, dann die Sache klären. Der Bon kommt später und der Hersteller vielleicht gar nicht — wer mit Formalien beginnt, verliert die Kundin, bevor der Fall überhaupt geprüft ist.",
  },
  // ── 43 Informatik ──
  {
    hg: "43", titel: "Was zuerst prüfen?", dauer: 75, art: "auswahl",
    aufgabe: "Seit heute Morgen können sich einige Nutzer nicht mehr anmelden. Andere schon. Womit fängst du an?",
    optionen: [
      "Den Anmeldedienst neu starten",
      "Herausfinden, was die betroffenen Nutzer gemeinsam haben",
      "Ein Ticket beim Hersteller aufmachen",
      "Die Datenbank sichern",
    ],
    loesung: [1],
    erklaerung: "„Einige, aber nicht alle“ ist die Auskunft: Es gibt ein Muster. Wer neu startet, bevor er es kennt, löscht womöglich die Spur — und weiss hinterher nicht, ob es half oder ob es von selbst wegging.",
  },
  // ── 63 Gastronomie ──
  {
    hg: "63", titel: "Volles Haus", dauer: 60, art: "reihenfolge",
    aufgabe: "Sechs Tische, alles gleichzeitig. In welcher Reihenfolge?",
    optionen: [
      "Tisch 3 wartet seit 20 Minuten auf die Rechnung",
      "Neue Gäste stehen am Eingang",
      "Tisch 5 hat das falsche Gericht bekommen",
      "Tisch 1 möchte nachbestellen",
    ],
    loesung: [2, 1, 0, 3],
    erklaerung: "Das falsche Gericht zuerst — es wird kalt und muss neu in die Küche. Dann die Wartenden am Eingang, weil sie sonst gehen. Die Rechnung vor der Nachbestellung: Wer zahlen will, macht einen Tisch frei.",
  },
  // ── 24 Metall ──
  {
    hg: "24", titel: "Mass genommen", dauer: 60, art: "auswahl",
    aufgabe: "Eine Zeichnung fordert 40 mm ± 0,1. Du misst 40,15 mm. Was tust du?",
    optionen: [
      "Einbauen — 0,05 mm merkt niemand",
      "Das Teil aussortieren und den Einrichter informieren",
      "Nachschleifen, bis es passt",
      "Noch dreimal messen und den kleinsten Wert nehmen",
    ],
    loesung: [1],
    erklaerung: "Ausserhalb der Toleranz ist ausserhalb der Toleranz. Wichtiger als das eine Teil ist die Frage, warum die Maschine driftet — deshalb der Einrichter. Der kleinste von vier Messwerten ist keine Messung, sondern eine Auswahl.",
  },
  // ── 83 Erziehung und Soziales ──
  {
    hg: "83", titel: "Streit im Gruppenraum", dauer: 75, art: "auswahl",
    aufgabe: "Zwei Fünfjährige streiten lautstark um ein Spielzeug. Was tust du?",
    optionen: [
      "Das Spielzeug wegnehmen, dann ist Ruhe",
      "Dazwischengehen und fragen, was passiert ist",
      "Warten, ob sie sich selbst einigen",
      "Beide auf verschiedene Seiten des Raums schicken",
    ],
    loesung: [1],
    erklaerung: "Nicht schlichten, sondern klären lassen — mit Begleitung. Wegnehmen beendet den Lärm und übt nichts. Warten geht nur, solange niemand zu Schaden kommt, und lautstark heisst oft, dass die Grenze schon erreicht ist.",
  },
  // ── 51 Lager ──
  {
    hg: "51", titel: "Der Kommissionierauftrag stimmt nicht", dauer: 60, art: "auswahl",
    aufgabe: "Auf dem Beleg stehen 12 Stück, im Fach liegen 9. Was tust du?",
    optionen: [
      "9 packen und den Rest später nachliefern lassen",
      "12 aus einem ähnlichen Artikel auffüllen",
      "9 packen, Fehlmenge im System buchen und den Auftrag kennzeichnen",
      "Den Auftrag zurücklegen und den nächsten nehmen",
    ],
    loesung: [2],
    erklaerung: "Packen, buchen, kennzeichnen — in dieser Reihenfolge. Ohne Buchung sucht der Bestand die drei Stück noch monatelang, und ohne Kennzeichnung erfährt der Kunde es erst beim Auspacken.",
  },
  // ── 34 Gebäude- und Versorgungstechnik ──
  {
    hg: "34", titel: "Kein warmes Wasser", dauer: 75, art: "reihenfolge",
    aufgabe: "Ein Mieter meldet: kein warmes Wasser, Heizung läuft. Bring die Schritte in die Reihenfolge.",
    optionen: [
      "Fragen, ob es plötzlich aufhörte oder langsam schlechter wurde",
      "Vordruck und Anlagendruck am Kessel ablesen",
      "Umwälzpumpe des Warmwasserkreises prüfen",
      "Neues Ventil bestellen",
    ],
    loesung: [0, 1, 2, 3],
    erklaerung: "Erst fragen: „Plötzlich“ deutet auf ein Bauteil, „langsam“ auf Verkalkung oder Druckverlust. Dann die Werte, die ohne Werkzeug ablesbar sind. Ein Teil bestellt man, wenn man weiss, welches.",
  },
  // ── 54 Reinigung ──
  {
    hg: "54", titel: "Was zuerst reinigen?", dauer: 60, art: "reihenfolge",
    aufgabe: "Du betreust ein Bürogebäude, hast 90 Minuten und findest folgendes vor. Reihenfolge?",
    optionen: [
      "Verschüttetes Getränk auf dem Flur — jemand könnte ausrutschen",
      "Sanitärräume",
      "Papierkörbe in den Büros",
      "Fensterbänke abstauben",
    ],
    loesung: [0, 1, 2, 3],
    erklaerung: "Rutschgefahr geht immer vor — sie ist der einzige Punkt, an dem jemand zu Schaden kommt. Danach das, was Hygiene betrifft, dann das Sichtbare, zuletzt das Feine.",
  },
  // ── 33 Innenausbau ──
  {
    hg: "33", titel: "Die Wand ist nicht gerade", dauer: 60, art: "auswahl",
    aufgabe: "Du sollst Fliesen legen. Die Wand hat auf zwei Metern 8 mm Versatz. Was tust du?",
    optionen: [
      "Mit mehr Kleber ausgleichen",
      "Die Wand vorher spachteln oder ausgleichen und trocknen lassen",
      "Anfangen und schauen, wie weit man kommt",
      "Dünnere Fliesen nehmen",
    ],
    loesung: [1],
    erklaerung: "Kleber ist kein Ausgleichsmittel: Er zieht unterschiedlich an, und die Fliesen stehen später vor. Der Untergrund entscheidet über das Ergebnis, und er kostet einen Tag Trocknung — nicht eine Woche Nacharbeit.",
  },
  // ── 23 Papier und Druck ──
  {
    hg: "23", titel: "Der Druck hat einen Streifen", dauer: 60, art: "auswahl",
    aufgabe: "Auf jedem Bogen läuft ein heller Streifen längs durch. Woran liegt es am ehesten?",
    optionen: [
      "Die Farbe ist alle",
      "Etwas auf der Walze oder ein Fremdkörper im Farbwerk",
      "Das Papier ist zu dick",
      "Die Datei ist fehlerhaft",
    ],
    loesung: [1],
    erklaerung: "Ein Streifen an derselben Stelle auf jedem Bogen zeigt auf etwas, das sich mitdreht. Leere Farbe wird flächig blass, ein Dateifehler säse an derselben Stelle im Bild — nicht als durchgehende Bahn.",
  },
  // ── 72 Finanzen ──
  {
    hg: "72", titel: "Die Rechnung stimmt nicht", dauer: 75, art: "auswahl",
    aufgabe: "Eine Eingangsrechnung über 1.190 € brutto weist 19 % Umsatzsteuer aus, der Nettobetrag steht mit 1.000 € da. Was fällt dir auf?",
    optionen: [
      "Nichts, das passt",
      "Der Bruttobetrag müsste 1.190 € sein — passt also",
      "Die Steuer ist mit 190 € korrekt, aber die Rechnungsnummer fehlt womöglich",
      "Der Nettobetrag ist falsch berechnet",
    ],
    loesung: [2],
    erklaerung: "Rechnerisch stimmt alles: 1.000 € plus 19 % sind 1.190 €. Die Prüfung einer Eingangsrechnung ist aber mehr als Nachrechnen — ohne fortlaufende Rechnungsnummer und die übrigen Pflichtangaben ist der Vorsteuerabzug in Gefahr.",
  },
  // ── 71 Unternehmensführung ──
  {
    hg: "71", titel: "Zwei Projekte, ein Team", dauer: 75, art: "auswahl",
    aufgabe: "Zwei Projekte brauchen dieselbe Person nächste Woche. Beide Leitungen bestehen darauf. Was tust du zuerst?",
    optionen: [
      "Die Person entscheiden lassen",
      "Klären, welches Projekt bei Verzug welchen Schaden anrichtet",
      "Beiden je die Hälfte der Zeit zusagen",
      "Nach oben eskalieren",
    ],
    loesung: [1],
    erklaerung: "Ohne Folgenabschätzung ist jede Entscheidung Willkür — auch die Halbierung, die beide Projekte verzögert. Die Person zu fragen verschiebt eine Führungsaufgabe nach unten; eskalieren, wenn die Antwort feststeht und trotzdem keiner nachgibt.",
  },
  // ── 32 Hoch- und Tiefbau ──
  {
    hg: "32", titel: "Der Aushub steht offen", dauer: 75, art: "auswahl",
    aufgabe: "Ein 1,80 m tiefer Graben ist ausgehoben, die Wände senkrecht, der Boden sandig. Ein Kollege will hinein, um das Rohr auszurichten. Was tust du?",
    optionen: [
      "Nichts, es dauert ja nur fünf Minuten",
      "Ihn hineinlassen, aber danebenstehen und aufpassen",
      "Erst verbauen oder abböschen, dann einsteigen",
      "Ihm sagen, er soll sich beeilen",
    ],
    loesung: [2],
    erklaerung: "Ab 1,25 m Tiefe braucht ein senkrechter Graben einen Verbau oder eine Böschung — in Sand erst recht. Ein Verschütteter ist in Sekunden verschüttet, und Danebenstehen hilft dann nicht.",
  },
  // ── 31 Bauplanung und Architektur ──
  {
    hg: "31", titel: "Die Masse gehen nicht auf", dauer: 75, art: "auswahl",
    aufgabe: "Im Grundriss ist der Flur 1,05 m breit. Die Wohnung ist barrierefrei geplant. Was fällt dir auf?",
    optionen: [
      "Passt, über einen Meter ist genug",
      "Zu schmal — barrierefrei braucht deutlich mehr Bewegungsfläche",
      "Zu breit, das verschenkt Wohnfläche",
      "Das lässt sich ohne Schnitt nicht sagen",
    ],
    loesung: [1],
    erklaerung: "Barrierefreies Bauen verlangt Bewegungsflächen, die ein Rollstuhl auch beim Wenden braucht — 1,05 m reicht nicht einmal zum geraden Durchfahren mit Türanschlag. Ein Mass, das im Plan knapp passt, passt gebaut oft gar nicht.",
  },
  // ── 52 Fahrzeugführung ──
  {
    hg: "52", titel: "Die Lenkzeit läuft ab", dauer: 60, art: "auswahl",
    aufgabe: "Du bist seit 4 Stunden 20 Minuten am Steuer. Bis zum Kunden sind es noch 40 Minuten. Was tust du?",
    optionen: [
      "Durchfahren — es sind ja nur 40 Minuten",
      "Nach spätestens 4,5 Stunden die Pause einlegen, auch wenn es den Termin verschiebt",
      "Den Fahrtenschreiber später korrigieren",
      "Den Disponenten entscheiden lassen",
    ],
    loesung: [1],
    erklaerung: "Nach 4,5 Stunden Lenkzeit ist die Pause fällig — das ist keine Empfehlung. Ein verschobener Termin kostet eine Stunde, ein Verstoss kostet Bussgeld und im Zweifel die Fahrerlaubnis. Am Fahrtenschreiber nachträglich zu ändern ist eine Straftat.",
  },
  // ── 84 Lehrende Berufe ──
  {
    hg: "84", titel: "Einer versteht es nicht", dauer: 75, art: "auswahl",
    aufgabe: "Du hast einen Rechenweg zweimal erklärt. Eine Person versteht ihn immer noch nicht, die anderen warten. Was tust du?",
    optionen: [
      "Ein drittes Mal dasselbe erklären, langsamer",
      "Sagen, sie soll es zu Hause nachlesen",
      "Die anderen weiterarbeiten lassen und einzeln nachfragen, wo genau es hakt",
      "Die Person eine Aufgabe vorrechnen lassen",
    ],
    loesung: [2],
    erklaerung: "Dasselbe langsamer zu wiederholen hilft selten — es fehlt meist eine bestimmte Stelle, nicht das Tempo. Erst herausfinden, welche; und die anderen währenddessen nicht warten lassen.",
  },
  // ── 29 Lebensmittelherstellung ──
  {
    hg: "29", titel: "Die Kühlkette", dauer: 60, art: "auswahl",
    aufgabe: "Eine Lieferung Hackfleisch kommt mit 7 °C an. Vorgeschrieben sind höchstens 2 °C. Was tust du?",
    optionen: [
      "Sofort einlagern, im Kühlhaus wird es schon wieder kalt",
      "Annehmen, aber heute noch verarbeiten",
      "Die Annahme verweigern und dokumentieren",
      "Den Chef fragen und solange stehen lassen",
    ],
    loesung: [2],
    erklaerung: "Bei Hackfleisch sind 2 °C keine Richtgrösse. Was einmal zu warm war, wird durch Kühlen nicht wieder sicher — die Keime sind da. Verweigern und dokumentieren schützt die Gäste und im Zweifel auch dich.",
  },
  // ── 28 Textil und Leder ──
  {
    hg: "28", titel: "Der Stoff verzieht sich", dauer: 60, art: "auswahl",
    aufgabe: "Beim Nähen zieht sich die Naht wellig zusammen. Woran liegt es am ehesten?",
    optionen: [
      "Die Nadel ist zu dick",
      "Fadenspannung oder Transport passen nicht zum Stoff",
      "Der Stoff ist zu teuer",
      "Die Naht ist zu lang",
    ],
    loesung: [1],
    erklaerung: "Wellen entstehen, wenn oben und unten unterschiedlich viel Stoff durchläuft oder der Faden zu stramm sitzt. Die Nadelstärke zeigt sich anders — als Löcher oder ausgelassene Stiche.",
  },
  // ── 41 Naturwissenschaften ──
  {
    hg: "41", titel: "Die Messung weicht ab", dauer: 75, art: "auswahl",
    aufgabe: "Eine Dreifachbestimmung ergibt 4,8 · 4,9 · 7,2. Was tust du?",
    optionen: [
      "Den Mittelwert aus allen drei bilden",
      "Den dritten Wert streichen und den Mittelwert aus zwei bilden",
      "Die Bestimmung wiederholen und nach der Ursache des Ausreissers suchen",
      "Den Median nehmen",
    ],
    loesung: [2],
    erklaerung: "Ein Ausreisser ist eine Information, kein Störgeräusch. Ihn wegzurechnen — ob durch Streichen oder Median — beantwortet die Frage nicht, warum er entstand. Und wenn es ein Pipettierfehler war, betrifft er womöglich auch die anderen beiden.",
  },
  // ── 12 Gartenbau ──
  {
    hg: "12", titel: "Der Baum soll weg", dauer: 60, art: "auswahl",
    aufgabe: "Ein Kunde möchte im Juni eine grosse Hecke roden. Was sagst du?",
    optionen: [
      "Machen wir, kein Problem",
      "Zwischen 1. März und 30. September ist das Roden verboten — nur ein schonender Formschnitt geht",
      "Nur, wenn er es schriftlich bestätigt",
      "Erst nachfragen, ob Vögel darin sind",
    ],
    loesung: [1],
    erklaerung: "Das Bundesnaturschutzgesetz verbietet in dieser Zeit das Auf-den-Stock-Setzen und Roden — wegen der Brut. Ein schonender Form- und Pflegeschnitt bleibt erlaubt. Eine Unterschrift des Kunden hebt ein Gesetz nicht auf.",
  },
  // ── 25 Maschinen- und Fahrzeugtechnik ──
  {
    hg: "25", titel: "Bremsen quietschen", dauer: 60, art: "reihenfolge",
    aufgabe: "Ein Kunde meldet Quietschen beim Bremsen. Reihenfolge?",
    optionen: [
      "Fragen: bei jeder Bremsung oder nur kalt, seit wann, bei welcher Geschwindigkeit",
      "Rad ab, Belagstärke und Scheibe ansehen",
      "Probefahrt",
      "Beläge tauschen",
    ],
    loesung: [0, 2, 1, 3],
    erklaerung: "Erst fragen, dann selbst hören — ein Geräusch, das man nicht reproduziert hat, kann man nicht beheben. Danach die Sichtprüfung, und getauscht wird, wenn klar ist, was.",
  },
  // ── 61 Einkauf, Vertrieb, Handel ──
  {
    hg: "61", titel: "Zwei Angebote", dauer: 75, art: "auswahl",
    aufgabe: "Lieferant A: 12,40 € je Stück, Lieferzeit 6 Wochen. Lieferant B: 13,10 €, Lieferzeit 5 Tage, liefert seit Jahren pünktlich. Die Produktion steht in 2 Wochen still. Was empfiehlst du?",
    optionen: [
      "A — 0,70 € je Stück sind bei der Menge viel Geld",
      "B — ein Produktionsstillstand kostet ein Vielfaches der Differenz",
      "Bei A nachverhandeln und die Frist abwarten",
      "Bei beiden je die Hälfte bestellen",
    ],
    loesung: [1],
    erklaerung: "Der Preis je Stück ist nur eine Grösse. Sechs Wochen bei zwei Wochen Puffer heisst Stillstand, und der kostet Personal, Vertragsstrafen und Kunden — Beträge, gegen die 0,70 € verschwinden.",
  },
  // ── 82 Körperpflege und Medizintechnik ──
  {
    hg: "82", titel: "Die Kundin will Blond", dauer: 60, art: "auswahl",
    aufgabe: "Eine Kundin mit dunkel gefärbtem Haar möchte heute platinblond. Das Haar wirkt strapaziert. Was sagst du?",
    optionen: [
      "Machen wir, dauert etwa drei Stunden",
      "Erklären, dass das in einem Termin das Haar zerstören würde, und einen Weg über mehrere Termine vorschlagen",
      "Ablehnen und die Kundin wegschicken",
      "Es versuchen und abbrechen, wenn es zu viel wird",
    ],
    loesung: [1],
    erklaerung: "Vorgefärbtes, strapaziertes Haar hält den nötigen Aufhellungsgrad in einem Termin nicht aus. Nein zu sagen und nichts anzubieten verliert die Kundin; einen Weg zu zeigen behält sie — und das Haar.",
  },
  // ── 27 Technische Entwicklung ──
  {
    hg: "27", titel: "Die Toleranzkette", dauer: 75, art: "auswahl",
    aufgabe: "Drei Bauteile mit je ±0,1 mm werden hintereinander verbaut. Der Kunde fordert ±0,15 mm für die Baugruppe. Was tust du?",
    optionen: [
      "Passt — 0,1 ist ja kleiner als 0,15",
      "Die Toleranzen einzeln verschärfen oder die Kette anders auslegen",
      "Nachmessen und die guten Teile auswählen",
      "Die Forderung als unrealistisch zurückweisen",
    ],
    loesung: [1],
    erklaerung: "Toleranzen addieren sich: im ungünstigsten Fall 0,3 mm. Auswählen ist keine Konstruktion, sondern Ausschuss, und ein pauschales Nein übersieht, dass die Kette auch anders aufgebaut werden kann.",
  },
  // ── 22 Kunststoff und Holz ──
  {
    hg: "22", titel: "Das Furnier wirft Blasen", dauer: 60, art: "auswahl",
    aufgabe: "Beim Aufpressen bilden sich Blasen im Furnier. Was ist die wahrscheinlichste Ursache?",
    optionen: [
      "Zu wenig Pressdruck oder ungleichmässig aufgetragener Leim",
      "Das Furnier ist zu teuer eingekauft",
      "Die Presse steht zu warm",
      "Das Trägermaterial ist zu dünn",
    ],
    loesung: [0],
    erklaerung: "Blasen sind Stellen ohne Verbindung — dort fehlte Leim oder Druck. Wärme beschleunigt das Abbinden und kann mitspielen, ist aber selten die Ursache; die Trägerdicke hat damit nichts zu tun.",
  },
  // ── 92 Werbung und Medien ──
  {
    hg: "92", titel: "Die Kampagne läuft schlecht", dauer: 75, art: "auswahl",
    aufgabe: "Eine Anzeige wird oft gesehen, aber selten geklickt. Was prüfst du zuerst?",
    optionen: [
      "Das Budget erhöhen",
      "Ob die Anzeige den Menschen gezeigt wird, für die das Angebot gedacht ist",
      "Die Farben ändern",
      "Auf einen anderen Kanal wechseln",
    ],
    loesung: [1],
    erklaerung: "Viele Einblendungen bei wenigen Klicks heisst meist: falsches Publikum oder falsches Versprechen. Mehr Budget kauft mehr von derselben Wirkungslosigkeit, und die Farben ändern nichts an der Frage, wer da hinschaut.",
  },
  // ── 53 Schutz und Sicherheit ──
  {
    hg: "53", titel: "Jemand will ins Gebäude", dauer: 60, art: "auswahl",
    aufgabe: "Eine Person ohne Ausweis sagt, sie sei Handwerker und werde erwartet. Sie wird ungeduldig. Was tust du?",
    optionen: [
      "Durchlassen, Handwerker kommen ständig",
      "Beim genannten Ansprechpartner anrufen und bis zur Bestätigung nicht einlassen",
      "Wegschicken",
      "Den Ausweis später nachreichen lassen",
    ],
    loesung: [1],
    erklaerung: "Ungeduld ist keine Legitimation — sie ist eine bekannte Methode. Ein Anruf dauert eine Minute und klärt es; wer wirklich erwartet wird, hat damit kein Problem.",
  },
  // ── 73 Recht und Verwaltung ──
  {
    hg: "73", titel: "Der Antrag ist unvollständig", dauer: 60, art: "auswahl",
    aufgabe: "Ein Antrag geht ein, es fehlt eine Anlage. Die Frist läuft in drei Tagen ab. Was tust du?",
    optionen: [
      "Ablehnen, unvollständig ist unvollständig",
      "Unverzüglich zur Nachreichung auffordern und den Eingang dokumentieren",
      "Warten, ob die Anlage noch kommt",
      "Die Anlage selbst beschaffen",
    ],
    loesung: [1],
    erklaerung: "Der Eingang zählt, nicht die Vollständigkeit — deshalb wird der Eingang dokumentiert und zur Nachreichung aufgefordert. Wer wartet, verbraucht die Frist des Antragstellers mit.",
  },
  // ── 11 Land- und Forstwirtschaft ──
  {
    hg: "11", titel: "Regen ist angesagt", dauer: 60, art: "auswahl",
    aufgabe: "Das Heu liegt seit zwei Tagen, ist fast trocken. Für morgen Mittag sind Gewitter gemeldet. Was tust du?",
    optionen: [
      "Warten, einen Tag mehr schadet nicht",
      "Heute pressen, auch wenn die Restfeuchte noch etwas höher ist",
      "Morgen früh wenden und mittags pressen",
      "Untermischen und als Silage einfahren",
    ],
    loesung: [1],
    erklaerung: "Nasses Heu ist verlorenes Heu — und im Ballen wird es heiss, im schlimmsten Fall bis zur Selbstentzündung. Etwas höhere Restfeuchte lässt sich handhaben, ein Gewitter nicht.",
  },
  // ── 21 Rohstoffe, Glas, Keramik ──
  {
    hg: "21", titel: "Der Brand ist misslungen", dauer: 60, art: "auswahl",
    aufgabe: "Nach dem Brand haben mehrere Stücke feine Risse. Was ist die wahrscheinlichste Ursache?",
    optionen: [
      "Zu schnelles Aufheizen oder Abkühlen",
      "Der Ofen war zu voll",
      "Die Glasur war zu teuer",
      "Der Ton war zu weich",
    ],
    loesung: [0],
    erklaerung: "Feine Risse entstehen durch Spannung, und Spannung entsteht durch Temperatursprünge. Eine volle Kammer verlängert die Aufheizzeit eher, als dass sie Risse macht.",
  },
  // ── Ohne Gruppe: für alle ──
  {
    hg: null, titel: "Was dir Energie gibt", dauer: 45, art: "text",
    aufgabe: "Denk an einen Arbeitstag, nach dem du zufrieden nach Hause gegangen bist. Was hast du an dem Tag gemacht? Zwei, drei Sätze genügen.",
    optionen: [], loesung: [],
    erklaerung: "Es gibt hier nichts richtig zu machen. Ein konkreter guter Tag sagt mehr über die passende Arbeit als jede Selbstbeschreibung — weil er tatsächlich stattgefunden hat.",
  },
];

let angelegt = 0;
for (const p of PROBEN) {
  const vorhanden = (await db.execute(sql`select 1 from aufgabenproben where titel = ${p.titel}`)).rows;
  if (vorhanden.length > 0) continue;
  await db.execute(sql`
    insert into aufgabenproben (kldb_hauptgruppe, titel, aufgabe, art, optionen, loesung, erklaerung, dauer_sekunden)
    values (${p.hg}, ${p.titel}, ${p.aufgabe}, ${p.art},
            ${JSON.stringify(p.optionen)}::jsonb, ${JSON.stringify(p.loesung)}::jsonb,
            ${p.erklaerung}, ${p.dauer})`);
  angelegt++;
}
const n = (await db.execute(sql`select count(*)::int as n from aufgabenproben where aktiv`)).rows[0].n;
console.log(`${angelegt} neu angelegt · ${n} Proben insgesamt`);
const je = (await db.execute(sql`
  select coalesce(kldb_hauptgruppe,'alle') as hg, count(*)::int as n
  from aufgabenproben where aktiv group by 1 order by n desc`)).rows;
for (const x of je) console.log(`  ${String(x.hg).padEnd(6)} ${x.n}`);
process.exit(0);
