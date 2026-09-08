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
  /** Ein Satz, was man dafür bekommt. */
  nutzen: string;
  /** Der Betrag, wie er dasteht. Nicht gerechnet, sondern beschlossen. */
  preis: string;
  /** Wofür der Betrag gilt: „einmalig", „im Monat", leer bei 0 €. */
  takt: string;
  /**
   * Höchstens drei Zeilen.
   *
   * Die vollständigen Mengen und Grenzen gehören vor den Kauf, nicht
   * auf die Karte: Eine Liste, die scrollt, wird überflogen.
   */
  punkte: readonly string[];
  aktion: { text: string; ziel: string };
  /** Der Halbsatz unter der Aktion, wo er nötig ist. */
  fussnote?: string;
  /** Hervorgehoben — höchstens eines je Ansicht. */
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
 * Einzelpersonen — zum ersten Verkaufsstand nur zwei Karten.
 *
 * Der erste vollständige Fall bleibt kostenlos und verschwindet nicht
 * nachträglich hinter einer Schranke. Bezahlt wird erst zusätzliche
 * Verarbeitung darüber hinaus.
 */
export const PERSONEN: readonly Angebot[] = [
  {
    key: "kostenlos",
    name: "Kostenlos",
    nutzen: "Eine Stelle prüfen, bevor du dich entscheidest.",
    preis: "0 €",
    takt: "",
    punkte: [
      "Vollständiger erster Fall",
      "Quellen und offene Fragen",
      "Mit Konto 5 Checks pro Monat",
    ],
    aktion: { text: "Kostenlos starten", ziel: "/register" },
  },
  {
    key: "wechselpaket",
    name: "Wechselpaket",
    nutzen: "Deine nächsten Optionen und Antworten zusammenhalten.",
    preis: "14,90 €",
    takt: "einmalig",
    punkte: [
      "42 Tage Begleitung",
      "40 neue Stellenchecks",
      "400 zusätzliche Nina-Antworten",
    ],
    aktion: { text: "Wechselpaket wählen", ziel: "/app/settings/abo" },
    fussnote: "Keine automatische Verlängerung. Endpreis inklusive anwendbarer USt.",
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
    takt: "",
    punkte: ["1 aktiv verwaltete Stelle", "1 Bearbeiter", "Quellenkorrekturen bleiben frei"],
    aktion: { text: "Unternehmen registrieren", ziel: "/firma" },
  },
  {
    key: "basis",
    name: "Arbeitsraum Basis",
    nutzen: "Personal und Fachabteilung arbeiten am selben Stand.",
    preis: "49 €",
    takt: "im Monat",
    punkte: ["3 Stellen, 3 Bearbeiter", "Gemeinsamer Klärungsbereich", "20 Anzeigenprüfungen"],
    aktion: { text: "Pilot anfragen", ziel: "/for-business" },
    fussnote: "Je Organisation, zzgl. anwendbarer Umsatzsteuer.",
    betont: true,
    nochNicht: true,
  },
  {
    key: "team",
    name: "Arbeitsraum Team",
    nutzen: "Zuständigkeiten, Freigaben und offene Klärungen im Blick.",
    preis: "149 €",
    takt: "im Monat",
    punkte: ["15 Stellen, 10 Bearbeiter", "Rollen und Freigaben", "100 Anzeigenprüfungen"],
    aktion: { text: "Bedarf besprechen", ziel: "/for-business" },
    fussnote: "Je Organisation, zzgl. anwendbarer Umsatzsteuer.",
    nochNicht: true,
  },
] as const;

export const ANGEBOTE: Record<Zielgruppe, readonly Angebot[]> = {
  person: PERSONEN,
  unternehmen: UNTERNEHMEN,
};
