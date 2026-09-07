import { z } from "zod";

/**
 * Was Monday auf der Seite tun darf.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine Liste ist und keine Sammlung von Knöpfen
 * ══════════════════════════════════════════════════════════════
 *
 * Jede Funktion der Seite muss auf drei Wegen auslösbar sein:
 *
 *   Klick   → „Gehalt prüfen"-Knopf
 *   Text    → „Ist das Gehalt gut?"
 *   Sprache → „Was verdient man da normalerweise?"
 *
 * Hinge die Logik am Knopf, gäbe es sie für die anderen beiden Wege
 * nicht — und der übliche Ausweg wäre, sie ein zweites und drittes Mal
 * zu schreiben. Drei Fassungen derselben Sache laufen auseinander,
 * sobald eine geändert wird, und niemand merkt es.
 *
 * Deshalb steht hier die Absicht, nicht die Ausführung: „öffne die
 * Gehaltsansicht für diese Stelle". Wer sie auslöst, ist der Liste
 * gleichgültig.
 *
 * ══════════════════════════════════════════════════════════════
 * Server- und Oberflächenaktionen
 * ══════════════════════════════════════════════════════════════
 *
 * Zwei Arten, die nicht vermischt werden dürfen:
 *
 *   `oberflaeche` — ändert nur, was zu sehen ist. Gefahrlos, sofort,
 *                   ohne Rückfrage. Eine Ansicht zu öffnen kann nichts
 *                   kaputtmachen.
 *
 *   `server`      — ändert Daten. Merken, Bewerbung anlegen. Läuft über
 *                   die bestehenden Werkzeuge und deren Prüfungen.
 *
 * Die Trennung steht im Feld `wirkung`, damit die Ausführung sie nicht
 * erraten muss. Eine Oberflächenaktion darf Monday von sich aus
 * auslösen; eine Serveraktion nicht ohne ausdrückliche Zustimmung.
 */

export type Wirkung = "oberflaeche" | "server";

/** Die Ansichten, die das rechte Panel zeigen kann. */
export const ANSICHTEN = [
  /** Die Fakten der Stelle. Der Anfangszustand, ohne Deutung. */
  "uebersicht",
  "passung",
  "dafuer",
  "dagegen",
  "gehalt",
  "anforderungen",
  "arbeitsalltag",
  "unternehmen",
  "arbeitsweg",
  "vergleich",
  "aehnliche",
  "bewerbung",
  /** Die Originalanzeige, ungedeutet. */
  "beschreibung",
] as const;
export type Ansicht = (typeof ANSICHTEN)[number];

/** Abschnitte der Stellenanzeige, die sich ansteuern lassen. */
export const ABSCHNITTE = [
  "beschreibung",
  "anforderungen",
  "arbeitszeiten",
  "gehalt",
  "arbeitsweg",
  "unternehmen",
] as const;
export type Abschnitt = (typeof ABSCHNITTE)[number];

const KENNUNG = z.string().uuid();

/**
 * Die Aktionen selbst.
 *
 * Jede trägt ihr Schema mit. Das ist nicht Zierde: Die Argumente
 * kommen bei Sprachbedienung aus einem Modell, das aus „zeig mir den
 * ersten" eine Kennung ableiten muss — und dabei auch etwas erfinden
 * kann. Ein Schema am Eingang ist die Stelle, an der das auffällt.
 */
export const AKTIONEN = {
  /** Eine Stelle in der Hauptansicht öffnen. */
  open_job: {
    wirkung: "oberflaeche",
    beschreibung: "Öffnet eine Stelle in der Mitte der Seite.",
    schema: z.object({ jobId: KENNUNG }),
  },
  /** Eine Ansicht im rechten Panel zeigen. */
  show_panel: {
    wirkung: "oberflaeche",
    beschreibung: "Wechselt die Ansicht im Monday-Panel rechts.",
    schema: z.object({ ansicht: z.enum(ANSICHTEN), jobId: KENNUNG.nullish() }),
  },
  /** Zu einem Abschnitt der Anzeige springen und ihn hervorheben. */
  highlight_section: {
    wirkung: "oberflaeche",
    beschreibung:
      "Springt zu einem Abschnitt der Stellenanzeige und hebt ihn kurz hervor.",
    schema: z.object({ abschnitt: z.enum(ABSCHNITTE) }),
  },
  /** Zwei Stellen nebeneinanderstellen. */
  compare_jobs: {
    wirkung: "oberflaeche",
    beschreibung: "Stellt zwei Stellen im Panel gegenüber.",
    schema: z.object({ jobA: KENNUNG, jobB: KENNUNG }),
  },
  /** Die Liste links neu filtern. */
  filter_jobs: {
    wirkung: "oberflaeche",
    beschreibung: "Ändert die Suche in der Liste links.",
    schema: z.object({
      suche: z.string().max(200).nullish(),
      sortierung: z.string().max(40).nullish(),
    }),
  },
  /** Eine Stelle merken. */
  save_job: {
    wirkung: "server",
    beschreibung: "Merkt eine Stelle für später.",
    schema: z.object({ jobId: KENNUNG }),
  },
  /** Merken zurücknehmen. */
  unsave_job: {
    wirkung: "server",
    beschreibung: "Nimmt eine gemerkte Stelle wieder heraus.",
    schema: z.object({ jobId: KENNUNG }),
  },
  /** Eine Bewerbung vorbereiten. */
  prepare_application: {
    wirkung: "server",
    beschreibung:
      "Legt eine Bewerbung im Zustand „In Vorbereitung“ an. Versendet nichts.",
    schema: z.object({ jobId: KENNUNG }),
  },

  /* ═══════════════════════════════════════════════════════════
     Der laufende Suchauftrag
     ═══════════════════════════════════════════════════════════

     Vier Aktionen, und die Trennung zwischen ihnen ist der ganze
     Punkt. „Pausiere meine E-Mails" und „hör auf zu suchen" sind zwei
     verschiedene Sätze, und wer sie auf denselben Schalter legt,
     nimmt jemandem seine Suche weg, der eine Nacht Ruhe wollte.

     `suchauftrag_aendern` legt ausdrücklich nur einen Entwurf an.
     Eine bestätigte Bedingung ändert Monday nicht im Vorbeigehen — sie
     zeigt, was gälte, und fragt. Das ist keine Höflichkeit: Ohne den
     Zwischenschritt liesse sich später nicht sagen, wann die Person
     zugestimmt hat. */

  /**
   * „Such für mich weiter nach …" — ein Auftrag aus einem Satz.
   *
   * Der Einstieg, den es ohne Modell nicht gibt. Er legt einen
   * Entwurf an und nichts weiter; was gilt, entscheidet die Person im
   * nächsten Schritt.
   */
  suchauftrag_anlegen: {
    wirkung: "server",
    beschreibung:
      "Erstellt aus dem Satz der Person einen Suchauftrag als Entwurf und legt ihn zur Bestätigung vor. " +
      "Aktiviert nichts.",
    schema: z.object({
      /* Der Wortlaut, nicht eine Zusammenfassung: Er ist der Beleg. */
      aussage: z.string().min(5).max(2000),
    }),
  },

  /** „Wonach suchst du?" — die Aufträge zeigen. */
  suchauftrag_zeigen: {
    wirkung: "oberflaeche",
    beschreibung: "Öffnet die Suchaufträge mit Kriterien, Stand und Treffern.",
    schema: z.object({}),
  },

  /** „Nur noch Teilzeit." — als Entwurf, nicht als Tatsache. */
  suchauftrag_aendern: {
    wirkung: "server",
    beschreibung:
      "Bereitet eine Änderung am Suchauftrag vor und legt sie der Person zur Bestätigung vor. " +
      "Ändert nichts von selbst.",
    schema: z.object({
      auftragId: KENNUNG.nullish(),
      kriterium: z.string().min(2).max(64),
      wert: z.union([z.string().max(200), z.number(), z.boolean(), z.array(z.string().max(80)).max(8)]),
      staerke: z.enum(["muss", "wunsch"]).default("wunsch"),
    }),
  },

  /** „Halt die Suche an." */
  suchauftrag_pausieren: {
    wirkung: "server",
    beschreibung: "Pausiert einen Suchauftrag. Die gefundenen Treffer bleiben erhalten.",
    schema: z.object({ auftragId: KENNUNG.nullish() }),
  },

  /** „Heute Nacht nicht." — genau ein Lauf. */
  suchauftrag_aussetzen: {
    wirkung: "server",
    beschreibung:
      "Setzt den nächsten Lauf eines Suchauftrags aus. Der Auftrag bleibt aktiv und läuft danach weiter.",
    schema: z.object({ auftragId: KENNUNG.nullish() }),
  },

  /** „Pausiere meine E-Mails." — die Suche läuft weiter. */
  mails_pausieren: {
    wirkung: "server",
    beschreibung:
      "Schaltet die E-Mail-Zusammenfassungen ab. Die Suche läuft weiter, die Treffer bleiben in Velvova.",
    schema: z.object({}),
  },
} as const satisfies Record<
  string,
  { wirkung: Wirkung; beschreibung: string; schema: z.ZodTypeAny }
>;

export type Aktionsname = keyof typeof AKTIONEN;

export type Aktion = {
  [N in Aktionsname]: { name: N; args: z.infer<(typeof AKTIONEN)[N]["schema"]> };
}[Aktionsname];

export type Pruefung =
  | { ok: true; aktion: Aktion }
  | { ok: false; grund: string };

/**
 * Eine Aktion prüfen, bevor sie ausgeführt wird.
 *
 * Der Rückgabewert nennt einen Grund statt nur `false`. Monday muss der
 * Person sagen können, warum etwas nicht ging — „ich kenne die Stelle
 * nicht" ist eine Antwort, ein stilles Nichts ist keine.
 */
export function aktionPruefen(name: string, args: unknown): Pruefung {
  if (!(name in AKTIONEN)) {
    return { ok: false, grund: `Unbekannte Aktion: ${name}` };
  }
  const eintrag = AKTIONEN[name as Aktionsname];
  const ergebnis = eintrag.schema.safeParse(args ?? {});
  if (!ergebnis.success) {
    /*
     * Der erste Fehler reicht.
     *
     * Die vollständige Zod-Fehlerliste ist für eine gesprochene
     * Antwort unbrauchbar, und mehr als der erste Grund ändert nichts
     * daran, dass die Aktion nicht läuft.
     */
    const erster = ergebnis.error.issues[0];
    return {
      ok: false,
      grund: `${name}: ${erster?.path.join(".") || "Argument"} ${erster?.message ?? "ungültig"}`,
    };
  }
  return { ok: true, aktion: { name, args: ergebnis.data } as Aktion };
}

/**
 * Ob Monday die Aktion ohne Rückfrage auslösen darf.
 *
 * Oberflächenaktionen ja: Eine Ansicht zu öffnen ist umkehrbar und
 * kostet nichts. Serveraktionen nein — auch das Merken nicht. Der
 * Unterschied zwischen „ich zeige dir das Gehalt" und „ich habe die
 * Stelle für dich gemerkt" ist der zwischen Auskunft und Handeln, und
 * Handeln bleibt bei der Person.
 */
export function darfOhneRueckfrage(name: Aktionsname): boolean {
  return AKTIONEN[name].wirkung === "oberflaeche";
}
