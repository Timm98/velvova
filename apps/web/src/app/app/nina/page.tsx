import type { Metadata } from "next";
import { PROGRESS_GROUPS, STAGE_STATUS_DE, completedGroups } from "@paycheck/ai";
import { getPageContext } from "@/lib/locale";
import { loadInterview } from "@/lib/interview";
import { requireUser } from "@/lib/auth";
import { ensureConversation, loadMessages } from "@/lib/nina/conversations";
import { bestandAufnehmen } from "@/lib/nina/engine";
import { InterviewRoom } from "./InterviewRoom";

export const metadata: Metadata = { title: "Gespräch" };
export const dynamic = "force-dynamic";

/**
 * Fast gleiche Aussagen zusammenführen.
 *
 * Die Extraktion legt dieselbe Aussage gern in zwei Feldern ab — „Ich
 * arbeite seit fünf Jahren im Kundenservice“ ist zugleich Erfahrung und
 * Ziel. In der Datenbank ist das richtig: die Kategorie zählt für
 * verschiedene Zwecke. Auf dem Bildschirm ist es eine Bitte, dasselbe
 * zweimal zu bestätigen.
 *
 * Verglichen wird auf den ersten 60 Zeichen in Kleinschreibung ohne
 * Satzzeichen — grob genug für Umformulierungen, eng genug, um zwei
 * echte Aussagen nicht zu verschmelzen.
 */
function entdoppeln<T extends { statement: string }>(items: T[]): T[] {
  const gesehen = new Set<string>();
  return items.filter((i) => {
    const schlüssel = i.statement
      .toLowerCase()
      .replace(/[^a-zäöüß0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    if (gesehen.has(schlüssel)) return false;
    gesehen.add(schlüssel);
    return true;
  });
}

/**
 * Das Karrieregespräch.
 *
 * Die Seite lädt, was der Server über den Menschen weiß, und gibt es
 * weiter: Verlauf, offene Vermutungen, Stufe, Fortschritt. Alles
 * Weitere passiert im Gespräch.
 *
 * Der Verlauf kommt aus der Datenbank, nicht aus dem Zustand einer
 * Komponente. Deshalb ist er nach einem Neuladen noch da — und auf
 * einem zweiten Gerät auch.
 */
export default async function NinaPage() {
  const { t, brand } = await getPageContext();
  const user = await requireUser();

  const [view, bestand] = await Promise.all([loadInterview(), bestandAufnehmen(user.id)]);

  const gespräch = await ensureConversation(user.id, {
    kind: "career_interview",
    locale: user.locale,
    route: "/app/nina",
  });
  const nachrichten = await loadMessages(user.id, gespräch.id);

  const fertigeGruppen = new Set(completedGroups(bestand));

  return (
    <InterviewRoom
      assistantName={brand.assistantName}
      openingQuestion={view.step.text}
      conversationId={gespräch.id}
      initialMessages={nachrichten
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))}
      hypotheses={entdoppeln(view.openHypotheses).slice(0, 4)}
      initialStage={bestand.stage}
      initialStatus={STAGE_STATUS_DE[bestand.stage]}
      progress={{
        groups: PROGRESS_GROUPS.map((g) => ({
          key: g.key,
          label: g.label,
          done: fertigeGruppen.has(g.key),
        })),
        completeness: bestand.readiness.score,
      }}
      labels={{
        yourAnswer: t("interview.yourAnswer"),
        pauseSession: t("interview.pauseSession"),
      }}
    />
  );
}
