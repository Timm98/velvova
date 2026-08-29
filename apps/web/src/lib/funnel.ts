import { getDb, schema, withUser } from "@paycheck/db";
import { eq } from "drizzle-orm";

/**
 * Application Funnel Debugger.
 *
 * Die wichtigste Eigenschaft dieses Moduls ist, wann es schweigt. Unter
 * einer belastbaren Stichprobe sagt es ausdruecklich nichts - aus drei
 * Bewerbungen ohne Antwort laesst sich kein Muster lesen, und eine
 * Diagnose daraus waere geraten.
 *
 * Und es empfiehlt nie "bewirb dich mehr". Menge ist selten das Problem.
 */

const MIN_SENT_FOR_DIAGNOSIS = 10;
const MIN_VIEWS_FOR_DIAGNOSIS = 15;

export interface FunnelCounts {
  viewed: number;
  saved: number;
  started: number;
  sent: number;
  acknowledged: number;
  interviews: number;
  offers: number;
  rejected: number;
}

export interface FunnelFinding {
  key: string;
  title: string;
  observation: string;
  suggestion: string;
  /** Wie belastbar. Steht immer dabei. */
  certainty: "hinweis" | "muster";
}

export interface FunnelDiagnosis {
  counts: FunnelCounts;
  hasEnoughData: boolean;
  headline: string;
  findings: FunnelFinding[];
  /** Ausdruecklicher Hinweis, was NICHT gesagt werden kann. */
  limits: string;
}

export async function diagnoseFunnel(userId: string): Promise<FunnelDiagnosis> {
  const db = await getDb();
  const events = await withUser(db, userId, (tx) =>
    tx.select().from(schema.applicationEvents).where(eq(schema.applicationEvents.userId, userId)),
  );

  const count = (type: string) => events.filter((e) => e.type === type).length;

  const counts: FunnelCounts = {
    viewed: count("job_viewed"),
    saved: count("job_saved"),
    started: count("application_started"),
    sent: count("application_sent"),
    acknowledged: count("acknowledged") + count("response_received"),
    interviews: count("interview_scheduled") + count("interview_held"),
    offers: count("offer_received"),
    rejected: count("rejected"),
  };

  const hasEnoughData = counts.sent >= MIN_SENT_FOR_DIAGNOSIS || counts.viewed >= MIN_VIEWS_FOR_DIAGNOSIS;

  if (!hasEnoughData) {
    return {
      counts,
      hasEnoughData: false,
      headline:
        `Fuer eine Diagnose reicht die Datenlage noch nicht. Bisher ${counts.sent} versendete ` +
        `Bewerbungen; ab etwa ${MIN_SENT_FOR_DIAGNOSIS} wird ein Muster lesbar.`,
      findings: [],
      limits:
        "Aus wenigen Bewerbungen laesst sich kein Muster ableiten. Alles andere waere geraten.",
    };
  }

  const findings: FunnelFinding[] = [];
  const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

  // Viel angesehen, wenig gespeichert
  if (counts.viewed >= MIN_VIEWS_FOR_DIAGNOSIS && ratio(counts.saved, counts.viewed) < 0.15) {
    findings.push({
      key: "view_to_save",
      title: "Viele Ansichten, wenige Merkungen",
      observation: `Von ${counts.viewed} angesehenen Stellen hast du ${counts.saved} gespeichert.`,
      suggestion:
        "Die Vorschlaege treffen offenbar nicht. Pruef deine Zielrollen im Profil - vielleicht " +
        "sucht die Auswahl gerade in die falsche Richtung.",
      certainty: counts.viewed >= 30 ? "muster" : "hinweis",
    });
  }

  // Gespeichert, aber nie begonnen
  if (counts.saved >= 5 && ratio(counts.started, counts.saved) < 0.3) {
    findings.push({
      key: "save_to_start",
      title: "Gespeichert, aber nicht begonnen",
      observation: `${counts.saved} gespeichert, ${counts.started} begonnen.`,
      suggestion:
        "Etwas haelt dich vor dem ersten Schritt auf. Das ist oft eine fehlende Angabe in der " +
        "Anzeige oder ein Zweifel, den man ausformulieren sollte - nicht Faulheit.",
      certainty: "hinweis",
    });
  }

  // Viele Bewerbungen, keine Interviews
  if (counts.sent >= MIN_SENT_FOR_DIAGNOSIS && counts.interviews === 0) {
    findings.push({
      key: "sent_no_interview",
      title: "Bewerbungen ohne Gespraech",
      observation: `${counts.sent} versendet, bisher kein Gespraech.`,
      suggestion:
        "Drei Dinge lohnen die Pruefung, in dieser Reihenfolge: passen die Zielrollen zu deiner " +
        "belegten Erfahrung, ist die Seniorstufe realistisch, und decken deine Unterlagen die " +
        "Muss-Anforderungen sichtbar ab. Mehr Bewerbungen desselben Zuschnitts aendern daran nichts.",
      certainty: counts.sent >= 20 ? "muster" : "hinweis",
    });
  }

  // Interviews, keine Angebote
  if (counts.interviews >= 3 && counts.offers === 0) {
    findings.push({
      key: "interview_no_offer",
      title: "Gespraeche ohne Angebot",
      observation: `${counts.interviews} Gespraeche, bisher kein Angebot.`,
      suggestion:
        "Bis zum Gespraech stimmt offenbar viel. Lohnend sind jetzt konkrete Beispiele mit " +
        "benanntem Ergebnis und eigene Rueckfragen - oder die ehrliche Frage, ob die Rollen " +
        "wirklich passen.",
      certainty: counts.interviews >= 5 ? "muster" : "hinweis",
    });
  }

  // Angebote werden abgelehnt
  if (counts.offers >= 2 && counts.offers > count("accepted")) {
    findings.push({
      key: "offers_declined",
      title: "Angebote, die du ablehnst",
      observation: `${counts.offers} Angebote erhalten.`,
      suggestion:
        "Wenn Angebote kommen, aber nicht passen, liegt es meist an Gehalt, Bedingungen oder " +
        "Jobqualitaet. Es lohnt sich, diese Kriterien vorher schaerfer zu setzen statt nachher.",
      certainty: "hinweis",
    });
  }

  const headline =
    findings.length === 0
      ? `${counts.sent} Bewerbungen, ${counts.interviews} Gespraeche. Kein auffaelliges Muster.`
      : `${counts.sent} Bewerbungen, ${counts.interviews} Gespraeche. ${findings.length} Auffaelligkeit${findings.length === 1 ? "" : "en"}.`;

  return {
    counts,
    hasEnoughData: true,
    headline,
    findings,
    limits:
      "Diese Auswertung beschreibt Zusammenhaenge in deinen eigenen Zahlen. Sie kennt nicht das " +
      "Bewerberfeld, das Timing oder interne Kandidaten - und sagt deshalb nichts darueber aus, " +
      "wie wahrscheinlich eine Einstellung ist.",
  };
}
