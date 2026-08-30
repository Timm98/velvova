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
     */
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.ai.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.ai.modelRealtime,
        voice: "alloy",
        // Kein dauerhaftes Audio. Was gesprochen wurde, wird als Text
        // verarbeitet und dann verworfen; die Aufnahme selbst bleibt
        // nirgends liegen.
        modalities: ["audio", "text"],
        instructions:
          "Du führst ein Karrieregespräch auf Deutsch. Frage nach konkreten Situationen, " +
          "nicht nach Selbsteinschätzungen. Erfinde nichts. Analysiere weder Stimme noch " +
          "Akzent noch Gefühlslage — nur den Wortlaut.",
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
      id?: string;
      client_secret?: { value?: string; expires_at?: number };
    };

    const geheimnis = sitzung.client_secret?.value;
    if (!geheimnis) {
      return NextResponse.json(
        { fehler: "provider_error", hinweis: "Der Anbieter hat kein Sitzungsgeheimnis geliefert." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      sessionId: sitzung.id ?? null,
      // Kurzlebig und nur für diese Sitzung. Kein Projektschlüssel.
      clientSecret: geheimnis,
      expiresAt: sitzung.client_secret?.expires_at ?? null,
      model: cfg.ai.modelRealtime,
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
