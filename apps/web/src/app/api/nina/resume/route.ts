import { NextResponse } from "next/server";
import { brand } from "@paycheck/config";
import { requireUser } from "@/lib/auth";
import { buildContextEnvelope } from "@/lib/nina/context/build-context-envelope";
import { resumeMessage } from "@/lib/nina/workflow/state-machine";

export const dynamic = "force-dynamic";

/**
 * Wo waren wir?
 *
 * Die eine Frage, die eine Assistenz nach einem Neustart beantworten
 * können muss. Die Antwort kommt aus dem gespeicherten Zustand, nicht
 * aus dem Kontextfenster — deshalb überlebt sie einen Browserwechsel,
 * ein neues Gerät und drei Tage Pause.
 *
 * Liegt kein Ereignis vor, behauptet die Antwort nichts. Das ist der
 * Unterschied zwischen Erinnern und so tun als ob.
 */
export async function GET() {
  const user = await requireUser();
  const envelope = await buildContextEnvelope(user.id);

  return NextResponse.json({
    stage: envelope.workflowStage,
    lastCompletedAction: envelope.lastCompletedAction,
    pendingAction: envelope.pendingAction,
    selectedJobIds: envelope.selectedJobIds,
    careerProfileId: envelope.careerProfileId,
    message: resumeMessage(
      {
        stage: envelope.workflowStage,
        lastCompletedAction: envelope.lastCompletedAction,
        currentAction: envelope.currentAction,
        pendingAction: envelope.pendingAction,
        nextRecommendedAction: envelope.pendingAction,
        selectedJobIds: envelope.selectedJobIds,
        version: 1,
      },
      brand.assistantName,
    ),
  });
}
