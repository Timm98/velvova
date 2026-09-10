import { and, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { suchprofilAusText } from "@paycheck/jobs";

/**
 * ══════════════════════════════════════════════════════════════════
 * Aus dem Ziel eines Vorhabens wird eine Suche
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Projekt hatte bis hierher ein `ziel` — einen Satz, den Monday
 * aus dem Gespräch mitgeschrieben hat. Ein Satz lässt sich nicht
 * gegen Millionen Anzeigen prüfen, also blieb die Stellenliste leer,
 * bis jemand sie von Hand füllte.
 *
 * Diese Datei macht aus dem Satz einen Suchauftrag: dieselbe Kette,
 * die es für die Suchaufträge längst gibt — `such_profile` mit
 * `such_kriterien`, stündlich abgearbeitet, Treffer nach
 * `auftrag_treffer`. Neu ist nur, woher der Text kommt.
 *
 * ── Warum der Auftrag ein ENTWURF bleibt ────────────────────────
 *
 * Weil Schweigen nichts aktiviert. Ein Vorhaben zu erkennen ist eine
 * Beobachtung; eine laufende Suche ist eine Entscheidung, und die
 * trifft der Mensch. Das ist an dieser Anwendung keine Vorsicht,
 * sondern eine Regel: Profil, Suchauftrag und Benachrichtigung dürfen
 * nie zu einem einzigen Feld werden.
 *
 * Was hier also automatisch passiert, ist die Struktur — der Auftrag
 * mit erkannten Kriterien liegt fertig da. Was nicht automatisch
 * passiert, ist der Start.
 *
 * ── Warum das Modell hier gebraucht wird ────────────────────────
 *
 * Aus „Projektleitung in Zürich, ab 90k, höchstens zwei Tage vor Ort"
 * müssen `taetigkeit`, `arbeitsort`, `mindestgehalt` und
 * `arbeitsmodell` werden. Das ist keine Zerlegung, die sich mit
 * Mustern erledigen lässt, ohne bei der ersten ungewohnten
 * Formulierung still das Falsche zu erkennen.
 *
 * Ohne freigegebenes Modell entsteht deshalb kein Auftrag — und das
 * meldet diese Funktion, statt einen leeren anzulegen.
 */

export type Suchbefund =
  | {
      ok: true;
      auftragId: string;
      /** Die erkannten Kriterien in Worten, für die Bestätigung. */
      kriterien: string[];
      /** Was das Modell nicht übernehmen konnte. */
      verworfen: string[];
      /** Keine Tätigkeit erkannt — eine sehr breite Suche. */
      ohneTaetigkeit: boolean;
      rueckfrage: string | null;
    }
  | { ok: false; grund: "kein_modell" | "nichts_erkannt" | "kein_ziel" | "fehler" };

/** Unter dieser Länge lohnt der Modellaufruf nicht. */
const MINDESTZIEL = 12;

/**
 * Taugt dieses Ziel als Grundlage für Kriterien?
 *
 * Eigene Funktion, weil hier eine Entscheidung getroffen wird und
 * keine Abfrage läuft: Aus „Jobsuche" lassen sich keine Kriterien
 * ableiten, aus „Projektleitung in Zürich" schon. Fragt man das
 * Modell trotzdem, kostet es Geld und liefert entweder nichts oder
 * — schlimmer — eine erfundene Eingrenzung.
 */
export function zielTaugt(ziel: string | null | undefined): boolean {
  return (ziel ?? "").trim().length >= MINDESTZIEL;
}

/**
 * Legt für ein Vorhaben einen Suchauftrag im Entwurf an.
 *
 * Vorhandene Aufträge des Vorhabens werden nicht angefasst: Wer
 * zweimal etwas über sein Ziel sagt, soll nicht zwei Suchen bekommen.
 * Ob ein weiterer Auftrag gewollt ist, entscheidet der Mensch auf der
 * Projektseite.
 */
export async function sucheFuerProjekt(
  userId: string,
  projektId: string,
  ziel: string | null,
): Promise<Suchbefund> {
  const text = (ziel ?? "").trim();
  if (!zielTaugt(text)) return { ok: false, grund: "kein_ziel" };

  const db = await getDb();

  /* Schon eine Suche da? Dann ist hier nichts zu tun. */
  const vorhanden = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.suchAuftraege.id })
      .from(schema.suchAuftraege)
      .where(
        and(
          eq(schema.suchAuftraege.userId, userId),
          eq(schema.suchAuftraege.projektId, projektId),
        ),
      )
      .limit(1),
  );
  if (vorhanden.length > 0) {
    return {
      ok: true,
      auftragId: vorhanden[0]!.id,
      kriterien: [],
      verworfen: [],
      ohneTaetigkeit: false,
      rueckfrage: null,
    };
  }

  const { modellBereit, modellrufer, PROMPT_SUCHPROFIL } = await import(
    "@/lib/suchauftrag/modellrufer"
  );
  const modell = await modellBereit();
  if (!modell.bereit) return { ok: false, grund: "kein_modell" };

  const befund = await suchprofilAusText(db, {
    userId,
    text,
    quelle: "chat",
    auftragId: null,
    rufer: modellrufer(),
    prompt: PROMPT_SUCHPROFIL,
  });

  if (!befund.ok || !befund.auftragId) {
    return { ok: false, grund: befund.grund === "kein_modell" ? "kein_modell" : "nichts_erkannt" };
  }

  /*
   * Die Klammer zum Vorhaben — nach dem Anlegen, nicht darin.
   *
   * `suchprofilAusText` ist der Weg, den auch die Stellenseite geht;
   * sie kennt keine Projekte, und das soll so bleiben. Ein Auftrag,
   * dessen `projekt_id` nicht gesetzt werden konnte, ist deshalb kein
   * kaputter Auftrag — er steht dann bei den Suchaufträgen statt unter
   * dem Vorhaben. Sichtbar an der falschen Stelle ist besser als
   * unsichtbar.
   */
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.suchAuftraege)
      .set({ projektId })
      .where(
        and(
          eq(schema.suchAuftraege.id, befund.auftragId!),
          eq(schema.suchAuftraege.userId, userId),
        ),
      ),
  );

  return {
    ok: true,
    auftragId: befund.auftragId,
    kriterien: befund.kriterien ?? [],
    verworfen: (befund.verworfen ?? []).map((v) => v.kriterium),
    ohneTaetigkeit: befund.ohneTaetigkeit === true,
    rueckfrage: befund.rueckfrage ?? null,
  };
}

/**
 * Der Suchauftrag eines Vorhabens, für die Projektseite.
 *
 * `null` heisst: Es gibt keinen. Das ist ein anderer Zustand als
 * „keine Treffer" und muss auf der Seite anders aussehen — sonst
 * liest sich ein fehlender Auftrag wie ein erfolgloser.
 */
export async function suchePruefen(
  userId: string,
  projektId: string,
): Promise<{ id: string; name: string; status: string; laeuftSeit: Date | null } | null> {
  const db = await getDb();
  const [zeile] = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.suchAuftraege.id,
        name: schema.suchAuftraege.name,
        status: schema.suchAuftraege.status,
        laeuftSeit: schema.suchAuftraege.bestaetigtAm,
      })
      .from(schema.suchAuftraege)
      .where(
        and(
          eq(schema.suchAuftraege.userId, userId),
          eq(schema.suchAuftraege.projektId, projektId),
        ),
      )
      .limit(1),
  );
  return zeile ?? null;
}
