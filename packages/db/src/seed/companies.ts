/**
 * Demo-Unternehmen. Ausschliesslich erfunden. Keine reale Firma bekommt
 * hier erfundene Bewertungen - das waere rufschaedigend und schlicht
 * falsch. Alle Namen tragen erkennbare Fantasiebestandteile, alle
 * Domains enden auf .invalid.
 */

export interface SeedCompany {
  key: string;
  name: string;
  website: string;
  industry: string;
  sizeBand: string;
  headquarters: string;
  registryVerified: boolean;
}

export const seedCompanies: SeedCompany[] = [
  { key: "nordlicht", name: "Nordlicht Software GmbH (Demo)", website: "https://nordlicht.invalid",
    industry: "Software", sizeBand: "51-200", headquarters: "Hamburg", registryVerified: true },
  { key: "hafenblick", name: "Hafenblick Logistik AG (Demo)", website: "https://hafenblick.invalid",
    industry: "Logistik", sizeBand: "201-1000", headquarters: "Hamburg", registryVerified: true },
  { key: "kranzberg", name: "Kranzberg Beratung (Demo)", website: "https://kranzberg.invalid",
    industry: "Beratung", sizeBand: "11-50", headquarters: "Luebeck", registryVerified: false },
  { key: "wellenform", name: "Wellenform Medien GmbH (Demo)", website: "https://wellenform.invalid",
    industry: "Medien", sizeBand: "11-50", headquarters: "Hamburg", registryVerified: true },
  { key: "gruenspan", name: "Gruenspan Energie eG (Demo)", website: "https://gruenspan.invalid",
    industry: "Energie", sizeBand: "201-1000", headquarters: "Kiel", registryVerified: true },
  { key: "sturmvogel", name: "Sturmvogel Handel KG (Demo)", website: "https://sturmvogel.invalid",
    industry: "Handel", sizeBand: "1000+", headquarters: "Muenchen", registryVerified: true },
  { key: "leuchtturm", name: "Leuchtturm Bildung gGmbH (Demo)", website: "https://leuchtturm.invalid",
    industry: "Bildung", sizeBand: "51-200", headquarters: "Hamburg", registryVerified: true },
];
