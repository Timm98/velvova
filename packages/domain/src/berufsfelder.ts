/**
 * Die Berufsfelder der KldB 2010, mit Namen.
 *
 * ── Warum das an einer Stelle steht ───────────────────────────
 *
 * Die Namen wurden bisher an drei Orten gebraucht — im Beitragsskript,
 * in der Bilderzuordnung und in der Oberfläche — und standen an
 * keinem vollständig. Wo eine Liste mehrfach abgeschrieben wird,
 * laufen die Kopien auseinander, und niemand merkt welche stimmt.
 *
 * Die 36 Berufshauptgruppen sind die amtliche Gliederung der
 * Bundesagentur. Sie zu erfinden oder zusammenzufassen hiesse, eine
 * eigene Taxonomie neben eine bestehende zu stellen.
 */

export const BERUFSFELDER: Record<string, string> = {
  "11": "Land-, Tier- und Forstwirtschaft",
  "12": "Gartenbau und Floristik",
  "21": "Rohstoffgewinnung, Glas und Keramik",
  "22": "Kunststoff und Holz",
  "23": "Papier und Druck",
  "24": "Metallerzeugung und -bearbeitung",
  "25": "Maschinen- und Fahrzeugtechnik",
  "26": "Mechatronik, Energie und Elektro",
  "27": "Technische Entwicklung und Konstruktion",
  "28": "Textil und Leder",
  "29": "Lebensmittelherstellung",
  "31": "Bauplanung, Architektur und Vermessung",
  "32": "Hoch- und Tiefbau",
  "33": "Innenausbau",
  "34": "Gebäude- und Versorgungstechnik",
  "41": "Mathematik, Biologie, Chemie und Physik",
  "42": "Geologie, Geografie und Umweltschutz",
  "43": "Informatik und IT",
  "51": "Lagerwirtschaft und Logistik",
  "52": "Fahrzeugführung und Transport",
  "53": "Schutz und Sicherheit",
  "54": "Reinigung",
  "61": "Einkauf, Vertrieb und Handel",
  "62": "Verkauf",
  "63": "Tourismus, Hotel und Gastronomie",
  "71": "Unternehmensführung und -organisation",
  "72": "Finanzen, Rechnungswesen und Steuern",
  "73": "Recht und Verwaltung",
  "81": "Medizinische Gesundheitsberufe",
  "82": "Nichtmedizinische Gesundheit und Körperpflege",
  "83": "Erziehung, Soziales und Hauswirtschaft",
  "84": "Lehrende und ausbildende Berufe",
  "91": "Geistes-, Gesellschafts- und Wirtschaftswissenschaften",
  "92": "Werbung, Marketing und Medien",
  "93": "Produktdesign und Kunsthandwerk",
  "94": "Darstellende und unterhaltende Berufe",
};

/** Der Name zu einer Kennung. `null`, wenn die Gruppe unbekannt ist. */
export function berufsfeldName(kldb: string | null | undefined): string | null {
  const g = (kldb ?? "").replace(/\D/g, "").slice(0, 2);
  return BERUFSFELDER[g] ?? null;
}
