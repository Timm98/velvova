import "server-only";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { selectProvider } from "@paycheck/ai";
import {
  uebersetzungPruefen,
  verstossErklaeren,
  type Uebersetzung,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Den Verlauf in die Sprache der Zielstelle bringen
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine Pflegefachkraft kann „Fachleitung Sicherheit und Ordnung" für
 * 61.653 €. Sie bewirbt sich nie darauf — nicht weil sie es nicht
 * könnte, sondern weil in ihrem Lebenslauf „Hygienebeauftragte der
 * Station" steht und niemand in einer Verwaltung dieses Wort liest.
 *
 * Diese Datei erzeugt die andere Fassung. `berufssprache.ts` prüft
 * sie. Die Arbeitsteilung ist Absicht: Das Modell formuliert, die
 * Domäne entscheidet, ob es noch eine Übersetzung ist.
 *
 * ── Warum jede Zeile ihren Beleg mitbringt ──────────────────────
 *
 * Die vorhandene Belegprüfung in `packages/documents` sucht zu jedem
 * Satz einen Beleg über Wortüberlappung. Eine Übersetzung besteht das
 * nie — sie benutzt absichtlich andere Wörter. Deshalb wird der Beleg
 * hier nicht gesucht, sondern mitgeführt: Das Modell bekommt jede
 * Station mit ihrer Kennung und muss sie zurückgeben.
 *
 * Eine Fassung ohne Kennung wird verworfen. Sie könnte alles
 * beschreiben, auch etwas, das nie stattgefunden hat.
 */

/** Wie viele Stationen höchstens übersetzt werden. */
const HOECHSTENS = 8;

const FassungSchema = z.object({
  zeilen: z
    .array(
      z.object({
        /** Die Kennung der Station, aus der die Fassung stammt. */
        belegId: z.string(),
        /** Wie die Zielbranche dieselbe Arbeit nennt. */
        fassung: z.string().max(220),
      }),
    )
    .max(HOECHSTENS),
});

const ANWEISUNG = `Du übersetzt Stationen eines Lebenslaufs in die Sprache einer anderen Branche.

Dieselbe Arbeit, andere Wörter. Beispiel:
  "Hygienebeauftragte der Station"
  → "Ordnungsverantwortung mit gesetzlicher Prüfpflicht, jährlich extern auditiert"

REGELN, die ausnahmslos gelten:
- Erfinde nichts. Keine Zahl, die nicht in der Station steht.
- Keine Qualifikation, kein Abschluss, kein Zertifikat, das dort nicht steht.
- Keine Führungsrolle, die dort nicht steht. "Vertretung der Leitung" ist nicht "Leitung".
- Keine Wertungen: kein "hervorragend", "umfassend", "langjährig", "maßgeblich".
- Findest du für eine Station keine Entsprechung in der Zielbranche, lass sie weg. Eine fehlende Zeile ist besser als eine erfundene.

Gib zu jeder Fassung die belegId der Station zurück, aus der sie stammt.`;

export interface Zeile {
  /** Wie es im Lebenslauf steht. */
  original: string;
  /** Wie die Zielbranche es liest. */
  fassung: string;
}

export interface Verworfen {
  original: string;
  /** Was das Modell daraus machen wollte. */
  versuch: string;
  /** Warum es nicht durchging — in Worten für den Menschen. */
  grund: string;
}

export type Uebersetzungslage =
  | { art: "kein_profil" }
  | { art: "kein_modell" }
  | { art: "stelle_unbekannt" }
  | {
      art: "fassung";
      stellentitel: string;
      firma: string;
      zeilen: Zeile[];
      /*
       * Was nicht durchging, und warum.
       *
       * Sichtbar, nicht verschwiegen: Eine Zeile, die fehlt, sieht
       * für den Menschen aus wie ein Fehler des Produkts. Wer den
       * Grund liest, sieht stattdessen eine Grenze, die eingehalten
       * wurde — und das ist genau das, was das Ganze glaubwürdig
       * macht.
       */
      verworfen: Verworfen[];
    };

/** Die Stationen mit Kennung — anders als beim Inventar wird sie gebraucht. */
async function stationenLaden(
  userId: string,
): Promise<{ id: string; text: string }[]> {
  const db = await getDb();
  return withUser(db, userId, async (tx) => {
    const stationen = await tx
      .select({
        id: schema.experiences.id,
        titel: schema.experiences.title,
        firma: schema.experiences.organisation,
        kurz: schema.experiences.summary,
      })
      .from(schema.experiences)
      .where(eq(schema.experiences.userId, userId))
      .limit(HOECHSTENS);

    const belege = await tx
      .select({ id: schema.evidenceItems.id, aussage: schema.evidenceItems.statement })
      .from(schema.evidenceItems)
      .where(
        and(eq(schema.evidenceItems.userId, userId), eq(schema.evidenceItems.userConfirmed, true)),
      )
      .limit(HOECHSTENS);

    return [
      ...stationen.map((s) => ({
        id: s.id,
        text: `${s.titel}${s.firma ? ` bei ${s.firma}` : ""}${s.kurz ? ` — ${s.kurz}` : ""}`,
      })),
      ...belege.map((b) => ({ id: b.id, text: b.aussage })),
    ].slice(0, HOECHSTENS);
  });
}

/**
 * Den Verlauf für eine bestimmte Stelle übersetzen.
 *
 * Wirft nicht. Was nicht geht, wird benannt — eine Seite, die statt
 * der Fassung einen Fehler zeigt, hilft niemandem.
 */
export async function uebersetzen(
  userId: string,
  jobId: string,
): Promise<Uebersetzungslage> {
  const stationen = await stationenLaden(userId);
  if (stationen.length === 0) return { art: "kein_profil" };

  const db = await getDb();
  const [stelle] = await db
    .select({
      titel: schema.jobs.title,
      firma: schema.companies.name,
      anforderungen: sql<
        string[]
      >`array_agg(${schema.jobRequirements.text}) filter (where ${schema.jobRequirements.text} is not null)`,
    })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .leftJoin(schema.jobRequirements, eq(schema.jobRequirements.jobId, schema.jobs.id))
    .where(eq(schema.jobs.id, jobId))
    .groupBy(schema.jobs.id, schema.jobs.title, schema.companies.name)
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
      system: ANWEISUNG,
      messages: [
        {
          role: "user",
          content:
            `ZIELSTELLE: ${stelle.titel}\n\nWAS DORT VERLANGT WIRD:\n` +
            (stelle.anforderungen ?? [])
              .slice(0, 10)
              .map((a) => `- ${a}`)
              .join("\n") +
            `\n\nSTATIONEN DER PERSON:\n` +
            stationen.map((s) => `[${s.id}] ${s.text}`).join("\n"),
        },
      ],
      schema: FassungSchema,
      schemaName: "bruecke_uebersetzung",
      /*
       * `deep`, nicht `fast`.
       *
       * Beim Inventar geht es um eine Einstufung in sechs Stufen —
       * das kann ein schnelles Modell. Hier geht es darum, denselben
       * Sachverhalt in einer anderen Fachsprache zu treffen, ohne
       * etwas hinzuzufügen. Ein schwaches Modell schmückt an genau
       * dieser Stelle aus, und jede Ausschmückung fällt anschliessend
       * durch die Prüfung — teurer Aufruf für eine leere Liste.
       */
      tier: "deep",
    });
  } catch {
    return { art: "kein_modell" };
  }

  const nachId = new Map(stationen.map((s) => [s.id, s.text]));
  const zeilen: Zeile[] = [];
  const verworfen: Verworfen[] = [];

  for (const z of antwort.data.zeilen) {
    const original = nachId.get(z.belegId);
    /*
     * Eine Fassung ohne bekannte Station wird verworfen, nicht
     * zugeordnet. Sie könnte alles beschreiben — auch etwas, das nie
     * stattgefunden hat.
     */
    if (!original) continue;

    const u: Uebersetzung = { original, fassung: z.fassung, belegId: z.belegId };
    const befund = uebersetzungPruefen(u);

    if (befund.art === "gueltig") {
      zeilen.push({ original, fassung: z.fassung });
      continue;
    }

    if (befund.art === "erfunden") {
      verworfen.push({
        original,
        versuch: z.fassung,
        grund: befund.verstoesse.map(verstossErklaeren).join(" "),
      });
    }
    /* `unbrauchbar` wird still übergangen: „unverändert" oder „kein
       Beleg" sind Fehler der Erzeugung, nicht Grenzen, die dem
       Menschen etwas sagen. */
  }

  return {
    art: "fassung",
    stellentitel: stelle.titel,
    firma: stelle.firma,
    zeilen,
    verworfen,
  };
}
