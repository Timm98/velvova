import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, withSystem, withUser, type Database } from "@paycheck/db";
import { aehnlichste, jobEinbettungstext, kosinus, type Vektortreffer } from "@paycheck/matching";

/**
 * Einbettungen anlegen und wiederverwenden.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht jede Nacht alles neu
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Vektor hängt am Text, nicht am Datum. Solange sich Titel,
 * Aufgaben und Anforderungen nicht ändern, ist der Vektor von gestern
 * derselbe wie der von heute — und jede Neuberechnung kostet Geld für
 * ein identisches Ergebnis.
 *
 * Deshalb steht der Fingerabdruck des Textes daneben. Neu eingebettet
 * wird, was neu ist oder sich wesentlich geändert hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Einbetter hereingereicht wird
 * ══════════════════════════════════════════════════════════════
 *
 * Damit dieses Paket kein Anbieter-SDK kennt — und damit ein Test nie
 * versehentlich einen kostenpflichtigen Aufruf auslöst. Ohne
 * `einbetter` passiert nichts, und die Suche läuft ohne semantischen
 * Schritt weiter. Das ist kein Ausfall: Stichwort- und Strukturpfad
 * finden weiterhin, was sie finden.
 */

/** Was der Aufrufer mitbringt: die Einbettung selbst. */
export type Einbetter = (texte: string[]) => Promise<number[][]>;

export interface Einbettungsmodell {
  /** Der Modellname — Teil des Schlüssels, weil Vektoren modellgebunden sind. */
  name: string;
  /** Wie viele Vektoren höchstens in einem Aufruf. */
  stapel: number;
}

export const EINBETTUNG_STAPEL = 96;

/** Fingerabdruck des eingebetteten Textes. */
export function textSchluessel(text: string): string {
  return createHash("sha256").update(text.trim().replace(/\s+/g, " ")).digest("hex").slice(0, 32);
}

export interface Jobtext {
  jobId: string;
  text: string;
}

export interface Einbettungslauf {
  neu: number;
  unveraendert: number;
  gescheitert: number;
}

/**
 * Fehlende Job-Einbettungen nachziehen.
 *
 * Läuft über eine begrenzte Menge: Wer alles auf einmal einbettet,
 * bezahlt einmal viel und blockiert die Runde, für die er es tut.
 */
export async function jobEinbettungenSichern(
  db: Database,
  texte: readonly Jobtext[],
  modell: Einbettungsmodell,
  einbetter?: Einbetter,
): Promise<Einbettungslauf> {
  const lauf: Einbettungslauf = { neu: 0, unveraendert: 0, gescheitert: 0 };
  if (!einbetter || texte.length === 0) return lauf;

  const vorhanden = await withSystem(db, (tx) =>
    tx
      .select({
        jobId: schema.jobEinbettungen.jobId,
        textSchluessel: schema.jobEinbettungen.textSchluessel,
      })
      .from(schema.jobEinbettungen)
      .where(
        and(
          eq(schema.jobEinbettungen.modell, modell.name),
          inArray(schema.jobEinbettungen.jobId, texte.map((t) => t.jobId)),
        ),
      ),
  );
  const bekannt = new Map(vorhanden.map((v) => [v.jobId, v.textSchluessel]));

  const offen = texte.filter((t) => bekannt.get(t.jobId) !== textSchluessel(t.text));
  lauf.unveraendert = texte.length - offen.length;
  if (offen.length === 0) return lauf;

  for (let i = 0; i < offen.length; i += modell.stapel) {
    const teil = offen.slice(i, i + modell.stapel);
    try {
      const vektoren = await einbetter(teil.map((t) => t.text));
      if (vektoren.length !== teil.length) {
        /*
         * Weniger Vektoren als Texte heisst: Die Zuordnung ist
         * unklar. Sie nach Arrayposition zu raten wäre der Fehler,
         * den der Auftrag ausdrücklich benennt — verspätete
         * Ergebnisse nach IDs zuordnen, nicht nach Position.
         */
        lauf.gescheitert += teil.length;
        continue;
      }
      await withSystem(db, async (tx) => {
        for (let k = 0; k < teil.length; k++) {
          const v = vektoren[k]!;
          await tx
            .insert(schema.jobEinbettungen)
            .values({
              jobId: teil[k]!.jobId,
              textSchluessel: textSchluessel(teil[k]!.text),
              modell: modell.name,
              dimensionen: v.length,
              vektor: v,
            })
            .onConflictDoUpdate({
              target: [schema.jobEinbettungen.jobId, schema.jobEinbettungen.modell],
              set: {
                textSchluessel: textSchluessel(teil[k]!.text),
                dimensionen: v.length,
                vektor: v,
                erstelltAm: new Date(),
              },
            });
        }
      });
      lauf.neu += teil.length;
    } catch (fehler) {
      /* Ein gescheiterter Stapel nimmt die anderen nicht mit. */
      console.warn("[einbettung] Stapel gescheitert:", String(fehler).slice(0, 160));
      lauf.gescheitert += teil.length;
    }
  }
  return lauf;
}

/**
 * Den Vektor einer Person holen — und nur bei Bedarf neu bilden.
 *
 * `null`, wenn kein Einbetter da ist oder der Text leer bleibt. Dann
 * entfällt der semantische Schritt, und die Suche läuft weiter.
 */
export async function profilEinbettungHolen(
  db: Database,
  userId: string,
  auftragId: string | null,
  text: string,
  modell: Einbettungsmodell,
  einbetter?: Einbetter,
): Promise<number[] | null> {
  if (text.trim().length < 10) return null;
  const schluessel = textSchluessel(text);

  const vorhanden = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.profilEinbettungen)
      .where(
        and(
          eq(schema.profilEinbettungen.userId, userId),
          eq(schema.profilEinbettungen.modell, modell.name),
          auftragId === null
            ? isNull(schema.profilEinbettungen.auftragId)
            : eq(schema.profilEinbettungen.auftragId, auftragId),
        ),
      )
      .limit(1),
  );

  const alt = vorhanden[0];
  if (alt && alt.textSchluessel === schluessel) return alt.vektor;
  if (!einbetter) return alt?.vektor ?? null;

  try {
    const [vektor] = await einbetter([text]);
    if (!vektor) return alt?.vektor ?? null;
    await withUser(db, userId, async (tx) => {
      if (alt) {
        await tx
          .update(schema.profilEinbettungen)
          .set({ textSchluessel: schluessel, dimensionen: vektor.length, vektor, erstelltAm: new Date() })
          .where(eq(schema.profilEinbettungen.id, alt.id));
      } else {
        await tx.insert(schema.profilEinbettungen).values({
          userId,
          auftragId,
          textSchluessel: schluessel,
          modell: modell.name,
          dimensionen: vektor.length,
          vektor,
        });
      }
    });
    return vektor;
  } catch (fehler) {
    console.warn("[einbettung] Profilvektor nicht gebildet:", String(fehler).slice(0, 160));
    /* Der alte Vektor ist besser als keiner — er ist nur nicht der
       neueste. Ohne ihn entfiele der semantische Schritt ganz. */
    return alt?.vektor ?? null;
  }
}

/**
 * Wie viele Stellen der semantische Schritt höchstens durchsieht.
 *
 * ── Warum es eine Obergrenze gibt ─────────────────────────────
 *
 * Die Kosinusrechnung läuft im Prozess. Über tausend Vektoren ist das
 * unmessbar, über eine Million wäre es der langsamste Schritt der
 * ganzen Kette — und zwar für jede Person einzeln.
 *
 * Solange der analysierte Bestand klein ist, sieht diese Grenze wie
 * eine Formalie aus. Sie ist die Stelle, an der später `pgvector`
 * eingesetzt wird.
 */
export const SEMANTIK_POOL = 2000;

export interface Vektorkandidat {
  jobId: string;
  aehnlichkeit: number;
}

/**
 * Die semantisch ähnlichsten Stellen aus einer vorgefilterten Menge.
 *
 * ══════════════════════════════════════════════════════════════
 * Was dieser Schritt darf
 * ══════════════════════════════════════════════════════════════
 *
 * Stellen finden, die über Titel und Stichwort nie aufgetaucht wären
 * — „Kommissionierer" für jemanden, der „Lagerhelfer" gesagt hat.
 *
 * Und sonst nichts. Was er findet, geht durch dieselbe vollständige
 * Muss-Prüfung wie alles andere. Eine hohe Ähnlichkeit erfüllt keine
 * Bedingung, hebt keine auf und erhöht keinen Fit.
 */
export async function semantischeKandidaten(
  db: Database,
  anfrage: readonly number[],
  modell: Einbettungsmodell,
  jobIds: readonly string[],
  grenze: number,
): Promise<Vektorkandidat[]> {
  if (anfrage.length === 0 || jobIds.length === 0) return [];

  const zeilen = await withSystem(db, (tx) =>
    tx
      .select({
        jobId: schema.jobEinbettungen.jobId,
        vektor: schema.jobEinbettungen.vektor,
        dimensionen: schema.jobEinbettungen.dimensionen,
      })
      .from(schema.jobEinbettungen)
      .where(
        and(
          eq(schema.jobEinbettungen.modell, modell.name),
          inArray(schema.jobEinbettungen.jobId, jobIds.slice(0, SEMANTIK_POOL)),
        ),
      ),
  );

  const treffer: Vektortreffer<string>[] = aehnlichste(
    anfrage,
    /* Vektoren anderer Dimension gehören zu einem anderen Modell und
       werden gar nicht erst verglichen. */
    zeilen
      .filter((z) => z.dimensionen === anfrage.length)
      .map((z) => ({ schluessel: z.jobId, vektor: z.vektor, wert: z.jobId })),
    grenze,
  );

  return treffer.map((t) => ({ jobId: t.eintrag, aehnlichkeit: t.aehnlichkeit }));
}

/** Für Prüfungen und Diagnose: die Ähnlichkeit zweier gespeicherter Vektoren. */
export function aehnlichkeit(a: readonly number[], b: readonly number[]): number | null {
  return kosinus(a, b);
}

/** Nur für Abfragen, die keine Drizzle-Form haben. */
export const EINBETTUNG_ZAEHLER = sql<number>`count(*)`;

/* ═══════════════════════════════════════════════════════════════
   Nachziehen
   ═══════════════════════════════════════════════════════════════ */

/** Wie viele Stellen je Lauf höchstens eingebettet werden. */
export const EINBETTUNG_JE_LAUF = 200;

/**
 * Fehlende Job-Einbettungen in Stapeln nachziehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht beim Import und nicht bei der Analyse
 * ══════════════════════════════════════════════════════════════
 *
 * Der Import schreibt tausende Anzeigen in einem Lauf; jede
 * einzubetten hiesse, den Import an einen Anbieter zu koppeln, der
 * gerade langsam sein kann. Die Analyse läuft deterministisch und
 * ohne Modell — genau das macht sie belastbar.
 *
 * Hier ist der richtige Ort: Es wird eingebettet, was für die Suche
 * gebraucht wird, in einer Menge, die eine Runde nicht aufhält. Ohne
 * Einbettung fehlt einer Stelle nur der semantische Weg; über
 * Stichwort und Struktur ist sie weiter auffindbar.
 */
export async function einbettungenNachziehen(
  db: Database,
  modell: Einbettungsmodell,
  einbetter?: Einbetter,
  grenze = EINBETTUNG_JE_LAUF,
): Promise<Einbettungslauf> {
  const lauf: Einbettungslauf = { neu: 0, unveraendert: 0, gescheitert: 0 };
  if (!einbetter) return lauf;

  const offen = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select j.id, j.title, j.core_tasks, j.kldb,
             coalesce(
               (select json_agg(r.text order by r.kind, r.text)
                  from job_requirements r where r.job_id = j.id), '[]'::json
             ) as anforderungen
        from job_analysen a
        join jobs j on j.id = a.job_id
   left join job_einbettungen e on e.job_id = j.id and e.modell = ${modell.name}
       where a.status = 'fertig' and e.id is null
    order by a.beendet_am desc
       limit ${grenze}`),
  )) as unknown as {
    rows: { id: string; title: string; core_tasks: string[]; kldb: string | null; anforderungen: string[] }[];
  };

  if (offen.rows.length === 0) return lauf;

  const texte: Jobtext[] = offen.rows.map((z) => ({
    jobId: z.id,
    text: jobEinbettungstext({
      titel: z.title,
      aufgaben: z.core_tasks ?? [],
      anforderungen: z.anforderungen ?? [],
      berufseinordnung: z.kldb,
    }),
  }));

  return jobEinbettungenSichern(db, texte, modell, einbetter);
}
