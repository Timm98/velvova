"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { selectProvider } from "@paycheck/ai";
import {
  HOECHSTDAUER,
  aufgabePruefen,
  probeBewerten,
  wirdFestgehalten,
  zeugnisPruefen,
  type Aufgabe,
  type Pruefpunkt,
} from "@paycheck/domain";
import { requireUser } from "@/lib/auth";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Arbeitsprobe — erzeugen, bewerten, bezeugen
 * ══════════════════════════════════════════════════════════════════
 *
 * Teilbare Kompetenznachweise erhöhten in einem randomisierten
 * Feldexperiment die Beschäftigung um 5,2 Prozentpunkte; privates
 * Feedback bewirkte nichts. Diese Datei ist der Weg von einer
 * Zielstelle zu einem Zeugnis, das ein Mensch weitergeben kann.
 *
 * ── Was hier ehrlich gesagt werden muss ─────────────────────────
 *
 * Diese Probe läuft unbeaufsichtigt. Niemand sieht zu, die Zeit wird
 * nicht erzwungen, und wer will, kann nachschlagen oder jemanden
 * fragen.
 *
 * Das ist keine Nachlässigkeit, sondern die Bauart — und deshalb steht
 * es im Zeugnis. `bedingungen` ist genau dafür ein Pflichtfeld: Ein
 * Leser, der „unbeaufsichtigt, ohne Zeitkontrolle" liest, ordnet das
 * Ergebnis richtig ein. Eines, das so tut, als sei geprüft worden, ist
 * eine Fälschung.
 *
 * Ein beaufsichtigtes Verfahren wäre stärker. Es ist auch teurer und
 * setzt einen Arbeitgeber voraus, der zusieht — beides gibt es noch
 * nicht. Bis dahin ist ein ehrlich gekennzeichnetes Ergebnis mehr wert
 * als keines.
 */

const AufgabeSchema = z.object({
  taetigkeit: z.string().max(120),
  text: z.string().max(1200),
  hilfsmittel: z.array(z.string().max(80)).max(6),
  minuten: z.number().int().min(10).max(HOECHSTDAUER),
  pruefpunkte: z
    .array(z.object({ was: z.string().max(160), erwartet: z.string().max(160) }))
    .min(3)
    .max(6),
});

const AUFGABE_ANWEISUNG = `Du entwirfst eine kurze Arbeitsprobe aus einer echten Stellenanzeige.

Die Aufgabe muss:
- eine Tätigkeit prüfen, die in der Anzeige tatsächlich verlangt wird
- konkretes Material enthalten, an dem gearbeitet wird (Zahlen, Sätze, ein Fall) — kein "beschreibe, wie du vorgehen würdest"
- in der genannten Zeit lösbar sein
- eine eindeutige Lösung haben

PRÜFPUNKTE sind der wichtigste Teil. Jeder benennt etwas, das in einer richtigen Lösung vorkommen MUSS, weil es in der Sache liegt — nicht, weil es gut klingt. Drei bis sechs davon.

Beispiel für eine gute Aufgabe:
  "Vier Förderanträge liegen vor [mit konkreten Angaben]. Halte je Antrag fest, was fehlt oder sich widerspricht."
  Prüfpunkte: "Fehlende Unterschrift in Antrag 2", "Summen in Antrag 4 widersprechen sich um 1.200 €", ...

Beispiel für eine schlechte Aufgabe:
  "Erkläre, wie du Förderanträge prüfen würdest." — nicht bewertbar ohne zu urteilen.

Nenne bei den Hilfsmitteln, was benutzt werden darf. Sie müssen zur späteren Arbeit passen: Wer im Beruf nachschlägt, soll nicht ohne geprüft werden.`;

const BewertungSchema = z.object({
  /** Je Prüfpunkt in derselben Reihenfolge: getroffen oder nicht. */
  getroffen: z.array(z.boolean()),
  /** Was auffiel, als Beobachtung. Kein Urteil über den Menschen. */
  anmerkungen: z.array(z.string().max(200)).max(3),
});

const BEWERTUNG_ANWEISUNG = `Du prüfst eine eingereichte Lösung gegen eine Liste von Prüfpunkten.

Für jeden Prüfpunkt: Hat die Lösung ihn getroffen, ja oder nein? Gib die Antworten in derselben Reihenfolge zurück wie die Prüfpunkte.

Sei genau, nicht wohlwollend. Ein Prüfpunkt gilt als getroffen, wenn die Lösung die Sache benennt — nicht, wenn sie in die Nähe kommt. Andere Worte sind in Ordnung, andere Aussagen nicht.

ANMERKUNGEN beschreiben, was auffiel: "Begründung zu Antrag 4 war unvollständig". Kein Urteil über den Menschen, keine Wertung, kein "gut" oder "schwach".`;

export type Aufgabenlage =
  | { art: "aufgabe"; aufgabe: Aufgabe; stellentitel: string }
  | { art: "kein_modell" }
  | { art: "stelle_unbekannt" }
  | { art: "untauglich"; grund: string };

/**
 * Eine Arbeitsprobe aus einer Stelle ableiten.
 *
 * Das Modell entwirft, `aufgabePruefen` entscheidet. Eine Aufgabe ohne
 * Prüfpunkte oder über neunzig Minuten kommt nicht durch — die erste
 * wäre nicht bewertbar, die zweite unbezahlte Arbeit.
 */
export async function aufgabeStellen(jobId: string): Promise<Aufgabenlage> {
  await requireUser();
  const db = await getDb();

  const [stelle] = await db
    .select({
      titel: schema.jobs.title,
      anforderungen: sql<
        string[]
      >`array_agg(${schema.jobRequirements.text}) filter (where ${schema.jobRequirements.text} is not null)`,
    })
    .from(schema.jobs)
    .leftJoin(schema.jobRequirements, eq(schema.jobRequirements.jobId, schema.jobs.id))
    .where(eq(schema.jobs.id, jobId))
    .groupBy(schema.jobs.id, schema.jobs.title)
    .limit(1);

  if (!stelle) return { art: "stelle_unbekannt" };

  let provider;
  try {
    provider = await selectProvider();
  } catch {
    return { art: "kein_modell" };
  }

  let antwort;
  try {
    antwort = await provider.structuredGenerate({
      system: AUFGABE_ANWEISUNG,
      messages: [
        {
          role: "user",
          content:
            `STELLE: ${stelle.titel}\n\nWAS VERLANGT WIRD:\n` +
            (stelle.anforderungen ?? [])
              .slice(0, 10)
              .map((a) => `- ${a}`)
              .join("\n"),
        },
      ],
      schema: AufgabeSchema,
      schemaName: "bruecke_aufgabe",
      /* Eine Aufgabe mit eindeutiger Lösung zu entwerfen ist der
         schwerere Teil — ein schnelles Modell liefert hier „beschreibe,
         wie du vorgehen würdest", und das ist nicht bewertbar. */
      tier: "deep",
    });
  } catch {
    return { art: "kein_modell" };
  }

  const aufgabe: Aufgabe = { ...antwort.data, herkunft: "aus_anzeige" };
  const befund = aufgabePruefen(aufgabe);
  if (befund.art === "untauglich") return { art: "untauglich", grund: befund.grund };

  return { art: "aufgabe", aufgabe, stellentitel: stelle.titel };
}

export type Probenlage =
  | { art: "bestanden"; ergebnis: string; getroffen: number; gesamt: number; nachweisId: string | null }
  | { art: "nicht_bestanden"; getroffen: number; gesamt: number; verfehlt: string[] }
  | { art: "nicht_bewertbar"; grund: string }
  | { art: "kein_modell" };

/**
 * Eine Lösung bewerten und, wenn sie trägt, das Zeugnis ausstellen.
 *
 * ── Warum die Prüfpunkte mitkommen ──────────────────────────────
 *
 * Sie stehen im Formular und werden mitgeschickt. Wer sie unterwegs
 * ändert, stellt sich ein Zeugnis über eine Tätigkeit aus, die er
 * nicht kann — und das fällt im ersten Gespräch auf, in dem jemand
 * danach fragt. Der Schaden liegt bei ihm.
 *
 * Sicher wäre eine gespeicherte Aufgabe. Sie ist der nächste Schritt;
 * für die Frage, ob dieses Verfahren überhaupt trägt, ist sie nicht
 * nötig.
 */
export async function loesungPruefen(
  jobId: string,
  taetigkeit: string,
  aufgabentext: string,
  hilfsmittel: string[],
  minuten: number,
  pruefpunkte: Pruefpunkt[],
  loesung: string,
): Promise<Probenlage> {
  const user = await requireUser();

  if (pruefpunkte.length === 0) {
    return { art: "nicht_bewertbar", grund: "Zu dieser Aufgabe fehlen die Prüfpunkte." };
  }
  if (loesung.trim().length < 20) {
    return { art: "nicht_bewertbar", grund: "Die Lösung ist zu kurz, um sie zu prüfen." };
  }

  let provider;
  try {
    provider = await selectProvider();
  } catch {
    return { art: "kein_modell" };
  }

  let antwort;
  try {
    antwort = await provider.structuredGenerate({
      system: BEWERTUNG_ANWEISUNG,
      messages: [
        {
          role: "user",
          content:
            `AUFGABE:\n${aufgabentext}\n\nPRÜFPUNKTE:\n` +
            pruefpunkte.map((p, i) => `${i + 1}. ${p.was} — erwartet: ${p.erwartet}`).join("\n") +
            `\n\nEINGEREICHTE LÖSUNG:\n${loesung.slice(0, 6000)}`,
        },
      ],
      schema: BewertungSchema,
      schemaName: "bruecke_bewertung",
      tier: "deep",
    });
  } catch {
    return { art: "kein_modell" };
  }

  const ausgang = probeBewerten(pruefpunkte, antwort.data);

  if (ausgang.art === "nicht_bewertbar") {
    return {
      art: "nicht_bewertbar",
      grund:
        ausgang.grund === "keine_pruefpunkte"
          ? "Zu dieser Aufgabe fehlen die Prüfpunkte."
          : "Die Prüfung hat nicht zu jedem Punkt etwas gesagt. Lieber kein Ergebnis als ein geratenes.",
    };
  }

  if (ausgang.art === "nicht_bestanden") {
    /*
     * Keine Spur. Kein Eintrag, keine Zählung.
     *
     * Ein System, in dem Üben aktenkundig wird, ist ein System, in dem
     * niemand übt. `wirdFestgehalten` sagt es, und hier steht nichts,
     * was es umgehen könnte.
     */
    void wirdFestgehalten("nicht_bestanden");
    return {
      art: "nicht_bestanden",
      getroffen: ausgang.getroffen,
      gesamt: ausgang.gesamt,
      verfehlt: pruefpunkte.filter((_, i) => !antwort.data.getroffen[i]).map((p) => p.was),
    };
  }

  /*
   * Die Bedingungen sagen, wie geprüft wurde — und dass niemand
   * zugesehen hat.
   *
   * Ein Zeugnis, das so tut, als sei beaufsichtigt worden, ist eine
   * Fälschung. Eines, das die Bauart nennt, lässt sich einordnen — und
   * genau dafür ist `bedingungen` ein Pflichtfeld.
   */
  const bedingungen =
    `${minuten} Minuten vorgesehen, ` +
    (hilfsmittel.length > 0 ? `erlaubt: ${hilfsmittel.join(", ")}` : "ohne Hilfsmittel") +
    ", unbeaufsichtigt und ohne Zeitkontrolle bearbeitet";

  const jetzt = new Date();
  const zeugnis = {
    taetigkeit,
    aufgabe: aufgabentext.slice(0, 400),
    bedingungen,
    ergebnis: ausgang.ergebnistext,
    aussteller: "Velvova",
    ausgestelltAm: jetzt,
    /* Zwei Jahre. Was jemand vor sechs Jahren konnte, sagt über heute
       wenig — und ein Nachweis ohne Ende wird zur Behauptung. */
    gueltigBis: new Date(jetzt.getTime() + 2 * 365 * 24 * 3600 * 1000),
  };

  const geprueft = zeugnisPruefen(zeugnis);
  if (geprueft.art !== "gueltig") {
    /*
     * Die Bewertung hat etwas geschrieben, das kein Zeugnis werden
     * darf. Das Ergebnis bleibt trotzdem stehen — nur eben ohne
     * Nachweis, und der Mensch erfährt warum.
     */
    console.error("[probe] Zeugnis abgelehnt:", JSON.stringify(geprueft));
    return {
      art: "bestanden",
      ergebnis: ausgang.ergebnistext,
      getroffen: ausgang.getroffen,
      gesamt: ausgang.gesamt,
      nachweisId: null,
    };
  }

  let nachweisId: string | null = null;
  try {
    const db = await getDb();
    /*
     * Erst suchen, dann schreiben.
     *
     * Der Eindeutigkeitsindex steht auf `lower(taetigkeit)` — einen
     * Ausdrucksindex kann `onConflictDoUpdate` nicht adressieren. Der
     * explizite Weg ist hier ohnehin klarer: Ein zweites Zeugnis über
     * dieselbe Tätigkeit ersetzt das erste, statt danebenzustehen.
     * Zwei nebeneinander laden dazu ein, sich das günstigere
     * auszusuchen.
     */
    const zeile = await withUser(db, user.id, async (tx) => {
      const [vorhanden] = await tx
        .select({ id: schema.nachweise.id })
        .from(schema.nachweise)
        .where(
          and(
            eq(schema.nachweise.userId, user.id),
            sql`lower(${schema.nachweise.taetigkeit}) = lower(${zeugnis.taetigkeit})`,
          ),
        )
        .limit(1);

      if (vorhanden) {
        await tx
          .update(schema.nachweise)
          .set({
            aufgabe: zeugnis.aufgabe,
            bedingungen: zeugnis.bedingungen,
            ergebnis: zeugnis.ergebnis,
            ausgestelltAm: zeugnis.ausgestelltAm,
            gueltigBis: zeugnis.gueltigBis,
            jobId,
          })
          .where(eq(schema.nachweise.id, vorhanden.id));
        return vorhanden;
      }

      const [neu] = await tx
        .insert(schema.nachweise)
        .values({ userId: user.id, jobId, ...zeugnis })
        .returning({ id: schema.nachweise.id });
      return neu;
    });
    nachweisId = zeile?.id ?? null;
  } catch (fehler) {
    console.error(
      "[probe] Nachweis nicht gespeichert:",
      fehler instanceof Error ? fehler.message : String(fehler),
    );
  }

  return {
    art: "bestanden",
    ergebnis: ausgang.ergebnistext,
    getroffen: ausgang.getroffen,
    gesamt: ausgang.gesamt,
    nachweisId,
  };
}

/** Die Nachweise eines Menschen, für seine Übersicht. */
export async function meineNachweise() {
  const user = await requireUser();
  const db = await getDb();
  return withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.nachweise.id,
        taetigkeit: schema.nachweise.taetigkeit,
        ergebnis: schema.nachweise.ergebnis,
        bedingungen: schema.nachweise.bedingungen,
        ausgestelltAm: schema.nachweise.ausgestelltAm,
        gueltigBis: schema.nachweise.gueltigBis,
      })
      .from(schema.nachweise)
      .where(eq(schema.nachweise.userId, user.id))
      .orderBy(schema.nachweise.ausgestelltAm),
  );
}
