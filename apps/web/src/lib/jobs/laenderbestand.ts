import { desc } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/**
 * Die Länder, in denen wir tatsächlich Stellen haben.
 *
 * Aus `laenderbestand`, das der Pflegelauf stündlich füllt — nicht aus
 * einer Liste im Code. Eine fest eingetragene Länderliste behauptet
 * Reichweite; diese hier zählt sie.
 *
 * Länder ohne Stellen kommen gar nicht erst vor: Der Zähllauf löscht
 * sie. Ein Fähnchen, das auf eine leere Trefferliste führt, ist
 * schlechter als kein Fähnchen.
 */
export type Landzeile = {
  code: string;
  name: string;
  stellen: number;
  /** Pfad zur Flagge, oder null wenn wir keine haben. */
  flagge: string | null;
};

/*
 * Die Namen stehen hier, weil `Intl.DisplayNames` im Serverlauf je
 * nach Umgebung fehlt und dann Codes anzeigt. Neunzehn Zeilen sind
 * billiger als ein Fuss, in dem „ZA" steht.
 */
const NAME: Record<string, string> = {
  AT: "Österreich", AU: "Australien", BE: "Belgien", BR: "Brasilien",
  CA: "Kanada", CH: "Schweiz", DE: "Deutschland", ES: "Spanien",
  FR: "Frankreich", GB: "Vereinigtes Königreich", IN: "Indien",
  IT: "Italien", MX: "Mexiko", NL: "Niederlande", NZ: "Neuseeland",
  PL: "Polen", SG: "Singapur", US: "USA", ZA: "Südafrika",
};

/*
 * Für welche Länder eine Flagge im Projekt liegt.
 *
 * Ausdrücklich aufgezählt und nicht geraten: Die Bilder wurden aus
 * einem Bogen geschnitten und einzeln gegen ein Prüfblatt abgeglichen.
 * Ein Land ohne geprüfte Flagge bekommt lieber keine als die falsche —
 * eine vertauschte Flagge ist ein Fehler, den jeder Besucher sieht.
 */
const MIT_FLAGGE = new Set(Object.keys(NAME));

export async function laenderbestand(): Promise<Landzeile[]> {
  const db = await getDb();
  const zeilen = await db
    .select()
    .from(schema.laenderbestand)
    .orderBy(desc(schema.laenderbestand.stellen))
    .catch(() => []);

  return zeilen.map((z) => ({
    code: z.land,
    name: NAME[z.land] ?? z.land,
    stellen: z.stellen,
    flagge: MIT_FLAGGE.has(z.land) ? `/flaggen/${z.land.toLowerCase()}.webp` : null,
  }));
}
