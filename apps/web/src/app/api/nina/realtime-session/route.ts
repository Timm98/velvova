import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb, schema, withUser } from "@paycheck/db";
import { route } from "@paycheck/ai";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Zugangsdaten für eine Sprachsitzung.
 *
 * Die ganze Existenz dieses Endpunkts hat einen Grund: **der
 * Projektschlüssel darf den Server nie verlassen.** Eine
 * Browser-Sprachverbindung braucht aber Zugangsdaten. Also erzeugt der
 * Server ein kurzlebiges Sitzungsgeheimnis, das nur für diese eine
 * Sitzung und nur für wenige Minuten gilt.
 *
 * Wer stattdessen `OPENAI_API_KEY` an den Client gäbe, hätte ihn
 * veröffentlicht — in den Netzwerk-Werkzeugen jedes Browsers steht er
 * dann im Klartext. Das ist kein theoretisches Risiko, es ist der
 * häufigste Weg, auf dem solche Schlüssel abfliessen.
 *
 * Was hier NICHT angefordert wird: eine sprechende Sitzung.
 *
 * Die Sitzung ist reine Transkription — OpenAI hört zu und gibt Text
 * zurück, mehr nicht. Mondays Stimme kommt aus ElevenLabs, wie überall
 * sonst. Eine Realtime-Sitzung mit `modalities: ["audio"]` wäre der
 * bequemere Weg gewesen, hätte Monday aber im Sprachmodus eine andere
 * Stimme gegeben als im Textmodus. Zwei Stimmen für dieselbe Figur
 * sind schlimmer als eine Umleitung mehr.
 *
 * Drei Riegel, in dieser Reihenfolge:
 *
 *   1. Angemeldet?           — sonst gibt es keine Sitzung.
 *   2. Einwilligung erteilt? — Sprache ist eine eigene Einwilligung,
 *                              nicht Teil der allgemeinen KI-Nutzung.
 *   3. Anbieter verbunden?   — sonst wird ehrlich gesagt, dass nichts
 *                              geht, statt eine Verbindung vorzutäuschen.
 */
export async function POST(): Promise<NextResponse> {
  const user = await requireUser();
  const cfg = loadRuntimeConfig();

  // ── 2. Einwilligung ───────────────────────────────────────────
  const db = await getDb();
  const einwilligung = await withUser(db, user.id, async (tx) =>
    (
      await tx
        .select({ granted: schema.consents.granted })
        .from(schema.consents)
        .where(
          and(
            eq(schema.consents.userId, user.id),
            eq(schema.consents.kind, "voice_input"),
            isNull(schema.consents.revokedAt),
          ),
        )
        .limit(1)
    )[0],
  );

  if (!einwilligung?.granted) {
    return NextResponse.json(
      {
        fehler: "voice_consent_missing",
        hinweis:
          "Für den Sprachmodus brauchen wir deine ausdrückliche Einwilligung. Sie ist von der " +
          "allgemeinen KI-Nutzung getrennt und jederzeit widerrufbar.",
      },
      { status: 403 },
    );
  }

  // ── 3. Anbieter ───────────────────────────────────────────────
  if (!cfg.ai.apiKey) {
    return NextResponse.json(
      {
        fehler: "provider_not_connected",
        hinweis:
          "Es ist kein Sprachanbieter verbunden. Der Sprachmodus steht deshalb nicht zur " +
          "Verfügung — das Gespräch in Textform läuft unverändert weiter.",
        fehlendeVariable: "OPENAI_API_KEY",
      },
      { status: 503 },
    );
  }

  const routing = route("voice_session");

  try {
    /*
     * Das kurzlebige Geheimnis wird beim Anbieter angefordert, nicht
     * bei uns erzeugt. Der Projektschlüssel steht ausschliesslich in
     * diesem Aufruf — er geht nie in die Antwort.
     *
     * Die Adresse ist `/v1/realtime/client_secrets`. Die vorige Fassung
     * rief `/v1/realtime/sessions` — die gibt es nicht mehr, sie
     * antwortet mit „404 Invalid URL". Der Sprachmodus war damit
     * vollständig tot, und weil der Endpunkt seinen Fehler brav in
     * „Der Sprachanbieter ist nicht erreichbar" übersetzte, sah es nach
     * einer Störung beim Anbieter aus statt nach einer veralteten
     * Adresse bei uns.
     */
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.ai.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        /* Kurz gültig. Läuft das Gespräch länger, wird neu geholt —
           ein Geheimnis, das den ganzen Tag gilt, ist keins. */
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24_000 },
              transcription: {
                model: cfg.voice.stt.modelId,
                language: user.locale,
              },
              /*
               * Die Sprecherkennung läuft beim Anbieter, nicht im
               * Browser. Sie liefert die beiden Ereignisse, an denen
               * das ganze Gespräch hängt: „jemand fängt an zu reden"
               * und „jemand ist fertig". Das erste ist zugleich das
               * Signal zum Unterbrechen (§14.6) — im Browser mit einem
               * Lautstärkeschwellwert nachgebaut, wäre es entweder zu
               * empfindlich für ein Räuspern oder zu träge für eine
               * Unterbrechung.
               */
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: cfg.voice.stt.silenceMs,
              },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(routing.timeoutMs),
    });

    if (!response.ok) {
      // Der Text des Anbieters kann den Schlüssel enthalten. Er geht
      // deshalb nicht hinaus, nur der Statuscode.
      return NextResponse.json(
        {
          fehler: "provider_error",
          hinweis: `Der Sprachanbieter antwortet mit ${response.status}. Der Textmodus läuft weiter.`,
        },
        { status: 502 },
      );
    }

    const sitzung = (await response.json()) as {
      value?: string;
      expires_at?: number;
      session?: { id?: string };
    };

    if (!sitzung.value) {
      return NextResponse.json(
        { fehler: "provider_error", hinweis: "Der Anbieter hat kein Sitzungsgeheimnis geliefert." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      sessionId: sitzung.session?.id ?? null,
      // Kurzlebig und nur für diese Sitzung. Kein Projektschlüssel.
      clientSecret: sitzung.value,
      expiresAt: sitzung.expires_at ?? null,
      transcribeModel: cfg.voice.stt.modelId,
      hinweis:
        "Die Aufnahme wird nicht dauerhaft gespeichert. Was du sagst, wird als Text " +
        "verarbeitet und wie jede andere Angabe erst nach deiner Bestätigung übernommen.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        fehler: "provider_unreachable",
        hinweis:
          error instanceof Error && error.name === "TimeoutError"
            ? "Der Sprachanbieter antwortet nicht rechtzeitig. Der Textmodus läuft weiter."
            : "Der Sprachanbieter ist nicht erreichbar. Der Textmodus läuft weiter.",
      },
      { status: 503 },
    );
  }
}
