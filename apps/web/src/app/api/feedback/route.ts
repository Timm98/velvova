import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { FeedbackInput, saveFeedback } from "@/lib/feedback/service";
import { absender, prüfeGrenze } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Rückmeldungen entgegennehmen — auch ohne Anmeldung.
 *
 * Wer ein Datenschutzproblem meldet, soll das nicht mit seinem Namen
 * tun müssen. Anonym ist deshalb ein gültiger Weg, kein Sonderfall.
 */
/*
 * Fünf Nachrichten in zehn Minuten je Absender (§25).
 *
 * Grosszügig genug, dass niemand im Alltag daran stösst — auch nicht,
 * wer eine Nachricht abschickt, einen Tippfehler bemerkt und sie
 * gleich noch einmal schickt. Eng genug, dass ein Formularroboter
 * nicht die Datenbank füllt.
 */
const GRENZE = { anzahl: 5, fensterMs: 10 * 60_000 };

export async function POST(request: Request): Promise<NextResponse> {
  const roh = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  /*
   * Der Honigtopf.
   *
   * Ein Feld, das im Formular unsichtbar ist und von keinem Menschen
   * ausgefüllt werden kann. Automaten füllen alles aus, was sie finden.
   *
   * Die Antwort ist bewusst ein freundliches „angekommen" mit einer
   * erfundenen Kennung statt einer Ablehnung: ein Automat, der eine
   * Fehlermeldung bekommt, lernt daraus und versucht es anders. Einer,
   * der Erfolg gemeldet bekommt, hört auf.
   */
  if (typeof roh?.website === "string" && roh.website.trim().length > 0) {
    return NextResponse.json({ id: "ok", hinweis: "Danke. Wir lesen jede Rückmeldung." });
  }

  const grenze = prüfeGrenze(`feedback:${absender(request)}`, GRENZE);
  if (!grenze.erlaubt) {
    return NextResponse.json(
      {
        fehler:
          "Das waren gerade viele Nachrichten. Bitte versuch es in ein paar Minuten noch einmal — " +
          "die vorherigen sind angekommen.",
      },
      { status: 429, headers: { "retry-after": String(grenze.zurücksetzenIn) } },
    );
  }

  const parsed = FeedbackInput.safeParse(roh);
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
