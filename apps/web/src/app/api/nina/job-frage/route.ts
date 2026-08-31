import { NextResponse } from "next/server";
import { brand, loadRuntimeConfig } from "@paycheck/config";
import { AiNotConfiguredError, selectProvider } from "@paycheck/ai";
import { requireUser } from "@/lib/auth";
import { listJobsForUser, loadProfileContext } from "@/lib/matching";

export const dynamic = "force-dynamic";

/**
 * Eine Kurzfrage zu genau einer Stelle (§13.3).
 *
 * Der Zuschnitt ist der Punkt: Nina bekommt diese eine Anzeige und das
 * Profil dieser Person — nicht das laufende Karrieregespräch, nicht die
 * Liste, nicht andere Stellen. Die Antwort gehört zu dieser Seite und
 * soll sie nicht verlassen.
 *
 * Was Nina ausdrücklich NICHT tut: den Arbeitsalltag ausschmücken, weil
 * die Anzeige dazu schweigt. Eine Stellenanzeige sagt wenig; das
 * Wertvolle ist zu sagen, WAS sie verschweigt, nicht die Lücke
 * plausibel zu füllen.
 */

const FRAGEN: Record<string, string> = {
  day: "Wie sieht der echte Arbeitsalltag in dieser Rolle wahrscheinlich aus — und was sagt die Anzeige dazu nicht?",
  gap: "Welche Anforderungen erfülle ich laut meinen bestätigten Angaben nicht oder nur teilweise?",
  flags: "Welche Warnsignale siehst du in dieser Anzeige?",
  questions: "Welche Fragen sollte ich im Gespräch zu dieser Stelle stellen?",
};

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();
  const körper = (await request.json().catch(() => null)) as
    | { jobId?: unknown; frage?: unknown }
    | null;

  const jobId = typeof körper?.jobId === "string" ? körper.jobId : "";
  const schlüssel = typeof körper?.frage === "string" ? körper.frage : "";
  const frage = FRAGEN[schlüssel];

  if (!jobId || !frage) {
    return NextResponse.json({ hinweis: "Unbekannte Frage." }, { status: 400 });
  }

  const ctx = await loadProfileContext(user.id);
  const { jobs } = await listJobsForUser(user.id, ctx, { includeBlocked: true });
  const treffer = jobs.find((j) => j.jobId === jobId);

  if (!treffer) {
    return NextResponse.json({ hinweis: "Diese Stelle steht nicht mehr zur Verfügung." }, { status: 404 });
  }

  const j = treffer.job;

  /*
   * Nur belegte Angaben.
   *
   * Was in der Anzeige nicht steht, steht hier als „nicht angegeben" —
   * nicht als Leerstelle, die ein Modell auffüllen darf. Der
   * Unterschied entscheidet, ob Nina berichtet oder dichtet.
   */
  const fakten = [
    `Titel: ${j.title}`,
    `Unternehmen: ${j.companyName}`,
    `Ort: ${j.location || "nicht angegeben"}`,
    `Arbeitsmodell: ${j.workModel || "nicht angegeben"}`,
    `Vertragsart: ${j.contractType || "nicht angegeben"}`,
    j.salary.disclosed && (j.salary.min ?? j.salary.max)
      ? `Gehalt: ${j.salary.min ?? "?"}–${j.salary.max ?? "?"} ${j.salary.currency ?? ""} pro ${j.salary.period ?? "Jahr"}`
      : "Gehalt: nicht angegeben",
    j.coreTasks.length > 0
      ? `Genannte Aufgaben: ${j.coreTasks.join("; ")}`
      : "Aufgaben: nicht angegeben",
    `Quelle: ${treffer.source?.displayName ?? "unbekannt"}`,
  ].join("\n");

  const profil = [
    ctx.coverage > 0 ? `Profilabdeckung: ${Math.round(ctx.coverage * 100)} %` : "Profil: noch leer",
    treffer.fit.band ? `Errechnete Passung: ${treffer.fit.band}` : "",
    treffer.constraints.overall === "blocked"
      ? "Diese Stelle verletzt mindestens eine harte Bedingung der Person."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    `Du bist ${brand.assistantName}. Du beantwortest eine Kurzfrage zu GENAU EINER Stellenanzeige.`,
    "",
    "Regeln:",
    "- Stütze dich ausschliesslich auf die Angaben unten. Was dort „nicht angegeben\" heisst,",
    "  ist unbekannt — benenne die Lücke, statt sie plausibel zu füllen.",
    "- Erfinde keine Gehälter, keine Teamgrössen, keine Unternehmenskultur.",
    "- Keine Wahrscheinlichkeit für eine Einstellung, keine Prognose.",
    "- Wenn die Angaben für die Frage nicht reichen, sag genau das.",
    "",
    "Antworte in höchstens 130 Wörtern, in ganzen Sätzen, ohne Aufzählungszeichen.",
    "",
    "── Diese Stelle ──",
    fakten,
    "",
    "── Über die Person (bestätigte Angaben) ──",
    profil || "Noch keine bestätigten Angaben.",
  ].join("\n");

  try {
    const provider = await selectProvider(loadRuntimeConfig());
    let antwort = "";
    for await (const stück of provider.chatStream({
      system,
      messages: [{ role: "user", content: frage }],
      tier: "interactive",
      maxTokens: 450,
      signal: AbortSignal.timeout(25_000),
    })) {
      antwort += stück;
    }

    const sauber = antwort.trim();
    if (!sauber) {
      return NextResponse.json({ hinweis: "Dazu habe ich gerade keine Antwort." }, { status: 502 });
    }
    return NextResponse.json({ antwort: sauber, frage });
  } catch (fehler) {
    return NextResponse.json(
      {
        hinweis:
          fehler instanceof AiNotConfiguredError
            ? "Der Assistent ist gerade nicht verbunden. Die Angaben zur Stelle stehen unverändert daneben."
            : "Die Antwort dauert zu lange. Versuch es gleich noch einmal.",
      },
      { status: fehler instanceof AiNotConfiguredError ? 503 : 504 },
    );
  }
}
