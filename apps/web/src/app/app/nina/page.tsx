import type { Metadata } from "next";
import { getPageContext } from "@/lib/locale";
import { loadInterview } from "@/lib/interview";
import { requireUser } from "@/lib/auth";
import { ensureConversation, loadMessages } from "@/lib/nina/conversations";
import { InterviewRoom } from "./InterviewRoom";

export const metadata: Metadata = { title: "Gespräch" };
export const dynamic = "force-dynamic";

/**
 * Das Karrieregespräch.
 *
 * Die Seite lädt drei Dinge und gibt sie weiter: den gespeicherten
 * Verlauf, die offenen Vermutungen, den Fortschritt. Alles andere
 * passiert im Gespräch selbst.
 *
 * Der Verlauf kommt aus der Datenbank, nicht aus dem Zustand einer
 * Komponente. Deshalb ist er nach einem Neuladen noch da — und auf
 * einem zweiten Gerät auch.
 */
export default async function NinaPage() {
  const { t, brand } = await getPageContext();
  const user = await requireUser();
  const view = await loadInterview();

  const gespräch = await ensureConversation(user.id, {
    kind: "career_interview",
    locale: user.locale,
    route: "/app/nina",
  });
  const nachrichten = await loadMessages(user.id, gespräch.id);

  return (
    <InterviewRoom
      assistantName={brand.assistantName}
      openingQuestion={view.step.text}
      conversationId={gespräch.id}
      initialMessages={nachrichten
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))}
      hypotheses={view.openHypotheses.slice(0, 6)}
      progress={{
        done: view.progress.understood,
        total: view.progress.total,
        minimumReached: view.progress.minimumProfileReached,
      }}
      labels={{
        yourAnswer: t("interview.yourAnswer"),
        skipQuestion: t("interview.skipQuestion"),
        pauseSession: t("interview.pauseSession"),
      }}
    />
  );
}
