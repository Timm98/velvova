import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Welche Modelle unser Konto wirklich hergibt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das gemessen und nicht angenommen wird
 * ══════════════════════════════════════════════════════════════
 *
 * In `runtime.ts` standen `gpt-5.6-terra`, `gpt-5.6-sol` und
 * `gpt-5.6-luna` als Grundwerte. Sie stammten aus einer Ankündigung,
 * nicht aus einem Aufruf — und lieferten 404.
 *
 * Dass ein Modell in den Projekteinstellungen freigeschaltet ist, ist
 * ein Hinweis. Der Beweis ist ein Aufruf mit unserem Schlüssel.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum je Art ein anderer Endpunkt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Einbettungsmodell an `/chat/completions` zu schicken ergibt
 * einen Fehler, der nichts über die Verfügbarkeit sagt — nur darüber,
 * dass man den falschen Endpunkt gewählt hat. Dasselbe gilt für
 * Sprache und Transkription.
 *
 * Realtime lässt sich ohne WebSocket-Sitzung gar nicht sinnvoll
 * prüfen; hier zählt nur, ob es in der Modell-Liste steht.
 *
 * Aufruf: node --experimental-strip-types scripts/modell-diagnose.mjs
 */

const schluessel = process.env.OPENAI_API_KEY;
if (!schluessel) {
  console.error("OPENAI_API_KEY fehlt. Nichts geprüft.");
  process.exit(1);
}

const trenner = (t) => console.log(`\n${"═".repeat(66)}\n${t}\n${"═".repeat(66)}`);

async function ruf(pfad, koerper, timeoutMs = 60_000) {
  const start = Date.now();
  try {
    const antwort = await fetch(`https://api.openai.com/v1${pfad}`, {
      method: koerper ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${schluessel}`,
        ...(koerper ? { "content-type": "application/json" } : {}),
      },
      body: koerper ? JSON.stringify(koerper) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await antwort.text();
    let daten = null;
    try {
      daten = JSON.parse(text);
    } catch {
      /* kein JSON */
    }
    return { status: antwort.status, daten, roh: text, ms: Date.now() - start };
  } catch (f) {
    return { status: 0, daten: null, roh: String(f?.message ?? f), ms: Date.now() - start };
  }
}

/* ═══════════════════════════════════════════════════════════════
   1. Die Liste
   ═══════════════════════════════════════════════════════════════ */
trenner("1. GET /v1/models — was das Projekt kennt");

const liste = await ruf("/models");
if (liste.status !== 200) {
  console.error(`Fehlgeschlagen: ${liste.status} ${liste.roh.slice(0, 200)}`);
  process.exit(1);
}
const bekannt = new Set((liste.daten?.data ?? []).map((m) => m.id));
console.log(`${bekannt.size} Modelle im Projekt sichtbar.`);

const GEFRAGT = [
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1-mini",
  "gpt-realtime-2.1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-tts",
  "text-embedding-3-large",
  "text-embedding-3-small",
];

console.log("\nGefragt:");
for (const m of GEFRAGT) console.log(`  ${bekannt.has(m) ? "gelistet   " : "NICHT      "} ${m}`);

/* Was sonst noch da ist und interessant sein könnte. */
const interessant = [...bekannt]
  .filter((m) => /^(gpt-[56]|o[0-9]|text-embedding)/.test(m))
  .sort();
console.log(`\nWeitere gelistete Text-/Einbettungsmodelle (${interessant.length}):`);
console.log("  " + interessant.join("\n  "));

/* ═══════════════════════════════════════════════════════════════
   2. Echte Aufrufe
   ═══════════════════════════════════════════════════════════════ */
trenner("2. Echter Aufruf je Textmodell");

const TEXT = GEFRAGT.filter((m) => /^gpt-[456]/.test(m) && !/realtime|transcribe|tts/.test(m));

console.log("Modell                 Status  Latenz   Struktur  Werkzeuge      Bemerkung");
const befunde = {};

for (const modell of TEXT) {
  /*
   * Die kleinstmögliche Anfrage: ein Wort Antwort.
   *
   * `max_completion_tokens` statt `max_tokens` — die neueren Modelle
   * weisen den alten Namen ab. Wer das nicht weiss, hält ein
   * funktionierendes Modell für kaputt.
   */
  const einfach = await ruf("/chat/completions", {
    model: modell,
    messages: [{ role: "user", content: "Antworte mit dem Wort: ja" }],
    max_completion_tokens: 16,
  });

  let struktur = "—";
  let werkzeuge = "—";

  if (einfach.status === 200) {
    /* Strukturierte Ausgabe. */
    const s = await ruf("/chat/completions", {
      model: modell,
      messages: [{ role: "user", content: "Gib {\"ok\": true} zurück." }],
      max_completion_tokens: 32,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "probe",
          strict: true,
          schema: {
            type: "object",
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
            additionalProperties: false,
          },
        },
      },
    });
    struktur = s.status === 200 ? "ja" : `nein(${s.status})`;

    /*
     * Werkzeugaufrufe — an beiden Endpunkten.
     *
     * ══════════════════════════════════════════════════════════
     * Warum zwei Versuche und nicht einer
     * ══════════════════════════════════════════════════════════
     *
     * Der erste Anlauf prüfte nur `/chat/completions` und meldete für
     * `gpt-5.6-sol` und `gpt-6-astra` ein glattes „nein(400)". Das
     * sah nach einem fehlenden Können aus. Die Meldung sagte etwas
     * anderes:
     *
     *   „Function tools with reasoning_effort are not supported for
     *    gpt-5.6-sol in /v1/chat/completions. To use function tools,
     *    use /v1/responses."
     *
     * Die Modelle können Werkzeuge. Nur nicht an dem Endpunkt, den
     * wir gefragt haben. Eine Diagnose, die das nicht unterscheidet,
     * hätte zwei brauchbare Modelle aussortiert.
     */
    const chatWerkzeug = await ruf("/chat/completions", {
      model: modell,
      messages: [{ role: "user", content: "Wie ist das Wetter in Berlin?" }],
      max_completion_tokens: 64,
      tools: [
        {
          type: "function",
          function: {
            name: "wetter",
            description: "Wetter für eine Stadt",
            parameters: {
              type: "object",
              properties: { stadt: { type: "string" } },
              required: ["stadt"],
            },
          },
        },
      ],
    });

    if (chatWerkzeug.status === 200) {
      werkzeuge = "chat";
    } else {
      const resp = await ruf("/responses", {
        model: modell,
        input: "Wie ist das Wetter in Berlin?",
        max_output_tokens: 64,
        tools: [
          {
            type: "function",
            name: "wetter",
            description: "Wetter für eine Stadt",
            parameters: {
              type: "object",
              properties: { stadt: { type: "string" } },
              required: ["stadt"],
              additionalProperties: false,
            },
            strict: true,
          },
        ],
      });
      werkzeuge = resp.status === 200 ? "nur responses" : `nein(${chatWerkzeug.status})`;
    }
  }

  const fehler =
    einfach.status === 200
      ? ""
      : (einfach.daten?.error?.code ?? einfach.daten?.error?.message ?? einfach.roh).toString().slice(0, 40);

  befunde[modell] = { status: einfach.status, ms: einfach.ms, struktur, werkzeuge };
  console.log(
    `${modell.padEnd(22)} ${String(einfach.status).padEnd(7)} ${String(einfach.ms + " ms").padEnd(8)} ` +
      `${struktur.padEnd(9)} ${werkzeuge.padEnd(14)} ${fehler}`,
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. Einbettungen — eigener Endpunkt
   ═══════════════════════════════════════════════════════════════ */
trenner("3. Einbettungen — echter Abruf, mit Dimensionen");

for (const modell of ["text-embedding-3-large", "text-embedding-3-small"]) {
  const r = await ruf("/embeddings", { model: modell, input: "Lagerhelfer in Karlsruhe" });
  const dim = r.daten?.data?.[0]?.embedding?.length ?? null;
  console.log(
    `  ${modell.padEnd(24)} ${String(r.status).padEnd(5)} ${String(r.ms + " ms").padEnd(8)} ` +
      `${dim ? `${dim} Dimensionen` : (r.daten?.error?.code ?? "").toString().slice(0, 40)}`,
  );
  befunde[modell] = { status: r.status, ms: r.ms, dim };
}

/* ═══════════════════════════════════════════════════════════════
   4. Sprache und Transkription — nur Listenprüfung
   ═══════════════════════════════════════════════════════════════ */
trenner("4. Sprache, Transkription, Realtime");

console.log("Diese lassen sich nicht über den Textendpunkt prüfen — ein Fehler dort");
console.log("sagt nur, dass der Endpunkt falsch war. Geprüft wird die Listung:\n");
for (const m of ["gpt-realtime-2.1", "gpt-4o-transcribe", "gpt-4o-mini-tts"]) {
  console.log(`  ${bekannt.has(m) ? "gelistet   " : "NICHT      "} ${m}`);
}

/* Ein echter Sprachabruf ist billig genug für eine Probe. */
const tts = await ruf("/audio/speech", {
  model: "gpt-4o-mini-tts",
  input: "Test.",
  voice: "alloy",
});
console.log(
  `\n  gpt-4o-mini-tts echter Abruf: ${tts.status} ${
    tts.status === 200 ? `(${tts.ms} ms, Audio empfangen)` : tts.roh.slice(0, 80)
  }`,
);

trenner("Zusammenfassung");
const nutzbar = Object.entries(befunde).filter(([, b]) => b.status === 200).map(([m]) => m);
const nicht = Object.entries(befunde).filter(([, b]) => b.status !== 200).map(([m]) => m);
console.log(`Nutzbar (${nutzbar.length}): ${nutzbar.join(", ")}`);
console.log(`Nicht nutzbar (${nicht.length}): ${nicht.join(", ") || "—"}`);
process.exit(0);
