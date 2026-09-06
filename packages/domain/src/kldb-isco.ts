/**
 * Von der deutschen KldB zur internationalen ISCO-Hauptgruppe.
 *
 * ── Warum nicht über Textabgleich ─────────────────────────────
 *
 * Der naheliegende Weg wäre, Berufsbezeichnungen gegen die
 * ISCO-Beispielberufe zu halten. Gemessen an 20 amtlichen
 * BA-Bezeichnungen: die Hälfte ohne Treffer, und unter den Treffern
 * grobe Fehler — „Bachelor of Arts – Werte und Normen" landete bei
 * „Wertpapier- und Finanzhändler", weil beide das Wort „Werte"
 * enthalten. Deutsche Komposita machen es schlimmer: „Laufschlosser"
 * findet „Schlosser" nicht.
 *
 * Eine Berufsklassifikation, die zu fünfzig Prozent stimmt, ist keine
 * Klassifikation. Sie wäre schlimmer als keine, weil alles darunter —
 * Gehaltsvergleich, Zukunftseinschätzung — die Fehler erbt und dabei
 * sicher aussieht.
 *
 * ── Warum die Struktur trägt ──────────────────────────────────
 *
 * Die KldB 2010 kodiert zwei Dinge getrennt, und beide entsprechen
 * dem, wonach ISCO gliedert:
 *
 *   Stelle 1–2  das Berufsfeld     (Metall, Pflege, Informatik …)
 *   Stelle 5    das Anforderungs-  (1 Helfer · 2 Fachkraft ·
 *               niveau              3 Spezialist · 4 Experte)
 *
 * ISCO-Hauptgruppen gliedern nach genau diesen beiden Achsen: Beruf
 * und Qualifikationsniveau. Ein Metallhelfer ist ISCO 9
 * (Hilfstätigkeit), eine Metallfachkraft ISCO 7 (handwerklich), ein
 * Metalltechniker ISCO 3, ein Werkstoffingenieur ISCO 2.
 *
 * Nachgeprüft am Bestand: Alle KldB-Codes an unseren Stellen sind
 * fünfstellig, und die fünfte Stelle verteilt sich wie erwartet
 * (Helfer 1.605, Fachkraft 13.154, Spezialist 13.284, Experte 17.174
 * von 45.244 amtlichen Bezeichnungen).
 *
 * ── Was das NICHT ist ─────────────────────────────────────────
 *
 * Nicht die amtliche Umsteigeschlüssel-Tabelle. Destatis
 * veröffentlicht eine KldB-2010-↔-ISCO-08-Korrespondenz auf
 * Einzelberufsebene; die liegt uns nicht vor und ist als externe
 * Quelle anzuschliessen. Bis dahin ist das hier eine strukturelle
 * Ableitung auf Hauptgruppenebene, und die Konfidenz sagt das.
 */

/** Die zehn ISCO-08-Hauptgruppen. */
export const ISCO_HAUPTGRUPPEN: Record<number, string> = {
  0: "Angehörige der regulären Streitkräfte",
  1: "Führungskräfte",
  2: "Akademische Berufe",
  3: "Techniker und gleichrangige nichttechnische Berufe",
  4: "Bürokräfte und verwandte Berufe",
  5: "Dienstleistungsberufe und Verkäufer",
  6: "Fachkräfte in Land- und Forstwirtschaft und Fischerei",
  7: "Handwerks- und verwandte Berufe",
  8: "Bediener von Anlagen und Maschinen und Montageberufe",
  9: "Hilfsarbeitskräfte",
};

/**
 * Je KldB-Berufshauptgruppe die ISCO-Hauptgruppe nach Niveau.
 *
 * Die vier Werte stehen für Anforderungsniveau 1 bis 4. Wo eine Zeile
 * denselben Wert mehrfach führt, ist das kein Versehen: In der Pflege
 * etwa sind Fachkraft und Spezialist beide ISCO 3, erst der Experte
 * ist ISCO 2.
 */
const FELD: Record<string, [number, number, number, number]> = {
  /* Land-, Tier-, Forstwirtschaft und Gartenbau */
  "11": [9, 6, 6, 2],
  "12": [9, 6, 6, 2],
  /* Rohstoffe, Fertigung, Verarbeitung */
  "21": [9, 8, 3, 2],
  "22": [9, 7, 3, 2],
  "23": [9, 8, 3, 2],
  "24": [9, 7, 3, 2],
  "25": [9, 7, 3, 2],
  "26": [9, 7, 3, 2],
  "27": [9, 3, 3, 2],
  "28": [9, 7, 3, 2],
  "29": [9, 7, 3, 2],
  /* Bau, Architektur, Vermessung, Gebäudetechnik */
  "31": [9, 3, 3, 2],
  "32": [9, 7, 3, 2],
  "33": [9, 7, 3, 2],
  "34": [9, 7, 3, 2],
  /* Naturwissenschaft, Geografie, Informatik */
  "41": [9, 3, 3, 2],
  "42": [9, 3, 3, 2],
  "43": [4, 3, 3, 2],
  /* Verkehr, Logistik, Schutz, Reinigung */
  "51": [9, 4, 3, 2],
  "52": [9, 8, 8, 3],
  "53": [9, 5, 3, 2],
  "54": [9, 9, 5, 3],
  /* Kaufmännische Dienstleistungen, Handel, Vertrieb, Tourismus */
  "61": [9, 4, 3, 2],
  "62": [9, 5, 5, 1],
  "63": [9, 5, 5, 1],
  /* Unternehmensorganisation, Recht, Verwaltung */
  "71": [4, 4, 3, 1],
  "72": [4, 4, 3, 2],
  "73": [4, 4, 3, 2],
  /* Gesundheit, Soziales, Bildung */
  "81": [9, 3, 3, 2],
  "82": [9, 5, 3, 2],
  "83": [9, 5, 3, 2],
  "84": [9, 3, 2, 2],
  /* Geistes- und Sozialwissenschaften, Medien, Kunst */
  "91": [4, 3, 2, 2],
  "92": [4, 4, 3, 2],
  "93": [9, 7, 3, 2],
  "94": [9, 5, 3, 2],
};

export type Mappingkonfidenz = "grob" | "mittel";

export interface IscoZuordnung {
  /** Die ISCO-08-Hauptgruppe, 0 bis 9. */
  hauptgruppe: number;
  bezeichnung: string;
  /** Das Anforderungsniveau der KldB, 1 bis 4. */
  niveau: number;
  konfidenz: Mappingkonfidenz;
  /** Wie die Zuordnung zustande kam — gehört an jede Anzeige. */
  herkunft: string;
}

/**
 * Die ISCO-Hauptgruppe zu einem fünfstelligen KldB-Code.
 *
 * Gibt `null` zurück, wenn der Code nicht taugt. Das ist ein
 * Ergebnis: Lieber keine Berufsgruppe als eine geratene, denn alles,
 * was darauf aufbaut, erbt den Fehler.
 */
export function iscoAusKldb(kldb: string | null | undefined): IscoZuordnung | null {
  const ziffern = (kldb ?? "").replace(/\D/g, "");
  if (ziffern.length < 5) return null;

  const feld = ziffern.slice(0, 2);
  const reihe = FELD[feld];
  if (!reihe) return null;

  const niveau = Number(ziffern[4]);
  /*
   * Die 9 an fünfter Stelle heisst „nicht zuzuordnen".
   *
   * Sie steht an 27 der 45.244 amtlichen Bezeichnungen. Sie als
   * Niveau 4 zu lesen, weil 9 die grösste Ziffer ist, wäre genau der
   * stille Fehler, den diese Datei vermeiden soll.
   */
  if (!(niveau >= 1 && niveau <= 4)) return null;

  const hauptgruppe = reihe[niveau - 1]!;
  return {
    hauptgruppe,
    bezeichnung: ISCO_HAUPTGRUPPEN[hauptgruppe] ?? "unbekannt",
    niveau,
    /*
     * „grob", und das bleibt so, bis der amtliche Umsteigeschlüssel
     * angeschlossen ist. Eine Hauptgruppe ist eine von zehn — für
     * eine Zukunftseinschätzung auf Gruppenebene reicht sie, für
     * einen Gehaltsvergleich auf Berufsebene nicht.
     */
    konfidenz: "grob",
    herkunft:
      "strukturell aus KldB 2010 abgeleitet (Berufsfeld × Anforderungsniveau), " +
      "nicht der amtliche Umsteigeschlüssel",
  };
}

/** Wie viele KldB-Berufsfelder hinterlegt sind. Für Prüfungen. */
export const KLDB_FELDER = Object.keys(FELD).length;
