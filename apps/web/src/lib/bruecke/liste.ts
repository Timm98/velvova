import "server-only";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { selectProvider } from "@paycheck/ai";
import {
  erreichbarkeit,
  istReglementiert,
  kurzscheinFuer,
  lohntSich,
  type Erreichbarkeit,
  type Huerde,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Brücke — die Datenseite
 * ══════════════════════════════════════════════════════════════════
 *
 * Beantwortet die eine Frage: Welche Stellen könnte dieser Mensch
 * heute antreten, die er nie in Betracht gezogen hätte?
 *
 * Gemessen am 10.9.2026 für eine Pflegefachkraft mit neun Jahren
 * Erfahrung: 8 % aller geprüften Anzeigen sind erreichbar und zahlen
 * mindestens so viel wie ihr jetziger Job. Darunter Fachleitung
 * Sicherheit und Ordnung für 61.653 € — sofort antretbar.
 *
 * ── Warum live gerechnet und nicht gespeichert ──────────────────
 *
 * Eine Ergebnistabelle wäre schneller und bräuchte eine Migration.
 * Solange niemand weiss, ob Menschen diese Liste überhaupt glauben,
 * ist ein Schema dafür verfrüht: erst die Frage beantworten, dann die
 * Tabelle bauen.
 *
 * Der Preis ist die Grenze unten. Vierzig Anzeigen sind genug, um die
 * Frage zu beantworten, und wenig genug, dass ein Seitenaufruf
 * Sekunden dauert statt Minuten.
 *
 * ── Wer entscheidet was ─────────────────────────────────────────
 *
 * Das Modell liest die Anforderungen und schätzt, ob die Person sie
 * erfüllt. Die Domäne entscheidet, ob die Stelle gezeigt werden darf.
 * `REGLEMENTIERT` schlägt jede Modellantwort — ein Modell ist
 * überredbar, ein Gesetz nicht.
 */

/** Wie viele Anzeigen je Aufruf geprüft werden. */
export const GEPRUEFT = 40;

const UrteilSchema = z.object({
  huerde: z.enum(["erfuellt", "einarbeitung", "kurzschein", "abschluss", "erfahrung", "gesetzlich"]),
  /** Was konkret fehlt. Leer, wenn nichts fehlt. */
  fehlt: z.string().max(120),
  /** Warum die Person es kann — aus ihrem Verlauf, nicht erfunden. */
  weil: z.string().max(200),
});

const ANWEISUNG = `Du prüfst, ob eine Person eine Stelle HEUTE antreten könnte — ohne Umschulung, ohne neuen Abschluss.

Stufe die grösste Hürde ein:
- "erfuellt": Die Person bringt alles mit.
- "einarbeitung": Es fehlt Konkretes, das in wenigen Wochen im Betrieb gelernt wird (ein Programm, eine Branche, ein Verfahren).
- "kurzschein": Es fehlt ein Schein oder Kurs, der Tage dauert (Staplerschein, Ersthelfer, Führungszeugnis).
- "abschluss": Die Anzeige verlangt einen Abschluss, den die Person nicht hat.
- "erfahrung": Es fehlen Jahre in einem Feld, das die Person nicht kennt.
- "gesetzlich": Die Stelle verlangt eine gesetzlich vorgeschriebene Qualifikation (Approbation, Meisterbrief, staatliche Anerkennung).

Sei streng bei "erfuellt" und "einarbeitung". Im Zweifel die schwerere Stufe.

"weil": Ein Satz, warum diese Person es kann — ausschliesslich aus dem, was in ihrem Verlauf steht. Erfinde nichts. Findest du keinen Grund im Verlauf, lass es leer.`;

export interface Brueckenstelle {
  jobId: string;
  titel: string;
  firma: string;
  /** Jahresgehalt in Euro, oder null. */
  jahr: number | null;
  erreichbar: Extract<Erreichbarkeit, { art: "sofort" | "kurzschein" | "einarbeitung" }>;
  /** Warum die Person es kann. Aus ihrem Verlauf. */
  weil: string;
}

export type Brueckenlage =
  | { art: "kein_profil" }
  | { art: "kein_modell" }
  | {
      art: "liste";
      stellen: Brueckenstelle[];
      /** Wie viele Anzeigen dafür gelesen wurden. */
      geprueft: number;
      /** Das heutige Gehalt, gegen das verglichen wurde. */
      heute: number | null;
      /** Was am häufigsten im Weg stand. */
      huerden: { was: string; anzahl: number }[];
    };

/**
 * Der Verlauf, aus dem geprüft wird.
 *
 * Kein Lebenslauf als Dokument, sondern die Stationen und Belege, die
 * die Person selbst bestätigt hat. Was sie nie erzählt hat, taucht in
 * keiner Begründung auf — das ist der Unterschied zwischen einer
 * Übersetzung und einer Erfindung.
 */
async function verlaufLaden(userId: string): Promise<string> {
  const db = await getDb();
  return withUser(db, userId, async (tx) => {
    const stationen = await tx
      .select({
        titel: schema.experiences.title,
        firma: schema.experiences.organisation,
        von: schema.experiences.startedOn,
        bis: schema.experiences.endedOn,
        kurz: schema.experiences.summary,
      })
      .from(schema.experiences)
      .where(eq(schema.experiences.userId, userId))
      .limit(12);

    const belege = await tx
      .select({ aussage: schema.evidenceItems.statement })
      .from(schema.evidenceItems)
      .where(
        and(eq(schema.evidenceItems.userId, userId), eq(schema.evidenceItems.userConfirmed, true)),
      )
      .limit(40);

    return [
      ...stationen.map(
        (s) =>
          `- ${s.titel}${s.firma ? ` bei ${s.firma}` : ""}` +
          `${s.von ? ` (seit ${s.von.getFullYear()}${s.bis ? `–${s.bis.getFullYear()}` : ", laufend"})` : ""}` +
          `${s.kurz ? `: ${s.kurz}` : ""}`,
      ),
      ...belege.map((b) => `- ${b.aussage}`),
    ].join("\n");
  });
}

/**
 * Auf ein Jahresgehalt, ohne Annahmen über die Arbeitszeit.
 *
 * Stundenlöhne bleiben aussen vor: `jobs.weekly_hours` trägt bei allen
 * 120.253 deutschen Stundenlohn-Stellen den Wert 40 — auch bei den
 * 1.356 mit „Teilzeit" oder „Minijob" im Titel. Damit zu rechnen
 * schriebe Teilzeitkräften ein Vollzeitgehalt zu.
 */
function aufJahresgehalt(
  von: unknown,
  bis: unknown,
  zeitraum: string | null,
): number | null {
  const u = Number(von);
  if (!Number.isFinite(u) || u <= 0) return null;
  const o = Number(bis ?? von);
  const mitte = (u + Math.max(u, Number.isFinite(o) ? o : u)) / 2;
  if (zeitraum === "year") return Math.round(mitte);
  if (zeitraum === "month") return Math.round(mitte * 12);
  return null;
}

/**
 * Die Liste für einen Menschen.
 *
 * Wirft nicht: Eine Seite, die statt der Liste einen Fehler zeigt, ist
 * schlimmer als eine, die sagt, was ihr fehlt.
 */
export async function bruecke(userId: string, heute: number | null = null): Promise<Brueckenlage> {
  const verlauf = await verlaufLaden(userId);
  /*
   * Ohne Verlauf keine Liste — und das ist kein Fehler, sondern die
   * ehrliche Auskunft. Wer nichts erzählt hat, über den lässt sich
   * nichts sagen, und eine Liste aus dem Nichts wäre geraten.
   */
  if (verlauf.trim().length < 40) return { art: "kein_profil" };

  const db = await getDb();

  /*
   * Kandidaten: deutsche Anzeigen mit erfassten Anforderungen und
   * echter Gehaltsangabe. Ohne Gehalt lässt sich nicht sagen, ob eine
   * Stelle ein Aufstieg oder ein Abstieg wäre — und eine Liste, die
   * Abstiege enthält, ist eine Beleidigung.
   */
  const kandidaten = await db
    .select({
      jobId: schema.jobs.id,
      titel: schema.jobs.title,
      firma: schema.companies.name,
      von: schema.jobs.salaryMin,
      bis: schema.jobs.salaryMax,
      zeitraum: schema.jobs.salaryPeriod,
      anforderungen: sql<
        string[]
      >`array_agg(${schema.jobRequirements.text}) filter (where ${schema.jobRequirements.text} is not null)`,
    })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .innerJoin(schema.jobRequirements, eq(schema.jobRequirements.jobId, schema.jobs.id))
    .where(
      and(
        eq(schema.jobs.country, "DE"),
        sql`${schema.jobs.salaryMin} is not null`,
        sql`${schema.jobs.salaryProvenance} in ('provider','text','employer')`,
        sql`${schema.jobs.salaryPeriod} in ('year','month')`,
      ),
    )
    .groupBy(
      schema.jobs.id,
      schema.jobs.title,
      schema.companies.name,
      schema.jobs.salaryMin,
      schema.jobs.salaryMax,
      schema.jobs.salaryPeriod,
    )
    .limit(GEPRUEFT);

  let provider;
  try {
    provider = await selectProvider();
  } catch {
    return { art: "kein_modell" };
  }

  const stellen: Brueckenstelle[] = [];
  const huerdenzaehler = new Map<string, number>();

  await Promise.all(
    kandidaten.map(async (k) => {
      /*
       * Die Härtung zuerst, vor dem Modellaufruf.
       *
       * Eine Anzeige mit gesetzlich geschützter Berufsbezeichnung im
       * Titel muss gar nicht erst geprüft werden — der Aufruf wäre
       * bezahlte Rechenzeit für ein Ergebnis, das die Domäne ohnehin
       * verwirft.
       */
      if (istReglementiert(k.titel)) return;

      const jahr = aufJahresgehalt(k.von, k.bis, k.zeitraum);
      if (!lohntSich(jahr, heute)) return;

      /* `structuredGenerate` liefert das Urteil in `data`, daneben
         Kosten und Modellpfad — die Registry führt beides mit. */
      let antwort;
      try {
        antwort = await provider.structuredGenerate({
          system: ANWEISUNG,
          messages: [
            {
              role: "user",
              content:
                `VERLAUF DER PERSON:\n${verlauf.slice(0, 2400)}\n\n` +
                `STELLE: ${k.titel}\n\nANFORDERUNGEN:\n` +
                (k.anforderungen ?? [])
                  .slice(0, 12)
                  .map((a) => `- ${a}`)
                  .join("\n"),
            },
          ],
          schema: UrteilSchema,
          schemaName: "bruecke_urteil",
          /* Eine Einstufung in sechs Stufen braucht kein Denkmodell. */
          tier: "fast",
        });
      } catch {
        return;
      }

      const urteil = antwort.data;
      const huerden: Huerde[] = [];
      if (urteil.huerde !== "erfuellt") {
        const schein = kurzscheinFuer(urteil.fehlt) ?? undefined;
        huerden.push({
          text: urteil.fehlt || urteil.huerde,
          art: schein ? "kurzschein" : urteil.huerde,
          schein,
        });
      }
      for (const a of k.anforderungen ?? []) {
        if (istReglementiert(a)) huerden.push({ text: a, art: "gesetzlich" });
      }

      const e = erreichbarkeit(k.titel, huerden);
      if (e.art === "gesperrt") {
        huerdenzaehler.set(e.grund, (huerdenzaehler.get(e.grund) ?? 0) + 1);
        return;
      }

      stellen.push({
        jobId: k.jobId,
        titel: k.titel,
        firma: k.firma,
        jahr,
        erreichbar: e,
        weil: urteil.weil.trim(),
      });
    }),
  );

  /* Das Beste zuerst — und bei gleichem Geld das, was sofort geht. */
  const rang = (s: Brueckenstelle) => (s.erreichbar.art === "sofort" ? 0 : 1);
  stellen.sort((a, b) => (b.jahr ?? 0) - (a.jahr ?? 0) || rang(a) - rang(b));

  return {
    art: "liste",
    stellen,
    geprueft: kandidaten.length,
    heute,
    huerden: [...huerdenzaehler.entries()]
      .map(([was, anzahl]) => ({ was, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl)
      .slice(0, 5),
  };
}
