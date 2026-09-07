import { and, desc, eq } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { naechsteFrage } from "@paycheck/matching";
import { belegeAlsText, belegstandLaden, type Belegstand } from "./belege.ts";
import { offeneKlaerungen } from "./synthese.ts";

/**
 * Welche Wege dieser Person offenstehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie nicht bei jeder Frage entsteht
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Karriereanalyse ist die teuerste Auskunft im Produkt: das
 * tiefe Modell, unter Umständen zweimal. Sie gehört an den Moment,
 * an dem jemand tatsächlich vor einer Entscheidung steht — nicht an
 * jede Nachricht, in der das Wort „Beruf" vorkommt.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum sie ohne Belege nicht entsteht
 * ══════════════════════════════════════════════════════════════
 *
 * „Welche Wege stehen mir offen" ist ohne Wissen über den Menschen
 * nicht beantwortbar. Ein Modell antwortet trotzdem — mit dem, was
 * für irgendeinen Menschen gilt. Das ist die Sorte Auskunft, die
 * freundlich klingt und niemandem hilft.
 *
 * Dann steht hier `null` und daneben die Frage, die weiterhilft.
 */

/** Ab wie vielen entscheidungsfähigen Belegen eine Analyse etwas taugt. */
export const BELEGE_FUER_ANALYSE = 5;

export interface Karriereauftrag {
  userId: string;
  /**
   * Der erste Lauf — das tiefe Modell.
   */
  rufer: (fakten: string) => Promise<{
    ergebnis: Record<string, unknown>;
    modell: string;
    konfidenz: number;
  }>;
  /**
   * Die zweite Meinung. Bekommt DIESELBEN Fakten, nicht das Ergebnis
   * des ersten Laufs.
   */
  zweitrufer?: (fakten: string) => Promise<{
    ergebnis: Record<string, unknown>;
    modell: string;
  }>;
  /** Ob eine zweite Meinung überhaupt in Frage kommt. */
  zweitmeinungMoeglich?: boolean;
  /**
   * Der Vergleich zweier Ergebnisse. Kommt von aussen, damit dieses
   * Modul die Vergleichsregel nicht dupliziert.
   */
  vergleichen?: (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ) => { feld: string; erst: unknown; zweit: unknown }[];
  promptFassung?: string;
  frisch?: boolean;
  jetzt?: Date;
}

export interface Karrierebefund {
  analyse: Record<string, unknown> | null;
  modell: string | null;
  zweitmodell: string | null;
  einig: boolean | null;
  abweichungen: { feld: string; erst: unknown; zweit: unknown }[];
  neuGerechnet: boolean;
  grund: string;
  /** Was Monday der Person sagen soll, wenn die Läufe auseinandergehen. */
  hinweis: string | null;
  /** Die offene Frage, wenn die Datenlage nicht reicht. */
  naechsteFrage: string | null;
  belegstand: Belegstand;
}

/**
 * Ob die Lage eine zweite Meinung rechtfertigt.
 *
 * ── Warum das hier steht und nicht im Router ──────────────────
 *
 * Der Router kennt die Aufgabe, nicht ihr Ergebnis. Ob mehrere Wege
 * fast gleichauf liegen, steht erst in der Analyse — und genau das
 * ist der Fall, in dem eine zweite Meinung etwas beiträgt.
 */
export function brauchtZweiteMeinung(analyse: Record<string, unknown>): {
  ja: boolean;
  grund: string;
} {
  const konfidenz = typeof analyse.confidence === "number" ? analyse.confidence : 1;
  const richtungen = Array.isArray(analyse.directions) ? analyse.directions : [];
  const widersprueche = Array.isArray(analyse.contradictions) ? analyse.contradictions.length : 0;

  const gruende: string[] = [];

  if (konfidenz < 0.6) gruende.push(`geringe Zuversicht (${konfidenz.toFixed(2)})`);

  /*
   * Mehrere Wege fast gleichauf.
   *
   * Wenn drei Richtungen als „heute möglich" gelten, ist die
   * Empfehlung nicht offensichtlich — und eine zweite Analyse kann
   * zeigen, ob die Reihenfolge trägt oder Zufall war.
   */
  const realistisch = richtungen.filter(
    (r) => typeof r === "object" && r !== null && (r as { einschaetzung?: string }).einschaetzung === "realistic_now",
  );
  if (realistisch.length >= 3) gruende.push(`${realistisch.length} Wege gleichauf`);

  if (widersprueche >= 2) gruende.push(`${widersprueche} Widersprüche`);

  /* Zwei Merkmale, wie überall sonst auch. Eine einzelne
     Auffälligkeit ist noch keine Unsicherheit. */
  return { ja: gruende.length >= 2, grund: gruende.join(", ") || "nichts Auffälliges" };
}

export async function karriereanalyse(
  db: Database,
  auftrag: Karriereauftrag,
): Promise<Karrierebefund> {
  const jetzt = auftrag.jetzt ?? new Date();
  const belegstand = await belegstandLaden(db, auftrag.userId);
  const klaerungen = await offeneKlaerungen(db, auftrag.userId);
  /*
   * Die offene Frage, oder — wenn noch keine gespeichert ist — die
   * gerechnete.
   *
   * Sie kostet nichts und ist gerade dann wichtig, wenn die Analyse
   * ausfällt: „zu wenig bekannt" ohne die Frage, die das ändern
   * würde, ist eine Absage.
   */
  const naechste =
    klaerungen.find((k) => k.art === "frage")?.frage ??
    naechsteFrage(
      belegstand.belege.map((b) => ({
        text: b.aussage,
        quelle: b.quelle,
        konfidenz: b.konfidenz,
      })),
    )?.frage ??
    null;

  const leer = (grund: string): Karrierebefund => ({
    analyse: null,
    modell: null,
    zweitmodell: null,
    einig: null,
    abweichungen: [],
    neuGerechnet: false,
    grund,
    hinweis: null,
    naechsteFrage: naechste,
    belegstand,
  });

  /*
   * Ohne Grundlage keine Analyse.
   *
   * Ein Modell antwortet auch auf „welche Wege stehen mir offen"
   * ohne jede Angabe — mit dem, was für irgendeinen Menschen gilt.
   */
  const tragend = belegstand.belege.filter((b) => b.konfidenz >= 0.75);
  if (tragend.length < BELEGE_FUER_ANALYSE) {
    return leer(
      `Nur ${tragend.length} belastbare Angaben — für eine Karriereanalyse zu wenig.`,
    );
  }

  /* Eine gespeicherte Analyse zum selben Belegstand. */
  const [gespeichert] = await withUser(db, auftrag.userId, (tx) =>
    tx
      .select()
      .from(schema.profilSynthesen)
      .where(
        and(
          eq(schema.profilSynthesen.userId, auftrag.userId),
          eq(schema.profilSynthesen.art, "karriereanalyse"),
        ),
      )
      .orderBy(desc(schema.profilSynthesen.erstelltAm))
      .limit(1),
  );

  if (!auftrag.frisch && gespeichert && gespeichert.belegStand === belegstand.stand) {
    return {
      analyse: gespeichert.ergebnis,
      modell: gespeichert.modell,
      zweitmodell: gespeichert.zweitmodell,
      einig: gespeichert.einig,
      abweichungen: gespeichert.abweichungen as Karrierebefund["abweichungen"],
      neuGerechnet: false,
      grund: "Belegstand unverändert.",
      hinweis: hinweisAus(gespeichert.einig, gespeichert.abweichungen as { feld: string }[]),
      naechsteFrage: naechste,
      belegstand,
    };
  }

  const fakten = belegeAlsText(belegstand.belege);
  const erst = await auftrag.rufer(fakten);

  /* ── Die zweite Meinung ───────────────────────────────────── */
  const pruefung = brauchtZweiteMeinung(erst.ergebnis);
  let zweit: { ergebnis: Record<string, unknown>; modell: string } | null = null;
  let abweichungen: Karrierebefund["abweichungen"] = [];
  let einig: boolean | null = null;

  if (pruefung.ja && auftrag.zweitmeinungMoeglich && auftrag.zweitrufer) {
    try {
      /* Dieselben Fakten. Nicht das Ergebnis des ersten Laufs. */
      zweit = await auftrag.zweitrufer(fakten);
      abweichungen = auftrag.vergleichen?.(erst.ergebnis, zweit.ergebnis) ?? [];
      einig = abweichungen.length === 0;
    } catch {
      /*
       * Eine gescheiterte zweite Meinung ist kein gescheiterter
       * Vorgang. Die erste Analyse steht.
       */
      zweit = null;
    }
  }

  await withUser(db, auftrag.userId, (tx) =>
    tx.insert(schema.profilSynthesen).values({
      userId: auftrag.userId,
      art: "karriereanalyse",
      ergebnis: erst.ergebnis,
      belegStand: belegstand.stand,
      belegAnzahl: belegstand.anzahl,
      modell: erst.modell,
      promptFassung: auftrag.promptFassung ?? "unbekannt",
      konfidenz: erst.konfidenz,
      zweitmodell: zweit?.modell ?? null,
      zweitErgebnis: zweit?.ergebnis ?? null,
      einig,
      abweichungen,
      erstelltAm: jetzt,
    }),
  );

  return {
    analyse: erst.ergebnis,
    modell: erst.modell,
    zweitmodell: zweit?.modell ?? null,
    einig,
    abweichungen,
    neuGerechnet: true,
    grund: pruefung.ja
      ? `Zweite Meinung: ${pruefung.grund}`
      : `Ein Lauf genügte: ${pruefung.grund}`,
    hinweis: hinweisAus(einig, abweichungen),
    naechsteFrage: naechste,
    belegstand,
  };
}

/**
 * Was die Person erfährt, wenn die beiden Läufe auseinandergehen.
 *
 * ── Warum daraus eine Frage wird und keine Auswahl ────────────
 *
 * „Das teurere Modell hat recht" wäre keine Prüfung, sondern eine
 * Rangordnung. Gehen zwei Analysen auseinander, ist das eine
 * Auskunft über die Frage: Sie ist offen — und dann hilft eine
 * zusätzliche Angabe mehr als eine gewählte Antwort.
 */
export function hinweisAus(
  einig: boolean | null,
  abweichungen: readonly { feld: string }[],
): string | null {
  if (einig !== false || abweichungen.length === 0) return null;
  return (
    `Bei ${abweichungen.map((a) => a.feld).join(" und ")} komme ich zu keinem eindeutigen Bild — ` +
    `zwei Durchgänge sehen das verschieden. Erzähl mir mehr dazu, dann wird es klarer.`
  );
}
