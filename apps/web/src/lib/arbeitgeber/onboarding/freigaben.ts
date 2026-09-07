/**
 * Was Monday darf — und was sie nie darf.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Zusammenfassung abgeleitet wird
 * ══════════════════════════════════════════════════════════════
 *
 * Der naheliegende Weg wäre ein geschriebener Absatz neben den
 * Schaltern. Der wäre am selben Tag richtig und ein halbes Jahr
 * später falsch — jemand ändert eine Regel im Matcher, und der Absatz
 * bleibt stehen. Dann steht auf der Seite eine Zusage, die das
 * Programm nicht mehr einhält.
 *
 * Deshalb entsteht jeder Satz hier aus der gewählten Stufe. Ändert
 * sich die Stufe, ändert sich der Satz; gibt es eine Stufe nicht mehr,
 * gibt es den Satz nicht mehr.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die „darf nicht“-Liste nicht von der Stufe abhängt
 * ══════════════════════════════════════════════════════════════
 *
 * Weil sie es im Programm auch nicht tut. Die vier Sätze unten stehen
 * für Sperren, die keine Einstellung öffnet:
 *
 *   1. `user_settings.auffindbar` steht auf `false`, bis jemand es
 *      selbst umlegt — `matcher.ts` sucht nur in dieser Menge.
 *   2. `kontakt_offen` ist aus `UEBERGAENGE` nur über
 *      `gegenseitiges_interesse` erreichbar (`matches.ts`).
 *   3. Name und Adresse werden in `matches.ts` in einer zweiten
 *      Abfrage geholt, die nur im Zustand `kontakt_offen` läuft — sie
 *      liegen sonst gar nicht im Speicher.
 *   4. Es gibt keine Auto-Bewerbung; kein Pfad im Programm sendet eine
 *      Bewerbung ohne ausdrückliche Handlung des Menschen.
 *
 * Eine Einstellung, die einen dieser Sätze aufhöbe, gibt es nicht.
 * Käme sie, müsste der Satz hier verschwinden — und wer ihn löscht,
 * sieht, was er damit zusagt.
 */

export type Stufe = "nur_vorschlagen" | "nach_freigabe" | "selbst_ansprechen";
export type Kontaktregel = "immer_einzeln" | "ab_gegenseitig";

export const STUFEN: {
  wert: Stufe;
  label: string;
  erklaerung: string;
  darf: string[];
}[] = [
  {
    wert: "nur_vorschlagen",
    label: "Nur vorschlagen",
    erklaerung: "Monday legt dir passende Menschen vor. Jeden Schritt danach machst du.",
    darf: [
      "passende Profile suchen und dir anonym vorlegen",
      "dir erklären, warum jemand passt und wo es hakt",
    ],
  },
  {
    wert: "nach_freigabe",
    label: "Ansprechen, nachdem du zugestimmt hast",
    erklaerung:
      "Monday schreibt die Anfrage, du liest sie und gibst sie frei. Erst dann geht sie raus.",
    darf: [
      "passende Profile suchen und dir anonym vorlegen",
      "dir erklären, warum jemand passt und wo es hakt",
      "eine Anfrage vorbereiten — abgeschickt wird sie erst nach deiner Freigabe",
    ],
  },
  {
    wert: "selbst_ansprechen",
    label: "Selbst ansprechen",
    erklaerung:
      "Monday fragt bei passenden Menschen selbst an, ob sie ihr Profil für euch freigeben. " +
      "Ob sie zusagen, entscheiden sie.",
    darf: [
      "passende Profile suchen und dir anonym vorlegen",
      "dir erklären, warum jemand passt und wo es hakt",
      "selbst um eine Profilfreigabe bitten und dir das Ergebnis zeigen",
    ],
  },
];

export const KONTAKTREGELN: { wert: Kontaktregel; label: string; erklaerung: string }[] = [
  {
    wert: "immer_einzeln",
    label: "Ich gebe jeden Kontakt einzeln frei",
    erklaerung: "Auch bei gegenseitigem Interesse fragt Monday dich noch einmal.",
  },
  {
    wert: "ab_gegenseitig",
    label: "Kontakt öffnen, sobald beide Seiten Interesse gezeigt haben",
    erklaerung: "Monday öffnet den Kontakt, ohne dich noch einmal zu fragen.",
  },
];

/**
 * Was Monday in keiner Einstellung darf.
 *
 * Jeder Satz steht für eine Stelle im Programm. Die Verweise stehen
 * oben im Kopfkommentar — sie gehören zum Satz, nicht in die
 * Oberfläche.
 */
export const NIEMALS: string[] = [
  "Menschen vorschlagen, die sich nicht auffindbar gemacht haben",
  "Kontaktdaten zeigen, bevor beide Seiten Interesse gezeigt haben",
  "Namen oder Adressen laden, solange der Kontakt nicht offen ist",
  "sich für jemanden bewerben oder eine Bewerbung ohne dessen Handlung abschicken",
];

export type Freigabenstand = {
  stufe: Stufe;
  kontakt: Kontaktregel;
  darf: string[];
  niemals: string[];
  vollstaendig: boolean;
};

const IST_STUFE = new Set(STUFEN.map((s) => s.wert));
const IST_REGEL = new Set(KONTAKTREGELN.map((k) => k.wert));

/**
 * Den Stand aus den gespeicherten Angaben lesen.
 *
 * Ohne Auswahl gilt die vorsichtigste Stufe. Eine Vorbelegung auf
 * „selbst ansprechen“ wäre eine Zustimmung, die niemand gegeben hat —
 * und sie fiele erst auf, wenn die erste Nachricht draussen ist.
 */
export function freigabenstand(angaben: { bereich: string; feld: string; wert: unknown }[]): Freigabenstand {
  const hole = (feld: string) =>
    angaben.find((a) => a.bereich === "freigaben" && a.feld === feld)?.wert;

  const rohStufe = hole("stufe");
  const rohKontakt = hole("kontaktFreigabe");

  const stufe: Stufe =
    typeof rohStufe === "string" && IST_STUFE.has(rohStufe as Stufe)
      ? (rohStufe as Stufe)
      : "nur_vorschlagen";
  const kontakt: Kontaktregel =
    typeof rohKontakt === "string" && IST_REGEL.has(rohKontakt as Kontaktregel)
      ? (rohKontakt as Kontaktregel)
      : "immer_einzeln";

  const gewaehlt = STUFEN.find((s) => s.wert === stufe)!;
  const darf = [...gewaehlt.darf];
  if (kontakt === "ab_gegenseitig") {
    darf.push("den Kontakt öffnen, sobald beide Seiten Interesse gezeigt haben");
  }

  return {
    stufe,
    kontakt,
    darf,
    niemals: NIEMALS,
    /* „Vollständig“ heisst: beide Werte stehen wirklich da. Der
       vorsichtige Vorgabewert ist eine Annahme, keine Entscheidung —
       und eine Annahme darf das Onboarding nicht abschliessen. */
    vollstaendig: typeof rohStufe === "string" && typeof rohKontakt === "string",
  };
}
