import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AiProvider } from "@paycheck/ai";
import {
  anbieterFuerModell,
  anbieterMelden,
  lagebild,
  pruefrunde,
  richterlauf,
  spruchAnwenden,
  syntheseVorlage,
  teamAufstellen,
  teamLauf,
  teamWert,
  type Agentenergebnis,
  type Agentstatus,
  type Anbieter,
  type Gespraechsbefund,
  type Lage,
  type Rolle,
  type Stufe,
  type Synthesevorlage,
  type Teamplatz,
  type Vorlage,
} from "@paycheck/ai";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb, schema, withSystem } from "@paycheck/db";

/**
 * ══════════════════════════════════════════════════════════════════
 * Das Team an der Chat-Route
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Bausteine lagen fertig in `@paycheck/ai/team` und liefen
 * nirgends. Hier werden sie angeschlossen.
 *
 * ── Warum das Team nicht die Antwort schreibt ───────────────────
 *
 * Es wäre naheliegend, den Text des Teams durchzureichen. Dann
 * spräche aber nicht mehr Monday, sondern ein Ausschuss: drei
 * Blickwinkel, zusammengefügt von einem vierten Modell, ohne
 * Gedächtnis an das, was vorher besprochen wurde, ohne Werkzeuge,
 * ohne Ton.
 *
 * Deshalb liegt das Team DAVOR. Es analysiert, und was dabei
 * feststeht, geht als Material in den gewöhnlichen Antwortstrom.
 * Monday schreibt wie immer — mit Verlauf, Werkzeugen und ihrer
 * Stimme, nur auf besserer Grundlage. Das ist auch die Antwort auf
 * die Frage, wofür Monday da ist, wenn es die Modelle schon gibt:
 * Sie ist die Schicht, nicht die Modelle.
 *
 * ── Warum es standardmässig aus ist ─────────────────────────────
 *
 * Ein Lauf sind bis zu sieben Modellaufrufe statt einem. Das
 * stillschweigend einzuschalten hiesse, die Rechnung eines laufenden
 * Betriebs zu ändern, ohne dass jemand zugestimmt hat.
 * `MONDAY_TEAM_MODE_ENABLED=true` schaltet es ein, und die Grenzen
 * unten gelten auch dann.
 */

/* ══════════════════════════════════════════════════════════════════
   Was die Oberfläche erfährt — und wann
   ══════════════════════════════════════════════════════════════════ */

/**
 * Ereignisse werden gemeldet, NACHDEM etwas geschehen ist.
 *
 * Kein Fortschrittsbalken, der von einer geschätzten Dauer
 * hochzählt: Der wäre schneller als die Wirklichkeit, sobald ein
 * Modell hängt — und dann steht er bei 95 Prozent, während nichts
 * mehr passiert. Was hier gemeldet wird, ist geschehen.
 */
export type Teamereignis =
  | { art: "aufgestellt"; plaetze: number; grund: string }
  | { art: "agent"; rolle: Rolle; status: Agentstatus; dauerMs: number }
  | { art: "gegengeprueft"; urteile: number }
  | { art: "gegenpruefung_ausgefallen"; grund: string }
  | { art: "richter"; entschieden: number; befangen: boolean }
  | { art: "fertig"; gesichert: number; strittig: number; verworfen: number };

export type Melder = (ereignis: Teamereignis) => void;

/* ══════════════════════════════════════════════════════════════════
   Grenzen
   ══════════════════════════════════════════════════════════════════ */

export const TEAMBUDGET = {
  /** Höchstens so viele Cent je Nutzer und Tag für Teamläufe. */
  proNutzerTagCent: 60,
  /** Und so viele über alle Nutzer. */
  gesamtTagCent: 800,
} as const;

/** Der Zweck, unter dem Teamläufe in `ai_runs` stehen. */
const ZWECK = "monday_team";

/**
 * Ob heute noch ein Team tagen darf.
 *
 * Gezählt wird über `ai_runs`, dieselbe Tabelle wie überall — ein
 * eigener Zähler daneben liefe auseinander, und dann stimmt entweder
 * die Grenze nicht oder die Rechnung.
 *
 * Eigene Grenze statt der des Suchauftrags: Die zählt `purpose like
 * 'suchauftrag%'`, und ein Teamlauf, der das Budget der Jobsuche
 * aufbraucht, nähme einer anderen Funktion die Luft weg.
 */
export async function teamBudgetFrei(userId: string | null): Promise<boolean> {
  try {
    const db = await getDb();
    return await withSystem(db, async (tx) => {
      const zeilen = (await tx.execute(sql`
        select
          coalesce(sum(cost_eur_cents) filter (where user_id = ${userId}::uuid), 0)::int as nutzer,
          coalesce(sum(cost_eur_cents), 0)::int as gesamt
        from ai_runs
        where created_at >= now() - interval '24 hours'
          and purpose like ${`${ZWECK}%`}`)) as unknown as {
        rows: { nutzer: number; gesamt: number }[];
      };
      const z = zeilen.rows[0] ?? { nutzer: 0, gesamt: 0 };
      if (z.gesamt >= TEAMBUDGET.gesamtTagCent) return false;
      if (userId !== null && z.nutzer >= TEAMBUDGET.proNutzerTagCent) return false;
      return true;
    });
  } catch {
    /*
     * Kein Budget zu kennen heisst NEIN, nicht ja.
     *
     * Andersherum wäre der Ausfall der Zählung genau der Moment, in
     * dem die teuerste Funktion ohne Grenze läuft.
     */
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════
   Von der Gesprächstiefe zur Lage
   ══════════════════════════════════════════════════════════════════ */

const TRAGWEITE: Record<Gespraechsbefund["tiefe"], Stufe> = {
  flach: "niedrig",
  beratend: "hoch",
  entscheidung: "kritisch",
};

/**
 * Die Lage aus dem, was die Nachricht hergibt.
 *
 * Ausdrücklich ohne Modellaufruf. Ein Modell zu fragen, wie schwer
 * die eigene Aufgabe ist, verdoppelt die Wartezeit jeder Nachricht,
 * um zu klären, welcher Aufruf folgt — und die Antwort wäre eine
 * Selbsteinschätzung, also das schwächste verfügbare Signal.
 *
 * `unsicherheit` steigt mit den Merkmalen: Wer Abwägung UND
 * Lebensentscheidung im selben Satz hat, steht nicht vor einer
 * Wissensfrage.
 */
export function lageAus(tiefe: Gespraechsbefund, quellen = 0): Lage {
  const merkmale = tiefe.merkmale.filter((m) => m !== "Bedienfrage").length;
  return {
    task: tiefe.aufgabe,
    tragweite: TRAGWEITE[tiefe.tiefe],
    wichtigkeit: tiefe.tiefe === "entscheidung" ? "kritisch" : tiefe.tiefe === "beratend" ? "hoch" : "niedrig",
    unsicherheit: merkmale >= 2 ? "hoch" : merkmale === 1 ? "mittel" : "niedrig",
    komplexitaet: merkmale >= 3 ? "hoch" : merkmale >= 1 ? "mittel" : "niedrig",
    quellen,
  };
}

/* ══════════════════════════════════════════════════════════════════
   Die Anweisungen
   ══════════════════════════════════════════════════════════════════ */

const ROLLENAUFTRAG: Record<Rolle, string> = {
  hauptanalyse:
    "Erstelle die stärkste realistische Einschätzung. Nenne, was du weisst, " +
    "und trenne es von dem, was du vermutest.",
  gegenpruefung:
    "Suche gezielt nach Gründen, warum die naheliegende Empfehlung scheitert. " +
    "Du bist nicht dafür da, zuzustimmen.",
  alternative:
    "Entwickle Wege, die in der naheliegenden Antwort nicht vorkommen. " +
    "Auch unbequeme.",
};

const GEMEINSAM =
  "Antworte ausschliesslich als JSON nach dem Schema. Deutsch, kurze Sätze.\n" +
  "In `belege` gehört nur, was tatsächlich in den mitgelieferten Angaben steht — " +
  "mit Angabe, woher. Erfinde keine Quelle, keine Zahl und keine Studie. " +
  "Ein leeres `belege` ist eine gültige und ehrliche Antwort; eine erfundene Quelle ist es nicht.\n" +
  "`sicherheit` ist deine Selbsteinschätzung von 0 bis 1. Sie wird als schwaches " +
  "Signal behandelt und entscheidet nichts.";

const AgentSchema = z.object({
  schluss: z.string(),
  befunde: z.array(z.string()),
  risiken: z.array(z.string()),
  unsicherheiten: z.array(z.string()),
  empfehlungen: z.array(z.string()),
  belege: z.array(z.string()),
  sicherheit: z.number(),
});

const PruefSchema = z.object({
  urteile: z.array(
    z.object({
      aussage: z.string(),
      urteil: z.enum(["gestuetzt", "widersprochen", "unklar"]),
      begruendung: z.string(),
      beleg: z.string(),
    }),
  ),
});

const RichterSchema = z.object({
  sprueche: z.array(
    z.object({
      aussage: z.string(),
      entscheidung: z.enum(["haltbar", "nicht_haltbar", "unentschieden"]),
      begruendung: z.string(),
    }),
  ),
});

/* ══════════════════════════════════════════════════════════════════
   Der Lauf
   ══════════════════════════════════════════════════════════════════ */

export interface Teamauftrag {
  userId: string;
  /** Die Frage des Menschen, wörtlich. */
  frage: string;
  /** Was Monday über die Person weiss — nur Gesichertes, kein Verlauf. */
  angaben: string;
  tiefe: Gespraechsbefund;
  melden: Melder;
  signal?: AbortSignal;
}

export interface Teamergebnis {
  vorlage: Synthesevorlage;
  /** Wie viele Modelle tatsächlich geantwortet haben. */
  modelle: number;
  gegengeprueft: boolean;
}

/** Nur die Variable, die hier gelesen wird. Damit ist es prüfbar. */
export interface Teamumgebung {
  MONDAY_TEAM_MODE_ENABLED?: string;
}

/**
 * Ob das Team überhaupt eingeschaltet ist.
 *
 * Der Angabetyp nennt genau die eine Variable, die gelesen wird —
 * wie `Umgebung` in der Registry. Ein `ProcessEnv` als Typ zwingt
 * jeden Test, ein vollständiges `NODE_ENV` mitzuliefern, und sagt
 * beim Lesen nichts darüber, wovon diese Funktion abhängt.
 */
export function teamModusAn(
  /* Der Cast wie in der Registry: Next deklariert `ProcessEnv` mit
     ausschliesslich `NODE_ENV`, und ohne ihn hat der Typ nichts mit
     dieser Angabe gemeinsam. */
  env: Teamumgebung = process.env as Teamumgebung,
): boolean {
  return env.MONDAY_TEAM_MODE_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Einen Modellaufruf in `ai_runs` festhalten.
 *
 * Auch den gescheiterten — sonst zeigt die Tabelle wieder durchweg
 * Erfolg, und der Modellvergleich, für den das Team die besten Daten
 * liefert, läse nur die halbe Wahrheit.
 */
async function laufBuchen(
  userId: string,
  zweck: string,
  platz: Teamplatz,
  status: "ok" | "failed" | "timeout",
  usage: { inputTokens: number | null; outputTokens: number | null; latencyMs: number | null; model?: string } | null,
  fehler: string | null,
): Promise<void> {
  try {
    const db = await getDb();
    await db
      .insert(schema.aiRuns)
      .values({
        userId,
        purpose: zweck,
        taskType: platz.rolle,
        tier: "deep",
        provider: platz.modell.anbieter,
        model: usage?.model ?? platz.modell.apiModellId,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        latencyMs: usage?.latencyMs ?? null,
        status,
        errorMessage: fehler?.slice(0, 400) ?? null,
        rationale: platz.grund.slice(0, 200),
      })
      .catch(() => undefined);
  } catch {
    /* Ein Protokolleintrag darf einen Lauf nie scheitern lassen. */
  }
}

async function echterAdapter(platz: Teamplatz) {
  const cfg = loadRuntimeConfig();
  return anbieterFuerModell(platz.modell, {
    maxTokens: cfg.ai.maxTokensPerRun,
    timeoutMs: cfg.ai.timeoutMs,
  });
}

/**
 * Was `mondayTeam` von aussen braucht — austauschbar.
 *
 * ── Warum das nicht fest verdrahtet ist ─────────────────────────
 *
 * Sonst liesse sich die Kette nur mit Netz, Schlüsseln und echtem
 * Geld prüfen — also praktisch nie. „Verdrahtet" wäre dann eine
 * Behauptung: Vier Bausteine, jeder für sich getestet, und niemand
 * hätte je gesehen, ob sie zusammen das Richtige tun.
 *
 * Dieselbe Entscheidung wie bei `teamLauf`, wo `ausfuehren`
 * hineingereicht wird. Vorbelegt mit dem Echten, damit kein Aufrufer
 * daran denken muss.
 */
export interface Teamwerkzeuge {
  adapterFuer: (platz: Teamplatz) => Promise<AiProvider>;
  budgetFrei: (userId: string | null) => Promise<boolean>;
  buchen: typeof laufBuchen;
}

const ECHT: Teamwerkzeuge = {
  adapterFuer: echterAdapter,
  budgetFrei: teamBudgetFrei,
  buchen: laufBuchen,
};

/**
 * Das Team tagen lassen — oder `null`.
 *
 * `null` heisst: Es gab keinen Grund oder keine Möglichkeit. Der
 * Aufrufer antwortet dann wie immer mit einem Modell und darf nicht
 * behaupten, ein Team habe getagt.
 */
export async function mondayTeam(
  auftrag: Teamauftrag,
  werkzeuge: Teamwerkzeuge = ECHT,
): Promise<Teamergebnis | null> {
  if (!teamModusAn()) return null;

  const lage = lageAus(auftrag.tiefe);
  const urteil = teamWert(lage);
  if (!urteil.lohntSich) return null;

  const team = teamAufstellen({ task: lage.task, qualitaetVorKosten: 0.85 });
  if (team.length < 2) return null;

  if (!(await werkzeuge.budgetFrei(auftrag.userId))) return null;

  auftrag.melden({ art: "aufgestellt", plaetze: team.length, grund: urteil.begruendung });

  /* ── Runde 1 ──────────────────────────────────────────────── */

  const runde1 = await teamLauf(
    team,
    async (platz, signal): Promise<Agentenergebnis> => {
      const adapter = await werkzeuge.adapterFuer(platz);
      try {
        const a = await adapter.structuredGenerate({
          system: `${ROLLENAUFTRAG[platz.rolle]}\n\n${GEMEINSAM}`,
          messages: [
            {
              role: "user",
              content: `FRAGE:\n${auftrag.frage}\n\nBEKANNTE ANGABEN:\n${auftrag.angaben || "(keine)"}`,
            },
          ],
          schema: AgentSchema,
          schemaName: "monday_agent",
          tier: "deep",
          signal,
        });
        anbieterMelden(platz.modell.anbieter as Anbieter, true);
        await werkzeuge.buchen(auftrag.userId, `${ZWECK}:runde1`, platz, "ok", a.usage, null);
        return a.data;
      } catch (fehler) {
        const text = fehler instanceof Error ? fehler.message : String(fehler);
        anbieterMelden(platz.modell.anbieter as Anbieter, false, text);
        await werkzeuge.buchen(
          auftrag.userId,
          `${ZWECK}:runde1`,
          platz,
          /abort|timeout|frist/i.test(text) ? "timeout" : "failed",
          null,
          text,
        );
        throw fehler;
      }
    },
    undefined,
    auftrag.signal,
  );

  for (const lauf of runde1.laeufe) {
    auftrag.melden({ art: "agent", rolle: lauf.rolle, status: lauf.status, dauerMs: lauf.dauerMs });
  }

  if (runde1.zuWenig) return null;

  /* ── Runde 2 ──────────────────────────────────────────────── */

  const runde2 = await pruefrunde(
    team,
    runde1.ergebnisse,
    async (platz, vorlagen: readonly Vorlage[], signal) => {
      const adapter = await werkzeuge.adapterFuer(platz);
      const liste = vorlagen
        .map((v) => `${v.kennung}) ${v.aussage}${v.belegt ? " [belegt]" : ""}`)
        .join("\n");
      try {
        const a = await adapter.structuredGenerate({
          system:
            "Du prüfst fremde Aussagen. Nenne für jede, ob sie haltbar ist. " +
            "Ein Widerspruch braucht eine Begründung; ohne sie zählt er nicht. " +
            "Gib `aussage` WÖRTLICH so zurück, wie sie dir vorliegt. " +
            "`beleg` bleibt leer, wenn du keinen hast — erfinde keinen.\n\n" +
            "Antworte ausschliesslich als JSON nach dem Schema. Deutsch.",
          messages: [{ role: "user", content: `ZU PRÜFEN:\n${liste}` }],
          schema: PruefSchema,
          schemaName: "monday_pruefung",
          tier: "deep",
          signal,
        });
        anbieterMelden(platz.modell.anbieter as Anbieter, true);
        await werkzeuge.buchen(auftrag.userId, `${ZWECK}:runde2`, platz, "ok", a.usage, null);
        return {
          urteile: a.data.urteile.map((u) => ({
            ...u,
            beleg: u.beleg.trim() === "" ? null : u.beleg,
          })),
        };
      } catch (fehler) {
        const text = fehler instanceof Error ? fehler.message : String(fehler);
        anbieterMelden(platz.modell.anbieter as Anbieter, false, text);
        await werkzeuge.buchen(auftrag.userId, `${ZWECK}:runde2`, platz, "failed", null, text);
        throw fehler;
      }
    },
    undefined,
    auftrag.signal,
  );

  if (runde2.ausgefallen) {
    auftrag.melden({ art: "gegenpruefung_ausgefallen", grund: runde2.grund ?? "unbekannt" });
  } else {
    const urteile = runde2.ergebnisse.reduce((n, l) => n + (l.ergebnis?.urteile.length ?? 0), 0);
    auftrag.melden({ art: "gegengeprueft", urteile });
  }

  /* ── Lagebild und Richter ─────────────────────────────────── */

  let bild = lagebild(runde1.ergebnisse, runde2.ergebnisse, !runde2.ausgefallen);

  if (bild.strittig.length > 0) {
    const beteiligt = runde1.ergebnisse.map((l) => l.rolle);
    const spruch = await richterlauf(
      bild,
      team,
      beteiligt,
      async (vorlagen, signal) => {
        const richter = team.find((p) => !beteiligt.includes(p.rolle)) ?? team[0]!;
        const adapter = await werkzeuge.adapterFuer(richter);
        const liste = vorlagen
          .map(
            (v) =>
              `${v.kennung}) ${v.aussage}\n   Behauptung ${v.belegt ? "belegt" : "unbelegt"}; ` +
              `Einwand ${v.einwandBelegt ? "belegt" : "unbelegt"}: ${v.einwaende.join(" | ")}`,
          )
          .join("\n");
        try {
          const a = await adapter.structuredGenerate({
            system:
              "Du entscheidest strittige Punkte. Es zählt, welcher Beleg trägt — " +
              "nicht, wie viele einer Meinung sind.\n" +
              "`unentschieden` ist eine richtige Antwort, wenn die Lage nichts hergibt. " +
              "Rate nicht.\n" +
              "Gib `aussage` WÖRTLICH zurück. Antworte ausschliesslich als JSON. Deutsch.",
            messages: [{ role: "user", content: `STRITTIG:\n${liste}` }],
            schema: RichterSchema,
            schemaName: "monday_richter",
            tier: "deep",
            signal,
          });
          anbieterMelden(richter.modell.anbieter as Anbieter, true);
          await werkzeuge.buchen(auftrag.userId, `${ZWECK}:richter`, richter, "ok", a.usage, null);
          return a.data;
        } catch (fehler) {
          const text = fehler instanceof Error ? fehler.message : String(fehler);
          anbieterMelden(richter.modell.anbieter as Anbieter, false, text);
          await werkzeuge.buchen(auftrag.userId, `${ZWECK}:richter`, richter, "failed", null, text);
          throw fehler;
        }
      },
      undefined,
      auftrag.signal,
    );

    const entschieden = spruch.sprueche.filter((s) => s.entscheidung !== "unentschieden").length;
    auftrag.melden({ art: "richter", entschieden, befangen: spruch.befangen });
    bild = spruchAnwenden(bild, spruch);
  }

  const vorlage = syntheseVorlage(bild);

  auftrag.melden({
    art: "fertig",
    gesichert: bild.staende.filter((s) => s.stand === "gesichert").length,
    strittig: bild.strittig.length,
    verworfen: vorlage.verworfen,
  });

  return { vorlage, modelle: runde1.erfolgreich, gegengeprueft: !runde2.ausgefallen };
}

/**
 * Das Ergebnis als Material für Mondays Antwort.
 *
 * ── Warum als Systemnachricht und nicht als Nutzertext ──────────
 *
 * Weil es sonst im Verlauf stünde, als hätte die Person es gesagt.
 * Beim nächsten Aufruf läse Monday die eigene Analyse als Aussage
 * ihres Gegenübers — und käme nie wieder davon los.
 *
 * ── Warum der Hinweis mitgeht ───────────────────────────────────
 *
 * Ein Text, der offene Punkte verschweigt, klingt sicherer als die
 * Lage. Genau das soll das Team verhindern; es wäre absurd, den
 * Aufwand zu treiben und die Unsicherheit dann wegzuschreiben.
 */
export function alsMaterial(ergebnis: Teamergebnis): string {
  const teile = ergebnis.vorlage.abschnitte.map(
    (a) => `${a.ueberschrift}:\n${a.aussagen.map((s) => `- ${s}`).join("\n")}`,
  );

  return [
    "VORANALYSE MEHRERER MODELLE — Material für deine Antwort, kein Text zum Vorlesen.",
    "",
    ...teile,
    "",
    ergebnis.vorlage.hinweis,
    "",
    "Schreibe deine Antwort wie immer, in deiner Sprache. Was hier als offen steht, " +
      "benennst du als offen. Sprich nicht über Modelle, Runden oder Prüfverfahren — " +
      "es sei denn, die Person fragt danach.",
  ].join("\n");
}
