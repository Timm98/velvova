import { getDb, schema, withUser } from "@paycheck/db";
import { isStale, listJobsForUser, loadProfileContext, type ScoredJob } from "@/lib/matching";

/**
 * Der Chancenraum.
 *
 * Das Produktversprechen dieser Datei in einem Satz: **eine Zahl über
 * gefundene Stellen ist keine Aussage über Chancen.**
 *
 * Eine Suche liefert tausend Treffer. Nach Dubletten, abgelaufenen
 * Anzeigen, harten Konflikten und unerreichbarer Seniorität bleiben
 * zwölf. Die tausend als Erfolg zu zeigen ist keine Grosszügigkeit — es
 * ist eine Täuschung über den Aufwand, der noch bevorsteht, und sie
 * trifft genau die Person, die ohnehin zu wenig Zeit hat.
 *
 * Jede Zahl hier wird **gezählt**, keine geschätzt. Wo nicht genug
 * Daten vorliegen, steht das da, statt eine Zahl zu erfinden.
 */

export const FUNNEL_VERSION = "1.0.0";

/** Unter dieser Menge sagt der Trichter nichts, sondern schweigt. */
const MINDESTMENGE = 5;

export interface FunnelStufe {
  key: string;
  label: string;
  count: number;
  /** Was auf dieser Stufe weggefallen ist, in einem Satz. */
  lost: string | null;
}

export interface OpportunityFunnel {
  stufen: FunnelStufe[];
  /** Reicht die Datenlage für eine Aussage? */
  belastbar: boolean;
  /** Der eine Engpass, der am meisten kostet. */
  engpass: {
    key: string;
    label: string;
    verlust: number;
    erklaerung: string;
    handlung: string;
  } | null;
  hinweis: string;
  berechnetAm: Date;
  version: string;
}

/**
 * Warum ein Engpass entsteht — und was man dagegen tun kann.
 *
 * Die Handlungsempfehlung steht bewusst neben der Erklärung. Ein
 * Trichter, der nur zeigt, wie wenig übrig bleibt, macht die Lage
 * sichtbar und die Person hilfloser.
 *
 * Was hier NICHT steht: „gib deine Bedingungen auf". Eine harte
 * Bedingung hat meist einen Grund, den die Person nicht erzählt hat —
 * Kinderbetreuung, Pflege, Gesundheit. Sie zu übergehen heisst, den
 * Grund zu übergehen.
 */
const ENGPASS_TEXTE: Record<string, { erklaerung: string; handlung: string }> = {
  dedupliziert: {
    erklaerung: "Viele Treffer waren dieselbe Stelle auf mehreren Portalen.",
    handlung: "Nichts zu tun — zusammengefasst siehst du jede Stelle einmal.",
  },
  aktiv: {
    erklaerung: "Ein grosser Teil der Anzeigen ist abgelaufen oder nicht mehr erreichbar.",
    handlung: "Ein neuer Abruf holt frische Anzeigen.",
  },
  bedingungen: {
    erklaerung: "Deine harten Bedingungen schliessen die meisten Stellen aus.",
    handlung:
      "Sieh dir an, welche Bedingung am meisten ausschliesst. Ob sie verhandelbar ist, " +
      "entscheidest du — manche haben einen Grund, der hier nicht steht.",
  },
  erreichbar: {
    erklaerung: "Die übrigen Stellen verlangen ein anderes Erfahrungsniveau.",
    handlung: "Angrenzende Rollen und Einstiegswege ansehen.",
  },
  belegt: {
    erklaerung: "Für viele Anforderungen fehlt in deinem Profil noch ein Beleg.",
    handlung: "Im Gespräch mit Monday konkrete Situationen ergänzen.",
  },
};

export interface FunnelInput {
  /** Alle Rohtreffer aus den Quellen, vor Zusammenführung. */
  rawCount: number;
  /** Nach Zusammenführung gleicher Stellen. */
  jobs: ScoredJob[];
}

/**
 * Den Trichter rechnen.
 *
 * Ausgelagert und ohne Datenbank, damit er prüfbar ist. Eine Zahl, die
 * nur im Betrieb entsteht, kann niemand nachrechnen.
 */
export function computeFunnel(input: FunnelInput, now = new Date()): OpportunityFunnel {
  const { rawCount, jobs } = input;

  const dedupliziert = jobs.length;
  const aktiv = jobs.filter((j) => !isStale(j.job, now));
  const bedingungen = aktiv.filter((j) => j.constraints.overall !== "blocked");
  // „Erreichbar" heisst hier: die Passung ist nicht durch fehlende
  // Erfahrung auf das unterste Band gefallen.
  const erreichbar = bedingungen.filter((j) => j.fit.band !== "insufficient_data");
  const belegt = erreichbar.filter((j) => j.fit.coverage >= 0.35);
  const entscheidungsbereit = belegt.filter(
    (j) => j.confidence.score >= 45 && j.listingConfidence.level !== "low",
  );

  const stufen: FunnelStufe[] = [
    { key: "roh", label: "gefundene Quelleneinträge", count: rawCount, lost: null },
    {
      key: "dedupliziert",
      label: "eindeutige Stellen",
      count: dedupliziert,
      lost: rawCount > dedupliziert ? `${rawCount - dedupliziert} Dubletten zusammengeführt` : null,
    },
    {
      key: "aktiv",
      label: "aktuell bestätigt",
      count: aktiv.length,
      lost: dedupliziert > aktiv.length ? `${dedupliziert - aktiv.length} abgelaufen oder nicht erreichbar` : null,
    },
    {
      key: "bedingungen",
      label: "erfüllen deine harten Bedingungen",
      count: bedingungen.length,
      lost: aktiv.length > bedingungen.length ? `${aktiv.length - bedingungen.length} im Widerspruch zu einer Bedingung` : null,
    },
    {
      key: "erreichbar",
      label: "für dein Erfahrungsniveau realistisch",
      count: erreichbar.length,
      lost: bedingungen.length > erreichbar.length ? `${bedingungen.length - erreichbar.length} verlangen anderes Niveau` : null,
    },
    {
      key: "belegt",
      label: "mit belegter Passung",
      count: belegt.length,
      lost: erreichbar.length > belegt.length ? `${erreichbar.length - belegt.length} ohne ausreichenden Beleg im Profil` : null,
    },
    {
      key: "entscheidungsbereit",
      label: "entscheidungsbereit",
      count: entscheidungsbereit.length,
      lost:
        belegt.length > entscheidungsbereit.length
          ? `${belegt.length - entscheidungsbereit.length} mit zu unsicherer Datenlage`
          : null,
    },
  ];

  const belastbar = rawCount >= MINDESTMENGE;

  /*
   * Der Engpass ist die Stufe mit dem grössten absoluten Verlust —
   * ausser der Deduplizierung, die kein Verlust ist, sondern eine
   * Aufräumarbeit. Sie als Engpass zu melden wäre irreführend.
   */
  let engpass: OpportunityFunnel["engpass"] = null;
  if (belastbar) {
    let groesster = 0;
    for (let i = 1; i < stufen.length; i++) {
      const stufe = stufen[i]!;
      if (stufe.key === "dedupliziert") continue;
      const verlust = stufen[i - 1]!.count - stufe.count;
      if (verlust > groesster) {
        groesster = verlust;
        const texte = ENGPASS_TEXTE[stufe.key];
        engpass = {
          key: stufe.key,
          label: stufe.label,
          verlust,
          erklaerung: texte?.erklaerung ?? "",
          handlung: texte?.handlung ?? "",
        };
      }
    }
  }

  return {
    stufen,
    belastbar,
    engpass,
    hinweis: belastbar
      ? "Jede Zahl ist gezählt, keine geschätzt."
      : "Noch nicht genügend Daten für eine belastbare Aussage. Wir prüfen weitere Quellen.",
    berechnetAm: now,
    version: FUNNEL_VERSION,
  };
}

/**
 * Den Trichter für eine Person rechnen und festhalten.
 *
 * Der Schnappschuss wird gespeichert, weil sich die Zahlen ändern und
 * eine Person später fragen können soll: „war das letzte Woche auch
 * schon so eng?"
 */
export async function buildAndStoreFunnel(userId: string): Promise<OpportunityFunnel> {
  const ctx = await loadProfileContext(userId);
  const { jobs, blockedCount, staleCount } = await listJobsForUser(userId, ctx, {
    includeBlocked: true,
  });

  // Der Rohbestand ist alles, was die Quellen geliefert haben — auch
  // das Abgelaufene und das Gesperrte. Ohne diese Zeilen begänne der
  // Trichter erst nach der Hälfte der Arbeit.
  const alle = [...jobs];
  const funnel = computeFunnel({ rawCount: alle.length + staleCount, jobs: alle });

  const db = await getDb();
  const stufe = (key: string) => funnel.stufen.find((s) => s.key === key)?.count ?? 0;

  await withUser(db, userId, (tx) =>
    tx.insert(schema.searchSpaceSnapshots).values({
      userId,
      queryVersion: "profile-default",
      country: ctx.constraints.baseLocation ? "DE" : null,
      rawResultsCount: stufe("roh"),
      deduplicatedResultsCount: stufe("dedupliziert"),
      sourceVerifiedCount: stufe("aktiv"),
      currentlyActiveCount: stufe("aktiv"),
      hardConstraintsPassedCount: stufe("bedingungen"),
      seniorityReachableCount: stufe("erreichbar"),
      evidenceSupportedCount: stufe("belegt"),
      decisionReadyCount: stufe("entscheidungsbereit"),
      highFitCount: jobs.filter((j) => j.fit.band === "high").length,
      exploratoryCount: jobs.filter((j) => j.fit.band === "exploratory").length,
      unknownDataCount: blockedCount,
      calculationVersion: FUNNEL_VERSION,
    }),
  );

  return funnel;
}
