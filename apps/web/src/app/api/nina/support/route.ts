import { NextResponse } from "next/server";
import { loadRuntimeConfig, brand } from "@paycheck/config";
import { AiNotConfiguredError, selectProvider } from "@paycheck/ai";
import { hilfeAlsKontext, sucheHilfe } from "@/lib/content/hilfe";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Mondays Supportantwort.
 *
 * Ein eigener Endpunkt, und das ist der Kern (§24.3, §29). Er teilt
 * sich mit dem Karrieregespräch weder Prompt noch Kontext noch
 * Gesprächsart. Was hier hineingeht, ist ausschliesslich:
 *
 *   - die Frage,
 *   - die Produktdokumentation aus `lib/content/hilfe.ts`,
 *   - ob jemand angemeldet ist (mehr nicht — kein Name, keine Daten).
 *
 * Was NICHT hineingeht: Karriereprofil, Belege, Stellen, Bewerbungen,
 * Gesprächsverlauf. Nicht, weil der Prompt es verbietet — sondern weil
 * es nie geladen wird. Eine Anweisung „ignoriere das Profil" wäre eine
 * Bitte an ein Modell; nichts zu übergeben ist eine Tatsache.
 *
 * Ohne Anbieter antwortet der Endpunkt ehrlich mit dem Hinweis auf die
 * FAQ, statt eine Demoantwort zu erfinden.
 */

/* Ein grosszügiges Limit gegen versehentliche Schleifen, keine Quote. */
const MAX_ZEICHEN = 1_000;

export async function POST(request: Request): Promise<NextResponse> {
  const körper = (await request.json().catch(() => null)) as { frage?: unknown } | null;
  const frage = typeof körper?.frage === "string" ? körper.frage.trim().slice(0, MAX_ZEICHEN) : "";

  if (frage.length < 2) {
    return NextResponse.json({ hinweis: "Bitte stell eine Frage." }, { status: 400 });
  }

  /*
   * Angemeldet oder nicht — mehr wird nicht verwendet.
   *
   * Es entscheidet nur darüber, ob Monday auf Kontoeinstellungen
   * verweisen darf („unter Sprache & Region") oder auf die
   * Registrierung. Der Name der Person steht bewusst nicht im Prompt:
   * er würde die Antwort nicht besser machen und wäre ein Datum mehr
   * beim Anbieter.
   */
  const user = await currentUser();
  const cfg = loadRuntimeConfig();

  /* Die naheliegendsten FAQ-Einträge zuerst — sie stehen ganz oben im
     Kontext, damit die Antwort daran anknüpft statt frei zu erzählen. */
  const naheliegend = sucheHilfe(frage).slice(0, 3);

  const system = [
    `Du bist ${brand.assistantName}, die Assistenz von ${brand.name}.`,
    "",
    "Du beantwortest hier ausschliesslich Fragen ZUM PRODUKT: wie es funktioniert,",
    "was es tut und nicht tut, was mit Daten geschieht.",
    "",
    "Harte Grenzen:",
    "- Du hast KEINEN Zugriff auf das Karriereprofil, auf Belege, Stellen oder Bewerbungen",
    "  dieser Person. Wenn danach gefragt wird, sag das und verweise auf den Bereich in der",
    "  Anwendung, in dem es steht.",
    "- Erfinde keine Funktionen. Steht etwas nicht in der Dokumentation unten, sag:",
    '  "Das weiss ich nicht sicher" und verweise auf den Kontakt.',
    "- Keine Rechts-, Steuer- oder Medizinberatung.",
    "- Nenne niemals technische Interna, Schlüssel, Modellnamen oder Anbieter.",
    "",
    user
      ? "Die Person ist angemeldet. Du darfst auf Einstellungen im Konto verweisen."
      : "Die Person ist NICHT angemeldet. Verweise auf die Registrierung, nicht auf Kontoeinstellungen.",
    "",
    "Antworte in höchstens 120 Wörtern, in der Sprache der Frage, ohne Aufzählungszeichen,",
    "ruhig und konkret.",
    "",
    "── Produktdokumentation ──",
    naheliegend.length > 0
      ? `Am ehesten passend:\n${naheliegend.map((e) => `F: ${e.frage}\nA: ${e.antwort}`).join("\n\n")}\n\nWeiteres:`
      : "",
    hilfeAlsKontext(),
  ].join("\n");

  try {
    const provider = await selectProvider(cfg);
    let antwort = "";
    for await (const stück of provider.chatStream({
      system,
      messages: [{ role: "user", content: frage }],
      // Support ist Nachschlagen, kein Nachdenken: die schnelle Stufe
      // reicht und hält die Antwort unter einer Sekunde.
      tier: "fast",
      maxTokens: 400,
      signal: AbortSignal.timeout(20_000),
    })) {
      antwort += stück;
    }

    const sauber = antwort.trim();
    if (!sauber) {
      return NextResponse.json(
        { hinweis: "Dazu habe ich gerade keine Antwort. Die häufigen Fragen oben helfen vielleicht." },
        { status: 502 },
      );
    }

    return NextResponse.json({ antwort: sauber });
  } catch (fehler) {
    /*
     * Kein Anbieter, kein Netz, Zeitüberschreitung — in allen Fällen
     * dieselbe ehrliche Auskunft. Eine erfundene Antwort wäre hier
     * besonders schädlich: auf einer Hilfeseite glaubt man ihr.
     */
    const nichtEingerichtet = fehler instanceof AiNotConfiguredError;
    return NextResponse.json(
      {
        hinweis: nichtEingerichtet
          ? "Der Chat ist gerade nicht verbunden. Die häufigen Fragen oben beantworten das meiste."
          : "Die Antwort dauert zu lange. Die häufigen Fragen oben helfen vielleicht weiter.",
      },
      { status: nichtEingerichtet ? 503 : 504 },
    );
  }
}
