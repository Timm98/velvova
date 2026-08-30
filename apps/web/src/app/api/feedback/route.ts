import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { FeedbackInput, saveFeedback } from "@/lib/feedback/service";

export const dynamic = "force-dynamic";

/**
 * Rückmeldungen entgegennehmen — auch ohne Anmeldung.
 *
 * Wer ein Datenschutzproblem meldet, soll das nicht mit seinem Namen
 * tun müssen. Anonym ist deshalb ein gültiger Weg, kein Sonderfall.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = FeedbackInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { fehler: "Die Rückmeldung konnte nicht gelesen werden.", details: parsed.error.issues.map((i) => i.path.join(".")) },
      { status: 400 },
    );
  }

  const user = await currentUser().catch(() => null);

  const { id } = await saveFeedback(parsed.data, {
    userId: user?.id ?? null,
    userAgent: request.headers.get("user-agent") ?? "",
    appVersion: process.env.npm_package_version ?? "dev",
  });

  return NextResponse.json({
    id,
    hinweis:
      "Danke. Wir lesen jede Rückmeldung. Wenn du eine Antwort möchtest, brauchen wir deine " +
      "Erlaubnis, dich zu kontaktieren.",
  });
}
