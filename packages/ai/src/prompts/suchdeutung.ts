import { z } from "zod";

/**
 * Systemprompt: Was jemand mit einer Zeile in der Suche meint.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diese Schicht überhaupt gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Die Suchzeile hatte einen Regelabgleich: feste Muster für Gehalt,
 * Ort, Vertragsart, Arbeitsmodell. Er ist schnell, kostenlos und
 * zuverlässig — und er kennt genau das, was jemand einmal
 * hineingeschrieben hat.
 *
 * „bayern" kannte er nicht. „nicht in der Pflege" auch nicht. Und
 * „doch lieber näher dran" schon gar nicht, weil dafür der vorige
 * Satz gebraucht wird.
 *
 * Das Modell übernimmt genau diesen Rest: was die Regeln NICHT
 * verstanden haben, im Zusammenhang mit dem, was schon eingestellt
 * ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Reihenfolge: Regeln zuerst, Modell danach
 * ══════════════════════════════════════════════════════════════
 *
 * Was der Regelabgleich erkannt hat, steht fest. Das Modell darf es
 * weder überschreiben noch bestätigen — es bekommt das Ergebnis als
 * Tatsache mitgeteilt und arbeitet am Rest.
 *
 * Der Grund ist nüchtern: „ab 45.000 €" ist eine Zahl, kein
 * Deutungsproblem. Ein Modell, das sie noch einmal auslegen darf,
 * macht daraus gelegentlich 45 oder 450.000 — und niemand sieht es,
 * weil eine Zahl im Filter immer plausibel aussieht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum höchstens eine Rückfrage
 * ══════════════════════════════════════════════════════════════
 *
 * Weil zwei Fragen ein Formular sind. Wer „Karlsruhe" eintippt, hat
 * eine Absicht und keine Lust auf drei Rückfragen zu Umkreis, Gehalt
 * und Vertragsart. Die eine Frage ist die, ohne die die Liste
 * deutlich schlechter wird — und sie wird erst gestellt, nachdem
 * gefiltert wurde, nicht davor.
 */

export const SUCHDEUTUNG_FASSUNG = "suchdeutung-5";

export const SUCHDEUTUNG_ANWEISUNG = `Du bist Nina und liest, was jemand in der Stellensuche geschrieben hat.

Du bekommst:
  EINGABE      der ganze Satz, so wie er getippt wurde
  SICHER       Zahlen und Werte, die ein Regelabgleich sicher gelesen hat
  BESTEHEND    die Filter, die gerade gelten
  VERLAUF      die letzten Saetze aus dem Gespraech, falls es eines gab

Du legst den GANZEN Satz aus, nicht nur einen Rest davon. SICHER sind
Angaben, die feststehen — uebernimm sie unveraendert und deute den Rest
darum herum.

Die Filter, die es gibt:
  ort          ein Ort oder eine Region ("Karlsruhe", "Bayern")
  umkreisKm    Entfernung in Kilometern um den Ort
  pendelzeit   Fahrzeit zur Arbeit in Minuten
  gehaltAb     Jahresgehalt in Euro, Untergrenze
  remote       "remote" | "hybrid" | "onsite"
  contract     "permanent" | "temporary" | "freelance" | "internship"
  arbeitszeit  "vollzeit" | "teilzeit"
  schicht      false heisst: keine Schicht-, Nacht- oder Wochenendarbeit
  salary       "disclosed" heisst: nur Anzeigen mit genanntem Gehalt
  q            Suchwoerter fuer Beruf und Taetigkeit
  nicht        Woerter, die NICHT vorkommen sollen

Regeln:

- Ein Satz enthaelt oft mehreres auf einmal. "Bayern, nicht laenger
  als 170 min Auto" sind zwei Angaben: ort und pendelzeit. Zerlege ihn.

- "q" ist fuer BERUFE und TAETIGKEITEN. Niemals ganze Saetze, niemals
  Woerter wie "laenger", "als", "keine", "Auto", "Fahrt". Eine
  Volltextsuche nach solchen Woertern findet null Anzeigen — und die
  Person sieht einen leeren Arbeitsmarkt statt eines Filters.
  Im Zweifel laesst du "q" leer und fragst nach.

- ZEIT ist niemals ENTFERNUNG. Minuten und Stunden gehoeren nach
  pendelzeit (Stunden mal 60), Kilometer nach umkreisKm. "Hoechstens
  2 Stunden Auto" setzt pendelzeit=120 und NICHT umkreisKm=120 —
  beides zu setzen ergibt zwei Filter, von denen die Person nur einen
  gemeint hat.

- WEGNEHMEN geht vor SETZEN. "Egal wo", "ohne Gehaltsfilter", "nicht
  mehr nur Teilzeit" nehmen einen Filter weg: Der Schluessel gehoert
  nach "entfernen" und darf in "filter" NICHT stehen.

- BEZUEGE rechnest du aus. "Naeher dran", "weiter weg", "mehr",
  "etwas hoeher" beziehen sich auf einen Wert in BESTEHEND. Nimm ihn
  und aendere ihn. Ein Bezug gehoert niemals nach "q".

- Ein Bundesland, ein Land oder eine Region ist KEIN Punkt. "Bayern",
  "NRW", "Ruhrgebiet" bekommen keinen Umkreis, und dazu wird auch
  nicht nachgefragt.

- Der VERLAUF loest Bezuege auf und sonst nichts.

- "unklar" ist der Teil des Satzes, den du NICHT unterbringen
  konntest. Lieber ehrlich leer lassen und fragen, als etwas in einen
  Filter zwingen, der nicht passt.

- Hoechstens EINE Rueckfrage. Frag, wenn du etwas nicht verstanden
  hast, oder wenn eine Angabe fehlt, ohne die die Liste deutlich
  schlechter wird. Nicht zu etwas, das schon in BESTEHEND steht, und
  nicht zu einem Umkreis um eine Region.

- Die Rueckfrage ist eine Frage mit einem Vorschlag: "Soll ich 30 km
  um Karlsruhe suchen, oder weiter?"

- "erklaerung" ist ein halber Satz in der Sprache der Person, ohne
  Fachwoerter: "sucht in Bayern, hoechstens 170 Minuten Fahrt".

- Schreibe deutsch, in "du".`;

/**
 * Was das Modell zurückgeben darf.
 *
 * ── Warum jedes Feld einzeln steht ────────────────────────────
 *
 * Ein freies Objekt („gib die Filter zurück") liesse das Modell
 * Schlüssel erfinden, die es nicht gibt. Sie fielen nicht auf: Ein
 * unbekannter Parameter in der Adresse tut nichts, und die Liste
 * sähe einfach ungefiltert aus.
 */
export const SuchdeutungSchema = z.object({
  filter: z.object({
    ort: z.string().max(80).nullable(),
    umkreisKm: z.number().int().min(1).max(500).nullable(),
    /*
     * Die Fahrzeit — Minuten, nicht Kilometer.
     *
     * „Keine längere Autofahrt als 170 Minuten" wurde bisher gar
     * nicht verstanden und landete als ganzer Satz in der
     * Volltextsuche: null Treffer und eine Rückfrage, die zu nichts
     * passte.
     */
    pendelzeit: z.number().int().min(5).max(300).nullable(),
    gehaltAb: z.number().int().min(1_000).max(1_000_000).nullable(),
    remote: z.enum(["remote", "hybrid", "onsite"]).nullable(),
    contract: z.enum(["permanent", "temporary", "freelance", "internship"]).nullable(),
    arbeitszeit: z.enum(["vollzeit", "teilzeit"]).nullable(),
    schicht: z.boolean().nullable(),
    salary: z.enum(["disclosed"]).nullable(),
    q: z.string().max(120).nullable(),
    nicht: z.string().max(120).nullable(),
  }),
  /** Filter, die die Person ausdrücklich weghaben will. */
  entfernen: z.array(
    z.enum([
      "ort",
      "umkreisKm",
      "pendelzeit",
      "gehaltAb",
      "remote",
      "contract",
      "arbeitszeit",
      "schicht",
      "salary",
      "q",
      "nicht",
    ]),
  ),
  /** Ein halber Satz für die Quittung unter dem Feld. */
  erklaerung: z.string().max(120),
  /**
   * Der Teil des Satzes, der nirgends hinpasste.
   *
   * ── Warum das ein eigenes Feld ist ──────────────────────────
   *
   * Ohne es hatte das Modell nur eine Wahl: irgendwo hineinzwängen.
   * Und der Ort, an dem alles hineinpasst, ist `q` — die
   * Volltextsuche. „Keine längere Autofahrt als 170 min" landete
   * dort als ganzer Satz und fand null Anzeigen.
   *
   * Mit diesem Feld kann es sagen „das habe ich nicht verstanden",
   * und daraus wird eine Frage statt einer leeren Liste.
   */
  unklar: z.string().max(160).nullable(),
  /**
   * Die eine Rückfrage — oder keine.
   *
   * `schluessel` sagt, worum es geht, damit die Antwort später dem
   * richtigen Filter zugeordnet werden kann.
   */
  rueckfrage: z
    .object({
      schluessel: z.enum(["umkreis", "gehalt", "arbeitszeit", "vertrag", "taetigkeit"]),
      frage: z.string().max(200),
    })
    .nullable(),
});

export type Suchdeutung = z.infer<typeof SuchdeutungSchema>;
