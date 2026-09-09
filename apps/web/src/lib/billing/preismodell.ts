/**
 * Das Preis- und Paketmodell v2.0 — für die Startseite.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht in `plaene.ts`
 * ══════════════════════════════════════════════════════════════
 *
 * `plaene.ts` beschreibt, was die Anwendung heute abrechnet: Free,
 * Premium und Max, an denen Berechtigungen und Grenzen hängen. Das
 * hier ist etwas anderes — das Angebot, mit dem verkauft werden soll,
 * beschlossen am 9. September 2026 als konsolidierte Arbeitsfassung.
 *
 * Die beiden stimmen nicht überein, und das ist kein Versehen: Das
 * eine ist der Stand des Produkts, das andere der Stand der
 * Entscheidung. Sie zusammenzuführen wäre eine eigene Aufgabe mit
 * eigenen Freigaben — Kontingente, Zählweise, Ablauf, Speicherfristen
 * und Zahlungswege hängen daran. Wer sie hier stillschweigend
 * gleichsetzt, verkauft ein Paket, dessen Grenzen niemand durchsetzt.
 *
 * ══════════════════════════════════════════════════════════════
 * Was in diesen Zeilen NICHT steht
 * ══════════════════════════════════════════════════════════════
 *
 * Kein „beliebtester Tarif" ohne Buchungsnachweis. Keine
 * durchgestrichenen Preise, keine Jahresrabatte, die es nicht gibt,
 * keine automatische Verlängerung. Begleitung Plus und Pro fehlen
 * bewusst: Sie werden erst angeboten, wenn wiederkehrender Nutzen
 * beobachtet ist — vier gleichgewichtete Karten nur wegen der
 * internen Tarifliste wären eine Auswahl ohne Grundlage.
 *
 * Für Unternehmen fehlt „Arbeitsraum Team" aus demselben Grund nicht:
 * Er steht, aber ausdrücklich als noch nicht freigegeben markiert.
 */

export type Zielgruppe = "person" | "unternehmen";

export interface Angebot {
  key: string;
  name: string;
  /** Ein Satz unter dem Namen. Was diese Stufe ist, nicht was sie kann. */
  nutzen: string;
  /** Der Betrag, gross. Nicht gerechnet, sondern beschlossen. */
  preis: string;
  /**
   * Die kleine graue Zeile unter dem Betrag.
   *
   * Hier steht, worauf er sich bezieht — „Pro Monat", eine
   * Abrechnungsvariante, ein Vorbehalt. Alles, was den Preis
   * einschränkt, gehört neben den Preis und nicht in eine Fussnote.
   */
  taktzeile: string;
  /**
   * Die Überleitung über der Liste.
   *
   * „Alles in Kostenlos, plus:" spart, jede Zeile der Stufe darunter
   * zu wiederholen — und sagt zugleich, dass sie enthalten ist. Ohne
   * diesen Satz liest sich eine kürzere Liste wie ein kleinerer
   * Umfang.
   *
   * Die unterste Stufe hat nichts, worauf sie aufbauen könnte, und
   * trägt trotzdem eine: „Enthalten:". Nicht als Füllsel — ohne sie
   * begänne ihre Liste eine Zeilenhöhe weiter oben als die der beiden
   * anderen, und die Karten stünden wieder versetzt.
   */
  ueberleitung?: string;
  punkte: readonly string[];
  aktion: { text: string; ziel: string };
  /** Der Halbsatz direkt unter dem Knopf. */
  knopffussnote?: string;
  /**
   * Hervorgehoben — höchstens eines je Ansicht.
   *
   * Steht auf der obersten Stufe, nicht auf der mittleren. Die
   * mittlere hervorzuheben ist der übliche Griff: Sie soll als
   * „vernünftige Wahl" erscheinen. Genau deshalb ist sie hier nicht
   * gemeint — was hervorgehoben wird, ist eine Empfehlung, und
   * empfohlen wird der grösste Umfang, nicht der bequemste
   * Mittelweg.
   */
  betont?: boolean;
  /**
   * Noch nicht freigegeben.
   *
   * Steht auf der Karte und ist keine Formsache: Ein Angebot, das man
   * kaufen kann, bevor es funktioniert, ist der teuerste Fehler in
   * diesem Dokument.
   */
  nochNicht?: boolean;
}

/**
 * Einzelpersonen — drei Stufen, alle monatlich.
 *
 * Ein Zwischenstand hatte das Wechselpaket zu 14,90 € einmalig für 42
 * Tage. Das folgte dem Modell v2.0, das eine episodische Form
 * empfiehlt — und ist auf Ansage ersetzt: drei monatliche Stufen.
 *
 * Die Beträge kommen aus demselben Dokument, Abschnitt 0.1: Begleitung
 * Plus 9,90 € und Pro 19,90 €. Sie sind dort für „nach Nachweis
 * fortlaufenden Nutzens" vorgesehen; hier stehen sie früher, und der
 * Vorbehalt steht deshalb auf der Karte.
 *
 * Der erste vollständige Fall bleibt kostenlos und verschwindet nicht
 * nachträglich hinter einer Schranke — das ist die eine Regel aus V8,
 * die keine Preisrunde aufhebt.
 */
export const PERSONEN: readonly Angebot[] = [
  {
    key: "kostenlos",
    name: "Kostenlos",
    nutzen: "Eine Stelle prüfen, bevor du dich entscheidest.",
    preis: "0 €",
    taktzeile: "Kostenlos für alle",
    ueberleitung: "Enthalten:",
    punkte: [
      "Vollständiger erster Fall ohne Konto und ohne Zahlungsdaten",
      "Einzelcheck, Vergleich zweier Stellen, Vergleich mit heute",
      "Quellen, offene Fragen und Widersprüche sichtbar",
      "Eine Klärungsnachricht vorbereiten",
      "Mit Konto 5 neue Stellenchecks je Monat",
      "30 zusätzliche Nina-Antworten je Monat",
      "Daten jederzeit exportieren und löschen",
    ],
    aktion: { text: "Kostenlos starten", ziel: "/register" },
  },
  {
    key: "plus",
    name: "Begleitung Plus",
    nutzen: "Für deine laufende Wechselentscheidung.",
    preis: "9,90 €",
    taktzeile: "Pro Monat, monatlich kündbar. Endpreis inklusive anwendbarer USt.",
    ueberleitung: "Alles in Kostenlos, plus:",
    punkte: [
      "20 neue Stellenchecks je Aboperiode",
      "200 zusätzliche Nina-Antworten",
      "Bestätigte Bedingungen gelten über alle Stellen hinweg",
      "Neue Auskünfte aktualisieren genau den betroffenen Punkt",
      "Offene Fragen bleiben der richtigen Stelle zugeordnet",
      "Entscheidungsstand über mehrere Sitzungen hinweg",
      "Klärungsnachrichten vorbereiten — Versand entscheidest du",
    ],
    aktion: { text: "Plus wählen", ziel: "/app/settings/abo" },
    knopffussnote: "Keine Bindung · Jederzeit kündbar",
    nochNicht: true,
  },
  {
    key: "pro",
    name: "Begleitung Pro",
    nutzen: "Wenn mehrere Entscheidungen gleichzeitig laufen.",
    preis: "19,90 €",
    taktzeile: "Pro Monat, monatlich kündbar. Endpreis inklusive anwendbarer USt.",
    ueberleitung: "Alles in Plus, plus:",
    punkte: [
      "60 neue Stellenchecks je Aboperiode",
      "600 zusätzliche Nina-Antworten",
      "Mehrere Stellen im direkten Vergleich nebeneinander",
      "Karrierepfad, fehlende Kenntnisse und Sackgassen",
      "Bewerbungsstrategie je Stelle",
      "Interviewübung mit Nina",
      "Vorrang bei aufwendigen Auswertungen",
    ],
    aktion: { text: "Pro wählen", ziel: "/app/settings/abo" },
    knopffussnote: "Keine Bindung · Jederzeit kündbar",
    betont: true,
    nochNicht: true,
  },
] as const;

/**
 * Unternehmen — Arbeitsraum, kein Bewerberverkauf.
 *
 * Die Preise sind Nettobeträge je Organisation, nicht je Bearbeiter.
 * Das steht unter den Karten und nicht im Kleingedruckten: Der
 * Unterschied zwischen 49 € je Organisation und 49 € je Sitz ist bei
 * zehn Bearbeitern der Unterschied zwischen 49 und 490 Euro.
 */
export const UNTERNEHMEN: readonly Angebot[] = [
  {
    key: "klarheit",
    name: "Klarheits-Check",
    nutzen: "Sehen, was in der eigenen Anzeige offen bleibt.",
    preis: "0 €",
    taktzeile: "Kostenlos, je Organisation",
    ueberleitung: "Enthalten:",
    punkte: [
      "1 aktiv verwaltete Stelle, 1 Bearbeiter",
      "2 Anzeigenprüfungen und 10 Entwürfe je Monat",
      "Fehlende und widersprüchliche Angaben werden benannt",
      "Korrekturen an eigenen Quellendaten bleiben frei",
      "Schließmeldungen jederzeit möglich",
    ],
    aktion: { text: "Unternehmen registrieren", ziel: "/firma" },
  },
  {
    key: "basis",
    name: "Arbeitsraum Basis",
    nutzen: "Personal und Fachabteilung arbeiten am selben Stand.",
    preis: "49 €",
    taktzeile: "Pro Monat je Organisation, zzgl. anwendbarer USt.",
    ueberleitung: "Alles im Klarheits-Check, plus:",
    punkte: [
      "3 aktiv verwaltete Stellen, 3 Bearbeiter",
      "20 Anzeigenprüfungen und 100 Entwürfe je Aboperiode",
      "Gemeinsamer Klärungsbereich für Personal und Fachabteilung",
      "Zuständigkeiten, Bearbeitungsstände und Vorlagen",
      "Nachrichten werden vorbereitet, nicht automatisch versendet",
      "Technischer Standardsupport",
    ],
    aktion: { text: "Pilot anfragen", ziel: "/for-business" },
    knopffussnote: "Keine Bindung · Monatlich kündbar",
    nochNicht: true,
  },
  {
    key: "team",
    name: "Arbeitsraum Team",
    nutzen: "Zuständigkeiten, Freigaben und offene Klärungen im Blick.",
    preis: "149 €",
    taktzeile: "Pro Monat je Organisation, zzgl. anwendbarer USt.",
    ueberleitung: "Alles in Basis, plus:",
    punkte: [
      "15 aktiv verwaltete Stellen, 10 Bearbeiter",
      "100 Anzeigenprüfungen und 400 Entwürfe je Aboperiode",
      "Teamübergreifende Zuständigkeiten",
      "Rollenbasierte Freigaben",
      "Übersicht zu offenen Klärungen und Bearbeitungszeiten",
      "Bericht „Klärungsbedarf“ ohne Rückschluss auf Einzelne",
    ],
    aktion: { text: "Bedarf besprechen", ziel: "/for-business" },
    knopffussnote: "Keine Bindung · Monatlich kündbar",
    betont: true,
    nochNicht: true,
  },
] as const;

export const ANGEBOTE: Record<Zielgruppe, readonly Angebot[]> = {
  person: PERSONEN,
  unternehmen: UNTERNEHMEN,
};
