import { and, desc, eq, gte, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { belegstandLaden } from "./belege.ts";
import { anstoesse, type Anstoss } from "./anstoss.ts";

/**
 * Wann eine Tiefenanalyse im Hintergrund lohnt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht nach jeder Änderung
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Gespräch erzeugt in fünf Minuten ein Dutzend Belege. Nach
 * jedem eine Synthese zu rechnen hiesse, zwölfmal das tiefe Modell
 * für ein Bild zu bezahlen, das sich elfmal kaum unterscheidet.
 *
 * Gesammelt wird deshalb, nicht gerechnet: Erst wenn sich genug
 * geändert hat oder genug Zeit vergangen ist, lohnt der Lauf.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum niemand darauf wartet
 * ══════════════════════════════════════════════════════════════
 *
 * Die Analyse gehört nicht in den Antwortweg einer Nachricht. Sie
 * läuft, wenn sie läuft, und ihr Ergebnis steht beim nächsten Mal
 * bereit. Wer sie synchron einbaut, macht aus einer Rückfrage eine
 * Wartezeit von fünf Sekunden.
 */

/** Wie viele neue Belege einen Lauf rechtfertigen. */
export const NEUE_BELEGE_AB = 5;

/**
 * Dieselbe Schwelle, wenn ausserdem etwas Wichtiges passiert ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Ereignis die Schwelle senkt und nicht überspringt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Lebenslauf-Upload kommt selten allein: hochladen, eine Angabe
 * korrigieren, drei Stellen ansehen, Monday schreiben — alles in zehn
 * Minuten. Wer bei jedem Schritt rechnet, bezahlt fünfmal das tiefe
 * Modell für fünf fast gleiche Bilder.
 *
 * Zwei statt fünf, und die zehn Minuten Wartezeit gelten weiter. In
 * diesen zehn Minuten sammelt sich, was zusammengehört.
 */
export const WICHTIG_BELEGE_AB = 2;

/** Nach wie vielen Stunden ohnehin neu gerechnet wird. */
export const SPAETESTENS_NACH_STUNDEN = 24;

/** Frühestens nach so vielen Minuten wieder. */
export const FRUEHESTENS_NACH_MINUTEN = 10;

export type Anlass =
  | "erste_analyse"
  | "genug_neues"
  | "zu_lange_her"
  | "wichtiges_ereignis"
  | "ausdruecklich"
  | "kein_anlass"
  | "zu_frueh";

export interface Faelligkeit {
  faellig: boolean;
  anlass: Anlass;
  neueBelege: number;
  letzteAm: Date | null;
  /** Was seit der letzten Synthese geschehen ist, das kein Beleg ist. */
  anstoesse: Anstoss[];
}

/**
 * Ob für diesen Menschen eine Synthese ansteht.
 *
 * ── Warum „zu früh“ vor allem anderen greift ─────────────────
 *
 * Weil sonst ein Gesprächsverlauf mit vielen Aussagen in kurzer Zeit
 * mehrere Läufe auslösen würde — genau in dem Moment, in dem die
 * Person schreibt und die Rechenzeit nirgends hingehört.
 */
export async function syntheseFaellig(
  db: Database,
  userId: string,
  optionen: { art?: string; ausdruecklich?: boolean; jetzt?: Date } = {},
): Promise<Faelligkeit> {
  const jetzt = optionen.jetzt ?? new Date();
  const art = optionen.art ?? "profilsynthese";

  const [letzte] = await withUser(db, userId, (tx) =>
    tx
      .select({
        erstelltAm: schema.profilSynthesen.erstelltAm,
        belegAnzahl: schema.profilSynthesen.belegAnzahl,
        belegStand: schema.profilSynthesen.belegStand,
      })
      .from(schema.profilSynthesen)
      .where(
        and(eq(schema.profilSynthesen.userId, userId), eq(schema.profilSynthesen.art, art)),
      )
      .orderBy(desc(schema.profilSynthesen.erstelltAm))
      .limit(1),
  );

  const stand = await belegstandLaden(db, userId);

  if (!letzte) {
    return {
      faellig: stand.anzahl >= 3,
      anlass: stand.anzahl >= 3 ? "erste_analyse" : "kein_anlass",
      neueBelege: stand.anzahl,
      letzteAm: null,
      anstoesse: [],
    };
  }

  const minutenSeither = (jetzt.getTime() - letzte.erstelltAm.getTime()) / 60_000;

  /*
   * ══════════════════════════════════════════════════════════════
   * Auch eine Bitte hebt den Fingerabdruck nicht auf
   * ══════════════════════════════════════════════════════════════
   *
   * Die erste Fassung liess `ausdruecklich` an allem vorbei. Im
   * echten Lauf sah das so aus: fällig, Anspruch genommen, ein
   * Budgetplatz belegt — und dann stellte `profilsynthese` fest, dass
   * sich die Belege nicht geändert hatten, und rechnete nicht. Zwei
   * Schichten, zwei verschiedene Antworten auf dieselbe Frage.
   *
   * Der Fingerabdruck hat recht: Dieselbe Eingabe ergibt dieselbe
   * Ausgabe. Eine Bitte kann die Wartezeit und die Belegschwelle
   * übergehen — nicht die Tatsache, dass es nichts Neues gibt.
   *
   * Was der Person dann gesagt wird, ist die Wahrheit: „Seit dem
   * letzten Mal hat sich nichts geändert." Das ist eine bessere
   * Auskunft als eine identische Zusammenfassung, die drei Sekunden
   * gedauert hat.
   */
  const unveraendert = letzte.belegStand === stand.stand;

  if (optionen.ausdruecklich && !unveraendert) {
    return {
      faellig: true,
      anlass: "ausdruecklich",
      neueBelege: Math.max(0, stand.anzahl - letzte.belegAnzahl),
      letzteAm: letzte.erstelltAm,
      anstoesse: [],
    };
  }

  if (!optionen.ausdruecklich && minutenSeither < FRUEHESTENS_NACH_MINUTEN) {
    return {
      faellig: false,
      anlass: "zu_frueh",
      neueBelege: 0,
      letzteAm: letzte.erstelltAm,
      anstoesse: [],
    };
  }

  /*
   * Unverändert heisst unverändert.
   *
   * Der Fingerabdruck vergleicht die Belege selbst, nicht ihre Zahl:
   * Eine Änderung an der Konfidenz eines Belegs ändert die Grundlage,
   * ohne dass ein Beleg dazukommt.
   */
  if (unveraendert) {
    /*
     * Unveränderte Belege, egal was sonst geschehen ist.
     *
     * Ein Anstoss ändert hier nichts. Dieselbe Eingabe ergibt
     * dieselbe Ausgabe — auch wenn zwischendurch ein Lebenslauf
     * hochgeladen wurde, aus dem noch kein Beleg entstanden ist. Zu
     * rechnen wäre Geld für ein identisches Ergebnis.
     */
    if (minutenSeither / 60 >= SPAETESTENS_NACH_STUNDEN) {
      return {
        faellig: true,
        anlass: "zu_lange_her",
        neueBelege: 0,
        letzteAm: letzte.erstelltAm,
        anstoesse: [],
      };
    }
    return {
      faellig: false,
      anlass: "kein_anlass",
      neueBelege: 0,
      letzteAm: letzte.erstelltAm,
      anstoesse: [],
    };
  }

  const neue = Math.max(0, stand.anzahl - letzte.belegAnzahl);
  if (neue >= NEUE_BELEGE_AB) {
    return {
      faellig: true,
      anlass: "genug_neues",
      neueBelege: neue,
      letzteAm: letzte.erstelltAm,
      anstoesse: [],
    };
  }

  /*
   * Weniger Belege, aber etwas Wichtiges ist passiert.
   *
   * Die Abfrage steht hinter der Zählung und nicht davor: Sie kostet
   * drei Datenbankrunden, und in den meisten Fällen ist die Frage
   * schon vorher entschieden.
   */
  const angestossen = await anstoesse(db, userId, letzte.erstelltAm);
  if (angestossen.length > 0 && neue >= WICHTIG_BELEGE_AB) {
    return {
      faellig: true,
      anlass: "wichtiges_ereignis",
      neueBelege: neue,
      letzteAm: letzte.erstelltAm,
      anstoesse: angestossen,
    };
  }

  if (minutenSeither / 60 >= SPAETESTENS_NACH_STUNDEN) {
    return {
      faellig: true,
      anlass: "zu_lange_her",
      neueBelege: neue,
      letzteAm: letzte.erstelltAm,
      anstoesse: angestossen,
    };
  }

  return {
    faellig: false,
    anlass: "kein_anlass",
    neueBelege: neue,
    letzteAm: letzte.erstelltAm,
    anstoesse: angestossen,
  };
}

/**
 * Wessen Profil ansteht — für einen Hintergrundlauf.
 *
 * ── Warum nur Menschen mit frischer Aktivität ────────────────
 *
 * Ein Profil, das seit Wochen unberührt ist, braucht keine neue
 * Zusammenfassung. Sie zu rechnen kostet Geld für eine Auskunft,
 * die niemand abruft.
 */
export async function faelligeProfile(
  db: Database,
  optionen: { grenze?: number; seitStunden?: number; jetzt?: Date } = {},
): Promise<string[]> {
  const jetzt = optionen.jetzt ?? new Date();
  const seit = new Date(jetzt.getTime() - (optionen.seitStunden ?? 48) * 3600_000);

  const zeilen = (await db.execute(sql`
    select e.user_id, count(*)::int as belege, max(e.updated_at) as zuletzt
      from evidence_items e
     where e.deleted_at is null
       and e.user_rejected = false
       and e.updated_at >= ${seit}
     group by e.user_id
    having count(*) >= 3
     order by max(e.updated_at) desc
     limit ${Math.min(optionen.grenze ?? 50, 500)}
  `)) as unknown as { rows: { user_id: string }[] };

  return zeilen.rows.map((z) => String(z.user_id));
}
