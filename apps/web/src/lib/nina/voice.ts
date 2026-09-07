import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";

/**
 * Mondays Stimme.
 *
 * Ausschließlich serverseitig. Der Zugangsschlüssel steht in dieser
 * Datei nirgends und verlässt sie nie: er wird aus der Konfiguration
 * gelesen, in einen Kopf geschrieben und danach nicht mehr angefasst.
 * Es gibt keine Funktion hier, die ihn zurückgibt — auch keine
 * Fehlermeldung, die ihn enthält.
 *
 * Die Arbeitsteilung ist wichtig und soll wichtig bleiben:
 *
 *   **OpenAI ist Mondays Gehirn.** Was sie sagt, entsteht dort — mit
 *   Gedächtnis, Career Evidence, Stufenmaschine und allem, was daran
 *   hängt.
 *
 *   **ElevenLabs ist Mondays Stimme.** Es bekommt fertigen Text und gibt
 *   Ton zurück. Es entscheidet nichts, es weiß nichts über den
 *   Menschen, und es bekommt keinen Kontext.
 *
 * Deshalb nimmt `spreche()` nur Text entgegen. Es gibt keinen Weg,
 * darüber ein Gespräch zu führen.
 */

const ENDPUNKT = "https://api.elevenlabs.io/v1/text-to-speech";

/**
 * Fehlt etwas, bevor überhaupt ein Aufruf startet?
 *
 * Gibt den NAMEN der fehlenden Variablen zurück, nie ihren Wert.
 */
export function stimmenkonfigurationsproblem(
  cfg: RuntimeConfig = loadRuntimeConfig(),
): { missingVariable: string } | null {
  if (!cfg.voice.tts.apiKey) return { missingVariable: "ELEVENLABS_API_KEY" };
  if (!cfg.voice.tts.voiceId) return { missingVariable: "ELEVENLABS_VOICE_ID" };
  return null;
}

export function istStimmeEingerichtet(cfg: RuntimeConfig = loadRuntimeConfig()): boolean {
  return stimmenkonfigurationsproblem(cfg) === null;
}

export class StimmeNichtEingerichtetError extends Error {
  readonly missingVariable: string;
  constructor(missingVariable: string) {
    super(`Die Sprachausgabe ist nicht eingerichtet: ${missingVariable} fehlt.`);
    this.name = "StimmeNichtEingerichtetError";
    this.missingVariable = missingVariable;
  }
}

export class StimmeFehlgeschlagenError extends Error {
  readonly status: number;
  constructor(status: number) {
    /*
     * Bewusst OHNE den Antworttext des Anbieters.
     *
     * Fehlermeldungen wandern in Protokolle und manchmal bis zur
     * Oberfläche. Ein Anbieter, der bei einem ungültigen Schlüssel den
     * Schlüssel zurückspiegelt, hätte ihn dann dort stehen. Der
     * Statuscode reicht zur Einordnung.
     */
    super(`Die Sprachausgabe antwortete mit ${status}.`);
    this.name = "StimmeFehlgeschlagenError";
    this.status = status;
  }
}

/** Was der Client hört. Keine Kennungen, keine Zugangsdaten. */
export interface Sprachausgabe {
  audio: ReadableStream<Uint8Array>;
  contentType: string;
}

/**
 * Text zu Ton.
 *
 * `signal` ist kein Beiwerk: bricht die Person Monday mitten im Satz ab,
 * muss auch die Erzeugung aufhören. Ohne Abbruch läuft die Rechnung
 * weiter, während niemand mehr zuhört — und die Antwort kommt
 * womöglich Sekunden später über eine bereits neue.
 */
export async function spreche(
  text: string,
  options: { signal?: AbortSignal; cfg?: RuntimeConfig } = {},
): Promise<Sprachausgabe> {
  const cfg = options.cfg ?? loadRuntimeConfig();
  const problem = stimmenkonfigurationsproblem(cfg);
  if (problem) throw new StimmeNichtEingerichtetError(problem.missingVariable);

  const inhalt = text.trim();
  if (inhalt.length === 0) throw new Error("Kein Text zum Vorlesen.");

  /*
   * Eine Obergrenze, die zur Sache passt.
   *
   * Mondays Antworten sind laut Systemprompt 60 bis 120 Wörter. 5000
   * Zeichen sind großzügig und verhindern trotzdem, dass ein Fehler
   * anderswo hier eine Rechnung erzeugt.
   */
  const gekürzt = inhalt.slice(0, 5000);

  /*
   * Ein eigenes Zeitlimit zusätzlich zum Abbruchsignal des Aufrufers.
   *
   * Ohne das hängt eine Anfrage an einen stummen Anbieter, bis der
   * Server sie irgendwann aufgibt — und die Person sieht in der
   * Zwischenzeit einen Ladezustand ohne Ende.
   */
  const zeitlimit = new AbortController();
  const uhr = setTimeout(() => zeitlimit.abort(), 20_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, zeitlimit.signal])
    : zeitlimit.signal;

  try {
    const antwort = await fetch(
      `${ENDPUNKT}/${cfg.voice.tts.voiceId}/stream?output_format=mp3_22050_32`,
      {
        method: "POST",
        signal,
        headers: {
          // Der einzige Ort, an dem der Schlüssel vorkommt.
          "xi-api-key": cfg.voice.tts.apiKey!,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: gekürzt,
          model_id: cfg.voice.tts.modelId,
          voice_settings: {
            /* Ruhig und gleichmäßig: Monday soll verständlich sein, nicht
               ausdrucksstark. Eine Karriereberatung, die dramatisch
               klingt, klingt unglaubwürdig. */
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!antwort.ok || !antwort.body) {
      throw new StimmeFehlgeschlagenError(antwort.status);
    }

    return {
      audio: antwort.body,
      contentType: antwort.headers.get("content-type") ?? "audio/mpeg",
    };
  } finally {
    clearTimeout(uhr);
  }
}

/**
 * Text in sprechbare Stücke schneiden.
 *
 * Für den Fall, dass später an Satzgrenzen gestückelt gesprochen wird.
 * Geschnitten wird an Satzenden, nie mitten im Wort — ein abgebrochenes
 * Wort hört man sofort, eine kurze Pause zwischen zwei Sätzen nicht.
 *
 * Reine Funktion, damit die Grenzen prüfbar sind.
 */
export function inSprechstücke(text: string, mindestZeichen = 120): string[] {
  const sätze = text.match(/[^.!?…]+[.!?…]+["»)\]]*\s*|[^.!?…]+$/g) ?? [];
  const stücke: string[] = [];
  let puffer = "";

  for (const satz of sätze) {
    puffer += satz;
    // Erst ab einer Mindestlänge abschließen: einzelne kurze Sätze
    // ergäben sonst eine Kette von Schnipseln mit hörbaren Lücken.
    if (puffer.trim().length >= mindestZeichen) {
      stücke.push(puffer.trim());
      puffer = "";
    }
  }
  if (puffer.trim()) stücke.push(puffer.trim());

  return stücke.filter((s) => s.length > 0);
}
