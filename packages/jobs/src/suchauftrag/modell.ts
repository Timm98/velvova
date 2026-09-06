import { sql } from "drizzle-orm";
import { schema, withSystem, type Database } from "@paycheck/db";

/**
 * Modellaufrufe des Suchauftrags — mit Grenze und Protokoll.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Aufruf hereingereicht wird
 * ══════════════════════════════════════════════════════════════
 *
 * Damit dieses Paket kein Anbieter-SDK kennt. Der Hintergrunddienst
 * läuft als Skript; ein statischer Import des OpenAI-Pakets zöge es
 * auch in jede Testumgebung, die nie ein Modell braucht.
 *
 * Und: Ein Test kann so nie versehentlich einen kostenpflichtigen
 * Aufruf auslösen. Ohne `rufer` läuft alles auf dem
 * deterministischen Weg weiter.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Grenze vor dem Aufruf steht und nicht danach
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Rechnung merkt man erst am Monatsende. Ein Dienst, der
 * stündlich läuft und pro Person mehrere Aufrufe macht, kann bis dahin
 * viel Geld ausgegeben haben — für Mails, die niemand liest.
 *
 * Deshalb zwei Grenzen: eine je Person und Tag, eine für alle
 * zusammen. Wird eine erreicht, wird nicht gerechnet und nicht
 * geraten — es läuft der deterministische Weg, und der Zustand steht
 * im Protokoll.
 */

/**
 * Startwerte, in Cent. Produktentscheidungen, keine Messwerte.
 *
 * 50 Cent je Person und Tag reichen für eine Zusammenfassung mit
 * Begründungen und lassen keinen Spielraum für eine Schleife.
 */
export const BUDGET = {
  proNutzerTagCent: 50,
  gesamtTagCent: 2000,
} as const;

/** Wie viele Kandidaten höchstens vertieft ans Modell gehen. */
export const BELEGE_JE_LAUF = 5;

export interface Modellnutzung {
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
  provider: string;
  latencyMs: number;
  /** Was der Aufruf gekostet hat, in Cent. `null`, wenn unbekannt. */
  kostenCent?: number | null;
}

export interface Modellergebnis<T> {
  data: T;
  usage: Modellnutzung;
}

/**
 * Der Aufruf selbst — vom Aufrufer mitgebracht.
 *
 * `schema` ist ein Zod-Schema; das Paket kennt seinen Typ nicht und
 * braucht ihn nicht: Was zurückkommt, wird ohnehin noch einmal gegen
 * die erlaubten Kennungen geprüft.
 */
export type Modellrufer = <T>(auftrag: {
  system: string;
  eingabe: string;
  schema: unknown;
  schemaName: string;
  tier: "interactive" | "deep" | "fast";
}) => Promise<Modellergebnis<T>>;

export type Budgetbefund =
  | { ok: true; verbrauchtCent: number }
  | { ok: false; grund: "nutzer_budget" | "gesamt_budget"; verbrauchtCent: number };

/**
 * Ob heute noch gerechnet werden darf.
 *
 * Gezählt wird über `ai_runs` — dieselbe Tabelle, in die jeder Aufruf
 * schreibt. Ein eigener Zähler daneben liefe irgendwann auseinander,
 * und dann stimmt entweder die Grenze nicht oder die Rechnung.
 */
export async function budgetPruefen(
  db: Database,
  userId: string | null,
  jetzt = new Date(),
): Promise<Budgetbefund> {
  const seit = new Date(jetzt.getTime() - 86_400_000);
  return withSystem(db, async (tx) => {
    const zeilen = (await tx.execute(sql`
      select
        coalesce(sum(cost_eur_cents) filter (where user_id = ${userId}::uuid), 0)::int as nutzer,
        coalesce(sum(cost_eur_cents), 0)::int as gesamt
      from ai_runs
      where created_at >= ${seit.toISOString()} and purpose like 'suchauftrag%'`)) as unknown as {
      rows: { nutzer: number; gesamt: number }[];
    };
    const z = zeilen.rows[0] ?? { nutzer: 0, gesamt: 0 };
    if (z.gesamt >= BUDGET.gesamtTagCent)
      return { ok: false as const, grund: "gesamt_budget" as const, verbrauchtCent: z.gesamt };
    if (userId !== null && z.nutzer >= BUDGET.proNutzerTagCent)
      return { ok: false as const, grund: "nutzer_budget" as const, verbrauchtCent: z.nutzer };
    return { ok: true as const, verbrauchtCent: z.nutzer };
  });
}

export type Laufstatus = "ok" | "failed" | "timeout" | "budget_exceeded" | "refused";

/**
 * Einen Aufruf protokollieren.
 *
 * ── Was hier NICHT hineingeht ─────────────────────────────────
 *
 * Der Inhalt der Anfrage. Kein Profil, kein Anzeigentext, keine
 * Begründung im Wortlaut. Was gespeichert wird, sind Kennzahlen:
 * Zweck, Modell, Tokens, Kosten, Dauer, Status.
 *
 * Ein Betriebsprotokoll, in dem Karrieregespräche stehen, ist ein
 * zweiter Ort, an dem sie durchsickern können — und niemand denkt bei
 * einem Protokoll daran.
 */
export async function laufProtokollieren(
  db: Database,
  eintrag: {
    userId: string | null;
    zweck: string;
    promptKey: string;
    promptVersion: string;
    status: Laufstatus;
    usage?: Modellnutzung | null;
    fehler?: string | null;
    schemaGueltig?: boolean | null;
  },
): Promise<void> {
  try {
    await withSystem(db, (tx) =>
      tx.insert(schema.aiRuns).values({
        userId: eintrag.userId,
        purpose: eintrag.zweck,
        taskType: eintrag.promptKey,
        tier: null,
        provider: eintrag.usage?.provider ?? "keiner",
        model: eintrag.usage?.model ?? "keines",
        promptKey: eintrag.promptKey,
        promptVersion: eintrag.promptVersion,
        status: eintrag.status,
        inputTokens: eintrag.usage?.inputTokens ?? null,
        outputTokens: eintrag.usage?.outputTokens ?? null,
        costEurCents: eintrag.usage?.kostenCent ?? null,
        latencyMs: eintrag.usage?.latencyMs ?? null,
        errorMessage: eintrag.fehler?.slice(0, 400) ?? null,
        structuredOutputValid: eintrag.schemaGueltig ?? null,
      }),
    );
  } catch (fehler) {
    /*
     * Ein Protokolleintrag, der scheitert, darf den Lauf nicht
     * mitnehmen. Die Arbeit ist getan; der fehlende Eintrag ist ein
     * Verlust an Nachvollziehbarkeit, kein Grund, das Ergebnis
     * wegzuwerfen.
     */
    console.warn("[suchauftrag] Modellprotokoll nicht geschrieben:", String(fehler).slice(0, 160));
  }
}

export type Aufrufbefund<T> =
  | { ok: true; data: T }
  | { ok: false; grund: "kein_modell" | "budget" | "fehler" | "leer" };

/**
 * Ein Modellaufruf mit Grenze, Protokoll und Rückfallweg.
 *
 * Der Rückfallweg ist nicht der Ausnahmefall, sondern der
 * Normalzustand: Ohne eingerichtetes Modell, ohne Budget und bei
 * jedem Fehler läuft der deterministische Weg. Er ist nüchterner und
 * stimmt.
 */
export async function mitGrenze<T>(
  db: Database,
  eingabe: {
    userId: string | null;
    zweck: string;
    promptKey: string;
    promptVersion: string;
    system: string;
    text: string;
    schema: unknown;
    schemaName: string;
    tier?: "interactive" | "deep" | "fast";
    /** Fehlt er, wird nichts aufgerufen — und nichts protokolliert. */
    rufer?: Modellrufer;
    /** Wenn `false`, wird gar nicht erst gerufen. */
    lohntSich: boolean;
  },
): Promise<Aufrufbefund<T>> {
  if (!eingabe.rufer) return { ok: false, grund: "kein_modell" };

  /*
   * Kein Aufruf ohne Gegenstand.
   *
   * Der Auftrag ist an dieser Stelle ausdrücklich: keinen
   * kostenpflichtigen Modellaufruf bei null Kandidaten erzwingen. Es
   * gibt nichts zu formulieren, wenn nichts ausgewählt wurde.
   */
  if (!eingabe.lohntSich) return { ok: false, grund: "leer" };

  const budget = await budgetPruefen(db, eingabe.userId);
  if (!budget.ok) {
    await laufProtokollieren(db, {
      userId: eingabe.userId,
      zweck: eingabe.zweck,
      promptKey: eingabe.promptKey,
      promptVersion: eingabe.promptVersion,
      status: "budget_exceeded",
      fehler: `${budget.grund}: ${budget.verbrauchtCent} Cent in 24 h`,
    });
    return { ok: false, grund: "budget" };
  }

  try {
    const ergebnis = await eingabe.rufer<T>({
      system: eingabe.system,
      eingabe: eingabe.text,
      schema: eingabe.schema,
      schemaName: eingabe.schemaName,
      tier: eingabe.tier ?? "fast",
    });
    await laufProtokollieren(db, {
      userId: eingabe.userId,
      zweck: eingabe.zweck,
      promptKey: eingabe.promptKey,
      promptVersion: eingabe.promptVersion,
      status: "ok",
      usage: ergebnis.usage,
      schemaGueltig: true,
    });
    return { ok: true, data: ergebnis.data };
  } catch (fehler) {
    /*
     * Ein Modellfehler ist kein Grund, nichts zu schicken.
     *
     * Er wird protokolliert, und der Aufrufer nimmt seinen
     * deterministischen Text. Die Person für einen technischen Fehler
     * zu bestrafen — indem sie ihre Zusammenfassung nicht bekommt —
     * wäre die falsche Reihenfolge.
     */
    await laufProtokollieren(db, {
      userId: eingabe.userId,
      zweck: eingabe.zweck,
      promptKey: eingabe.promptKey,
      promptVersion: eingabe.promptVersion,
      status: "failed",
      fehler: String(fehler),
      schemaGueltig: false,
    });
    return { ok: false, grund: "fehler" };
  }
}
